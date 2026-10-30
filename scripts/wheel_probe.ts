// wheel_probe.ts — run the REAL CarModelLoader pipeline in bun against a GLB
// and dump every wheel pivot's final content: children, world bboxes, derived
// radius. Reveals oversized corners + junk that rode into a pivot.
// Usage: bun scripts/wheel_probe.ts <carIds>
(globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
  class ProgressEvent { constructor(_t: string, init?: object) { Object.assign(this, init ?? {}); } };
import * as THREE from "three";
import * as fs from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { buildTemplate } from "../src/game/world/CarModelLoader";
import { carDef } from "../src/game/cars/registry";

const f2 = (n: number) => (Math.round(n * 1000) / 1000).toFixed(3);

// geometry probe: KTX2 textures can't decode in bun (no WebGL) — strip
// KHR_texture_basisu from extensionsRequired so GLTFLoader returns null
// textures instead of throwing; material names + geometry are untouched
function stripKTX2Required(buf: ArrayBuffer): ArrayBuffer {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) return buf;
  let off = 12;
  let json: { extensionsRequired?: string[] } | null = null;
  let jsonStart = 0;
  let jsonLen = 0;
  while (off < buf.byteLength) {
    const clen = dv.getUint32(off, true);
    const ctype = dv.getUint32(off + 4, true);
    if (ctype === 0x4e4f534a) {
      jsonLen = clen;
      jsonStart = off + 8;
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, jsonStart, clen)));
    }
    off += 8 + clen + (clen & 3);
  }
  if (!json?.extensionsRequired?.includes("KHR_texture_basisu")) return buf;
  json.extensionsRequired = json.extensionsRequired.filter((e) => e !== "KHR_texture_basisu");
  const js = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - (js.length & 3)) & 3;
  // rebuild: [header][JSON chunk][rest = original binary chunk bytes]
  const restStart = jsonStart + jsonLen + (jsonLen & 3);
  const restLen = buf.byteLength - restStart;
  const out = new Uint8Array(12 + 8 + js.length + pad + restLen);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, 0x46546c67, true);
  odv.setUint32(4, 2, true);
  odv.setUint32(8, out.length, true);
  odv.setUint32(12, js.length + pad, true);
  odv.setUint32(16, 0x4e4f534a, true);
  out.set(js, 20);
  // JSON chunk padding MUST be spaces (0x20), never zeros — JSON.parse
  // tolerates trailing whitespace but dies on NUL bytes
  out.fill(0x20, 20 + js.length, 20 + js.length + pad);
  out.set(new Uint8Array(buf, restStart, restLen), 20 + js.length + pad);
  return out.buffer;
}

async function main() {
  for (const id of process.argv.slice(2)) {
    const def = carDef(id);
    if (!def?.modelUrl) { console.log(`=== ${id}: procedural ===`); continue; }
    const raw = fs.readFileSync(`public${def.modelUrl}`);
    const buf0 = new ArrayBuffer(raw.byteLength);
    new Uint8Array(buf0).set(raw);
    const buf = stripKTX2Required(buf0);
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("file:///home/z/my-project/public/draco/");
    loader.setDRACOLoader(draco);
    // stub KTX2: hand out a real 1x1 DataTexture via the load callback
    // (GLTFLoader wraps loader.load in a promise that only resolves when
    // onLoad fires) — the probe only reads geometry/node names
    const ktx2 = new KTX2Loader();
    (ktx2 as unknown as { load: (u: string, cb: (t: THREE.Texture) => void) => THREE.Texture }).load = (
      _u,
      cb,
    ) => {
      const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      t.needsUpdate = true;
      if (cb) cb(t);
      return t;
    };
    loader.setKTX2Loader(ktx2);
    const gltf = (await new Promise((res, rej) =>
      loader.parse(buf, "", res as never, rej),
    )) as { scene: THREE.Group };

    // pre-pipeline: raw wheel-named mesh bounds from REAL vertices
    console.log(`\n=== ${id} — RAW (real vertices, world space) ===`);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (!/wheel/i.test(m.name)) return;
      const geo = m.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      const box = new THREE.Box3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        box.expandByPoint(v);
      }
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3());
      console.log(
        `${m.name.padEnd(34)} n=${String(pos.count).padStart(5)} ` +
        `centre(${f2(c.x)},${f2(c.y)},${f2(c.z)}) size(${f2(s.x)}x${f2(s.y)}x${f2(s.z)})`,
      );
    });

    // real pipeline
    const tpl = buildTemplate(id, gltf.scene);
    console.log(`\n=== ${id} — POST PIPELINE (wheelRadius=${f2(tpl.wheelRadius)}) ===`);
    tpl.wrapper.updateMatrixWorld(true);
    for (const pivot of [...tpl.wrapper.children]) {
      if (!/wheelPivot/.test(pivot.name)) continue;
      const pc = pivot.getWorldPosition(new THREE.Vector3());
      console.log(`\n${pivot.name}  pivot(${f2(pc.x)},${f2(pc.y)},${f2(pc.z)})  spin=${(pivot.userData as { spinAxis?: string }).spinAxis}`);
      for (const child of pivot.children) {
        const mesh = child as THREE.Mesh;
        const box = new THREE.Box3().setFromObject(mesh);
        const c = box.getCenter(new THREE.Vector3());
        const s = box.getSize(new THREE.Vector3());
        console.log(
          `  ${mesh.name.padEnd(36)} centre(${f2(c.x)},${f2(c.y)},${f2(c.z)}) ` +
          `size(${f2(s.x)}x${f2(s.y)}x${f2(s.z)})`,
        );
      }
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

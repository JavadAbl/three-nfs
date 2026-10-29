// front_zone_probe.ts — for the lamp-diagnosis cars: dump every mesh that
// carries a LIT head clone (or glass_light), with full position/extent/tri
// detail, so lens-only vs fog-including geometry is decidable from data.
(globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
  class ProgressEvent { constructor(_t: string, init?: object) { Object.assign(this, init ?? {}); } };
import * as THREE from "three";
import * as fs from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { buildTemplate } from "../src/game/world/CarModelLoader";
import { carDef } from "../src/game/cars/registry";

async function main() {
  for (const id of process.argv.slice(2)) {
    const def = carDef(id);
    if (!def?.modelUrl) continue;
    const raw = fs.readFileSync(`public${def.modelUrl}`);
    const buf = new ArrayBuffer(raw.byteLength);
    new Uint8Array(buf).set(raw);
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("file:///home/z/my-project/public/draco/");
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader({
      load: (_u: unknown, _on: unknown, onError: (e: Error) => void) => onError(new Error("stub")),
    } as never);
    const gltf = (await new Promise((res, rej) =>
      loader.parse(buf, "", res as never, rej),
    )) as { scene: THREE.Group };
    const tpl = buildTemplate(id, gltf.scene);
    console.log(`\n=== ${id} ===`);
    // clone → source name (strip _head/_rear)
    const lampNames = new Set(
      tpl.lampMats.map((lm) => lm.mat.name.replace(/_(head|rear)$/, "")),
    );
    lampNames.add("glass_light"); // the ACR lens under suspicion
    tpl.wrapper.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const hit = mats.some(
        (m) =>
          (m as THREE.MeshStandardMaterial)?.name &&
          lampNames.has((m as THREE.MeshStandardMaterial).name.replace(/_(head|rear)$/, "")),
      );
      if (!hit) return;
      const b = new THREE.Box3().setFromObject(mesh);
      const c = b.getCenter(new THREE.Vector3());
      const s = b.getSize(new THREE.Vector3());
      const geo = mesh.geometry as THREE.BufferGeometry;
      const tris = (geo.index?.count ?? 0) / 3;
      // UV bbox of the mesh (if present)
      let uvb = "no-uv";
      if (geo.attributes.uv) {
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (let i = 0; i < uv.count; i++) {
          const x = uv.getX(i), y = uv.getY(i);
          if (x < minx) minx = x;
          if (x > maxx) maxx = x;
          if (y < miny) miny = y;
          if (y > maxy) maxy = y;
        }
        uvb = `uv[0,1]: x ${minx.toFixed(2)}–${maxx.toFixed(2)} y ${miny.toFixed(2)}–${maxy.toFixed(2)}`;
      }
      console.log(
        `  mesh=${mesh.name.padEnd(24)} mats=${mats.map((m) => (m as THREE.MeshStandardMaterial).name).join("/").padEnd(38)} ` +
        `c=(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) ext=(${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)}) tris=${tris} ${uvb}`,
      );
    });
  }
}

void main();

// glass_cover_probe.ts — do the blackout/tinted glass meshes COVER the lit lamp
// lenses? The live browser shows lit lamp materials (warm-white emissive,
// canvas-blob map) that still render pitch black — hypothesis: finalizeGlass
// blacked out a glass-named material whose geometry includes the headlight /
// taillight lens covers, and the opaque #020204 pane now hides the lit lens
// behind it. This probe quantifies, per car:
//   1. every lit lamp clone → its meshes' bboxes (the lens zone)
//   2. every glass-family material → triangles that fall INSIDE (lens bbox + 6cm)
//   3. same check for ALL other materials (any mesh that covers the lens)
// Usage: bun scripts/glass_cover_probe.ts audi viper08 viper16
(globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
  class ProgressEvent { constructor(_t: string, init?: object) { Object.assign(this, init ?? {}); } };
(globalThis as unknown as { window: unknown }).window = globalThis;
import * as THREE from "three";
import * as fs from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { buildTemplate } from "../src/game/world/CarModelLoader";
import { carDef } from "../src/game/cars/registry";

const GLASSY = /glass|vit(?:re|e)|vidrio|windshield|window/i;

/** all world-space vertices of `mesh` (walks its geometry, applies world matrix) */
function worldVerts(mesh: THREE.Mesh): THREE.Vector3[] {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.attributes.position as THREE.BufferAttribute | undefined;
  if (!pos) return [];
  const out: THREE.Vector3[] = [];
  mesh.updateWorldMatrix(true, false);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    out.push(v.clone());
  }
  return out;
}

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

    // 1 ─ lens zones: bbox per lit lamp clone (expanded later by 6cm)
    const lensZones: { name: string; front: boolean; box: THREE.Box3 }[] = [];
    for (const { mat, front } of tpl.lampMats) {
      const box = new THREE.Box3();
      let any = false;
      tpl.wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (!mats.includes(mat)) return;
        box.expandByObject(mesh);
        any = true;
      });
      if (any) lensZones.push({ name: mat.name, front, box });
    }

    console.log(`\n=== ${id} (L=${tpl.dims.length.toFixed(2)}) — ${lensZones.length} lit clones with geometry ===`);
    for (const z of lensZones) {
      const c = z.box.getCenter(new THREE.Vector3());
      const s = z.box.getSize(new THREE.Vector3());
      console.log(
        `  LENS ${z.front ? "HEAD" : "TAIL"} ${z.name.padEnd(28)} c=(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) ext=(${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)})`,
      );
    }

    // 2 ─ which materials drop vertices into each lens zone (+6cm margin)?
    // (verts computed ONCE per mesh, then tested against every zone; mesh
    // bbox pre-filter keeps the big bodies cheap)
    const cover = new Map<string, { mat: THREE.MeshStandardMaterial; hits: number; byZone: Map<number, number>; total: number }>();
    const zonesExpanded = lensZones.map((z, i) => ({ i, z, probe: z.box.clone().expandByScalar(0.06) }));
    const zonesUnion = new THREE.Box3();
    for (const { probe } of zonesExpanded) zonesUnion.union(probe);
    const meshVerts = new Map<THREE.Mesh, THREE.Vector3[]>();
    tpl.wrapper.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mb = new THREE.Box3().setFromObject(mesh);
      if (!mb.intersectsBox(zonesUnion)) return; // cheap reject first
      meshVerts.set(mesh, worldVerts(mesh));
    });
    // total verts per material across the whole car (context for inZone %)
    const matTotals = new Map<THREE.MeshStandardMaterial, number>();
    for (const { i: zi, probe } of zonesExpanded) {
      for (const [mesh, vs] of meshVerts) {
        const inZone = vs.filter((v) => probe.containsPoint(v)).length;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (!sm) continue;
          if (!matTotals.has(sm)) {
            let total = 0;
            tpl.wrapper.traverse((o2) => {
              const mh = o2 as THREE.Mesh;
              if (!mh.isMesh) return;
              const ms = Array.isArray(mh.material) ? mh.material : [mh.material];
              if (!ms.includes(sm)) return;
              const pos = (mh.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute | undefined;
              total += pos?.count ?? 0;
            });
            matTotals.set(sm, total);
          }
          if (!inZone) continue;
          const key = `${sm.name}|${sm.uuid}`;
          const e = cover.get(key) ?? { mat: sm, hits: 0, byZone: new Map<number, number>(), total: matTotals.get(sm) ?? 0 };
          e.hits += inZone;
          e.byZone.set(zi, (e.byZone.get(zi) ?? 0) + inZone);
          cover.set(key, e);
        }
      }
    }
    console.log("  --- materials with vertices inside the lens zones ---");
    for (const [, e] of cover) {
      const lit = tpl.lampMats.some((l) => l.mat === e.mat);
      const zones = [...e.byZone.entries()]
        .map(([zi, h]) => `${lensZones[zi].front ? "H" : "T"}${zi}:${h}`)
        .join(" ");
      console.log(
        `  ${lit ? "LIT-LENS" : "COVER?"} ${e.mat.name.padEnd(28)} inZone=${String(e.hits).padStart(5)}/${e.total} (${(100 * e.hits / Math.max(1, e.total)).toFixed(0)}%) zones[${zones}] glassy=${GLASSY.test(e.mat.name ?? "")} ` +
        `transparent=${e.mat.transparent} opacity=${e.mat.opacity.toFixed(2)} color=#${e.mat.color.getHexString()} ` +
        `emissive=#${e.mat.emissive.getHexString()}@${e.mat.emissiveIntensity}`,
      );
      // per-mesh breakdown for glassy cover materials — decides whether a
      // per-MESH exclusion is granular enough (windows in their own meshes?)
      // inAny = UNIQUE verts in any zone (per-zone sums double-count overlaps)
      if (!lit && GLASSY.test(e.mat.name ?? "")) {
        for (const [mesh, vs] of meshVerts) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (!mats.includes(e.mat)) continue;
          const inAny = vs.filter((v) => zonesExpanded.some(({ probe }) => probe.containsPoint(v))).length;
          const mb = new THREE.Box3().setFromObject(mesh);
          const mc = mb.getCenter(new THREE.Vector3());
          console.log(
            `      mesh=${(mesh.name || "(unnamed)").padEnd(30)} verts=${String(vs.length).padStart(6)} inZone=${String(inAny).padStart(6)} (${(100 * inAny / Math.max(1, vs.length)).toFixed(0)}%) c=(${mc.x.toFixed(2)},${mc.y.toFixed(2)},${mc.z.toFixed(2)})`,
          );
        }
      }
    }
  }
}
void main();

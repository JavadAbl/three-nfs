// lamp_probe.ts — dump the REAL pipeline's lamp + glass + front-region material
// state for the given car ids. Extends glass_probe.ts with:
//  - a stubbed KTX2Loader (Vipers use KTX2; bun has no WebGL to transcode —
//    textures drop, materials survive; emissiveMap presence is checked from
//    the source GLB separately via gltf-transform)
//  - a `window` stub so finalizeGlass's dev probe (__carGlassReports) fires
//  - every lamp-family material (incl. lit clones) + every material whose mesh
//    sits in the front 45% of the car (the headlight zone)
// Usage: bun scripts/lamp_probe.ts viper08 viper16 audi
(globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
  class ProgressEvent { constructor(_t: string, init?: object) { Object.assign(this, init ?? {}); } };
(globalThis as unknown as { window: unknown }).window = globalThis;
import * as THREE from "three";
import * as fs from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { buildTemplate } from "../src/game/world/CarModelLoader";
import { carDef } from "../src/game/cars/registry";

const LAMP_MAT =
  /(?<![A-Za-z])(head.?lights?|tail.?lights?|tail.?lamps?|brake.?lights?|lights?|lamps?|luz(?:es)?|lamp(?:es|en)?|faroles?|leuchten?|phares?|feux|glows?|emiss\w*)(?![A-Za-z])/i;

function fmtMat(sm: THREE.MeshStandardMaterial): string {
  return (
    `transparent=${sm.transparent} opacity=${sm.opacity.toFixed(2)} ` +
    `color=#${sm.color.getHexString()} metal=${sm.metalness} rough=${sm.roughness} ` +
    `emissive=#${sm.emissive.getHexString()}@${sm.emissiveIntensity} ` +
    `map=${sm.map?.name ?? (sm.map ? "(tex)" : "-")} emisMap=${sm.emissiveMap?.name ?? (sm.emissiveMap ? "(tex)" : "-")}`
  );
}

async function main() {
  for (const id of process.argv.slice(2)) {
    try {
      const def = carDef(id);
      if (!def?.modelUrl) {
        console.log(`=== ${id}: procedural (no GLB) ===`);
        continue;
      }
      const raw = fs.readFileSync(`public${def.modelUrl}`);
      const buf = new ArrayBuffer(raw.byteLength);
      new Uint8Array(buf).set(raw);
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("file:///home/z/my-project/public/draco/");
      loader.setDRACOLoader(draco);
      // KTX2 stub: satisfy GLTFLoader's presence check, fail per-texture →
      // maps drop, everything else survives
      const stub = {
        load: (_u: unknown, _on: unknown, onError: (e: Error) => void) =>
          onError(new Error("ktx2-stubbed")),
      };
      (loader as unknown as { setKTX2Loader: (s: unknown) => void }).setKTX2Loader(stub);
      const gltf = (await new Promise((res, rej) =>
        loader.parse(buf, "", res as never, rej),
      )) as { scene: THREE.Group };
      const tpl = buildTemplate(id, gltf.scene);
      console.log(`\n=== ${id} (L=${tpl.dims.length.toFixed(2)} halfL=${(tpl.dims.length / 2).toFixed(2)}) ===`);
      console.log(`lampMats reported: ${tpl.lampMats.length}`);
      for (const lm of tpl.lampMats)
        console.log(`  [lit ${lm.front ? "HEAD" : "TAIL"}] ${lm.mat.name}: ${fmtMat(lm.mat)}`);

      // front-zone materials (mesh centre z > 45% of length — headlight belt)
      const seen = new Set<THREE.MeshStandardMaterial>();
      console.log("--- front-zone materials ---");
      tpl.wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const b = new THREE.Box3().setFromObject(mesh);
        const c = b.getCenter(new THREE.Vector3());
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (!sm || !sm.name || seen.has(sm)) continue;
          const lampish = LAMP_MAT.test(sm.name);
          if (c.z > 0.45 * tpl.dims.length || lampish) {
            seen.add(sm);
            const ext = b.getSize(new THREE.Vector3());
            console.log(
              `  ${sm.name.padEnd(30)} z=${c.z.toFixed(2)} ext=(${ext.x.toFixed(2)},${ext.y.toFixed(2)},${ext.z.toFixed(2)}) ${lampish ? "LAMP-NAME " : ""}${fmtMat(sm)}`,
            );
          }
        }
      });

      const reports = (globalThis as unknown as { __carGlassReports?: Record<string, unknown> })
        .__carGlassReports;
      if (reports?.[id])
        console.log(`glass report: ${JSON.stringify(reports[id], null, 1).slice(0, 1500)}`);
    } catch (e) {
      console.log(`=== ${id}: FAILED — ${e} ===`);
    }
  }
}

void main();

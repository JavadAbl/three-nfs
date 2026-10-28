// glass_probe.ts — run the REAL CarModelLoader pipeline in bun against the
// shipped GLBs and dump the final glass material states. No browser needed
// (buildTemplate is pure three.js). Usage: bun scripts/glass_probe.ts <carIds>
// bun lacks DOM progress events — DRACOLoader's wasm fetch path emits them
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
      const gltf = (await new Promise((res, rej) =>
        loader.parse(buf, "", res as never, rej),
      )) as { scene: THREE.Group };
      const tpl = buildTemplate(id, gltf.scene);
      console.log(`=== ${id} (dims L=${tpl.dims.length.toFixed(2)} W=${tpl.dims.width.toFixed(2)} H=${tpl.dims.topY.toFixed(2)}) ===`);
      const seen = new Set<string>();
      tpl.wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (!sm || !sm.name || seen.has(sm.name)) continue;
          if (!/glass|vit|vidrio|windshield|window|salo|sedy|kili|skyd|tissu|compteur|interior/i.test(sm.name)) continue;
          seen.add(sm.name);
          const b = new THREE.Box3().setFromObject(mesh);
          const c = b.getCenter(new THREE.Vector3());
          console.log(
            `  ${sm.name.padEnd(28)} transparent=${sm.transparent} opacity=${sm.opacity.toFixed(2)} ` +
            `color=#${sm.color.getHexString()} metal=${sm.metalness} rough=${sm.roughness} ` +
            `side=${sm.side === THREE.DoubleSide ? "Double" : "Front"}`,
          );
          console.log(`    mesh ${mesh.name}: centre (${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) castShadow=${mesh.castShadow}`);
        }
      });
    } catch (e) {
      console.log(`=== ${id}: FAILED — ${e} ===`);
    }
  }
}

void main();

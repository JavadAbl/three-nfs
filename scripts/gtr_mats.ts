// gtr_mats.ts — dump the GT-R's RAW source materials (pre-pipeline) to see
// which one carries the visible headlight glow and its emissive bake.
(globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
  class ProgressEvent { constructor(_t: string, init?: object) { Object.assign(this, init ?? {}); } };
import * as THREE from "three";
import * as fs from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

async function main() {
  const raw = fs.readFileSync("public/models/nissan-gtr-r35.glb");
  const buf = new ArrayBuffer(raw.byteLength);
  new Uint8Array(buf).set(raw);
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("file:///home/z/my-project/public/draco/");
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader({
    load: (_u: unknown, _on: unknown, onError: (e: Error) => void) => onError(new Error("stub")),
  } as never);
  const gltf = (await new Promise((res, rej) => loader.parse(buf, "", res as never, rej))) as {
    scene: THREE.Group;
  };
  gltf.scene.updateMatrixWorld(true);
  const seen = new Set<THREE.MeshStandardMaterial>();
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial;
      if (!sm || seen.has(sm)) continue;
      seen.add(sm);
      const b = new THREE.Box3().setFromObject(mesh);
      const c = b.getCenter(new THREE.Vector3());
      console.log(
        `"${sm.name}" c=(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) color=#${sm.color.getHexString()} ` +
        `emissive=#${sm.emissive.getHexString()}@${sm.emissiveIntensity} ` +
        `emisMap=${sm.emissiveMap ? "yes" : "-"} map=${sm.map ? "yes" : "-"} ` +
        `transparent=${sm.transparent} opacity=${sm.opacity.toFixed(2)} ` +
        `mesh="${mesh.name}" isArray=${Array.isArray(mesh.material)}`,
      );
    }
  });
}
void main();

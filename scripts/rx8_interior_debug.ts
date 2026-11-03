// rx8_interior_debug.ts — why did countInteriorMeshes miss the RX-8's
// inerior/ASIENTOS meshes? Dump every mesh that survives its filters with
// the cabin-box membership verdict.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as fs from "node:fs";
import { buildTemplate } from "../src/game/world/CarModelLoader.js";

const raw = fs.readFileSync("public/models/staging/mazda-rx-8-nfsmw.glb");
const buf = new ArrayBuffer(raw.byteLength);
new Uint8Array(buf).set(raw);
const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath("file:///home/z/my-project/public/draco/");
loader.setDRACOLoader(draco);
const stub = {
  load: (_u: unknown, _on: unknown, onError: (e: Error) => void) =>
    onError(new Error("ktx2-stubbed")),
};
(loader as unknown as { setKTX2Loader: (s: unknown) => void }).setKTX2Loader(stub);
const gltf = (await new Promise((res, rej) =>
  loader.parse(buf, "", res as never, rej),
)) as { scene: THREE.Group };

const tpl = buildTemplate("rx8", gltf.scene);
const dims = tpl.dims;
const halfW = dims.width / 2;
const halfL = Math.max(dims.length, 1) / 2;
console.log(`dims: L=${dims.length.toFixed(2)} W=${dims.width.toFixed(2)} halfL=${halfL.toFixed(2)} halfW=${halfW.toFixed(2)}`);

const INTERIOR_SEMANTIC = /in[te]rior|seat|dashb|cockpit|asiento|tablero/i;
const GLASS = /glass|vit(?:re|e)|vidrio|cristal|windshield|window/i;

// cabin box approximation (same shape as countInteriorMeshes):
// glass union would be needed exactly; approximate with cabin core
const cabin = new THREE.Box3(
  new THREE.Vector3(-halfW * 0.7, 0.35, -halfL * 0.55),
  new THREE.Vector3(halfW * 0.7, dims.topY - 0.05, halfL * 0.45),
);

tpl.wrapper.traverse((o) => {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const names = mats.map((m) => (m as THREE.Material)?.name ?? "").join(",");
  const semantic = INTERIOR_SEMANTIC.test(names);
  const isGlass = mats.every((m) => GLASS.test((m as THREE.Material)?.name ?? ""));
  if (!semantic && !isGlass && !/ASIENTOS|inerior/i.test(names)) return;
  const b = new THREE.Box3().setFromObject(mesh);
  const c = b.getCenter(new THREE.Vector3());
  const s = b.getSize(new THREE.Vector3());
  const inCabin = cabin.containsPoint(c);
  console.log(
    `${mesh.name.slice(0, 40).padEnd(40)} mats=${names.slice(0, 28).padEnd(28)} sem=${semantic ? "Y" : "n"} glass=${isGlass ? "Y" : "n"} size=(${s.x.toFixed(2)},${s.y.toFixed(2)},${s.z.toFixed(2)}) centre=(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) cabinCore=${inCabin ? "IN" : "out"}`,
  );
});

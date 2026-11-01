// ─── muscle_uv_check.ts — headless sanity for the procedural muscle car ──────
// Runs in bun (no DOM → the paint falls back to flat colour, but the UV
// assignment and all geometry still build). Checks:
//   • shell face census by UV region (top / right / left / under / chip)
//   • UV bounds + NaN scan
//   • whole-body bounding box vs the frozen dims Car.ts relies on
//   • mesh count + the v3 dress-up parts exist
import * as THREE from "three";
import { buildMuscleBody, MUSCLE_WHEEL_POS, MUSCLE_WHEEL_RADIUS } from "../src/game/world/ProceduralMuscle";

const shell = buildMuscleBody("#c8402e");
shell.root.updateMatrixWorld(true);

const meshes: THREE.Mesh[] = [];
shell.root.traverse((o) => {
  if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
});
console.log(`meshes: ${meshes.length}`);

// shell = the extrude (largest position count)
let shellMesh = meshes[0];
for (const m of meshes) {
  if (m.geometry.getAttribute("position").count > shellMesh.geometry.getAttribute("position").count) shellMesh = m;
}
const pos = shellMesh.geometry.getAttribute("position");
const uv = shellMesh.geometry.getAttribute("uv");
const nor = shellMesh.geometry.getAttribute("normal");
const census = { top: 0, right: 0, left: 0, under: 0, chip: 0 };
let bad = 0;
let uMin = Infinity;
let uMax = -Infinity;
let vMin = Infinity;
let vMax = -Infinity;
for (let i = 0; i < pos.count; i += 3) {
  let nx = 0;
  let ny = 0;
  for (let k = 0; k < 3; k++) {
    nx += nor.getX(i + k);
    ny += nor.getY(i + k);
  }
  const region = ny >= 0.5 ? "top" : nx >= 0.5 ? "right" : nx <= -0.5 ? "left" : ny <= -0.5 ? "under" : "chip";
  census[region]++;
}
for (let i = 0; i < uv.count; i++) {
  const u = uv.getX(i);
  const v = uv.getY(i);
  if (!Number.isFinite(u) || !Number.isFinite(v)) bad++;
  uMin = Math.min(uMin, u);
  uMax = Math.max(uMax, u);
  vMin = Math.min(vMin, v);
  vMax = Math.max(vMax, v);
}
console.log("shell face census:", census, `(total ${(pos.count / 3) | 0} faces)`);
console.log(`uv bounds: u[${uMin.toFixed(3)}, ${uMax.toFixed(3)}] v[${vMin.toFixed(3)}, ${vMax.toFixed(3)}] — NaN/inf: ${bad}`);

// bounding box of the whole body (wheels not included — separate builder)
const box = new THREE.Box3();
for (const m of meshes) {
  const b = new THREE.Box3().setFromBufferAttribute(m.geometry.getAttribute("position") as THREE.BufferAttribute);
  b.applyMatrix4(m.matrixWorld);
  box.union(b);
}
const size = box.getSize(new THREE.Vector3());
console.log(
  `body bbox: x[${box.min.x.toFixed(2)}, ${box.max.x.toFixed(2)}] y[${box.min.y.toFixed(2)}, ${box.max.y.toFixed(2)}] z[${box.min.z.toFixed(2)}, ${box.max.z.toFixed(2)}] (${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)})`,
);

// frozen physics interface
const expect = [
  [0.95, MUSCLE_WHEEL_RADIUS, 1.55, true],
  [-0.95, MUSCLE_WHEEL_RADIUS, 1.55, true],
  [0.95, MUSCLE_WHEEL_RADIUS, -1.6, false],
  [-0.95, MUSCLE_WHEEL_RADIUS, -1.6, false],
];
const frozen = JSON.stringify(MUSCLE_WHEEL_POS) === JSON.stringify(expect) && MUSCLE_WHEEL_RADIUS === 0.38;
console.log(`frozen wheel interface: ${frozen ? "OK" : "CHANGED — Car.ts physics mismatch!"}`);

// dress-up presence: name-less meshes are grouped by material via traverse;
// just count total vs the v2 baseline (shell+glass+trim was ~35)
const chromeish = meshes.filter((m) => {
  const mat = m.material as THREE.MeshStandardMaterial;
  return mat.metalness === 1 && mat.color.getHex() === 0xd8d8e0;
}).length;
console.log(`chrome parts (bumpers, badge, pins, antenna, cap…): ${chromeish}`);

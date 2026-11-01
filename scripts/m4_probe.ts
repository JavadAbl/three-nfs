// m4_probe.ts — dump the raw uploaded BMW M4 GLB: mesh/material layout in
// raw model space, so staging renames can be decided from real positions.
// Usage: bun scripts/m4_probe.ts [path-to-glb]
(globalThis as unknown as { ProgressEvent: unknown }).ProgressEvent =
  class ProgressEvent { constructor(_t: string, init?: object) { Object.assign(this, init ?? {}); } };
import * as THREE from "three";
import * as fs from "node:fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

async function main() {
  const path = process.argv[2] ?? "upload/bmw_m4_widebody__www.vecarz.com.glb";
  const raw = fs.readFileSync(path);
  const buf = new ArrayBuffer(raw.byteLength);
  new Uint8Array(buf).set(raw);
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath("file:///home/z/my-project/public/draco/");
  loader.setDRACOLoader(draco);
  const gltf = (await new Promise((res, rej) =>
    loader.parse(buf, "", res as never, rej),
  )) as {
    scene: THREE.Group;
    animations: unknown[];
  };

  console.log(`animations: ${gltf.animations?.length ?? 0}`);
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);

  // tree overview (2 levels)
  console.log("\n── tree ──");
  for (const child of scene.children) {
    const kids = child.children.length;
    console.log(`  ${child.name ?? "?"} (${child.type}, ${kids} children)`);
    for (const gc of child.children.slice(0, 4)) {
      console.log(`    ${gc.name ?? "?"} (${gc.type}, ${gc.children.length} children)`);
    }
    if (kids > 4) console.log(`    … +${kids - 4} more`);
  }

  interface Row {
    mesh: string;
    mats: string;
    c: THREE.Vector3;
    s: THREE.Vector3;
    verts: number;
  }
  const rows: Row[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const b = new THREE.Box3().setFromObject(m);
    if (b.isEmpty()) return;
    rows.push({
      mesh: m.name ?? "?",
      mats: (Array.isArray(m.material) ? m.material : [m.material])
        .map((x) => x?.name ?? "?")
        .join(","),
      c: b.getCenter(new THREE.Vector3()),
      s: b.getSize(new THREE.Vector3()),
      verts: (m.geometry.attributes.position as THREE.BufferAttribute)?.count ?? 0,
    });
  });

  const bbox = new THREE.Box3().setFromObject(scene);
  const sz = bbox.getSize(new THREE.Vector3());
  console.log(`\nscene bbox size: ${sz.x.toFixed(2)} x ${sz.y.toFixed(2)} x ${sz.z.toFixed(2)} (raw units)`);
  console.log(`meshes: ${rows.length}\n`);

  rows.sort((a, b) => b.c.z - a.c.z);
  console.log("── meshes sorted by centre z (raw space; +z end first) ──");
  for (const r of rows) {
    console.log(
      `z${r.c.z.toFixed(1).padStart(7)}  ${r.mesh.padEnd(14)} verts ${String(r.verts).padStart(6)}  ` +
        `c(${r.c.x.toFixed(1)},${r.c.y.toFixed(1)},${r.c.z.toFixed(1)}) s(${r.s.x.toFixed(1)},${r.s.y.toFixed(1)},${r.s.z.toFixed(1)})  [${r.mats}]`,
    );
  }
}

void main();

// paint_glass_audit.ts — answer ONE question per car: which materials end up
// PAINT-tintable (they follow the garage colour selection), and do any of
// them cover WINDOW-BELT geometry (cabin sides / greenhouse above the belt
// line) — i.e. glass that syncs with the selected colour. Mirrors
// glass_probe.ts (KTX2 stub + window stub so the dev probe fires).
// Usage: bun scripts/paint_glass_audit.ts gtr audi viper08 viper16 elegy r5
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
const NOT_LAMP_MAT = /glass|vidrio|windshield|window/i;
const GLASS_MAT = /glass|vit(?:re|e)|vidrio|windshield|window/i;

function classify(name: string): string {
  const tags: string[] = [];
  if (GLASS_MAT.test(name)) tags.push("GLASS-NAME");
  if (NOT_LAMP_MAT.test(name)) tags.push("NOT-LAMP");
  if (LAMP_MAT.test(name)) tags.push("LAMP-NAME");
  return tags.join("+") || "plain";
}

async function main() {
  for (const id of process.argv.slice(2)) {
    try {
      const def = carDef(id);
      if (!def?.modelUrl) { console.log(`=== ${id}: procedural ===`); continue; }
      const raw = fs.readFileSync(`public${def.modelUrl}`);
      const buf = new ArrayBuffer(raw.byteLength);
      new Uint8Array(buf).set(raw);
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath("file:///home/z/my-project/public/draco/");
      loader.setDRACOLoader(draco);
      const stub = { load: (_u: unknown, _o: unknown, onError: (e: Error) => void) => onError(new Error("ktx2-stubbed")) };
      (loader as unknown as { setKTX2Loader: (s: unknown) => void }).setKTX2Loader(stub);
      const gltf = (await new Promise((res, rej) =>
        loader.parse(buf, "", res as never, rej))) as { scene: THREE.Group };
      const tpl = buildTemplate(id, gltf.scene);
      const { paintNames } = tpl;
      const D = tpl.dims;

      // aggregate per material: mesh count, union bbox
      type Agg = { name: string; mats: THREE.MeshStandardMaterial[]; box: THREE.Box3; n: number };
      const agg = new Map<string, Agg>();
      tpl.wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const sm = m as THREE.MeshStandardMaterial;
          if (!sm || !sm.name) continue;
          let a = agg.get(sm.name);
          if (!a) { a = { name: sm.name, mats: [], box: new THREE.Box3(), n: 0 }; agg.set(sm.name, a); }
          if (!a.mats.includes(sm)) a.mats.push(sm);
          a.box.union(new THREE.Box3().setFromObject(mesh));
          a.n++;
        }
      });

      console.log(`\n=== ${id} (${def.name}) L=${D.length.toFixed(2)} W=${D.width.toFixed(2)} topY=${D.topY.toFixed(2)} ===`);
      const rows = [...agg.values()].sort((a, b) => (paintNames.has(b.name) ? 1 : 0) - (paintNames.has(a.name) ? 1 : 0));
      for (const a of rows) {
        const c = a.box.getCenter(new THREE.Vector3());
        const s = a.box.getSize(new THREE.Vector3());
        const sm = a.mats[0];
        const paint = paintNames.has(a.name);
        // window-belt test: above the belt line (55% of height), central 70%
        // of length, and NOT a tiny trim piece
        const belt = c.y > 0.55 * D.topY && Math.abs(c.z) < 0.35 * D.length && s.y < 0.6 * D.topY;
        const flag = paint && belt ? "  <-- PAINT IN WINDOW BELT!" : "";
        console.log(
          `${paint ? "[PAINT]" : "      "} ${a.name.padEnd(30)} ${classify(a.name).padEnd(18)} ` +
          `cnt=${String(a.n).padStart(2)} c=(${c.x.toFixed(1)},${c.y.toFixed(2)},${c.z.toFixed(1)}) ` +
          `sz=(${s.x.toFixed(1)},${s.y.toFixed(2)},${s.z.toFixed(1)}) ` +
          `color=#${sm.color.getHexString()} op=${sm.opacity.toFixed(2)}${sm.transparent ? "T" : " "}${flag}`,
        );
      }
      const rep = (globalThis as unknown as { __carGlassReports?: Record<string, unknown> }).__carGlassReports?.[id];
      if (rep) console.log("glassReport:", JSON.stringify(rep));
    } catch (e) {
      console.log(`=== ${id}: FAILED — ${e} ===`);
    }
  }
}
void main();

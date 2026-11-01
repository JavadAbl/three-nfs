// m4_stage.ts — stage the uploaded BMW M4 widebody GLB for the game.
// The CarModelLoader pipeline is name-driven: materials must carry semantic
// tokens to be picked up (carpaint → tint, lights → lamps, wheel/tyre/brake
// → corner rig). The Sketchfab export uses artist names that match none of
// them, so this script renames materials + fixes alpha modes and writes the
// result to public/models/staging/ (gitignored until user acceptance).
//
// Decisions (from scripts/m4_probe.ts dump, raw model space):
//   front = +z (grilles +11.6, ManufacturerPlate −10.9, red_glass tail −9.9)
//   wheels: merged L+R pairs at hubs y=1.6, front axle z=7.4 / rear z=−6.4
//   Object_85 "LightA" spans BOTH ends (head+tail merged, 15k verts) — the
//   loader splits spanning lamp meshes at the z midline, front half lit
//   warm-white, rear half stop-red.
//   BLEND-on-solid-geometry mats (interior/engine/badges) go OPAQUE — the
//   glass pass claims transparent materials and would glassify the interior.
// Run: bun scripts/m4_stage.ts
import { NodeIO } from "@gltf-transform/core";
import {
  KHRMaterialsClearcoat,
  KHRMaterialsSpecular,
  KHRMaterialsEmissiveStrength,
} from "@gltf-transform/extensions";
import * as fs from "node:fs";

const SRC = "upload/bmw_m4_widebody__www.vecarz.com.glb";
const DST = "public/models/staging/bmw-m4-competition-g82.glb";

const io = new NodeIO().registerExtensions([
  KHRMaterialsClearcoat,
  KHRMaterialsSpecular,
  KHRMaterialsEmissiveStrength,
]);

const doc = await io.read(SRC);

// material renames: artist name → semantic name the loader understands.
// RENAME values must contain the family token; the m4_ prefix keeps them
// unique and debuggable in the reports.
const RENAME: Record<string, string> = {
  // body paint → tintable (loader: /carpaint/i)
  bBMW_M4CompetitionG82TNR0_2021PaintTNR_Material_004: "m4_carpaint",
  // head+tail lamps merged in one spanning mesh → split+lit by z midline
  bBMW_M4CompetitionG82TNR0_2021LightA_Material1: "m4_lights",
  // front DRL glow strip (z +10, emit bake) → head lamp family
  emit: "m4_headlight_strip",
  // rear centre reflector (z −11.3, red) → tail lamp family
  wmit_red: "m4_taillight_reflector",
  // wheel hardware (merged L+R pairs): tyre, tread ring, 51k-vert rim,
  // discs, caliper strip — all must ride the corner pivots
  main: "m4_wheel_tyre",
  "Material.001": "m4_wheel_ring",
  "Material.002": "m4_wheel_rim",
  "disk.001": "m4_brake_disc",
  metalblack: "m4_brake_caliper",
};
// solid geometry shipped as BLEND — would be claimed by the glass pass and
// turned translucent; the interior must stay a visible opaque witness
const OPAQUE = new Set([
  "bBMW_M4CompetitionG82TNR0_2021InteriorA_Material1",
  "bBMW_M4CompetitionG82TNR0_2021EngineA_Material1",
  "bBMW_M4CompetitionG82TNR0_2021BadgeA_Material1",
]);

console.log("── material report (pre-rename) ──");
for (const mat of doc.getRoot().listMaterials()) {
  const bc = mat.getBaseColorFactor();
  const tex = mat.getBaseColorTexture()?.getImage() ? "tex" : "-";
  console.log(
    `${mat.getName().padEnd(58)} alpha=${mat.getAlphaMode().padEnd(5)} ` +
      `base=(${bc.slice(0, 3).map((v) => v.toFixed(2)).join(",")}) map=${tex} ` +
      `emiss=${mat.getEmissiveFactor().map((v) => v.toFixed(2)).join(",")}`,
  );
}

for (const mat of doc.getRoot().listMaterials()) {
  const name = mat.getName() ?? "";
  if (RENAME[name]) mat.setName(RENAME[name]);
  if (OPAQUE.has(name)) {
    mat.setAlphaMode("OPAQUE");
    mat.setBaseColorFactor([
      ...mat.getBaseColorFactor().slice(0, 3),
      1,
    ] as unknown as [number, number, number, number]);
  }
}

fs.mkdirSync("public/models/staging", { recursive: true });
await io.write(DST, doc);
const mb = fs.statSync(DST).size / 1e6;
console.log(`\nstaged → ${DST} (${mb.toFixed(1)} MB)`);

// Dump every GLB car model's materials + lamp classification to predict the
// runtime night-lamp state (which cars' lamp meshes glow, which stay dark).
// GLB = [12B header][chunk len][chunk type][JSON chunk]… — material names and
// emissiveFactors live in the JSON chunk, no geometry decoding needed.
import { readFileSync } from "fs";

const MODELS = [
  "/home/z/my-project/public/models/nissan-gtr-r35.glb",
  "/home/z/my-project/public/models/audi-tt-rs-2010.glb",
  "/home/z/my-project/public/models/viper-srt10-2008.glb",
  "/home/z/my-project/public/models/viper-acr-2016.glb",
];

// mirror of CarModelLoader's LAMP_MAT / NOT_LAMP_MAT / night-boost regexes
const LAMP_MAT =
  /(?<![A-Za-z])(head.?lights?|tail.?lights?|tail.?lamps?|brake.?lights?|lights?|lamps?|luz(?:es)?|lamp(?:es|en)?|faroles?|leuchten?|phares?|feux|glows?|emiss\w*)(?![A-Za-z])/i;
const NOT_LAMP_MAT = /glass|vidrio|windshield|window/i;
const BOOST_MAT = /light|tail|lamp|emiss|glow/i;

function jsonChunk(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + len).toString("utf8"));
}

for (const file of MODELS) {
  const g = jsonChunk(file);
  const mats = g.materials ?? [];
  const name = file.split("/").pop();
  console.log(`\n=== ${name} — ${mats.length} materials ===`);
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i];
    const ef = m.emissiveFactor ?? [0, 0, 0];
    const es = m.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
    const sum = ef[0] + ef[1] + ef[2];
    const isLamp = LAMP_MAT.test(m.name ?? "") && !NOT_LAMP_MAT.test(m.name ?? "");
    const boosted = BOOST_MAT.test(m.name ?? "") && sum >= 0.05 && sum < 1.5;
    const flag = isLamp ? " LAMP" : boosted ? " boost" : "";
    const lit = isLamp && sum * es < 0.05 ? " → splitDarkLamps VICTIM" : "";
    console.log(
      ` [${i}] ${JSON.stringify(m.name)} emissive=[${ef.map((v) => v.toFixed(3))}] strength=${es} sum=${(sum * es).toFixed(3)}${flag}${lit}`
    );
  }
  // meshes → which materials they use (multi-material meshes have >1 primitive
  // or geometry.groups — splitDarkLamps skips those)
  const meshUse = [];
  const nodes = g.nodes ?? [];
  const walk = (idx) => {
    const n = nodes[idx];
    if (!n) return;
    if (n.mesh !== undefined) {
      const mesh = (g.meshes ?? [])[n.mesh];
      if (mesh) {
        const used = (mesh.primitives ?? []).map((p) => mats[p.material]?.name ?? "?");
        meshUse.push({ node: n.name, mesh: mesh.name, used });
      }
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (let i = 0; i < (g.scenes?.[0]?.nodes ?? []).length; i++) walk(g.scenes[0].nodes[i]);
  console.log(" --- meshes using lamp-family materials ---");
  for (const u of meshUse) {
    if (u.used.some((n) => LAMP_MAT.test(n ?? "") && !NOT_LAMP_MAT.test(n ?? "")))
      console.log(`   node=${JSON.stringify(u.node)} mesh=${JSON.stringify(u.mesh)} mats=${u.used.map((s) => JSON.stringify(s)).join(", ")}`);
  }
}

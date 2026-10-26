// Dump lamp-family materials' emissive props (emissive color, intensity, emissiveMap)
// from all car GLBs — if a lens material carries a black/dark emissiveMap, the
// runtime `lit.emissive.copy(HEAD/TAIL)` stays multiplied to black → lamps dark.
import { readFileSync } from "node:fs";

const LAMP_MAT =
  /(?<![A-Za-z])(head.?lights?|tail.?lights?|tail.?lamps?|brake.?lights?|lights?|lamps?|luz(?:es)?|lamp(?:es|en)?|faroles?|leuchten?|phares?|feux|glows?|emiss\w*)(?![A-Za-z])/i;
const NOT_LAMP_MAT = /glass|vidrio|windshield|window/i;

function glbMaterials(path: string) {
  const buf = readFileSync(path);
  let off = 12;
  while (off < buf.length) {
    const clen = buf.readUInt32LE(off);
    const ctype = buf.readUInt32LE(off + 4);
    if (ctype === 0x4e4f534a) {
      const js = JSON.parse(buf.subarray(off + 8, off + 8 + clen).toString("utf8"));
      const images = (js.images ?? []).map((i: any) => i.name ?? i.uri ?? "?");
      return { materials: js.materials ?? [], images };
    }
    off += 8 + clen + (clen & 3);
  }
  return { materials: [], images: [] };
}

for (const f of [
  "public/models/nissan-gtr-r35.glb",
  "public/models/audi-tt-rs-2010.glb",
  "public/models/viper-srt10-2008.glb",
  "public/models/viper-acr-2016.glb",
]) {
  const { materials, images } = glbMaterials(f);
  console.log(`\n=== ${f.split("/").pop()} — ${materials.length} materials ===`);
  for (const m of materials as any[]) {
    const name = m.name ?? "";
    if (!LAMP_MAT.test(name) || NOT_LAMP_MAT.test(name)) continue;
    const ext = m.extensions?.KHR_materials_emissive_strength;
    console.log(
      `  [LAMP] ${name}: emissive=${JSON.stringify(m.emissive?.factor ?? null)} ` +
      `emissiveMap=${m.emissiveTexture ? `tex#${m.emissiveTexture.index} (img: ${images[m.emissiveTexture.index] ?? "?"})` : "none"} ` +
      `strength=${ext?.emissiveStrength ?? 1}`
    );
  }
}

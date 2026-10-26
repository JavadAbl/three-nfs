// Extract the lamp materials' emissiveMap textures from the Viper GLBs
// and save them as viewable PNGs — ground truth for why headlamps stay dark.
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function glbChunks(path: string) {
  const buf = readFileSync(path);
  let off = 12;
  let json: any = null;
  let bin: Buffer | null = null;
  while (off < buf.length) {
    const clen = buf.readUInt32LE(off);
    const ctype = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + clen);
    if (ctype === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (ctype === 0x004e4942) bin = Buffer.from(data);
    off += 8 + clen + (clen & 3);
  }
  return { json, bin };
}

function decodeImage(json: any, bin: Buffer, texIndex: number, outPath: string): string {
  const tex = json.textures?.[texIndex];
  if (!tex) return `texture ${texIndex} missing`;
  const img = json.images[tex.source];
  const view = json.bufferViews[img.bufferView];
  let data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + (view.byteLength ?? bin.length));
  if (img.mimeType === "image/png" || (data[0] === 0x89 && data[1] === 0x50)) {
    writeFileSync(outPath, data);
    return `saved PNG (direct) ${outPath}`;
  }
  if (img.mimeType === "image/ktx2" || (data[0] === 0xab && data[1] === 0x4b)) {
    return `KTX2 (GPU-compressed) ${outPath}.ktx2`;
  }
  writeFileSync(outPath, data);
  return `saved raw ${img.mimeType ?? "unknown"} → ${outPath}`;
}

for (const [file, texIndex, name] of [
  ["public/models/viper-srt10-2008.glb", 10, "viper08_lights315_emissivemap"],
  ["public/models/viper-acr-2016.glb", 4, "viper16_emiss_emissivemap"],
] as const) {
  const { json, bin } = glbChunks(file);
  const result = decodeImage(json, bin!, texIndex, `public/${name}.png`);
  console.log(`${file} tex#${texIndex}: ${result}`);
  // also report which material(s) use this texture + which texture slots
  for (const m of json.materials ?? []) {
    if (m.emissiveTexture?.index === texIndex || m.pbrMetallicRoughness?.baseColorTexture?.index === texIndex) {
      console.log(`  used by material "${m.name}": emissive=${m.emissiveTexture ? "yes" : "no"} baseColor=${m.pbrMetallicRoughness?.baseColorTexture ? "yes" : "no"}`);
    }
  }
}

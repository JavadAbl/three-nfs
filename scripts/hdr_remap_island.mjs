// ─── Bake the ISLAND world-aligned sky (v2) ─────────────────────────────────
// Generalised sibling of hdr_remap.mjs (the sunflowers v7 bake) for Poly
// Haven's CC0 "Drakensberg Solitary Mountain (Pure Sky)" 2k — the v1 bake
// used "Illovo Beach Balcony", whose baked-in balcony building (roof, walls,
// railing across 252° of the panorama) read as a giant floating structure
// over the circuit. The puresky variant masks the ground to pure sky and has
// a structure-free horizon on every azimuth (verified: contamination
// detector + VLM find only sun glow, no hard silhouettes).
//
// Same geometry fix, same guarantees — the photo sun is baked ONTO the game
// SUN_DIR (el 15.02°, u 0.5918 — the light rig is untouched, so shadows match
// the visible sun), the photo horizon lands at world el 0 on every azimuth,
// and below the horizon the rows mirror the sky then melt into the ISLAND fog
// colour (sea haze 0xcfe4ee — the palette's fog, not spa's 0xb9d2e2).
//
// Differences from the sunflowers bake:
//  - sun probe band widened 20-70° → 8-85° (an afternoon sun can sit low)
//  - the "proven constant" azimuth cross-check is dropped (that was the old
//    sunflowers HDR_SUN_DIR constant; here the MEASURED disc is the truth)
//  - CUT 2° (a lower cut keeps the sea horizon crisp)
//
// Usage: node scripts/hdr_remap_island.mjs [source.hdr]
//   source defaults to scripts/sky_src_island.hdr (the pristine download).
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

const IN_PATH = process.argv[2] ?? "../scripts/sky_src_island.hdr";
const OUT_PATH = "../public/models/sky/island_cove_sky_2k.hdr";
const STRIP_DIR = "../download/";
const D2R = Math.PI / 180;

// ── RGBE decode/encode (three's convention — identical to hdr_remap.mjs) ────
function decodeHDR(buf) {
  let off = 0;
  while (true) {
    const e = buf.indexOf(10, off);
    const line = buf.toString("ascii", off, e);
    off = e + 1;
    if (line === "") break;
  }
  let res;
  while (true) {
    const e = buf.indexOf(10, off);
    res = buf.toString("ascii", off, e);
    off = e + 1;
    if (res !== "") break;
  }
  const m = res.match(/-Y (\d+) \+X (\d+)/);
  if (!m) throw new Error("bad resolution: " + res);
  const H = +m[1], W = +m[2];
  const f = new Float32Array(W * H * 3);
  const rowStart = new Array(H + 1);
  for (let y = 0; y < H; y++) {
    rowStart[y] = off;
    if (buf[off] !== 2 || buf[off + 1] !== 2)
      throw new Error(`uncompressed scanline at y=${y}`);
    const w = buf.readUInt16BE(off + 2);
    if (w !== W) throw new Error(`width mismatch at y=${y}`);
    off += 4;
    const chans = [0, 1, 2, 3].map(() => new Uint8Array(W));
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        let count = buf[off++];
        if (count > 128) {
          count -= 128;
          chans[c].fill(buf[off++], x, x + count);
        } else {
          chans[c].set(buf.subarray(off, off + count), x);
          off += count;
        }
        x += count;
      }
    }
    for (let x = 0; x < W; x++) {
      const e = chans[3][x];
      const sc = e ? Math.pow(2, e - 128) / 255 : 0;
      const i = (y * W + x) * 3;
      f[i] = chans[0][x] * sc;
      f[i + 1] = chans[1][x] * sc;
      f[i + 2] = chans[2][x] * sc;
    }
  }
  rowStart[H] = off;
  return { W, H, f, rowStart };
}
function encodeRow(bytes, W) {
  const out = [];
  const push = (b) => out.push(b & 0xff);
  push(2); push(2); push(W >> 8); push(W & 0xff);
  for (let c = 0; c < 4; c++) {
    let x = 0;
    while (x < W) {
      const v = bytes[x * 4 + c];
      let run = 1;
      while (run < 127 && x + run < W && bytes[(x + run) * 4 + c] === v) run++;
      if (run >= 3) {
        push(128 + run); push(v); x += run;
      } else {
        let lit = 0;
        const litStart = x;
        while (
          lit < 128 &&
          x + lit < W &&
          (() => {
            const b = bytes[(x + lit) * 4 + c];
            if (x + lit + 2 < W && b === bytes[(x + lit + 1) * 4 + c] && b === bytes[(x + lit + 2) * 4 + c]) return false;
            return true;
          })()
        ) lit++;
        push(lit);
        for (let k = 0; k < lit; k++) push(bytes[(x + k) * 4 + c]);
        x += lit;
        if (lit === 0) { push(128 + 1); push(v); x++; }
      }
    }
  }
  return Buffer.from(out);
}
function encodeRGBEPixel(r, g, b) {
  const v = Math.max(r, g, b);
  if (!(v > 1e-32)) return [0, 0, 0, 0];
  let e = Math.ceil(Math.log2(v)) + 128;
  if (e < 1) e = 1;
  let sc = Math.pow(2, e - 128);
  let R = Math.round((r / sc) * 255), G = Math.round((g / sc) * 255), B = Math.round((b / sc) * 255);
  if (R > 255 || G > 255 || B > 255) {
    e += 1; sc = Math.pow(2, e - 128);
    R = Math.round((r / sc) * 255); G = Math.round((g / sc) * 255); B = Math.round((b / sc) * 255);
  }
  return [Math.min(255, R), Math.min(255, G), Math.min(255, B), e];
}

// ── game alignment targets (mirror DaySky.ts — proven rig, untouched) ───────
const SUN = [500, 160, 325];
const sl = Math.hypot(...SUN);
const SUNn = SUN.map((v) => v / sl);
const elSunWorld = Math.asin(SUNn[1]); // ~15.02°
const uSunWorld = Math.atan2(SUNn[2], SUNn[0]) / (2 * Math.PI) + 0.5;

// island palette fog (registry island fog 0xcfe4ee) — sRGB → linear
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const FOG = [srgbToLinear(0xcf / 255), srgbToLinear(0xe4 / 255), srgbToLinear(0xee / 255)];
const fogLum = 0.2126 * FOG[0] + 0.7152 * FOG[1] + 0.0722 * FOG[2];

const FADE_DEG = 1.2;
const CUT_DEG = 2;
const K = (90 - CUT_DEG) / 90;

const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function sample(f, W, H, u, el) {
  let x = (u - Math.floor(u)) * W - 0.5;
  if (x < 0) x += W;
  const x0 = Math.floor(x), fx = x - x0;
  const x1 = (x0 + 1) % W;
  let y = (0.5 - el / Math.PI) * H - 0.5;
  y = Math.max(0, Math.min(H - 1, y));
  const y0 = Math.floor(y), fy = y - y0;
  const y1 = Math.min(H - 1, y0 + 1);
  const i00 = (y0 * W + x0) * 3, i01 = (y0 * W + x1) * 3;
  const i10 = (y1 * W + x0) * 3, i11 = (y1 * W + x1) * 3;
  const out = [];
  for (let c = 0; c < 3; c++) {
    const a = f[i00 + c] * (1 - fx) + f[i01 + c] * fx;
    const b = f[i10 + c] * (1 - fx) + f[i11 + c] * fx;
    out.push(a * (1 - fy) + b * fy);
  }
  return out;
}
function measureSun(f, W, H, elMin, elMax) {
  const yTop = Math.round((0.5 - elMax / 180) * H);
  const yBot = Math.round((0.5 - elMin / 180) * H);
  let maxLum = 0;
  for (let y = yTop; y <= yBot; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const lum = 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
      if (lum > maxLum) maxLum = lum;
    }
  const thr = Math.max(maxLum * 0.6, 1000);
  let ws = 0, us = 0, els = 0, n = 0, yMin = H, yMax = 0;
  for (let y = yTop; y <= yBot; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const lum = 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
      if (lum > thr) {
        const w = lum - thr;
        ws += w; n++;
        us += w * ((x + 0.5) / W);
        els += w * (0.5 - (y + 0.5) / H) * Math.PI;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  return { u: ws ? us / ws : 0, el: ws ? els / ws : 0, n, maxLum, rows: yMax - yMin + 1 };
}

// ── main ────────────────────────────────────────────────────────────────────
const buf = readFileSync(new URL(IN_PATH, import.meta.url));
const { W, H, f: SRC, rowStart } = decodeHDR(buf);
console.log(`decoded ${W}x${H} (${buf.length} bytes)`);
console.log(`target: sun world el=${(elSunWorld / D2R).toFixed(2)}° u=${uSunWorld.toFixed(4)} | fog #cfe4ee`);

const pre = measureSun(SRC, W, H, 8, 85);
console.log(`measured photo sun: el=${(pre.el / D2R).toFixed(2)}° u=${pre.u.toFixed(4)} n=${pre.n} rows=${pre.rows} maxLum=${pre.maxLum.toFixed(0)}`);
if (pre.n < 3 || pre.n > 600) throw new Error("sun disc not isolated cleanly — abort");
if (pre.maxLum < 5e3) throw new Error("no saturated sun disc (overcast?) — abort");
if (pre.el / D2R <= CUT_DEG + 0.5) throw new Error("photo sun too low to remap — abort");

const du = uSunWorld - pre.u;
const s = Math.tan(((pre.el / D2R - CUT_DEG) / K) * D2R) / Math.tan(elSunWorld);
const elSrc = (eDeg) => CUT_DEG + K * (Math.atan(s * Math.tan(eDeg * D2R)) / D2R);
console.log(`bake: Δu=${(du * 360).toFixed(2)}°, s=${s.toFixed(3)}, CUT=${CUT_DEG}° → f(0°)=${elSrc(0).toFixed(2)}°, f(15°)=${elSrc(15).toFixed(2)}°, f(45°)=${elSrc(45).toFixed(2)}°`);

console.log("baking…");
const OUT = new Float32Array(W * H * 3);
for (let y = 0; y < H; y++) {
  const el = (0.5 - (y + 0.5) / H) * Math.PI;
  const d = -el / D2R;
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W;
    const su = u - du;
    let c;
    if (el >= 0) {
      c = sample(SRC, W, H, su, elSrc(el / D2R) * D2R);
    } else if (d <= FADE_DEG) {
      const sky = sample(SRC, W, H, su, elSrc(d) * D2R);
      const k = smoothstep(d / FADE_DEG);
      c = [sky[0] + (FOG[0] - sky[0]) * k, sky[1] + (FOG[1] - sky[1]) * k, sky[2] + (FOG[2] - sky[2]) * k];
    } else {
      c = FOG;
    }
    const i = (y * W + x) * 3;
    OUT[i] = c[0]; OUT[i + 1] = c[1]; OUT[i + 2] = c[2];
  }
}

const parts = [buf.subarray(0, rowStart[0])];
const rowBytes = new Uint8Array(W * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const [R, G, B, E] = encodeRGBEPixel(OUT[i], OUT[i + 1], OUT[i + 2]);
    rowBytes[x * 4] = R; rowBytes[x * 4 + 1] = G; rowBytes[x * 4 + 2] = B; rowBytes[x * 4 + 3] = E;
  }
  parts.push(encodeRow(rowBytes, W));
}
const outBuf = Buffer.concat(parts);
writeFileSync(new URL(OUT_PATH, import.meta.url).pathname, outBuf);
console.log(`written ${OUT_PATH} (${outBuf.length} bytes, was ${buf.length})`);

// ── self-checks on the baked file ───────────────────────────────────────────
const again = decodeHDR(readFileSync(new URL(OUT_PATH, import.meta.url)));
const post = measureSun(again.f, W, H, 5, 70);
console.log(`baked sun: el=${(post.el / D2R).toFixed(2)}° u=${post.u.toFixed(4)} n=${post.n}`);
let fail = 0;
if (Math.abs(post.u - uSunWorld) > 0.003) { console.log("FAIL: baked sun azimuth off target"); fail++; }
if (Math.abs(post.el - elSunWorld) > 0.8 * D2R) { console.log("FAIL: baked sun elevation off target"); fail++; }
let fogMax = 0;
for (let a = 0; a < 24; a++) {
  const c = sample(again.f, W, H, a / 24, -3 * D2R);
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  if (Math.abs(lum - fogLum) > fogMax) fogMax = Math.abs(lum - fogLum);
}
console.log(`fog rows @el -3°: max dev=${fogMax.toFixed(3)} (target lum ${fogLum.toFixed(3)})`);
if (fogMax > 0.02) { console.log("FAIL: below-horizon rows off fog colour"); fail++; }
let minRow = 1;
for (let y = 506; y <= 514; y++) {
  let r = 0, g = 0, b = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    r += again.f[i] / W; g += again.f[i + 1] / W; b += again.f[i + 2] / W;
  }
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (l < minRow) minRow = l;
}
console.log(`horizon rows: min mean lum=${minRow.toFixed(3)} (must be > 0.35)`);
if (minRow < 0.35) { console.log("FAIL: dark line at the world horizon"); fail++; }
if (fail) { console.log(`${fail} SELF-CHECK(S) FAILED — not shipping`); process.exit(1); }
console.log("self-checks passed");

// ── after strip for eyeballing (Narkowicz ACES + sRGB) ──────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function writePNG(path, PW, PH, rgb) {
  const chunks = [];
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PW, 0); ihdr.writeUInt32BE(PH, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc(PH * (1 + PW * 3));
  for (let y = 0; y < PH; y++) {
    raw[y * (1 + PW * 3)] = 0;
    rgb.copy(raw, y * (1 + PW * 3) + 1, y * PW * 3, (y + 1) * PW * 3);
  }
  const mk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const png = Buffer.concat([sig, mk("IHDR", ihdr), mk("IDAT", zlib.deflateSync(raw, { level: 9 })), mk("IEND", Buffer.alloc(0))]);
  writeFileSync(path, png);
}
const aces = (x) => { const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return Math.min(1, Math.max(0, (x * (a * x + b)) / (x * (c * x + d) + e))); };
const linToSrgb = (c) => Math.min(255, Math.round(Math.pow(Math.min(1, c), 1 / 2.2) * 255));
const PW = 1024, PH = 256, elTop = 55, elBot = -6;
const rgb = Buffer.alloc(PW * PH * 3);
for (let py = 0; py < PH; py++) {
  const wEl = (elTop - (py / (PH - 1)) * (elTop - elBot)) * D2R;
  for (let px = 0; px < PW; px++) {
    const u = px / PW;
    const c = sample(again.f, W, H, u, wEl);
    const o = (py * PW + px) * 3;
    rgb[o] = linToSrgb(aces(c[0] * 1.05));
    rgb[o + 1] = linToSrgb(aces(c[1] * 1.05));
    rgb[o + 2] = linToSrgb(aces(c[2] * 1.05));
  }
}
writePNG(new URL(STRIP_DIR + "sky_island_after.png", import.meta.url).pathname, PW, PH, rgb);
console.log("wrote sky_island_after.png strip");

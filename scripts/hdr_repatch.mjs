// Re-paint the below-horizon half of the shipped HDR panorama.
//
// WHY: DaySky tilts the panorama ~33.7° so the photo sun lands at SUN_DIR
// (el 15°). The tilt lifts the photo horizon up to +33.7° ABOVE the world
// horizon on the anti-sun arc (world az 135°..300°) — so the below-horizon
// paint becomes visible as a band where sky should be. The old paint was a
// per-column gradient that read as a flat olive-gray "sea": clouds cut off
// along a tilted line ~30° up, and its color (lum ~0.40) collided with the
// pale-blue fogged terrain silhouette (fog 0xb9d2e2, lum ~0.62). User verdict:
// "at one side the sky and terrain have conflict".
//
// NEW PAINT (world-space wedge gradient, mapped into photo coords):
//   * at the PHOTO horizon (top of the band): the real sky colour of that
//     column (smoothed avg of photo el [0.5°,10°]) — plus a 3° mirror
//     crossfade so clouds visually continue past the line, dissolving;
//   * at the WORLD horizon (bottom of the band, where the terrain silhouette
//     sits): the fog colour in LINEAR space (0xb9d2e2 -> the exact value the
//     game's FogExp2 tints distant terrain with) — so terrain melts into sky;
//   * smoothstep in between; below the world horizon: flat fog haze (the void
//     beyond the finite GLB terrain reads as distance haze, not raw sky).
//
// Format: rows 0..511 (sky) are copied BYTE-IDENTICAL; only rows 512..1023
// re-encode. Scanline headers are 4 bytes (magic 0x0202 + width BE16) —
// matching three's HDRLoader, which never reads a height field. Decode/encode
// convention: value = byte * 2^(e-128) / 255.
//
// Usage: node scripts/hdr_repatch.mjs patch   (writes .hdr + before/after PNGs)
//        node scripts/hdr_repatch.mjs verify  (decode + seam metrics only)
import { readFileSync, writeFileSync } from "node:fs";
import zlib from "node:zlib";

const HDR_PATH = new URL(
  "../public/models/sky/sunflowers_puresky_2k.hdr",
  import.meta.url,
);
const OUT_DIR = new URL("../download/", import.meta.url);

// fog colour of the SPA day palette (registry.ts) — sRGB hex -> linear
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const FOG = [
  srgbToLinear(0xb9 / 255),
  srgbToLinear(0xd2 / 255),
  srgbToLinear(0xe2 / 255),
];

// ── rotation (must mirror DaySky.skyEuler) ──────────────────────────────────
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
}
function rotVec(axis, ang, v) {
  const c = Math.cos(ang),
    s = Math.sin(ang);
  const kxv = cross(axis, v);
  const kdv = dot(axis, v);
  return [
    v[0] * c + kxv[0] * s + axis[0] * kdv * (1 - c),
    v[1] * c + kxv[1] * s + axis[1] * kdv * (1 - c),
    v[2] * c + kxv[2] * s + axis[2] * kdv * (1 - c),
  ];
}
const HDR_SUN = norm([0.5335, 0.7506, 0.3898]);
const SUN = norm([500, 160, 325]);
const AXIS = norm(cross(HDR_SUN, SUN));
const ANGLE = Math.acos(Math.max(-1, Math.min(1, dot(HDR_SUN, SUN))));
const photoToWorld = (p) => rotVec(AXIS, ANGLE, p);
const worldToPhoto = (d) => rotVec(AXIS, -ANGLE, d);
// photo zenith in world coords — normal of the photo-horizon great circle
const PHOTO_ZENITH = photoToWorld([0, 1, 0]);
/** world elevation (radians) of the photo horizon at world azimuth az */
function photoHorizonEl(az) {
  // dir(az,e) ⊥ PHOTO_ZENITH  =>  tan e = -(nx cos az + nz sin az)/ny
  return Math.atan2(
    -(PHOTO_ZENITH[0] * Math.cos(az) + PHOTO_ZENITH[2] * Math.sin(az)),
    PHOTO_ZENITH[1],
  );
}

// ── RGBE file decode (records per-row byte ranges for verbatim copy) ────────
function decodeHDR(buf) {
  let off = 0;
  let headerText = "";
  while (true) {
    const e = buf.indexOf(10, off);
    const line = buf.toString("ascii", off, e);
    off = e + 1;
    if (line === "") break;
    headerText += line + "\n";
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
  const H = +m[1],
    W = +m[2];
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
      const s = e ? Math.pow(2, e - 128) / 255 : 0;
      const i = (y * W + x) * 3;
      f[i] = chans[0][x] * s;
      f[i + 1] = chans[1][x] * s;
      f[i + 2] = chans[2][x] * s;
    }
  }
  rowStart[H] = off;
  return { W, H, f, rowStart, headerText, headerEnd: rowStart[0] };
}

// ── RGBE encode (per-row RLE, 4-byte scanline headers) ─────────────────────
function encodeRow(bytes /* Uint8Array W*4 R,G,B,E interleaved */, W) {
  const out = [];
  const push = (b) => out.push(b & 0xff);
  push(2); push(2); push(W >> 8); push(W & 0xff);
  for (let c = 0; c < 4; c++) {
    let x = 0;
    while (x < W) {
      // run of >= 3 identical?
      const v = bytes[x * 4 + c];
      let run = 1;
      while (run < 127 && x + run < W && bytes[(x + run) * 4 + c] === v) run++;
      if (run >= 3) {
        push(128 + run); push(v);
        x += run;
      } else {
        // literal packet
        let lit = 0;
        const litStart = x;
        while (
          lit < 128 &&
          x + lit < W &&
          (() => {
            const b = bytes[(x + lit) * 4 + c];
            // stop literal if a run of 3 starts here
            if (
              x + lit + 2 < W &&
              b === bytes[(x + lit + 1) * 4 + c] &&
              b === bytes[(x + lit + 2) * 4 + c]
            )
              return false;
            return true;
          })()
        )
          lit++;
        push(lit);
        for (let k = 0; k < lit; k++) push(bytes[(x + k) * 4 + c]);
        x += lit;
        if (lit === 0) {
          // safety: shouldn't happen, but avoid infinite loop
          push(128 + 1); push(v);
          x++;
        }
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
  let s = Math.pow(2, e - 128);
  let R = Math.round((r / s) * 255),
    G = Math.round((g / s) * 255),
    B = Math.round((b / s) * 255);
  if (R > 255 || G > 255 || B > 255) {
    e += 1;
    s = Math.pow(2, e - 128);
    R = Math.round((r / s) * 255);
    G = Math.round((g / s) * 255);
    B = Math.round((b / s) * 255);
  }
  return [Math.min(255, R), Math.min(255, G), Math.min(255, B), e];
}

const smoothstep = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

// ── preview PNG (Narkowicz ACES + sRGB) ─────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function writePNG(path, W, H, rgb) {
  const chunks = [];
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    rgb.copy ?
      rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3) :
      null;
  }
  const mk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const png = Buffer.concat([
    sig,
    mk("IHDR", ihdr),
    mk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    mk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}
function aces(x) {
  const a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return Math.min(1, Math.max(0, (x * (a * x + b)) / (x * (c * x + d) + e)));
}
function linToSrgb(c) {
  return Math.min(255, Math.round(Math.pow(Math.min(1, c), 1 / 2.2) * 255));
}

// ── main ────────────────────────────────────────────────────────────────────
const MODE = process.argv[2] || "verify";
const buf = readFileSync(HDR_PATH);
const { W, H, f, rowStart, headerText } = decodeHDR(buf);
console.log(`decoded ${W}x${H}; mode=${MODE}`);
console.log("FOG linear:", FOG.map((v) => v.toFixed(4)).join(", "));

// sky continuation colour per column: mean over photo el [0.5°, 10°], then
// horizontal box smoothing ±3° (with panorama wrap)
const HORIZON_ROW = H / 2; // y=512 <=> photo el 0
const bandTop = Math.round((0.5 - 10 / 180) * H); // el +10°
const bandBot = Math.round((0.5 - 0.5 / 180) * H); // el +0.5°
const bandRaw = new Float32Array(W * 3);
for (let y = bandTop; y <= bandBot; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    bandRaw[x * 3] += f[i] / (bandBot - bandTop + 1);
    bandRaw[x * 3 + 1] += f[i + 1] / (bandBot - bandTop + 1);
    bandRaw[x * 3 + 2] += f[i + 2] / (bandBot - bandTop + 1);
  }
}
const R_SMOOTH = Math.round((3 / 360) * W); // ±3° azimuth
const band = new Float32Array(W * 3);
for (let x = 0; x < W; x++) {
  for (let k = -R_SMOOTH; k <= R_SMOOTH; k++) {
    const xx = ((x + k) % W + W) % W;
    for (let c = 0; c < 3; c++)
      band[x * 3 + c] += bandRaw[xx * 3 + c] / (2 * R_SMOOTH + 1);
  }
}

/** the new paint colour for a below-horizon photo pixel */
function paintPixel(x, y) {
  const u = (x + 0.5) / W;
  const el = (0.5 - y / H) * Math.PI; // negative below photo horizon
  const azp = (u - 0.5) * 2 * Math.PI;
  const p = [
    Math.cos(el) * Math.cos(azp),
    Math.sin(el),
    Math.cos(el) * Math.sin(azp),
  ];
  const d = photoToWorld(p);
  let color;
  if (d[1] <= 0) {
    // below the world horizon: distance haze at the fog colour
    color = FOG;
  } else {
    const dAz = Math.atan2(d[2], d[0]);
    const hz = photoHorizonEl(dAz); // world el of photo horizon (rad), >0 on the exposed arc
    const wEl = Math.asin(Math.max(-1, Math.min(1, d[1])));
    const t = hz > 0 ? smoothstep(wEl / hz) : 1;
    color = [
      FOG[0] + (band[x * 3] - FOG[0]) * t,
      FOG[1] + (band[x * 3 + 1] - FOG[1]) * t,
      FOG[2] + (band[x * 3 + 2] - FOG[2]) * t,
    ];
  }
  // 3° mirror crossfade at the photo horizon so clouds continue past the line
  const depth = -el / Math.PI * 180; // degrees below photo horizon
  if (depth < 3) {
    const my = H - 1 - y; // mirrored row (el -> -el), stays in the sky half
    const k = depth / 3;
    const i = (my * W + x) * 3;
    color = [
      f[i] + (color[0] - f[i]) * k,
      f[i + 1] + (color[1] - f[i + 1]) * k,
      f[i + 2] + (color[2] - f[i + 2]) * k,
    ];
  }
  return color;
}

// preview strip: the full 360° x world el [-6°, +55°] as the player sees it
function preview(name) {
  const elTop = 55, elBot = -6;
  const PW = 1024, PH = 256;
  const rgb = Buffer.alloc(PW * PH * 3);
  for (let py = 0; py < PH; py++) {
    const wEl = (elTop - (py / (PH - 1)) * (elTop - elBot)) * Math.PI / 180;
    for (let px = 0; px < PW; px++) {
      const wAz = (px / PW) * 2 * Math.PI;
      const d = [
        Math.cos(wEl) * Math.cos(wAz),
        Math.sin(wEl),
        Math.cos(wEl) * Math.sin(wAz),
      ];
      const p = worldToPhoto(d);
      const u = Math.atan2(p[2], p[0]) / (2 * Math.PI) + 0.5;
      const v = Math.asin(Math.max(-1, Math.min(1, p[1]))) / Math.PI + 0.5;
      let x = Math.floor(u * W) % W;
      if (x < 0) x += W;
      let y = Math.floor((1 - v) * H);
      y = Math.max(0, Math.min(H - 1, y));
      let c;
      if (MODE === "patch" && y >= HORIZON_ROW) {
        c = paintPixel(x, y);
      } else {
        const i = (y * W + x) * 3;
        c = [f[i], f[i + 1], f[i + 2]];
      }
      const o = (py * PW + px) * 3;
      rgb[o] = linToSrgb(aces(c[0] * 1.05));
      rgb[o + 1] = linToSrgb(aces(c[1] * 1.05));
      rgb[o + 2] = linToSrgb(aces(c[2] * 1.05));
    }
  }
  writePNG(new URL(name, OUT_DIR).pathname.replace(/^\/([A-Za-z]:)/, "$1"), PW, PH, rgb);
  console.log("wrote", name);
}

if (MODE === "patch") {
  preview("sky_patch_before.png");
  // paint rows H/2..H-1
  const patched = Buffer.from(buf); // header + untouched rows stay identical
  const parts = [];
  parts.push(buf.subarray(0, rowStart[HORIZON_ROW])); // header + sky rows verbatim
  const rowBytes = new Uint8Array(W * 4);
  for (let y = HORIZON_ROW; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = paintPixel(x, y);
      const [R, G, B, E] = encodeRGBEPixel(c[0], c[1], c[2]);
      rowBytes[x * 4] = R;
      rowBytes[x * 4 + 1] = G;
      rowBytes[x * 4 + 2] = B;
      rowBytes[x * 4 + 3] = E;
    }
    parts.push(encodeRow(rowBytes, W));
  }
  const out = Buffer.concat(parts);
  writeFileSync(HDR_PATH.pathname.replace(/^\/([A-Za-z]:)/, "$1"), out);
  console.log(`patched ${H - HORIZON_ROW} rows; ${buf.length} -> ${out.length} bytes`);
  // re-decode to verify roundtrip + sky rows untouched
  const again = decodeHDR(readFileSync(HDR_PATH));
  let skyIdentical = true;
  for (let y = 0; y < HORIZON_ROW; y++) {
    const a = buf.subarray(rowStart[y], rowStart[y + 1]);
    const b = readFileSync(HDR_PATH).subarray(
      again.rowStart[y],
      again.rowStart[y + 1],
    );
    if (!a.equals(b)) {
      skyIdentical = false;
      console.log(`SKY ROW CHANGED at y=${y}`);
      break;
    }
  }
  console.log("sky rows byte-identical:", skyIdentical);
  // seam metric along the worst arc: max |Δlum| between adjacent world-el samples
  for (const azDeg of [150, 180, 211, 240, 270]) {
    let maxDelta = 0,
      atEl = 0;
    let prev = null;
    for (let wEl = 50; wEl >= 0; wEl -= 0.25) {
      const er = (wEl * Math.PI) / 180,
        ar = (azDeg * Math.PI) / 180;
      const d = [
        Math.cos(er) * Math.cos(ar),
        Math.sin(er),
        Math.cos(er) * Math.sin(ar),
      ];
      const p = worldToPhoto(d);
      const u = Math.atan2(p[2], p[0]) / (2 * Math.PI) + 0.5;
      const v = Math.asin(Math.max(-1, Math.min(1, p[1]))) / Math.PI + 0.5;
      let x = Math.floor(u * W) % W;
      if (x < 0) x += W;
      let y = Math.floor((1 - v) * H);
      y = Math.max(0, Math.min(H - 1, y));
      const i = (y * W + x) * 3;
      const lum = 0.2126 * again.f[i] + 0.7152 * again.f[i + 1] + 0.0722 * again.f[i + 2];
      if (prev !== null) {
        const dl = Math.abs(lum - prev.lum);
        if (dl > maxDelta) {
          maxDelta = dl;
          atEl = prev.el;
        }
      }
      prev = { lum, el: wEl };
    }
    console.log(
      `az ${azDeg}°: max adjacent Δlum (world el 0..50°) = ${maxDelta.toFixed(3)} at el ${atEl}°`,
    );
  }
  // reload floats for the after-preview
  const f2 = again.f;
  preview("sky_patch_after.png");
} else {
  console.log("verify mode — nothing written");
}

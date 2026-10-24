// Bake the world-aligned sky (v7) — kill the runtime tilt for good.
//
// WHY (Task 22): the photo sun sits at el ~48.7°, the game light (SUN_DIR) at
// el 15°. Tasks 19–21 closed that gap by ROTATING the panorama ~33.7° at
// runtime (setFromUnitVectors(HDR_SUN_DIR, SUN_DIR)). Any rigid rotation that
// changes the sun's elevation must tilt the photo horizon: it lifted the
// photo horizon up to +33.7° ABOVE the terrain on the anti-sun arc — first a
// tilted "sea" line (v5), then a fog-coloured wedge that still read lopsided
// (v6; user verdict: "the sky in that position need rotating. its lopsided")
// — one side of the sky had real clouds down to the silhouette, the other a
// ~34° flat haze band. No rotation can fix that; the geometry is the problem.
//
// THE FIX — bake the alignment into the pixels, then run the panorama with
// IDENTITY rotation (DaySky drops backgroundRotation/environmentRotation):
//   * yaw: source u = u_out - Δu, Δu = u_sun_world - u_sun_photo (~-3.2°),
//     in the equirectUv frame three samples with (u = atan2(z,x)/2π + 0.5);
//   * vertical remap: el_src = CUT + k · atan(s · tan(el_world)), k =
//     (90−CUT)/90, s solved so the MEASURED disc centre (el 43.0°) lands on
//     SUN_DIR (el 15.0°). Anchors: el 0 → CUT (photo el 3° — the photo's own
//     dark olive rim below el ~3°, lum 0.47→0.20, is SKIPPED so no dark line
//     rides the terrain silhouette), el 15° → 43.0° (sun onto SUN_DIR),
//     el 90° → 90° (zenith stable). Smooth — no piecewise kink to tear
//     cloud bands; low sky compresses (glow hugs the silhouette), the
//     mid wedge stays near 1:1;
//   * below the world horizon: mirrored sky melting into the fog colour
//     (linear 0xb9d2e2) over 1.2°, flat fog below — the void past the finite
//     GLB terrain keeps reading as distance haze (Task 21's validated call).
//
// Source of the bake = the shipped v6 file: its rows 0..511 are the original
// photo, byte-identical (verified when v6 was written). Only el ≥ 0 is ever
// sampled, so the v6 wedge paint below the photo horizon is irrelevant.
//
// SUN ANCHOR: the photo sun's DISC CENTROID measures el 43.0° / u 0.6004
// (grid-dumped by scripts/sun_probe.mjs: a ~4-row saturated disc centred at
// pixel y≈266.5). DaySky's old HDR_SUN_DIR constant (el 48.66°) is 5.6° HIGH
// — the tilt build therefore rendered the visible sun at el ~12.4° while the
// light sat at 15.0° (nobody noticed at 2k). The bake anchors the MEASURED
// disc centre onto SUN_DIR, so visible sun and light finally coincide.
//
// Self-checks (hard failures): re-measured sun must sit at SUN_DIR's (u, el);
// rows below el -2° must match the fog colour. Also prints horizon Δlum
// scans + writes before/after 360° strips to download/ for eyeballing.
//
// Usage: node scripts/hdr_remap.mjs [source.hdr]
//   source defaults to the shipped file — pass the pristine extract
//   (scripts/sky_src_v6.hdr, from git show 4e83d28:public/...) on re-bakes
//   so the bake never runs on an already-baked file.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

const HDR_PATH = new URL(
  "../public/models/sky/sunflowers_puresky_2k.hdr",
  import.meta.url,
);
const OUT_DIR = new URL("../download/", import.meta.url);
const D2R = Math.PI / 180;

// ── vec helpers ─────────────────────────────────────────────────────────────
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

// ── game constants (mirror DaySky.ts — the proven alignment targets) ────────
const SUN = norm([500, 160, 325]); // SUN_DIR — light + visible-sun target
const elSunWorld = Math.asin(SUN[1]); // 15.02°
const uSunWorld =
  Math.atan2(SUN[2], SUN[0]) / (2 * Math.PI) + 0.5; // 0.5918
const HDR_SUN = norm([0.5335, 0.7506, 0.3898]); // Task 19's photo-sun constant
const elSunPhoto = Math.asin(HDR_SUN[1]); // 48.66° — probe shows 5.6° HIGH
const uSunPhoto =
  Math.atan2(HDR_SUN[2], HDR_SUN[0]) / (2 * Math.PI) + 0.5; // 0.6005 ✓

// the old runtime tilt (Tasks 19–21) — ONLY used to render the BEFORE strip
const TILT_AXIS = norm(cross(HDR_SUN, SUN));
const TILT_ANGLE = Math.acos(Math.max(-1, Math.min(1, dot(HDR_SUN, SUN))));
const worldToPhoto = (d) => rotVec(TILT_AXIS, -TILT_ANGLE, d);

// bake parameters — du/s/fEl are derived in main from the MEASURED disc
// centroid (sun_probe.mjs-verified) so the visible sun lands exactly on SUN_DIR
const FADE_DEG = 1.2; // sky→fog fade below the world horizon
// photo el CUT: the lowest ~3° of photo sky darkens to a dark olive rim
// (field residue + haze: lum 0.47 @el 3° → 0.20 @el 0, probe_v6.log) —
// compressing it onto the horizon would draw a dark line at the silhouette
const CUT_DEG = 3;
const K = (90 - CUT_DEG) / 90;
let du, s, elSrc; // elSrc: world el (deg, ≥0) → photo el (deg)

// fog colour of the SPA day palette (registry.ts) — sRGB hex → linear
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const FOG = [
  srgbToLinear(0xb9 / 255),
  srgbToLinear(0xd2 / 255),
  srgbToLinear(0xe2 / 255),
];
const fogLum = 0.2126 * FOG[0] + 0.7152 * FOG[1] + 0.0722 * FOG[2];

// ── RGBE decode (three's convention: value = byte · 2^(e-128) / 255) ──────
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

// ── RGBE encode (per-row RLE, 4-byte scanline headers) ─────────────────────
function encodeRow(bytes, W) {
  const out = [];
  const push = (b) => out.push(b & 0xff);
  push(2);
  push(2);
  push(W >> 8);
  push(W & 0xff);
  for (let c = 0; c < 4; c++) {
    let x = 0;
    while (x < W) {
      const v = bytes[x * 4 + c];
      let run = 1;
      while (run < 127 && x + run < W && bytes[(x + run) * 4 + c] === v) run++;
      if (run >= 3) {
        push(128 + run);
        push(v);
        x += run;
      } else {
        let lit = 0;
        const litStart = x;
        while (
          lit < 128 &&
          x + lit < W &&
          (() => {
            const b = bytes[(x + lit) * 4 + c];
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
          push(128 + 1);
          push(v);
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
  let sc = Math.pow(2, e - 128);
  let R = Math.round((r / sc) * 255),
    G = Math.round((g / sc) * 255),
    B = Math.round((b / sc) * 255);
  if (R > 255 || G > 255 || B > 255) {
    e += 1;
    sc = Math.pow(2, e - 128);
    R = Math.round((r / sc) * 255);
    G = Math.round((g / sc) * 255);
    B = Math.round((b / sc) * 255);
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
  ihdr[8] = 8;
  ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    rgb.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
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

// ── bilinear equirect sampling (u wraps, el clamped at poles) ───────────────
function sample(f, W, H, u, el) {
  let x = (u - Math.floor(u)) * W - 0.5;
  if (x < 0) x += W;
  const x0 = Math.floor(x),
    fx = x - x0;
  const x1 = (x0 + 1) % W;
  let y = (0.5 - el / Math.PI) * H - 0.5;
  y = Math.max(0, Math.min(H - 1, y));
  const y0 = Math.floor(y),
    fy = y - y0;
  const y1 = Math.min(H - 1, y0 + 1);
  const i00 = (y0 * W + x0) * 3,
    i01 = (y0 * W + x1) * 3;
  const i10 = (y1 * W + x0) * 3,
    i11 = (y1 * W + x1) * 3;
  const out = [];
  for (let c = 0; c < 3; c++) {
    const a = f[i00 + c] * (1 - fx) + f[i01 + c] * fx;
    const b = f[i10 + c] * (1 - fx) + f[i11 + c] * fx;
    out.push(a * (1 - fy) + b * fy);
  }
  return out;
}

// ── sun centroid (weight = lum − thr, isolates the disc from clouds) ────────
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
  let ws = 0,
    us = 0,
    els = 0,
    n = 0,
    yMin = H,
    yMax = 0;
  for (let y = yTop; y <= yBot; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const lum = 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
      if (lum > thr) {
        const w = lum - thr;
        ws += w;
        n++;
        us += w * ((x + 0.5) / W);
        els += w * (0.5 - (y + 0.5) / H) * Math.PI;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  return {
    u: us / ws,
    el: els / ws,
    n,
    maxLum,
    rows: yMax - yMin + 1,
  };
}

// ── main ────────────────────────────────────────────────────────────────────
const buf = readFileSync(
  process.argv[2] ? pathToFileURL(process.argv[2]) : HDR_PATH,
);
const { W, H, f: SRC, rowStart } = decodeHDR(buf);
console.log(`decoded ${W}x${H} (${buf.length} bytes)`);
console.log(
  `targets: sun world el=${(elSunWorld / D2R).toFixed(2)}° u=${uSunWorld.toFixed(4)} | photo sun (old constant) el=${(elSunPhoto / D2R).toFixed(2)}° u=${uSunPhoto.toFixed(4)}`,
);

// sun anchor: the MEASURED disc centroid (grid-verified via sun_probe.mjs —
// a ~4-row saturated disc at pixel y≈266.5; Task 19's constant is 5.6° high,
// so the tilt build rendered the sun at el ~12.4° vs the light's 15.0°)
const pre = measureSun(SRC, W, H, 20, 70);
console.log(
  `measured photo sun: el=${(pre.el / D2R).toFixed(2)}° u=${pre.u.toFixed(4)} n=${pre.n} rows=${pre.rows} maxLum=${pre.maxLum.toFixed(0)}`,
);
if (pre.n < 3 || pre.n > 400 || pre.maxLum < 1e4)
  throw new Error("sun disc not found cleanly — abort");
if (Math.abs(pre.u - uSunPhoto) > 0.01)
  throw new Error("measured azimuth disagrees with proven constant — abort");
console.log(
  `note: old HDR_SUN_DIR el ${(elSunPhoto / D2R).toFixed(2)}° is ${((elSunPhoto - pre.el) / D2R).toFixed(2)}° above the measured disc center — anchoring to the measurement`,
);
du = uSunWorld - pre.u;
s =
  Math.tan((((pre.el / D2R) - CUT_DEG) / K) * D2R) /
  Math.tan(elSunWorld);
elSrc = (eDeg) =>
  CUT_DEG + K * (Math.atan(s * Math.tan(eDeg * D2R)) / D2R);
console.log(
  `bake: Δu=${(du * 360).toFixed(2)}°, s=${s.toFixed(3)}, CUT=${CUT_DEG}° → f(0°)=${elSrc(0).toFixed(2)}°, f(15°)=${elSrc(15).toFixed(2)}°, f(28°)=${elSrc(28).toFixed(2)}°, f(90°)=${elSrc(90).toFixed(2)}°`,
);

// horizon-band sanity: mean colour of the rows just above the photo horizon
for (const y of [509, 510, 511]) {
  let r = 0, g = 0, b = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    r += SRC[i] / W;
    g += SRC[i + 1] / W;
    b += SRC[i + 2] / W;
  }
  console.log(
    `row ${y} mean: r=${r.toFixed(3)} g=${g.toFixed(3)} b=${b.toFixed(3)}`,
  );
}

// ── bake the world-aligned texture ──────────────────────────────────────────
console.log("baking…");
const OUT = new Float32Array(W * H * 3);
for (let y = 0; y < H; y++) {
  const el = (0.5 - (y + 0.5) / H) * Math.PI; // world el (v7 = identity)
  const d = -el / D2R; // degrees BELOW the horizon (≥0)
  for (let x = 0; x < W; x++) {
    const u = (x + 0.5) / W;
    const su = u - du;
    let c;
    if (el >= 0) {
      c = sample(SRC, W, H, su, elSrc(el / D2R) * D2R);
    } else if (d <= FADE_DEG) {
      const sky = sample(SRC, W, H, su, elSrc(d) * D2R); // mirror at the line
      const k = smoothstep(d / FADE_DEG);
      c = [
        sky[0] + (FOG[0] - sky[0]) * k,
        sky[1] + (FOG[1] - sky[1]) * k,
        sky[2] + (FOG[2] - sky[2]) * k,
      ];
    } else {
      c = FOG;
    }
    const i = (y * W + x) * 3;
    OUT[i] = c[0];
    OUT[i + 1] = c[1];
    OUT[i + 2] = c[2];
  }
}

// ── encode (verbatim header — same dimensions) ─────────────────────────────
const parts = [buf.subarray(0, rowStart[0])];
const rowBytes = new Uint8Array(W * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const [R, G, B, E] = encodeRGBEPixel(OUT[i], OUT[i + 1], OUT[i + 2]);
    rowBytes[x * 4] = R;
    rowBytes[x * 4 + 1] = G;
    rowBytes[x * 4 + 2] = B;
    rowBytes[x * 4 + 3] = E;
  }
  parts.push(encodeRow(rowBytes, W));
}
const out = Buffer.concat(parts);
writeFileSync(HDR_PATH.pathname, out);
console.log(`written ${out.length} bytes (was ${buf.length})`);

// ── self-checks on the baked file ───────────────────────────────────────────
const again = decodeHDR(readFileSync(HDR_PATH));
const post = measureSun(again.f, W, H, 5, 70);
console.log(
  `baked sun: el=${(post.el / D2R).toFixed(2)}° u=${post.u.toFixed(4)} n=${post.n} rows=${post.rows}`,
);
let fail = 0;
if (Math.abs(post.u - uSunWorld) > 0.003) {
  console.log("FAIL: baked sun azimuth off target");
  fail++;
}
if (Math.abs(post.el - elSunWorld) > 0.8 * D2R) {
  console.log("FAIL: baked sun elevation off target");
  fail++;
}
// fog rows: world el -3° must be the fog colour, at every azimuth
let fogMean = 0,
  fogMax = 0;
for (let a = 0; a < 24; a++) {
  const c = sample(again.f, W, H, a / 24, -3 * D2R);
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  fogMean += lum / 24;
  if (Math.abs(lum - fogLum) > fogMax) fogMax = Math.abs(lum - fogLum);
}
console.log(
  `fog rows @el -3°: mean lum=${fogMean.toFixed(3)} (target ${fogLum.toFixed(3)}), max dev=${fogMax.toFixed(3)}`,
);
if (fogMax > 0.02) {
  console.log("FAIL: below-horizon rows off fog colour");
  fail++;
}
// horizon rows: no dark line at the silhouette (world el +0.9..−0.4°)
let minRow = 1;
for (let y = 506; y <= 514; y++) {
  let r = 0, g = 0, b = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    r += again.f[i] / W;
    g += again.f[i + 1] / W;
    b += again.f[i + 2] / W;
  }
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (l < minRow) minRow = l;
}
console.log(
  `horizon rows: min mean lum=${minRow.toFixed(3)} (must be > 0.40)`,
);
if (minRow < 0.4) {
  console.log("FAIL: dark line at the world horizon");
  fail++;
}
// horizon continuity scans (info only — clouds make natural jumps)
for (const azDeg of [33, 150, 211, 270]) {
  let maxDelta = 0,
    atEl = 0,
    prev = null;
  for (let wEl = 50; wEl >= 0; wEl -= 0.25) {
    const c = sample(again.f, W, H, (azDeg / 360), wEl * D2R);
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
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
if (fail) {
  console.log(`${fail} SELF-CHECK(S) FAILED — not shipping`);
  process.exit(1);
}
console.log("self-checks passed");

// ── before/after 360° strips (world el -6..55, as the player sees it) ───────
function writeStrip(name, src, tilted) {
  const PW = 1024,
    PH = 256,
    elTop = 55,
    elBot = -6;
  const rgb = Buffer.alloc(PW * PH * 3);
  for (let py = 0; py < PH; py++) {
    const wEl = (elTop - (py / (PH - 1)) * (elTop - elBot)) * D2R;
    for (let px = 0; px < PW; px++) {
      const wAz = ((px / PW) * 2 * Math.PI);
      const d = [
        Math.cos(wEl) * Math.cos(wAz),
        Math.sin(wEl),
        Math.cos(wEl) * Math.sin(wAz),
      ];
      let u, el;
      if (tilted) {
        const p = worldToPhoto(d);
        u = Math.atan2(p[2], p[0]) / (2 * Math.PI) + 0.5;
        el = Math.asin(Math.max(-1, Math.min(1, p[1])));
      } else {
        u = px / PW;
        el = wEl;
      }
      const c = sample(src, W, H, u, el);
      const o = (py * PW + px) * 3;
      rgb[o] = linToSrgb(aces(c[0] * 1.05));
      rgb[o + 1] = linToSrgb(aces(c[1] * 1.05));
      rgb[o + 2] = linToSrgb(aces(c[2] * 1.05));
    }
  }
  writePNG(new URL(name, OUT_DIR).pathname, PW, PH, rgb);
  console.log("wrote", name);
}
writeStrip("sky_task22_before.png", SRC, true);
writeStrip("sky_task22_after.png", again.f, false);

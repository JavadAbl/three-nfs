// Analysis: where does the patched below-horizon band become visible in-world?
// Decodes the shipped .hdr, maps world directions -> photo directions via the
// inverse of DaySky's skyEuler, and reports the photo elevation seen at the
// world horizon for every azimuth (photo el < 0 there => patched pixels show
// ABOVE the terrain silhouette).
import { readFileSync } from "node:fs";

const HDR = new URL(
  "../public/models/sky/sunflowers_puresky_2k.hdr",
  import.meta.url,
);

// ── RGBE decode (three.js convention: value = byte * 2^(e-136)) ────────────
function decodeHDR(buf) {
  let off = 0;
  // header
  let magic = "";
  while (off < buf.length) {
    const lineEnd = buf.indexOf(10, off);
    const line = buf.toString("ascii", off, lineEnd);
    off = lineEnd + 1;
    if (line === "") break;
    magic += line + "\n";
  }
  if (!magic.startsWith("#?")) throw new Error("not a radiance file");
  // resolution line: -Y H +X W
  let res = "";
  while (off < buf.length) {
    const lineEnd = buf.indexOf(10, off);
    res = buf.toString("ascii", off, lineEnd);
    off = lineEnd + 1;
    if (res !== "") break;
  }
  const m = res.match(/-Y (\d+) \+X (\d+)/);
  if (!m) throw new Error("unsupported resolution line: " + res);
  const H = +m[1],
    W = +m[2];
  const data = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    // scanline RLE
    if (buf[off] !== 2 || buf[off + 1] !== 2) {
      // flat (uncompressed) scanline — rare
      for (let x = 0; x < W; x++) {
        const e = buf[off + 3];
        const f = e ? Math.pow(2, e - 136) : 0;
        const i = (y * W + x) * 4;
        data[i] = buf[off] * f;
        data[i + 1] = buf[off + 1] * f;
        data[i + 2] = buf[off + 2] * f;
        data[i + 3] = 1;
        off += 4;
      }
      continue;
    }
    const scanW = buf.readUInt16BE(off + 2);
    if (scanW !== W) throw new Error(`scanline width mismatch at y=${y}: ${scanW}`);
    off += 4; // magic(2) + width(2) — no height field in this file
    const chans = [null, null, null, null].map(() => new Uint8Array(W));
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        let count = buf[off++];
        if (count > 128) {
          count -= 128;
          const v = buf[off++];
          chans[c].fill(v, x, x + count);
        } else {
          chans[c].set(buf.subarray(off, off + count), x);
          off += count;
        }
        x += count;
      }
    }
    for (let x = 0; x < W; x++) {
      const e = chans[3][x];
      const f = e ? Math.pow(2, e - 136) : 0;
      const i = (y * W + x) * 4;
      data[i] = chans[0][x] * f;
      data[i + 1] = chans[1][x] * f;
      data[i + 2] = chans[2][x] * f;
      data[i + 3] = 1;
    }
  }
  return { W, H, data };
}

const { W, H, data } = decodeHDR(readFileSync(HDR));
console.log(`decoded ${W}x${H}`);

// equirect sampling: u = atan(z,x)/2pi + 0.5, v = asin(y)/pi + 0.5
// DataTexture rows: row 0 of the file = TOP (v=0, zenith) per Radiance -Y H.
// (flipY=true by default in three's HDRLoader -> v=0 top matches file order.)
function sample(dir) {
  const u = Math.atan2(dir[2], dir[0]) / (2 * Math.PI) + 0.5;
  const v = Math.asin(Math.max(-1, Math.min(1, dir[1]))) / Math.PI + 0.5;
  let x = Math.floor(u * W) % W;
  if (x < 0) x += W;
  let y = Math.floor((1 - v) * H); // v=0 (zenith) -> file row 0
  y = Math.max(0, Math.min(H - 1, y));
  const i = (y * W + x) * 4;
  return [data[i], data[i + 1], data[i + 2]];
}

// ── verify row orientation: top half should be sky (clouds = variance), bottom = smooth patch
function rowVariance(y) {
  let s = 0,
    s2 = 0,
    n = 0;
  for (let x = 0; x < W; x += 7) {
    const i = (y * W + x) * 4;
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    s += lum;
    s2 += lum * lum;
    n++;
  }
  return Math.sqrt(s2 / n - (s / n) ** 2);
}
console.log(
  "row variance (clouds=high) y=H*0.25:",
  rowVariance(Math.floor(H * 0.25)).toFixed(4),
  " y=H*0.75:",
  rowVariance(Math.floor(H * 0.75)).toFixed(4),
);

// ── the rotation: SUN_DIR = R * HDR_SUN_DIR  (three: sampled = R^-1 * world)
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
  // Rodrigues
  const c = Math.cos(ang),
    s = Math.sin(ang);
  const k = axis;
  const kxv = cross(k, v);
  const kdv = dot(k, v);
  return [
    v[0] * c + kxv[0] * s + k[0] * kdv * (1 - c),
    v[1] * c + kxv[1] * s + k[1] * kdv * (1 - c),
    v[2] * c + kxv[2] * s + k[2] * kdv * (1 - c),
  ];
}
const HDR_SUN = norm([0.5335, 0.7506, 0.3898]);
const SUN = norm([500, 160, 325]);
const axis = norm(cross(HDR_SUN, SUN));
const angle = Math.acos(Math.max(-1, Math.min(1, dot(HDR_SUN, SUN))));
console.log(
  `tilt axis az=${Math.atan2(axis[2], axis[0]) * 180 / Math.PI}° el=${Math.asin(axis[1]) * 180 / Math.PI}° angle=${angle * 180 / Math.PI}°`,
);

// world -> photo: p = R^-1 * d = rot(axis, -angle, d)
function worldToPhoto(d) {
  return rotVec(axis, -angle, d);
}

// ── photo elevation at the world horizon (world el = 0), per azimuth
console.log("\nazimuth | photo_el at world horizon | patch visible above terrain?");
for (let az = 0; az < 360; az += 15) {
  const d = [
    Math.cos(az * Math.PI / 180),
    0,
    Math.sin(az * Math.PI / 180),
  ];
  const p = worldToPhoto(d);
  const pEl = Math.asin(p[1]) * 180 / Math.PI;
  const flag = pEl < 0 ? `PATCH exposed ${( -pEl).toFixed(1)}° above horizon` : "real sky";
  console.log(
    `${String(az).padStart(3)}°   | ${pEl.toFixed(1).padStart(6)}°               | ${flag}`,
  );
}

// ── what does the currently-visible patch band look like at the worst azimuth?
// find worst azimuth numerically (most negative photo el at world horizon)
let worst = { az: 210, el: -1 };
for (let az = 0; az < 360; az += 1) {
  const d = [Math.cos(az * Math.PI / 180), 0, Math.sin(az * Math.PI / 180)];
  const p = worldToPhoto(d);
  const pEl = Math.asin(p[1]) * 180 / Math.PI;
  if (pEl < worst.el) worst = { az, el: pEl };
}
console.log(
  `\nworst azimuth: ${worst.az}° — photo horizon sits ${-worst.el.toFixed(1)}° ABOVE the world horizon`,
);

// sample the current paint along that azimuth: world elevations 0..40 step 5
console.log(`\ncurrent colors along world az=${worst.az}° (what the player sees):`);
for (let wEl = 40; wEl >= -5; wEl -= 5) {
  const er = wEl * Math.PI / 180,
    ar = worst.az * Math.PI / 180;
  const d = [Math.cos(er) * Math.cos(ar), Math.sin(er), Math.cos(er) * Math.sin(ar)];
  const p = worldToPhoto(d);
  const pEl = Math.asin(p[1]) * 180 / Math.PI;
  const c = sample(p);
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  console.log(
    `world el ${String(wEl).padStart(3)}° (photo el ${pEl.toFixed(1).padStart(6)}°): rgb=(${c.map((v) => v.toFixed(3)).join(", ")}) lum=${lum.toFixed(3)}${pEl < 0 ? "  <-- PATCH" : ""}`,
  );
}

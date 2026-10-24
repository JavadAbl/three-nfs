// Probe the sun disc in the shipped HDR: dump a lum grid around the hottest
// pixel so the disc center can be read by eye (2k equirect: the 0.53° disc
// spans ~3×3 px; saturated core + glow make naive centroids lie).
// Also dumps per-row mean colours near the horizon (rows 470..540).
// Usage: node scripts/sun_probe.mjs [path/to/sky.hdr]
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const HDR_PATH = process.argv[2]
  ? pathToFileURL(process.argv[2])
  : new URL(
      "../public/models/sky/sunflowers_puresky_2k.hdr",
      import.meta.url,
    );

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
  const H = +m[1], W = +m[2];
  const f = new Float32Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    if (buf[off] !== 2 || buf[off + 1] !== 2)
      throw new Error(`uncompressed scanline at y=${y}`);
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
  return { W, H, f };
}

const { W, H, f } = decodeHDR(readFileSync(HDR_PATH));
const lum = (i) => 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];
const elOf = (y) => (0.5 - (y + 0.5) / H) * 180;
const uOf = (x) => ((x + 0.5) / W) * 360 - 180; // degrees, wraps

// hottest pixel
let bx = 0, by = 0, bl = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const l = lum((y * W + x) * 3);
    if (l > bl) { bl = l; bx = x; by = y; }
  }
console.log(
  `hottest px x=${bx} y=${by}  el=${elOf(by).toFixed(2)}° u=${uOf(bx).toFixed(2)}°  lum=${bl.toFixed(0)}`,
);

// grid: 17 rows × 13 cols around it
const RAD_Y = 8, RAD_X = 6;
console.log("\nlum grid (rows=el, cols=u); '.' < 500, values in k-lum:");
let header = "        ";
for (let dx = -RAD_X; dx <= RAD_X; dx++) {
  header += String(((bx + dx + W) % W) % 100).padStart(6);
}
console.log(header);
for (let dy = -RAD_Y; dy <= RAD_Y; dy++) {
  const y = by + dy;
  if (y < 0 || y >= H) continue;
  let line = `y${y} el${elOf(y).toFixed(1).padStart(6)} `;
  for (let dx = -RAD_X; dx <= RAD_X; dx++) {
    const x = (bx + dx + W) % W;
    const l = lum((y * W + x) * 3);
    line += l < 500 ? "    ." : (l / 1000).toFixed(1).padStart(6);
  }
  console.log(line);
}

// vertical profile: per-row max lum, ±12 rows, disc rows stand out by 20×
console.log("\nper-row max lum around the hottest row:");
for (let y = Math.max(0, by - 14); y <= Math.min(H - 1, by + 14); y++) {
  let mx = 0;
  for (let x = 0; x < W; x++) {
    const l = lum((y * W + x) * 3);
    if (l > mx) mx = l;
  }
  console.log(`y=${y} el=${elOf(y).toFixed(2)}° maxlum=${mx.toFixed(0)}`);
}

// near-horizon profile: per-row mean colour, rows 470..540 (el +7.3°..-4.1°)
console.log("\nnear-horizon per-row mean lum + rgb:");
for (let y = 470; y <= 540; y++) {
  let r = 0, g = 0, b = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    r += f[i] / W;
    g += f[i + 1] / W;
    b += f[i + 2] / W;
  }
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  console.log(
    `y=${y} el=${elOf(y).toFixed(2)}° lum=${l.toFixed(3)} rgb=${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)}`,
  );
}

// horizon probe: does a candidate island HDRI have an OPEN, bright horizon
// ring (ocean/sky at every azimuth, no dark treeline), and a clean sun disc?
// usage: node scripts/probe_horizon.mjs a.hdr b.hdr ...
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

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
    if (buf[off] !== 2 || buf[off + 1] !== 2) throw new Error("uncompressed row");
    off += 4;
    const chans = [0, 1, 2, 3].map(() => new Uint8Array(W));
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < W) {
        let count = buf[off++];
        if (count > 128) { count -= 128; chans[c].fill(buf[off++], x, x + count); }
        else { chans[c].set(buf.subarray(off, off + count), x); off += count; }
        x += count;
      }
    }
    for (let x = 0; x < W; x++) {
      const e = chans[3][x];
      const sc = e ? Math.pow(2, e - 128) / 255 : 0;
      const i = (y * W + x) * 3;
      f[i] = chans[0][x] * sc; f[i + 1] = chans[1][x] * sc; f[i + 2] = chans[2][x] * sc;
    }
  }
  return { W, H, f };
}
const lum = (f, i) => 0.2126 * f[i] + 0.7152 * f[i + 1] + 0.0722 * f[i + 2];

for (const p of process.argv.slice(2)) {
  const { W, H, f } = decodeHDR(readFileSync(pathToFileURL(p)));
  // sun: brightest disc 8..85°
  let maxL = 0;
  for (let i = 0; i < f.length; i += 3) maxL = Math.max(maxL, lum(f, i));
  // horizon band: world rows el 0.5..6° (y = (0.5-el/180)*H)
  let worst = 1e9, sum = 0, n = 0, darkFrac = 0;
  for (let y = Math.round((0.5 - 6 / 180) * H); y <= Math.round((0.5 - 0.5 / 180) * H); y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) rowSum += lum(f, (y * W + x) * 3) / W;
    sum += rowSum; n++;
    if (rowSum < worst) worst = rowSum;
    if (rowSum < 0.35) darkFrac += 1;
  }
  // darkest azimuth at el ~2°
  let worstAz = -1, worstAzL = 1e9;
  const y2 = Math.round((0.5 - 2 / 180) * H);
  for (let x = 0; x < W; x++) {
    const l = lum(f, (y2 * W + x) * 3);
    if (l < worstAzL) { worstAzL = l; worstAz = x; }
  }
  console.log(
    `${p.split("/").pop().padEnd(28)} maxSun=${maxL.toFixed(0).padStart(7)} horizon: minRow=${worst.toFixed(2)} mean=${(sum / n).toFixed(2)} darkRows=${darkFrac}/${n} worstAz@el2°=${((worstAz / W) * 360).toFixed(0)}° lum=${worstAzL.toFixed(2)}`,
  );
}

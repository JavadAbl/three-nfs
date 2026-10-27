import * as THREE from "three";
import { ISLAND_POINTS } from "../src/game/maps/island_generated";
import { RIDGE, ridgeFieldFactory } from "../src/game/world/IslandEnvironment";
const hw = 8.5, A = 512;
const pts = ISLAND_POINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
const samples = curve.getSpacedPoints(1400); samples.pop();
const roadR = new Float32Array(A).fill(Infinity);
{
  const win = Math.max(1, Math.round((A * 4) / 360));
  for (const sm of samples) {
    const th = Math.atan2(sm.z, sm.x);
    const c = Math.floor((((th + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * A);
    const r = Math.hypot(sm.x, sm.z);
    for (let k = -win; k <= win; k++) { const b = (c + k + A) % A; if (r < roadR[b]) roadR[b] = r; }
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = Float32Array.from(roadR);
    for (let j = 0; j < A; j++) next[j] = Math.min(roadR[(j - 1 + A) % A], roadR[j], roadR[(j + 1) % A]);
    roadR.set(next);
  }
}
const massifs = [
  { x: 40, z: -55, r: 275, h: 195 },
  { x: -150, z: -120, r: 165, h: 120 },
  { x: 135, z: 115, r: 130, h: 88 },
];
const factory = ridgeFieldFactory(roadR, 100, hw, (x, z) => {
  let m = 0;
  for (const ms of massifs) {
    const dm = Math.hypot(x - ms.x, z - ms.z);
    if (dm < ms.r * 1.25) m = Math.max(m, ms.h * Math.pow(Math.max(0, 1 - dm / ms.r), 1.62));
  }
  return m;
});
const f = factory.field;
// where do clashes happen? walk all azimuths x d, record f>0.5 inside massif core
const hits: string[] = [];
for (let j = 0; j < 720; j++) {
  const th = (j / 720) * Math.PI * 2;
  const rc = factory.roadAt(th);
  for (let d = hw + RIDGE.toeOff - 12; d < hw + RIDGE.toeOff + RIDGE.flankSea + RIDGE.flankIn + 14; d += 2) {
    const r = rc - d;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (f(x, z) > 0.5) {
      for (const m of massifs) {
        const dm = Math.hypot(x - m.x, z - m.z);
        if (dm < m.r * 0.62) hits.push(`az ${(th * 180 / Math.PI).toFixed(0)} d=${d.toFixed(0)} r=${r.toFixed(0)} h=${f(x, z).toFixed(1)} massif@${m.x},${m.z} dm=${dm.toFixed(0)} core=${(m.r * 0.62).toFixed(0)}`);
      }
    }
  }
}
console.log(`total clash samples: ${hits.length}`);
hits.slice(0, 12).forEach((h) => console.log(" ", h));
// also: how high does the field get inside massif cores, worst case

// ── refined: does the TALL ridge body slice a TALL massif flank? ──
// approximate massif height: h·(1-dm/r)^1.62 (noise/sub-summits ignored)
let realClash = 0, worst = "";
let worstProd = 0;
for (let j = 0; j < 1440; j++) {
  const th = (j / 1440) * Math.PI * 2;
  const rc = factory.roadAt(th);
  for (let d = hw + RIDGE.toeOff; d < hw + RIDGE.toeOff + RIDGE.flankSea + RIDGE.flankIn + 12; d += 1) {
    const r = rc - d;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    const fh = f(x, z);
    if (fh < 12) continue;
    for (const m of massifs) {
      const dm = Math.hypot(x - m.x, z - m.z);
      if (dm > m.r) continue;
      const mh = m.h * Math.pow(Math.max(0, 1 - dm / m.r), 1.62);
      if (mh > 12 && fh > 12) {
        realClash++;
        const prod = fh * mh;
        if (prod > worstProd) { worstProd = prod; worst = `az ${(th*180/Math.PI).toFixed(0)}° d=${d.toFixed(0)} ridge=${fh.toFixed(0)}m massif=${mh.toFixed(0)}m dm=${dm.toFixed(0)}`; }
      }
    }
  }
}
console.log(`TALL×TALL overlap samples (both >12 m): ${realClash} (want 0-ish)`);
if (worst) console.log(`  worst: ${worst}`);

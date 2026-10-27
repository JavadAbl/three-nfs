// ridge_check.ts — numeric sanity check of the roadside ridge BEFORE browser
// verification: road envelope stats, crest heights along the ring (must never
// gap), corridor clearance (field must be 0 within hw+16 of the centreline),
// and tall-over-tall overlap with the interior massifs (the in-game field
// tapers into them via their real closures; here approximated). Run:
//   bun scripts/ridge_check.ts
import * as THREE from "three";
import { ISLAND_POINTS } from "../src/game/maps/island_generated";
import { RIDGE, ridgeFieldFactory } from "../src/game/world/IslandEnvironment";

const hw = 8.5;
const A = 512;
const hMax = 100;

// ── replicate Track's sampling exactly ──
const pts = ISLAND_POINTS.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
const samples = curve.getSpacedPoints(1400);
samples.pop();

// ── per-angle road radius envelope (same algorithm as buildRidge) ──
const roadR = new Float32Array(A).fill(Infinity);
{
  const win = Math.max(1, Math.round((A * 4) / 360));
  for (const sm of samples) {
    const th = Math.atan2(sm.z, sm.x);
    const c = Math.floor((((th + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * A);
    const r = Math.hypot(sm.x, sm.z);
    for (let k = -win; k <= win; k++) {
      const b = (c + k + A) % A;
      if (r < roadR[b]) roadR[b] = r;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const next = Float32Array.from(roadR);
    for (let j = 0; j < A; j++) next[j] = Math.min(roadR[(j - 1 + A) % A], roadR[j], roadR[(j + 1) % A]);
    roadR.set(next);
  }
}
console.log(
  `road radius envelope: ${Math.min(...roadR).toFixed(1)} .. ${Math.max(...roadR).toFixed(1)} m  (finite bins: ${roadR.every(isFinite) ? "all" : "NO"})`,
);

// ── massif height approximation (their real closures are in-game) ──
const massifs = [
  { x: 40, z: -55, r: 275, h: 195 },
  { x: -150, z: -120, r: 165, h: 120 },
  { x: 135, z: 115, r: 130, h: 88 },
];
const massifHeightAt = (x: number, z: number): number => {
  let m = 0;
  for (const ms of massifs) {
    const dm = Math.hypot(x - ms.x, z - ms.z);
    if (dm < ms.r * 1.25) m = Math.max(m, ms.h * Math.pow(Math.max(0, 1 - dm / ms.r), 1.62));
  }
  return m;
};

const factory = ridgeFieldFactory(roadR, hMax, hw, massifHeightAt);
const f = factory.field;

// ── crest profile + gap check along the ring ──
let hMin = Infinity, hMaxSeen = 0;
const profile: string[] = [];
for (let j = 0; j < A; j++) {
  const th = (j / A) * Math.PI * 2;
  const rc = factory.crestR(th);
  const h = f(Math.cos(th) * rc, Math.sin(th) * rc);
  hMin = Math.min(hMin, h);
  hMaxSeen = Math.max(hMaxSeen, h);
  if (j % 4 === 0) profile.push(h > 1 ? "#".repeat(Math.max(1, Math.round(h / 4))) : ".");
}
console.log(`crest height along ring: min ${hMin.toFixed(1)} m, max ${hMaxSeen.toFixed(1)} m (hMax ${hMax})`);
console.log(`crest profile (every 4th bin, 1 char per 4 m) — '#'=hill, '.'=merged-into-massif:`);
console.log(`  ${profile.join("|")}`);

// ── corridor clearance: field must stay low near the road everywhere ──
let worstD = Infinity;
let worstAt = "";
const road = samples.filter((_, i) => i % 8 === 0);
for (let j = 0; j < 720; j++) {
  const th = (j / 720) * Math.PI * 2;
  for (let d = hw + 2; d < hw + 40; d += 2) {
    const r = factory.roadAt(th) - d;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (f(x, z) > 0.25) {
      let best = Infinity;
      for (const p of road) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
      if (best < worstD) {
        worstD = best;
        worstAt = `az ${((th * 180) / Math.PI).toFixed(0)}°`;
      }
      break;
    }
  }
}
console.log(`closest true centreline distance where ridge rises >0.25 m: ${worstD.toFixed(1)} m at ${worstAt} (need > ${hw + 16})`);

// ── tall-over-tall overlap with the massifs (the taper should kill it) ──
let realClash = 0, worst = "", worstProd = 0;
let bandMin = Infinity, bandMax = 0;
for (let j = 0; j < 1440; j++) {
  const th = (j / 1440) * Math.PI * 2;
  const rc = factory.roadAt(th);
  for (let d = hw + RIDGE.toeOff; d < hw + RIDGE.toeOff + RIDGE.flankSea + RIDGE.flankIn + 12; d += 1) {
    const r = rc - d;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    const fh = f(x, z);
    if (fh > 0.5) {
      bandMin = Math.min(bandMin, r);
      bandMax = Math.max(bandMax, r);
    }
    if (fh < 12) continue;
    for (const m of massifs) {
      const dm = Math.hypot(x - m.x, z - m.z);
      if (dm > m.r) continue;
      const mh = m.h * Math.pow(Math.max(0, 1 - dm / m.r), 1.62);
      if (mh > 12 && fh > 12) {
        realClash++;
        const prod = fh * mh;
        if (prod > worstProd) {
          worstProd = prod;
          worst = `az ${(th * 180 / Math.PI).toFixed(0)}° d=${d.toFixed(0)} ridge=${fh.toFixed(0)}m massif=${mh.toFixed(0)}m`;
        }
      }
    }
  }
}
console.log(`visible ridge band radius: ${bandMin.toFixed(0)} .. ${bandMax.toFixed(0)} m`);
console.log(`TALL×TALL overlap samples (both >12 m): ${realClash} (want 0-ish)${worst ? ` — worst: ${worst}` : ""}`);

// ── slope sanity on the seaward face (d increases inward) ──
{
  let maxSlope = 0;
  for (const thS of [0.4, 1.1, 2.3, 3.7, 5.1]) {
    const cD = factory.roadAt(thS) - factory.crestR(thS);
    for (let d = hw + RIDGE.toeOff; d < cD; d += 1) {
      const rOuter = factory.roadAt(thS) - d;
      const rInner = factory.roadAt(thS) - d - 1;
      const hO = f(Math.cos(thS) * rOuter, Math.sin(thS) * rOuter);
      const hI = f(Math.cos(thS) * rInner, Math.sin(thS) * rInner);
      maxSlope = Math.max(maxSlope, hI - hO);
    }
  }
  console.log(`seaward face max slope sample: ${((Math.atan(maxSlope) * 180) / Math.PI).toFixed(0)}° (target 45-60°)`);
}
console.log("ridge_check done");

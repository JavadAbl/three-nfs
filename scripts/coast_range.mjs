// Coastal massif planner — finds the best azimuth slots for headland massifs
// between the road's outer edge and the shoreline, then picks crest-ragged
// seeds (same scoring idea as seed_score.mjs) and emits TS-ready defs.
//
//   node scripts/coast_range.mjs
import { readFileSync } from "node:fs";

const SRC = "/home/z/my-project/src/game/maps/island_generated.ts";
const HW = 8; // road half width (GAME_CONFIG.ROAD_HALF_WIDTH)
const MARGIN = 10; // spline can bulge past control points

const txt = readFileSync(SRC, "utf8");

// ── extract ISLAND_POINTS ────────────────────────────────────────────────────
const ptsBlock = txt.match(/ISLAND_POINTS[^=]*=\s*\[([\s\S]*?)\];/)[1];
const nums = [];
for (const m of ptsBlock.matchAll(/\[([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\]/g))
  nums.push([+m[1], +m[2], +m[3]]);

// polar or cartesian? polar [r, ?, azDeg] keeps element 0 positive
const polar = Math.min(...nums.map((p) => p[0])) > 0 && Math.min(...nums.map((p) => p[2])) >= 0;
const road = polar
  ? nums.map(([r, , az]) => ({ x: r * Math.cos((az * Math.PI) / 180), z: r * Math.sin((az * Math.PI) / 180) }))
  : nums.map(([x, , z]) => ({ x, z }));
console.log(
  `${road.length} road control points — ${polar ? "polar [r,·,az°]" : "cartesian [x,y,z]"},` +
    ` r ${Math.round(Math.min(...road.map((p) => Math.hypot(p.x, p.z))))}..${Math.round(
      Math.max(...road.map((p) => Math.hypot(p.x, p.z))),
    )}`,
);

// ── extract ISLAND_TERRAIN heights grid ──────────────────────────────────────
const ter = txt.match(/ISLAND_TERRAIN = \{ half: (\d+), cell: (\d+), heights: \[([\s\S]*?)\] \}/);
const half = +ter[1], cell = +ter[2];
const H = ter[3].split(",").map(Number);
const side = (2 * half) / cell + 1;
console.log(`terrain grid ${side}x${side} (half ${half}, cell ${cell}) — ${H.length} nodes`);
const th = (x, z) => {
  const c = Math.max(0, Math.min(side - 1, Math.round((x + half) / cell)));
  const r = Math.max(0, Math.min(side - 1, Math.round((z + half) / cell)));
  return H[r * side + c];
};

// densify the control polygon (23 points is too sparse for a 10° window)
const dense = [];
for (let i = 0; i < road.length; i++) {
  const a = road[i], b = road[(i + 1) % road.length];
  for (let k = 0; k < 8; k++) {
    const t = k / 8;
    dense.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
}

// ── per-azimuth analysis (72 bins of 5°) ─────────────────────────────────────
const BINS = 72;
const azOf = (x, z) => ((Math.atan2(z, x) * 180) / Math.PI + 360) % 360;
const bins = [];
for (let b = 0; b < BINS; b++) {
  const az = b * 5;
  let roadOut = 0;
  for (const p of dense) {
    const d = Math.abs(((azOf(p.x, p.z) - az + 540) % 360) - 180);
    if (d <= 10) roadOut = Math.max(roadOut, Math.hypot(p.x, p.z));
  }
  // waterline: march the ray outward until terrain dips below sea level
  let water = null;
  for (let r = 360; r < half - 4; r += 4) {
    if (th(r * Math.cos((az * Math.PI) / 180), r * Math.sin((az * Math.PI) / 180)) < -0.15) {
      water = r;
      break;
    }
  }
  bins.push({ az, roadOut, water, gap: water === null ? 0 : water - (roadOut + HW) });
}
const gapOK = bins.filter((b) => b.water !== null);
console.log(
  `waterline r ${Math.round(Math.min(...gapOK.map((b) => b.water)))}..${Math.round(
    Math.max(...gapOK.map((b) => b.water)),
  )}, gap ${Math.round(Math.min(...gapOK.map((b) => b.gap)))}..${Math.round(Math.max(...gapOK.map((b) => b.gap)))} m`,
);

// ── slot pick: 7 ideals evenly spaced, each takes the widest viable bin
// within ±25° — a balanced headland ring with open-sea gaps where the road
// hugs the shore ────────────────────────────────────────────────────────────
const N_SLOTS = 7;
const picked = [];
for (let s = 0; s < N_SLOTS; s++) {
  const ideal = (s * 360) / N_SLOTS + 13; // 13° offset dodges az-0 seam artefacts
  let best = null;
  for (const b of gapOK) {
    const d = Math.abs(((b.az - ideal + 540) % 360) - 180);
    if (d <= 25 && b.gap >= 80 && (!best || b.gap > best.gap)) best = b;
  }
  if (best) picked.push(best);
}
picked.sort((a, b) => a.az - b.az);

// ── massif seed scoring (mirrors IslandEnvironment.massifField) ─────────────
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function h2(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return (
    h2(xi, zi) * (1 - u) * (1 - v) + h2(xi + 1, zi) * u * (1 - v) +
    h2(xi, zi + 1) * (1 - u) * v + h2(xi + 1, zi + 1) * u * v
  );
}
function ridged(x, z, oct) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * (1 - Math.abs(2 * vnoise(x * f, z * f) - 1));
    norm += amp; amp *= 0.55; f *= 2.13;
  }
  return sum / norm;
}
function massifField(seed, r, h) {
  const rng = makeRng(seed);
  const ph1 = rng() * Math.PI * 2, ph2 = rng() * Math.PI * 2;
  const lobes = 3 + Math.floor(rng() * 3);
  const ns = 3 + Math.floor(rng() * 3);
  const subs = [];
  for (let k = 0; k < ns; k++) {
    const a = rng() * Math.PI * 2, d = r * (0.08 + rng() * 0.45);
    subs.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, hh: 0.35 + rng() * 0.5, s: r * (0.14 + rng() * 0.16) });
  }
  const ridgeF = (2.1 / r) * (0.8 + rng() * 0.5);
  const gullyF = (5.4 / r) * (0.8 + rng() * 0.4);
  return (lx, lz) => {
    let rn = Math.hypot(lx, lz) / r;
    if (rn >= 1.25) return 0;
    const ang = Math.atan2(lz, lx);
    const outline =
      0.82 + 0.15 * Math.sin(ang * lobes + ph1) + 0.08 * Math.sin(ang * (lobes * 2 + 1) + ph2) +
      0.2 * (vnoise(Math.cos(ang) * 3 + seed, Math.sin(ang) * 3) - 0.5);
    rn /= Math.max(0.55, outline);
    if (rn >= 1) return 0;
    const base = Math.pow(1 - rn, 1.62);
    const ridge = 0.42 + 0.58 * ridged(lx * ridgeF + 9.7, lz * ridgeF - 4.3, 4);
    const gully = 0.72 + 0.28 * vnoise(lx * gullyF - 7.7, lz * gullyF + 3.1);
    const chop = ridged(lx * ridgeF * 4.2 - 3.1, lz * ridgeF * 4.2 + 6.6, 2) * 0.14;
    let y = 0.5 * base * ridge * gully + chop * base;
    for (const s of subs) {
      const d2 = ((lx - s.x) ** 2 + (lz - s.z) ** 2) / (s.s * s.s);
      y += s.hh * Math.exp(-d2) * Math.pow(base, 0.3);
    }
    return Math.min(1.18, y) * h;
  };
}
function bestSeeds(r, h, n) {
  const rows = [];
  for (let seed = 500; seed < 700; seed++) {
    const f = massifField(seed, r, h);
    const prof = [];
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      let peak = 0;
      for (let d = 0; d <= r * 1.05; d += r / 60) peak = Math.max(peak, f(Math.cos(a) * d, Math.sin(a) * d));
      prof.push(peak);
    }
    const mean = prof.reduce((s, v) => s + v, 0) / 36;
    rows.push({ seed, ragged: (Math.max(...prof) - Math.min(...prof)) / mean });
  }
  rows.sort((a, b) => b.ragged - a.ragged);
  return rows.slice(0, n);
}

// ── per-slot refinement → defs ───────────────────────────────────────────────
console.log("\naz   roadOut  water  gap |  cx     cz     r    h   seed  ragged");
const defs = [];
for (const b of picked) {
  const azR = (b.az * Math.PI) / 180;
  // try centres from just seaward of the waterline inward until the corridor
  // and terrain-grid constraints both admit a massif of decent size
  let def = null;
  for (const off of [18, 6, -8, -24, -40]) {
    const cR = b.water + off;
    const cx = Math.cos(azR) * cR, cz = Math.sin(azR) * cR;
    const near = Math.min(...road.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    const rCorr = near - HW - 24 - MARGIN; // corridor clearance at scale 1
    const rGrid = (half - 5 - cR) / 1.25; // skirt stays inside the terrain grid
    const r = Math.min(145, b.gap * 0.65, rCorr, rGrid);
    if (r >= 68) {
      const h = Math.round(Math.min(120, Math.max(62, 0.7 * r + 8)));
      def = { az: b.az, cx: Math.round(cx), cz: Math.round(cz), r: Math.round(r), h, seed: 0, ragged: 0 };
      break;
    }
  }
  if (def) {
    // distinct top-N seeds so no two headlands share a silhouette
    const tops = bestSeeds(def.r, def.h, defs.length + 1);
    const used = new Set(defs.map((d) => d.seed));
    const pickSeed = tops.find((t) => !used.has(t.seed)) ?? tops[0];
    def.seed = pickSeed.seed;
    def.ragged = pickSeed.ragged;
    defs.push(def);
    console.log(
      `${String(def.az).padStart(3)}  ${String(Math.round(b.roadOut)).padStart(6)} ${String(b.water).padStart(6)} ` +
        `${String(Math.round(b.gap)).padStart(4)} | ${String(def.cx).padStart(5)} ${String(def.cz).padStart(5)} ` +
        `${String(def.r).padStart(4)} ${String(def.h).padStart(4)}  ${String(def.seed).padStart(4)}  ${(def.ragged * 100).toFixed(0)}%`,
    );
  }
}

console.log(`\n// ${defs.length} coastal headland defs — paste into buildMountains()`);
console.log("const coastDefs: { x: number; z: number; r: number; h: number }[] = [");
for (const d of defs) console.log(`  { x: ${d.cx}, z: ${d.cz}, r: ${d.r}, h: ${d.h} }, // az ${d.az}°`);
console.log("];");
console.log(`const coastSeeds = [${defs.map((d) => d.seed).join(", ")}];`);

// ─── Island map generator — bakes island_generated.ts ────────────────────────
// Produces ISLAND_POINTS (closed road loop with elevation sampled off the
// analytic island surface) + ISLAND_TERRAIN (BaseTerrainSpec grid for
// Track.terrainHeightAt) + ISLAND_GROUND_EXTENT + ISLAND constants.
//
// Design (single source of truth for the island's shape):
//  - rolling dune plateau ~1.7-4 m with two-octave seeded value noise
//  - a 15 m headland under the inner-cut kink (θ≈120°) — the road crests it
//  - an 8 m knoll out west for horizon interest away from the corridor
//  - smoothstep beach ring: land melts to −1.5 m by r=700 (waterline ~r 630)
//  - sea floor continues to −5.5 m by r=880; water plane sits at y = 0
//
// Road = angle/radius table around origin (start/finish at θ=0, r=495),
// elevation = terrain(x,z) + 0.25 clamped ≥ 1.4 (never on the beach).
// Everything is deterministic (seeded) — regenerate = identical output.
import { writeFileSync } from "node:fs";
import * as THREE from "three";

// ── seeded value noise (2D lattice + smoothstep bilinear, 2 octaves) ─────────
function makeNoise(seed) {
  // LCG → float [0,1); lattice hashed per (i,j)
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const hash = new Map();
  const lat = (i, j) => {
    const k = `${i},${j}`;
    let v = hash.get(k);
    if (v === undefined) {
      v = rnd();
      hash.set(k, v);
    }
    return v;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const tx = smooth(x - ix), ty = smooth(y - iy);
    const a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
}
const n1 = makeNoise(7101);
const n2 = makeNoise(7102);
const dunes = (x, z) =>
  (n1(x / 95, z / 95) - 0.5) * 2.6 + (n2(x / 38, z / 38) - 0.5) * 1.1;

// gaussian bump
const gauss = (x, z, cx, cz, r) => {
  const d2 = (x - cx) ** 2 + (z - cz) ** 2;
  return Math.exp(-d2 / (2 * r * r));
};
const HEADLAND = { x: -205, z: 355, r: 150, h: 14.5 }; // under the θ≈120° kink
const KNOLL = { x: -430, z: -260, r: 120, h: 7.5 }; // off-corridor west hill

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** island height in metres at world (x, z) — the analytic surface */
export function islandHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 1.7 + dunes(x, z);
  h += HEADLAND.h * gauss(x, z, HEADLAND.x, HEADLAND.z, HEADLAND.r);
  h += KNOLL.h * gauss(x, z, KNOLL.x, KNOLL.z, KNOLL.r);
  // beach ring: land melts to just-under-water by r=700
  const shore = smoothstep(600, 700, r);
  h = h * (1 - shore) + (-1.6) * shore;
  // sea floor down to -5.5 by r=880 (grid edge 900)
  const floor = smoothstep(700, 880, r);
  h = h * (1 - floor) + (-5.5) * floor;
  return h;
}

// ── road: angle/radius table (degrees, metres) — CCW around origin ───────────
const ROAD = [
  [0, 495], [14, 505], [30, 540], [48, 555], [66, 545], [84, 510],
  [100, 470], [112, 430], [124, 400], [136, 435], [152, 480], [168, 555],
  [190, 570], [214, 560], [236, 525], [250, 470], [258, 430], [266, 460],
  [276, 500], [290, 540], [310, 555], [330, 545], [348, 500],
].map(([deg, r]) => {
  const t = (deg * Math.PI) / 180;
  const x = r * Math.cos(t);
  const z = r * Math.sin(t);
  const y = Math.max(islandHeight(x, z) + 0.25, 1.4);
  return [x, y, z];
});
// start/finish control point appended (loop closes itself)
ROAD.push([...ROAD[0]]);

// ── validate against the game's exact spline (CatmullRomCurve3 closed) ─────
const curve = new THREE.CatmullRomCurve3(
  ROAD.slice(0, -1).map((p) => new THREE.Vector3(p[0], p[1], p[2])),
  true,
  "catmullrom",
  0.5,
);
const N = 1600;
const pts = curve.getSpacedPoints(N);
let len = 0, maxGrade = 0, minR = Infinity, maxR = 0, minY = Infinity;
const radii = pts.map((p) => Math.hypot(p.x, p.z));
for (let i = 0; i < N; i++) {
  const a = pts[i], b = pts[(i + 1) % N];
  len += a.distanceTo(b);
  maxR = Math.max(maxR, radii[i]);
  minR = Math.min(minR, radii[i]);
  minY = Math.min(minY, a.y);
  const t = (i + 2) % N;
  const seg = a.distanceTo(pts[(i + 1) % N]);
  const d = b.distanceTo(pts[t]);
  if (d > 0.5) maxGrade = Math.max(maxGrade, Math.abs(b.y - a.y) / seg);
}
// curvature radius at every sample (angle between tangents over arc)
let minCorner = Infinity;
for (let i = 4; i < N - 4; i++) {
  const t1 = pts[i].clone().sub(pts[i - 4]);
  const t2 = pts[i + 4].clone().sub(pts[i]);
  const ang = t1.angleTo(t2);
  const arc = (t1.length() + t2.length()) / 2;
  minCorner = Math.min(minCorner, arc / ang);
}
console.log(`lap ${((len / 1000) * (N / (N + 1))).toFixed(2)} km | maxGrade ${(maxGrade * 100).toFixed(1)}% | tightest corner ${minCorner.toFixed(0)} m | r ${minR.toFixed(0)}..${maxR.toFixed(0)} | minY ${minY.toFixed(1)}`);
if (maxGrade > 0.1) throw new Error("grade too steep for the arcade physics");
if (minCorner < 22) throw new Error("corner too tight — widen the table");
if (maxR > 585) throw new Error("road edge closer than 7 m to the beach ring");

// ── bake the terrain grid (BaseTerrainSpec: half 900, cell 12 → 151×151) ────
const HALF = 900, CELL = 12;
const n = Math.round((HALF * 2) / CELL) + 1;
const heights = new Array(n * n);
for (let iz = 0; iz < n; iz++) {
  for (let ix = 0; ix < n; ix++) {
    const x = -HALF + ix * CELL;
    const z = -HALF + iz * CELL;
    heights[iz * n + ix] = Math.round(islandHeight(x, z) * 10) / 10;
  }
}

// ── emit src/game/maps/island_generated.ts ───────────────────────────────────
const ptsTxt = ROAD.slice(0, -1)
  .map((p) => `  [${p[0].toFixed(1)}, ${p[1].toFixed(1)}, ${p[2].toFixed(1)}],`)
  .join("\n");
const hTxt = heights.map((h) => h.toFixed(1)).join(",");
const out = `// ─── ISLAND COASTAL — generated by scripts/island_gen.mjs (do not hand-edit)
// Island surface: seeded two-octave dune noise over a 1.7 m plateau, a 14.5 m
// headland under the θ≈120° inner-cut kink (the crest the road climbs), an
// off-corridor western knoll, a smoothstep beach ring melting to −1.6 m by
// r=700 (waterline ≈ r 630, water plane at y=0) and a −5.5 m sea floor by
// r=880. Road elevation sampled off the same surface (+0.25, clamped ≥ 1.4)
// so the embankment blend in Track.terrainHeightAt is always gentle.
// Regenerate: node scripts/island_gen.mjs — deterministic (LCG seeds 7101/02).
export const ISLAND_POINTS: [number, number, number][] = [
${ptsTxt}
];

/** BaseTerrainSpec grid — row-major, z from -900 (row 0), x fastest */
export const ISLAND_TERRAIN = { half: ${HALF}, cell: ${CELL}, heights: [${hTxt}] };

/** ground plane size (matches the terrain grid bounds) */
export const ISLAND_GROUND_EXTENT = ${HALF * 2};

/** analytic island height — shared with IslandEnvironment for prop planting */
export const ISLAND_SURFACE = { headland: [${HEADLAND.x}, ${HEADLAND.h}, ${HEADLAND.z}, ${HEADLAND.r}], knoll: [${KNOLL.x}, ${KNOLL.h}, ${KNOLL.z}, ${KNOLL.r}], waterline: 630 } as const;
`;
writeFileSync(new URL("../src/game/maps/island_generated.ts", import.meta.url).pathname, out);
console.log(`wrote src/game/maps/island_generated.ts (${(out.length / 1024).toFixed(0)} KB, ${n}×${n} grid)`);

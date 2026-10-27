// ─── Island: animated sea, palms, rocks, mountains, flora, buoys ────────────
// The ISLAND COVE map's world. Replaces the city grid entirely (selected via
// EnvThemeSpec.island): the baked dune terrain (island_generated.ts) IS the
// land, and this module dresses it —
//   water: one big subdivided plane with a custom ShaderMaterial — vertex
//     wave bob, two scrolling octaves of the seamless baked wave-normal
//     texture, a CPU-baked shore-depth map (shallow sand-aqua → deep teal +
//     an animated foam line at the waterline), fresnel sky blend, and a
//     two-lobe sun specular: a tight pow-260 disc with per-cell sparkle hash
//     (sun glitter riding the crests) over a broad pow-24 streak.
//   mountains: heightfield massifs (v2) — a radial-disc mesh displaced by a
//     deterministic field (irregular outline + concave pow-1.62 flanks +
//     ridged fbm arêtes + seeded sub-summit bumps + gully octaves), so the
//     skyline reads as a broken mountain RANGE instead of the old displaced
//     cones that read as pyramids/buildings. Summits ride ~200 m on a ~900 m
//     island; altitude+slope vertex bands (lush skirt → rock cliffs → pale
//     crest) multiply the ambientCG Rock063 scan. The same field closure
//     that builds each mesh also stands the conifer groves on its surface,
//     and greener clones of the generator build the horizon islets.
//   ridge: ONE long hill alongside the road — a continuous heightfield ring
//     swept along the loop's inner side (polar grid that tracks the per-angle
//     road radius). Steep green face right off the shoulder, gentler inner
//     shoulder down to the meadow, undulating crest height with saddle
//     passes; grove anchors strung along the crest grow the conifer woods.
//   flora: palms (bent trunks, droop fronds, coconuts) plus three more
//     instanced species for density — conifer GROVES gaussian-clumped on the
//     massif slopes, lowland ferns and shrubs, grass tufts ringing the
//     corridor.
//   rocks: displaced flat-shaded icosahedra, half-buried along the shore,
//     dressed with the ambientCG Rock057 1K scan (warm layered sandstone).
//   meadow: a terrain-conforming moss drape (ambientCG Moss003 1K — dark
//     forest-floor ground cover) over the interior plateau, so the island
//     reads sand → moss → rock as it climbs toward the peaks.
//   scans: all five ambientCG CC0 1K sets (Rock057/063, Bark013, Moss003/004)
//     live in public/textures/props/<name>/ (color sRGB + GL normal + rough).
//   buoys: little channel markers bobbing on the SAME wave function the
//     water shader displaces with — they ride the sea, not float above it.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Track } from "./Track";
import type { IslandSpec } from "../maps/registry";
import { SUN_DIR } from "./DaySky";

// ── seeded rng (deterministic islands — same layout every session) ──────────
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** paint a vertex colour attribute onto a geometry (single flat colour) */
function paint(geo: THREE.BufferGeometry, hex: number, jitter = 0, rng?: () => number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const j = jitter && rng ? 1 + (rng() - 0.5) * jitter : 1;
    arr[i * 3] = c.r * j;
    arr[i * 3 + 1] = c.g * j;
    arr[i * 3 + 2] = c.b * j;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

// ── procedural water textures (seamless by construction) ────────────────────

/** wave trains: [integer waves across, integer waves down, amplitude, speedφ] —
 *  integer wavenumbers make sin(2π(nx·u + ny·v)) tile exactly at the canvas
 *  edges, so the normal map repeats with no seam, however it's tiled */
const WAVE_TRAIN: [number, number, number, number][] = [
  [1, 0, 1.0, 0.0],
  [0, 1, 0.85, 1.7],
  [2, 1, 0.5, 3.1],
  [1, 3, 0.38, 0.6],
  [4, 2, 0.22, 2.4],
  [3, -2, 0.16, 4.9],
  [6, 1, 0.09, 1.2],
];

function waveHeight(x: number, y: number, size: number): number {
  let h = 0;
  for (const [nx, ny, amp, phi] of WAVE_TRAIN) {
    h += amp * Math.sin((2 * Math.PI * (nx * x + ny * y)) / size + phi);
  }
  return h;
}

/** baked wave-normal map: RGB encodes the surface gradient of the summed
 *  wave trains. RepeatWrapping tiles it seamlessly across the sea plane. */
function waterNormalTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const strength = 3.2; // gradient → normal scale
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = waveHeight((x - 1 + size) % size, y, size);
      const hR = waveHeight((x + 1) % size, y, size);
      const hD = waveHeight(x, (y - 1 + size) % size, size);
      const hU = waveHeight(x, (y + 1) % size, size);
      const nx = -(hR - hL) * strength;
      const ny = -(hU - hD) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** JS mirror of the water shader's vertex displacement — buoys ride exactly
 *  the sea the player sees (same trains, same speeds). */
function waveY(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.11 + z * 0.06 + t * 0.8) * 0.16 +
    Math.sin(-x * 0.05 + z * 0.14 + t * 1.15) * 0.11 +
    Math.sin(x * 0.021 - z * 0.026 + t * 0.45) * 0.1
  );
}

/** CPU-baked shore map over the island's footprint: R = foam band at the
 *  waterline (1 at h=0, gone by 0.5 m depth), G = shallow factor (1 at the
 *  shore, 0 past 7 m depth) — the fragment shader mixes deep-teal → sand-aqua
 *  with it, so the tropical shelf glows around the island. */
function shoreTexture(track: Track, extent = 820, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const foam = new Float32Array(size * size);
  const shal = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // canvas y maps to -z (plane UV convention: north = +z row last)
      const x = (px / size - 0.5) * 2 * extent;
      const z = ((size - 1 - py) / size - 0.5) * 2 * extent;
      const h = track.terrainHeightAt(x, z);
      const depth = -h; // waterLevel is 0
      foam[py * size + px] = depth <= 0 ? 1 : Math.max(0, 1 - depth / 0.7);
      shal[py * size + px] = depth <= 0.15 ? 1 : Math.max(0, 1 - (depth - 0.15) / 6.85);
    }
  }
  // box blur the masks: the raw heightfield samples are per-pixel hard —
  // 3 m of blur turns the foam band from a staircase into a soft surf line
  const blur = (src: Float32Array, r: number): Float32Array => {
    const tmp = new Float32Array(src.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0;
        let n = 0;
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(size - 1, Math.max(0, x + dx));
          s += src[y * size + xx];
          n++;
        }
        tmp[y * size + x] = s / n;
      }
    }
    const out = new Float32Array(src.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -r; dy <= r; dy++) {
          const yy = Math.min(size - 1, Math.max(0, y + dy));
          s += tmp[yy * size + x];
          n++;
        }
        out[y * size + x] = s / n;
      }
    }
    return out;
  };
  const foamB = blur(foam, 3);
  const shalB = blur(shal, 2);
  for (let i = 0; i < size * size; i++) {
    img.data[i * 4] = Math.round(Math.min(1, foamB[i]) * 255);
    img.data[i * 4 + 1] = Math.round(Math.min(1, shalB[i]) * 255);
    img.data[i * 4 + 2] = 0;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ── mountain prototypes ────────────────────────────────────────────────────

/** stable 2-float hash (no RNG call order dependence — cone seam vertices
 *  that share a position must displace identically or the mesh splits) */
function h2(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** deterministic 2-D value noise on the h2 lattice (quintic-ish smooth) */
function vnoise(x: number, z: number): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = h2(xi, zi), b = h2(xi + 1, zi), c = h2(xi, zi + 1), d = h2(xi + 1, zi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** ridged fbm — crests where |noise-0.5| folds, arêtes + sub-ridges. 0..1 */
function ridged(x: number, z: number, octaves: number): number {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (1 - Math.abs(2 * vnoise(x * f, z * f) - 1));
    norm += amp;
    amp *= 0.55;
    f *= 2.13;
  }
  return sum / norm;
}

/** a massif's height field: (local x,z) → metres above its base. The SAME
 *  closure builds the mesh AND places trees on the surface, so geometry and
 *  placement can never disagree. Deterministic per (seed, r, h) —
 *    · irregular outline: radial noise on the boundary (no disc silhouette)
 *    · concave flanks: pow(1-rn, 1.62) profile — steep shoulders, flared skirt
 *    · ridged fbm rides the profile for arêtes and broken skylines
 *    · 2-4 seeded sub-summit bumps → a range, never a lone pyramid
 *    · a slower octave carves gully channels down the flanks            */
function massifField(seed: number, r: number, h: number): (lx: number, lz: number) => number {
  const rng = makeRng(seed);
  const ph1 = rng() * Math.PI * 2;
  const ph2 = rng() * Math.PI * 2;
  const lobes = 3 + Math.floor(rng() * 3); // 3-5 silhouette lobes
  const ns = 3 + Math.floor(rng() * 3); // 3-5 sub-summits
  const subs: { x: number; z: number; hh: number; s: number }[] = [];
  for (let k = 0; k < ns; k++) {
    const a = rng() * Math.PI * 2;
    const d = r * (0.08 + rng() * 0.45);
    subs.push({
      x: Math.cos(a) * d,
      z: Math.sin(a) * d,
      hh: 0.35 + rng() * 0.5,
      s: r * (0.14 + rng() * 0.16),
    });
  }
  const ridgeF = (2.1 / r) * (0.8 + rng() * 0.5); // ridge wavelength ~ r/2
  const gullyF = (5.4 / r) * (0.8 + rng() * 0.4);
  return (lx: number, lz: number) => {
    let rn = Math.hypot(lx, lz) / r;
    if (rn >= 1.25) return 0;
    const ang = Math.atan2(lz, lx);
    // irregular outline — the boundary radius itself is noisy (±25%), killing
    // the perfect-circle "cone" silhouette that read as a pyramid/building
    const outline =
      0.82 +
      0.15 * Math.sin(ang * lobes + ph1) +
      0.08 * Math.sin(ang * (lobes * 2 + 1) + ph2) +
      0.2 * (vnoise(Math.cos(ang) * 3 + seed, Math.sin(ang) * 3) - 0.5);
    rn /= Math.max(0.55, outline);
    if (rn >= 1) return 0;
    const base = Math.pow(1 - rn, 1.62); // concave flanks
    const ridge = 0.42 + 0.58 * ridged(lx * ridgeF + 9.7, lz * ridgeF - 4.3, 4);
    const gully = 0.72 + 0.28 * vnoise(lx * gullyF - 7.7, lz * gullyF + 3.1);
    // craggy crest — a fast octave chops the top so the skyline stays broken
    const chop = ridged(lx * ridgeF * 4.2 - 3.1, lz * ridgeF * 4.2 + 6.6, 2) * 0.14;
    let y = 0.5 * base * ridge * gully + chop * base;
    for (const s of subs) {
      const d2 = ((lx - s.x) * (lx - s.x) + (lz - s.z) * (lz - s.z)) / (s.s * s.s);
      y += s.hh * Math.exp(-d2) * Math.pow(base, 0.3);
    }
    return Math.min(1.18, y) * h;
  };
}

/** one massif as a radial-disc heightfield mesh (rings × segments). Faces are
 *  split into two geometry groups by the forest line — group 0 (the green
 *  flanks below the treeline, gentle slopes) is meant to pair with the bright
 *  Moss004 canopy scan, group 1 (cliffs + upper shoulders) with Rock063 —
 *  because a single grey rock scan × any vertex tint can never read as
 *  forest. Vertex colours carry the altitude band variation within each. */
function peakGeometry(seed: number, r: number, h: number): THREE.BufferGeometry {
  const field = massifField(seed, r, h);
  const segs = 96, rings = 40;
  const pos: number[] = [];
  const cols: number[] = [];
  const mid = new THREE.Color(0x8a8272);
  const crest = new THREE.Color(0xa79d8b);

  /** per-vertex [r,g,b,rockiness] — rockiness drives BOTH the face grouping
   *  and the rock band's internal altitude blend */
  const vertAt = (x: number, y: number, z: number) => {
    const e = r * 0.012;
    const gx = (field(x + e, z) - field(x - e, z)) / (2 * e);
    const gz = (field(x, z + e) - field(x, z - e)) / (2 * e);
    const slope = Math.hypot(gx, gz);
    const ty = Math.min(1, Math.max(0, y / h));
    // forest line: lower ~2/3 of the flank counts as woodland unless the
    // face is a cliff (slope > 0.7); above it, bare rock all the way
    const rock = Math.min(1, ty / 0.6 + Math.max(0, slope - 0.7) * 1.8);
    let c: THREE.Color;
    if (rock < 0.55) {
      // canopy band — near-white so the bright moss scan shows its own green
      const j = 0.82 + h2(Math.round(x * 3), Math.round(z * 3)) * 0.22;
      c = new THREE.Color(0.92 * j, 1.0 * j, 0.86 * j);
    } else {
      c = mid.clone().lerp(crest, Math.min(1, (rock - 0.55) * 1.2 + ty * 0.35));
      const j = 0.9 + h2(Math.round(x * 3), Math.round(z * 3)) * 0.2;
      c.multiplyScalar(j);
    }
    return [c.r, c.g, c.b, rock];
  };

  // one pass builds positions + the colour/rockiness records
  const verts: number[][] = [];
  {
    const y0 = field(0, 0);
    pos.push(0, y0, 0);
    verts.push(vertAt(0, y0, 0));
    for (let i = 0; i < rings; i++) {
      const rn = (i + 1) / rings;
      const rr = rn * r;
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        const y = field(x, z);
        pos.push(x, y, z);
        verts.push(vertAt(x, y, z));
      }
    }
    verts.forEach((v) => cols.push(v[0], v[1], v[2]));
  }

  // faces as tagged triples (centre fan then ring quads, CCW from +Y)
  type Face = [number, number, number, boolean];
  const faces: Face[] = [];
  for (let j = 0; j < segs; j++)
    faces.push([0, 1 + ((j + 1) % segs), 1 + j, false]);
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = 1 + i * segs + j;
      const b = 1 + i * segs + ((j + 1) % segs);
      const c = 1 + (i + 1) * segs + j;
      const d = 1 + (i + 1) * segs + ((j + 1) % segs);
      faces.push([a, b, c, false]);
      faces.push([b, d, c, false]);
    }
  }
  // classify each face by the mean rockiness of its corners
  for (const f of faces) {
    const rk = (verts[f[0]][3] + verts[f[1]][3] + verts[f[2]][3]) / 3;
    f[3] = rk >= 0.55;
  }
  // stable partition: green faces first, then rock faces
  const green = faces.filter((f) => !f[3]);
  const rock = faces.filter((f) => f[3]);
  const idx: number[] = [];
  for (const f of green) idx.push(f[0], f[1], f[2]);
  const nGreen = idx.length;
  for (const f of rock) idx.push(f[0], f[1], f[2]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.addGroup(0, nGreen, 0); // green flanks → moss/canopy material
  geo.addGroup(nGreen, idx.length - nGreen, 1); // rock cliffs → rock material
  geo.computeVertexNormals();
  return geo;
}

/** a mountain massif: one heightfield (the sub-summits live INSIDE the field,
 *  so the skyline breaks naturally instead of a merged-cone look). */
function mountainPrototype(seed: number, baseR: number, height: number): THREE.BufferGeometry {
  return peakGeometry(seed, baseR, height);
}

// ── the roadside ridge — ONE long hill strung along the road ────────────────

/** shape knobs shared by the field factory and the mesh builder (metres):
 *  the ridge grows out of the ground TOE metres inside the road centreline,
 *  climbs its steep seaward face over FSEA metres to the crest, then runs a
 *  gentler shoulder FIN metres down to the interior meadow. */
export const RIDGE = { toeOff: 22, flankSea: 86, flankIn: 132 };

/** the ridge's height field: (world x,z) → metres above the terrain. Same
 *  geology recipe as the massifs (concave flanks + ridged fbm arêtes + crest
 *  chop) but swept along a ring that parallels the road instead of around a
 *  single summit —
 *    · roadR: per-angle road centreline radius (min envelope, smoothed) —
 *      the whole band adapts to the loop's pinches and bulges, so the hill
 *      can never crowd the corridor
 *    · the crest line wobbles radially (±11 m) so it is never a circle
 *    · the height envelope undulates along the ring: two broad high
 *      stretches, noise, and two seeded passes (saddles) — it reads as ONE
 *      long hill with character, never a lumpy necklace and never a gap */
export function ridgeFieldFactory(
  roadR: Float32Array,
  hMax: number,
  hw: number,
  /** max interior/ coastal massif height at (x,z) — the ridge tapers into
   *  any flank that would match it, so the meshes merge as one geology
   *  instead of slicing each other (their real heightfield closures) */
  massifHeightAt: (x: number, z: number) => number,
): {
  TOE: number;
  FSEA: number;
  FIN: number;
  roadAt: (th: number) => number;
  crestR: (th: number) => number;
  field: (x: number, z: number) => number;
  /** the MESH surface: terrain + field - apron tuck. Tree anchors and the
   *  geometry must share this, or toe-zone trees float above the tucked
   *  apron (mesh surfaces 0-0.5 m below the raw field there). */
  surfaceY: (x: number, z: number, terrainY: number) => number;
} {
  const rng = makeRng(620); // fixed — the ridge must look identical every load
  const phA = rng() * Math.PI * 2;
  const phB = rng() * 10;
  const phC = rng() * 10;
  const passA1 = rng() * Math.PI * 2;
  const passA2 = rng() * Math.PI * 2;
  const passW1 = 0.13 + rng() * 0.05;
  const passW2 = 0.11 + rng() * 0.05;
  const A = roadR.length;
  const TOE = hw + RIDGE.toeOff;
  const { flankSea: FSEA, flankIn: FIN } = RIDGE;

  /** road radius at angle th — linear interp around the ring (seamless) */
  const roadAt = (th: number): number => {
    let u = (((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * A;
    const i0 = Math.floor(u) % A;
    const i1 = (i0 + 1) % A;
    return roadR[i0] + (roadR[i1] - roadR[i0]) * (u - Math.floor(u));
  };
  const wrapDiff = (a: number, b: number): number => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  /** height envelope along the ring: 0.34 (a low pass, still a hill) .. 1 */
  const hEnv = (th: number): number => {
    const broad = 0.66 + 0.34 * Math.sin(th * 2 + phA); // two highs, two lows
    const detail = 0.84 + 0.16 * vnoise(Math.cos(th) * 4.7 + phB, Math.sin(th) * 4.7 + phC);
    const pass =
      1 -
      0.34 * Math.exp(-Math.pow(wrapDiff(th, passA1) / passW1, 2)) -
      0.28 * Math.exp(-Math.pow(wrapDiff(th, passA2) / passW2, 2));
    return Math.max(0.34, broad * detail * pass);
  };
  /** crest-line radius at th (the wobble keeps the crest off a perfect ring) */
  const crestR = (th: number): number => {
    const wob = (vnoise(Math.cos(th) * 2.1 + 7.3, Math.sin(th) * 2.1 - 2.9) - 0.5) * 22;
    return roadAt(th) - (TOE + FSEA + wob);
  };
  const fR = 1 / 140; // arête wavelength ~140 m along the ring
  const fG = 1 / 46; // gully octave
  const field = (x: number, z: number): number => {
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    const d = roadAt(th) - r; // metres inward from the centreline
    if (d <= TOE - 6 || d >= TOE + FSEA + FIN + 12) return 0;
    const cD = roadAt(th) - crestR(th); // the crest's inward offset from the centreline
    let rise: number;
    if (d < cD) {
      const t = (d - (TOE - 6)) / (cD - (TOE - 6));
      if (t <= 0) return 0;
      rise = Math.pow(Math.min(1, t), 1.72); // steep road-side face (35-55°)
    } else {
      const t = (TOE + FSEA + FIN + 12 - d) / (FIN + 12);
      if (t <= 0) return 0;
      rise = Math.pow(Math.min(1, t), 2.05); // long gentler inner shoulder
    }
    const H = hEnv(th);
    let y = rise * H * hMax * (0.5 + 0.5 * ridged(x * fR + 5.1, z * fR - 3.7, 4)) * (0.8 + 0.2 * vnoise(x * fG - 8.8, z * fG + 6.2));
    // craggy crest chop, same idea as the massifs — keeps the skyline broken
    y += rise * H * ridged(x * fR * 4.4 + 1.7, z * fR * 4.4 + 9.9, 2) * 0.13 * hMax;
    // merge with the interior range: where a massif flank is as tall as the
    // ridge would be, the ridge fades into it (reads as one range — and the
    // two heightfield meshes can never slice each other mid-slope)
    const M = massifHeightAt(x, z);
    if (M > 0 && y > 0) y *= Math.max(0, Math.min(1, (y - M) / Math.max(8, 0.5 * y)));
    return y;
  };
  // smooth apron tuck: bury the near-zero skirt up to 0.5 m under the
  // terrain so the ring emerges from the ground with no seam and no fight
  const tuck = (fy: number): number => 0.5 * Math.max(0, 1 - fy / 0.5);
  const surfaceY = (x: number, z: number, terrainY: number): number => terrainY + field(x, z) - tuck(field(x, z));
  return { TOE, FSEA, FIN, roadAt, crestR, field, surfaceY };
}

/** the ridge's cached node grid — the SAME heights the mesh renders, kept
 *  so tree placement can bilinear-sample the RENDERED surface instead of the
 *  analytic field (the chop octave curves faster than any affordable grid
 *  resolves: field-sampled trees stood up to ~1.3 m over the triangles on
 *  arête peaks). Grid-sampled trees touch the rendered ground everywhere. */
interface RidgeGrid {
  A: number;
  R: number;
  dOut: number;
  dIn: number;
  y: Float32Array; // node surface heights, row-major [i * A + j]
}

/** the ridge as ONE closed heightfield mesh: a polar grid around the island
 *  centre (columns = angle, rows = radial offset from the road), so the ring
 *  wraps seamlessly — the seam column is shared via modulo indexing (the
 *  peakGeometry trick) and normals stay continuous. Rows span a small apron
 *  past both zero-lines; the apron tucks 0.5 m UNDER the terrain so the hill
 *  surfaces emerge from the ground with no seam and no z-fight (plus a
 *  polygonOffset material clone, the meadow-drape trick). Faces split into
 *  the same two groups as the massifs: moss canopy below the forest line,
 *  Rock063 cliffs above / on the steepest cuts. */
function ridgeGeometry(
  factory: ReturnType<typeof ridgeFieldFactory>,
  hMax: number,
  hw: number,
  terrain: (x: number, z: number) => number,
): { geo: THREE.BufferGeometry; grid: RidgeGrid } {
  const A = 640; // angular columns — ~4.2 m at the crest ring
  const R = 60; // radial rows — ~4.3 m across the 258 m band
  const TOE = hw + RIDGE.toeOff;
  const { flankSea: FSEA, flankIn: FIN } = RIDGE;
  const dOut = TOE - 10; // apron start, seaward of the zero-line
  const dIn = TOE + FSEA + FIN + 28; // apron end, inboard of the zero-line
  const field = factory.field;
  const hEnvAt = (th: number): number => {
    // local crest height for the forest-line banding: the broad sine alone
    // (passes/noise excluded) — low passes then band fully green, high
    // sectors grow a rocky crown, exactly the reference scrub-hill look
    const broad = 0.66 + 0.34 * Math.sin(th * 2);
    return Math.max(0.34, broad) * hMax;
  };
  const mid = new THREE.Color(0x8a8272);
  const crestC = new THREE.Color(0xa79d8b);
  const verts: number[][] = [];
  const pos: number[] = [];

  const vertAt = (x: number, y: number, z: number, fy: number, hC: number) => {
    const e = 2.4;
    const gx = (field(x + e, z) - field(x - e, z)) / (2 * e);
    const gz = (field(x, z + e) - field(x, z - e)) / (2 * e);
    const slope = Math.hypot(gx, gz);
    const ty = hC > 1 ? Math.min(1, Math.max(0, fy / hC)) : 0;
    // forest line tuned greener than the massifs: the reference hill is
    // mostly scrub-covered, rock only on the steepest cuts and the crown
    const rock = Math.min(1, ty / 0.72 + Math.max(0, slope - 1.15) * 1.9);
    let c: THREE.Color;
    if (rock < 0.55) {
      const j = 0.82 + h2(Math.round(x * 3), Math.round(z * 3)) * 0.22;
      c = new THREE.Color(0.92 * j, 1.0 * j, 0.86 * j);
    } else {
      c = mid.clone().lerp(crestC, Math.min(1, (rock - 0.55) * 1.2 + ty * 0.35));
      const j = 0.9 + h2(Math.round(x * 3), Math.round(z * 3)) * 0.2;
      c.multiplyScalar(j);
    }
    return [c.r, c.g, c.b, rock];
  };

  const grid: RidgeGrid = { A, R, dOut, dIn, y: new Float32Array(A * R) };
  for (let i = 0; i < R; i++) {
    const d = dIn + ((dOut - dIn) * i) / (R - 1); // row 0 = innermost, radii grow outward (peakGeometry winding)
    for (let j = 0; j < A; j++) {
      const th = (j / A) * Math.PI * 2;
      const r = factory.roadAt(th) - d;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const fy = field(x, z);
      const y = factory.surfaceY(x, z, terrain(x, z));
      grid.y[i * A + j] = y;
      pos.push(x, y, z);
      verts.push(vertAt(x, y, z, fy, hEnvAt(th) * 1.35));
    }
  }
  const cols: number[] = [];
  verts.forEach((v) => cols.push(v[0], v[1], v[2]));

  // faces: ring quads with the seam column shared via modulo (normals weld)
  type Face = [number, number, number, boolean];
  const faces: Face[] = [];
  const vIdx = (i: number, j: number) => i * A + (j % A);
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < A; j++) {
      const a = vIdx(i, j);
      const b = vIdx(i, j + 1);
      const c = vIdx(i + 1, j);
      const dd = vIdx(i + 1, j + 1);
      faces.push([a, b, c, false]);
      faces.push([b, dd, c, false]);
    }
  }
  for (const f of faces) {
    const rk = (verts[f[0]][3] + verts[f[1]][3] + verts[f[2]][3]) / 3;
    f[3] = rk >= 0.55;
  }
  const green = faces.filter((f) => !f[3]);
  const rock = faces.filter((f) => f[3]);
  const idx: number[] = [];
  for (const f of green) idx.push(f[0], f[1], f[2]);
  const nGreen = idx.length;
  for (const f of rock) idx.push(f[0], f[1], f[2]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.addGroup(0, nGreen, 0);
  geo.addGroup(nGreen, idx.length - nGreen, 1);
  geo.computeVertexNormals();
  return { geo, grid };
}

// ── flora prototypes (palms live below; these are the understory) ────────────

/** conifer: short trunk + three stacked tapering cones, dark mountain green */
function coniferPrototype(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.06, 0.09, 0.5, 6, 1);
  paint(trunk, 0x5c4630, 0.2, rng);
  trunk.translate(0, 0.25, 0);
  parts.push(trunk);
  const tiers: [number, number, number][] = [
    [0.52, 0.95, 0.55],
    [0.38, 0.85, 1.15],
    [0.22, 0.75, 1.68],
  ];
  for (const [r, h, y] of tiers) {
    const cone = new THREE.ConeGeometry(r, h, 8, 1);
    paint(cone, 0x2f5528, 0.22, rng);
    cone.translate(0, y, 0);
    parts.push(cone);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("conifer merge failed");
  return merged;
}

/** fern: a rosette of short arching fronds (palm-frond droop math, no trunk) */
function fernPrototype(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 8 + Math.floor(rng() * 3);
  for (let k = 0; k < n; k++) {
    const half = new THREE.PlaneGeometry(0.17, 1.15, 1, 6);
    half.translate(0, 1.15 / 2, 0.03);
    const other = half.clone();
    other.translate(0, 0, -0.06);
    const f = mergeGeometries([half, other], false) as THREE.BufferGeometry;
    half.dispose();
    other.dispose();
    const pos = f.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const base = new THREE.Color(0x2f6d2a);
    const tip = new THREE.Color(0x6fb04a);
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 1.15;
      pos.setZ(i, pos.getZ(i) - t * t * (0.55 + rng() * 0.25));
      pos.setX(i, pos.getX(i) * (1 - t * 0.8));
      const c = base.clone().lerp(tip, t);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    f.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    f.computeVertexNormals();
    const m = new THREE.Matrix4().makeRotationY((k / n) * Math.PI * 2 + rng() * 0.5);
    m.multiply(new THREE.Matrix4().makeRotationX(-0.7 - rng() * 0.45));
    f.applyMatrix4(m);
    parts.push(f);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("fern merge failed");
  return merged;
}

/** shrub: 5-7 squashed jittered spheres, deep foliage green */
function shrubPrototype(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = 5 + Math.floor(rng() * 3);
  for (let k = 0; k < n; k++) {
    const r = 0.22 + rng() * 0.3;
    const s = new THREE.SphereGeometry(r, 7, 5);
    const a = rng() * Math.PI * 2;
    const d = rng() * 0.42;
    s.scale(1, 0.62 + rng() * 0.2, 1);
    s.translate(Math.cos(a) * d, r * 0.45 + rng() * 0.15, Math.sin(a) * d);
    paint(s, 0x2f5d2a, 0.3, rng);
    parts.push(s);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("shrub merge failed");
  return merged;
}

/** grass tuft: 12 thin tapered blades fanned out of the ground */
function tuftPrototype(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 12; k++) {
    const blade = new THREE.PlaneGeometry(0.05, 0.5, 1, 2);
    blade.translate(0, 0.25, 0);
    const pos = blade.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / 0.5;
      pos.setX(i, pos.getX(i) * (1 - t * 0.85));
      pos.setZ(i, pos.getZ(i) + t * t * (rng() - 0.5) * 0.22); // lean
    }
    blade.computeVertexNormals();
    paint(blade, 0x6a8f3c, 0.35, rng);
    const m = new THREE.Matrix4().makeRotationY(rng() * Math.PI * 2);
    m.multiply(new THREE.Matrix4().makeRotationX((rng() - 0.5) * 0.5));
    blade.applyMatrix4(m);
    parts.push(blade);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("tuft merge failed");
  return merged;
}

// ── palm prototypes ─────────────────────────────────────────────────────────

/** one drooping frond: TWO planes folded into a shallow V along the spine
 *  (a flat quad reads as a stiff paddle — the fold is what sells a palm),
 *  bent with a smooth droop, tapered, vertex-coloured dark base → bright
 *  tip. Returned geometry is centred on its base joint pointing +Y before
 *  the caller poses it. */
function frondGeometry(rng: () => number): THREE.BufferGeometry {
  const half = new THREE.PlaneGeometry(0.34, 3.3, 1, 12);
  half.translate(0, 3.3 / 2, 0.02); // base at y=0, tip at y=3.3, half-width offset
  const other = half.clone();
  other.translate(0, 0, -0.04); // mirrored half of the V
  const geo = mergeGeometries([half, other], false) as THREE.BufferGeometry;
  half.dispose();
  other.dispose();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const base = new THREE.Color(0x2c6b2f);
  const tip = new THREE.Color(0x55a349);
  const droop = 1.25 + rng() * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 3.3;
    // smooth compound droop (quadratic + shallow S-tip) so the frond curls
    // instead of hinging at one kink
    pos.setZ(i, pos.getZ(i) - t * t * droop - Math.pow(t, 5) * 0.55);
    pos.setX(i, pos.getX(i) * (1 - t * 0.7)); // taper to a point
    // slight sideways wobble — no two fronds share a plane
    pos.setX(i, pos.getX(i) + Math.sin(t * 2.7 + rng() * 0.4) * t * 0.12);
    const c = base.clone().lerp(tip, Math.min(1, t * 1.15));
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  return geo;
}

/** a full palm as ONE merged vertex-coloured geometry (instancing-friendly).
 *  Trunk = stacked tapering cylinder segments (alternating radius = ring
 *  scars) accumulating a lean; crown = two frond rings + coconut cluster. */
function palmPrototype(seed: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const height = 6.2 + rng() * 3.4;
  const segs = 7;
  const lean = (rng() - 0.5) * 0.5; // radians total
  const leanAz = rng() * Math.PI * 2;
  const trunkParts: THREE.BufferGeometry[] = [];
  const crownParts: THREE.BufferGeometry[] = [];
  let y = 0;
  let offset = new THREE.Vector2(0, 0);
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const rBase = 0.26 * (1 - t * 0.42);
    const ring = i % 2 === 0 ? 1.0 : 0.82; // ring scars
    const segLen = height / segs;
    const g = new THREE.CylinderGeometry(rBase * 0.9 * ring, rBase * ring, segLen, 7, 1);
    // near-white: the Bark013 scan supplies the colour, vertex paint only
    // shades (a coloured tint × map would double-darken the bark)
    paint(g, 0xd8cfc0, 0.18, rng);
    // lean: each segment drifts along the lean direction, tilt accumulates
    const dx = Math.cos(leanAz) * Math.sin(lean) * segLen * t;
    const dz = Math.sin(leanAz) * Math.sin(lean) * segLen * t;
    g.translate(dx, y + segLen / 2, dz);
    trunkParts.push(g);
    y += segLen;
    offset.set(dx, dz);
  }
  const crownY = y + 0.15;
  const crown = new THREE.Vector3(offset.x, crownY, offset.y);
  // fronds: two rings — upper ring reaches up-out, lower ring droops hard
  const nF = 11 + Math.floor(rng() * 3);
  for (let k = 0; k < nF; k++) {
    const upper = k % 2 === 0;
    const az = (k / nF) * Math.PI * 2 + rng() * 0.35;
    const f = frondGeometry(rng);
    const tilt = upper ? -0.45 - rng() * 0.2 : -1.05 - rng() * 0.25;
    const m = new THREE.Matrix4();
    m.makeRotationY(az);
    m.multiply(new THREE.Matrix4().makeRotationX(tilt));
    f.applyMatrix4(m);
    f.translate(crown.x, crown.y, crown.z);
    crownParts.push(f);
  }
  // coconut cluster under the crown
  for (let c = 0; c < 3; c++) {
    const g = new THREE.SphereGeometry(0.11, 6, 5);
    paint(g, 0x4c3a20, 0.3, rng);
    const a = rng() * Math.PI * 2;
    const r = 0.14 + rng() * 0.1;
    g.translate(crown.x + Math.cos(a) * r, crown.y - 0.18 - rng() * 0.1, crown.z + Math.sin(a) * r);
    crownParts.push(g);
  }
  // two material groups: trunk (bark scan) vs crown (vertex-coloured fronds)
  // — merged with useGroups so one InstancedMesh carries both materials
  const trunkGeo = mergeGeometries(trunkParts, false) as THREE.BufferGeometry;
  const crownGeo = mergeGeometries(crownParts, false) as THREE.BufferGeometry;
  trunkParts.forEach((p) => p.dispose());
  crownParts.forEach((p) => p.dispose());
  const merged = mergeGeometries([trunkGeo, crownGeo], true);
  trunkGeo.dispose();
  crownGeo.dispose();
  if (!merged) throw new Error("palm merge failed");
  return merged;
}

/** displaced flat-shaded rock (non-indexed so every face is a hard facet) */
function rockPrototype(seed: number, detail = 1): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const g = new THREE.IcosahedronGeometry(1, detail).toNonIndexed();
  const pos = g.attributes.position as THREE.BufferAttribute;
  // consistent displacement per unique position (hash by rounded coords)
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)].map((v) => v.toFixed(3)).join(",");
    let d = seen.get(key);
    if (d === undefined) {
      d = 0.72 + rng() * 0.55;
      seen.set(key, d);
    }
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).multiplyScalar(d);
    // squash into a boulder: flattened y, a hint of a shore-side face
    v.y *= 0.72;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  paint(g, 0x93897b, 0.35, rng);
  return g;
}

/** channel buoy: red band on a white drum + top cone, merged + vertex-coloured */
function buoyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const drum = new THREE.CylinderGeometry(0.34, 0.4, 0.7, 10, 1);
  paint(drum, 0xe8e4dc);
  parts.push(drum);
  const band = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10, 1);
  paint(band, 0xd94f3d);
  band.translate(0, 0.12, 0);
  parts.push(band);
  const cone = new THREE.CylinderGeometry(0.03, 0.2, 0.42, 8, 1);
  paint(cone, 0xd94f3d);
  cone.translate(0, 0.55, 0);
  parts.push(cone);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("buoy merge failed");
  return merged;
}

// ── the island world ────────────────────────────────────────────────────────

export class IslandEnvironment {
  group = new THREE.Group();
  /** the sea shader's uniforms (uTime advances every update) + baked textures */
  private waterUniforms!: Record<string, THREE.IUniform>;
  private textures: THREE.Texture[] = [];
  /** interior + coastal massif records — conifers grow ON their height fields,
   *  so each carries its field closure + base Y (geometry and placement share it) */
  private mountainPeaks: {
    x: number;
    z: number;
    r: number;
    baseY: number;
    field: (lx: number, lz: number) => number;
  }[] = [];
  /** the roadside ridge's height field (world x,z → metres above terrain) —
   *  null while disabled (IslandSpec.roadsideRidge = 0) */
  private ridgeField: ((x: number, z: number) => number) | null = null;
  /** the ridge factory (roadAt for the sampler) + the RENDERED node grid —
   *  grove anchors bilinear-sample the grid so trees stand on the mesh */
  private ridgeFactory: ReturnType<typeof ridgeFieldFactory> | null = null;
  private ridgeGrid: RidgeGrid | null = null;
  /** ridge grove anchors — crest points strung along the ring; their field
   *  returns the WORLD surface y (terrain + ridge), baseY stays 0 */
  private ridgeAnchors: { x: number; z: number; r: number; baseY: number; field: (lx: number, lz: number) => number }[] = [];
  /** shared material PAIR (moss canopy, rock) for interior mountains +
   *  horizon islets — matches peakGeometry's two geometry groups */
  private mtnMats: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | null = null;
  /** buoy state for the per-frame bob */
  private buoys: { x: number; z: number; s: number; spin: number }[] = [];
  private buoyInst: THREE.InstancedMesh | null = null;
  private time = 0;
  private disposed = false;

  constructor(
    private readonly track: Track,
    private readonly spec: IslandSpec,
  ) {
    const rng = makeRng(4242);
    this.group.add(this.makeWater());
    this.buildMountains(rng);
    this.buildRidge();
    this.buildMeadow();
    this.buildPalms(rng);
    this.buildFlora(rng);
    this.buildRocks(rng);
    this.buildIslets(rng);
    this.buildBuoys(rng);
  }

  /** load an ambientCG props PBR trio (color sRGB + GL normal + roughness)
   *  from /textures/props/<dir>/ — registered in this.textures for disposal */
  private loadPbr(dir: string, rx = 1, ry = 1): { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } {
    const L = new THREE.TextureLoader();
    const mk = (suffix: string, srgb: boolean) => {
      const t = L.load(`/textures/props/${dir}/1k-${suffix}.jpg`);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = 4;
      this.textures.push(t);
      return t;
    };
    return { color: mk("color", true), normal: mk("normal", false), rough: mk("rough", false) };
  }

  /** coarse road points for corridor-distance checks (every 8th sample) */
  private roadPoints(): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    const s = this.track.samples;
    for (let i = 0; i < s.length; i += 8) pts.push(s[i].pos);
    return pts;
  }

  /** nearest distance from (x,z) to the road centreline (coarse — placement
   *  granularity only) */
  private corridorDist(x: number, z: number, road: THREE.Vector3[]): number {
    let best = Infinity;
    for (const p of road) {
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /** true when (x,z) sits on a massif's flared skirt (field surface above
   *  ~25 cm) — used to keep scatter props out of the mountains: anything
   *  placed at terrain height there ends up buried inside the heightfield */
  private insideMassif(x: number, z: number, pad = 1.25): boolean {
    for (const pk of this.mountainPeaks) {
      const dx = x - pk.x;
      const dz = z - pk.z;
      const rr = pk.r * pad;
      if (dx * dx + dz * dz < rr * rr && pk.field(dx, dz) > 0.25) return true;
    }
    return false;
  }

  /** true when (x,z) sits on the roadside ridge's surface (> 25 cm above the
   *  terrain) — same burial guard as insideMassif, for the ring hill. A cheap
   *  radial band pre-check keeps calls far from the ring nearly free. */
  private onRidge(x: number, z: number): boolean {
    const f = this.ridgeField;
    if (!f) return false;
    const r = Math.hypot(x, z);
    if (r < 120 || r > 640) return false; // the ridge band spans ~r 210-560
    return f(x, z) > 0.25;
  }

  /** the RENDERED ridge surface height at (x,z): bilinear over the mesh's own
   *  node grid (seam-wrapped in angle, clamped across the band). Falls back
   *  to the raw terrain while no ridge exists. Grove anchors sample THIS so
   *  trees touch the triangles the player sees — field-sampled trees could
   *  float up to ~1.3 m over arête peaks the grid under-resolves. */
  private ridgeSurfaceAt(x: number, z: number): number {
    const grid = this.ridgeGrid;
    const fac = this.ridgeFactory;
    if (!grid || !fac) return this.track.terrainHeightAt(x, z);
    const r = Math.hypot(x, z);
    const th = Math.atan2(z, x);
    let u = ((((th % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * grid.A;
    const j0 = Math.floor(u) % grid.A;
    const j1 = (j0 + 1) % grid.A;
    const fu = u - Math.floor(u);
    const d = fac.roadAt(th) - r; // metres inward from the centreline
    let v = (grid.dIn - d) / (grid.dIn - grid.dOut);
    if (v <= 0 || v >= 1) {
      // outside the band: clamp to the (buried) apron edge ≈ terrain
      v = Math.max(0, Math.min(1, v));
    }
    const vi = v * (grid.R - 1);
    const i0 = Math.floor(vi);
    const i1 = Math.min(grid.R - 1, i0 + 1);
    const fv = vi - i0;
    const y00 = grid.y[i0 * grid.A + j0];
    const y10 = grid.y[i1 * grid.A + j0];
    const y01 = grid.y[i0 * grid.A + j1];
    const y11 = grid.y[i1 * grid.A + j1];
    return (y00 * (1 - fu) + y01 * fu) * (1 - fv) + (y10 * (1 - fu) + y11 * fu) * fv;
  }

  private makeWater(): THREE.Mesh {
    const normalTex = waterNormalTexture();
    normalTex.anisotropy = 4;
    const shoreTex = shoreTexture(this.track);
    this.textures.push(normalTex, shoreTex);
    this.waterUniforms = {
      uTime: { value: 0 },
      uNormal: { value: normalTex },
      uShore: { value: shoreTex },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color(0xfff0d0) },
      uFogColor: { value: new THREE.Color(0xcfe4ee) },
      uFogDensity: { value: 0.0011 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      transparent: true,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWp;
        varying float vWave;
        void main() {
          vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
          float t = uTime;
          float h = sin(dot(wp.xz, vec2(0.11, 0.06)) + t * 0.8) * 0.16
                  + sin(dot(wp.xz, vec2(-0.05, 0.14)) + t * 1.15) * 0.11
                  + sin(dot(wp.xz, vec2(0.021, -0.026)) + t * 0.45) * 0.10;
          wp.y += h;
          vWave = h;
          vWp = wp;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uNormal;
        uniform sampler2D uShore;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        varying vec3 vWp;
        varying float vWave;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
          float t = uTime;
          // two decorrelated normal octaves: fine chop + broad swell
          vec3 nA = texture2D(uNormal, vWp.xz * 0.0021 + vec2(t * 0.010, t * 0.007)).rgb * 2.0 - 1.0;
          vec3 nB = texture2D(uNormal, vWp.xz * 0.00058 - vec2(t * 0.004, t * 0.009)).rgb * 2.0 - 1.0;
          vec3 N = normalize(vec3(nA.xy * 0.62 + nB.xy * 0.5, 1.0));

          // baked shore depth: R = foam band, G = shallow shelf
          vec2 sUv = clamp((vWp.xz + 820.0) / 1640.0, 0.001, 0.999);
          vec2 shore = texture2D(uShore, sUv).rg;

          vec3 deep = vec3(0.016, 0.26, 0.32);
          vec3 shal = vec3(0.24, 0.72, 0.66);
          vec3 col = mix(deep, shal, shore.g);

          // fresnel sky blend — grazing angles mirror the haze
          vec3 V = normalize(cameraPosition - vWp);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          col = mix(col, vec3(0.62, 0.79, 0.92), clamp(fres, 0.0, 1.0) * 0.62);

          // two-lobe sun specular: tight glitter disc + broad streak.
          // sparkle cells are small (2.5 m) and time-quantised fine so the
          // glitter reads as individual glints, not coarse white blocks
          vec3 H = normalize(normalize(uSunDir) + V);
          float ndh = max(dot(N, H), 0.0);
          float sparkle = hash(floor(vWp.xz * 14.0) + floor(t * 12.0));
          col += uSunColor * pow(ndh, 220.0) * (0.35 + sparkle * 1.1) * 1.1;
          col += uSunColor * pow(ndh, 24.0) * 0.10;

          // foam line: blurred baked mask, animated by wave phase + chop —
          // lacy surf, not a hard white border
          float foamN = texture2D(uNormal, vWp.xz * 0.006 + vec2(t * 0.02, t * 0.013)).r - 0.5;
          float band = shore.r * (0.72 + 0.28 * sin(vWp.x * 0.12 + vWp.z * 0.15 + t * 1.6));
          float lace = texture2D(uNormal, vWp.xz * 0.013 - vec2(t * 0.03, t * 0.018)).r - 0.5;
          float fmask = smoothstep(0.38, 0.92, band + (foamN * 0.08 + lace * 0.06) + vWave * 0.3);
          col = mix(col, vec3(0.94, 0.97, 0.97), fmask * 0.78);
          col += vec3(0.05, 0.07, 0.07) * max(vWave, 0.0); // crest shimmer

          // FogExp2 match (Game.ts day rig: 0xcfe4ee @ 0.0011)
          float d = length(cameraPosition - vWp);
          float fogF = 1.0 - exp(-pow(d * uFogDensity, 2.0));
          col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));

          float alpha = mix(0.93, 0.58, shore.g); // shallow shelf: sand shines through
          alpha = max(alpha, fmask * 0.92);
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    const geo = new THREE.PlaneGeometry(5200, 5200, 220, 220);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = this.spec.waterLevel;
    mesh.renderOrder = 1; // draw after the opaque terrain so blending sorts
    return mesh;
  }

  /** central mountain range in the island interior + a coastal headland ring
   *  along the waterline. v2: heightfield massifs ~3× the old cones (summits
   *  ~200 m), clustered as one range. If a flank would crowd the corridor the
   *  def shrinks until it clears (never skipped, never swallows the road). */
  private buildMountains(rng: () => number): void {
    // r/h picked for drama: the main massif's summit rides ~200 m over a
    // ~900 m island — a proper volcanic-island skyline, not a speed bump
    const defs: { x: number; z: number; r: number; h: number }[] = [
      { x: 40, z: -55, r: 275, h: 195 }, // dominant massif — the skyline maker
      { x: -150, z: -120, r: 165, h: 120 }, // western shoulder
      { x: 135, z: 115, r: 130, h: 88 }, // eastern knuckle
    ];
    // seeds picked by scripts/seed_score.mjs — crest raggedness + peak count
    // (579: 112% ragged, 3 summits · 546: 93%, 3 · 544: 120%, one crag) so no
    // massif reads as a smooth lone cone
    const seeds = [579, 546, 544];
    // coastal headland ring — the mountains continue down to the sea. Slots
    // picked by scripts/coast_range.mjs: 7 azimuths evenly spaced around the
    // island, each refined against the road corridor (≥ 24 m clear at scale
    // 1) and the terrain grid, with distinct crest-ragged seeds so no two
    // headlands share a silhouette. Centres ride the waterline, so the
    // seaward flanks drop straight into the surf as cliffs.
    const coastDefs: { x: number; z: number; r: number; h: number }[] = [
      { x: 686, z: 0, r: 105, h: 82 }, // az 0°
      { x: 59, z: 675, r: 88, h: 69 }, // az 85°
      { x: -347, z: 601, r: 145, h: 110 }, // az 120° — with az 145 forms a cliff wall
      { x: -562, z: 393, r: 112, h: 87 }, // az 145°
      { x: -389, z: -555, r: 80, h: 64 }, // az 235°
      { x: -178, z: -663, r: 116, h: 89 }, // az 255°
      { x: 651, z: -174, r: 82, h: 65 }, // az 345°
    ];
    const coastSeeds = [544, 579, 626, 542, 538, 685, 527];
    const road = this.roadPoints();
    const hw = this.track.halfWidth;
    // massif material PAIR (geometry groups split each mesh at the forest
    // line): [0] green flanks → ambientCG Moss004 (bright canopy — a grey
    // rock scan × any tint could never read as forest), [1] cliffs + upper
    // shoulders → ambientCG Rock063 (grey fractured boulders). Vertex
    // colours carry the band variation inside each group.
    const moss = this.loadPbr("moss004", 3, 3);
    const rock = this.loadPbr("rock063", 3, 2);
    const mats: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] = [
      new THREE.MeshStandardMaterial({
        map: moss.color,
        normalMap: moss.normal,
        roughnessMap: moss.rough,
        normalScale: new THREE.Vector2(0.7, 0.7),
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      }),
      new THREE.MeshStandardMaterial({
        map: rock.color,
        normalMap: rock.normal,
        roughnessMap: rock.rough,
        normalScale: new THREE.Vector2(0.9, 0.9),
        vertexColors: true,
        roughness: 1,
        metalness: 0,
        flatShading: true,
      }),
    ];
    this.mtnMats = mats;
    // interior range + coastal ring share one build path (same shrink guard,
    // same material pair, same grove system via mountainPeaks)
    const all: { x: number; z: number; r: number; h: number; seed: number }[] = [];
    for (let i = 0; i < Math.min(defs.length, this.spec.mountains); i++)
      all.push({ ...defs[i], seed: seeds[i] });
    for (let i = 0; i < Math.min(coastDefs.length, this.spec.coastMountains); i++)
      all.push({ ...coastDefs[i], seed: coastSeeds[i] });
    for (const d of all) {
      // adaptive shrink: clear the corridor by 24 m or scale down until it
      // does (the field's flared skirt makes a near miss harmless anyway)
      let scale = 1;
      while (
        scale > 0.5 &&
        this.corridorDist(d.x, d.z, road) < hw + d.r * scale + 24
      )
        scale *= 0.94;
      const r = d.r * scale;
      const h = d.h * scale;
      const field = massifField(d.seed, r, h);
      const geo = peakGeometry(d.seed, r, h);
      const m = new THREE.Mesh(geo, mats);
      const baseY = this.track.terrainHeightAt(d.x, d.z) - 1.5;
      m.position.set(d.x, baseY, d.z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      this.mountainPeaks.push({ x: d.x, z: d.z, r, baseY, field });
    }
    void rng; // massif seeds are fixed — the range must look identical every load
  }

  /** ONE long hill alongside the road: a continuous forested ridge strung
   *  along the inner side of the loop for the whole lap (the coastal-road
   *  reference look — steep green hillside right off the shoulder, sea across
   *  the other side). The band tracks the per-angle road radius, so it hugs
   *  the road through every pinch and bulge while keeping a fixed toe
   *  margin; the height envelope undulates along the ring (never gaps —
   *  saddles only dip to ~1/3) so it reads as a single hill, not beads. */
  private buildRidge(): void {
    const hMax = this.spec.roadsideRidge;
    if (!(hMax > 0)) return;
    const A = 512;
    const hw = this.track.halfWidth;

    // per-angle road centreline radius: min envelope over the 1400 samples
    // with a ±4° window (the inner edge of the loop is the constraint), then
    // two min-filter passes — min only ever pushes the ridge further in,
    // never toward the road
    const roadR = new Float32Array(A).fill(Infinity);
    {
      const win = Math.max(1, Math.round((A * 4) / 360));
      for (const sm of this.track.samples) {
        const th = Math.atan2(sm.pos.z, sm.pos.x);
        const c = Math.floor((((th + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * A);
        const r = Math.hypot(sm.pos.x, sm.pos.z);
        for (let k = -win; k <= win; k++) {
          const b = (c + k + A) % A;
          if (r < roadR[b]) roadR[b] = r;
        }
      }
      for (let pass = 0; pass < 2; pass++) {
        const next = Float32Array.from(roadR);
        for (let j = 0; j < A; j++) {
          next[j] = Math.min(roadR[(j - 1 + A) % A], roadR[j], roadR[(j + 1) % A]);
        }
        roadR.set(next);
      }
    }

    const factory = ridgeFieldFactory(roadR, hMax, hw, (x, z) => {
      // the REAL massif fields (same closures that built the meshes)
      let m = 0;
      for (const pk of this.mountainPeaks) {
        const dx = x - pk.x;
        const dz = z - pk.z;
        const rr = pk.r * 1.25;
        if (dx * dx + dz * dz < rr * rr) m = Math.max(m, pk.field(dx, dz));
      }
      return m;
    });
    this.ridgeField = factory.field;
    this.ridgeFactory = factory;
    const built = ridgeGeometry(factory, hMax, hw, (x, z) => this.track.terrainHeightAt(x, z));
    this.ridgeGrid = built.grid;
    // material pair: same scans as the massifs, cloned with a polygonOffset
    // so the buried apron edges can never z-fight the ground (meadow trick)
    let mats: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] | null = null;
    if (this.mtnMats) {
      mats = [this.mtnMats[0].clone(), this.mtnMats[1].clone()];
      for (const m of mats) {
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -2;
      }
    } else {
      const mk = () =>
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, fog: true });
      mats = [mk(), mk()];
    }
    const mesh = new THREE.Mesh(built.geo, mats);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // grove anchors strung along the crest — the conifer system clusters on
    // them like they do on the massif peaks (their field returns the WORLD
    // surface y, so trees stand on the ridge whatever the terrain does)
    const N_ANCH = 16;
    for (let k = 0; k < N_ANCH; k++) {
      const th = ((k + 0.5) / N_ANCH) * Math.PI * 2;
      const r = factory.crestR(th);
      const ax = Math.cos(th) * r;
      const az = Math.sin(th) * r;
      this.ridgeAnchors.push({
        x: ax,
        z: az,
        r: 58, // grove scatter spread — covers crest ± both upper flanks
        baseY: 0,
        field: (lx, lz) => {
          // sample the RENDERED grid — trees stand exactly on the mesh
          // surface, apron tuck and grid curvature included
          return this.ridgeSurfaceAt(ax + lx, az + lz);
        },
      });
    }
  }

  /** interior moss meadow: a drape conformed to the terrain over the
   *  central plateau (r 340 — road stays on the sand ring past r 400),
   *  carrying the ambientCG Moss003 forest-floor scan. polygonOffset
   *  keeps it clear of the ground mesh it sits 7 cm above. */
  private buildMeadow(): void {
    const moss = this.loadPbr("moss003", 26, 26);
    const geo = new THREE.RingGeometry(0.01, 340, 56, 26);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.track.terrainHeightAt(x, z) + 0.07);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: moss.color,
      normalMap: moss.normal,
      roughnessMap: moss.rough,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    this.group.add(m);
  }

  /** understory scatter: conifers (mountain slopes + inland), ferns, shrubs
   *  and grass tufts (corridor ring + lowlands). Each species gets 2 seeded
   *  prototypes instanced with hue-varied tints. */
  private buildFlora(rng: () => number): void {
    const road = this.roadPoints();
    const hw = this.track.halfWidth;
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();

    const makeInstanced = (
      protoSeeds: number[],
      builder: (s: number) => THREE.BufferGeometry,
      opts: {
        count: number;
        corridor: number;
        minH: number;
        maxR: number;
        doubleSide: boolean;
        castShadow?: boolean;
        /** optional PBR scan (dir, repeat-x, repeat-y) applied × vertex colours */
        pbr?: [string, number, number];
        /** how deep the base sinks into the ground (default 5 cm) */
        sink?: number;
        /** instance scale range [min, span] — default 0.7 + 0.6 */
        scale?: [number, number];
        /** crown fatness — multiplies x/z over y (1 = uniform) */
        fat?: number;
      },
      /** spot.y (metres, world) overrides terrainHeightAt — used to stand trees
       *  ON the mountain height fields instead of inside them */
      place: (rng: () => number) => { x: number; z: number; y?: number } | null,
    ) => {
      const protos = protoSeeds.map(builder);
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.0,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (opts.pbr) {
        const scan = this.loadPbr(opts.pbr[0], opts.pbr[1], opts.pbr[2]);
        mat.map = scan.color;
        mat.normalMap = scan.normal;
        mat.roughnessMap = scan.rough;
        mat.normalScale = new THREE.Vector2(0.6, 0.6);
      }
      const mats: THREE.Matrix4[][] = protoSeeds.map(() => []);
      const tints: THREE.Color[][] = protoSeeds.map(() => []);
      let placed = 0;
      let guard = 0;
      while (placed < opts.count && guard++ < opts.count * 40) {
        const spot = place(rng);
        if (!spot) continue;
        // keep scatter off the massifs AND the roadside ridge: grove spots
        // carry y (they stand ON the height fields) — everything else would
        // bury inside the mountain
        if (spot.y === undefined && (this.insideMassif(spot.x, spot.z) || this.onRidge(spot.x, spot.z))) continue;
        if (this.corridorDist(spot.x, spot.z, road) < hw + opts.corridor) continue;
        const y = spot.y ?? this.track.terrainHeightAt(spot.x, spot.z);
        if (y < opts.minH) continue;
        const p = placed % protos.length;
        const s = opts.scale ? opts.scale[0] + rng() * opts.scale[1] : 0.7 + rng() * 0.6;
        const fat = opts.fat ?? 1;
        q.setFromAxisAngle(up, rng() * Math.PI * 2);
        mats[p].push(new THREE.Matrix4().compose(new THREE.Vector3(spot.x, y - (opts.sink ?? 0.05), spot.z), q, new THREE.Vector3(s * fat, s, s * fat)));
        tints[p].push(new THREE.Color().setHSL(0.23 + rng() * 0.09, 0.35 + rng() * 0.3, 0.42 + rng() * 0.14));
        placed++;
      }
      protos.forEach((geo, i) => {
        if (!mats[i].length) return;
        const inst = new THREE.InstancedMesh(geo, mat, mats[i].length);
        inst.castShadow = opts.castShadow ?? true;
        mats[i].forEach((m, k) => {
          inst.setMatrixAt(k, m);
          inst.setColorAt(k, tints[i][k]);
        });
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.group.add(inst);
      });
    };

    // conifers: dense groves clumped on the massif height fields AND strung
    // along the roadside ridge (the same closures that built the geometry
    // place the trees — no floating, no burying) plus open inland scatter
    // between the groves
    const pool: { x: number; z: number; r: number; baseY: number; field: (lx: number, lz: number) => number; ridge?: boolean }[] = [
      ...this.mountainPeaks.map((p) => ({ ...p, ridge: false })),
      ...this.ridgeAnchors.map((a) => ({ ...a, ridge: true })),
    ];
    const groves: { x: number; z: number; s: number; pk: number }[] = [];
    for (let pi = 0; pi < pool.length; pi++) {
      const pk = pool[pi];
      if (pk.ridge) {
        // ridge clusters strung ALONG the crest arc near this anchor, with a
        // little radial jitter so some groves ride each upper flank
        const th0 = Math.atan2(pk.z, pk.x);
        const n = 12;
        for (let c = 0; c < n; c++) {
          const th = th0 + (rng() - 0.5) * ((Math.PI * 2) / 16) * 0.85;
          const rr = Math.hypot(pk.x, pk.z) + (rng() - 0.5) * 46;
          groves.push({ x: Math.cos(th) * rr, z: Math.sin(th) * rr, s: 8 + rng() * 9, pk: pi });
        }
      } else {
        for (let c = 0; c < 12; c++) {
          const a = rng() * Math.PI * 2;
          const d = pk.r * (0.22 + rng() * 0.66);
          groves.push({ x: pk.x + Math.cos(a) * d, z: pk.z + Math.sin(a) * d, s: 7 + rng() * 10, pk: pi });
        }
      }
    }
    const gauss = () => {
      // Box–Muller — grove scatter reads as woodland, uniform reads as dots
      const u = Math.max(1e-6, rng());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(rng() * Math.PI * 2);
    };
    makeInstanced(
      [611, 622],
      coniferPrototype,
      { count: this.spec.conifers, corridor: 7, minH: 0.9, maxR: 480, doubleSide: false, sink: 0.45, scale: [2.0, 1.6], fat: 1.3 },
      (r) => {
        if (groves.length && r() < 0.92) {
          const g = groves[Math.floor(r() * groves.length)];
          const pk = pool[g.pk];
          const x = g.x + gauss() * g.s;
          const z = g.z + gauss() * g.s;
          const y = pk.baseY + pk.field(x - pk.x, z - pk.z);
          // cross-field burial guard: the ridge feet brush the massif skirts,
          // so a tree standing on one field must not land inside the other's
          if (pk.ridge ? this.insideMassif(x, z) : this.ridgeField && this.ridgeField(x, z) > 0.25)
            return null;
          return { x, z, y: y > 0 ? y : undefined };
        }
        const a = r() * Math.PI * 2;
        const d = 120 + r() * 330;
        return { x: Math.cos(a) * d, z: Math.sin(a) * d };
      },
    );

    // ferns: damp hollows inland + the shady side of the corridor
    makeInstanced(
      [711, 722],
      fernPrototype,
      { count: this.spec.ferns, corridor: 5, minH: 0.5, maxR: 560, doubleSide: true, pbr: ["moss004", 1, 1] },
      (r) => {
        if (r() < 0.55) {
          const s = this.track.samples[Math.floor(r() * this.track.samples.length)];
          const side = r() < 0.5 ? 1 : -1;
          const dist = hw + 4 + r() * 10;
          return { x: s.pos.x + s.normal.x * side * dist, z: s.pos.z + s.normal.z * side * dist };
        }
        const a = r() * Math.PI * 2;
        const d = 130 + r() * 400;
        return { x: Math.cos(a) * d, z: Math.sin(a) * d };
      },
    );

    // shrubs: dry lowland scatter
    makeInstanced(
      [811, 822],
      shrubPrototype,
      { count: this.spec.shrubs, corridor: 5, minH: 0.45, maxR: 580, doubleSide: false, pbr: ["moss004", 2, 2] },
      (r) => {
        const a = r() * Math.PI * 2;
        const d = 110 + r() * 440;
        return { x: Math.cos(a) * d, z: Math.sin(a) * d };
      },
    );

    // grass tufts: dense road-edge fringe (the mowed-verge look)
    makeInstanced(
      [911, 922],
      tuftPrototype,
      { count: this.spec.tufts, corridor: 3.2, minH: 0.4, maxR: 600, doubleSide: true, castShadow: false },
      (r) => {
        const s = this.track.samples[Math.floor(r() * this.track.samples.length)];
        const side = r() < 0.5 ? 1 : -1;
        const dist = hw + 1.8 + r() * 9;
        return { x: s.pos.x + s.normal.x * side * dist, z: s.pos.z + s.normal.z * side * dist };
      },
    );
  }

  private buildPalms(rng: () => number): void {
    const protos = [palmPrototype(101), palmPrototype(202), palmPrototype(303)];
    // material pair matching the palm's two geometry groups:
    //   [0] trunk → ambientCG Bark013 scan (deep vertical furrows)
    //   [1] crown → plain vertex-coloured fronds
    const bark = this.loadPbr("bark013", 2, 1);
    const barkMat = new THREE.MeshStandardMaterial({
      map: bark.color,
      normalMap: bark.normal,
      roughnessMap: bark.rough,
      roughness: 0.95,
      metalness: 0,
    });
    const leafMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const mat: [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial] = [barkMat, leafMat];
    const N = this.spec.palms;
    const road = this.roadPoints();
    const hw = this.track.halfWidth;
    const mats: THREE.Matrix4[][] = [[], [], []];
    const tints: THREE.Color[][] = [[], [], []];
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let placed = 0;
    let guard = 0;
    while (placed < N && guard++ < N * 40) {
      let x: number, z: number;
      if (rng() < 0.6) {
        // corridor side: ring the road with the postcard palm alley
        const s = this.track.samples[Math.floor(rng() * this.track.samples.length)];
        const side = rng() < 0.5 ? 1 : -1;
        const dist = hw + 7 + rng() * 24;
        x = s.pos.x + s.normal.x * side * dist;
        z = s.pos.z + s.normal.z * side * dist;
      } else {
        // inland scatter across the dune plateau
        const a = rng() * Math.PI * 2;
        const r = 120 + rng() * 470;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      }
      if (this.corridorDist(x, z, road) < hw + 5.5) continue; // never on the road
      if (this.insideMassif(x, z)) continue; // palms belong to the beach, not the cliffs
      if (this.onRidge(x, z)) continue; // nor on the roadside hill
      const y = this.track.terrainHeightAt(x, z);
      if (y < 0.55) continue; // in the water / surf zone
      const p = placed % protos.length;
      const scale = 0.75 + rng() * 0.55;
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      mats[p].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.15, z), q, new THREE.Vector3(scale, scale, scale)));
      // hue variation: some palms run yellow-green, some deep
      const t = new THREE.Color().setHSL(0.24 + rng() * 0.07, 0.4 + rng() * 0.25, 0.42 + rng() * 0.1);
      tints[p].push(t);
      placed++;
    }
    protos.forEach((geo, i) => {
      const inst = new THREE.InstancedMesh(geo, mat, mats[i].length);
      inst.castShadow = true;
      inst.receiveShadow = false;
      mats[i].forEach((m, k) => {
        inst.setMatrixAt(k, m);
        inst.setColorAt(k, tints[i][k]);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.group.add(inst);
    });
  }

  private buildRocks(rng: () => number): void {
    const protos = [rockPrototype(11), rockPrototype(12), rockPrototype(13)];
    // ambientCG Rock057 1K — warm layered sandstone; instance tints still
    // give every boulder its own shade (wet rocks near the surf run darker)
    const scan = this.loadPbr("rock057", 1.5, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: scan.color,
      normalMap: scan.normal,
      roughnessMap: scan.rough,
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const N = this.spec.rocks;
    const road = this.roadPoints();
    const hw = this.track.halfWidth;
    const mats: THREE.Matrix4[][] = [[], [], []];
    const tints: THREE.Color[][] = [[], [], []];
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let placed = 0;
    let guard = 0;
    while (placed < N && guard++ < N * 30) {
      let x: number, z: number;
      if (rng() < 0.75) {
        // shoreline band — boulders bookending the beach
        const a = rng() * Math.PI * 2;
        const r = 560 + rng() * 130;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } else {
        // a few rockery accents right at the road's edge (set pieces)
        const s = this.track.samples[Math.floor(rng() * this.track.samples.length)];
        const side = rng() < 0.5 ? 1 : -1;
        const dist = hw + 4 + rng() * 5;
        x = s.pos.x + s.normal.x * side * dist;
        z = s.pos.z + s.normal.z * side * dist;
      }
      if (this.corridorDist(x, z, road) < hw + 3) continue;
      if (this.insideMassif(x, z)) continue; // no boulders swallowed by the massifs
      if (this.onRidge(x, z)) continue; // nor buried in the roadside ridge
      const y = this.track.terrainHeightAt(x, z);
      if (y < -0.3) continue; // fully at sea — the islets cover that look
      const p = placed % protos.length;
      const s = 0.5 + rng() * rng() * 2.6; // skewed: many pebbles, few boulders
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y - s * 0.3, z), // sink: half-buried boulders
        q,
        new THREE.Vector3(s * (0.8 + rng() * 0.4), s * (0.6 + rng() * 0.3), s * (0.8 + rng() * 0.4)),
      );
      mats[p].push(m);
      const wet = y < 0.4; // wet rocks near the surf run darker
      tints[p].push(new THREE.Color(wet ? 0x8a827a : 0xa49a8a));
      placed++;
    }
    protos.forEach((geo, i) => {
      const inst = new THREE.InstancedMesh(geo, mat, mats[i].length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      mats[i].forEach((m, k) => {
        inst.setMatrixAt(k, m);
        inst.setColorAt(k, tints[i][k]);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.group.add(inst);
    });
  }

  /** far horizon mountain-islands — heightfield massifs with conifer specks
   *  (no shadows: they live past the shadow camera's ±200 m box anyway).
   *  v2 shares the interior massif generator, so the horizon reads as the
   *  same geology — irregular outlines, concave flanks, broken skylines. */
  private buildIslets(rng: () => number): void {
    const peaks: THREE.Matrix4[] = [];
    const tints: THREE.Color[] = [];
    // each islet gets its own prototype — 6 unique silhouettes
    const protos: THREE.BufferGeometry[] = [];
    for (let k = 0; k < this.spec.islets; k++) {
      protos.push(mountainPrototype(3100 + k * 17, 70 + rng() * 35, 30 + rng() * 26));
    }
    const mat =
      this.mtnMats ??
      ([
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.95,
          flatShading: true,
          fog: true,
        }),
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.95,
          flatShading: true,
          fog: true,
        }),
      ] as [THREE.MeshStandardMaterial, THREE.MeshStandardMaterial]);
    const treeGeo = coniferPrototype(990);
    const treeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
    });
    const treeMats: THREE.Matrix4[] = [];
    for (let k = 0; k < this.spec.islets; k++) {
      // spread the islets around the horizon, never behind the start grid
      const a = (k / this.spec.islets) * Math.PI * 2 + 0.35 + rng() * 0.4;
      // exp2 fog (0.0011) eats 70% of a 1.2 km object, so the silhouettes
      // need mass to read through the haze
      const r = 950 + rng() * 380;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      peaks.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, this.spec.waterLevel - 2, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
          new THREE.Vector3(1, 1, 1),
        ),
      );
      tints.push(new THREE.Color().setHSL(0.28 + rng() * 0.05, 0.22 + rng() * 0.1, 0.4 + rng() * 0.08));
      // conifer specks on the lower slopes (big scale — 1 km out, size reads)
      const nT = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < nT; p++) {
        const s = 2.2 + rng() * 1.6;
        treeMats.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x + (rng() - 0.5) * 60, this.spec.waterLevel + 3 + rng() * 6, z + (rng() - 0.5) * 60),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
            new THREE.Vector3(s, s, s),
          ),
        );
      }
    }
    protos.forEach((geo, i) => {
      const inst = new THREE.InstancedMesh(geo, mat, 1);
      inst.setMatrixAt(0, peaks[i]);
      inst.setColorAt(0, tints[i]);
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this.group.add(inst);
    });
    const treeInst = new THREE.InstancedMesh(treeGeo, treeMat, treeMats.length);
    treeMats.forEach((m, i) => treeInst.setMatrixAt(i, m));
    treeInst.instanceMatrix.needsUpdate = true;
    this.group.add(treeInst);
  }

  private buildBuoys(rng: () => number): void {
    const geo = buoyGeometry();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.15,
    });
    const N = this.spec.buoys;
    const inst = new THREE.InstancedMesh(geo, mat, N);
    const q = new THREE.Quaternion();
    let placed = 0;
    let guard = 0;
    while (placed < N && guard++ < N * 40) {
      const a = rng() * Math.PI * 2;
      const r = 690 + rng() * 320; // the shallows just past the waterline
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (this.insideMassif(x, z)) continue; // never inside a headland cliff
      if (this.onRidge(x, z)) continue; // (band pre-check — no-op out at sea)
      const s = 0.8 + rng() * 0.5;
      const spin = rng() * Math.PI * 2;
      this.buoys.push({ x, z, s, spin });
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
      inst.setMatrixAt(
        placed,
        new THREE.Matrix4().compose(new THREE.Vector3(x, this.spec.waterLevel - 0.16, z), q, new THREE.Vector3(s, s, s)),
      );
      placed++;
    }
    inst.count = placed; // guard may run dry inside the headland ring
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
    this.buoyInst = inst;
  }

  /** per-frame: advance the sea shader clock and bob the buoys on the SAME
   *  wave function (they ride the visible swell, not a separate fake). */
  update(dt: number): void {
    if (this.disposed) return;
    this.time += dt;
    this.waterUniforms.uTime.value = this.time;
    if (this.buoyInst) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < this.buoys.length; k++) {
        const b = this.buoys[k];
        const y = this.spec.waterLevel + waveY(b.x, b.z, this.time) - 0.16;
        // tilt with the local wave slope (finite difference, tiny angles)
        const e = 2.5;
        const slopeX = (waveY(b.x + e, b.z, this.time) - waveY(b.x - e, b.z, this.time)) / (2 * e);
        const slopeZ = (waveY(b.x, b.z + e, this.time) - waveY(b.x, b.z - e, this.time)) / (2 * e);
        q.setFromEuler(new THREE.Euler(-slopeZ * 0.8, b.spin, slopeX * 0.8));
        m.compose(new THREE.Vector3(b.x, y, b.z), q, new THREE.Vector3(b.s, b.s, b.s));
        this.buoyInst.setMatrixAt(k, m);
      }
      this.buoyInst.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.textures.forEach((t) => t.dispose());
    this.textures = [];
    this.group.clear();
  }
}

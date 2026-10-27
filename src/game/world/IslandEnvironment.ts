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
//   mountains: ridged multi-peak prototypes (displaced cones with altitude
//     colour bands: scrub green → rock) — a central mass in the island
//     interior replaces the old empty plateau, and greener clones stand on
//     the horizon islets instead of the old faceted domes that read as
//     pyramids/buildings.
//   flora: palms (bent trunks, droop fronds, coconuts) plus three more
//     instanced species for variety — conifers on the mountain slopes,
//     lowland ferns and shrubs, grass tufts ringing the corridor.
//   rocks: displaced flat-shaded icosahedra, half-buried along the shore.
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

/** one ridged peak: cone displaced per (angle-ring, height-ring) with a
 *  3-lobe ridge + hash jitter, vertex-coloured by altitude — scrub green
 *  skirt → rock shoulders → pale crest. flatShading does the facet work. */
function peakGeometry(seed: number, r: number, h: number): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(r, h, 26, 9);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const skirt = new THREE.Color(0x4f6d33);
  const mid = new THREE.Color(0x8a8272);
  const crest = new THREE.Color(0xa79d8b);
  const phase = seed * 1.37;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr > 0.01) {
      const ang = Math.atan2(z, x);
      const ty = Math.min(1, Math.max(0, y / h));
      const ridge = Math.sin(ang * 3 + phase) * 0.14 + Math.sin(ang * 7 + phase * 2) * 0.06;
      const d = 0.82 + ridge * (1 - ty * 0.7) + h2(Math.round(ang * 100), Math.round(ty * 9)) * 0.22;
      pos.setX(i, x * d);
      pos.setZ(i, z * d);
    }
    const ty = Math.min(1, Math.max(0, pos.getY(i) / h));
    let c: THREE.Color;
    if (ty < 0.3) c = skirt.clone().lerp(mid, ty / 0.3);
    else if (ty < 0.62) c = mid.clone().lerp(crest, (ty - 0.3) / 0.32);
    else c = crest.clone();
    const j = 0.88 + h2(pos.getX(i), pos.getZ(i)) * 0.24;
    cols[i * 3] = c.r * j;
    cols[i * 3 + 1] = c.g * j;
    cols[i * 3 + 2] = c.b * j;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/** a mountain as one merged geometry: main peak + 1-3 satellite sub-peaks
 *  leaning off it — a lone cone reads as a volcano, a cluster reads as a
 *  range. Deterministic per seed. */
function mountainPrototype(seed: number, baseR: number, height: number): THREE.BufferGeometry {
  const rng = makeRng(seed);
  const parts = [peakGeometry(seed, baseR, height)];
  const sats = 1 + Math.floor(rng() * 3);
  for (let k = 0; k < sats; k++) {
    const r = baseR * (0.4 + rng() * 0.25);
    const h = height * (0.45 + rng() * 0.3);
    const a = rng() * Math.PI * 2;
    const d = baseR * (0.7 + rng() * 0.5);
    const g = peakGeometry(seed * 3 + k + 7, r, h);
    g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  if (!merged) throw new Error("mountain merge failed");
  return merged;
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
  const parts: THREE.BufferGeometry[] = [];
  let y = 0;
  let offset = new THREE.Vector2(0, 0);
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const rBase = 0.26 * (1 - t * 0.42);
    const ring = i % 2 === 0 ? 1.0 : 0.82; // ring scars
    const segLen = height / segs;
    const g = new THREE.CylinderGeometry(rBase * 0.9 * ring, rBase * ring, segLen, 7, 1);
    paint(g, 0x8a7963, 0.25, rng);
    // lean: each segment drifts along the lean direction, tilt accumulates
    const dx = Math.cos(leanAz) * Math.sin(lean) * segLen * t;
    const dz = Math.sin(leanAz) * Math.sin(lean) * segLen * t;
    g.translate(dx, y + segLen / 2, dz);
    parts.push(g);
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
    parts.push(f);
  }
  // coconut cluster under the crown
  for (let c = 0; c < 3; c++) {
    const g = new THREE.SphereGeometry(0.11, 6, 5);
    paint(g, 0x4c3a20, 0.3, rng);
    const a = rng() * Math.PI * 2;
    const r = 0.14 + rng() * 0.1;
    g.translate(crown.x + Math.cos(a) * r, crown.y - 0.18 - rng() * 0.1, crown.z + Math.sin(a) * r);
    parts.push(g);
  }
  // all sources are indexed with identical attribute sets — merge indexed
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
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
  /** interior mountain footprints — conifers ring them */
  private mountainPeaks: { x: number; z: number; r: number }[] = [];
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
    this.buildPalms(rng);
    this.buildFlora(rng);
    this.buildRocks(rng);
    this.buildIslets(rng);
    this.buildBuoys(rng);
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

  /** central mountain mass in the island interior — the old empty plateau
   *  becomes the horizon landmark the road circles. */
  private buildMountains(rng: () => number): void {
    const defs: { x: number; z: number; r: number; h: number }[] = [
      { x: 55, z: -70, r: 135, h: 64 },
      { x: -170, z: -140, r: 90, h: 42 },
      { x: 190, z: 130, r: 62, h: 27 },
    ];
    const road = this.roadPoints();
    const hw = this.track.halfWidth;
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });
    for (let i = 0; i < Math.min(defs.length, this.spec.mountains); i++) {
      const d = defs[i];
      if (this.corridorDist(d.x, d.z, road) < hw + d.r + 24) continue; // never swallow the road
      const geo = mountainPrototype(500 + i * 13, d.r, d.h);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(d.x, this.track.terrainHeightAt(d.x, d.z) - 1.5, d.z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      this.mountainPeaks.push({ x: d.x, z: d.z, r: d.r });
    }
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
      opts: { count: number; corridor: number; minH: number; maxR: number; doubleSide: boolean; castShadow?: boolean },
      place: (rng: () => number) => { x: number; z: number } | null,
    ) => {
      const protos = protoSeeds.map(builder);
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.0,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });
      const mats: THREE.Matrix4[][] = protoSeeds.map(() => []);
      const tints: THREE.Color[][] = protoSeeds.map(() => []);
      let placed = 0;
      let guard = 0;
      while (placed < opts.count && guard++ < opts.count * 40) {
        const spot = place(rng);
        if (!spot) continue;
        if (this.corridorDist(spot.x, spot.z, road) < hw + opts.corridor) continue;
        const y = this.track.terrainHeightAt(spot.x, spot.z);
        if (y < opts.minH) continue;
        const p = placed % protos.length;
        const s = 0.7 + rng() * 0.6;
        q.setFromAxisAngle(up, rng() * Math.PI * 2);
        mats[p].push(new THREE.Matrix4().compose(new THREE.Vector3(spot.x, y - 0.05, spot.z), q, new THREE.Vector3(s, s, s)));
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

    // conifers: ring each interior mountain at 0.45–0.85·r, plus open inland scatter
    makeInstanced(
      [611, 622],
      coniferPrototype,
      { count: this.spec.conifers, corridor: 7, minH: 0.9, maxR: 480, doubleSide: false },
      (r) => {
        if (this.mountainPeaks.length && r() < 0.7) {
          const pk = this.mountainPeaks[Math.floor(r() * this.mountainPeaks.length)];
          const a = r() * Math.PI * 2;
          const d = pk.r * (0.45 + r() * 0.4);
          return { x: pk.x + Math.cos(a) * d, z: pk.z + Math.sin(a) * d };
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
      { count: this.spec.ferns, corridor: 5, minH: 0.5, maxR: 560, doubleSide: true },
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
      { count: this.spec.shrubs, corridor: 5, minH: 0.45, maxR: 580, doubleSide: false },
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
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
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
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
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

  /** far horizon mountain-islands — ridged green peaks with conifer specks
   *  (no shadows: they live past the shadow camera's ±200 m box anyway).
   *  Replaced the old faceted icosahedron domes that read as pyramids. */
  private buildIslets(rng: () => number): void {
    const peaks: THREE.Matrix4[] = [];
    const tints: THREE.Color[] = [];
    // each islet gets its own prototype — 6 unique silhouettes
    const protos: THREE.BufferGeometry[] = [];
    for (let k = 0; k < this.spec.islets; k++) {
      protos.push(mountainPrototype(3100 + k * 17, 60 + rng() * 30, 26 + rng() * 18));
    }
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
      fog: true,
    });
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
    for (let k = 0; k < N; k++) {
      const a = rng() * Math.PI * 2;
      const r = 690 + rng() * 320; // the shallows just past the waterline
      const s = 0.8 + rng() * 0.5;
      const spin = rng() * Math.PI * 2;
      this.buoys.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, s, spin });
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
      inst.setMatrixAt(
        k,
        new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * r, this.spec.waterLevel - 0.16, Math.sin(a) * r), q, new THREE.Vector3(s, s, s)),
      );
    }
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

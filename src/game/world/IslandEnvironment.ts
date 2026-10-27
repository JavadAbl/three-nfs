// ─── Island: animated sea, palms, rocks, islets, buoys ──────────────────────
// The ISLAND COVE map's world. Replaces the city grid entirely (selected via
// EnvThemeSpec.island): the baked dune terrain (island_generated.ts) IS the
// land, and this module dresses the coast —
//   water: one big plane at the theme's waterLevel with a procedurally baked
//     seamless wave-normal texture (integer wave numbers tile perfectly) that
//     scrolls every frame, plus an off-grid roughness layer scrolled the
//     other way so specular patches drift independently — cheap, but the sea
//     reads alive: sun glints ride the waves instead of sitting still.
//   palms: three merged vertex-coloured prototypes (bent segmented trunk
//     with ring scars, two frond rings with real droop curvature + taper,
//     coconut clusters), instanced along the corridor and scattered inland.
//   rocks: displaced flat-shaded icosahedra, half-buried along the shore.
//   islets: far displaced domes on the horizon carrying a palm or two —
//     fogged silhouettes that give the open sea a sense of scale.
//   buoys: little channel markers bobbing in the shallows.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Track } from "./Track";
import type { IslandSpec } from "../maps/registry";

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

/** companion roughness map (green channel): patchy specular areas drifting
 *  off the normal grid — wind-gust sparkle that never lines up with waves */
function waterRoughTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // second wave set (different wavenumbers → decorrelated patches)
      let h = 0;
      h += Math.sin((2 * Math.PI * 1 * x) / size + 0.3);
      h += Math.sin((2 * Math.PI * 2 * y) / size + 2.2) * 0.7;
      h += Math.sin((2 * Math.PI * (3 * x + 1 * y)) / size + 4.0) * 0.5;
      const g = Math.round(70 + (h / 2.2) * 60 + Math.random() * 24); // 0.27..1.0
      const i = (y * size + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
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
  /** scrolled every update() — the sea's drift */
  private textures: THREE.Texture[] = [];
  private time = 0;
  private disposed = false;

  constructor(
    private readonly track: Track,
    private readonly spec: IslandSpec,
  ) {
    const rng = makeRng(4242);
    this.group.add(this.makeWater());
    this.buildPalms(rng);
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
    const roughTex = waterRoughTexture();
    normalTex.repeat.set(110, 110); // ~47 m wave-tile — crests read from the car
    roughTex.repeat.set(160, 160);
    normalTex.anisotropy = 4;
    this.textures.push(normalTex, roughTex);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x11707f, // tropical teal — shallow sand glows through
      roughness: 0.12,
      metalness: 0.0,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: roughTex,
      transparent: true,
      opacity: 0.92,
      envMapIntensity: 1.15, // the sea mirrors the baked beach sky
    });
    const geo = new THREE.PlaneGeometry(5200, 5200, 1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = this.spec.waterLevel;
    mesh.renderOrder = 1; // draw after the opaque terrain so blending sorts
    return mesh;
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

  /** far horizon domes — fogged silhouettes with their own palms (no shadows:
   *  they live past the shadow camera's ±200 m box anyway) */
  private buildIslets(rng: () => number): void {
    const domes: THREE.Matrix4[] = [];
    const domeTints: THREE.Color[] = [];
    const domeGeo = rockPrototype(77, 2);
    const domeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
      fog: true,
    });
    const palmGeo = palmPrototype(909);
    const palmMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const palmMats: THREE.Matrix4[] = [];
    for (let k = 0; k < this.spec.islets; k++) {
      // spread the islets around the horizon, never behind the start grid
      const a = (k / this.spec.islets) * Math.PI * 2 + 0.35 + rng() * 0.4;
      // closer + bigger than the first pass: exp2 fog (0.0011) eats 70% of a
      // 1.2 km object, so the silhouettes need mass to read through the haze
      const r = 950 + rng() * 380;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const radius = 55 + rng() * 45;
      const peak = 10 + rng() * 16; // how far the dome clears the water
      // dome squashed 0.55 in y — center sits so the cap pokes `peak` out
      const centerY = this.spec.waterLevel + peak - radius * 0.55;
      domes.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, centerY, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
          new THREE.Vector3(radius, radius * 0.55, radius),
        ),
      );
      domeTints.push(new THREE.Color().setHSL(0.09 + rng() * 0.04, 0.18 + rng() * 0.12, 0.34 + rng() * 0.08));
      // 1-2 palms on the peak (big scale — they're 1.2 km out, size reads)
      const nP = 1 + (rng() < 0.6 ? 1 : 0);
      for (let p = 0; p < nP; p++) {
        const s = 1.6 + rng() * 0.8;
        palmMats.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(x + (rng() - 0.5) * radius * 0.4, this.spec.waterLevel + peak * 0.75, z + (rng() - 0.5) * radius * 0.4),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
            new THREE.Vector3(s, s, s),
          ),
        );
      }
    }
    const domeInst = new THREE.InstancedMesh(domeGeo, domeMat, domes.length);
    domes.forEach((m, i) => {
      domeInst.setMatrixAt(i, m);
      domeInst.setColorAt(i, domeTints[i]);
    });
    domeInst.instanceMatrix.needsUpdate = true;
    if (domeInst.instanceColor) domeInst.instanceColor.needsUpdate = true;
    this.group.add(domeInst);
    const palmInst = new THREE.InstancedMesh(palmGeo, palmMat, palmMats.length);
    palmMats.forEach((m, i) => palmInst.setMatrixAt(i, m));
    palmInst.instanceMatrix.needsUpdate = true;
    this.group.add(palmInst);
  }

  private buildBuoys(rng: () => number): void {
    const geo = buoyGeometry();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.15,
    });
    const N = this.spec.buoys;
    const mats: THREE.Matrix4[] = [];
    for (let k = 0; k < N; k++) {
      const a = rng() * Math.PI * 2;
      const r = 690 + rng() * 320; // the shallows just past the waterline
      const s = 0.8 + rng() * 0.5;
      mats.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * r, this.spec.waterLevel - 0.16, Math.sin(a) * r),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2),
          new THREE.Vector3(s, s, s),
        ),
      );
    }
    const inst = new THREE.InstancedMesh(geo, mat, N);
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    this.group.add(inst);
  }

  /** per-frame: drift the sea. Two layers scroll at different speeds and
   *  angles so wave crests and specular patches never sync up. */
  update(dt: number): void {
    if (this.disposed) return;
    this.time += dt;
    const [normalTex, roughTex] = this.textures;
    normalTex.offset.set(this.time * 0.008, this.time * 0.0055);
    roughTex.offset.set(-this.time * 0.004, this.time * 0.006);
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

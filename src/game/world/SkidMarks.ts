// ─── SkidMarks: persistent tyre streaks laid down while drifting ───────────
// The drift smoke (Particles.ts) sells the MOMENT but vanishes in a second —
// real drifts leave history on the tarmac. This module paints a dark rubber
// ribbon under each rear wheel while a car drifts, fading out over ~15 s so
// a long corner writes a long streak and the start straight isn't paved
// black by lap 3.
//
// Design constraints from the speed-blur rollback (66bac16): NO post chain,
// NO resolution tricks — every effect on this branch is scene geometry.
// One BufferGeometry ring buffer of quads → ONE draw call, positions are
// write-once (emitted), only the per-vertex alpha attribute is touched per
// frame. Quads ride 3 cm above the car's ground plane and depth-test
// against the world, so hills and cars occlude them naturally.
//
// Ribbon continuity is per (owner, wheel): Game passes each rear wheel's
// ground contact every frame; a gap (drift ended, >4 m teleport from a
// reset) breaks the ribbon instead of smearing a quad across the map.
import * as THREE from "three";

/** total quads in the ring — 720 ≈ 2 wheels × 360 m of streak at 0.5 m
 *  segments; plenty for a full drift corner from every car in the grid */
const SEGMENTS = 720;
/** tyre contact patch width (m) */
const WIDTH = 0.3;
/** alpha decay per second — 0.05 ≈ 15 s lifetime at full strength */
const FADE_S = 0.05;

interface OwnerTrack {
  /** last contact per wheel slot, pooled (no per-frame allocation) */
  pos: THREE.Vector3[];
  /** ribbon alive per wheel slot — false = next mark starts a new ribbon */
  live: boolean[];
}

export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.ShaderMaterial;
  private readonly max: number;
  private readonly positions: Float32Array; // max * 4 verts * 3
  private readonly alphas: Float32Array; // max * 4 verts
  private readonly segAlpha: Float32Array; // per-segment source of truth
  private cursor = 0;
  private owners = new Map<object, OwnerTrack>();

  constructor(max = SEGMENTS) {
    this.max = max;
    this.positions = new Float32Array(max * 4 * 3);
    this.alphas = new Float32Array(max * 4);
    this.segAlpha = new Float32Array(max);
    // park unused quads under the world (alpha 0 stops any raster work)
    for (let i = 0; i < max; i++) this.positions[i * 12 + 1] = -9999;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute("alpha", new THREE.BufferAttribute(this.alphas, 1));
    // uv.x runs across the patch (0..1) — the frag shader softens both edges
    const uvs = new Float32Array(max * 4 * 2);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      const v = i * 4;
      uvs.set([0, 0, 1, 0, 0, 1, 1, 1], v * 2);
      // two triangles: v0,v1,v2 + v2,v1,v3 (CCW facing up)
      idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
    }
    this.geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false, // never occlude other transparents (smoke, glows)
      uniforms: { uColor: { value: new THREE.Color(0.045, 0.045, 0.055) } },
      vertexShader: /* glsl */ `
        attribute float alpha;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          vAlpha = alpha;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        varying vec2 vUv;
        void main() {
          // soft side edges — a stamped patch, not a hard rectangle
          float across = smoothstep(0.0, 0.4, vUv.x) * smoothstep(1.0, 0.6, vUv.x);
          float a = vAlpha * across;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }
      `,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false; // ring buffer spans the whole track
    this.mesh.renderOrder = 1; // under the smoke/glows, over the tarmac
  }

  /**
   * Feed one wheel's ground contact. `active` = the tyre is scrubbing
   * (drifting); when it flips false (or the position jumps >4 m, e.g. a
   * reset) the ribbon breaks — the next active mark starts a fresh streak.
   * `strength` 0..1 scales darkness/width for light scrubs vs full locks.
   */
  mark(owner: object, wheel: number, pos: THREE.Vector3, active: boolean, strength = 1) {
    let t = this.owners.get(owner);
    if (!t) {
      t = { pos: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], live: [false, false, false, false] };
      this.owners.set(owner, t);
    }
    if (!active || !t.live[wheel]) {
      // start of a ribbon: remember the contact, draw nothing yet
      t.live[wheel] = active;
      if (active) t.pos[wheel].copy(pos);
      return;
    }
    const prev = t.pos[wheel];
    const d = prev.distanceTo(pos);
    if (d >= 0.04 && d < 4) this.pushSegment(prev, pos, strength);
    // a teleport (track reset) breaks the ribbon; anything sane continues it
    t.live[wheel] = d < 4;
    if (t.live[wheel]) prev.copy(pos);
  }

  private pushSegment(from: THREE.Vector3, to: THREE.Vector3, strength: number) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    // side vector = perpendicular of the travel direction on XZ, half-width
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz) || 1e-4;
    const hw = (WIDTH * (0.7 + 0.3 * strength)) / 2;
    const nx = (-dz / len) * hw;
    const nz = (dx / len) * hw;
    const y = Math.max(from.y, to.y) + 0.01;
    const p = this.positions;
    const o = i * 12;
    p[o] = from.x - nx; p[o + 1] = y; p[o + 2] = from.z - nz;
    p[o + 3] = from.x + nx; p[o + 4] = y; p[o + 5] = from.z + nz;
    p[o + 6] = to.x - nx; p[o + 7] = y; p[o + 8] = to.z - nz;
    p[o + 9] = to.x + nx; p[o + 10] = y; p[o + 11] = to.z + nz;
    const a = 0.5 * strength;
    this.segAlpha[i] = a;
    this.alphas.fill(a, i * 4, i * 4 + 4);
    (this.geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const a = this.segAlpha[i];
      if (a <= 0) continue;
      any = true;
      const next = Math.max(a - FADE_S * dt, 0);
      this.segAlpha[i] = next;
      this.alphas.fill(next, i * 4, i * 4 + 4);
    }
    if (any) (this.geo.getAttribute("alpha") as THREE.BufferAttribute).needsUpdate = true;
  }

  /** segments currently holding visible rubber — probe/debug readout */
  get liveSegments(): number {
    let n = 0;
    for (let i = 0; i < this.max; i++) if (this.segAlpha[i] > 0.05) n++;
    return n;
  }

  /** grid rebuild (restart) — cars are new objects, drop every ribbon */
  reset() {
    this.segAlpha.fill(0);
    this.alphas.fill(0);
    (this.geo.getAttribute("alpha") as THREE.BufferAttribute).needsUpdate = true;
    this.owners.clear();
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
    this.owners.clear();
  }
}

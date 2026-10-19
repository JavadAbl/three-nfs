// ─── Spline circuit: road mesh, samples, checkpoints ────────────────────────
import * as THREE from "three";
import { GAME_CONFIG } from "../constants";
import type { MapDef } from "../maps/registry";
import { resolveMapPalette } from "../maps/registry";

/** Tint multiplied over the scanned albedo (ambientCG Asphalt_001, CC0).
 *  Night mood comes from the scene lighting, not albedo — the tint only has
 *  to stop the raw scan (avg ~29% grey) from glowing vs the hand-tuned
 *  palettes. ~65% keeps grain visible under headlight beams. */
const ASPHALT_TEX_TINT = 0xa6a6ae;

export interface TrackSample {
  pos: THREE.Vector3;
  tangent: THREE.Vector3; // unit
  normal: THREE.Vector3; // lateral unit (right of travel)
  dist: number; // cumulative metres from start
}

/** Result of locating a car relative to the track */
export interface TrackLocation {
  index: number; // nearest sample index
  sDist: number; // metres along track (interpolated)
  lateral: number; // signed metres right of centre line
  height: number; // road surface y at that point
  slopePitch: number; // road pitch (radians, + uphill)
  tangent: THREE.Vector3;
}

export class Track {
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[] = [];
  readonly sampleCount: number;
  readonly length: number;
  readonly mapId: string;
  readonly halfWidth: number;
  /** lateral metres (from centre line) where the guardrail mesh stands — physics matches the visual */
  readonly railLateral: number;
  readonly checkpointCount: number;
  /** sample indices that mark each checkpoint gate */
  checkpointIndices: number[] = [];
  group = new THREE.Group();
  /** fully-resolved look for this map (road, lines, lamps, finish) */
  private readonly P: ReturnType<typeof resolveMapPalette>;

  /**
   * Build a circuit from a registry MapDef. Unspecified fields fall back to
   * the global GAME_CONFIG defaults, so a bare points-only entry reproduces
   * the legacy hardcoded track exactly.
   */
  constructor(def: MapDef) {
    this.mapId = def.id;
    this.P = resolveMapPalette(def);
    const pts = def.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    this.curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);

    // ── resample the closed curve evenly by arc length ──
    const N = def.samples ?? GAME_CONFIG.TRACK_SAMPLES;
    this.sampleCount = N;
    this.halfWidth = def.roadHalfWidth ?? GAME_CONFIG.ROAD_HALF_WIDTH;
    this.railLateral = this.halfWidth + 1.4;
    this.checkpointCount = def.checkpoints ?? GAME_CONFIG.CHECKPOINTS;
    const positions = this.curve.getSpacedPoints(N);
    // getSpacedPoints(N) returns N+1 points with last == first; drop duplicate
    positions.pop();

    let dist = 0;
    for (let i = 0; i < N; i++) {
      const pos = positions[i];
      const next = positions[(i + 1) % N];
      const prev = positions[(i - 1 + N) % N];
      const tangent = next.clone().sub(prev).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      this.samples.push({ pos, tangent, normal, dist });
      dist += pos.distanceTo(next);
    }
    this.length = dist;

    // checkpoint gates evenly distributed; index 0 = start/finish
    for (let c = 0; c < this.checkpointCount; c++) {
      this.checkpointIndices.push(Math.round((c / this.checkpointCount) * N) % N);
    }

    this.buildRoad();
    this.buildRails();
    this.buildStartGate();
    this.buildStreetLights();
    this.buildLightPools();
  }

  // ─── geometry construction ──────────────────────────────────────────────

  private buildRoad() {
    const N = this.sampleCount;
    const hw = this.halfWidth;
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    // store per-vertex lateral sign so the shader-free approach works with vertex colors
    const colors: number[] = [];
    // same layout but with the scanned-albedo tint (used once real textures land)
    const texColors: number[] = [];

    const base = new THREE.Color(this.P.asphalt);
    const texBase = new THREE.Color(ASPHALT_TEX_TINT);
    const edge = new THREE.Color(this.P.roadEdge);
    const line = new THREE.Color(this.P.roadLine);

    for (let i = 0; i <= N; i++) {
      const s = this.samples[i % N];
      const v = i / N;
      for (let l = 0; l <= 8; l++) {
        const t = l / 8; // 0..1 across width
        const x = (t - 0.5) * 2; // -1..1
        const p = s.pos.clone().addScaledVector(s.normal, x * hw);
        positions.push(p.x, p.y, p.z);
        normals.push(0, 1, 0);
        uvs.push(t, v * (this.length / 10));
        // default asphalt
        let col = base;
        let colT = texBase;
        if (Math.abs(Math.abs(x) - 0.94) < 0.02) {
          col = colT = edge; // edge lines
        } else if (Math.abs(x) < 0.035 && i % 4 < 2) {
          col = colT = line; // dashed centre
        }
        colors.push(col.r, col.g, col.b);
        texColors.push(colT.r, colT.g, colT.b);
      }
    }
    const rowW = 9;
    for (let i = 0; i < N; i++) {
      for (let l = 0; l < 8; l++) {
        const a = i * rowW + l;
        const b = (i + 1) * rowW + l;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);

    const roadTex = makeAsphaltTexture();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: roadTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.name = "road";
    this.group.add(mesh);

    // async upgrade: scanned PBR asphalt (no-op if the files are absent)
    this.applyPbrAsphalt(geo, mat, texColors);
  }

  /** Swap the procedural canvas surface for the scanned PBR asphalt set
   *  (ambientCG Asphalt_001, CC0). Tries /textures/asphalt/ first (accepted
   *  assets), then /textures/staging/asphalt/ (pending acceptance); if the
   *  color map is nowhere to be found the procedural surface simply stays. */
  private applyPbrAsphalt(
    geo: THREE.BufferGeometry,
    mat: THREE.MeshStandardMaterial,
    texColors: number[],
  ): void {
    const loader = new THREE.TextureLoader();
    const load = (name: string, ok: (t: THREE.Texture) => void): void => {
      const paths = [`/textures/asphalt/${name}`, `/textures/staging/asphalt/${name}`];
      const attempt = (i: number): void => {
        if (i >= paths.length) return; // silent: procedural fallback stays
        loader.load(paths[i], ok, undefined, () => attempt(i + 1));
      };
      attempt(0);
    };
    const tile = (t: THREE.Texture): THREE.Texture => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8; // road is seen at grazing angles from every camera
      // dense tiling: the mesh UVs tile every ~10 m; x3 again so the scan's
      // aggregate grain survives on-screen minification (arcade cam distances)
      // without the repetition becoming visible as a grid
      t.repeat.set(3, 3);
      return t;
    };
    load("asphalt-2k-color.jpg", (t) => {
      mat.map = tile(t);
      t.colorSpace = THREE.SRGBColorSpace;
      // scan is its own albedo: lift the flat-palette vertex tint to ASPHALT_TEX_TINT
      geo.setAttribute("color", new THREE.Float32BufferAttribute(texColors, 3));
      mat.needsUpdate = true;
    });
    load("asphalt-2k-normal.jpg", (t) => {
      mat.normalMap = tile(t);
      mat.normalScale = new THREE.Vector2(1.1, 1.1);
      mat.needsUpdate = true;
    });
    load("asphalt-2k-rough.jpg", (t) => {
      mat.roughnessMap = tile(t);
      mat.roughness = 0.8; // map carries the variation; <1 for the wet-street sheen
      mat.needsUpdate = true;
    });
  }

  private buildRails() {
    const N = this.sampleCount;
    const hw = this.railLateral;
    const railH = 1.05;
    for (const side of [-1, 1]) {
      const positions: number[] = [];
      const indices: number[] = [];
      for (let i = 0; i <= N; i++) {
        const s = this.samples[i % N];
        const bottom = s.pos.clone().addScaledVector(s.normal, side * hw);
        const top = bottom.clone().setY(bottom.y + railH);
        positions.push(bottom.x, bottom.y + 0.25, bottom.z, top.x, top.y + 0.25, top.z);
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        const b = (i + 1) * 2;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2a2a30,
        emissive: new THREE.Color(0x3a2a10),
        emissiveIntensity: 0.5,
        roughness: 0.5,
        metalness: 0.7,
        side: THREE.DoubleSide,
      });
      this.group.add(new THREE.Mesh(geo, mat));
    }
  }

  private buildStartGate() {
    const s = this.samples[0];
    const hw = this.halfWidth + 1.6;
    const group = new THREE.Group();

    // checkered finish line across the road
    const stripe = makeCheckeredTexture();
    const lineGeo = new THREE.PlaneGeometry(hw * 2, 3);
    const lineMat = new THREE.MeshBasicMaterial({ map: stripe, transparent: true });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(s.tangent.z, s.tangent.x) + Math.PI / 2;
    line.position.copy(s.pos).setY(s.pos.y + 0.06);
    group.add(line);

    // gate posts + banner
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.8, roughness: 0.35 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 9, 10), postMat);
      post.position.copy(s.pos).addScaledVector(s.normal, side * hw).setY(s.pos.y + 4.5);
      group.add(post);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 + 1, 1.6, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0x101014,
        emissive: new THREE.Color(this.P.finishPrimary),
        emissiveIntensity: 0.85,
      })
    );
    banner.position.copy(s.pos).setY(s.pos.y + 8.6);
    banner.rotation.y = Math.atan2(s.tangent.x, s.tangent.z) + Math.PI / 2;
    group.add(banner);
    this.group.add(group);
  }

  private buildStreetLights() {
    const N = this.sampleCount;
    const spacing = Math.floor(N / 46);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x191920, roughness: 0.6, metalness: 0.6 });
    const lampMat = new THREE.MeshBasicMaterial({ color: this.P.lamp });
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.P.lamp,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    for (let i = 0; i < N; i += spacing) {
      const s = this.samples[i];
      const side = (i / spacing) % 2 === 0 ? 1 : -1;
      const base = s.pos.clone().addScaledVector(s.normal, side * (this.halfWidth + 2.6));
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6), poleMat);
      pole.position.copy(base).setY(base.y + 3.25);
      this.group.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.5), lampMat);
      lamp.position.copy(base).addScaledVector(s.normal, -side * 0.8).setY(base.y + 6.5);
      lamp.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      this.group.add(lamp);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 8), glowMat);
      glow.position.copy(lamp.position).setY(lamp.position.y - 0.35);
      this.group.add(glow);
    }
  }

  /** Additive light pools under each streetlight. The lamps themselves are
   *  emissive-only (zero real lights — the forward renderer stays cheap), so
   *  the road gets its NFS-style pools from these decals instead: bright
   *  rings where the scanned asphalt grain + normal map can actually be
   *  seen at night. One InstancedMesh, 1 draw call, fog-aware. */
  private buildLightPools() {
    const N = this.sampleCount;
    const spacing = Math.floor(N / 46); // must match buildStreetLights

    // radial gradient: hot core under the lamp, soft falloff onto the road
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const r = (this.P.lamp >> 16) & 255;
    const g = (this.P.lamp >> 8) & 255;
    const b = this.P.lamp & 255;
    const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.42)`);
    grad.addColorStop(0.35, `rgba(${r},${g},${b},0.18)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    const count = Math.ceil(N / spacing);
    const pools = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3();
    let k = 0;
    for (let i = 0; i < N && k < count; i += spacing, k++) {
      const s = this.samples[i];
      const side = (i / spacing) % 2 === 0 ? 1 : -1; // same parity as the lamps
      // surface normal: lateral x direction of travel
      up.copy(s.normal).cross(s.tangent).normalize();
      dummy.position
        .copy(s.pos)
        .addScaledVector(s.normal, side * (this.halfWidth - 2.5))
        .addScaledVector(up, 0.1);
      dummy.lookAt(dummy.position.clone().add(up)); // +Z faces the sky
      dummy.scale.set(14, 14, 1);
      dummy.updateMatrix();
      pools.setMatrixAt(k, dummy.matrix);
    }
    pools.instanceMatrix.needsUpdate = true;
    pools.renderOrder = 2; // after road + rails, additive on top
    pools.name = "lightPools";
    this.group.add(pools);
  }

  // ─── queries ─────────────────────────────────────────────────────────────

  sampleAt(i: number): TrackSample {
    const N = this.sampleCount;
    return this.samples[((i % N) + N) % N];
  }

  /**
   * Locate a world position on the track. `hint` speeds up the search by
   * scanning a window around the previous nearest index.
   */
  locate(pos: THREE.Vector3, hint = -1): TrackLocation {
    const N = this.sampleCount;
    let bestI = 0;
    let bestD = Infinity;

    if (hint >= 0) {
      const win = 36;
      for (let o = -win; o <= win; o++) {
        const i = ((hint + o) % N + N) % N;
        const d = this.samples[i].pos.distanceToSquared(pos);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
      // if we drifted far off, fall back to a full scan
      if (bestD > 90 * 90) return this.locate(pos, -1);
    } else {
      for (let i = 0; i < N; i += 2) {
        const d = this.samples[i].pos.distanceToSquared(pos);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
    }

    const s = this.samples[bestI];
    const next = this.sampleAt(bestI + 1);
    // lateral offset (signed, right positive)
    const rel = pos.clone().sub(s.pos);
    const lateral = rel.dot(s.normal);
    // longitudinal projection onto segment for smooth s-distance
    const along = THREE.MathUtils.clamp(rel.dot(s.tangent), 0, s.pos.distanceTo(next.pos));
    // height interpolation across the width
    const height = s.pos.y + (next.pos.y - s.pos.y) * (along / Math.max(0.001, s.pos.distanceTo(next.pos)));
    const pitch = Math.asin(
      THREE.MathUtils.clamp(next.pos.clone().sub(s.pos).normalize().y, -1, 1)
    );
    return {
      index: bestI,
      sDist: (s.dist + along) % this.length,
      lateral,
      height,
      slopePitch: pitch,
      tangent: s.tangent,
    };
  }

  /** Checkpoint gate index (0..checkpointCount-1) that a sample index belongs to */
  checkpointForIndex(i: number): number {
    const N = this.sampleCount;
    for (let c = this.checkpointCount - 1; c >= 0; c--) {
      const gate = this.checkpointIndices[c];
      // how far past this gate are we (wrapping)?
      const d = (i - gate + N) % N;
      if (d < N / this.checkpointCount) return c;
    }
    return 0;
  }

  /** Approximate curvature (rad per metre) around sample index */
  curvatureAt(i: number, span = 8): number {
    const a = this.sampleAt(i - span).tangent;
    const b = this.sampleAt(i + span).tangent;
    const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const length = (span * 2 * this.length) / this.sampleCount;
    return angle / length;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

// ─── procedural textures ─────────────────────────────────────────────────────

function makeAsphaltTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  // asphalt grain
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 232 + Math.random() * 23;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function makeCheckeredTexture(): THREE.Texture {
  const cells = 8;
  const cell = 16;
  const canvas = document.createElement("canvas");
  canvas.width = cells * cell;
  canvas.height = cell * 2;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#e8e8e8" : "#101010";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

// ─── Night city: instanced buildings, ground, stars, neon ───────────────────
import * as THREE from "three";
import type { Track } from "./Track";
import { ENV_THEMES, type EnvThemeSpec } from "../maps/registry";
import { loadCityModels, type BuildingProto } from "./CityModels";

export class CityEnvironment {
  group = new THREE.Group();
  private readonly theme: EnvThemeSpec;
  /** fallback box instanced meshes until the model sets load (then removed) */
  private boxMeshes: THREE.InstancedMesh[] = [];
  /** true once the real building models have replaced the boxes */
  modelsUpgraded = false;
  private disposed = false;

  /** builds the world furniture from a map's environment theme */
  constructor(track: Track, theme: EnvThemeSpec = ENV_THEMES.city) {
    this.theme = theme;
    this.group.add(this.makeGround());
    this.group.add(this.makeStars());
    this.buildBuildings(track);
    if (theme.containers) this.buildContainers(track, theme.containers);
    if (theme.cranes) this.buildCranes(track, theme.cranes);
    // async upgrade: real building models pop in over the fallback boxes
    void this.upgradeToModels(track);
  }

  /** swap the procedural boxes for the extracted building sets */
  private async upgradeToModels(track: Track) {
    let protos: BuildingProto[];
    try {
      protos = await loadCityModels();
    } catch {
      return; // sets missing — boxes stay, city still looks fine
    }
    if (this.disposed || !protos.length) return;
    this.buildModelCity(track, protos);
    // tear down the fallback boxes
    for (const inst of this.boxMeshes) {
      this.group.remove(inst);
      inst.geometry.dispose();
      (inst.material as THREE.Material).dispose();
    }
    this.boxMeshes = [];
    this.modelsUpgraded = true;
  }

  private makeGround(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(2200, 2200, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: this.theme.groundColor, roughness: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = -0.4;
    mesh.receiveShadow = true;
    return mesh;
  }

  private makeStars(): THREE.Points {
    const N = this.theme.starCount;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // dome distribution
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.lerp(0.05, 0.95, Math.random()));
      const r = 900;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xdfe6ee,
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      fog: false,
    });
    return new THREE.Points(geo, mat);
  }

  private buildBuildings(track: Track) {
    const T = this.theme;
    // candidate grid, keep clear of the track corridor
    const spacing = T.spacing;
    const range = T.range;
    const cands: { x: number; z: number }[] = [];
    const samples = track.samples;
    const checkStep = 3; // coarse check against every 3rd sample
    const clearance = T.clearance;

    for (let x = -range; x <= range; x += spacing) {
      for (let z = -range; z <= range; z += spacing) {
        // jitter
        const jx = x + (Math.random() - 0.5) * T.jitter;
        const jz = z + (Math.random() - 0.5) * T.jitter;
        let ok = true;
        for (let i = 0; i < samples.length; i += checkStep) {
          const s = samples[i];
          const dx = s.pos.x - jx;
          const dz = s.pos.z - jz;
          if (dx * dx + dz * dz < clearance * clearance) {
            ok = false;
            break;
          }
        }
        if (ok) cands.push({ x: jx, z: jz });
      }
    }

    // 3 instanced meshes with different window textures
    const variants = [
      { tex: windowTexture(T.windowWarm, 0.55), base: T.buildingColors[0] },
      { tex: windowTexture(T.windowCool, 0.35), base: T.buildingColors[1] },
      { tex: windowTexture(T.windowAccent, 0.7), base: T.buildingColors[2] },
    ];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    // shift origin to bottom so scaling grows upward
    boxGeo.translate(0, 0.5, 0);

    const per = Math.ceil(cands.length / variants.length);
    for (let v = 0; v < variants.length; v++) {
      const batch = cands.slice(v * per, (v + 1) * per);
      if (!batch.length) continue;
      const mat = new THREE.MeshStandardMaterial({
        color: variants[v].base,
        map: variants[v].tex,
        emissive: 0xffffff,
        emissiveMap: variants[v].tex,
        emissiveIntensity: 0.75,
        roughness: 0.85,
        metalness: 0.15,
      });
      const inst = new THREE.InstancedMesh(boxGeo, mat, batch.length);
      const m = new THREE.Matrix4();
      const color = new THREE.Color();
      batch.forEach((c, i) => {
        const h = T.minHeight + Math.random() * Math.random() * T.heightSpan;
        const w = T.minWidth + Math.random() * T.widthSpan;
        const d = T.minWidth + Math.random() * T.widthSpan;
        m.makeScale(w, h, d);
        m.setPosition(c.x, -0.4, c.z);
        inst.setMatrixAt(i, m);
        // subtle per-instance tint
        const t = 0.75 + Math.random() * 0.45;
        color.setRGB(t, t * (0.95 + Math.random() * 0.05), t * (0.9 + Math.random() * 0.1));
        inst.setColorAt(i, color);
      });
      inst.instanceMatrix.needsUpdate = true;
      this.boxMeshes.push(inst);
      this.group.add(inst);
    }

    // a few neon billboards near the track for Carbon flavour
    const neonColors = T.neonColors;
    for (let i = 0; i < T.neonCount; i++) {
      const s = samples[Math.floor((i / T.neonCount) * samples.length)];
      const side = i % 2 === 0 ? 1 : -1;
      const p = s.pos.clone().addScaledVector(s.normal, side * (track.halfWidth + 8));
      const w = 7 + Math.random() * 6;
      const h = 3 + Math.random() * 2;
      const billboard = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          color: neonColors[i % neonColors.length],
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        })
      );
      billboard.position.copy(p).setY(p.y + 6 + Math.random() * 6);
      billboard.rotation.y = Math.atan2(-s.normal.x * side, -s.normal.z * side);
      this.group.add(billboard);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.6 })
      );
      pole.position.copy(p).setY(p.y + 3);
      this.group.add(pole);
    }
  }

  /**
   * Scatter the real building models: prototypes banded by size, placed by
   * distance-to-track (low near the corridor, towers far out), one
   * InstancedMesh per (prototype × material-part). Landmark heroes go on a
   * far ring as individual meshes — tall silhouettes in the fog with lit
   * windows, the Carbon skyline read.
   */
  private buildModelCity(track: Track, protos: BuildingProto[]) {
    const T = this.theme;
    const MC = T.modelCity ?? { modelSpacing: 52, heroCount: 6, maxTowerHeight: 200 };
    const samples = track.samples;
    const heroCount = MC.heroCount;
    const maxProtoH = MC.maxTowerHeight;

    // candidate grid with per-candidate min distance to the corridor
    const spacing = MC.modelSpacing;
    const range = T.range;
    const cands: { x: number; z: number; d: number }[] = [];
    for (let x = -range; x <= range; x += spacing) {
      for (let z = -range; z <= range; z += spacing) {
        const jx = x + (Math.random() - 0.5) * spacing * 0.5;
        const jz = z + (Math.random() - 0.5) * spacing * 0.5;
        let min = Infinity;
        for (let i = 0; i < samples.length; i += 3) {
          const s = samples[i];
          const d = Math.hypot(s.pos.x - jx, s.pos.z - jz);
          if (d < min) min = d;
        }
        if (min > T.clearance + 8) cands.push({ x: jx, z: jz, d: min });
      }
    }

    // prototype pools per distance band (theme caps how tall the city gets —
    // the harbor keeps its mid band under the crane-line too, not just the far)
    const midCap = Math.min(110, maxProtoH);
    const nearPool = protos.filter((p) => p.height <= 32);
    const midPool = protos.filter((p) => p.height > 32 && p.height <= midCap);
    const farPool = protos.filter((p) => p.height > midCap && p.height <= maxProtoH);
    if (!nearPool.length && !midPool.length) return;

    const pickFor = (d: number): BuildingProto | null => {
      const pool = d < 130 ? nearPool : d < 380 ? midPool || farPool : farPool || midPool;
      if (!pool || !pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    };

    // assign candidates to prototypes
    const placements = new Map<BuildingProto, { x: number; z: number; rot: number; scale: number }[]>();
    for (const c of cands) {
      const proto = pickFor(c.d);
      if (!proto) continue;
      let list = placements.get(proto);
      if (!list) placements.set(proto, (list = []));
      list.push({
        x: c.x,
        z: c.z,
        // 4-way rotation reads as a real street grid at night
        rot: Math.floor(Math.random() * 4) * (Math.PI / 2) + (Math.random() - 0.5) * 0.06,
        scale: 0.85 + Math.random() * 0.4,
      });
    }

    // one InstancedMesh per (prototype × material part)
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    for (const [proto, list] of placements) {
      for (const part of proto.parts) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        inst.frustumCulled = false; // instances span the whole map
        list.forEach((p, i) => {
          pos.set(p.x, -0.4, p.z);
          q.setFromAxisAngle(up, p.rot);
          scl.setScalar(p.scale);
          m.compose(pos, q, scl);
          inst.setMatrixAt(i, m);
          // subtle per-instance tint so repeated protos don't read as clones
          const t = 0.8 + Math.random() * 0.35;
          col.setRGB(t, t * (0.96 + Math.random() * 0.04), t * (0.92 + Math.random() * 0.08));
          inst.setColorAt(i, col);
        });
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.group.add(inst);
      }
    }

    // landmark heroes: tall silhouettes on a fog ring past the scatter band
    const heroes = protos.filter((p) => p.height > 200 && p.height <= maxProtoH + 350).slice(0, heroCount);
    for (let i = 0; i < heroes.length; i++) {
      const angle = (i / heroes.length) * Math.PI * 2 + 0.35;
      // probe outward until clear of the corridor
      let radius = 400;
      let ok = false;
      for (; radius <= 620; radius += 40) {
        const hx = Math.cos(angle) * radius;
        const hz = Math.sin(angle) * radius;
        let min = Infinity;
        for (let s = 0; s < samples.length; s += 3) {
          const d = Math.hypot(samples[s].pos.x - hx, samples[s].pos.z - hz);
          if (d < min) min = d;
        }
        if (min > 170) { ok = true; break; }
      }
      if (!ok) continue;
      const hero = heroes[i];
      const holder = new THREE.Group();
      holder.position.set(Math.cos(angle) * radius, -0.4, Math.sin(angle) * radius);
      holder.rotation.y = Math.random() * Math.PI * 2;
      for (const part of hero.parts) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        holder.add(mesh);
      }
      this.group.add(holder);
    }
  }

  /** shipping-container stacks clustered along the corridor (harbor/industrial) */
  private buildContainers(track: Track, spec: { count: number; colors: number[] }) {
    const samples = track.samples;
    const hw = track.halfWidth;
    // 20-ft container: 6.1 long × 2.44 wide × 2.6 tall
    const geo = new THREE.BoxGeometry(6.1, 2.6, 2.44);
    // some stacks are 2-high (occasionally 3) — one instance per box
    let total = 0;
    const stacks: { x: number; z: number; rot: number; n: number }[] = [];
    for (let i = 0; i < spec.count; i++) {
      const s = samples[Math.floor(Math.random() * samples.length)];
      const side = Math.random() < 0.5 ? 1 : -1;
      // rows start past the rail, sprawl outward toward the warehouses
      const lateral = hw + 6 + Math.random() * 26;
      const along = (Math.random() - 0.5) * 26;
      const p = s.pos.clone().addScaledVector(s.normal, side * lateral).addScaledVector(s.tangent, along);
      const r = Math.random();
      const n = r < 0.45 ? 1 : r < 0.85 ? 2 : 3;
      stacks.push({ x: p.x, z: p.z, rot: Math.atan2(s.tangent.x, s.tangent.z), n });
      total += n;
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.25 });
    const inst = new THREE.InstancedMesh(geo, mat, total);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    let idx = 0;
    for (const st of stacks) {
      const pick = spec.colors[Math.floor(Math.random() * spec.colors.length)];
      col.setHex(pick);
      // per-box brightness jitter so a stack of same-colour boxes still reads
      const jitter = 0.82 + Math.random() * 0.3;
      col.multiplyScalar(jitter);
      q.setFromAxisAngle(up, st.rot);
      for (let k = 0; k < st.n; k++) {
        // second level sits slightly askew — yard workers aren't precise
        const wobble = k > 0 ? (Math.random() - 0.5) * 0.6 : 0;
        const qq = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, wobble));
        m.compose(new THREE.Vector3(st.x, -0.4 + 1.3 + k * 2.6, st.z), qq, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(idx, m);
        inst.setColorAt(idx, col);
        idx++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    this.group.add(inst);
  }

  /** harbour gantry cranes in a row parallel to the circuit */
  private buildCranes(track: Track, spec: { count: number; height: number; boom: number }) {
    const samples = track.samples;
    const hw = track.halfWidth;
    const steel = new THREE.MeshStandardMaterial({ color: 0xc23c26, roughness: 0.55, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.7 });
    const warn = new THREE.MeshBasicMaterial({ color: 0xff2233 });
    const legSpacing = spec.boom * 0.62;

    for (let i = 0; i < spec.count; i++) {
      // evenly spaced around the lap, alternating sides of the corridor
      const s = samples[Math.floor(((i + 0.5) / spec.count) * samples.length)];
      const side = i % 2 === 0 ? 1 : -1;
      const base = s.pos.clone().addScaledVector(s.normal, side * (hw + 26));
      const yaw = Math.atan2(s.tangent.x, s.tangent.z);
      const crane = new THREE.Group();
      crane.position.copy(base);
      crane.rotation.y = yaw;

      // two A-legs spanning the yard rows (along local x = track tangent)
      for (const lx of [-legSpacing / 2, legSpacing / 2]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, spec.height, 2.2), steel);
        leg.position.set(lx, spec.height / 2 - 0.4, 0);
        crane.add(leg);
        // diagonal brace
        const brace = new THREE.Mesh(new THREE.BoxGeometry(legSpacing / 2 + 1, 1.2, 1.2), steel);
        brace.position.set(lx / 2, spec.height * 0.55, 0);
        brace.rotation.y = Math.atan2(2, legSpacing / 2) * Math.sign(lx);
        crane.add(brace);
      }
      // top beam running parallel to the track
      const beam = new THREE.Mesh(new THREE.BoxGeometry(spec.boom, 2.6, 2.6), steel);
      beam.position.set(0, spec.height - 0.4, 0);
      crane.add(beam);
      // trolley + hanging spreader
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 3), dark);
      trolley.position.set((Math.random() - 0.5) * spec.boom * 0.5, spec.height - 2.6, 0);
      crane.add(trolley);
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), dark);
      cable.position.set(trolley.position.x, spec.height - 6.5, 0);
      crane.add(cable);
      const spreader = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.8, 2.6), dark);
      spreader.position.set(trolley.position.x, spec.height - 10, 0);
      crane.add(spreader);
      // aircraft-warning light
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), warn);
      light.position.set(0, spec.height + 1.4, 0);
      crane.add(light);

      this.group.add(crane);
    }
  }

  dispose() {
    this.disposed = true;
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      // prototype geometries/materials are cached for the app lifetime —
      // disposing them here would black out the next race's city
      if (m.geometry && m.geometry.userData.shared !== true) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const x of mats) if (x.userData.shared !== true) x.dispose();
    });
  }
}

/** grid of lit windows baked to a canvas texture */
function windowTexture(windowColor: string, litRatio: number): THREE.Texture {
  const cols = 12;
  const rows = 24;
  const cw = 12;
  const ch = 10;
  const canvas = document.createElement("canvas");
  canvas.width = cols * cw;
  canvas.height = rows * ch;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (Math.random() < litRatio) {
        const bright = 0.35 + Math.random() * 0.65;
        ctx.fillStyle = windowColor;
        ctx.globalAlpha = bright;
        ctx.fillRect(x * cw + 2, y * ch + 2, cw - 5, ch - 5);
        ctx.globalAlpha = 1;
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

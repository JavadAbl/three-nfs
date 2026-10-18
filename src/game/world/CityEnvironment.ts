// ─── Night city: instanced buildings, ground, stars, neon ───────────────────
import * as THREE from "three";
import type { Track } from "./Track";
import { ENV_THEMES, type EnvThemeSpec } from "../maps/registry";

export class CityEnvironment {
  group = new THREE.Group();
  private readonly theme: EnvThemeSpec;

  /** builds the world furniture from a map's environment theme */
  constructor(track: Track, theme: EnvThemeSpec = ENV_THEMES.city) {
    this.theme = theme;
    this.group.add(this.makeGround());
    this.group.add(this.makeStars());
    this.buildBuildings(track);
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

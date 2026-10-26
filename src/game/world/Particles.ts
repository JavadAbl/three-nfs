// ─── Lightweight particle pool for drift smoke / dust ───────────────────────
import * as THREE from "three";

interface Puff {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export class ParticlePool {
  points: THREE.Points;
  private puffs: Puff[] = [];
  private max: number;
  private positions: Float32Array;

  constructor(max = 220) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    const sizes = new Float32Array(max);
    const opacities = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      this.positions[i * 3 + 1] = -9999;
      this.puffs.push({
        pos: new THREE.Vector3(0, -9999, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTex: { value: puffTexture() } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (260.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying float vOpacity;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.82, 0.78, 0.72), t.a * vOpacity);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(pos: THREE.Vector3, strength: number) {
    const puff = this.puffs.find((p) => p.life <= 0);
    if (!puff) return;
    puff.pos.copy(pos);
    puff.vel.set((Math.random() - 0.5) * 2.4, 1.4 + Math.random() * 1.8, (Math.random() - 0.5) * 2.4);
    puff.maxLife = 0.85 + Math.random() * 0.5;
    puff.life = puff.maxLife;
    puff.size = 0.9 + Math.random() * 1.4 * strength;
  }

  update(dt: number) {
    const sizes = this.points.geometry.getAttribute("size") as THREE.BufferAttribute;
    const opacities = this.points.geometry.getAttribute("opacity") as THREE.BufferAttribute;
    for (let i = 0; i < this.max; i++) {
      const p = this.puffs[i];
      if (p.life > 0) {
        p.life -= dt;
        p.pos.addScaledVector(p.vel, dt);
        p.vel.multiplyScalar(1 - 1.4 * dt);
        p.size += dt * 1.9;
        const t = Math.max(p.life / p.maxLife, 0);
        this.positions[i * 3] = p.pos.x;
        this.positions[i * 3 + 1] = p.pos.y;
        this.positions[i * 3 + 2] = p.pos.z;
        sizes.array[i] = p.size;
        opacities.array[i] = t * 0.5;
      } else {
        this.positions[i * 3 + 1] = -9999;
        opacities.array[i] = 0;
      }
    }
    (this.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    sizes.needsUpdate = true;
    opacities.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

function puffTexture(): THREE.Texture {
  // v2: the old 64px single radial gradient read as a flat ghost blob. Real
  // tyre smoke is billowy: this bakes 5 overlapping offset radial lobes over
  // a 128px canvas so the silhouette is lumpy instead of perfectly round,
  // then subtracts a few darker holes for the interior wisps the eye uses
  // to read "volume". Cheaper than per-pixel noise and just as convincing
  // at drift-camera distance.
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const lobe = (x: number, y: number, r: number, a: number): void => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  // main body + asymmetric lobes break the circular symmetry
  lobe(cx, cy, size * 0.42, 0.5);
  lobe(cx - 18, cy - 10, size * 0.3, 0.32);
  lobe(cx + 15, cy + 12, size * 0.28, 0.3);
  lobe(cx + 8, cy - 22, size * 0.22, 0.26);
  lobe(cx - 12, cy + 20, size * 0.2, 0.24);
  // interior wisps: destination-out soft holes give the puff inner structure
  ctx.globalCompositeOperation = "destination-out";
  lobe(cx - 14, cy + 6, size * 0.14, 0.5);
  lobe(cx + 16, cy - 8, size * 0.12, 0.45);
  lobe(cx + 2, cy + 18, size * 0.1, 0.4);
  ctx.globalCompositeOperation = "source-over";
  return new THREE.CanvasTexture(canvas);
}

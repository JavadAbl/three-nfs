// ─── SpeedLines: view-space wind streaks (procedural, zero assets) ──────────
// Thin additive threads rushing past the camera sell raw velocity on top of
// the radial blur: NFS-boost "zoom lines" without a single texture. Each
// streak is a hair-thin quad living in a ring around the view axis (never
// over the racing line), flying toward the camera at ~0.9× the car's speed.
// The radius is fixed while depth shrinks, so streaks veer radially OUTWARD
// as they pass — they exit the FOV long before the wrap, which is therefore
// invisible.
//
// Visibility + length are fed by Game.updateSpeedFX: they fade in above
// ~140 km/h, and on nitro they run longer, brighter, and lean toward the
// car's neon colour (same source as the flames/underglow identity).
//
// One ShaderMaterial, one compiled program, per-streak phase baked as a
// vertex attribute — 26 tiny draw calls only while visible at speed, zero
// cost while parked (the group hides itself).
import * as THREE from "three";

const COUNT = 26;
/** spawn depth range ahead of the camera (metres, view space) */
const FAR_Z = 40;
/** streaks recycle behind this depth — by then they've left the FOV */
const WRAP_Z = 2.2;
/** reference ring radius — per-streak factor 0.2..0.95 of this (~12-44°) */
const RADIUS = 34;

const vert = /* glsl */ `
  attribute float aPhase;   // per-streak random 0..1 — shimmer offset
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    vUv = uv;
    vPhase = aPhase;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uAlpha;  // global visibility (speed ramp × drama knob)
  uniform float uNitro;  // 0..1 nitro slam — brightens + neon-tints the threads
  uniform float uTime;
  uniform vec3 uColor;   // base icy white-blue
  uniform vec3 uNeon;    // the car's neon pick — boost leans the streaks into it
  varying vec2 vUv;
  varying float vPhase;
  void main() {
    // fade both ends and across the width — a soft thread, never a hard card
    float along = sin(vUv.y * 3.14159);
    float across = smoothstep(0.5, 0.16, abs(vUv.x - 0.5));
    // per-streak shimmer so the field never pulses in sync
    float tw = 0.55 + 0.45 * sin(uTime * (10.0 + vPhase * 14.0) + vPhase * 41.0);
    vec3 col = mix(uColor, uNeon, uNitro * 0.6);
    float a = uAlpha * (0.75 + 0.25 * uNitro) * tw * along * across;
    gl_FragColor = vec4(col * a, a);
  }
`;

interface Streak {
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  angle: number; // ring angle around the view axis
  rFac: number; // ring radius factor (× RADIUS)
  z: number; // depth ahead of the camera (negative view space)
  width: number; // metres
  lenFac: number; // per-streak length variance
}

export class SpeedLines {
  /** add to the scene root — synced to the camera transform every frame */
  readonly group = new THREE.Group();
  private readonly mat: THREE.ShaderMaterial;
  private readonly streaks: Streak[] = [];
  private clock = 0;

  constructor(neon: THREE.Color) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uAlpha: { value: 0 },
        uNitro: { value: 0 },
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0.82, 0.9, 1.0) },
        uNeon: { value: neon.clone() },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // speed lines draw over the world on purpose (NFS boost look) — they
      // live in the mid-periphery band and are hair-thin
      depthTest: false,
    });
    for (let i = 0; i < COUNT; i++) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const phase = Math.random();
      geo.setAttribute(
        "aPhase",
        new THREE.BufferAttribute(new Float32Array(4).fill(phase), 1),
      );
      const mesh = new THREE.Mesh(geo, this.mat);
      // quad lies in XZ — its height axis runs along Z (toward the camera)
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 999;
      const s: Streak = {
        mesh,
        geo,
        angle: 0,
        rFac: 0,
        z: 0,
        width: 0.03 + Math.random() * 0.03,
        lenFac: 0.75 + Math.random() * 0.5,
      };
      this.streaks.push(s);
      this.respawn(s, -(FAR_Z * 0.45 + Math.random() * FAR_Z * 0.55));
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  private respawn(s: Streak, z: number) {
    s.angle = Math.random() * Math.PI * 2;
    s.rFac = 0.2 + Math.random() * 0.75;
    s.z = z;
  }

  /**
   * Per-frame sync. dt for the shimmer clock, camera for the view transform,
   * speedMs for the fly-past motion, speedFrac/nitro/alpha for length,
   * colour and visibility (all computed in Game.updateSpeedFX so the rAF
   * loop and debugTick feed identical math).
   */
  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    speedMs: number,
    speedFrac: number,
    nitro: number,
    alpha: number,
  ) {
    this.clock += dt;
    this.mat.uniforms.uTime.value = this.clock;
    this.mat.uniforms.uAlpha.value = alpha;
    this.mat.uniforms.uNitro.value = nitro;
    this.group.visible = alpha > 0.01;
    if (!this.group.visible) return;
    // view-space rig: copy the camera transform so the ring always frames
    // the view — camera-attached without parenting (Game's camera is a
    // free-floating object, not a scene child)
    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    const len = 1.6 + 4.4 * speedFrac + 2.2 * nitro;
    for (const s of this.streaks) {
      // world rushes past at car speed; 0.92× keeps a touch of parallax
      s.z += speedMs * dt * 0.92;
      if (s.z > -WRAP_Z) this.respawn(s, -(FAR_Z - Math.random() * FAR_Z * 0.4));
      const r = s.rFac * RADIUS;
      s.mesh.position.set(Math.cos(s.angle) * r, Math.sin(s.angle) * r, s.z);
      s.mesh.scale.set(s.width, len * s.lenFac, 1);
    }
  }

  dispose() {
    this.mat.dispose();
    for (const s of this.streaks) s.geo.dispose();
    this.streaks.length = 0;
    this.group.clear();
  }
}

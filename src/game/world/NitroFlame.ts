// ─── Procedural nitro exhaust flame — pure shader, zero assets ──────────────
// Replaces the old orange cones (two MeshBasic cones) with a volumetric-looking
// crossed-quad flame: 3 shader planes rotated 60° apart around the exhaust axis
// read as a fiery volume from any camera angle — no billboarding pass needed.
//
// The fragment shader scrolls fbm noise along the flame length to make the
// licks rise, tapers the tail, and maps heat to an NFS-style colour ramp:
// white-hot core → electric blue → violet fringe, with a soft radial glow
// baked around the nozzle. uPower is smoothed in update() so the flame fades
// in/out instead of snapping with the boost key.
import * as THREE from "three";

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform float uTime;   // seconds — scrolls the noise field upward
  uniform float uPower;  // 0..1 smoothed boost intensity
  uniform float uPhase;  // per-flame random offset — fleet never pulses in sync
  uniform vec3 uColor;    // the car's neon colour — flame matches the underglow
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + 11.7;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // uv space: y=0 at the nozzle, y=1 at the tail tip; x centered at 0.5
    float along = vUv.y;
    float radial = abs(vUv.x - 0.5) * 2.0;

    // scrolling fire noise — faster turbulence near the nozzle
    float t = uTime * 2.4 + uPhase;
    float n = fbm(vec2(vUv.x * 3.0 + uPhase, along * 2.6 - t));
    n += 0.5 * fbm(vec2(vUv.x * 6.0 - uPhase * 2.0, along * 5.2 - t * 1.7));

    // body mask: bulge ~25% out, taper to a point at the tip; the noise eats
    // ragged licks into the silhouette so it never reads as a flat card
    float width = sin(pow(along, 0.72) * 3.14159);
    float edge = smoothstep(width, width * 0.35, radial);
    float dissolve = smoothstep(1.15, 0.25, along * (1.35 - n * 0.9));
    float flame = edge * dissolve;

    // heat: hottest at the nozzle, cooling toward the tail
    float heat = flame * (1.25 - along * 1.05) + n * 0.12;

    // colour ramp — narrow white-hot core, neon mid, deep neon fringe.
    // uColor is the car's neon pick (same source as the underglow), so the
    // flame always matches the car's lighting identity; default electric blue
    vec3 col = mix(uColor * 1.05, vec3(1.0), smoothstep(0.78, 1.12, heat));
    col = mix(col, uColor * 0.42, smoothstep(0.62, 0.1, heat));

    // soft round glow hugging the nozzle — sells the light spill at night
    float glow = exp(-radial * radial * 7.0) * exp(-along * 5.5) * 0.8;
    col += uColor * glow;

    float alpha = clamp(flame * 1.35, 0.0, 1.0) * uPower;
    alpha += glow * uPower * 0.5;
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

export class NitroFlame {
  /** attach this to the car body at the exhaust tip */
  readonly root = new THREE.Group();
  private readonly mat: THREE.ShaderMaterial;
  private readonly geos: THREE.PlaneGeometry[] = [];
  private power = 0;
  private clock = 0;
  private readonly phase: number;

  constructor(
    x: number,
    y: number,
    z: number,
    opts: { length?: number; width?: number; scale?: number; neon?: THREE.Color } = {}
  ) {
    this.phase = Math.random() * 100;
    this.root.position.set(x, y, z);
    // slight upward tilt — exhaust gas shears off the bumper line
    this.root.rotation.x = -0.06;

    const len = (opts.length ?? 1.5) * (opts.scale ?? 1);
    const wid = (opts.width ?? 0.42) * (opts.scale ?? 1);
    const neon = opts.neon ?? new THREE.Color(0.2, 0.45, 1.0); // electric blue default

    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: Math.random() * 10 },
        uPower: { value: 0 },
        uPhase: { value: this.phase },
        uColor: { value: neon.clone() },
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // crossed quads: the plane spans the flame (base at origin, tip at -Z
    // after the -90° X rotation), each wrapper spins it 60° around the
    // exhaust axis — three cards cover all camera angles with no math per
    // frame
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.PlaneGeometry(wid, len, 1, 1);
      geo.translate(0, len / 2, 0); // base edge at the origin
      this.geos.push(geo);
      const quad = new THREE.Mesh(geo, this.mat);
      quad.rotation.x = -Math.PI / 2; // +Y (flame height) → -Z (backwards)
      const wrap = new THREE.Group();
      wrap.rotation.z = (i * Math.PI) / 3;
      wrap.add(quad);
      this.root.add(wrap);
    }
    this.root.visible = false;
  }

  /** smooth power follow + time scroll; call once per frame from the car's
   *  visual sync with the boost state (latched empty ⇒ false, no flicker) */
  update(dt: number, active: boolean) {
    const target = active ? 1 : 0;
    // ~40 ms attack, ~90 ms release — reads instant but never snaps
    this.power += (target - this.power) * (1 - Math.exp(-(active ? 26 : 12) * dt));
    if (this.power < 0.015) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    this.clock += dt * (0.7 + 1.5 * this.power);
    this.mat.uniforms.uTime.value = this.clock;
    this.mat.uniforms.uPower.value = this.power;
    // flame length flickers per frame — turbopop instead of a static card
    const jitter = 0.82 + Math.random() * 0.36;
    this.root.scale.set(0.8 + 0.3 * this.power, 0.8 + 0.3 * this.power, (0.55 + 0.45 * this.power) * jitter);
  }

  dispose() {
    this.mat.dispose();
    for (const g of this.geos) g.dispose();
  }
}

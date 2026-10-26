// ─── Car: arcade physics + procedural low-poly visual OR GLB model ───────
import * as THREE from "three";
import { DEFAULT_CAR_TUNING, type CarTuning } from "../cars/registry";
import type { Track, TrackLocation } from "./Track";
import type { CarControls } from "../core/Input";
import {
  LAMP_HEAD_INTENSITY,
  LAMP_TAIL_INTENSITY,
  type CarModelInstance,
  type ModelWheel,
} from "./CarModelLoader";
import { buildMuscleBody, buildMuscleWheel, MUSCLE_WHEEL_POS } from "./ProceduralMuscle";
import { headPalette, type HeadlampStyle } from "./LampStyle";

export type CarKind = "player" | "ai" | "remote";

export interface CarSnapshot {
  p: [number, number, number];
  h: number;
  s: number;
  lap: number;
  cp: number;
  prog: number;
  drifting: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const _rel = new THREE.Vector3();
const _clamped = new THREE.Vector3();

/** night-lights master switch — headlight beams, sodium paint-fill and
 *  rival cones are night furniture. Game sets this from the theme's
 *  timeOfDay BEFORE constructing cars (module-level on purpose: cars are
 *  built in several places and all of them belong to one race); default
 *  true keeps every existing night map identical. Daytime maps run with
 *  ALL lamp furniture off: beams (perf), glow sprites and the neon
 *  underglow read wrong under a full sun, so day cars carry dark lens
 *  boxes only — lights-off, as real cars do at noon. */
let nightLights = true;
export function setCarNightLights(v: boolean): void {
  nightLights = v;
}

export class Car {
  controls: CarControls = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
  /** world position (y follows road) */
  pos = new THREE.Vector3();
  /** yaw heading, forward = (sin h, 0, cos h) */
  heading = 0;
  /** velocity vector (xz plane) */
  vel = new THREE.Vector3();
  /** forward speed m/s */
  speed = 0;
  /** per-car physics profile (resolved from the registry at spawn) */
  tuning: CarTuning = DEFAULT_CAR_TUNING;
  nitro = DEFAULT_CAR_TUNING.nitroCapacity;
  kind: CarKind;
  color: string;
  name: string;
  /** last track location result (updated in update()) */
  loc: TrackLocation | null = null;
  /** current drift angle (rad) — angle between velocity and heading */
  slipAngle = 0;
  /** drift points accumulated this race */
  driftScore = 0;
  /** live drift chain points (resets when drift ends) */
  driftChain = 0;
  drifting = false;
  private driftTimer = 0;
  private lastTrackIndex = -1;

  // visuals
  group = new THREE.Group();
  private bodyGroup = new THREE.Group();
  /** collision footprint (metres): half width / half length of the body box */
  collHalfW = 1.05;
  collHalfL = 2.35;
  /**
   * visual body metrics (metres, model frame: +Z = front, y up from ground)
   * used by the camera rig to anchor cockpit views — GLB bounds on model
   * cars, hand-tuned defaults for the procedural muscle car
   */
  camDims: { frontZ: number; rearZ: number; topY: number; length: number; width: number } = {
    frontZ: 2.58,
    rearZ: -2.02,
    topY: 1.25,
    length: 4.6,
    width: 2.05,
  };
  /** guardrail impact strength this frame (m/s) — consumed by Game for FX */
  railHit = 0;
  private wheels: THREE.Group[] = [];
  private modelWheels: ModelWheel[] = [];
  private model?: CarModelInstance;
  private wheelRadius = 0.38;
  private wheelSpin = 0;
  private brakeLights!: THREE.Mesh;
  /** the model's own lit lamp-lens materials (GLB path) — CarModelLoader lit
   * them at template time; we re-apply per time-of-day (night glow / day
   * dark until braking) and flare the tails while braking. Per-instance
   * clones, so one car's brake flash never lights up its same-model rivals.
   * Empty on procedural cars (their lamp boxes are their own lamps). */
  private lampHead: THREE.MeshStandardMaterial[] = [];
  private lampTail: THREE.MeshStandardMaterial[] = [];
  /** resting tail-lamp intensity — night LAMP_TAIL_INTENSITY / day 0 */
  private lampTailBase = 0;
  private nitroFlames: THREE.Mesh[] = [];
  private headBeamL?: THREE.SpotLight;
  private headBeamR?: THREE.SpotLight;
  /** rival fake-beam cone material (kept for the runtime style swap) */
  private headConeMat?: THREE.MeshBasicMaterial;
  /** syncVisual re-applies this to the beams every frame (legacy "hot beams"
   * tune) — follows the active headlamp style so a xenon swap is not
   * flattened back to the halogen brightness */
  private headBeamForced = 95;
  /** neon underglow plane (night maps only) — visibility is runtime-togglable
   * via setUnderglow; null on day maps and cars built without one */
  private underglowMesh?: THREE.Mesh;
  private label?: THREE.Sprite;
  private rollVisual = 0;
  /** resources owned by this instance (model cars share template resources) */
  private owned: (THREE.Material | THREE.Texture)[] = [];

  /** smoke emission request consumed by the particle pool owner */
  smokeRequest: { pos: THREE.Vector3; strength: number } | null = null;

  constructor(
    kind: CarKind,
    color: string,
    name = "",
    model?: CarModelInstance,
    tuning?: CarTuning
  ) {
    this.kind = kind;
    this.color = color;
    this.name = name;
    this.model = model;
    if (tuning) {
      this.tuning = tuning;
      this.nitro = tuning.nitroCapacity;
    }
    this.buildVisual();
  }

  // ─── visual construction ────────────────────────────────────────────────

  private buildVisual() {
    if (this.model) this.buildModelVisual();
    else this.buildProceduralVisual();
  }

  // ─── GLB model path — real car with procedural lights/flare FX ──────────
  private buildModelVisual() {
    const m = this.model!;
    this.wheelRadius = m.wheelRadius || 0.38;
    this.modelWheels = m.wheels;
    this.bodyGroup.add(m.root);

    const d = m.dims;
    this.camDims = { frontZ: d.frontZ, rearZ: d.rearZ, topY: d.topY, length: d.length, width: d.width };
    const w2 = d.width / 2;
    this.collHalfW = THREE.MathUtils.clamp(d.width / 2, 0.85, 1.5);
    this.collHalfL = THREE.MathUtils.clamp(d.length / 2, 2.0, 3.0);

    // NO fake lamp furniture on model cars: the old floating head/tail lamp
    // boxes and the additive glow quads (the "wrapper pages" hovering over
    // the real lenses) are gone — every model's OWN lamp lenses are the lamps
    // now. CarModelLoader lights the lens geometry at template time (single
    // lamp meshes AND lamp primitives merged inside multi-material bodies);
    // here we drive those materials by time-of-day: night maps glow, day
    // maps run dark until braking. Real illumination still comes from the
    // SpotLight beams + sodium fill in attachHeadlightsAndLabel; the brake
    // bar below (plus the real tail lenses) flashes on braking only.
    for (const { mat, front } of m.lampMats) {
      this.owned.push(mat);
      (front ? this.lampHead : this.lampTail).push(mat);
    }
    const headI = nightLights ? LAMP_HEAD_INTENSITY : 0;
    this.lampTailBase = nightLights ? LAMP_TAIL_INTENSITY : 0;
    for (const s of this.lampHead) s.emissiveIntensity = headI;
    for (const s of this.lampTail) s.emissiveIntensity = this.lampTailBase;
    let glowTex: THREE.Texture | null = null;
    if (nightLights) {
      glowTex = radialGlowTexture(); // underglow's texture
      this.owned.push(glowTex);
    }
    // brake bar — hidden at rest (the per-frame update drives opacity),
    // flashes red across the tail only while actually braking
    this.brakeLights = new THREE.Mesh(
      new THREE.BoxGeometry(d.width * 0.8, 0.09, 0.06),
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.owned.push(this.brakeLights.material as THREE.Material);
    this.brakeLights.position.set(0, d.topY * 0.62, d.rearZ + 0.03);
    this.bodyGroup.add(this.brakeLights);

    // nitro flames
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.owned.push(flameMat);
    for (const sx of [1, -1]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.75, 7), flameMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(sx * w2 * 0.35, 0.32, d.rearZ - 0.35);
      flame.visible = false;
      this.nitroFlames.push(flame);
      this.bodyGroup.add(flame);
    }

    // underglow — polygonOffset + clearance keeps it from z-fighting the
    // road when the body pitches/rolls over crests (looked like noise);
    // neon-clamped so even black paint throws a visible glow. Night-only:
    // neon under daylight paint is the wrong kind of toy.
    if (nightLights) {
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex!,
        color: neonGlowColor(this.color),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      this.owned.push(glowMat);
      const underglow = new THREE.Mesh(
        new THREE.PlaneGeometry(d.width + 0.7, d.length + 0.9),
        glowMat
      );
      underglow.rotation.x = -Math.PI / 2;
      underglow.position.y = 0.09;
      underglow.renderOrder = 2;
      this.underglowMesh = underglow;
      this.bodyGroup.add(underglow);
    }

    this.attachHeadlightsAndLabel(d);

    this.group.add(this.bodyGroup);
    this.group.castShadow = true;
  }

  private attachHeadlightsAndLabel(d: { frontZ: number; topY: number; width: number; length: number }) {
    const w2 = d.width / 2;
    // night maps only: real headlight beams + sodium fill. (Day maps skip
    // them — see setCarNightLights.)
    if (nightLights) {
      if (this.kind === "player") {
        for (const sx of [0.62, -0.62]) {
          const beam = new THREE.SpotLight(0xfff0c8, 90, 90, 0.45, 0.55, 1.6);
          beam.position.set(sx * w2, d.topY * 0.55, d.frontZ - 0.1);
          const target = new THREE.Object3D();
          target.position.set(sx * 6, 0, d.frontZ + 34);
          this.bodyGroup.add(target);
          beam.target = target;
          this.bodyGroup.add(beam);
          if (sx > 0) this.headBeamL = beam;
          else this.headBeamR = beam;
        }
      } else {
        // real single-beam headlight for rivals — their stretch of road now
        // visibly lights up (they used to be dark silhouettes with a faint
        // fake cone); short target + low decay concentrates a warm pool 5-15m
        // ahead where the chase cam actually sees it; no shadow pass to keep
        // the per-light cost minimal
        const beam = new THREE.SpotLight(0xfff0c8, 110, 55, 0.5, 0.6, 1.2);
        beam.position.set(0, d.topY * 0.5, d.frontZ - 0.05);
        const target = new THREE.Object3D();
        target.position.set(0, 0, d.frontZ + 16);
        this.bodyGroup.add(target, beam);
        beam.target = target;
        this.headBeamL = beam; // single beam — reused slot so style swaps reach it

        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xfff0c0,
          transparent: true,
          opacity: 0.07,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        this.owned.push(coneMat);
        this.headConeMat = coneMat;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 16, 8, 1, true), coneMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, 0.5, d.frontZ + 9.5);
        this.bodyGroup.add(cone);
      }
      // warm city-bounce fill above every car — the streetlights are emissive
      // decals, so without this NOTHING lights car bodies at night; a small
      // sodium-tinted point light makes the paint read like the car is
      // driving through lit zones
      const fill = new THREE.PointLight(0xffe2b8, 6, 11, 1.8);
      fill.position.set(0, d.topY + 0.55, -0.2);
      this.bodyGroup.add(fill);
    }
    if (this.kind === "remote") this.addLabel(d.topY);

    // (headlight bloom sprites removed — same "wrapper page" impostors as
    // the tail glow quads; the model's own lit lens meshes flare on their own
    // now, boosted in CarModelLoader.splitDarkLamps to carry the night look)
  }

  // ─── runtime night-style swap (dev compare / tuning affordance) ─────────
  /** live halogen ⇄ xenon swap: lens emissive tint/intensity, player beam
   * SpotLight params and the rival cone re-tint in place — no rebuild, so a
   * frame never mixes styles. Lamp materials are per-instance clones, so
   * this car only changes its own lenses (fleet consistency is the caller's
   * choice — see the __nightFx hook in Game). */
  setHeadStyle(style: HeadlampStyle): void {
    const p = headPalette(style);
    this.headBeamForced = p.syncIntensity;
    for (const s of this.lampHead) {
      s.emissive.copy(p.lens);
      s.emissiveIntensity = p.lensIntensity;
    }
    for (const b of [this.headBeamL, this.headBeamR]) {
      if (!b) continue;
      b.color.setHex(p.beamColor);
      b.intensity = p.beamIntensity;
      b.distance = p.beamDistance;
      b.angle = p.beamAngle;
      b.penumbra = p.beamPenumbra;
    }
    this.headConeMat?.color.setHex(p.coneColor);
  }

  /** hide/show the neon underglow plane (night maps only; no-op by day) */
  setUnderglow(on: boolean): void {
    if (this.underglowMesh) this.underglowMesh.visible = on;
  }

  // ─── procedural fallback path (original stacked-box muscle car) ─────────
  private buildProceduralVisual() {
    this.collHalfW = 1.05; // body 2.05 wide, wheels at ±0.95
    this.collHalfL = 2.35; // 4.6 long + bumpers

    // shared muscle silhouette — the same builder the showroom turntable
    // uses, so the car you preview in the garage is the car you drive
    // (shell carries body + glass + trim; disposal via the traverse below)
    const shell = buildMuscleBody(this.color);
    this.bodyGroup.add(shell.root);

    // lights — day maps get dark lens boxes instead of lit lamps
    const headMat = new THREE.MeshBasicMaterial({ color: nightLights ? 0xfff2cf : 0x4d5157 });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), headMat);
    headL.position.set(0.62, 0.48, 2.58);
    const headR = headL.clone();
    headR.position.x = -0.62;
    const tailMat = new THREE.MeshBasicMaterial({ color: nightLights ? 0xff2222 : 0x571c1c });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.08), tailMat);
    tailL.position.set(0.6, 0.62, -2.63);
    const tailR = tailL.clone();
    tailR.position.x = -0.6;
    this.brakeLights = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.1, 0.06),
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.brakeLights.position.set(0, 0.72, -2.64);

    // tail bloom sprites (see model path — matches emissive rivals); night
    // only, same rule as every other lamp
    let glowTex: THREE.Texture | null = null;
    if (nightLights) {
      glowTex = radialGlowTexture();
      const tailGlowMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xff2a1a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.owned.push(tailGlowMat, glowTex);
      for (const x of [0.6, -0.6]) {
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), tailGlowMat);
        glow.rotation.y = Math.PI;
        glow.position.set(x, 0.62, -2.68);
        glow.renderOrder = 3;
        this.bodyGroup.add(glow);
      }
    }

    // exhaust flames (nitro)
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xffb347,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    for (const x of [0.45, -0.45]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.8, 7), flameMat);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, 0.34, -2.75);
      flame.visible = false;
      this.nitroFlames.push(flame);
      this.bodyGroup.add(flame);
    }

    // underglow (NFS night vibe) — offset material avoids road z-fighting;
    // neon-clamped so dark paints still glow (see model path); night only
    let underglow: THREE.Mesh | null = null;
    if (nightLights) {
      underglow = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 6.0),
        new THREE.MeshBasicMaterial({
          map: glowTex!,
          color: neonGlowColor(this.color),
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        })
      );
      underglow.rotation.x = -Math.PI / 2;
      underglow.position.y = 0.09;
      underglow.renderOrder = 2;
      this.underglowMesh = underglow;
    }

    // wheels — shared builder (tire + gold rim), slots + front flags from
    // the same single source the showroom preview uses
    for (const [x, y, z, front] of MUSCLE_WHEEL_POS) {
      const wheel = buildMuscleWheel();
      wheel.position.set(x, y, z);
      (wheel as unknown as { isFront: boolean }).isFront = front;
      this.wheels.push(wheel);
      this.bodyGroup.add(wheel);
    }

    for (const m of [headL, headR, tailL, tailR, this.brakeLights]) this.bodyGroup.add(m);
    if (underglow) this.bodyGroup.add(underglow);

    this.attachHeadlightsAndLabel({ frontZ: 2.58, topY: 1.25, width: 2.05, length: 4.6 });

    this.group.add(this.bodyGroup);
    this.group.castShadow = true;
  }

  private addLabel(topY = 1.25) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(10,10,12,0.75)";
    roundRect(ctx, 4, 8, 248, 48, 10);
    ctx.fill();
    ctx.font = "bold 30px 'Arial Black', sans-serif";
    ctx.fillStyle = this.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.name.slice(0, 14).toUpperCase(), 128, 33);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    this.owned.push(tex, sprite.material as THREE.Material);
    sprite.scale.set(5.2, 1.3, 1);
    sprite.position.y = topY + 1.4;
    this.group.add(sprite);
    this.label = sprite;
  }

  // ─── physics ────────────────────────────────────────────────────────────

  placeAt(startPos: THREE.Vector3, heading: number) {
    this.pos.copy(startPos);
    this.heading = heading;
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.lastTrackIndex = -1;
    this.slipAngle = 0;
    this.driftChain = 0;
    this.drifting = false;
    this.syncVisual(0);
  }

  get forward() {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  get right() {
    return new THREE.Vector3(-Math.cos(this.heading), 0, Math.sin(this.heading));
  }

  /** Lap progress helpers filled by RaceManager */
  lap = 0;
  checkpoint = 0;
  progress = 0;
  finished = false;
  finishTime = 0;

  update(dt: number, track: Track, controlsEnabled: boolean) {
    const T = this.tuning;
    const c = this.controls;

    // locate on track (hint = last index for O(1) search)
    this.loc = track.locate(this.pos, this.lastTrackIndex);
    this.lastTrackIndex = this.loc.index;
    const loc = this.loc;
    const offRoad = Math.abs(loc.lateral) > track.halfWidth;

    // ── decompose velocity ──
    const fwd = this.forward;
    const rgt = this.right;
    let vf = this.vel.dot(fwd);
    let vr = this.vel.dot(rgt);

    if (controlsEnabled && !this.finished) {
      // ── engine / brake ──
      const boosting = c.nitro && this.nitro > 0 && vf > 2;
      if (boosting) {
        this.nitro = Math.max(0, this.nitro - T.nitroDrain * dt);
        // Nitro is ACCELERATION ONLY — never a temporary top-speed raise
        // (user directive: "nitro should not add temp top speed; nitro is all
        // about acc"). The boost tapers linearly to zero at the car's natural
        // top speed (full-throttle drag equilibrium, enginePower/drag), so
        // holding nitro reaches the same ceiling the engine alone would —
        // just much faster. Past that point the boost is gone and the
        // engine/drag balance reasserts itself; off-road, the extra drag
        // still caps well below this line.
        const naturalTop = T.enginePower / T.drag;
        const fade = THREE.MathUtils.clamp((naturalTop - vf) / (naturalTop * T.nitroFadeSpan), 0, 1);
        vf += T.nitroPower * fade * dt;
      } else {
        this.nitro = Math.min(T.nitroCapacity, this.nitro + T.nitroRegen * dt);
      }
      if (c.throttle > 0) vf += T.enginePower * c.throttle * dt * (vf < 0 ? 2.2 : 1);
      if (c.brake > 0) {
        if (vf > 0.4) vf -= T.brakeForce * c.brake * dt;
        else vf -= T.reversePower * c.brake * dt;
      }
      if (c.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt);
      this.nitroActive = boosting;

      // ── steering ──
      const speedFactor = THREE.MathUtils.clamp(Math.abs(vf) / 3, 0, 1); // no turn at standstill
      const falloff = THREE.MathUtils.lerp(
        1,
        T.steerFalloffMin,
        THREE.MathUtils.clamp((Math.abs(vf) - T.steerFalloffStart) / (T.maxSpeed - T.steerFalloffStart), 0, 1)
      );
      // lateral-grip cap: rotating the car costs lateral acceleration a = v·ω.
      // The raw steerRate model allowed up to ~7g — cars swivelled like
      // spinning tops at speed (user: "the cars turn very fast"). The cap is
      // the tire budget: yaw faster than the car can be pulled sideways is
      // physically impossible, and it is what makes cornering feel weighted.
      // 1.4-1.8g proved over-restrained though (user: "too tame, all cars")
      // — the arcade fleet now runs 2.45-2.95g (registry maxLatAccel):
      // decisive turn-in at 200+ km/h, hairpins still need braking.
      // But a FLAT budget felt right only at low speed: its 1/v yaw cap
      // strangled highway cornering (user: "good at low speed but too tame
      // at high speed") — full lock at 250+ km/h was a ~230 m radius, and
      // any steering past ~40% input clipped to nothing. The budget now
      // grows with speed (downforce illusion, latAccelSpeedBoost): ~2× at
      // top speed, halved turn radii at speed, low-speed feel untouched.
      // Handbrake grants a 1.6× rotation bonus: sliding rears free up yaw,
      // so drift entries stay punchy and counter-steerable.
      const latBudget =
        T.maxLatAccel *
        (1 + T.latAccelSpeedBoost * THREE.MathUtils.clamp(Math.abs(vf) / T.maxSpeed, 0, 1));
      const latCap = (latBudget / Math.max(Math.abs(vf), 3.5)) * (c.handbrake ? 1.6 : 1);
      const yawRate =
        THREE.MathUtils.clamp(c.steer * T.steerRate * falloff * speedFactor, -latCap, latCap) *
        (vf < -0.5 ? -1 : 1);
      this.heading -= yawRate * dt;
    } else {
      this.nitroActive = false;
    }

    // ── drag & clamps ──
    const dragCoef = T.drag + (offRoad ? T.offRoadDrag : 0);
    vf -= vf * dragCoef * dt;
    if (c.handbrake) vf -= vf * 0.25 * dt;
    // NOTE: this ceiling is speed-safety only and does NOT lift while nitro
    // is held — nitro buys acceleration, not top speed (the boost above
    // fades out at the car's natural enginePower/drag equilibrium, which
    // sits far below this wall).
    vf = THREE.MathUtils.clamp(vf, -T.maxReverseSpeed, T.maxSpeed);

    // ── lateral grip / drift ──
    const gripNow = c.handbrake ? T.driftGrip : T.grip * (1 - 0.25 * THREE.MathUtils.clamp(Math.abs(vf) / T.maxSpeed, 0, 1));
    vr -= vr * Math.min(gripNow * dt, 0.95);
    // centrifugal bleed: turning at speed naturally pushes lateral velocity
    const turnPush = c.steer * Math.abs(vf) * 0.55 * dt * (c.handbrake ? 1.8 : 1);
    vr += -turnPush * (vf < -0.5 ? -1 : 1) * (c.handbrake ? 1 : 0.35);

    // ── recompose & integrate ──
    const fwd2 = this.forward;
    const rgt2 = this.right;
    this.vel.copy(fwd2).multiplyScalar(vf).addScaledVector(rgt2, vr);
    this.pos.addScaledVector(this.vel, dt);
    this.speed = vf;

    // ── guardrail collision — clamp the car BODY edge to the rail mesh ──
    // The rail visual stands at track.railLateral; the old clamp wall sat
    // 2.2m beyond it, which let cars drive straight through the guardrail.
    const s = track.sampleAt(loc.index);
    _rel.copy(this.pos).sub(s.pos);
    const lateralNow = _rel.dot(s.normal); // post-integration, frame-local
    const maxLateral = track.railLateral - this.collHalfW;
    this.railHit = 0;
    if (Math.abs(lateralNow) > maxLateral) {
      const sign = Math.sign(lateralNow);
      // keep along-track progress so rail-scraping at speed doesn't snap back
      const along = _rel.dot(s.tangent);
      _clamped
        .copy(s.pos)
        .addScaledVector(s.tangent, along)
        .addScaledVector(s.normal, sign * maxLateral);
      this.pos.x = _clamped.x;
      this.pos.z = _clamped.z;
      // reflect outward velocity component, scrub energy off along the rail
      const vlat = this.vel.dot(s.normal);
      if (Math.sign(vlat) === sign && Math.abs(vlat) > 0.05) {
        this.vel.addScaledVector(s.normal, -vlat * 1.45); // bounce back inward
        // hard hits scrub a lot of speed; shallow grinds bleed gently
        this.vel.multiplyScalar(Math.abs(vlat) > 3 ? 0.82 : 0.97);
        this.railHit = Math.min(Math.abs(vlat), 18);
        // scrape dust at the contact point
        if (Math.abs(vlat) > 3 && Math.random() < 0.75) {
          const contact = this.pos.clone().addScaledVector(s.normal, sign * this.collHalfW);
          contact.y += 0.35;
          this.smokeRequest = { pos: contact, strength: 0.6 };
        }
      }
    }

    // ── ride height / pitch from track ──
    const targetY = offRoad ? loc.height - 0.05 : loc.height;
    this.pos.y = THREE.MathUtils.lerp(this.pos.y, targetY, 1 - Math.exp(-14 * dt));
    this.slipAngle = Math.abs(vf) > 4 ? Math.atan2(Math.abs(vr), Math.abs(vf)) : 0;

    // ── drift scoring ──
    const isDrifting = this.slipAngle > 0.22 && Math.abs(vf) > 12 && Math.abs(loc.lateral) < track.halfWidth + 3;
    if (isDrifting && controlsEnabled && !this.finished) {
      this.driftTimer = 0.9;
      const gain = this.slipAngle * Math.abs(vf) * 14 * dt;
      this.driftChain += gain;
      this.nitro = Math.min(T.nitroCapacity, this.nitro + gain * T.driftNitroGain);
    } else if (this.driftTimer > 0) {
      this.driftTimer -= dt;
      if (this.driftTimer <= 0) {
        this.driftScore += Math.round(this.driftChain);
        this.driftChain = 0;
      }
    }
    this.drifting = isDrifting && this.driftTimer > 0;

    // ── drift smoke request ──
    if ((this.drifting || (offRoad && Math.abs(vf) > 6)) && Math.random() < 0.7) {
      const back = this.pos.clone().addScaledVector(fwd2, -1.7);
      back.y += 0.25;
      this.smokeRequest = { pos: back, strength: this.drifting ? 1 : 0.45 };
    }

    this.syncVisual(dt);
  }

  nitroActive = false;

  /** collision weight (relative, 1 = baseline) — from the car's tuning */
  get mass(): number {
    return this.tuning.mass;
  }

  syncVisual(dt: number) {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    // pitch from slope + body squat under accel/brake, roll from lateral slip
    const loc = this.loc;
    const pitch = loc ? -loc.slopePitch * 0.9 : 0;
    const targetRoll = THREE.MathUtils.clamp(this.slipAngle * Math.sign(this.vel.dot(this.right)) * -0.5, -0.16, 0.16);
    this.rollVisual = THREE.MathUtils.lerp(this.rollVisual, targetRoll, 1 - Math.exp(-6 * (dt || 0.016)));
    this.group.rotation.z = this.rollVisual;
    this.group.rotation.x = pitch;

    // wheels
    this.wheelSpin += (this.speed / this.wheelRadius) * (dt || 0.016);
    for (const w of this.wheels) {
      w.rotation.x = this.wheelSpin;
      const isFront = (w as unknown as { isFront: boolean }).isFront;
      if (isFront) w.rotation.y = this.controls.steer * -0.45;
    }
    for (const w of this.modelWheels) {
      w.pivot.rotation[w.axis] = this.wheelSpin;
      if (w.isFront) w.pivot.rotation.y = this.controls.steer * -0.45;
    }

    // brake lights
    const braking = this.controls.brake > 0.05;
    (this.brakeLights.material as THREE.MeshBasicMaterial).opacity = braking ? 0.95 : 0;
    // real tail-lens flare while braking (day cars sit dark until the stop,
    // night cars double up) — the lens geometry itself brightens, no impostor
    const tailI = braking ? LAMP_TAIL_INTENSITY * 2 : this.lampTailBase;
    for (const s of this.lampTail) s.emissiveIntensity = tailI;

    // nitro flames flicker
    for (const f of this.nitroFlames) {
      f.visible = this.nitroActive;
      if (this.nitroActive) {
        const s = 0.8 + Math.random() * 0.6;
        f.scale.set(1, s, 1);
      }
    }
    // brake-beam force: guard BOTH lights — rivals carry only headBeamL
    // (single center beam), the old `headBeamR!.intensity` chained write
    // threw "Cannot set properties of undefined" every rival frame and
    // killed the whole game loop
    if (this.headBeamL) this.headBeamL.intensity = this.headBeamForced;
    if (this.headBeamR) this.headBeamR.intensity = this.headBeamForced;
  }

  /** Reset onto the road centre facing forward */
  resetToTrack(track: Track) {
    const loc = track.locate(this.pos, this.lastTrackIndex);
    const s = track.sampleAt(loc.index);
    this.pos.copy(s.pos).setY(s.pos.y + 0.1);
    this.heading = Math.atan2(s.tangent.x, s.tangent.z);
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.driftChain = 0;
    this.syncVisual(0);
  }

  snapshot(): CarSnapshot {
    return {
      p: [this.pos.x, this.pos.y, this.pos.z],
      h: this.heading,
      s: this.speed,
      lap: this.lap,
      cp: this.checkpoint,
      prog: this.progress,
      drifting: this.drifting,
    };
  }

  dispose() {
    if (this.model) {
      // model cars share template geometry/textures — only dispose own resources
      for (const r of this.owned) r.dispose();
      this.owned = [];
      for (const pm of this.model.paintMaterials) pm.dispose();
      return;
    }
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}

// ─── Remote (network) car — visual only, interpolated ──────────────────────
export class RemoteCar {
  car: Car;
  private targetPos = new THREE.Vector3();
  private targetHeading = 0;
  private lerp = 10;

  constructor(public id: string, name: string, color: string, model?: CarModelInstance) {
    this.car = new Car("remote", color, name, model);
  }

  setTarget(snap: CarSnapshot) {
    this.targetPos.set(snap.p[0], snap.p[1], snap.p[2]);
    // unwrap heading for shortest-path interpolation
    let d = snap.h - this.targetHeading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.targetHeading += d;
    this.car.speed = snap.s;
    this.car.lap = snap.lap;
    this.car.checkpoint = snap.cp;
    this.car.progress = snap.prog;
    this.car.drifting = snap.drifting;
    this.car.controls.brake = 0; // visuals via speed
  }

  update(dt: number) {
    const t = 1 - Math.exp(-this.lerp * dt);
    this.car.pos.lerp(this.targetPos, t);
    this.car.heading = THREE.MathUtils.lerp(this.car.heading, this.targetHeading, t);
    this.car.group.position.copy(this.car.pos);
    this.car.group.rotation.y = this.car.heading;
    this.car.syncVisual(dt);
  }

  dispose() {
    this.car.dispose();
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────
/**
 * underglow neon color — additive blending means a dark paint (black, navy)
 * throws an invisible glow; clamp dark paints toward neon cyan so every
 * car reads as "lit" from the chase cam NFS-style
 */
function neonGlowColor(paint: string): THREE.Color {
  const c = new THREE.Color(paint);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  // 0.16: only true blacks/charcoal/navy get the cyan shift — bright
  // saturated paints (racing red, lime) keep their own glow colour
  if (lum < 0.16) c.lerp(new THREE.Color(0x2bd9ff), 0.8);
  return c;
}

function radialGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

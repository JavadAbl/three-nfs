// ─── Car: arcade physics + procedural low-poly visual OR GLB model ───────
import * as THREE from "three";
import { DEFAULT_CAR_TUNING, type CarTuning } from "../cars/registry";
import type { Track, TrackLocation } from "./Track";
import type { CarControls } from "../core/Input";
import { type CarModelInstance, type ModelWheel } from "./CarModelLoader";

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
  /** guardrail impact strength this frame (m/s) — consumed by Game for FX */
  railHit = 0;
  private wheels: THREE.Group[] = [];
  private modelWheels: ModelWheel[] = [];
  private model?: CarModelInstance;
  private wheelRadius = 0.38;
  private wheelSpin = 0;
  private brakeLights!: THREE.Mesh;
  private nitroFlames: THREE.Mesh[] = [];
  private headBeamL?: THREE.SpotLight;
  private headBeamR?: THREE.SpotLight;
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
    const w2 = d.width / 2;
    this.collHalfW = THREE.MathUtils.clamp(d.width / 2, 0.85, 1.5);
    this.collHalfL = THREE.MathUtils.clamp(d.length / 2, 2.0, 3.0);

    // lights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2cf });
    this.owned.push(headMat);
    for (const sx of [1, -1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.06), headMat);
      head.position.set(sx * w2 * 0.62, d.topY * 0.62, d.frontZ - 0.02);
      this.bodyGroup.add(head);
    }
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    this.owned.push(tailMat);
    for (const sx of [1, -1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.06), tailMat);
      tail.position.set(sx * w2 * 0.6, d.topY * 0.6, d.rearZ + 0.02);
      this.bodyGroup.add(tail);
    }
    // red bloom sprites at the tail lights — rivals ship baked emissive
    // tails (GT-R "taillight" @ 1.0); models without them looked dark
    // from the chase cam, so every model car gets the same night glow
    const glowTex = radialGlowTexture();
    const tailGlowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xff2a1a,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.owned.push(tailGlowMat, glowTex);
    for (const sx of [1, -1]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), tailGlowMat);
      glow.rotation.y = Math.PI; // face rearward
      glow.position.set(sx * w2 * 0.6, d.topY * 0.6, d.rearZ + 0.07);
      glow.renderOrder = 3;
      this.bodyGroup.add(glow);
    }
    this.brakeLights = new THREE.Mesh(
      new THREE.BoxGeometry(d.width * 0.8, 0.09, 0.06),
      new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
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
    // road when the body pitches/rolls over crests (looked like noise)
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: new THREE.Color(this.color),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.owned.push(glowMat, glowTex);
    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(d.width + 0.7, d.length + 0.9),
      glowMat
    );
    underglow.rotation.x = -Math.PI / 2;
    underglow.position.y = 0.09;
    underglow.renderOrder = 2;
    this.bodyGroup.add(underglow);

    this.attachHeadlightsAndLabel(d);

    this.group.add(this.bodyGroup);
    this.group.castShadow = true;
  }

  private attachHeadlightsAndLabel(d: { frontZ: number; topY: number; width: number; length: number }) {
    const w2 = d.width / 2;
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
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xfff0c0,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.owned.push(coneMat);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 16, 8, 1, true), coneMat);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, 0.5, d.frontZ + 9.5);
      this.bodyGroup.add(cone);
      if (this.kind === "remote") this.addLabel(d.topY);
    }
  }

  // ─── procedural fallback path (original stacked-box muscle car) ─────────
  private buildProceduralVisual() {
    this.collHalfW = 1.05; // body 2.05 wide, wheels at ±0.95
    this.collHalfL = 2.35; // 4.6 long + bumpers
    const paint = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(this.color),
      metalness: 0.85,
      roughness: 0.32,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.55, metalness: 0.4 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x090a12,
      metalness: 0.9,
      roughness: 0.08,
      transparent: true,
      opacity: 0.85,
    });

    // main body — muscle-car silhouette from stacked boxes
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.5, 4.6), paint);
    body.position.y = 0.52;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.34, 1.1), paint);
    nose.position.set(0, 0.42, 2.05);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.9), paint);
    tail.position.set(0, 0.55, -2.2);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.1), paint);
    cabin.position.set(0, 0.98, -0.35);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.42, 0.7), glass);
    windshield.position.set(0, 1.0, 0.75);
    windshield.rotation.x = -0.42;
    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.55), glass);
    rearGlass.position.set(0, 1.02, -1.42);
    rearGlass.rotation.x = 0.5;
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), dark);
    spoiler.position.set(0, 1.15, -2.35);
    const spoilerStand1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), dark);
    spoilerStand1.position.set(0.7, 0.98, -2.3);
    const spoilerStand2 = spoilerStand1.clone();
    spoilerStand2.position.x = -0.7;
    const sideSkirtL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 2.8), dark);
    sideSkirtL.position.set(1.02, 0.34, 0);
    const sideSkirtR = sideSkirtL.clone();
    sideSkirtR.position.x = -1.02;

    // lights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2cf });
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), headMat);
    headL.position.set(0.62, 0.48, 2.58);
    const headR = headL.clone();
    headR.position.x = -0.62;
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
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

    // tail bloom sprites (see model path — matches emissive rivals)
    const glowTex = radialGlowTexture();
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

    // underglow (NFS night vibe) — offset material avoids road z-fighting
    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 6.0),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: new THREE.Color(this.color),
        transparent: true,
        opacity: 0.55,
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

    // wheels
    const tireGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14);
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.32, 10);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xb8a06a,
      metalness: 0.95,
      roughness: 0.25,
      emissive: 0x241a05,
    });
    for (const [x, z, front] of [
      [0.95, 1.55, 1],
      [-0.95, 1.55, 1],
      [0.95, -1.6, 0],
      [-0.95, -1.6, 0],
    ] as [number, number, number][]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(tire, rim);
      wheel.position.set(x, 0.38, z);
      (wheel as unknown as { isFront: boolean }).isFront = front === 1;
      this.wheels.push(wheel);
      this.bodyGroup.add(wheel);
    }

    for (const m of [body, nose, tail, cabin, windshield, rearGlass, spoiler, spoilerStand1, spoilerStand2, sideSkirtL, sideSkirtR, headL, headR, tailL, tailR, this.brakeLights])
      this.bodyGroup.add(m);
    this.bodyGroup.add(underglow);

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
        vf += T.nitroPower * dt;
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
      const yawRate = c.steer * T.steerRate * falloff * speedFactor * (vf < -0.5 ? -1 : 1);
      this.heading -= yawRate * dt;
    } else {
      this.nitroActive = false;
    }

    // ── drag & clamps ──
    const dragCoef = T.drag + (offRoad ? T.offRoadDrag : 0);
    vf -= vf * dragCoef * dt;
    if (c.handbrake) vf -= vf * 0.25 * dt;
    vf = THREE.MathUtils.clamp(vf, -T.maxReverseSpeed, T.maxSpeed + (this.nitroActive ? 8 : 0));

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
    (this.brakeLights.material as THREE.MeshBasicMaterial).opacity = braking ? 0.95 : 0.3;

    // nitro flames flicker
    for (const f of this.nitroFlames) {
      f.visible = this.nitroActive;
      if (this.nitroActive) {
        const s = 0.8 + Math.random() * 0.6;
        f.scale.set(1, s, 1);
      }
    }
    if (this.headBeamL) this.headBeamL.intensity = this.headBeamR!.intensity = 95;
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

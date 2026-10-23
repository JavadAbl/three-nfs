// ─── NFS-Carbon-style camera: view modes, mouse free-look, live tuning ──────
// - C cycles: chase → far → hood → bumper (chase modes orbit-carbon style)
// - hold RIGHT MOUSE + move → free-look orbit around the car (chase modes)
//   or look around from the seat (hood/bumper); auto-recenters on release
// - camera drops & pulls back with speed (Carbon speed drama, drama-knob scalable)
// - user tuning (dist/height/FOV/sensitivity) applied on top of any mode,
//   driven by the HUD panel (F7), persisted to localStorage by the shell
import * as THREE from "three";
import type { Car } from "../world/Car";

export type CameraMode = "chase" | "far" | "hood" | "bumper";

const MODES: Record<CameraMode, { dist?: number; height?: number; look: number; fov: number }> = {
  chase: { dist: 7.2, height: 3.2, look: 7, fov: 74 },
  far: { dist: 11, height: 5.2, look: 9, fov: 66 },
  // cockpit modes anchor to the car's real body bounds (car.camDims) —
  // fixed offsets can't work across a fleet: -0.55m ahead of center sat
  // inside the engine bay of every GLB car (the "bumper in the engine" bug)
  hood: { look: 16, fov: 82 },
  bumper: { look: 18, fov: 90 },
};

export const MODE_LABEL: Record<CameraMode, string> = {
  chase: "CHASE",
  far: "FAR CHASE",
  hood: "HOOD",
  bumper: "BUMPER",
};

/** user camera tuning applied on top of every mode (HUD sliders) */
export interface CameraTuning {
  /** distance multiplier, 0.6..1.6 */
  distMul: number;
  /** height offset in meters, -2..2 */
  heightAdd: number;
  /** extra FOV degrees, -12..12 */
  fovAdd: number;
  /** mouse-look sensitivity, 0.4..2 */
  sens: number;
  /** speed-drama intensity 0..1: chase pull-back/drop + speed-FOV widening */
  drama: number;
}

export const DEFAULT_TUNING: CameraTuning = { distMul: 1, heightAdd: 0, fovAdd: 0, sens: 1, drama: 1 };

const UP = new THREE.Vector3(0, 1, 0);

function isCockpitMode(m: CameraMode) {
  return m === "hood" || m === "bumper";
}

export class CameraRig {
  mode: CameraMode = "chase";
  tuning: CameraTuning = { ...DEFAULT_TUNING };

  private current = { dist: 7.2, height: 3.2, look: 7, fov: 74 };
  // smoothed camera/look offsets relative to the car. Tracking in car space
  // (instead of lerping the world position) means the camera translates 1:1
  // with the car — speed can never build a v/λ lag that reads as the camera
  // sliding backward while you accelerate.
  private camOff = new THREE.Vector3();
  private lookOff = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private init = false;

  // ── free-look (NFS Carbon right-stick / mouse look) ──
  private looking = false;
  private lookYaw = 0;
  private lookPitch = 0;
  private lookYawT = 0;
  private lookPitchT = 0;

  constructor(public camera: THREE.PerspectiveCamera) {}

  cycle(): CameraMode {
    const order: CameraMode[] = ["chase", "far", "hood", "bumper"];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    return this.mode;
  }

  /** live-tune distance/height/FOV/sensitivity (HUD panel) */
  applyTuning(t: Partial<CameraTuning>) {
    this.tuning = { ...this.tuning, ...t };
  }

  holdLook() {
    this.looking = true;
  }

  releaseLook() {
    this.looking = false;
    this.lookYawT = 0;
    this.lookPitchT = 0;
  }

  /** mouse deltas while right button held → orbit targets */
  addLook(dx: number, dy: number) {
    if (!this.looking) return;
    const s = 0.0022 * this.tuning.sens;
    this.lookYawT = THREE.MathUtils.clamp(this.lookYawT - dx * s, -2.7, 2.7);
    this.lookPitchT = THREE.MathUtils.clamp(this.lookPitchT + dy * s * 0.7, -0.6, 0.9);
  }

  update(dt: number, car: Car) {
    const cfg = MODES[this.mode];
    const tun = this.tuning;

    // desired preset values: mode base + user tuning. Cockpit anchors come
    // from the car's body bounds so the camera clears the actual mesh:
    //   hood   — a touch ahead of the cowl, just above the body line
    //   bumper — a hand's width past the nose, at headlight height
    let baseDist = cfg.dist ?? 0;
    let baseHeight = cfg.height ?? 0;
    if (isCockpitMode(this.mode)) {
      const d = car.camDims;
      if (this.mode === "hood") {
        baseDist = -d.length * 0.05;
        baseHeight = Math.max(1.35, d.topY + 0.03);
      } else {
        // +0.55 clears the underglow plane (length+0.9 → ~0.45m nose overhang)
        baseDist = -(d.frontZ + 0.55);
        baseHeight = Math.max(0.55, d.topY * 0.42 + 0.08);
      }
    }
    const wantDist = baseDist * tun.distMul;
    const wantHeight = baseHeight + tun.heightAdd;
    const wantFov = cfg.fov + tun.fovAdd;
    // smooth transitions between modes / tuning changes. Big jumps (mode
    // switches — esp. crossing the car body between chase and cockpit
    // anchors) converge ~3.4x faster so the camera CUTS instead of slowly
    // sweeping through the mesh; small tweaks (sliders) stay buttery.
    const rate = (p: number, want: number) => (Math.abs(want - p) > 2 ? 12 : 3.5);
    this.current.dist = THREE.MathUtils.lerp(this.current.dist, wantDist, 1 - Math.exp(-rate(this.current.dist, wantDist) * dt));
    this.current.height = THREE.MathUtils.lerp(this.current.height, wantHeight, 1 - Math.exp(-rate(this.current.height, wantHeight) * dt));
    this.current.look = THREE.MathUtils.lerp(this.current.look, cfg.look, 1 - Math.exp(-rate(this.current.look, cfg.look) * dt));
    this.current.fov = THREE.MathUtils.lerp(this.current.fov, wantFov, 1 - Math.exp(-rate(this.current.fov, wantFov) * dt));

    // free-look spring: track mouse target while held, recenter on release
    const lookT = 1 - Math.exp(-14 * dt);
    this.lookYaw = THREE.MathUtils.lerp(this.lookYaw, this.lookYawT, lookT);
    this.lookPitch = THREE.MathUtils.lerp(this.lookPitch, this.lookPitchT, lookT);

    const fwd = car.forward;
    // normalize drama against the reworked speed range: fleet tops now run
    // to ~305 km/h, so widen the reference from 70 to 85 m/s or every car
    // past 252 km/h would sit at max drama with no headroom left
    const speedT = THREE.MathUtils.clamp(Math.abs(car.speed) / 85, 0, 1);
    const isCockpit = this.mode === "hood" || this.mode === "bumper";

    // Carbon speed drama: chase cams pull back a touch and drop lower;
    // the drama knob scales the whole effect (0 = framing locked to preset)
    const drama = THREE.MathUtils.clamp(this.tuning.drama ?? 1, 0, 1);
    let dist = this.current.dist;
    let height = this.current.height;
    if (this.mode === "chase" || this.mode === "far") {
      dist += speedT * 1.4 * drama;
      height -= speedT * 0.55 * drama;
    }

    // horizontal offset behind (or ahead for cockpit cams) the car
    const driftSide = isCockpit
      ? 0
      : car.slipAngle * Math.sign(car.vel.dot(car.right)) * 2.2;
    const off = fwd
      .clone()
      .multiplyScalar(-dist)
      .addScaledVector(car.right, driftSide)
      .applyAxisAngle(UP, this.lookYaw); // free-look orbits the camera around the car

    const anchor = car.pos.clone().add(off);
    anchor.y = car.pos.y + height + (isCockpit ? this.lookPitch * 0.25 : 0);

    // look target: ahead of the car, rotated with free-look; pitch swings it up/down
    const lookFwd = fwd.clone().applyAxisAngle(UP, this.lookYaw);
    const wantLookAt = car.pos
      .clone()
      .addScaledVector(lookFwd, this.current.look * 0.4 + (isCockpit ? 2 : 0));
    wantLookAt.y += isCockpit ? this.lookPitch * 14 : this.lookPitch * 6;

    // track the car in its own frame: smooth the OFFSET, never the world
    // position — lerping a world-space anchor behind a moving car leaves a
    // velocity-proportional lag (the "camera slides back on launch" effect)
    const desiredOff = anchor.clone().sub(car.pos);
    const desiredLookOff = wantLookAt.clone().sub(car.pos);
    if (!this.init) {
      this.camOff.copy(desiredOff);
      this.lookOff.copy(desiredLookOff);
      this.init = true;
    } else {
      // faster catch-up at speed keeps the car framed through mode changes
      const t = 1 - Math.exp(-(5.5 + speedT * 4) * dt);
      this.camOff.lerp(desiredOff, t);
      this.lookOff.lerp(desiredLookOff, 1 - Math.exp(-9 * dt));
    }
    this.camPos.copy(car.pos).add(this.camOff);
    this.lookAt.copy(car.pos).add(this.lookOff);

    // keep camera above the road surface
    this.camPos.y = Math.max(this.camPos.y, car.pos.y + (isCockpit ? 0.45 : 1.2));

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
    // speed feel: widen FOV with velocity, extra kick on nitro (drama-scaled)
    const fovTarget = this.current.fov + (speedT * 14 + (car.nitroActive ? 6 : 0)) * drama;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fovTarget, 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this.init = false;
  }
}

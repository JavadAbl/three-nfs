// ─── NFS-Carbon-style camera: view modes, mouse free-look, live tuning ──────
// - C cycles: chase → far → hood → bumper (chase modes orbit-carbon style)
// - hold RIGHT MOUSE + move → free-look orbit around the car (chase modes)
//   or look around from the seat (hood/bumper); auto-recenters on release
// - camera drops & pulls back with speed (Carbon speed drama)
// - user tuning (dist/height/FOV/sensitivity) applied on top of any mode,
//   driven by the HUD panel (F7), persisted to localStorage by the shell
import * as THREE from "three";
import type { Car } from "../world/Car";

export type CameraMode = "chase" | "far" | "hood" | "bumper";

const MODES: Record<CameraMode, { dist: number; height: number; look: number; fov: number }> = {
  chase: { dist: 9.2, height: 3.6, look: 7, fov: 74 },
  far: { dist: 14.5, height: 6.2, look: 9, fov: 66 },
  hood: { dist: -0.2, height: 1.35, look: 16, fov: 82 },
  bumper: { dist: -0.55, height: 0.62, look: 18, fov: 90 },
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
}

export const DEFAULT_TUNING: CameraTuning = { distMul: 1, heightAdd: 0, fovAdd: 0, sens: 1 };

const UP = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  mode: CameraMode = "chase";
  tuning: CameraTuning = { ...DEFAULT_TUNING };

  private current = { dist: 9.2, height: 3.6, look: 7, fov: 74 };
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

    // desired preset values: mode base + user tuning
    const wantDist = cfg.dist * tun.distMul;
    const wantHeight = cfg.height + tun.heightAdd;
    const wantFov = cfg.fov + tun.fovAdd;
    // smooth transitions between modes / tuning changes
    this.current.dist = THREE.MathUtils.lerp(this.current.dist, wantDist, 1 - Math.exp(-3.5 * dt));
    this.current.height = THREE.MathUtils.lerp(this.current.height, wantHeight, 1 - Math.exp(-3.5 * dt));
    this.current.look = THREE.MathUtils.lerp(this.current.look, cfg.look, 1 - Math.exp(-3.5 * dt));
    this.current.fov = THREE.MathUtils.lerp(this.current.fov, wantFov, 1 - Math.exp(-3.5 * dt));

    // free-look spring: track mouse target while held, recenter on release
    const lookT = 1 - Math.exp(-14 * dt);
    this.lookYaw = THREE.MathUtils.lerp(this.lookYaw, this.lookYawT, lookT);
    this.lookPitch = THREE.MathUtils.lerp(this.lookPitch, this.lookPitchT, lookT);

    const fwd = car.forward;
    const speedT = THREE.MathUtils.clamp(Math.abs(car.speed) / 70, 0, 1);
    const isCockpit = this.mode === "hood" || this.mode === "bumper";

    // Carbon speed drama: chase cams pull back a touch and drop lower
    let dist = this.current.dist;
    let height = this.current.height;
    if (this.mode === "chase" || this.mode === "far") {
      dist += speedT * 1.4;
      height -= speedT * 0.55;
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

    if (!this.init) {
      this.camPos.copy(anchor);
      this.lookAt.copy(wantLookAt);
      this.init = true;
    } else {
      // faster catch-up at speed keeps the car framed
      const t = 1 - Math.exp(-(5.5 + speedT * 4) * dt);
      this.camPos.lerp(anchor, t);
      this.lookAt.lerp(wantLookAt, 1 - Math.exp(-9 * dt));
    }

    // keep camera above the road surface
    this.camPos.y = Math.max(this.camPos.y, car.pos.y + (isCockpit ? 0.45 : 1.2));

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookAt);
    // speed feel: widen FOV with velocity, extra kick on nitro
    const fovTarget = this.current.fov + speedT * 14 + (car.nitroActive ? 6 : 0);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fovTarget, 1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this.init = false;
  }
}

// ─── Chase camera with speed FOV, drift framing & modes ────────────────────
import * as THREE from "three";
import type { Car } from "../world/Car";

export type CameraMode = "chase" | "far" | "hood";

const MODES: Record<CameraMode, { dist: number; height: number; look: number; fov: number }> = {
  chase: { dist: 9.2, height: 3.6, look: 7, fov: 74 },
  far: { dist: 14.5, height: 6.2, look: 9, fov: 66 },
  hood: { dist: -0.2, height: 1.35, look: 16, fov: 82 },
};

export class CameraRig {
  mode: CameraMode = "chase";
  private current = { dist: 9.2, height: 3.6, look: 7, fov: 74 };
  private camPos = new THREE.Vector3();
  private lookAt = new THREE.Vector3();
  private init = false;

  constructor(public camera: THREE.PerspectiveCamera) {}

  cycle(): CameraMode {
    const order: CameraMode[] = ["chase", "far", "hood"];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    return this.mode;
  }

  update(dt: number, car: Car) {
    const cfg = MODES[this.mode];
    // smooth transitions between modes
    for (const k of ["dist", "height", "look", "fov"] as const) {
      this.current[k] = THREE.MathUtils.lerp(this.current[k], cfg[k], 1 - Math.exp(-3.5 * dt));
    }

    const fwd = car.forward;
    const speedT = THREE.MathUtils.clamp(Math.abs(car.speed) / 70, 0, 1);

    // desired anchor behind the car (+ slight drift-side offset for style)
    const driftSide = car.slipAngle * Math.sign(car.vel.dot(car.right)) * 2.2;
    const anchor = car.pos
      .clone()
      .addScaledVector(fwd, -this.current.dist)
      .addScaledVector(car.right, driftSide * (this.mode === "hood" ? 0 : 1));
    anchor.y = car.pos.y + this.current.height;

    if (!this.init) {
      this.camPos.copy(anchor);
      this.lookAt.copy(car.pos);
      this.init = true;
    } else {
      // faster catch-up at speed keeps the car framed
      const t = 1 - Math.exp(-(5.5 + speedT * 4) * dt);
      this.camPos.lerp(anchor, t);
      this.lookAt.lerp(
        car.pos.clone().addScaledVector(fwd, this.current.look * 0.4),
        1 - Math.exp(-9 * dt)
      );
    }

    // keep camera above the road surface
    this.camPos.y = Math.max(this.camPos.y, car.pos.y + (this.mode === "hood" ? 1.0 : 1.2));

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

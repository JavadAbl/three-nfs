// ─── AI driver: follows the racing line with curvature-aware speed ──────────
import * as THREE from "three";
import { AI_TUNING, CAR_TUNING } from "../constants";
import type { Track } from "./Track";
import { Car } from "./Car";

export class AICar extends Car {
  private skill: number;
  private lateralOffset: number;
  stuckTimer = 0;

  constructor(color: string, name: string, index: number) {
    super("ai", color, name);
    const [lo, hi] = AI_TUNING.skillRange;
    this.skill = THREE.MathUtils.lerp(lo, hi, (index % 5) / 4);
    this.lateralOffset = [-2.2, 2.2, -1.1, 1.6, 3.0][index % 5];
  }

  /** drive(dt, track, playerProgress): writes into this.controls */
  drive(dt: number, track: Track, playerProgress: number, racing: boolean) {
    const c = this.controls;
    if (!racing || this.finished) {
      c.throttle = 0;
      c.brake = this.speed > 2 ? 0.4 : 0;
      c.steer = 0;
      c.handbrake = false;
      return;
    }

    const loc = track.locate(this.pos, -1);
    const idx = loc.index;

    // ── steering toward lookahead point on racing line ──
    const metresPerSample = track.length / track.sampleCount;
    const lookSamples = Math.max(4, Math.round(AI_TUNING.lookahead / metresPerSample));
    const targetSample = track.sampleAt(idx + lookSamples);
    const target = targetSample.pos.clone().addScaledVector(targetSample.normal, this.lateralOffset * 0.6);
    const toTarget = target.sub(this.pos);
    const fwd = this.forward;
    const cross = fwd.x * toTarget.z - fwd.z * toTarget.x; // sign = side of target
    const angle = Math.atan2(Math.abs(cross), fwd.dot(toTarget));
    // positive cross → target on one side; steer sign chosen so car turns toward it
    c.steer = THREE.MathUtils.clamp((cross > 0 ? 1 : -1) * angle * 3.2, -1, 1);

    // ── speed target from curvature ahead ──
    let maxCurv = 0;
    for (let ahead = 6; ahead <= lookSamples + 14; ahead += 4) {
      maxCurv = Math.max(maxCurv, track.curvatureAt(idx + ahead, 6));
    }
    const cornerLimit = Math.sqrt(0.9 * 9.81 / Math.max(maxCurv, 1e-4)); // µ≈0.9
    const skillTop = CAR_TUNING.maxSpeed * (0.62 + this.skill * 0.4);

    // rubber-banding relative to the player
    const delta = playerProgress - this.progress;
    let rubber = 1;
    if (delta > 40) rubber = AI_TUNING.rubberBand.behind;
    else if (delta < -40) rubber = AI_TUNING.rubberBand.ahead;
    const rubberBlend = THREE.MathUtils.clamp(Math.abs(delta) / 120, 0, 1);
    rubber = THREE.MathUtils.lerp(1, rubber, rubberBlend);

    const targetSpeed = THREE.MathUtils.clamp(
      Math.min(cornerLimit * (0.8 + this.skill * 0.3), skillTop) * rubber,
      8,
      CAR_TUNING.maxSpeed * 1.05
    );

    if (this.speed < targetSpeed - 1) {
      c.throttle = 1;
      c.brake = 0;
      c.nitro = this.speed > 30 && this.speed < 46 && angle < 0.1 && Math.random() < 0.3;
    } else if (this.speed > targetSpeed + 2) {
      c.throttle = 0;
      c.brake = THREE.MathUtils.clamp((this.speed - targetSpeed) / 12, 0.25, 1);
      c.nitro = false;
    } else {
      c.throttle = 0.35;
      c.brake = 0;
      c.nitro = false;
    }

    // handbrake for hairpins
    c.handbrake = maxCurv > 0.05 && this.speed > cornerLimit * 1.15;

    // ── stuck recovery ──
    if (Math.abs(this.speed) < 1.5 && c.throttle > 0) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 2.4) {
        // reverse out, then snap to track
        if (this.stuckTimer < 4.5) {
          c.brake = 1;
          c.throttle = 0;
          c.steer = -c.steer;
        } else {
          this.resetToTrack(track);
          this.stuckTimer = 0;
        }
      }
    } else {
      this.stuckTimer = 0;
    }
  }
}

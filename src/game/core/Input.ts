// ─── Keyboard + touch input manager ─────────────────────────────────────────
import * as THREE from "three";

export interface CarControls {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. 1 (right)
  handbrake: boolean;
  nitro: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private touch = { left: false, right: false, gas: false, brake: false, nitro: false, hb: false };
  private target: CarControls | null = null;
  /** extra one-shot actions consumed by the game */
  onAction: ((action: "camera" | "mute" | "reset" | "pause" | "stats") => void) | null = null;
  /** mouse free-look (NFS Carbon style): deltas while RIGHT button held */
  onLookDelta: ((dx: number, dy: number) => void) | null = null;
  onLookToggle: ((pressed: boolean) => void) | null = null;

  private lookHeld = false;

  private boundKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.code;
    // Prevent page scroll while racing
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(k) &&
      this.target
    )
      e.preventDefault();
    this.keys.add(k);
    if (k === "KeyC") this.onAction?.("camera");
    if (k === "KeyM") this.onAction?.("mute");
    if (k === "KeyR") this.onAction?.("reset");
    if (k === "Escape" || k === "KeyP") this.onAction?.("pause");
    if (k === "F8" || k === "Backquote") this.onAction?.("stats");
  };

  private boundKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private boundBlur = () => {
    this.keys.clear();
    if (this.lookHeld) {
      this.lookHeld = false;
      this.onLookToggle?.(false);
    }
  };
  private boundMouseDown = (e: MouseEvent) => {
    if (e.button === 2) {
      this.lookHeld = true;
      this.onLookToggle?.(true);
    }
  };
  private boundMouseUp = (e: MouseEvent) => {
    if (e.button === 2 && this.lookHeld) {
      this.lookHeld = false;
      this.onLookToggle?.(false);
    }
  };
  private boundMouseMove = (e: MouseEvent) => {
    if (this.lookHeld && (e.movementX || e.movementY)) {
      this.onLookDelta?.(e.movementX, e.movementY);
    }
  };
  private boundCtx = (e: MouseEvent) => {
    if (this.lookHeld) e.preventDefault(); // suppress context menu while looking
  };
  private boundTouchEnd = () =>
    (this.touch = { left: false, right: false, gas: false, brake: false, nitro: false, hb: false });

  attach() {
    window.addEventListener("keydown", this.boundKeyDown, { passive: false });
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("blur", this.boundBlur);
    window.addEventListener("mousedown", this.boundMouseDown);
    window.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("mousemove", this.boundMouseMove);
    window.addEventListener("contextmenu", this.boundCtx);
    window.addEventListener("touchend", this.boundTouchEnd);
    window.addEventListener("touchcancel", this.boundTouchEnd);
  }

  detach() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    window.removeEventListener("blur", this.boundBlur);
    window.removeEventListener("mousedown", this.boundMouseDown);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("mousemove", this.boundMouseMove);
    window.removeEventListener("contextmenu", this.boundCtx);
    window.removeEventListener("touchend", this.boundTouchEnd);
    window.removeEventListener("touchcancel", this.boundTouchEnd);
    this.keys.clear();
    if (this.lookHeld) {
      this.lookHeld = false;
      this.onLookToggle?.(false);
    }
  }

  /** Reference to the controls struct the player car reads each frame */
  bindControls(controls: CarControls) {
    this.target = controls;
  }

  /** Called by TouchControls UI layer */
  setTouch(button: keyof typeof this.touch, pressed: boolean) {
    this.touch[button] = pressed;
  }

  /** Write current player intent into the bound CarControls */
  update(dt: number) {
    if (!this.target) return;
    const k = this.keys;
    const has = (...codes: string[]) => codes.some((c) => k.has(c));

    const gasK = has("ArrowUp", "KeyW");
    const brakeK = has("ArrowDown", "KeyS");
    const leftK = has("ArrowLeft", "KeyA");
    const rightK = has("ArrowRight", "KeyD");

    const throttleIn = gasK || this.touch.gas ? 1 : 0;
    const brakeIn = brakeK || this.touch.brake ? 1 : 0;
    const steerIn = (leftK || this.touch.left ? -1 : 0) + (rightK || this.touch.right ? 1 : 0);
    const hbIn = k.has("Space") || this.touch.hb;
    const nitroIn = has("ShiftLeft", "ShiftRight") || this.touch.nitro;

    const c = this.target;
    // Smooth steering for keyboard (avoids twitchy yaw snapping)
    const steerSpeed = 3.6 * dt;
    const diff = steerIn - c.steer;
    c.steer = THREE.MathUtils.clamp(c.steer + THREE.MathUtils.clamp(diff, -steerSpeed, steerSpeed), -1, 1);
    if (steerIn === 0 && Math.abs(c.steer) < 0.03) c.steer = 0;

    // throttle/brake ramping gives a bit of analogue feel
    c.throttle = THREE.MathUtils.lerp(c.throttle, throttleIn, 1 - Math.exp(-8 * dt));
    c.brake = THREE.MathUtils.lerp(c.brake, brakeIn, 1 - Math.exp(-12 * dt));
    c.handbrake = hbIn;
    c.nitro = nitroIn;
  }
}

// ─── SpeedBlur: speed-reactive radial blur (mixed-res post chain) ───────────
// NFS-style "the world smears as you go fast": the scene renders HDR + MSAA
// into an offscreen target, OutputPass applies ACES + sRGB, and a radial
// (zoom) blur smears the frame PERIPHERY — the center stays sharp so the
// road/racing line ahead is always readable.
//
// ── HISTORY (re-added 2026-10-28, user: "blur and special effects on high
//    speed and more on nitro") ────────────────────────────────────────────────
// This chain existed, was removed at user request (2026-10-22, "remove blur"
// — iGPU frame drops + first-engage stall) and is now BACK by the same user's
// directive, ported with every perf lesson kept: bandwidth-first mixed-res
// chain (5e319d8/c70864f), post-tonemap RGBA8 buffers, engage hysteresis and
// the countdown warm-up pattern (78e19d6). New in this revision: a nitro
// slam channel (uNitro) driving periphery chromatic aberration + a speed
// vignette in the composite pass. Drama knob 0 (HUD F7) disengages the
// chain entirely — the documented escape hatch for weak GPUs.
//
// ── iGPU frame-drop fix (2026-10-22, kept): bandwidth-first chain ───────────
// The naive chain ran HalfFloat targets at FULL resolution (pixelRatio ≤ 2!)
// — scene + resolve + tonemap + a 10-tap blur, every byte HDR: ~300MB/frame
// of texture traffic, which read as "frames drop when the blur engages".
// The engaged chain is now:
//
//   scene ──▶ tScene   HalfFloat MSAA2 @ 0.8×   HDR + AA, 36% fewer pixels
//         ──▶ OutputPass ──▶ tEncode  RGBA8      display-encoded = ½ the bytes
//         ──▶ radial blur  ──▶ tBlur   RGBA8 ½×  ~16% of the old blur ALU/fill
//         ──▶ composite   ──▶ screen              sharp center, smeared ring
//
// Three levers, none visible while smeared at 60fps motion:
//   1. QUALITY_SCALE — the engaged chain renders at 0.8× (see const) — the
//      periphery is smeared and the bilinear upscale reads as part of the
//      speed haze. Bump to 1 if the center window ever feels soft.
//   2. post-tonemap targets are RGBA8 — OutputPass emits display-encoded
//      values, so HalfFloat there was pure bandwidth waste (16bpx → 8bpx).
//   3. the blur runs at half-res — each tap bilinearly downsamples the
//      full chain buffer for free; a smear is the one effect that HIDES
//      resolution. The composite pass then restores the sharp CENTER from
//      the chain-res buffer, so only the smeared periphery is half-res.
// All targets are allocated in setSize() — engaging never allocates, so the
// engage seam can't hitch.
//
// ORDERING IS LOAD-BEARING (bug fix, kept): the blur runs on display-encoded
// values AFTER OutputPass — averaging raw HDR samples and tonemapping after
// made every engaged frame read brighter (ACES is concave: ACES(mean) >
// mean(ACES)), washing windows out. Composite reads the same encoded buffer
// the disengaged path paints, so the engage/release seam stays clean.
//
// Strength + nitro level are fed per-frame by Game from player speed.
import * as THREE from "three";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/** engaged-chain resolution (0.8 → 64% of the pixels; only while smeared) */
const QUALITY_SCALE = 0.8;
/** blur resolution relative to the engaged chain — invisible under a smear */
const BLUR_SCALE = 0.5;

const RadialBlurShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** 0 = off, ~0.6 = high speed, ~1.0+ = nitro slam */
    uStrength: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Mask-less on purpose: the radial offset already fades with dist, and the
  // COMPOSITE pass owns the center mask — masking in both places would
  // double-attenuate the mid-ring smear and visibly weaken the effect.
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      if (uStrength < 0.002 || dist < 0.02) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec4 sum = vec4(0.0);
      // taps spread along the radial line through this pixel, scaled by
      // edge distance — the classic zoom/radial smear toward the borders
      for (int i = 0; i < 10; i++) {
        float t = float(i) / 9.0 - 0.5;
        vec2 uv = vUv - dir * (t * uStrength * 0.5 * dist);
        sum += texture2D(tDiffuse, uv);
      }
      gl_FragColor = sum / 10.0;
    }
  `,
};

const CompositeShader = {
  uniforms: {
    tSharp: { value: null as THREE.Texture | null },
    tBlurred: { value: null as THREE.Texture | null },
    uStrength: { value: 0 },
    /** nitro slam 0..1 — chromatic aberration + vignette depth */
    uNitro: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // The composite IS the center mask: inner ~13% of the frame stays the
  // sharp chain-res pixel, full effect by ~50% radius. New since the re-add:
  // on nitro the periphery splits its RGB channels along the radial line
  // (chromatic aberration — the NFS boost "prism" look) and a smooth
  // vignette tunnels the frame edges. Both are post-tonemap and gated by
  // the same engage seam, so the disengaged path stays pixel-identical.
  fragmentShader: /* glsl */ `
    uniform sampler2D tSharp;
    uniform sampler2D tBlurred;
    uniform float uStrength;
    uniform float uNitro;
    varying vec2 vUv;
    void main() {
      vec4 sharp = texture2D(tSharp, vUv);
      if (uStrength < 0.002) {
        gl_FragColor = sharp;
        return;
      }
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      float mask = smoothstep(0.13, 0.5, dist);
      vec4 blurred;
      // chromatic aberration on nitro: R/B re-sample slightly along the
      // radial line — periphery only, the readable center stays pristine
      float ca = uNitro * 0.009 * dist;
      if (ca > 0.0006) {
        vec2 off = dir * ca;
        blurred = vec4(
          texture2D(tBlurred, vUv + off).r,
          texture2D(tBlurred, vUv).g,
          texture2D(tBlurred, vUv - off).b,
          1.0
        );
      } else {
        blurred = texture2D(tBlurred, vUv);
      }
      vec4 col = mix(sharp, blurred, mask);
      // speed vignette — darkens the far corners as the smear builds,
      // deeper on nitro. Post-tonemap multiplication only: no ACES(mean)
      // brightness wash (the 5e319d8 lesson).
      float vig = 1.0 - smoothstep(0.55, 0.95, dist) * (0.16 + 0.22 * uNitro) * min(uStrength, 1.0);
      gl_FragColor = vec4(col.rgb * vig, col.a);
    }
  `,
};

export class SpeedBlur {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  /** HDR + MSAA2 scene target (the only HalfFloat buffer left) */
  private tScene: THREE.WebGLRenderTarget;
  /** display-encoded (post-ACES+sRGB) chain-res buffer, RGBA8 */
  private tEncode: THREE.WebGLRenderTarget;
  /** half-res smeared buffer, RGBA8 */
  private tBlur: THREE.WebGLRenderTarget;

  private outputPass = new OutputPass();
  private blurMat = new THREE.ShaderMaterial(RadialBlurShader);
  private compositeMat = new THREE.ShaderMaterial(CompositeShader);
  private blurQuad: FullScreenQuad;
  private compositeQuad: FullScreenQuad;

  // ── warm-up pacing ──────────────────────────────────────────────────────
  // The chain's 3 programs + 4 GPU storages only materialize on their FIRST
  // real use (driver compiles at draw time, targets allocate at first bind).
  // Game paces warmUpStep() one step per disengaged frame so that cost lands
  // while the grid is parked (countdown), not mid-drive at 150 km/h — which
  // read as "game freezes 1-2 s when the blur starts for the first time".
  // 0..3 = pending steps, WARM_STEPS = done.
  private warmStep = 0;
  private static readonly WARM_STEPS = 4;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const pr = renderer.getPixelRatio();
    const cw = Math.max(1, Math.round(width * pr * QUALITY_SCALE));
    const ch = Math.max(1, Math.round(height * pr * QUALITY_SCALE));
    // MSAA 2x, not 4x: half the resolve cost on iGPUs, and the periphery is
    // smeared by the blur anyway — only the sharp center really benefits.
    this.tScene = new THREE.WebGLRenderTarget(cw, ch, {
      samples: 2,
      type: THREE.HalfFloatType,
    });
    // display-encoded values fit RGBA8 — no HDR waste after the tonemap
    this.tEncode = new THREE.WebGLRenderTarget(cw, ch, {
      type: THREE.UnsignedByteType,
    });
    this.tBlur = new THREE.WebGLRenderTarget(
      Math.max(1, Math.round(cw * BLUR_SCALE)),
      Math.max(1, Math.round(ch * BLUR_SCALE)),
      { type: THREE.UnsignedByteType },
    );

    this.blurQuad = new FullScreenQuad(this.blurMat);
    this.compositeQuad = new FullScreenQuad(this.compositeMat);
  }

  setStrength(v: number) {
    this.blurMat.uniforms.uStrength.value = v;
    this.compositeMat.uniforms.uStrength.value = v;
  }

  /** nitro slam 0..1 — chromatic aberration + vignette depth in the composite */
  setNitro(v: number) {
    this.compositeMat.uniforms.uNitro.value = v;
  }

  get strength() {
    return this.blurMat.uniforms.uStrength.value as number;
  }

  get warmedUp() {
    return this.warmStep >= SpeedBlur.WARM_STEPS;
  }

  /**
   * Run ONE chain-warm step, fully OFF-SCREEN: bind the next never-used GL
   * object / compile the next chain program so the first real engage has
   * zero compile-or-allocate work left. The composite step draws into tScene
   * (reads tEncode+tBlur while writing tScene — feedback-free, and nothing
   * ever touches the default framebuffer, so no flash even mid-race).
   * Returns true while steps remain. Each step leaves the default
   * framebuffer bound again — the direct path in Game.renderFrame renders
   * into whatever target is current, so a dangling tScene bind would
   * silently paint the live scene INTO the blur target.
   */
  warmUpStep(): boolean {
    if (this.warmStep >= SpeedBlur.WARM_STEPS) return false;
    const r = this.renderer;
    switch (this.warmStep) {
      case 0:
        // MSAA HalfFloat storage materializes on first bind + clear
        r.setRenderTarget(this.tScene);
        r.clear();
        break;
      case 1:
        // OutputPass program + tEncode storage (samples tScene → forces the
        // MSAA resolve path too)
        this.outputPass.render(r, this.tEncode, this.tScene, 0, false);
        break;
      case 2:
        // radial-blur program + tBlur storage + FullScreenQuad geometry upload
        this.blurMat.uniforms.tDiffuse.value = this.tEncode.texture;
        r.setRenderTarget(this.tBlur);
        this.blurQuad.render(r);
        break;
      default:
        // composite program — into tScene, NOT the screen
        this.compositeMat.uniforms.tSharp.value = this.tEncode.texture;
        this.compositeMat.uniforms.tBlurred.value = this.tBlur.texture;
        r.setRenderTarget(this.tScene);
        this.compositeQuad.render(r);
        break;
    }
    this.warmStep++;
    r.setRenderTarget(null);
    return this.warmStep < SpeedBlur.WARM_STEPS;
  }

  setSize(width: number, height: number) {
    const pr = this.renderer.getPixelRatio();
    const cw = Math.max(1, Math.round(width * pr * QUALITY_SCALE));
    const ch = Math.max(1, Math.round(height * pr * QUALITY_SCALE));
    this.tScene.setSize(cw, ch);
    this.tEncode.setSize(cw, ch);
    this.tBlur.setSize(
      Math.max(1, Math.round(cw * BLUR_SCALE)),
      Math.max(1, Math.round(ch * BLUR_SCALE)),
    );
  }

  render() {
    const r = this.renderer;
    // 1. scene → HDR MSAA target (resolve happens automatically on sample)
    r.setRenderTarget(this.tScene);
    r.clear();
    r.render(this.scene, this.camera);
    // 2. ACES + sRGB → display-encoded RGBA8
    this.outputPass.render(r, this.tEncode, this.tScene, 0, false);
    // 3. half-res radial smear (each tap bilinearly downsamples for free)
    this.blurMat.uniforms.tDiffuse.value = this.tEncode.texture;
    r.setRenderTarget(this.tBlur);
    this.blurQuad.render(r);
    // 4. composite to screen: sharp chain-res center, smeared periphery +
    //    nitro chromatic aberration + speed vignette
    this.compositeMat.uniforms.tSharp.value = this.tEncode.texture;
    this.compositeMat.uniforms.tBlurred.value = this.tBlur.texture;
    r.setRenderTarget(null);
    this.compositeQuad.render(r);
  }

  dispose() {
    this.tScene.dispose();
    this.tEncode.dispose();
    this.tBlur.dispose();
    this.outputPass.dispose();
    this.blurQuad.dispose();
    this.compositeQuad.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
  }
}

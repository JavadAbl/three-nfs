// ─── SpeedBlur: speed-reactive radial blur (post-processing chain) ──────────
// NFS-style "the world smears as you go fast": the scene renders into an HDR
// MSAA target, then OutputPass applies ACES + sRGB, and the radial (zoom)
// blur pass smears the frame PERIPHERY toward the edges LAST — the center
// stays sharp so the road/racing line ahead is always readable.
//
// ORDERING IS LOAD-BEARING (bug fix): the blur used to run BEFORE
// OutputPass, averaging raw HDR samples and tonemapping after — ACES is
// concave, so ACES(mean) > mean(ACES) (Jensen) and every engaged frame read
// ~4-7 luma brighter, building windows washing out the whole scene. Now the
// blur runs on display-encoded values after OutputPass — the FXAA-style
// pattern three's docs sanction — at the cost of clipped streaks on the
// very brightest sources (acceptable: they saturate, not glow).
// Strength is fed per-frame by Game from player speed + nitro state.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

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
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      // periphery-only mask: the inner ~13% of the frame stays perfectly
      // sharp so the racing line ahead never smears; full effect by ~50%
      float mask = smoothstep(0.13, 0.5, dist);
      if (uStrength < 0.002 || mask < 0.002) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec4 sum = vec4(0.0);
      // taps spread along the radial line through this pixel, scaled by
      // edge distance — the classic zoom/radial smear toward the borders
      for (int i = 0; i < 10; i++) {
        float t = float(i) / 9.0 - 0.5;
        vec2 uv = vUv - dir * (t * uStrength * 0.5 * dist * mask);
        sum += texture2D(tDiffuse, uv);
      }
      gl_FragColor = sum / 10.0;
    }
  `,
};

export class SpeedBlur {
  private composer: EffectComposer;
  private blurPass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    // HDR + MSAA target: keeps the ACES band in OutputPass clean and the
    // geometry edges anti-aliased (the canvas's own AA does nothing for
    // offscreen targets). MSAA 2x, not 4x: half the resolve cost on iGPUs
    // and the periphery is smeared by the blur anyway — only the sharp
    // center window really benefits from AA.
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(width * pr)),
      Math.max(1, Math.floor(height * pr)),
      { samples: 2, type: THREE.HalfFloatType },
    );
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    this.composer.addPass(new RenderPass(scene, camera));
    // tone-map + sRGB BEFORE the blur — see header comment (Jensen lift)
    this.composer.addPass(new OutputPass());
    this.blurPass = new ShaderPass(RadialBlurShader);
    this.composer.addPass(this.blurPass);
  }

  setStrength(v: number) {
    this.blurPass.uniforms.uStrength.value = v;
  }

  get strength() {
    return this.blurPass.uniforms.uStrength.value as number;
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}

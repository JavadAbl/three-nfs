// ─── WebGL support probe — fail LOUDLY and EARLY, not at "PLAY" ──────────────
// Without this, a browser that has no GPU at all dies cryptically:
//   garage preview → THREE.WebGLRenderer throws inside a React useEffect
//   (white screen), and the race boot throws inside an unhandled async
//   IIFE after the user already clicked PLAY (black canvas + console spam).
//
// The classic Chromium tell (console): "Could not create a WebGL context,
// VENDOR = 0xffff, GL_VENDOR = Disabled, Sandboxed = yes … BindToCurrentSequence
// failed" — the browser has NO usable GPU (hardware acceleration off, GPU
// blocklisted, or a VM/remote-desktop session without 3D). That is an
// environment problem the app cannot fix — but it CAN show the driver an
// actionable dead end instead of a silent corpse.
//
// Raw canvas API, deliberately three-free: the probe must work before any
// heavy game module loads, and once a canvas answers getContext we know
// exactly what THREE.WebGLRenderer will get.

export interface WebGLSupport {
  ok: boolean;
  /** when ok=false: what getContext threw, if anything (e.g. SecurityError) */
  error?: string;
}

// memoized: one probe per page load — extra contexts cost real GPU memory in
// Chrome (~16 live contexts per tab before the browser starts evicting).
let cached: WebGLSupport | null = null;

export function checkWebGLSupport(): WebGLSupport {
  if (cached) return cached;
  if (typeof document === "undefined") {
    // SSR pass of a "use client" component — nothing to probe yet; the real
    // answer comes from the useEffect that runs this after hydration.
    return { ok: true };
  }
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl2") ??
      c.getContext("webgl") ??
      c.getContext("experimental-webgl");
    cached = gl ? { ok: true } : { ok: false };
  } catch (e) {
    cached = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return cached;
}

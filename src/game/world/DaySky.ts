// ─── Daytime sky: a real HDR panorama — background + image-based light ─────
// SPA '92 plays at day (EnvThemeSpec.timeOfDay = "day"). The GLB scene has
// no sky of its own (verified: no dome/sky meshes or textures in the file),
// and the previous furniture build (flat palette background + the user's
// sun-disc GLB + six puff clones) read wrong on two counts (user verdict):
// "more clouds" and "the sun is just a yellow ball on sky, there are no
// lightings around it". A photographed sky fixes both at once — real
// cumulus everywhere, a sun with actual atmospheric glow, and the sky
// becomes the IBL so ambient light carries the sun's warmth.
//
// The shipped file is PolyHaven's CC0 "sunflowers_puresky" 2k, preprocessed
// by scripts/hdr_remap.mjs into a WORLD-ALIGNED bake (v7):
//  - the photo sun (measured disc centre el 43.0° — scripts/sun_probe.mjs;
//    the old 48.66° constant was 5.6° high) is baked onto SUN_DIR via a
//    smooth vertical remap (el_src = 3° + 0.967·atan(3.29·tan(el)); anchors
//    0°→3°, 15°→43°, 90°→90°) plus a ~-3.1° yaw — so the panorama runs at
//    IDENTITY rotation and the photo horizon sits at the world horizon on
//    EVERY azimuth. History: v5/v6 rotated the panorama ~34° at runtime
//    (setFromUnitVectors(HDR_SUN_DIR, SUN_DIR)) instead, which necessarily
//    tilts the photo horizon — up to +34° above the terrain on the anti-sun
//    arc. That first drew a tilted "sea" line (v5), then a fog wedge that
//    still read lopsided (v6 — one side had clouds down to the silhouette,
//    the other a ~34° flat haze band; user: "the sky in that position need
//    rotating. its lopsided"). The bake removes the rotation entirely.
//  - the remap CUTs the photo's own dark olive rim (its lowest ~3° darkens
//    lum 0.47→0.20) so no dark line rides the terrain silhouette;
//  - below the world horizon the rows mirror the sky and melt into the fog
//    colour (linear 0xb9d2e2) over ~1.2°, flat haze below — the void past
//    the finite GLB terrain reads as distance, never as a second ground;
//  - re-encoded with three's own RGBE decode convention (×255, not ×256).
//
// SUN PLACEMENT: the visible sun sits exactly at SUN_DIR (el 15°, in-frame
// mid-wedge — the chase camera sees el 0..28°) by construction of the bake,
// so the light rig is untouched and shadows match what the player sees. The
// tilt era actually rendered the sun at el ~12.4° (the constant's 5.6°
// error compressed away); now seen-sun and light finally coincide.
//
// scene.environment gets a PMREM of the same HDR — no rotation: the bake is
// already world-aligned, so IBL highlights agree with the visible sun.

import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/** direction the sun shines from (game space). UNCHANGED from the furniture
 * build — the shadow rig (offset ·263, ortho ±200, bias −0.0005/0.5) was
 * tuned against it. The v7 sky bake puts the photo sun onto THE LIGHT.
 * (500,160,325) → elev 15°, az 33°. */
export const SUN_DIR = new THREE.Vector3(500, 160, 325).normalize();

/** file revision — bump when swapping the HDR in place (immutable cache +
 *  SW bucket invalidation, same lesson as ASPHALT_REV). v7: world-aligned
 *  bake (scripts/hdr_remap.mjs) — yaw + vertical remap put the photo sun on
 *  SUN_DIR with the horizon at world el 0 on every azimuth, replacing the
 *  ~34° runtime tilt (whose tilted photo horizon caused the v5 "sea" line
 *  and the v6 lopsided wedge). Below-horizon rows melt to fog haze. */
const SKY_REV = 7;

/** the shipped panorama (v7: world-aligned bake; this file
 * is already EV-normalised — sky ~0.5, sun ~6.4e4 — so no scale was baked).
 * 2k on purpose: 4k would cost 4× the bytes + a 67 MB GPU texture; the PMREM
 * IBL is 256px regardless, so only background sharpness differs. */
const SKY_HDRI = `/models/sky/sunflowers_puresky_2k.hdr?v=${SKY_REV}`;

/** AssetPreloader registry — the boot bar byte-fetches this file (SW cache
 * warm) and the parse below then re-reads it cache-hot. */
export const SKY_ASSETS = [
  { key: "sky:hdri", label: "DAY SKY", candidates: [SKY_HDRI] },
] as const;

// ── module texture cache (parse once, reuse across races — template pattern) ──

const texCache: { promise?: Promise<THREE.DataTexture | null> } = {};

/** load + cache the panorama (null on failure — the race stays fully
 * playable on the flat palette background). Progress feeds the boot bar. */
export function loadDaySkyTexture(
  onProgress?: (loaded: number, total: number) => void,
): Promise<THREE.DataTexture | null> {
  if (!texCache.promise) {
    texCache.promise = new Promise((resolve) => {
      new HDRLoader().load(
        SKY_HDRI,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          resolve(tex);
        },
        (e) => {
          if (onProgress && e.total) onProgress(e.loaded, e.total);
        },
        (err) => {
          console.warn("[DaySky] HDRI load failed:", err);
          resolve(null);
        },
      );
    });
  }
  return texCache.promise;
}

// ── the per-race sky system ────────────────────────────────────────────────

export class DaySky {
  /** kept for API compatibility — the sky IS the scene background now */
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    void loadDaySkyTexture().then((tex) => {
      if (this.disposed || !tex) return;
      // visible sky: the panorama is pre-baked in world orientation (v7) —
      // sun on SUN_DIR, horizon at world el 0 on every azimuth — so it runs
      // with IDENTITY rotation (no backgroundRotation/env rotation needed)
      this.scene.background = tex;
      // IBL from the same sky, unrotated — the bake is already world-
      // aligned, so glossy paint picks up the sun where the eye sees it
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromEquirectangular(tex);
      this.scene.environment = this.envRT.texture;
      pmrem.dispose();
    });
  }

  /** per-frame: nothing — the background is camera-invariant. Kept as a
   * no-op so call sites need no special-casing. */
  update(_dt: number, _camera: THREE.Camera): void {
    /* intentionally empty */
  }

  dispose(): void {
    this.disposed = true;
    // the panorama texture is module-cached and shared across races — only
    // the renderer-bound PMREM target dies here
    this.envRT?.dispose();
    this.envRT = null;
    this.scene.background = null;
    this.scene.environment = null;
    this.group.clear();
  }
}

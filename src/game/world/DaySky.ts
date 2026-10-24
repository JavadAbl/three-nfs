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
// The shipped file is PolyHaven's CC0 "sunflowers_puresky" (VLM shortlisted
// six pure skies: sun 8/10, clouds 9/10; then measured — scripts/
// hdri_cloud_bands.mjs — because the visible wedge shows photo elevations
// [sun_el − 15°, +28°] after the tilt: sunflowers holds 52% cloud cover in
// that band vs kloofendal_48d's 13%), 2k, preprocessed by scripts/
// hdr_repatch.mjs:
//  - the below-photo-horizon half is painted as a WORLD-SPACE haze wedge:
//    the real sky colour of each column at the photo horizon fading to the
//    game fog colour (linear 0xb9d2e2) at the world horizon. The ~34° tilt
//    that drags the photo sun down to SUN_DIR lifts the photo horizon up to
//    34° ABOVE the terrain on the anti-sun arc (world az 135°..300°), so the
//    paint is visible there — it must read as haze that the fogged terrain
//    silhouette melts into (v6; the old v5 paint was a flat per-column
//    gradient that read as a tilted "sea" line colliding with the terrain);
//  - re-encoded with three's own RGBE decode convention (×255, not ×256).
//
// SUN PLACEMENT: the photo's sun sits at elevation ~57°, above the chase
// camera's visible sky wedge (horizon → ~28°, the wedge the old disc was
// tuned to). scene.backgroundRotation tilts the whole panorama so the
// photo sun lands exactly at SUN_DIR — elevation 15°, in-frame mid-wedge,
// throwing the same long dramatic shadows the light rig was tuned around
// (SUN_DIR is untouched, so the shadow camera, bias and ortho box stay
// valid). The tilt maps the photo horizon (and the patched gradient) to
// at/below the terrain silhouette, hidden by the ground plane and fog.
//
// scene.environment gets a PMREM of the same HDR with the matching
// environmentRotation, so IBL highlights agree with the visible sun.

import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/** direction the sun shines from (game space). UNCHANGED from the furniture
 * build — the shadow rig (offset ·263, ortho ±200, bias −0.0005/0.5) was
 * tuned against it. The HDR is rotated to match THE LIGHT, not vice versa.
 * (500,160,325) → elev 15°, az 33°. */
export const SUN_DIR = new THREE.Vector3(500, 160, 325).normalize();

/** file revision — bump when swapping the HDR in place (immutable cache +
 *  SW bucket invalidation, same lesson as ASPHALT_REV). v6: below-horizon
 *  repaint — the old per-column "water" gradient floated up to 34° above the
 *  terrain on the anti-sun side (the tilt lifts the photo horizon there);
 *  now a world-space haze wedge: real sky colour at the photo horizon fading
 *  to the fog colour (0xb9d2e2 linear) at the world horizon, so the terrain
 *  silhouette melts into sky (scripts/hdr_repatch.mjs). */
const SKY_REV = 6;

/** the shipped panorama (patched: gradient below-horizon fill; this file
 * is already EV-normalised — sky ~0.5, sun ~6.4e4 — so no scale was baked).
 * 2k on purpose: 4k would cost 4× the bytes + a 67 MB GPU texture; the PMREM
 * IBL is 256px regardless, so only background sharpness differs. */
const SKY_HDRI = `/models/sky/sunflowers_puresky_2k.hdr?v=${SKY_REV}`;

/** AssetPreloader registry — the boot bar byte-fetches this file (SW cache
 * warm) and the parse below then re-reads it cache-hot. */
export const SKY_ASSETS = [
  { key: "sky:hdri", label: "DAY SKY", candidates: [SKY_HDRI] },
] as const;

/** where the sun sits in the PHOTO (scripts/hdr_sun_find.mjs + the official
 * tonemapped preview: elevation ~49°, azimuth ~36° in the equirectUv frame
 * — three maps u = atan(z,x)/2π + 0.5, v = asin(y)/π + 0.5). */
const HDR_SUN_DIR = new THREE.Vector3(0.5335, 0.7506, 0.3898).normalize();

/** rotation placing the photo sun at SUN_DIR. WebGLBackground uploads the
 * euler TRANSPOSED and shades with `uniform * worldDir`, i.e. sampled =
 * R⁻¹·world — so the euler must satisfy SUN_DIR = R·HDR_SUN_DIR, which is
 * exactly this quaternion. */
function skyEuler(): THREE.Euler {
  const q = new THREE.Quaternion().setFromUnitVectors(HDR_SUN_DIR, SUN_DIR);
  return new THREE.Euler().setFromQuaternion(q, "XYZ");
}

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
      // visible sky: the panorama, tilted so its sun sits at SUN_DIR
      this.scene.background = tex;
      this.scene.backgroundRotation = skyEuler();
      // IBL from the same sky, rotated to match — glossy paint picks up the
      // sun where the eye sees it
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromEquirectangular(tex);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentRotation = skyEuler();
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

// ─── Daytime sky: real HDR panoramas — background + image-based light ──────
// Day maps (SPA '92, ISLAND COVE) each raise their own photographed sky
// (EnvThemeSpec.timeOfDay = "day"). The sky IS the scene background AND the
// IBL, so ambient light carries the sun's warmth and glossy paint picks up
// real clouds instead of studio grey.
//
// Every day panorama ships WORLD-ALIGNED (the v7 bake, scripts/hdr_remap.mjs
// and its island sibling hdr_remap_island.mjs): the photo sun is baked onto
// SUN_DIR (el 15°, az 33° — the light rig's own direction) and the photo
// horizon sits at world el 0 on EVERY azimuth, so the panorama runs at
// IDENTITY rotation. History: the pre-v7 builds rotated the panorama ~34°
// at runtime to align the sun, which necessarily tilted the photo horizon —
// a tilted "sea" line (v5), then a lopsided fog wedge (v6; user: "the sky in
// that position need rotating. its lopsided"). The bake removes the rotation
// entirely; below the world horizon the rows mirror the sky and melt into the
// map's fog colour. Each map's bake melts into ITS OWN palette fog (spa:
// 0xb9d2e2 hazy morning; island: 0xcfe4ee sea haze) — the void past the
// finite terrain reads as distance, never as a second ground.
//
// SUN PLACEMENT: the visible sun sits exactly at SUN_DIR in every bake by
// construction, so the shared light rig is untouched and shadows match what
// the player sees on both maps.
//
// scene.environment gets a PMREM of the same HDR — no rotation: the bakes are
// already world-aligned, so IBL highlights agree with the visible sun.

import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

/** direction the sun shines from (game space). UNCHANGED from the furniture
 *  build — the shadow rig (offset ·263, ortho ±200, bias −0.0005/0.5) was
 *  tuned against it. Every day sky bake puts the photo sun onto THE LIGHT.
 *  (500,160,325) → elev 15°, az 33°. */
export const SUN_DIR = new THREE.Vector3(500, 160, 325).normalize();

// ── per-map day skies ────────────────────────────────────────────────────────
// Every day map points at its own world-aligned bake; unknown ids fall back
// to the spa panorama (a day theme with no DAY_SKIES entry should never
// happen, but the game stays playable if one is added without a sky).
/** in-place HDR swap revision (immutable HTTP cache + SW bucket invalidation,
 *  same lesson as ASPHALT_REV — bump the map's rev when re-baking its file) */
interface SkySpec {
  file: string;
  rev: number;
}
const DAY_SKIES: Record<string, SkySpec> = {
  // v7: world-aligned bake — yaw + vertical remap put the photo sun on
  // SUN_DIR with the horizon at world el 0 on every azimuth (replacing the
  // ~34° runtime tilt whose tilted photo horizon caused the v5 "sea" line and
  // the v6 lopsided wedge). Below-horizon rows melt into spa fog 0xb9d2e2.
  // 2k on purpose: 4k would cost 4× the bytes + a 67 MB GPU texture; the
  // PMREM IBL is 256px regardless, so only background sharpness differs.
  spa: { file: "/models/sky/sunflowers_puresky_2k.hdr", rev: 7 },
  // v1: Poly Haven CC0 "Illovo Beach" — bright Durban morning, sand + palms
  // and an open-ocean horizon (chosen by horizon probe: clean sun disc, zero
  // dark horizon rows). Baked with the same world-align guarantees by
  // scripts/hdr_remap_island.mjs; below-horizon rows melt into island fog
  // 0xcfe4ee (sea haze).
  island: { file: "/models/sky/illovo_beach_2k.hdr", rev: 1 },
};
const DEFAULT_SKY: SkySpec = DAY_SKIES.spa;

/** the baked panorama URL for a map's day sky */
export function skyHdriFor(mapId: string): string {
  const s = DAY_SKIES[mapId] ?? DEFAULT_SKY;
  return `${s.file}?v=${s.rev}`;
}

/** AssetPreloader registry — the boot bar byte-fetches the map's sky (SW
 *  cache warm) and the parse below then re-reads it cache-hot. */
export function skyAssetsFor(mapId: string) {
  return [{ key: "sky:hdri", label: "DAY SKY", candidates: [skyHdriFor(mapId)] }] as const;
}

// ── module texture cache (parse once per map, reuse across races) ────────────

const texCache = new Map<string, Promise<THREE.DataTexture | null>>();

/** load + cache the panorama for a map (null on failure — the race stays
 *  fully playable on the flat palette background). Progress feeds the boot bar. */
export function loadDaySkyTexture(
  mapId: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<THREE.DataTexture | null> {
  let p = texCache.get(mapId);
  if (!p) {
    const url = skyHdriFor(mapId);
    p = new Promise((resolve) => {
      new HDRLoader().load(
        url,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          resolve(tex);
        },
        (e) => {
          if (onProgress && e.total) onProgress(e.loaded, e.total);
        },
        (err) => {
          console.warn(`[DaySky] HDRI load failed (${mapId}):`, err);
          resolve(null);
        },
      );
    });
    texCache.set(mapId, p);
  }
  return p;
}

// ── the per-race sky system ────────────────────────────────────────────────

export class DaySky {
  /** kept for API compatibility — the sky IS the scene background now */
  readonly group = new THREE.Group();
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private disposed = false;

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    /** which map's baked sky to raise (see DAY_SKIES) */
    private readonly mapId: string,
  ) {
    this.scene = scene;
    this.renderer = renderer;
    void loadDaySkyTexture(this.mapId).then((tex) => {
      if (this.disposed || !tex) return;
      // visible sky: every bake is pre-baked in world orientation (sun on
      // SUN_DIR, horizon at world el 0 on every azimuth) — IDENTITY rotation,
      // no backgroundRotation/env rotation needed
      this.scene.background = tex;
      // IBL from the same sky, unrotated — the bakes are already world-
      // aligned, so glossy paint picks up the sun where the eye sees it
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envRT = pmrem.fromEquirectangular(tex);
      this.scene.environment = this.envRT.texture;
      pmrem.dispose();
    });
  }

  /** per-frame: nothing — the background is camera-invariant. Kept as a
   *  no-op so call sites need no special-casing. */
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

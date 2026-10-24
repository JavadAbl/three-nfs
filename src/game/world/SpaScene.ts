// ─── SPA '92: the user's own GLB scene, imported as the map's scenery ────────
// Source: "Circuit de Spa-Francorchamps 1992 layout" by Dave Love (Sketchfab,
// CC-BY-4.0) — the same model the centerline + terrain grid were extracted
// from (scripts/extract_spa.cjs). This loader brings over the REST of the
// model: pine forests, catch fencing, tire walls, pit buildings, grandstands,
// signs — everything dressed, with the model's own 64 embedded textures.
//
// Geometry lives in glTF world space (Y-up, node transforms applied) — the
// SAME space the centerline walk ran in — so placing it under one affine
// matrix lands every mesh exactly where our road runs. The constants below
// are provenance-critical: they were dumped by `extract_spa.cjs emit` at the
// commit that generated spa_generated.ts, and verified by re-running emit to
// a byte-identical output. Do not hand-edit them; re-dump from the extractor.
//
// Excluded by material-name regex (see EXCLUDE_RE) with the reasoning inline:
// the terrain sheets and drive surfaces are OURS (rasterized heightfield +
// spline ribbon) — importing coincident copies would z-fight both.
import * as THREE from "three";
import { getGLTFLoader } from "./CarModelLoader";

export const SPA_SCENE_URL = "/models/spa/spa-92-scene.glb?v=1";

/** world->game affine constants — dumped by scripts/extract_spa.cjs emit
 * (scripts/spa_xf.json). game = Translate(-cx,0,-cz) · RotY(-ang) · Scale ·
 * Translate(-p0), applied to glTF-world vertices. */
const XF = {
  scale: 0.18293479463268475,
  ang: -1.259378901234815,
  p0: [4007.961614, -500.64228, -3427.692586] as [number, number, number],
  cx: 414.307713,
  cz: 647.502414,
};

/** meshes we deliberately do NOT import:
 *  - terrain sheets (grdrl/hilla/blyatcat/grass/rdgrass): they were rasterized
 *    into SPA_TERRAIN (24 m cells) and our displaced ground plane IS them;
 *    two coincident surfaces shimmer (validated in scripts/spa_scene_dryrun:
 *    median |Δy| 0.2-0.9 m — within z-fight range)
 *  - drive surfaces (road, rumble, pit lane, old public roads + the grass
 *    strips at their edges): physics, AI, checkpoints and the minimap all
 *    live on OUR spline ribbon, which deviates a couple of metres from
 *    their modular tarmac through corners — their road would clip through
 *    the playable surface
 *  - gravel-trap decals (gbrm mats): terrain-level patches (median |Δy|
 *    0.07-0.38), same z-fight/float exposure as the sheets */
const EXCLUDE_RE = new RegExp(
  [
    "^Meshes(grdrl|grassxgrass|grassfld|rdgrass|hilla|blyatcat)",
    "^Meshes(road|grassxroad)",
    "^Meshesgbrm",
  ].join("|")
);

/** world→game affine, composed exactly as extract_spa.cjs's T2():
 * game = Translate(-cx,0,-cz) · RotY(-ang) · Scale(s) · Translate(-p0) ·
 * RotX(180°). The trailing Rx(180°) is NOT optional: the extractor's raw
 * glTF parsing composes node matrices transposed, so its "world" and
 * three.js's (spec-correct) glTF world differ by a 180° X-rotation (Z and
 * elevation flipped). SPA_POINTS/SPA_TERRAIN were extracted in the raw
 * world — the scene must be rotated into that same world or every prop
 * lands ~115 m overhead and mirrored (live-measured: pit garage at y=138 m
 * instead of 45 m; fences/fences/pines likewise). Verified fix: garage
 * vertex (4747,-2308,-252)_local → raw world (4747,-252,2308) → game
 * (626, 45.5, -455) = grounded, matching the dry-run corridor metrics.
 * NB: three's makeRotationY(θ) rotates x' = x·cosθ + z·sinθ — the inverse
 * sense of the extractor's (x·cos − z·sin), hence the −ang here. */
function worldToGameMatrix(): THREE.Matrix4 {
  return new THREE.Matrix4()
    .makeTranslation(-XF.cx, 0, -XF.cz)
    .multiply(new THREE.Matrix4().makeRotationY(-XF.ang))
    .multiply(new THREE.Matrix4().makeScale(XF.scale, XF.scale, XF.scale))
    .multiply(new THREE.Matrix4().makeTranslation(-XF.p0[0], -XF.p0[1], -XF.p0[2]))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI));
}

/** template cache — parse + tune once, clone per race (clone shares geometry
 * and material references, so clones are near-free and the cache owns all
 * GPU resources for the app lifetime) */
const templates = new Map<string, THREE.Group>();
const inflight = new Map<string, Promise<THREE.Group | null>>();

export type SpaSceneProgress = (loaded: number, total: number) => void;

/** load (and cache) the imported scene for a map. Resolves null when the GLB
 * can't be fetched — the race stays playable on ground + stars alone.
 * `day` selects the time-of-day tuning variant (cache-keyed): the same GLB
 * is tuned once for night (albedo-emissive lift) and once for day (raw
 * authored textures under the sun rig — the model was photographed at day,
 * so at day it needs NO lift at all). */
export function loadSpaScene(
  url: string,
  onProgress?: SpaSceneProgress,
  day = false,
): Promise<THREE.Group | null> {
  const cacheKey = url + "|" + (day ? "day" : "night");
  const cached = templates.get(cacheKey);
  if (cached) return Promise.resolve(cached.clone());
  const running = inflight.get(cacheKey);
  if (running) return running.then((t) => (t ? t.clone() : null));
  const job = (async (): Promise<THREE.Group | null> => {
    const loader = getGLTFLoader();
    const gltf = await loader.loadAsync(url, (e) => {
      if (onProgress && e.total) onProgress(e.loaded, e.total);
    });
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    // ── pass 1: drop excluded meshes (terrain sheets / drive surfaces) ──
    const drop: THREE.Object3D[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      // any-material match: excluded surfaces are single-prim meshes, but be
      // safe against future multi-material splits
      if (mats.some((x) => EXCLUDE_RE.test(x.name || ""))) drop.push(m);
    });
    for (const m of drop) m.removeFromParent();

    // ── pass 0: bake the world→game affine into the root (provenance: the
    // extractor's own constants, verified by the byte-identical emit + the
    // scripts/spa_scene_dryrun.cjs corridor fit — main ribbon median 5.2 m) ──
    root.applyMatrix4(worldToGameMatrix());

    // ── pass 2: per-material time-of-day tuning (shared within the file) ──
    const seen = new Set<THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? (m.material as THREE.MeshStandardMaterial[]) : [m.material as THREE.MeshStandardMaterial];
      for (const mat of mats) {
        if (!mat || seen.has(mat)) continue;
        seen.add(mat);
        // BLEND billboards (trees, fences, signs — 26 materials) → alpha-
        // tested cutouts: no per-frame transparency sorting, correct depth
        // writes against the forest wall, and hole-free shadow silhouettes.
        // Needed at day too — the foliage alpha is the same in the sun.
        if (mat.transparent) {
          mat.transparent = false;
          mat.alphaTest = 0.35;
          mat.depthWrite = true;
          // alpha-shaped SHADOWS: the default depth material renders the
          // full quad opaque, so every billboard would throw a rectangle
          // shadow (a fence card = a slab of darkness on the ground). A
          // depth material with the same map + alpha cuts the shadow to
          // the visible fence/sign shape.
          if (mat.map) {
            m.customDepthMaterial = new THREE.MeshDepthMaterial({
              depthPacking: THREE.RGBADepthPacking,
              map: mat.map,
              alphaTest: mat.alphaTest,
            });
          }
          // PINE CARDS DO NOT CAST: they come in dense single-file walls,
          // and at the day sun's low elevation each card shadows its
          // neighbours — the entire wall self-blackens (VLM bisection:
          // shadows off = green forest, on = "black void"; at night the
          // emissive lift had masked the same physics). Their silhouettes
          // are dark green photo albedo anyway — unshadowed reads right.
          if (/pine/i.test(mat.name || "")) {
            m.userData.noCastShadow = true;
          }
        }
        if (!day) {
          // night lift — texture-modulated self-glow: the model's albedo
          // doubles as the emissive map, so white fence bands, catch-fence
          // wires and lit windows glow through the night while black tires
          // and deep forest stay dark (a flat emissive tint left the safety
          // furniture reading as a featureless dark strip — VLM-verified
          // "fence present but dark brown/black"). Materials that authored
          // their own emissive maps are left alone.
          if (mat.map) {
            mat.emissiveMap = mat.map;
            mat.emissive = new THREE.Color(0xffffff);
            mat.emissiveIntensity = 0.28;
          } else if (!mat.emissiveMap) {
            mat.emissive = new THREE.Color().copy(mat.color).multiplyScalar(0.1);
          }
        } else if (/pine/i.test(mat.name || "") && mat.map) {
          // DAY forest lift: the pine cards' authored albedo is genuinely
          // near-black (live texel dump: solid texels avg RGB 32,37,27) —
          // a night photo of spruce. Diffuse-lit or emissive-modulated, it
          // renders as a void against a bright day frame (VLM: "pure black
          // silhouettes", pixel scan: 490 near-black against green ground).
          // Fix at the ROOT: an HDR color multiplier (three.js Colors may
          // exceed 1.0) lifts the albedo itself 3x to (96,111,81) readable
          // forest green, plus a light translucence emissive for backlight.
          // Calibration: 2.4x still read "almost black" (VLM), 3.0x live-
          // verified as "dark-green forest".
          mat.color = new THREE.Color(3, 3, 3);
          mat.emissiveMap = mat.map;
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveIntensity = 0.4;
        }
        mat.userData.shared = true; // cache-owned — CityEnvironment.dispose skips
        mat.needsUpdate = true;
      }
      // geometry + shadows: cast+receive so the light rig (moon or sun)
      // shades the real buildings and the forest — except the no-cast
      // billboards flagged above (pine cards blacken their own wall)
      m.castShadow = !m.userData.noCastShadow;
      m.receiveShadow = true;
      if (m.geometry) m.geometry.userData.shared = true;
    });

    templates.set(cacheKey, root);
    return root;
  })();
  inflight.set(cacheKey, job);
  const out = job.then((t) => {
    inflight.delete(cacheKey);
    return t ? t.clone() : null;
  });
  return out;
}

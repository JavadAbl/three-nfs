// ─── Daytime sky dressing: the sun disc + drifting cloud field ──────────────
// SPA '92 plays at day (EnvThemeSpec.timeOfDay = "day"). The GLB scene has no
// sky of its own (verified: no dome/sky meshes or textures in the file), so
// the sky itself stays procedural — flat palette background + this furniture:
//
//  - SUN: the user's uploaded the_sun.glb (a clean orange icosphere — picked
//    by render-off against their stroming_sun candidate, which reads as a
//    dark broken mesh in-game). It rides a fixed direction from the camera
//    (skybox-style) so it NEVER parallaxes away on the 6.95 km lap, always
//    sits where the shadow-casting directional light shines from, and fog
//    cannot wash it out. Drawn first with depthTest off — terrain paints
//    over it, so it reads as a distant object behind the world.
//
//  - CLOUDS: the user's uploaded cloud.glb (volumetric puffy mesh — beat the
//    flat cloud_test and pink translucent fluffy_cloud candidates). World-
//    fixed instances scattered high over the map, drifting on a slow wind and
//    wrapping around the map box. They DO fog (aerial haze swallows far ones
//    naturally instead of popping at the camera far plane).
//
// Models load from /models/sky/ (accepted) with /models/staging/sky/ fallback
// (pending user acceptance — same two-path pattern as every scanned asset),
// through template caches so AssetPreloader can warm them and races clone.

import * as THREE from "three";
import { getGLTFLoader } from "./CarModelLoader";

/** direction the sun shines from (game space). Single source of truth:
 * the visible disc, the directional light + its shadow offset, and the
 * PMREM sun blob all read this so highlights and shadows agree.
 * ELEVATION IS A CAMERA QUESTION, not an astronomy one: the chase cam
 * pitches down, so the visible sky is a thin wedge — at 57° the disc sat
 * above the frame (probe: NDC y 0.99 at the very top edge), at 29° still
 * 0.99. 15° puts it mid-wedge in normal driving AND throws long dramatic
 * shadows (40 m pines → 150 m stripes). (500,160,325) → elev 15°, az 57°. */
export const SUN_DIR = new THREE.Vector3(500, 160, 325).normalize();

/** file revision — bump when swapping a sky model in place (immutable-cache
 *  + SW bucket invalidation, same lesson as ASPHALT_REV). */
const SKY_REV = 1;

/** load candidates: accepted dir first, staging twin as fallback */
function skyCandidates(file: string): string[] {
  return [`/models/sky/${file}`, `/models/staging/sky/${file}`].map((p) => `${p}?v=${SKY_REV}`);
}

/** AssetPreloader registry — the GLBs the sky system can pull, so the boot
 *  bar warms them instead of a mid-race fetch hitch. */
export const SKY_ASSETS = [
  { key: "sky:sun", label: "SUN", candidates: skyCandidates("the_sun.glb") },
  { key: "sky:cloud", label: "CLOUDS", candidates: skyCandidates("cloud.glb") },
] as const;

/** try candidates in order — first that parses wins */
async function loadGLBFirst(
  candidates: readonly string[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<THREE.Group> {
  const loader = getGLTFLoader();
  let last: unknown;
  for (const url of candidates) {
    try {
      const gltf = await loader.loadAsync(url, (e) => {
        if (onProgress && e.total) onProgress(e.loaded, e.total);
      });
      return gltf.scene;
    } catch (e) {
      last = e;
    }
  }
  throw last ?? new Error("no sky model candidates");
}

// ── template caches (parse + tune once, clone per race — SpaScene pattern) ──

const sunTemplate: { promise?: Promise<THREE.Group | null> } = {};
const cloudTemplate: { promise?: Promise<THREE.Group | null> } = {};

/** tune the sun: unlit pure-orange disc, ignores fog, never tonemap-crushed.
 *  The GLB's MeshStandard would shade like a ball (dark underside); a sun is
 *  a light SOURCE — MeshBasic keeps it flat-bright from every angle. Opaque +
 *  renderOrder -1000 draws it before the world; depthTest stays ON (terrain
 *  occludes it naturally behind hills) but it never WRITES depth — sky
 *  furniture must not block the world's depth buffer. */
function tuneSun(root: THREE.Group): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.receiveShadow = false;
    m.renderOrder = -1000;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc659, fog: false });
    mat.depthWrite = false;
    (m.material as THREE.Material).dispose();
    m.material = mat;
    if (m.geometry) m.geometry.userData.shared = true;
  });
  // the model is a 2 m icosphere; scale reads ~120 m disc at 1150 m pin
  // distance — a stylized big NFS sun, bold enough to hold a ~6 deg read
  root.scale.setScalar(60);
}

/** tune the clouds → UNLIT MAPLESS sky furniture. Long bisection: the
 *  authored Standard material (base+normal map) submitted draws but
 *  produced zero pixels under SwiftShader; a whitened-canvas Basic+map
 *  also produced zero pixels; the sun's plain mapless Basic on the same
 *  meshes DID render. All texture-sampling paths on these meshes are
 *  unreliable in the headless verifier, so the cloud ships mapless: a
 *  flat white-grey MeshBasic whose 69k-vert puff silhouette carries the
 *  shape — stylized-cloud read (Mario-Kart style), zero texture risk on
 *  any GPU. BLEND opacity keeps them soft against the sky. */
function tuneCloud(root: THREE.Group): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false;
    m.receiveShadow = false;
    const std = m.material as THREE.MeshStandardMaterial;
    if (std) {
      const basic = new THREE.MeshBasicMaterial({
        color: 0xeef3f8,
        transparent: true,
        opacity: 0.82,
        fog: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      (std as THREE.Material).dispose();
      m.material = basic;
    }
    if (m.geometry) m.geometry.userData.shared = true;
  });
}

/** load + cache the sun template (null on failure — the sky just has no disc;
 *  the race stays fully playable). Progress feeds the boot loading bar. */
export function loadSunTemplate(onProgress?: (loaded: number, total: number) => void): Promise<THREE.Group | null> {
  if (!sunTemplate.promise) {
    sunTemplate.promise = loadGLBFirst(SKY_ASSETS[0].candidates, onProgress).then(
      (root) => {
        root.updateMatrixWorld(true);
        tuneSun(root);
        return root;
      },
      (e: unknown) => {
        console.warn("[DaySky] sun model failed:", e);
        return null;
      },
    );
  }
  return sunTemplate.promise;
}

/** load + cache the cloud template (null on failure — plain empty sky) */
export function loadCloudTemplate(onProgress?: (loaded: number, total: number) => void): Promise<THREE.Group | null> {
  if (!cloudTemplate.promise) {
    cloudTemplate.promise = loadGLBFirst(SKY_ASSETS[1].candidates, onProgress).then(
      (root) => {
        root.updateMatrixWorld(true);
        tuneCloud(root);
        return root;
      },
      (e: unknown) => {
        console.warn("[DaySky] cloud model failed:", e);
        return null;
      },
    );
  }
  return cloudTemplate.promise;
}

// ── the per-race sky system ────────────────────────────────────────────────

interface CloudInstance {
  obj: THREE.Object3D;
  /** drift speed on +x, m/s (small — clouds read distant) */
  speed: number;
  /** wrap half-width on x */
  wrap: number;
}

export class DaySky {
  readonly group = new THREE.Group();
  private readonly clouds: CloudInstance[] = [];
  private sun: THREE.Object3D | null = null;
  private readonly sunPin = new THREE.Vector3();
  private disposed = false;

  constructor(groundExtent: number) {
    // sun disc: camera-pinned skybox element
    void loadSunTemplate().then((t) => {
      if (this.disposed || !t) return;
      this.sun = t.clone();
      this.sun.renderOrder = -1000;
      this.group.add(this.sun);
      // first pin happens in update() once the camera ticks
    });
    // cloud field: 6 puffs on a slow wind, riding the HORIZON BAND. The
    // chase camera pitches down, so the visible sky is a thin wedge —
    // horizon to ~28° elevation (probes: clouds at 40°+ NDC-y never frame;
    // the 15° sun does). Placing them at 90-150 m altitude puts a cloud at
    // 300-700 m horizontal distance right in that band, the same one the
    // sun rides — coherent sky furniture, 1-2 in a typical frame.
    // COUNT BUDGET: cloud.glb is a real volumetric mesh — 69k verts (~137k
    // tris) PER INSTANCE; six instances keep the typical on-screen cost at
    // 1-2 × 137k tris, paid for by the 8 per-car spotlights the day rig drops.
    void loadCloudTemplate().then((t) => {
      if (this.disposed || !t) return;
      const half = groundExtent * 0.35;
      const wrap = groundExtent * 0.45;
      let seed = 1993;
      const rand = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let i = 0; i < 6; i++) {
        const c = t.clone();
        c.position.set(
          (rand() * 2 - 1) * half,
          90 + rand() * 60, // horizon band — same sky stripe as the 15° sun
          (rand() * 2 - 1) * half,
        );
        c.rotation.y = rand() * Math.PI * 2;
        const s = 4 + rand() * 3; // 45-80 m puffs at 300-700 m distance
        c.scale.setScalar(s);
        this.group.add(c);
        this.clouds.push({ obj: c, speed: 4 + rand() * 5, wrap });
      }
    });
  }

  /** per-frame: pin the sun to the camera (skybox behaviour) + drift clouds */
  update(dt: number, camera: THREE.Camera): void {
    if (this.sun) {
      this.sunPin.copy(camera.position).addScaledVector(SUN_DIR, 1150);
      this.sun.position.copy(this.sunPin);
    }
    for (const c of this.clouds) {
      c.obj.position.x += c.speed * dt;
      if (c.obj.position.x > c.wrap) c.obj.position.x = -c.wrap;
    }
  }

  dispose(): void {
    this.disposed = true;
    // templates are module-cached and shared across races — only the
    // per-race clones die here. Clones share geometry/materials with the
    // template, so nothing to dispose; just detach.
    this.group.clear();
    this.clouds.length = 0;
    this.sun = null;
  }
}

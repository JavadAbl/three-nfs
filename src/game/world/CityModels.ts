// ─── CityModels: building prototype library from merged set GLBs ──────────────
// Loads the city building sets produced by scripts/extract_buildings.js
// (one merged GLB per source: ny / night / lpcity / cc). Each set GLB has a
// "cityset" root whose children are per-building wrapper nodes (name = slug,
// matrix = bottom-center pivot + real-world metre scale). Every building is
// baked into per-material merged geometries so the scatter system can instance
// it with a couple of draw calls. Materials are shared within a source set
// (GLTFLoader gives one instance per texture), so night sets authored with
// emissive glow keep it, and day-textured sets get a luminance-gated window
// glow shader so they read as night city, not noon office blocks.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SET_BASE = "/models/staging/city/";
const SETS = ["ny", "night", "lpcity", "cc"] as const;

export interface BuildingPart {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

export interface BuildingProto {
  slug: string;
  parts: BuildingPart[];
  width: number;
  depth: number;
  height: number;
  /** set has authored emissive windows (night / cc) — no shader glow needed */
  authoredGlow: boolean;
  /** day-textured set — luminance window shader applied */
  shaderGlow: boolean;
}

let protos: BuildingProto[] | null = null;
let inflight: Promise<BuildingProto[]> | null = null;

/** warm amber windows for luminance-gated glow (sodium/office mix) */
const GLOW_COLOR = new THREE.Color(1.0, 0.72, 0.45);

/**
 * Luminance-gated window glow: bright pixels of the albedo (lit windows in
 * the baked day textures) become emissive at night. Injected via
 * onBeforeCompile on the shared set material — one program per set.
 */
function applyWindowGlow(mat: THREE.MeshStandardMaterial, intensity: number) {
  if (!mat.map) return; // no albedo — nothing to gate on
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWinGlowColor = { value: GLOW_COLOR };
    shader.uniforms.uWinGlowIntensity = { value: intensity };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        // night windows: luminance-gated glow from the albedo texture.
        // NOTE: texture2D(map) returns LINEAR values (sRGB textures are
        // GPU-decoded) — day-texture windows read ~0.3-0.8 linear, facades
        // ~0.05-0.2, so the gate lives low.
        vec3 winAlb = texture2D( map, vMapUv ).rgb;
        float winLuma = dot( winAlb, vec3( 0.2126, 0.7152, 0.0722 ) );
        totalEmissiveRadiance += smoothstep( 0.18, 0.55, winLuma ) * uWinGlowColor * uWinGlowIntensity;`
      )
      .replace(
        "void main() {",
        "uniform vec3 uWinGlowColor;\nuniform float uWinGlowIntensity;\nvoid main() {"
      );
  };
  // distinct program cache key per intensity variant
  mat.customProgramCacheKey = () => "cityWinGlow" + intensity;
}

/** merge a building's meshes into one geometry per material (world-baked) */
function bakeParts(root: THREE.Object3D): { parts: BuildingPart[]; box: THREE.Box3 } {
  const byMat = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    let src = mesh.geometry.clone();
    // bake the full world transform (wrapper pivot + any sub-node transforms)
    src.applyMatrix4(mesh.matrixWorld);
    // per-vertex normal matrix for scale/rotation (applyMatrix4 handles normals
    // via normal attribute only for uniform scale — ours are uniform, ok)
    // mergeGeometries needs all-indexed or all-non-indexed: normalize to non-indexed
    if (src.index) src = src.toNonIndexed();
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(src);
    // expand bounds from position attribute directly (instances not yet applied)
    const pos = src.getAttribute("position");
    if (pos) for (let i = 0; i < pos.count; i++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, i));
  });

  const parts: BuildingPart[] = [];
  for (const [mat, geoms] of byMat) {
    // trim attributes to the common set so mergeGeometries accepts them
    const common = new Set<string>(Object.keys(geoms[0].attributes));
    for (const g of geoms) {
      for (const k of Object.keys(g.attributes)) if (!common.has(k)) g.deleteAttribute(k);
    }
    const merged = mergeGeometries(geoms, false);
    if (merged) {
      // shared for the app lifetime (prototype cache) — scene dispose skips these
      merged.userData.shared = true;
      mat.userData.shared = true;
      parts.push({ geometry: merged, material: mat });
    }
    geoms.forEach((g) => g.dispose()); // merged holds its own buffers
  }
  return { parts, box };
}

async function loadSet(loader: GLTFLoader, set: string): Promise<BuildingProto[]> {
  const gltf = await loader.loadAsync(SET_BASE + set + ".glb");
  const out: BuildingProto[] = [];
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const daySets = set === "ny" || set === "lpcity";
  {
    // per-set night tuning — materials are shared within a set, tune each once.
    // The scene runs FogExp2(0.0105): without a strong emissive push the lit
    // windows wash out into fog silhouettes (the old procedural boxes ran
    // emissiveIntensity 0.75 with bold window grids and popped).
    const seen = new Set<THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (seen.has(mat)) return;
      seen.add(mat);
      if (daySets) {
        // day-textured sets: mild night dim on the diffuse albedo …
        mat.color.setRGB(0.62, 0.65, 0.72);
        // … and luminance-gated window glow
        applyWindowGlow(mat, set === "ny" ? 2.2 : 1.6);
      } else if (mat.emissiveMap || (mat.emissive && mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.01)) {
        // authored night sets: push the glow through the fog
        mat.emissiveIntensity = Math.min(Math.max(mat.emissiveIntensity, 1) * 2.2, 3.2);
      }
      mat.needsUpdate = true;
    });
  }

  // gltf.scene -> "cityset" node -> building wrappers
  const cityset = root.children.find((c) => c.name === "cityset") ?? root;
  const wrappers = cityset === root ? root.children : cityset.children;
  for (const child of wrappers) {
    // each child = one normalized building wrapper
    const { parts, box } = bakeParts(child);
    if (!parts.length) continue;
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.y < 2 || size.x < 2 || size.z < 2) {
      parts.forEach((p) => p.geometry.dispose());
      continue;
    }
    let authoredGlow = false;
    for (const p of parts) {
      if (p.material.emissiveMap || (p.material.emissive && p.material.emissive.r + p.material.emissive.g + p.material.emissive.b > 0.01)) {
        authoredGlow = true;
        break;
      }
    }
    out.push({
      slug: child.name || set + "-b" + out.length,
      parts,
      width: size.x,
      height: size.y,
      depth: size.z,
      authoredGlow,
      shaderGlow: daySets,
    });
  }
  return out;
}

/** load + bake all sets (cached; safe to call repeatedly) */
export function loadCityModels(): Promise<BuildingProto[]> {
  if (protos) return Promise.resolve(protos);
  if (inflight) return inflight;
  const loader = new GLTFLoader();
  inflight = Promise.all(SETS.map((s) => loadSet(loader, s).catch((e) => {
    console.warn("[CityModels] set " + s + " failed:", e);
    return [] as BuildingProto[];
  }))).then((lists) => {
    protos = lists.flat();
    return protos;
  });
  return inflight;
}

/** debug: true once sets have loaded and baked */
export function cityModelsReady(): boolean {
  return protos !== null;
}

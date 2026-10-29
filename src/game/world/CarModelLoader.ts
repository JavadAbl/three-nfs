// ─── CarModelLoader: loads, normalizes & rigs GLB car models ─────────────────
// Any GLB dropped into /public/models can become a drivable car:
//   1. normalized: forward +Z, ground y=0, target length, centered
//   2. wheels auto-detected by node name (/wheel/i), axle pairs split L/R,
//      wrapped in spin/steer pivots
//   3. paint materials detected (/carpaint/i or /_details$/) for per-player tint
//   4. every lamp-family lens lit warm-white front / red rear — dark
//      meshes AND baked-bright rips (GT-R ships white@2 / red@3, the
//      Vipers gray bakes), whether they live as own meshes or as
//      primitives merged inside multi-material bodies
//   5. lit lamp materials reported per model so Car.ts can drive them by
//      time-of-day (night on / day off) and brake flare
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
// the car catalog (ids, model urls, tuning) lives in cars/registry — this
// file is purely the load → normalize → rig pipeline
import { CAR_LIBRARY, carDef } from "../cars/registry";

export interface ModelWheel {
  /** pivot: rotate .rotation[axis] for spin, .rotation.y for steering (front) */
  pivot: THREE.Group;
  isFront: boolean;
  radius: number;
  /** spin axis in pivot local space */
  axis: "x" | "z";
  side: "L" | "R";
}

export interface CarDims {
  length: number;
  width: number;
  height: number;
  frontZ: number;
  rearZ: number;
  topY: number;
}

/** a lit lamp-lens material + which end of the car it glows on */
export interface LampMat {
  mat: THREE.MeshStandardMaterial;
  front: boolean;
}

export interface CarModelInstance {
  root: THREE.Group;
  wheels: ModelWheel[];
  dims: CarDims;
  wheelRadius: number;
  /** per-instance cloned tintable materials */
  paintMaterials: THREE.MeshStandardMaterial[];
  /** per-instance cloned LIT lamp-lens materials — the model's own lamps */
  lampMats: LampMat[];
}

interface Template {
  url: string;
  wrapper: THREE.Group; // normalized + rigged (pivots named wheelPivot_XX)
  dims: CarDims;
  wheelRadius: number;
  paintNames: Set<string>;
  /** lit lamp materials created during the build (shared by clones) */
  lampMats: LampMat[];
}

/** how long every model car is normalized to (matches physics tuning) */
const TARGET_LENGTH = 4.55;
/** wheel mesh wider than this = a merged L+R axle pair needing a split */
const PAIR_WIDTH = 1.15;
/** wheel mesh longer than this = merged front+rear wheels needing a split */
const MERGED_AXLE_LENGTH = 1.2;
/** max distance for attaching loose nodes (brake discs, centre caps) to a wheel */
const ATTACH_RADIUS = 0.55;

const loader = new GLTFLoader();
// Draco-compressed GLBs (decoder is fetched once from /draco/ and cached;
// uncompressed GLBs are unaffected)
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
// preload() fires a fetch of the wasm wrapper with a relative URL — fine in
// the browser, but throws ERR_INVALID_URL during SSR module evaluation
// (Node fetch needs absolute URLs). Only warm it client-side.
if (typeof window !== "undefined") {
  dracoLoader.preload();
}
loader.setDRACOLoader(dracoLoader);
// KTX2 GPU-compressed textures (KHR_texture_basisu): decode straight to the
// GPU's native format (BC7/ASTC/ETC2) — stays compressed in VRAM, ~6-8x less
// than WebP which unpacks to raw RGBA. Transcoder cached from /ktx2/.
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath("/ktx2/");
loader.setKTX2Loader(ktx2Loader);

// KTX2Loader needs to know the GPU's supported formats BEFORE the first
// KTX2 GLB is parsed — but models preload on the menu screen, before any
// renderer exists. Probe once with a throwaway 1x1 context; the detected
// formats persist on the loader (real renderers re-register later).
let ktx2Probed = false;
function ensureKTX2Support(): void {
  if (ktx2Probed) return;
  ktx2Probed = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const probe = new THREE.WebGLRenderer({ canvas });
    ktx2Loader.detectSupport(probe);
    probe.dispose();
    probe.forceContextLoss();
  } catch (e) {
    console.warn("[CarModelLoader] KTX2 GPU-texture probe failed:", e);
  }
}

/** re-run format detection with a live renderer (garage preview / race) */
export function registerKTX2Renderer(renderer: THREE.WebGLRenderer): void {
  ktx2Loader.detectSupport(renderer);
}

/** the shared configured loader (DRACO + KTX2 + GPU-format probe) — other
 * model pipelines (city building sets) reuse this instead of bare
 * GLTFLoaders, which would silently miss KHR_texture_basisu textures. */
export function getGLTFLoader(): GLTFLoader {
  ensureKTX2Support();
  return loader;
}
const templates = new Map<string, Template>();
const inflight = new Map<string, Promise<Template>>();

/** load (and cache) a car template — resolves null for procedural (no-model) cars.
 * onProgress forwards the raw byte stream (loaded, total) for boot loading bars. */
export function loadCarModel(
  id: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Template | null> {
  const def = carDef(id);
  if (!def) return Promise.reject(new Error(`unknown car "${id}"`));
  if (!def.modelUrl) return Promise.resolve(null);
  const cached = templates.get(id);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(id);
  if (pending) return pending;
  ensureKTX2Support(); // probe GPU formats before the first KTX2 GLB parse
  const p = loader
    .loadAsync(def.modelUrl, (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded, e.total);
    })
    .then((gltf) => {
      const tpl = buildTemplate(id, gltf.scene);
      templates.set(id, tpl);
      inflight.delete(id);
      return tpl;
    })
    .catch((err) => {
      inflight.delete(id);
      throw err;
    });
  inflight.set(id, p);
  return p;
}

/** warm the cache for every model car (called on menu mount) */
export function preloadAllCarModels(): Promise<PromiseSettledResult<Template | null>[]> {
  return Promise.allSettled(CAR_LIBRARY.map((c) => loadCarModel(c.id)));
}

/** true when the template is already in cache */
export function hasCarModel(id: string): boolean {
  return templates.has(id);
}

// ─── instantiate a drivable copy ────────────────────────────────────────────
export function instantiateCar(id: string, paintColor?: string): CarModelInstance | null {
  const tpl = templates.get(id);
  if (!tpl) return null;
  const root = tpl.wrapper.clone(true);

  // clone paint materials per-instance (so tinting one car doesn't tint all)
  const paintMaterials: THREE.MeshStandardMaterial[] = [];
  // clone lit lamp materials per-instance too — each car's day/night state
  // and brake flare must be independent of its same-model rivals
  const lampMaterials: LampMat[] = [];
  const lampFrontOf = new Map<THREE.Material, boolean>();
  for (const { mat, front } of tpl.lampMats) lampFrontOf.set(mat, front);
  const cloneMap = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replaced = mats.map((m) => {
      if (!tpl.paintNames.has(m.name ?? "")) {
        const front = lampFrontOf.get(m);
        if (front === undefined) return m;
        let c = cloneMap.get(m);
        if (!c) {
          c = m.clone();
          cloneMap.set(m, c);
          lampMaterials.push({ mat: c as THREE.MeshStandardMaterial, front });
        }
        return c;
      }
      let c = cloneMap.get(m);
      if (!c) {
        c = m.clone();
        cloneMap.set(m, c);
        const sm = c as THREE.MeshStandardMaterial;
        // night env boost — glossy paint must pick up the neon city IBL to
        // stay readable at night (GLB default 1.0 is tuned for day renders)
        sm.envMapIntensity = Math.max(sm.envMapIntensity ?? 1, 1.8);
        paintMaterials.push(sm);
      }
      return c;
    });
    mesh.material = Array.isArray(mesh.material)
      ? (replaced as THREE.Material[])
      : (replaced[0] as THREE.Material);
  });

  if (paintColor) applyPaint(paintMaterials, paintColor);

  // collect wheel pivots from the clone (stable names from the template rig)
  const wheels: ModelWheel[] = [];
  root.traverse((o) => {
    const g = o as THREE.Group;
    const m = /^wheelPivot_(F|R)(L|R)$/.exec(g.name ?? "");
    if (m) {
      wheels.push({
        pivot: g,
        isFront: m[1] === "F",
        side: m[2] as "L" | "R",
        radius: tpl.wheelRadius,
        axis: g.userData.spinAxis === "z" ? "z" : "x",
      });
    }
  });

  return { root, wheels, dims: { ...tpl.dims }, wheelRadius: tpl.wheelRadius, paintMaterials, lampMats: lampMaterials };
}

export function applyPaint(mats: THREE.MeshStandardMaterial[], color: string) {
  const c = new THREE.Color(color);
  for (const m of mats) {
    // textured paints get a tint; plain paints get the full colour
    if (m.map) m.color.copy(c.clone().lerp(new THREE.Color(1, 1, 1), 0.25));
    else m.color.copy(c);
  }
}

// ─── template build: normalize + rig ────────────────────────────────────────
// exported for dev probes (scripts/glass_probe.ts runs the real pipeline in
// bun against shipped GLBs — no browser needed)
export function buildTemplate(id: string, scene: THREE.Group): Template {
  const wrapper = new THREE.Group();
  wrapper.name = `carModel_${id}`;
  wrapper.add(scene);
  wrapper.updateMatrixWorld(true);

  // strip transmission (heavy per-frame render pass) → plain transparent glass
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | THREE.MeshPhysicalMaterial[];
    const list = Array.isArray(m) ? m : m ? [m] : [];
    for (const mat of list) {
      if (mat.isMeshPhysicalMaterial && mat.transmission > 0) {
        mat.transmission = 0;
        mat.transparent = true;
        mat.opacity = Math.min(mat.opacity >= 1 ? 0.4 : mat.opacity, 0.5);
        mat.depthWrite = false;
      }
    }
  });

  // ── strip showcase environment (Sketchfab studio floor/ceiling/curtains) ──
  // Giant or far-away meshes poison the bbox used for normalization (toy-car
  // scale, wrong forward axis). Runs BEFORE any bbox math.
  pruneShowroom(scene);

  // ── tag wheel-assembly groups BEFORE flatten ──
  // Game rips (CSR2/Forza) carry each wheel as a multi-mesh assembly under a
  // generically named group ("Object_4.001") whose tire mesh has no wheel-ish
  // name at all. Renaming qualifying groups lets flatten's semanticName carry
  // wheel identity down to EVERY child (tire, caps, badges) so the whole
  // assembly spins with the rim.
  tagWheelAssemblies(scene);

  // ── normalize: longest horizontal axis = forward (+Z), ground y=0 ──
  let bbox = new THREE.Box3().setFromObject(wrapper);
  if (bbox.getSize(new THREE.Vector3()).x > bbox.getSize(new THREE.Vector3()).z) {
    wrapper.rotation.y = Math.PI / 2; // sideways model → rotate onto Z
    wrapper.updateMatrixWorld(true);
    bbox = new THREE.Box3().setFromObject(wrapper);
  }
  const size = bbox.getSize(new THREE.Vector3());
  const scale = TARGET_LENGTH / size.z;
  wrapper.scale.setScalar(scale);
  wrapper.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(wrapper);
  const center = bbox.getCenter(new THREE.Vector3());
  wrapper.position.x -= center.x;
  wrapper.position.z -= center.z;

  // forward direction: front wheels should sit at +Z
  const anchorProbe = findWheelAnchors(wrapper);
  if (anchorProbe.length > 0) {
    const namedFront = anchorProbe.find((a) => /ft|front|fr\b/i.test(a.node.name));
    const namedRear = anchorProbe.find((a) => /bk|rear|rr\b/i.test(a.node.name));
    if (namedFront && namedRear) {
      wrapper.updateMatrixWorld(true);
      const f = namedFront.node.getWorldPosition(new THREE.Vector3());
      const r = namedRear.node.getWorldPosition(new THREE.Vector3());
      if (f.z < r.z) {
        wrapper.rotation.y += Math.PI;
        wrapper.updateMatrixWorld(true);
      }
    }
  }

  // forward fallback for models whose semantics live in MATERIAL names
  // (generic "Object_42" nodes): head/fog lights at one end, tail/brake at
  // the other — orient so the lit end faces +Z
  if (!anchorProbe.some((a) => /ft|front|fr\b|bk|rear|rr\b/i.test(a.node.name))) {
    const headZ = lightCentreZ(wrapper, /head.?light|fog.?light|front.?light|low.?beam|high.?beam/i);
    const tailZ = lightCentreZ(wrapper, /tail|brake.?light|reverse.?light|rear.?light|plate|license/i);
    if (headZ !== null && tailZ !== null && headZ < tailZ) {
      wrapper.rotation.y += Math.PI;
      wrapper.updateMatrixWorld(true);
    }
  }

  wrapper.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(wrapper);
  wrapper.position.y -= bbox.min.y; // ground contact
  wrapper.updateMatrixWorld(true);
  bbox = new THREE.Box3().setFromObject(wrapper);
  const sz = bbox.getSize(new THREE.Vector3());
  const ctr = bbox.getCenter(new THREE.Vector3());
  const dims: CarDims = {
    length: sz.z,
    width: sz.x,
    height: sz.y,
    frontZ: bbox.max.z - 0.06,
    rearZ: bbox.min.z + 0.06,
    topY: bbox.max.y,
  };

  // ── flatten: bake the normalization transform into the geometry itself ──
  // Afterwards the wrapper is the identity frame: world == local for every
  // mesh, so corner boxes, pivot positions and spin axes all live in ONE
  // consistent space (fixes wheels orbiting a displaced pivot when the model
  // was scaled/rotated/flipped during normalization).
  flattenTransforms(wrapper, id);

  // ── sweep showcase junk: animation-pose ghost meshes parked far outside
  // the car volume (they would drag wheel pivots sky-high and cast stray
  // shadows). Runs BEFORE rigging so ghosts never enter the corner math.
  sweepJunk(wrapper, dims);

  // ── rig wheels ──
  const { wheelRadius } = rigWheels(wrapper);

  // paint material names
  const paintNames = new Set<string>();
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mn = m?.name ?? "";
      // "…_by_Author": Sketchfab materialmerger names the primary body
      // material after the model — treat it as paint so garage colours work.
      // "painted2"/"pickup": CSR2 game rips name the tintable body paint
      // "<car>_painted<N>" / "pickup" (a leftover name, never "pickup_glass")
      // GLASS_MAT first: window materials are NEVER paint — a glass named
      // "something_paint" or "…_by_Author" must stay black through every
      // garage recolor (user rule: glasses never fit the selected color)
      if (
        m &&
        !GLASS_MAT.test(mn) &&
        (/carpaint/i.test(mn) ||
          /(^|_)details$|(^|_)paint$/i.test(mn) ||
          /by[_\s]/i.test(mn) ||
          /painted/i.test(mn) ||
          /(^|_)pickup$/i.test(mn))
      ) {
        paintNames.add(m.name);
      }
    }
  });

  // ── dark-lamp split & glow ──
  // Sketchfab OBJ exports merge ALL lamp geometry per material into one
  // mesh with emissive baked to 0 ("TTRS_luz" = head + tail lenses in a
  // single buffer), and game rips like the GT-R hide head/tail materials
  // as two primitives of a 25-material merged "body" mesh — both leave the
  // car with dead-dark lamps at night. Every dark lamp-family mesh (and
  // every dark lamp primitive inside merged bodies) is lit here; the lit
  // materials are reported so Car.ts drives them per time-of-day/brakes.
  const lampMats: LampMat[] = [];
  splitDarkLamps(wrapper, lampMats, id);

  // shadows for the whole car
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
    }
  });

  // ── lamp covers vs windows (user report 2026-10-30: SRT10 + Audi heads
  // pure black in garage AND game) — glassy geometry that sits over lit
  // lamps becomes a clear smoked lens here; WITHOUT this the glass policy
  // below blacked those covers out and buried the glowing lenses behind an
  // opaque #020204 pane. Windows keep the policy; covers opt out below.
  splitGlassLampCovers(wrapper, litLensZones(wrapper, lampMats), paintNames, dims);

  // ── glass policy (AFTER shadows — see-through windows opt back out) ──
  finalizeGlass(wrapper, dims, paintNames, id);

  // dev probe (same convention as finalizeGlass's __carGlassReports):
  // per-model lamp material state as the LIVE browser sees it — emissive
  // color/intensity, whether the emissiveMap is the atlas or the procedural
  // canvas blob, and how many meshes wear each lit clone.
  if (typeof window !== "undefined") {
    const w = window as unknown as { __carLampReports?: Record<string, unknown> };
    const wearers = new Map<THREE.Material, number>();
    wrapper.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        if (m) wearers.set(m, (wearers.get(m) ?? 0) + 1);
    });
    (w.__carLampReports ??= {})[id] = lampMats.map(({ mat, front }) => ({
      name: mat.name,
      front,
      emissive: `#${mat.emissive.getHexString()}`,
      intensity: mat.emissiveIntensity,
      map: mat.emissiveMap
        ? mat.emissiveMap instanceof THREE.CanvasTexture
          ? "canvas-blob"
          : mat.emissiveMap.name || "texture"
        : null,
      baseColor: `#${mat.color.getHexString()}`,
      diffuseMap: mat.map ? mat.map.name || "texture" : null,
      wearers: wearers.get(mat) ?? 0,
    }));
  }

  return { url: id, wrapper, dims, wheelRadius, paintNames, lampMats };
}

// ─── wheel rigging ──────────────────────────────────────────────────────────
interface WheelAnchor {
  node: THREE.Object3D;
  meshes: THREE.Mesh[];
}

/** wheel-ish names in MATERIALS — Sketchfab OBJ→glTF exports carry all
 *  semantics in material names (tireL, rim1, brakedisk…) while nodes are
 *  generic "Object_42" */
const WHEEL_MAT = /wheel|tire|tyre|(^|[_\s\d])rim|rim($|[_\s\d.])|brake/i;
/** wheel-ish material names that are NOT wheels (lights, signals, interior) */
const MAT_EXCLUDE = /light|lamp|glow|steer|turn|pedal/i;

/** every semantic label of a mesh: node name + its material names */
function meshLabels(m: THREE.Mesh): string {
  const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
  return `${m.name ?? ""} ${mats.map((x) => (x as THREE.Material)?.name ?? "").join(" ")}`;
}

function findWheelAnchors(root: THREE.Object3D): WheelAnchor[] {
  const anchors: WheelAnchor[] = [];
  const anchored = new Set<THREE.Object3D>();
  // 1) wheel-NAMED nodes (the classic rig: "Wheel.Ft.L", "wheel_FL"…)
  root.traverse((o) => {
    const name = o.name ?? "";
    // "steer" keeps the steering WHEEL (interior) out of the wheel rig
    if (!(/wheel/i.test(name) && !/brake|steer/i.test(name))) return;
    const meshes: THREE.Mesh[] = [];
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && c !== o) meshes.push(c as THREE.Mesh);
    });
    if (meshes.length) {
      anchors.push({ node: o, meshes });
      for (const m of meshes) anchored.add(m);
    }
  });
  // 2) wheel-named MATERIALS on generically-named meshes
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || anchored.has(m)) return;
    const labels = meshLabels(m);
    if (!WHEEL_MAT.test(labels) || MAT_EXCLUDE.test(labels)) return;
    anchors.push({ node: m, meshes: [m] });
    anchored.add(m);
  });
  return anchors;
}

/**
 * Rig wheels in the identity frame established by flattenTransforms():
 * every mesh is a flat wrapper child with an identity transform and geometry
 * already in final car space, so world boxes == local boxes and pivots land
 * exactly on the wheel centres they spin around.
 */
function rigWheels(wrapper: THREE.Group): { wheelRadius: number } {
  const anchors = findWheelAnchors(wrapper);
  wrapper.updateMatrixWorld(true);

  interface WheelPiece {
    mesh: THREE.Mesh;
    isBrake: boolean;
  }
  const pieces: WheelPiece[] = [];

  // shared piece pipeline: split merged L+R pairs and merged F+R axles so
  // every piece lands in exactly one corner (a whole-car "brakedisk" mesh
  // would otherwise drag one corner's pivot across the car)
  const addPiece = (mesh: THREE.Mesh, forceBrake = false) => {
    let parts: THREE.Mesh[] = [mesh];
    const wb = new THREE.Box3().setFromObject(mesh);
    if (wb.max.x - wb.min.x > PAIR_WIDTH) {
      // merged L+R axle pair → split at the car centre line
      const halves = splitMeshByPlane(mesh, "x", 0);
      wrapper.remove(mesh);
      mesh.geometry.dispose();
      parts = halves;
    }
    for (const part of parts) {
      const b = new THREE.Box3().setFromObject(part);
      if (b.max.z - b.min.z > MERGED_AXLE_LENGTH) {
        // merged front+rear wheels (one mesh per side) → split at the
        // axle gap, which straddles the car centre
        const ends = splitMeshByPlane(part, "z", 0);
        part.parent?.remove(part);
        part.geometry.dispose();
        for (const e of ends) pieces.push({ mesh: e, isBrake: forceBrake || /brake/i.test(meshLabels(e)) });
      } else {
        pieces.push({ mesh: part, isBrake: forceBrake || /brake/i.test(meshLabels(part)) });
      }
    }
  };

  for (const a of anchors) {
    for (const m of a.meshes) addPiece(m);
  }

  // brake discs / centre caps / calipers: named parts that ride with a wheel
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (/pedal/i.test(meshLabels(m))) return; // gas/clutch/brake pedals are interior, not wheel hardware
    if (/brake|disc|cap|caliper/i.test(meshLabels(m))) {
      if (!pieces.some((p) => p.mesh === m)) addPiece(m, true);
    }
  });

  if (pieces.length === 0) return { wheelRadius: 0.38 };

  // ── group pieces into 4 corners ──
  interface Corner {
    key: string;
    meshes: THREE.Mesh[];
    bbox: THREE.Box3;
    drive: boolean;
  }
  const corners: Corner[] = [];

  const cornerFor = (mesh: THREE.Mesh, isBrake: boolean): Corner => {
    const b = new THREE.Box3().setFromObject(mesh);
    const c = b.getCenter(new THREE.Vector3());
    const front = c.z > 0;
    const side = c.x >= 0 ? "L" : "R";
    const key = `${front ? "F" : "R"}${side}`;
    let corner = corners.find((k) => k.key === key);
    if (!corner) {
      corner = { key, meshes: [], bbox: new THREE.Box3(), drive: !isBrake };
      corners.push(corner);
    }
    corner.meshes.push(mesh);
    return corner;
  };

  for (const p of pieces) {
    const c = cornerFor(p.mesh, p.isBrake);
    c.bbox.expandByObject(p.mesh);
    if (!p.isBrake) c.drive = true;
  }

  // ── prune non-wheel junk that rode in with the anchors ──
  // Showcase rigs parent badges/logos under wheel nodes; their tiny boxes
  // drag the corner bbox (and with it the spin pivot) off the wheel hub.
  // Keep pieces that are comparably sized to the corner's largest piece or
  // sit on the hub; reject the rest back to the static body.
  for (const corner of corners) {
    if (corner.meshes.length < 2) continue;
    const boxes = new Map<THREE.Mesh, THREE.Box3>();
    let largest: THREE.Mesh | null = null;
    let largestDim = 0;
    for (const m of corner.meshes) {
      const b = new THREE.Box3().setFromObject(m);
      boxes.set(m, b);
      const d = b.getSize(new THREE.Vector3()).length();
      if (d > largestDim) {
        largestDim = d;
        largest = m;
      }
    }
    if (!largest) continue;
    const hub = boxes.get(largest)!.getCenter(new THREE.Vector3());
    const kept = corner.meshes.filter((m) => {
      if (m === largest) return true;
      const b = boxes.get(m)!;
      const dim = b.getSize(new THREE.Vector3()).length();
      const centre = b.getCenter(new THREE.Vector3());
      return dim >= 0.25 * largestDim || centre.distanceTo(hub) < 0.18;
    });
    if (kept.length === corner.meshes.length) continue;
    const bbox = new THREE.Box3();
    for (const m of kept) bbox.union(boxes.get(m)!);
    corner.meshes = kept;
    corner.bbox = bbox;
  }

  // small unnamed pieces hugging a wheel centre (e.g. GT-R centre caps)
  // join that wheel so they spin with it — never whole body panels
  const pieceSet = new Set(pieces.map((p) => p.mesh));
  for (const child of [...wrapper.children]) {
    const m = child as THREE.Mesh;
    if (!m.isMesh || pieceSet.has(m)) continue;
    const name = meshLabels(m).toLowerCase();
    if (name.includes("wheel") || name.includes("brake") || name.includes("light")) continue;
    if (new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).length() > 1.1) continue;
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    for (const corner of corners) {
      if (!corner.drive) continue;
      const centre = corner.bbox.getCenter(new THREE.Vector3());
      if (c.distanceTo(centre) < ATTACH_RADIUS) {
        corner.meshes.push(m);
        corner.bbox.expandByObject(m);
        pieceSet.add(m);
        break;
      }
    }
  }

  // ── build a pivot per corner ──
  let wheelRadius = 0.38;
  for (const corner of corners) {
    if (!corner.drive) continue;
    const centre = corner.bbox.getCenter(new THREE.Vector3());
    const sz = corner.bbox.getSize(new THREE.Vector3());
    wheelRadius = Math.max(wheelRadius, sz.y / 2);

    // axle = thinnest horizontal axis
    const axis: "x" | "z" = sz.x <= sz.z ? "x" : "z";
    const pivot = new THREE.Group();
    pivot.name = `wheelPivot_${corner.key}`;
    pivot.rotation.order = axis === "x" ? "YXZ" : "YZX";
    pivot.userData.spinAxis = axis;
    pivot.position.copy(centre);
    wrapper.add(pivot);
    // attach() preserves world transforms — with the wrapper at identity the
    // mesh lands exactly at pivot-local (−centre), spinning on its own hub
    for (const mesh of corner.meshes) pivot.attach(mesh);
  }

  return { wheelRadius };
}

/** name patterns that mark a node as wheel hardware (mesh or ancestor) */
const WHEELISH = /wheel|brake|disc|caliper|tire|tyre|rim/i;

/**
 * Replace an attribute with a plain non-interleaved Float32 copy.
 * getComponent() returns denormalized values, so quantized (normalized
 * integer) and interleaved attributes become safe for applyMatrix4().
 */
function dequantizeAttribute(geo: THREE.BufferGeometry, name: string): void {
  const attr = geo.getAttribute(name) as
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined;
  if (!attr) return;
  const plain = attr as unknown as {
    isInterleavedBufferAttribute?: boolean;
    normalized?: boolean;
    array: { constructor: Float32ArrayConstructor | Int16ArrayConstructor } & ArrayLike<number>;
  };
  if (
    !plain.isInterleavedBufferAttribute &&
    !plain.normalized &&
    plain.array instanceof Float32Array
  ) {
    return; // already a plain float attribute
  }
  const itemSize = attr.itemSize;
  const out = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i++) {
    for (let c = 0; c < itemSize; c++) {
      out[i * itemSize + c] = attr.getComponent(i, c);
    }
  }
  geo.setAttribute(name, new THREE.BufferAttribute(out, itemSize));
}

/** flat mesh name: own name if wheel-ish, else nearest wheel-ish ancestor + own */
function semanticName(mesh: THREE.Mesh, root: THREE.Object3D): string {
  const own = mesh.name ?? "";
  if (WHEELISH.test(own)) return own;
  let p: THREE.Object3D | null = mesh.parent;
  while (p && p !== root) {
    const n = p.name ?? "";
    if (WHEELISH.test(n)) return own ? `${n}_${own}` : n;
    p = p.parent;
  }
  return own;
}

/**
 * Bake the wrapper's normalization transform (scale/rotation/ground offset)
 * into every geometry and reparent all meshes flat under the wrapper, which
 * is then reset to the identity transform. Kills frame mismatches between
 * baked geometry, pivot positions and spin axes — no matter how the source
 * model was oriented, scaled or flipped.
 */
function flattenTransforms(wrapper: THREE.Group, id = ""): void {
  wrapper.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.parent !== wrapper) meshes.push(m);
  });
  if (meshes.length === 0) return;

  const copies: THREE.Mesh[] = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
      console.warn(`[CarModelLoader] skinned mesh "${mesh.name}" frozen to static pose`);
    }
    const geo = mesh.geometry.clone();
    // GLTF quantized models keep positions as NORMALIZED int16/int8 —
    // applyMatrix4() would truncate transformed floats back into the integer
    // array (geometry garbage). Convert to plain Float32 first.
    dequantizeAttribute(geo, "position");
    dequantizeAttribute(geo, "normal");
    dequantizeAttribute(geo, "tangent");
    geo.applyMatrix4(mesh.matrixWorld);
    const copy = new THREE.Mesh(geo, mesh.material);
    // keep wheel identity alive through flattening: meshes with generic
    // names (e.g. "Nismo-027001") inherit the nearest wheel-ish ancestor
    // name ("Wheel.Ft.L_...") so rigWheels can still find them
    copy.name = semanticName(mesh, wrapper);
    copies.push(copy);
  }

  // drop the original hierarchy and make the wrapper the identity frame
  for (const child of [...wrapper.children]) wrapper.remove(child);
  wrapper.position.set(0, 0, 0);
  wrapper.rotation.set(0, 0, 0);
  wrapper.scale.setScalar(1);
  wrapper.updateMatrixWorld(true);
  for (const copy of copies) wrapper.add(copy);

  // free the pre-bake geometries — the flat copies own their baked clones
  const disposed = new Set<THREE.BufferGeometry>();
  for (const mesh of meshes) {
    if (mesh.geometry && !disposed.has(mesh.geometry)) {
      disposed.add(mesh.geometry);
      mesh.geometry.dispose();
    }
  }
}

/**
 * Remove meshes whose centre sits far outside the car volume — showcase
 * leftovers such as animation-pose ghost wheels hovering 28 m above the car.
 * They would otherwise drag wheel pivots sky-high, sweep through the road
 * while spinning and cast stray shadows.
 */
function sweepJunk(wrapper: THREE.Group, dims: CarDims): void {
  const halfW = dims.width / 2 + 0.6;
  const halfL = Math.max(dims.length, 1) / 2 + 0.6;
  const maxY = dims.topY + 0.8;
  for (const child of [...wrapper.children]) {
    const m = child as THREE.Mesh;
    if (!m.isMesh) continue;
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    if (c.y > maxY || c.y < -0.6 || Math.abs(c.x) > halfW || Math.abs(c.z) > halfL) {
      wrapper.remove(m);
      m.geometry.dispose();
      continue;
    }
    // flat ground-shadow quads (Sketchfab "carshadow") sit exactly on the
    // road plane and z-fight with it at speed
    if (/shadow/i.test(meshLabels(m)) && new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y < 0.08) {
      wrapper.remove(m);
      m.geometry.dispose();
    }
  }
}

/**
 * Game rips (CSR2/Forza) ship each wheel as a multi-mesh assembly under a
 * generically named group ("Object_4.001"): rim + brake + caliper carry
 * wheel-ish names, but the tire ("Scene_-_Root") and caps/badges do not —
 * without help they stay welded to the body while the rim spins inside them.
 * A group whose DIRECT mesh children include >= 2 wheel-ish parts AND whose
 * children span only a wheel-sized cluster (vs the whole scene — v1's OBJ
 * container holds 58 meshes across the entire car) is a wheel assembly:
 * renaming it lets semanticName()/WHEEL_MAT see every child as wheel
 * hardware so the whole assembly is rigged to the corner pivot.
 */
function tagWheelAssemblies(root: THREE.Object3D): void {
  const WHEELISH_GROUP = /wheel|tire|tyre|rim|brake|caliper|disc/i;
  root.updateMatrixWorld(true);
  const sceneDiag = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).length();
  if (!(sceneDiag > 0)) return;
  root.traverse((o) => {
    const g = o as THREE.Group;
    if (!g.children || g.children.length < 2) return;
    if (WHEELISH_GROUP.test(g.name ?? "")) return;
    let wheelish = 0;
    let meshes = 0;
    const box = new THREE.Box3();
    for (const c of g.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh) continue;
      meshes++;
      box.expandByObject(m);
      const label = meshLabels(m);
      if (WHEELISH_GROUP.test(label) && !MAT_EXCLUDE.test(label)) wheelish++;
    }
    if (meshes < 2 || wheelish < 2) return;
    // containers (RootNode / OBJ merge roots) span the whole car — never tag
    const span = box.getSize(new THREE.Vector3()).length();
    if (span > 0.25 * sceneDiag) return;
    g.name = `wheelAssy_${g.name ?? "group"}`;
  });
}

/**
 * Strip the showcase environment that Sketchfab studio exports bake into
 * the file: a giant floor/ceiling/curtain box around the car plus far-away
 * props (banners, stands). They poison the bounding box used for
 * normalization (toy-car scale, wrong forward axis), so this runs BEFORE
 * any bbox math. Scale-invariant: thresholds are relative to mesh statistics.
 */
function pruneShowroom(root: THREE.Object3D): void {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) meshes.push(m);
  });
  if (meshes.length < 4) return;

  const boxes = new Map<THREE.Mesh, THREE.Box3>();
  const diags: number[] = [];
  for (const m of meshes) {
    const b = new THREE.Box3().setFromObject(m);
    if (b.isEmpty()) continue;
    boxes.set(m, b);
    diags.push(b.getSize(new THREE.Vector3()).length());
  }
  if (diags.length < 4) return;
  diags.sort((a, b) => a - b);
  const p90 = diags[Math.floor(diags.length * 0.9)];

  // pass 1 — giants: a showroom floor/ceiling/curtain dwarfs EVERY car part.
  // Detailed game rips have huge body shells that can trip a naive size
  // filter, so giants are only pruned when they truly dwarf the largest
  // surviving car part (ratio < 0.4). Otherwise the "giants" ARE the car.
  let alive = [...boxes.entries()].filter(
    ([, b]) => b.getSize(new THREE.Vector3()).length() <= p90 * 2,
  );
  if (alive.length === 0) return;
  if (alive.length < boxes.size) {
    const giantDiags = [...boxes.entries()]
      .filter(([m]) => !alive.some(([am]) => am === m))
      .map(([, b]) => b.getSize(new THREE.Vector3()).length());
    const biggestCar = Math.max(
      ...alive.map(([, b]) => b.getSize(new THREE.Vector3()).length()),
    );
    const smallestGiant = Math.min(...giantDiags);
    if (biggestCar >= 0.4 * smallestGiant) {
      alive = [...boxes.entries()]; // no real showroom here — keep everything
    }
  }

  // pass 2 — far props: outside the dense car cluster around the centroid
  if (alive.length > 3) {
    const centroid = new THREE.Vector3();
    for (const [, b] of alive) centroid.add(b.getCenter(new THREE.Vector3()));
    centroid.multiplyScalar(1 / alive.length);
    // Dense Sketchfab interiors (the Renault 5 ships ~190 meshes, most of them
    // dashboard knobs smaller than a finger) drag the p90 radius down to
    // bumper depth — pass 2 then amputates real bumpers, plates and lamp bars
    // as "far props". Nothing within 60% of the LARGEST surviving mesh's
    // diameter (the body shell — the car itself is at least that big) can be
    // a far prop; genuine showcase junk sits many shell-diameters out.
    const maxDiag = Math.max(...alive.map(([, b]) => b.getSize(new THREE.Vector3()).length()));
    const nearRadius = Math.max(p90 * 0.9, 0.5, maxDiag * 0.6);
    const near = alive.filter(
      ([, b]) => b.getCenter(new THREE.Vector3()).distanceTo(centroid) < nearRadius,
    );
    if (near.length >= 3 && near.length < alive.length) alive = near;
  }

  const survivors = new Set(alive.map(([m]) => m));
  for (const m of meshes) {
    if (!boxes.has(m) || survivors.has(m)) continue;
    m.parent?.remove(m);
    m.geometry.dispose();
  }
}

/** average world Z of meshes whose node/material names match `re` */
function lightCentreZ(root: THREE.Object3D, re: RegExp): number | null {
  let acc = 0;
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !re.test(meshLabels(m))) return;
    acc += new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3()).z;
    n++;
  });
  return n > 0 ? acc / n : null;
}

/** split a baked (identity-transform) mesh by a local x/z plane into halves */
function splitMeshByPlane(mesh: THREE.Mesh, axis: "x" | "z", splitAt: number): THREE.Mesh[] {
  const geo = mesh.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const idx = geo.index;
  const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
  const coord = axis === "x" ? (i: number) => pos.getX(i) : (i: number) => pos.getZ(i);

  const leftTris: number[] = [];
  const rightTris: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const centre = (coord(a) + coord(b) + coord(c)) / 3;
    (centre < splitAt ? leftTris : rightTris).push(a, b, c);
  }

  const out: THREE.Mesh[] = [];
  for (const tris of [leftTris, rightTris]) {
    if (tris.length === 0) continue;
    const g = extractTriangles(geo, tris);
    const m = new THREE.Mesh(g, mesh.material);
    m.name = `${mesh.name}_${axis}half`;
    m.castShadow = true;
    mesh.parent?.add(m);
    out.push(m);
  }
  return out;
}

// ─── dark-lamp split & glow ─────────────────────────────────────────────────
/** resting glow baked into lit lamp materials — Car.ts re-applies these per
 * time-of-day (night on / day off) and flares the tails on braking, so the
 * numbers live here, exported, beside the lens colors they belong with */
export const LAMP_HEAD_INTENSITY = 2.6;
export const LAMP_TAIL_INTENSITY = 4.0;

/** lamp-family material names (multilingual: Sketchfab models carry Spanish
 * "luz", German "lampe"/"Leuchte", French "phare"/"feux"). Tokens are
 * letter-boundary-guarded: "dMAT_Details" contains "tail" but mid-word, so
 * body-detail materials must NOT match (the first draft lit up a whole
 * Viper), while "TTRS_luz"/"luz2"/"dMAT_Lights_315" do ("_" and digits count
 * as separators — JS \b would treat "_" as a word char and miss them). */
const LAMP_MAT =
  /(?<![A-Za-z])(head.?lights?|tail.?lights?|tail.?lamps?|brake.?lights?|lights?|lamps?|luz(?:es)?|lamp(?:es|en)?|faroles?|leuchten?|phares?|feux|glows?|emiss\w*)(?![A-Za-z])/i;
/** lamp-looking names that are NOT lamps ("glass_light" on the ACR is the
 * windshield) — a false positive here would light up windows */
const NOT_LAMP_MAT = /glass|vidrio|windshield|window/i;
/** warm halogen white for headlight lenses */
const HEAD_EMISSIVE = new THREE.Color(1, 0.93, 0.72);
/** stop-lamp red for tail lenses */
const TAIL_EMISSIVE = new THREE.Color(1, 0.03, 0.015);

/** geometry draw-range group — mirrors three's BufferGeometry.Group but with
 * a non-optional materialIndex (three types it optional, which cannot be
 * used as a material-array index) */
interface GeoGroup {
  start: number;
  count: number;
  materialIndex: number;
}

/** true when `m` is a lamp-family lens material. Both dark lenses and
 * baked-bright rips qualify — the fleet must end up UNIFORM: GT-R ships
 * headlight=white@2 / taillight=red@3, the Vipers gray bakes, Sketchfab
 * OBJ exports emissive=0; all of them get taken over. Glass impostors are
 * excluded by NAME (windows must not glow) — with one exception: lens STRIPS
 * wearing glassy names (ACR "glass_light") are lamp geometry and do qualify
 * (isGlassLensStrip). */
function isLampMat(m: THREE.Material | null | undefined): boolean {
  // lit clones this module created are authoritative members even when their
  // inherited name is glassy (ACR "glass_light_head"): finalizeGlass must
  // never tint a lens the split just lit
  if (litLampClones.has(m as THREE.Material)) return true;
  const sm = m as THREE.MeshStandardMaterial | null;
  if (!sm || !sm.emissive) return false;
  const name = sm.name ?? "";
  return !NOT_LAMP_MAT.test(name) && LAMP_MAT.test(name);
}

/** every lit lamp clone this module created — membership = lamp, regardless
 * of inherited name tokens (see isLampMat) */
const litLampClones = new WeakSet<THREE.Material>();

/** clone `base` into a lit lens material: warm-white front / stop-red rear */
function makeLitLampMat(base: THREE.MeshStandardMaterial, front: boolean): THREE.MeshStandardMaterial {
  const lit = base.clone();
  lit.name = `${base.name}_${front ? "head" : "rear"}`;
  lit.emissive.copy(front ? HEAD_EMISSIVE : TAIL_EMISSIVE);
  // TEXTURE-DRIVEN glow, never a flat wash: modulate the emissive by a lamp
  // texture so only the real lens/reflector texels light up (live VLM read
  // 2026-10-26: a map-less emissive renders as "bright white stickers",
  // fogs glowing like the heads — the exact look the user rejected).
  //  - rear: trust the artist's bake when one exists (the Vipers' bakes
  //    carry proper tail-lens glow); mapless cars follow their baseColor
  //    atlas — the Audi's "TTRS_luz" lays red tail strips / chrome head
  //    projectors out as UV islands, so the glow follows the lens shapes.
  //  - front: the Vipers' bakes are TAIL-ONLY — black texels at the head
  //    lamp UVs multiplied the warm-white emissive to nothing, so fronts
  //    follow the baseColor map instead (the ACR even ships
  //    emissiveMap === map, proving the pattern).
  // Mapless lenses (GT-R's textureless lamp mats) stay flat — nothing to
  // modulate with. Dark-atlas cars (DARK_ATLAS_HEADS) get a procedural lens
  // blob instead — their atlas texels multiply the glow to nothing.
  lit.emissiveMap = (front ? base.map ?? base.emissiveMap : base.emissiveMap ?? base.map) ?? null;
  lit.needsUpdate = true; // map presence changed vs the compiled shader — recompile
  // these lenses are the car's ONLY lamp visuals at night — the old floating
  // glow-quads/lamp-box impostors are gone, so the real geometry must carry
  // the glow alone
  lit.emissiveIntensity = front ? LAMP_HEAD_INTENSITY : LAMP_TAIL_INTENSITY;
  litLampClones.add(lit);
  return lit;
}

/** glass-IMPOSTOR exception: a lens STRIP wearing a glassy name is lamp
 * GEOMETRY, not a window. The ACR (viper16) ships one "glass_light" material
 * on BOTH its front headlight band (z +1.80) and its rear tail band
 * (z −2.00) — wide, flat, shallow strips. The old note called it "the
 * windshield"; the windshield is the separate "glass" material, and the
 * glass policy was tinting this lens to #05070a → black headlights.
 * A windshield (≈1.6×0.9×1.2) or side window can never pass the strip test. */
const GLASS_LENS_STRIP_MAT = /glass_light/i;
function isGlassLensStrip(mat: THREE.Material, mesh: THREE.Mesh): boolean {
  const sm = mat as THREE.MeshStandardMaterial;
  if (!GLASS_LENS_STRIP_MAT.test(sm.name ?? "")) return false;
  const bb = new THREE.Box3().setFromObject(mesh);
  const s = bb.getSize(new THREE.Vector3());
  return s.x > 0.4 && s.y < 0.3 && s.z < 0.7; // wide, flat, shallow — lens band
}

/** cars whose baseColor atlases are DARK at the headlamp UVs (probed
 * 2026-10-30 + VLM garage read: matte black, zero glow, while the GT-R's
 * bright lens texels glow fine). The texture-driven-glow doctrine multiplies
 * warm-white by those black texels → nothing; heads on these cars get a
 * procedural soft lens blob laid over their piece UVs instead. Tails are
 * untouched — the artists' red bakes do their job everywhere. */
const DARK_ATLAS_HEADS = new Set(["viper08", "viper16", "audi"]);

/** UV bounds of everything a lit clone serves — the procedural lens blob is
 * painted across exactly that region so the glow tracks the lens geometry. */
interface UVBox {
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
}

function unionUVBox(
  map: Map<THREE.Material, UVBox>,
  m: THREE.Material,
  geo: THREE.BufferGeometry,
): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return;
  let b = map.get(m);
  if (!b) {
    b = { minU: Infinity, minV: Infinity, maxU: -Infinity, maxV: -Infinity };
    map.set(m, b);
  }
  for (let i = 0; i < uv.count; i++) {
    const x = uv.getX(i);
    const y = uv.getY(i);
    if (x < b.minU) b.minU = x;
    if (x > b.maxU) b.maxU = x;
    if (y < b.minV) b.minV = y;
    if (y > b.maxV) b.maxV = y;
  }
}

/** paint a soft grayscale lens blob across the material's UV box and make it
 * the lit clone's emissiveMap — grayscale because emissive (warm white) is
 * the colour source of truth; the canvas only shapes the glow. Procedural
 * per the standing effects rule. flipY=false matches the glTF UV convention
 * of the model's own maps (both maps share one UV attribute). */
function applyProceduralLensGlow(lit: THREE.MeshStandardMaterial, b: UVBox): void {
  if (typeof document === "undefined") return; // bun probes: no DOM, skip
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  const cx = ((b.minU + b.maxU) / 2) * S;
  const cy = ((b.minV + b.maxV) / 2) * S;
  const rx = Math.max((b.maxU - b.minU) / 2, 0.04) * S;
  const ry = Math.max((b.maxV - b.minV) / 2, 0.04) * S;
  const rmax = Math.max(rx, ry);
  g.save();
  g.translate(cx, cy);
  g.scale(rx / rmax, ry / rmax);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rmax);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.72)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(-rmax, -rmax, rmax * 2, rmax * 2);
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  lit.emissiveMap = tex;
  lit.needsUpdate = true; // map presence changed vs the compiled shader
}

// ─── lamp covers vs windows: the glass pass must not bury lit lamps ─────────
/** clear-lens cover clones this module created — see splitGlassLampCovers.
 * finalizeGlass skips them (they'd otherwise be re-blacked as glassy-named
 * transparent materials — the very bug that hid the SRT10's and the Audi's
 * lit headlamps behind an opaque #020204 pane). */
const lensCoverClones = new WeakSet<THREE.Material>();

/** world-space boxes around every lit lamp clone's geometry (+6cm margin) —
 * the volume a lamp-cover pane can occupy. Computed from the meshes that
 * actually wear the lit clone, so wraparound lenses (the Audi's lamps span
 * back along the fender) get a correctly shaped zone. */
function litLensZones(wrapper: THREE.Group, lampMats: LampMat[]): THREE.Box3[] {
  wrapper.updateMatrixWorld(true);
  const zones: THREE.Box3[] = [];
  for (const { mat } of lampMats) {
    const box = new THREE.Box3();
    let any = false;
    wrapper.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!mats.includes(mat)) return;
      box.expandByObject(mesh);
      any = true;
    });
    if (any && !box.isEmpty()) zones.push(box.expandByScalar(0.06));
  }
  return zones;
}

/** A glassy pane over a lit lamp is a LENS COVER, not a window — blacking it
 * out (the no-interior blackout) or even tinting it hides the lamp the split
 * just lit: the SRT10's whole front kit cover and the Audi's "glass" mesh
 * (headlamp covers MERGED with cabin glass, 34% of its verts inside the lamp
 * zones) buried their glowing lenses → "pure black headlights" (user report
 * 2026-10-30). This pass runs between the lamp split and finalizeGlass:
 *  - meshes whose UNIQUE verts lie ≥25% inside lamp zones (unique = counted
 *    once even when zone boxes overlap) get their in-zone triangles pulled
 *    out (extractTriangles) into a sibling mesh wearing a CLEAR LENS clone
 *    (smoked, see-through); the remainder stays a window and keeps the glass
 *    policy. Whole-mesh covers simply swap materials.
 *  - the 25% floor keeps grazing window corners out: the Audi's "vidrios"
 *    (~12% — windshield edge touching the TT's wraparound lamp zone) and the
 *    ACR's "grulle" (~20%) stay untouched windows, while the Audi's "glass"
 *    (34% — covers MERGED with cabin glass) splits.
 *  - materials whose meshes ALL live at the extreme ends mirror
 *    finalizeGlass's lamp-cover exception — they keep their SOURCE state
 *    there (the SRT10's see-through RED tail lens "red_glass") and are not
 *    lens-ified here either. */
function splitGlassLampCovers(
  wrapper: THREE.Group,
  zones: THREE.Box3[],
  paintNames: Set<string>,
  dims: CarDims,
): void {
  if (!zones.length) return;
  const halfL = Math.max(dims.length, 1) / 2;
  // materials finalizeGlass will actually CLAIM (mirror its central-boxes
  // test) — only their covers need rescuing; unclaimed extreme-ends glass
  // keeps its artist state and is left alone
  const claimed = new Set<THREE.MeshStandardMaterial>();
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const sm = mesh.material as THREE.MeshStandardMaterial | null;
    if (!sm || Array.isArray(mesh.material)) return;
    if (isLampMat(sm) || lensCoverClones.has(sm) || paintNames.has(sm.name ?? "")) return;
    if (!GLASS_MAT.test(sm.name ?? "") && !sm.transparent) return;
    const b = new THREE.Box3().setFromObject(mesh);
    if (Math.abs((b.min.z + b.max.z) / 2) <= 0.8 * halfL) claimed.add(sm);
  });
  if (!claimed.size) return;

  const v = new THREE.Vector3();
  const victims: THREE.Mesh[] = [];
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const sm = mesh.material as THREE.MeshStandardMaterial | null;
    if (!sm || Array.isArray(mesh.material)) return;
    if (isLampMat(sm) || lensCoverClones.has(sm) || paintNames.has(sm.name ?? "")) return;
    if (!claimed.has(sm)) return;
    // glow-carrying panes (the GT-R's "PlasticGlassWhite" ships white@2
    // emissive) are SELF-LIT lens surfaces: the blackout only kills their
    // diffuse channel, their bake keeps them glowing — that glow IS the
    // car's headlight. Lens-ifying them (0.28 opacity dims even a kept
    // emissive) would snuff it, so they stay with the plain glass policy.
    if (sm.emissiveIntensity > 0.05 && (sm.emissive.r > 0.02 || sm.emissive.g > 0.02 || sm.emissive.b > 0.02))
      return;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!pos) return;
    let inZone = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (zones.some((z) => z.containsPoint(v))) inZone++;
    }
    // 25% of the mesh's verts must sit inside lamp zones (unique count —
    // overlapping lamp-zone boxes must not inflate the fraction)
    if (inZone / pos.count >= 0.25) victims.push(mesh);
  });

  const coverClones = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>();
  const clearLens = (base: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => {
    let c = coverClones.get(base);
    if (c) return c;
    c = base.clone();
    c.name = `${base.name}_lenscover`;
    c.color.setHex(GLASS_COLOR); // smoked, near-black tint — the lamp glows through
    c.transparent = true;
    c.opacity = 0.28;
    c.metalness = 0.9;
    c.roughness = 0.05;
    c.envMapIntensity = Math.max(c.envMapIntensity ?? 1, 2.2);
    c.depthWrite = false; // the lit lens behind must not be z-fought away
    c.side = THREE.DoubleSide; // cover shells are often single-sided
    c.emissive.setRGB(0, 0, 0);
    c.emissiveMap = null;
    c.needsUpdate = true;
    lensCoverClones.add(c);
    coverClones.set(base, c);
    return c;
  };

  for (const mesh of victims) {
    const geo = mesh.geometry as THREE.BufferGeometry;
    const idx = geo.index;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const triCount = (idx?.count ?? pos.count) / 3;
    // FLAT vertex-index lists (extractTriangles wants slots, not tri numbers)
    const coverFlat: number[] = [];
    const keepFlat: number[] = [];
    for (let t = 0; t < triCount; t++) {
      let hit = false;
      for (let k = 0; k < 3 && !hit; k++) {
        const vi = idx ? idx.getX(t * 3 + k) : t * 3 + k;
        v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
        if (zones.some((z) => z.containsPoint(v))) hit = true;
      }
      const target = hit ? coverFlat : keepFlat;
      for (let k = 0; k < 3; k++) target.push(idx ? idx.getX(t * 3 + k) : t * 3 + k);
    }
    if (!coverFlat.length) continue; // ≥25% of verts in-zone makes this unreachable
    if (!keepFlat.length) {
      // whole mesh is a lamp cover — one material swap, geometry untouched
      mesh.material = clearLens(mesh.material as THREE.MeshStandardMaterial);
      mesh.castShadow = false;
      continue;
    }
    // mixed: pull the cover triangles into a sibling, keep the window part
    const cover = new THREE.Mesh(
      extractTriangles(geo, coverFlat),
      clearLens(mesh.material as THREE.MeshStandardMaterial),
    );
    cover.name = `${mesh.name || "glass"}_lenscover`;
    mesh.parent?.add(cover);
    cover.applyMatrix4(mesh.matrix); // inherit the source mesh's local transform
    cover.castShadow = false;
    mesh.geometry = extractTriangles(geo, keepFlat);
  }
}

/** Light EVERY lamp-family lens so the geometry itself becomes the lamp:
 * dark Sketchfab exports get their first glow, baked-bright rips get
 * normalized into the same look — nobody skips, nothing double-glows.
 * Two shapes exist in the wild —
 *  - single-material lamp meshes (Audi "TTRS_luz", the Vipers' light kits,
 *    the GT-R's primitive-split "headlight"/"taillight" meshes): spanning
 *    meshes are split at the z midline (front half = headlight white,
 *    rear half = tail red), single-ended meshes are lit whole;
 *  - lamp primitives merged INSIDE multi-material bodies (a 25-slot body
 *    mesh): each group is classified by its own triangle z-extent and its
 *    slot swapped for a lit clone; a group spanning BOTH ends is extracted
 *    into a standalone mesh, split at the midline, and surgically dropped
 *    from the parent mesh.
 * Glass impostors are never touched (except lens strips — isGlassLensStrip).
 * Lit materials are reported through
 * `out` (Car.ts drives them by time-of-day
 * and brake state). Coordinates are mesh-local — Sketchfab/OBJ-style exports
 * bake identity transforms, so local z ≈ the car's z midline. */
function splitDarkLamps(wrapper: THREE.Group, out: LampMat[], id: string): void {
  // pass 1 — scan only: the fixes below add/remove SIBLING nodes and
  // mutating a graph mid-traverse skips nodes, so collect victims first
  const singles: THREE.Mesh[] = [];
  const merged: THREE.Mesh[] = [];
  // UV bounds per lit clone — feeds the procedural lens blob on dark-atlas cars
  const uvBoxes = new Map<THREE.Material, UVBox>();
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      if (mesh.geometry.groups.length > 0 && mat.some((m) => isLampMat(m))) merged.push(mesh);
    } else if (mat && mesh.geometry.groups.length === 0 && (isLampMat(mat) || isGlassLensStrip(mat, mesh))) {
      singles.push(mesh);
    }
  });

  // pass 2a — single-material lamp meshes
  for (const mesh of singles) {
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const spansBothEnds = bb.min.z < -0.02 && bb.max.z > 0.02;

    let pieces: THREE.Mesh[];
    if (spansBothEnds) {
      pieces = splitMeshByPlane(mesh, "z", 0); // halves added as siblings
      mesh.parent?.remove(mesh); // …the merged original is replaced by them
    } else {
      pieces = [mesh];
    }

    for (const piece of pieces) {
      piece.geometry.computeBoundingBox();
      const pbb = piece.geometry.boundingBox!;
      const front = (pbb.min.z + pbb.max.z) / 2 >= 0;
      // always a fresh clone per piece: a shared baked material (SRT10
      // "Lights_315" sits on BOTH ends' kits) must split into head + tail
      const lit = makeLitLampMat(piece.material as THREE.MeshStandardMaterial, front);
      piece.material = lit;
      unionUVBox(uvBoxes, lit, piece.geometry);
      out.push({ mat: lit, front });
    }
  }

  // pass 2b — lamp materials hidden as primitives inside merged bodies
  for (const mesh of merged) {
    const geo = mesh.geometry;
    const idx = geo.index;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const mats = mesh.material as THREE.Material[];
    const swap = new Map<string, THREE.MeshStandardMaterial>();
    const drop: GeoGroup[] = [];

    for (const g of geo.groups as GeoGroup[]) {
      const sm = mats[g.materialIndex] as THREE.MeshStandardMaterial | undefined;
      if (!isLampMat(sm)) continue;
      // z-extent of just this primitive's triangles
      let zmin = Infinity;
      let zmax = -Infinity;
      const end = g.start + g.count;
      for (let i = g.start; i < end; i++) {
        const z = pos.getZ(idx ? idx.getX(i) : i);
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
      }
      if (zmin === Infinity) continue;

      if (zmin < -0.02 && zmax > 0.02) {
        // head + tail share ONE material inside a merged body — pull the
        // primitive out into its own mesh, split it at the midline, lit the
        // halves, then drop the range from the parent so it isn't drawn twice
        drop.push(g);
        const tris: number[] = [];
        for (let i = g.start; i < end; i++) tris.push(idx ? idx.getX(i) : i);
        const tmp = new THREE.Mesh(extractTriangles(geo, tris), sm);
        mesh.parent?.add(tmp); // splitMeshByPlane parents halves to tmp's parent
        for (const piece of splitMeshByPlane(tmp, "z", 0)) {
          piece.geometry.computeBoundingBox();
          const pbb = piece.geometry.boundingBox!;
          const front = (pbb.min.z + pbb.max.z) / 2 >= 0;
          const key = `${sm!.uuid}|${front}`;
          let lit = swap.get(key);
          if (!lit) {
            lit = makeLitLampMat(sm!, front);
            swap.set(key, lit);
            out.push({ mat: lit, front });
          }
          piece.material = lit;
          unionUVBox(uvBoxes, lit, piece.geometry);
        }
        tmp.removeFromParent();
        tmp.geometry.dispose();
        continue;
      }

      const front = (zmin + zmax) / 2 >= 0;
      const key = `${sm!.uuid}|${front}`;
      let lit = swap.get(key);
      if (!lit) {
        lit = makeLitLampMat(sm!, front);
        swap.set(key, lit);
        out.push({ mat: lit, front });
      }
      mats[g.materialIndex] = lit; // whole primitive sits at one end
    }

    if (!drop.length) continue;
    // surgical rebuild: the new index is the surviving groups only (kept in
    // order, so material slots and draw order are preserved); attributes stay
    // shared with the template, the old geometry simply goes unreferenced
    const keep = (geo.groups as GeoGroup[]).filter((g) => !drop.includes(g));
    const flat: number[] = [];
    for (const r of keep) {
      const end = r.start + r.count;
      for (let i = r.start; i < end; i++) flat.push(idx ? idx.getX(i) : i);
    }
    if (!flat.length) {
      mesh.removeFromParent(); // nothing but lamp geometry — replaced by pieces
      continue;
    }
    const ng = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) ng.setAttribute(name, geo.attributes[name]);
    ng.morphAttributes = geo.morphAttributes;
    ng.setIndex(
      pos.count > 65535
        ? new THREE.Uint32BufferAttribute(flat, 1)
        : new THREE.Uint16BufferAttribute(flat, 1),
    );
    let off = 0;
    for (const r of keep) {
      ng.addGroup(off, r.count, r.materialIndex);
      off += r.count;
    }
    mesh.geometry = ng;
  }

  // ── dark-atlas heads: procedural lens blob over the lit pieces' UV box ──
  // (their baseColor atlas is black at the headlamp UVs — atlas modulation
  // yields zero glow; the blob restores headlight presence without the
  // rejected map-less "white sticker" wash: it tracks the lens UV footprint)
  if (DARK_ATLAS_HEADS.has(id)) {
    for (const { mat, front } of out) {
      if (!front) continue;
      const b = uvBoxes.get(mat);
      if (b && b.maxU > b.minU) applyProceduralLensGlow(mat, b);
      // day look: the same black atlas texels render the lens a black void
      // whenever the glow is off (daytime, lamps-unlit) — drop the diffuse
      // map and wear a silver reflector instead, so the headlight reads as
      // a lamp at ALL times, matching the GT-R's bright lens texels
      mat.map = null;
      mat.color.setHex(0xd9dde3);
      mat.needsUpdate = true; // diffuse map slot removed — shader recompile
    }
  }
}

// ─── glass policy: black windows, paint-proof, see-through only with interior ─
/** window material names — "glass" (EN/Sketchfab), "Vitre" (FR), "vidrios"
 * (ES), windshield/window (game rips). NOT_LAMP_MAT guards lamps FROM glass
 * names; this regex claims those names FOR the glass pass — same tokens,
 * opposite purpose. */
const GLASS_MAT = /glass|vit(?:re|e)|vidrio|windshield|window/i;
/** near-black tint — windows must never read as a body colour (user rule:
 * glasses never fit the selected paint) */
const GLASS_COLOR = 0x05070a;
/** opaque blackout for models WITHOUT an interior (nothing inside to show) */
const BLACKOUT_COLOR = 0x020204;
/** base see-through opacity (0.36: a DoubleSide pane = 2 layers → ~59%
 * net see-through — proper NFS tinted glass over a dark cabin; the interior
 * witnesses stay visible instead of hiding behind the tint). Divided by the
 * number of nested window SHELLS (GTA-style models stack an inner duplicate
 * shell — 2 shells × 2 sides at full opacity would stack to near-opaque
 * again) */
const GLASS_OPACITY = 0.36;

/** interior-evidence material names — a material literally named
 * interior/seat/dashboard is interior detail BY DEFINITION: the ACR's
 * "interior" prims (steering wheel, door cards, chassis details) sit at
 * the cabin SIDES where the inboard geometric filter cannot see them */
const INTERIOR_SEMANTIC_MAT = /interior|seat|dashb|cockpit/i;

/** count interior witnesses two ways: geometric (small meshes parked inside
 * the cabin box — see the cabin rules below) and semantic (materials that
 * NAME themselves interior, size-capped so shells never qualify).
 * 2+ semantic or 3+ geometric witnesses = the model ships real interior
 * detail worth showing through the glass. */
function countInteriorMeshes(
  wrapper: THREE.Group,
  dims: CarDims,
  glassBoxes: THREE.Box3[],
  paintNames: Set<string>,
): { geometric: number; semantic: number } {
  const halfW = dims.width / 2;
  const halfL = Math.max(dims.length, 1) / 2;
  const glassUnion = new THREE.Box3();
  for (const b of glassBoxes) glassUnion.union(b);
  if (glassUnion.isEmpty()) return { geometric: 0, semantic: 0 };
  const cabin = new THREE.Box3(
    new THREE.Vector3(
      Math.max(-0.45 * halfW, Math.min(glassUnion.min.x, 0) * 0.5),
      0.22 * dims.topY,
      Math.max(glassUnion.min.z - 0.25, -0.42 * halfL),
    ),
    new THREE.Vector3(
      Math.min(0.45 * halfW, Math.max(glassUnion.max.x, 0) * 0.5),
      Math.min(glassUnion.max.y + 0.05, 0.99 * dims.topY),
      Math.min(glassUnion.max.z + 0.25, 0.42 * halfL),
    ),
  );
  let geometric = 0;
  let semantic = 0;
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isSemantic = false;
    for (const m of mats) {
      if (!m) continue;
      const mn = m.name ?? "";
      if (isLampMat(m) || paintNames.has(mn) || GLASS_MAT.test(mn)) return;
      if (INTERIOR_SEMANTIC_MAT.test(mn)) isSemantic = true;
    }
    const b = new THREE.Box3().setFromObject(mesh);
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    if (s.z > 0.55 * dims.length || s.x > 0.75 * dims.width || s.y > 0.85 * dims.height) return;
    if (isSemantic) {
      semantic++;
      return;
    }
    if (c.x < cabin.min.x || c.x > cabin.max.x) return;
    if (c.y < cabin.min.y || c.y > cabin.max.y) return;
    if (c.z < cabin.min.z || c.z > cabin.max.z) return;
    geometric++;
  });
  return { geometric, semantic };
}

/**
 * Normalize every window in the fleet to ONE policy (user rule 2026-10-28):
 *  - glass materials are never paint-tinted, never white/light-blue/red
 *  - model WITH interior detail → real see-through dark glass (the interior
 *    shows; the window surfaces stop casting shadows so light pours in)
 *  - model WITHOUT interior → opaque glossy blackout (no hollow inside)
 * Candidates = glass-named or already-transparent materials, minus lamps,
 * minus paint, minus materials that only live at the extreme ends of the
 * car (glassy LAMP COVERS — the SRT10's red_glass tail lens must keep its
 * see-through red so the lit lamp behind stays visible).
 */
function finalizeGlass(
  wrapper: THREE.Group,
  dims: CarDims,
  paintNames: Set<string>,
  id: string,
): void {
  const halfL = Math.max(dims.length, 1) / 2;
  const perMat = new Map<THREE.MeshStandardMaterial, THREE.Box3[]>();
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial | undefined;
      if (!sm || !sm.name) continue;
      if (isLampMat(sm) || paintNames.has(sm.name)) continue;
      if (lensCoverClones.has(sm)) continue; // clear lamp covers — never window-tinted
      if (!GLASS_MAT.test(sm.name) && !sm.transparent) continue;
      if (!perMat.has(sm)) perMat.set(sm, []);
      perMat.get(sm)!.push(new THREE.Box3().setFromObject(mesh));
    }
  });

  const glassBoxes: THREE.Box3[] = [];
  const candidates: { m: THREE.MeshStandardMaterial; boxes: THREE.Box3[] }[] = [];
  let shellStack = 0;
  for (const [m, boxes] of perMat) {
    // lamp covers live past 80% of half-length; genuine windows straddle the cabin
    const central = boxes.filter((b) => Math.abs((b.min.z + b.max.z) / 2) <= 0.8 * halfL);
    if (central.length === 0) continue;
    candidates.push({ m, boxes: central });
    glassBoxes.push(...central);
    if (central.some((b) => b.max.z - b.min.z > 0.55 * dims.length)) shellStack++;
  }

  if (candidates.length > 0) {
    const { geometric, semantic } = countInteriorMeshes(wrapper, dims, glassBoxes, paintNames);
    const hasInterior = semantic >= 2 || geometric >= 3;
    const opacity = hasInterior ? Math.max(0.22, GLASS_OPACITY / Math.max(1, shellStack)) : 1;
    const tint = new THREE.Color(GLASS_COLOR);
    for (const { m } of candidates) {
      m.color.copy(hasInterior ? tint : new THREE.Color(BLACKOUT_COLOR));
      if (hasInterior) {
        m.transparent = true;
        m.opacity = opacity;
        m.metalness = 0.9;
        m.roughness = 0.06;
        m.envMapIntensity = Math.max(m.envMapIntensity ?? 1, 2.2);
        m.depthWrite = false;
        // GTA window shells are single-sided — the far-side windows must
        // exist when you look through the near ones
        m.side = THREE.DoubleSide;
      } else {
        m.transparent = false;
        m.opacity = 1;
        m.metalness = 0.55;
        m.roughness = 0.14;
        m.envMapIntensity = Math.max(m.envMapIntensity ?? 1, 1.3);
        m.depthWrite = true;
      }
      m.needsUpdate = true;
    }
    // see-through windows stop casting shadows — light pours through them
    if (hasInterior) {
      const glassSet = new Set(candidates.map((c) => c.m));
      wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        if (mats.length && mats.every((m) => glassSet.has(m as THREE.MeshStandardMaterial)))
          mesh.castShadow = false;
      });
    }
    // dev probe (menu preloads every model → one report per car id)
    if (typeof window !== "undefined") {
      const w = window as unknown as { __carGlassReports?: Record<string, unknown> };
      (w.__carGlassReports ??= {})[id] = {
        hasInterior,
        interiorGeometric: geometric,
        interiorSemantic: semantic,
        shellStack,
        opacity,
        glass: candidates.map((c) => ({ name: c.m.name, meshes: c.boxes.length })),
        skipped: [...perMat.entries()]
          .filter(([m]) => !candidates.some((c) => c.m === m))
          .map(([m, b]) => ({ name: m.name, reason: "extreme-ends (lamp cover?)", meshes: b.length })),
      };
    }
  }
}

function extractTriangles(geo: THREE.BufferGeometry, triIndices: number[]): THREE.BufferGeometry {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute | undefined;
  const uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
  const remap = new Map<number, number>();
  const newPos: number[] = [];
  const newNor: number[] = [];
  const newUv: number[] = [];
  const newIndex: number[] = [];
  for (const vi of triIndices) {
    let ni = remap.get(vi);
    if (ni === undefined) {
      ni = newPos.length / 3;
      remap.set(vi, ni);
      newPos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      if (nor) newNor.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
      if (uv) newUv.push(uv.getX(vi), uv.getY(vi));
    }
    newIndex.push(ni);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(newPos, 3));
  if (newNor.length) g.setAttribute("normal", new THREE.Float32BufferAttribute(newNor, 3));
  if (newUv.length) g.setAttribute("uv", new THREE.Float32BufferAttribute(newUv, 2));
  g.setIndex(newIndex);
  return g;
}

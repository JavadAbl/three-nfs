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
function buildTemplate(id: string, scene: THREE.Group): Template {
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
      if (
        m &&
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
  splitDarkLamps(wrapper, lampMats);

  // shadows for the whole car
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
    }
  });

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
    const near = alive.filter(
      ([, b]) => b.getCenter(new THREE.Vector3()).distanceTo(centroid) < Math.max(p90 * 0.9, 0.5),
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
 * OBJ exports emissive=0; all of them get taken over. Glass impostors
 * ("glass_light" windshields) never qualify. */
function isLampMat(m: THREE.Material | null | undefined): boolean {
  const sm = m as THREE.MeshStandardMaterial | null;
  if (!sm || !sm.emissive) return false;
  const name = sm.name ?? "";
  return !NOT_LAMP_MAT.test(name) && LAMP_MAT.test(name);
}

/** clone `base` into a lit lens material: warm-white front / stop-red rear */
function makeLitLampMat(base: THREE.MeshStandardMaterial, front: boolean): THREE.MeshStandardMaterial {
  const lit = base.clone();
  lit.name = `${base.name}_${front ? "head" : "rear"}`;
  lit.emissive.copy(front ? HEAD_EMISSIVE : TAIL_EMISSIVE);
  // these lenses are the car's ONLY lamp visuals at night — the old floating
  // glow-quads/lamp-box impostors are gone, so the real geometry must carry
  // the glow alone
  lit.emissiveIntensity = front ? LAMP_HEAD_INTENSITY : LAMP_TAIL_INTENSITY;
  return lit;
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
 * Glass impostors are never touched. Lit materials are reported through
 * `out` (Car.ts drives them by time-of-day
 * and brake state). Coordinates are mesh-local — Sketchfab/OBJ-style exports
 * bake identity transforms, so local z ≈ the car's z midline. */
function splitDarkLamps(wrapper: THREE.Group, out: LampMat[]): void {
  // pass 1 — scan only: the fixes below add/remove SIBLING nodes and
  // mutating a graph mid-traverse skips nodes, so collect victims first
  const singles: THREE.Mesh[] = [];
  const merged: THREE.Mesh[] = [];
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      if (mesh.geometry.groups.length > 0 && mat.some((m) => isLampMat(m))) merged.push(mesh);
    } else if (mat && mesh.geometry.groups.length === 0 && isLampMat(mat)) {
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

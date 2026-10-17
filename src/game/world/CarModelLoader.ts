// ─── CarModelLoader: loads, normalizes & rigs GLB car models ─────────────────
// Any GLB dropped into /public/models can become a drivable car:
//   1. normalized: forward +Z, ground y=0, target length, centered
//   2. wheels auto-detected by node name (/wheel/i), axle pairs split L/R,
//      wrapped in spin/steer pivots
//   3. paint materials detected (/carpaint/i or /_details$/) for per-player tint
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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

export interface CarModelInstance {
  root: THREE.Group;
  wheels: ModelWheel[];
  dims: CarDims;
  wheelRadius: number;
  /** per-instance cloned tintable materials */
  paintMaterials: THREE.MeshStandardMaterial[];
}

interface Template {
  url: string;
  wrapper: THREE.Group; // normalized + rigged (pivots named wheelPivot_XX)
  dims: CarDims;
  wheelRadius: number;
  paintNames: Set<string>;
}

/** how long every model car is normalized to (matches physics tuning) */
const TARGET_LENGTH = 4.55;
/** wheel mesh wider than this = a merged L+R axle pair needing a split */
const PAIR_WIDTH = 1.15;
/** max distance for attaching loose nodes (brake discs, centre caps) to a wheel */
const ATTACH_RADIUS = 0.55;

const loader = new GLTFLoader();
const templates = new Map<string, Template>();
const inflight = new Map<string, Promise<Template>>();

export interface CarDef {
  id: string;
  name: string;
  modelUrl: string | null;
  spec: string;
}

/** registry mirrored in constants.ts — kept here to avoid a circular import */
const CAR_DEFS: CarDef[] = [
  { id: "gtr", name: "NISSAN GT-R R35", modelUrl: "/models/nissan-gtr-r35.glb", spec: "NISMO · 600 HP" },
  { id: "audi", name: "AUDI TT RS", modelUrl: "/models/audi-tt-rs.glb", spec: "QUATTRO · 400 HP" },
  { id: "classic", name: "STREET MUSCLE", modelUrl: null, spec: "V8 · PROCEDURAL" },
];

export const CAR_LIBRARY = CAR_DEFS;

export function carDef(id: string): CarDef | undefined {
  return CAR_DEFS.find((c) => c.id === id);
}

/** load (and cache) a car template — resolves null for procedural (no-model) cars */
export function loadCarModel(id: string): Promise<Template | null> {
  const def = carDef(id);
  if (!def) return Promise.reject(new Error(`unknown car "${id}"`));
  if (!def.modelUrl) return Promise.resolve(null);
  const cached = templates.get(id);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(id);
  if (pending) return pending;
  const p = loader
    .loadAsync(def.modelUrl)
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
  return Promise.allSettled(CAR_DEFS.map((c) => loadCarModel(c.id)));
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
  const cloneMap = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replaced = mats.map((m) => {
      if (!tpl.paintNames.has(m.name ?? "")) return m;
      let c = cloneMap.get(m);
      if (!c) {
        c = m.clone();
        cloneMap.set(m, c);
        paintMaterials.push(c as THREE.MeshStandardMaterial);
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

  return { root, wheels, dims: { ...tpl.dims }, wheelRadius: tpl.wheelRadius, paintMaterials };
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

  // ── rig wheels ──
  const { wheelRadius } = rigWheels(wrapper);

  // paint material names
  const paintNames = new Set<string>();
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (m && (/carpaint/i.test(m.name ?? "") || /(^|_)details$|(^|_)paint$/i.test(m.name ?? ""))) {
        paintNames.add(m.name);
      }
    }
  });

  // shadows for the whole car
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = false;
    }
  });

  return { url: id, wrapper, dims, wheelRadius, paintNames };
}

// ─── wheel rigging ──────────────────────────────────────────────────────────
interface WheelAnchor {
  node: THREE.Object3D;
  meshes: THREE.Mesh[];
}

function findWheelAnchors(root: THREE.Object3D): WheelAnchor[] {
  const anchors: WheelAnchor[] = [];
  root.traverse((o) => {
    const name = o.name ?? "";
    if (/wheel/i.test(name) && !/brake/i.test(name)) {
      const meshes: THREE.Mesh[] = [];
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
      o.traverse((c) => {
        if ((c as THREE.Mesh).isMesh && c !== o) meshes.push(c as THREE.Mesh);
      });
      if (meshes.length) anchors.push({ node: o, meshes });
    }
  });
  return anchors;
}

/** bake world transforms into wheel meshes, split axle pairs, build pivots */
function rigWheels(wrapper: THREE.Group): { wheelRadius: number } {
  const anchors = findWheelAnchors(wrapper);
  wrapper.updateMatrixWorld(true);

  // candidate wheel meshes (baked into wrapper/world space)
  interface WheelPiece {
    mesh: THREE.Mesh;
    isBrake: boolean;
    fromAnchor: string; // anchor node name
  }
  const pieces: WheelPiece[] = [];

  for (const a of anchors) {
    for (const m of a.meshes) {
      const baked = bakeToWorld(m, wrapper);
      const wb = new THREE.Box3().setFromBufferAttribute(
        baked.geometry.attributes.position as THREE.BufferAttribute
      );
      // convert local (now world-baked) box since mesh transform is identity-ish
      const width = wb.max.x - wb.min.x;
      if (width > PAIR_WIDTH) {
        // merged L+R axle pair → split by x=car centre
        const halves = splitMeshByX(baked, 0);
        for (const h of halves) pieces.push({ mesh: h, isBrake: false, fromAnchor: a.node.name });
        if (!halves.includes(baked)) {
          wrapper.remove(baked);
          baked.geometry.dispose();
        }
      } else {
        pieces.push({ mesh: baked, isBrake: /brake/i.test(baked.name), fromAnchor: a.node.name });
      }
    }
  }

  // brake disc / centre-cap nodes: close to a wheel but not named "wheel"
  const extraNodes: THREE.Mesh[] = [];
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    const name = o.name ?? "";
    if (!m.isMesh) return;
    if (/wheel|brake|disc|cap|caliper/i.test(name)) {
      if (/brake|disc|cap|caliper/i.test(name) && !pieces.some((p) => p.mesh === m)) {
        extraNodes.push(m);
      }
    } else {
      // unnamed pieces very close to a wheel centre get pulled in
      // (checked later once wheel centres are known)
    }
  });
  for (const n of extraNodes) pieces.push({ mesh: bakeToWorld(n, wrapper), isBrake: true, fromAnchor: "" });

  if (pieces.length === 0) return { wheelRadius: 0.38 };

  // ── group pieces into 4 corners ──
  interface Corner {
    key: string;
    x: number;
    z: number;
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
      corner = { key, x: 0, z: front ? 1 : -1, meshes: [], bbox: new THREE.Box3(), drive: !isBrake };
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

  // unnamed loose meshes near a wheel centre (e.g. GT-R centre caps)
  const loose: THREE.Mesh[] = [];
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.parent === wrapper) return;
    const name = (m.name ?? "").toLowerCase();
    if (name.includes("wheel") || name.includes("brake")) return;
    m.updateWorldMatrix(true, false);
    const wp = m.getWorldPosition(new THREE.Vector3());
    for (const corner of corners) {
      const centre = corner.bbox.getCenter(new THREE.Vector3());
      if (wp.distanceTo(centre) < ATTACH_RADIUS && corner.drive) {
        loose.push(m);
        break;
      }
    }
  });
  for (const m of loose) {
    const corner = corners.find((c) => {
      const centre = c.bbox.getCenter(new THREE.Vector3());
      return m.getWorldPosition(new THREE.Vector3()).distanceTo(centre) < ATTACH_RADIUS + 0.1 && c.drive;
    });
    if (corner) {
      const baked = bakeToWorld(m, wrapper);
      corner.meshes.push(baked);
      corner.bbox.expandByObject(baked);
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
    for (const mesh of corner.meshes) {
      wrapper.remove(mesh);
      pivot.attach(mesh);
    }
  }

  return { wheelRadius };
}

/** clone mesh geometry, bake its world matrix in, reparent to wrapper root */
function bakeToWorld(mesh: THREE.Mesh, wrapper: THREE.Group): THREE.Mesh {
  mesh.updateWorldMatrix(true, false);
  const world = mesh.matrixWorld.clone();
  const parent = mesh.parent;
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(world);
  const copy = new THREE.Mesh(geo, mesh.material);
  copy.name = mesh.name;
  copy.castShadow = true;
  if (parent && parent !== wrapper) {
    parent.remove(mesh);
    wrapper.add(copy);
  } else {
    wrapper.remove(mesh);
    wrapper.add(copy);
  }
  return copy;
}

/** split a baked (identity-transform) mesh by local x into L/R halves */
function splitMeshByX(mesh: THREE.Mesh, splitX: number): THREE.Mesh[] {
  const geo = mesh.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const idx = geo.index;
  const triCount = Math.floor((idx ? idx.count : pos.count) / 3);

  const leftTris: number[] = [];
  const rightTris: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    (cx < splitX ? leftTris : rightTris).push(a, b, c);
  }

  const out: THREE.Mesh[] = [];
  for (const tris of [leftTris, rightTris]) {
    if (tris.length === 0) continue;
    const g = extractTriangles(geo, tris);
    const m = new THREE.Mesh(g, mesh.material);
    m.name = `${mesh.name}_half`;
    m.castShadow = true;
    mesh.parent?.add(m);
    out.push(m);
  }
  return out;
}

function wrapperOf(mesh: THREE.Mesh): THREE.Object3D | null {
  return mesh.parent;
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

// ─── ProceduralMuscle: shared low-poly muscle-car body ───────────────────────
// Single source for the procedural car silhouette: the race fallback skin in
// Car.ts AND the showroom turntable in CarPreview.tsx both build from this, so
// the car you pick in the garage is the car you drive.
import * as THREE from "three";

export interface MuscleBody {
  /** group holding the painted shell (no wheels / lights / FX) */
  root: THREE.Group;
  /** tintable paint material */
  paint: THREE.MeshPhysicalMaterial;
  /** every material created here (for disposal) */
  mats: THREE.Material[];
}

/** build the muscle-car shell — stacked-box silhouette, ~4.6 m long */
export function buildMuscleBody(color: string): MuscleBody {
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.55, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x090a12,
    metalness: 0.9,
    roughness: 0.08,
    transparent: true,
    opacity: 0.85,
  });

  const root = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.5, 4.6), paint);
  body.position.y = 0.52;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.34, 1.1), paint);
  nose.position.set(0, 0.42, 2.05);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.9), paint);
  tail.position.set(0, 0.55, -2.2);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.1), paint);
  cabin.position.set(0, 0.98, -0.35);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.42, 0.7), glass);
  windshield.position.set(0, 1.0, 0.75);
  windshield.rotation.x = -0.42;
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 0.55), glass);
  rearGlass.position.set(0, 1.02, -1.42);
  rearGlass.rotation.x = 0.5;
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.5), dark);
  spoiler.position.set(0, 1.15, -2.35);
  const spoilerStand1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.3), dark);
  spoilerStand1.position.set(0.7, 0.98, -2.3);
  const spoilerStand2 = spoilerStand1.clone();
  spoilerStand2.position.x = -0.7;
  const sideSkirtL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 2.8), dark);
  sideSkirtL.position.set(1.02, 0.34, 0);
  const sideSkirtR = sideSkirtL.clone();
  sideSkirtR.position.x = -1.02;

  for (const m of [body, nose, tail, cabin, windshield, rearGlass, spoiler, spoilerStand1, spoilerStand2, sideSkirtL, sideSkirtR])
    root.add(m);

  return { root, paint, mats: [paint, dark, glass] };
}

/** wheel radius shared by builder + physics */
export const MUSCLE_WHEEL_RADIUS = 0.38;

/** one wheel (tire + gold rim) — position comes from MUSCLE_WHEEL_POS */
export function buildMuscleWheel(): THREE.Group {
  const tireGeo = new THREE.CylinderGeometry(MUSCLE_WHEEL_RADIUS, MUSCLE_WHEEL_RADIUS, 0.3, 14);
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.32, 10);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xb8a06a,
    metalness: 0.95,
    roughness: 0.25,
    emissive: 0x241a05,
  });
  const wheel = new THREE.Group();
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.rotation.z = Math.PI / 2;
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.z = Math.PI / 2;
  wheel.add(tire, rim);
  return wheel;
}

/** [x, y, z, isFront] — the four wheel slots of the muscle body */
export const MUSCLE_WHEEL_POS: [number, number, number, boolean][] = [
  [0.95, MUSCLE_WHEEL_RADIUS, 1.55, true],
  [-0.95, MUSCLE_WHEEL_RADIUS, 1.55, true],
  [0.95, MUSCLE_WHEEL_RADIUS, -1.6, false],
  [-0.95, MUSCLE_WHEEL_RADIUS, -1.6, false],
];

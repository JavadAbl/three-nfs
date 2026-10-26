// ─── ProceduralMuscle: sculpted low-poly muscle-car body ──────────────────────
// Single source for the procedural car silhouette: the race fallback skin in
// Car.ts AND the showroom turntable in CarPreview.tsx both build from this, so
// the car you pick in the garage is the car you drive.
//
// v2: the old stacked-box shell read as "cargo crates". The body is now ONE
// extruded side-profile (THREE.Shape → ExtrudeGeometry) — a real 70s muscle
// silhouette with raked windshield, fastback rear, fender crowns over the
// wheel arches and chamfered panel edges from the extrude bevel. Glass,
// grille, scoop, splitter, mirrors and exhaust tips dress the shell; wheels
// get 5-spoke rims over a visible brake disc. Physics interface unchanged:
// MUSCLE_WHEEL_POS / MUSCLE_WHEEL_RADIUS / buildMuscleWheel stay frozen, and
// the body keeps the dims Car.ts attaches to (nose z≈2.60, tail z≈-2.62,
// beltline ~0.80, roof 1.22, width ~1.96).
import * as THREE from "three";

export interface MuscleBody {
  /** group holding the painted shell (no wheels / lights / FX) */
  root: THREE.Group;
  /** tintable paint material */
  paint: THREE.MeshPhysicalMaterial;
  /** every material created here (for disposal) */
  mats: THREE.Material[];
}

/** wheel radius shared by builder + physics */
export const MUSCLE_WHEEL_RADIUS = 0.38;

/** wheel-arch centres in profile space (z along the car, y up) — these MUST
 *  line up with MUSCLE_WHEEL_POS.z below or the tires sit outside their arches */
const ARCH_FRONT_Z = 1.55;
const ARCH_REAR_Z = -1.6;
const ARCH_R = 0.44;
const ARCH_CY = 0.34;
const ROCKER_Y = 0.3; // profile bottom line (ground clearance under the sills)

/** side profile of the shell: nose → hood → windshield → roof → fastback →
 *  tail → underside with two wheel-arch notches back to the nose. */
function muscleProfile(): THREE.Shape {
  const s = new THREE.Shape();
  // front bumper face
  s.moveTo(2.6, 0.3);
  s.lineTo(2.6, 0.58);
  // hood rise
  s.quadraticCurveTo(2.25, 0.71, 1.85, 0.745);
  // fender crown over the front arch (70s muscle bulge)
  s.quadraticCurveTo(1.68, 0.83, 1.55, 0.835);
  // hood run to the cowl
  s.quadraticCurveTo(1.0, 0.815, 0.5, 0.8);
  // windshield rake
  s.quadraticCurveTo(0.2, 1.06, 0.0, 1.22);
  // roof
  s.quadraticCurveTo(-0.6, 1.26, -1.05, 1.23);
  // fastback slope
  s.quadraticCurveTo(-1.55, 1.12, -1.9, 0.99);
  // trunk deck
  s.quadraticCurveTo(-2.2, 0.96, -2.45, 0.95);
  // tail face
  s.lineTo(-2.62, 0.62);
  s.lineTo(-2.62, 0.3);
  // underside: tail → rear arch → front arch → nose. Arch entry/exit points
  // are where the arch circle meets the rocker line.
  const dx = Math.sqrt(ARCH_R * ARCH_R - (ARCH_CY - ROCKER_Y) ** 2);
  // rocker→arch endpoints: left of the arch at ~185°, right at ~-5°.
  // Sweep LEFT→RIGHT over the TOP of the circle (through +90°) = decreasing
  // angle = clockwise, hence aClockwise=true. a0 must be the POSITIVE 185°
  // form (π − a1), not atan2's −175°, or the arc bulges DOWN below the rocker.
  const a1 = Math.atan2(ROCKER_Y - ARCH_CY, dx); // ≈ −0.09 rad, right of arch
  const a0 = Math.PI - a1; // ≈ 3.23 rad (185°), left of arch
  s.lineTo(ARCH_REAR_Z - dx, ROCKER_Y);
  s.absarc(ARCH_REAR_Z, ARCH_CY, ARCH_R, a0, a1, true); // over the top
  s.lineTo(ARCH_FRONT_Z - dx, ROCKER_Y);
  s.absarc(ARCH_FRONT_Z, ARCH_CY, ARCH_R, a0, a1, true);
  s.lineTo(2.6, 0.3); // close at the bumper
  return s;
}

/** build the muscle-car shell — extruded-profile silhouette, ~4.6 m long */
export function buildMuscleBody(color: string): MuscleBody {
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.85,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    // night paint must reflect the neon city env or the body reads black
    envMapIntensity: 1.8,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.55, metalness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x090a12,
    metalness: 0.9,
    roughness: 0.08,
    transparent: true,
    opacity: 0.85,
    envMapIntensity: 1.3,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd8d8e0,
    metalness: 1.0,
    roughness: 0.15,
    envMapIntensity: 1.6,
  });

  const root = new THREE.Group();

  // ── shell: profile extruded across the width; the bevel chamfers every
  // panel edge (tumblehome at the roof, tapered hood/tail) for free ──
  const DEPTH = 1.76; // side-wall span; caps add bevelThickness each side
  const geo = new THREE.ExtrudeGeometry(muscleProfile(), {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 14,
  });
  // profile x = forward, y = up, extrusion z = across → rotate so the
  // extrusion runs along the car's x (width) and the profile lies in z/y
  geo.rotateY(-Math.PI / 2);
  geo.translate(DEPTH / 2, 0, 0); // centre the width on x=0
  const shell = new THREE.Mesh(geo, paint);
  root.add(shell);

  // ── glass insets — planes lie ON the profile slopes, pushed 3.5 cm out
  //  along the OUTWARD normal so the curved shell can never bury them.
  //  Rotations are exact: local height runs up the rake, normal faces out.
  //  (windshield: outward normal (0, 0.643, 0.766); rear glass — a fastback
  //  whose top edge sits FORWARD of the deck — faces up-backward)
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.64), glass);
  windshield.position.set(0, 1.035, 0.275);
  windshield.rotation.x = -Math.atan2(0.42, 0.5);
  root.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.85), glass);
  rearGlass.position.set(0, 1.145, -1.485);
  rearGlass.rotation.x = Math.atan2(0.85, 0.24) - Math.PI;
  root.add(rearGlass);

  // side windows: door quarter + opera window per flank, faces flush with
  // the painted flank (x ±0.98) so they read as inset glass, not buried
  for (const x of [0.965, -0.965]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.5), glass);
    door.position.set(x, 1.03, 0.12);
    root.add(door);
    const opera = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.56), glass);
    opera.position.set(x, 1.04, -0.62);
    root.add(opera);
  }

  // door cut lines: thin vertical seams on each flank (front + rear door
  // edges), 1.2 cm proud — reads as panel shadow, sells the stamped-metal look
  const seamGeo = new THREE.BoxGeometry(0.015, 0.42, 0.02);
  for (const x of [0.985, -0.985]) {
    for (const z of [0.52, -0.48]) {
      const seam = new THREE.Mesh(seamGeo, dark);
      seam.position.set(x, 0.57, z);
      root.add(seam);
    }
  }

  // ── dressing: scoop, grille, splitter, tail panel, mirrors, exhausts ──
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 0.42), paint);
  scoop.position.set(0, 0.855, 1.2);
  root.add(scoop);
  const scoopInlet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.05), dark);
  scoopInlet.position.set(0, 0.855, 1.39);
  root.add(scoopInlet);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.18, 0.08), dark);
  grille.position.set(0, 0.46, 2.585);
  root.add(grille);
  for (const y of [0.43, 0.5]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.025, 0.09), chrome);
    bar.position.set(0, y, 2.585);
    root.add(bar);
  }
  // headlight recesses for the lamp quads Car.ts mounts at (±0.62, 0.48)
  for (const x of [0.62, -0.62]) {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.06), dark);
    bezel.position.set(x, 0.48, 2.6);
    root.add(bezel);
  }

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.28), dark);
  splitter.position.set(0, 0.245, 2.52);
  root.add(splitter);

  const tailPanel = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.26, 0.06), dark);
  tailPanel.position.set(0, 0.545, -2.615);
  root.add(tailPanel);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.13, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xd8d8de, roughness: 0.6 }),
  );
  plate.position.set(0, 0.4, -2.645);
  root.add(plate);

  for (const x of [1.05, -1.05]) {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.11), dark);
    stalk.position.set(x, 0.855, 0.45);
    root.add(stalk);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.09, 0.07), paint);
    head.position.set(x, 0.885, 0.4);
    root.add(head);
  }

  // exhaust tips — the nitro flames Car.ts mounts at (±0.45, 0.34, -2.75)
  // shoot straight out of these
  const pipeGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.16, 12);
  for (const x of [0.45, -0.45]) {
    const pipe = new THREE.Mesh(pipeGeo, chrome);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.34, -2.62);
    root.add(pipe);
  }

  return { root, paint, mats: [paint, dark, glass, chrome, plate.material as THREE.Material] };
}

/** one wheel (torus tire + gold 5-spoke rim, brake disc + calipers visible
 *  through the rim opening) — position comes from MUSCLE_WHEEL_POS.
 *  Symmetric along the axle: Car.ts/CarPreview mount the same group on both
 *  flanks without mirroring, so both faces must read as the outboard face. */
export function buildMuscleWheel(): THREE.Group {
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xb8a06a,
    metalness: 0.95,
    roughness: 0.25,
    emissive: 0x241a05,
  });
  const discMat = new THREE.MeshStandardMaterial({ color: 0x55555e, metalness: 0.9, roughness: 0.35 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.5 });

  const wheel = new THREE.Group();

  // torus tire: ring 0.275 + tube 0.105 → outer ≈ 0.38, width 0.21, and a
  // rim opening (inner ≈ 0.17) wide enough for the spokes/disc/calipers to
  // READ — a solid cylinder tire would bury them, and the first draft's
  // 0.155 opening was mostly swallowed by the tube so wheels read as discs
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.105, 12, 28), tireMat);
  tire.rotation.y = Math.PI / 2; // hole axis (local z) → axle (x)
  wheel.add(tire);

  // rim barrel + 5 spokes centred in the opening + hub caps on BOTH faces
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.2, 16, 1, true), rimMat);
  barrel.rotation.z = Math.PI / 2;
  wheel.add(barrel);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.19, 0.055), rimMat);
    spoke.rotation.x = a;
    spoke.position.set(0, Math.cos(a) * 0.09, Math.sin(a) * 0.09);
    wheel.add(spoke);
  }
  const hubGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12);
  for (const x of [0.115, -0.115]) {
    const hub = new THREE.Mesh(hubGeo, rimMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.x = x;
    wheel.add(hub);
  }

  // brake disc centred in the opening + a caliper per side (only the
  // outboard one is ever in view; the twin keeps the wheel symmetric)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.04, 20), discMat);
  disc.rotation.z = Math.PI / 2;
  wheel.add(disc);
  const caliperGeo = new THREE.BoxGeometry(0.05, 0.09, 0.065);
  for (const x of [0.03, -0.03]) {
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(x, 0.105, 0);
    wheel.add(caliper);
  }

  return wheel;
}

/** [x, y, z, isFront] — the four wheel slots of the muscle body */
export const MUSCLE_WHEEL_POS: [number, number, number, boolean][] = [
  [0.95, MUSCLE_WHEEL_RADIUS, 1.55, true],
  [-0.95, MUSCLE_WHEEL_RADIUS, 1.55, true],
  [0.95, MUSCLE_WHEEL_RADIUS, -1.6, false],
  [-0.95, MUSCLE_WHEEL_RADIUS, -1.6, false],
];

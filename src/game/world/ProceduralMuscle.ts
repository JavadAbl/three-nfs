// ─── ProceduralMuscle: sculpted low-poly muscle-car body ──────────────────────
// Single source for the procedural car silhouette: the race fallback skin in
// Car.ts AND the showroom turntable in CarPreview.tsx both build from this, so
// the car you pick in the garage is the car you drive.
//
// v2: the old stacked-box shell read as "cargo crates". The body is ONE
// extruded side-profile (THREE.Shape → ExtrudeGeometry) — a real 70s muscle
// silhouette with raked windshield, fastback rear, fender crowns over the
// wheel arches and chamfered panel edges from the extrude bevel. Glass,
// grille, scoop, splitter, mirrors and exhaust tips dress the shell; wheels
// get 5-spoke rims over a visible brake disc.
//
// v3: street-machine dress-up + a procedural paint JOB. The shell is no longer
// a flat colour: one 1024² canvas trio (albedo + roughness + metalness,
// colour-independent, cached module-level — every muscle car shares it and
// tints it via material.color, which applyPaint already handles) carries twin
// vinyl stripes over hood/roof/deck (glossy, non-metallic), wheel-arch soot
// and rocker grime low on the flanks. UVs are assigned per face from the final
// positions (top / right flank / left flank / chip regions); small painted
// parts pin their UVs to a clean chip so they stay solid tint. Dress-up: full
// chrome bumpers, ducktail spoiler, louvered opera windows, arch trim, side
// skirts, fender gills, chrome V badge + fuel cap, hood pins, antenna.
//
// Physics interface unchanged: MUSCLE_WHEEL_POS / MUSCLE_WHEEL_RADIUS /
// buildMuscleWheel stay frozen, and the body keeps the dims Car.ts attaches to
// (nose z≈2.60, tail z≈-2.62, beltline ~0.80, roof 1.22, width ~1.96, lamp
// quads (±0.62, 0.48), tail lamps (±0.6, 0.62), exhausts (±0.45, 0.34)).
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

// ─── procedural paint: one 1024² canvas trio, shared by every muscle car ─────
// Layout (canvas pixels; the roughness/metalness canvases repeat the same
// shapes as gray values — stripes stay glossy vinyl, grime goes matte):
//   A  top faces    x[0,460)    y[0,512)      u along the car, v across width
//   B  right flank  x[460,1024) y[0,512)      u runs tail→nose
//   C  left flank   x[460,1024) y[512,1024)   u runs nose→tail
//   D  chips        x[0,460)    y[512,1024)   clean chip (top) + underbody
// The flanks get separate regions (mirrored u) so both sides read correctly.
// Material roughness/metalness are 1.0 — the maps carry the real values.
interface PaintMaps {
  map: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
}
let PAINT_MAPS: PaintMaps | null = null;

/** deterministic RNG — same noise on every load, and aligned across the
 *  albedo/roughness/metal passes (same seed) */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PaintInks {
  base: string;
  stripe: string;
  pin: string;
  soot: string;
  sootSoft: string;
  grime: string;
  under: string;
}

// albedo: near-white base so the per-car tint survives; stripes near-black so
// they read on any paint; soot/grime are translucent warm-dark washes
const INK_ALBEDO: PaintInks = {
  base: "#ececec",
  stripe: "#1e1e22",
  pin: "#c8c8c8",
  soot: "rgba(30,30,27,0.55)",
  sootSoft: "rgba(30,30,27,0.3)",
  grime: "rgba(26,26,23,0.62)",
  under: "#17171a",
};
// roughness (gray = value): paint 0.35, vinyl stripes 0.16, grime ~0.8
const INK_ROUGH: PaintInks = {
  base: "#5a5a5a",
  stripe: "#282828",
  pin: "#323232",
  soot: "rgba(215,215,215,0.5)",
  sootSoft: "rgba(180,180,180,0.3)",
  grime: "rgba(205,205,205,0.45)",
  under: "#ebebeb",
};
// metalness (gray = value): paint 0.85, vinyl 0.06, grime ~0.2
const INK_METAL: PaintInks = {
  base: "#d8d8d8",
  stripe: "#0f0f0f",
  pin: "#c8c8c8",
  soot: "rgba(40,40,40,0.55)",
  sootSoft: "rgba(90,90,90,0.3)",
  grime: "rgba(50,50,50,0.5)",
  under: "#292929",
};

function drawPaint(ctx: CanvasRenderingContext2D, k: PaintInks, rnd: () => number): void {
  ctx.fillStyle = k.base;
  ctx.fillRect(0, 0, 1024, 1024);

  // polish streaks along u on A/B/C only — the chip region stays flat
  for (const [x0, y0, w, h] of [
    [0, 0, 460, 512],
    [460, 0, 564, 512],
    [460, 512, 564, 512],
  ] as const) {
    for (let i = 0; i < 130; i++) {
      ctx.globalAlpha = 0.02 + rnd() * 0.03;
      ctx.fillStyle = rnd() < 0.5 ? "#ffffff" : "#000000";
      ctx.fillRect(x0 + rnd() * w * 0.4, y0 + rnd() * h, w * (0.2 + rnd() * 0.5), 1);
    }
  }
  ctx.globalAlpha = 1;

  // D: clean chip (small painted parts pin here) + underbody
  ctx.fillStyle = k.base;
  ctx.fillRect(0, 512, 460, 256);
  ctx.fillStyle = k.under;
  ctx.fillRect(0, 768, 460, 256);

  // A: twin vinyl stripes over hood/roof/deck. World x = ±0.26, 18 cm wide,
  // z from the deck edge (-2.45) to the hood front (2.35).
  for (const vc of [0.8157, 0.6843]) {
    const y = (1 - vc) * 1024;
    ctx.fillStyle = k.stripe;
    ctx.fillRect(19, y - 23, 414, 46);
    ctx.fillStyle = k.pin; // pinstripes just outside each band
    ctx.fillRect(19, y - 27, 414, 2);
    ctx.fillRect(19, y + 23, 414, 2);
  }

  // B+C: arch soot — two soft arcs hugging each wheel opening. Canvas u/v are
  // anisotropic (u: 564 px = 5.34 m, v: 512 px = 1.09 m), so the arcs are
  // drawn in a scaled space to keep the stroke width uniform in world units.
  // cy=465 = arch centre (py=0.34); alphas high — subtler washes vanished.
  for (const cy of [465, 977]) {
    for (const cx of [579, 911]) {
      for (const [w, ink] of [
        [66, k.sootSoft],
        [34, k.soot],
      ] as const) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(0.2247, 1);
        ctx.beginPath();
        ctx.arc(0, 0, 228, Math.PI, Math.PI * 2); // upper half only
        ctx.lineWidth = w;
        ctx.strokeStyle = ink;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // B+C: rocker grime — a near-black core AT the rocker line (py=0.30 →
  // canvas y≈484, verified with a red probe band) feathered up the door to
  // py≈0.56 (y≈410). Lighting quantization eats ~half the painted contrast
  // (measured: 22% painted → ~10% perceived), so the core runs at full alpha.
  for (const yBottom of [484, 996]) {
    ctx.fillStyle = k.soot;
    ctx.fillRect(460, yBottom - 10, 564, 10);
    const g = ctx.createLinearGradient(0, yBottom - 10, 0, yBottom - 74);
    g.addColorStop(0, k.grime);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(460, yBottom - 74, 564, 64);
  }

  // B+C: exhaust smut — soot streaks trailing from the rear arch toward the
  // tail at rocker height (right flank: rear arch x≈911 → tail x=1024; left
  // flank mirrors x≈579 → 460). cy≈460 = py 0.40, the quarter-panel bottom.
  const smut = (cx: number, cy: number, dir: number) => {
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(cx + dir * (14 + i * 18), cy + 4 - i * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 26 - i * 3, 13 - i * 1.5, dir * 0.12, 0, Math.PI * 2);
      ctx.globalAlpha = 0.34 - i * 0.05;
      ctx.fillStyle = k.soot;
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };
  smut(918, 460, 1); // right flank, behind the rear arch
  smut(572, 972, -1); // left flank, behind the rear arch
}

function buildPaintMaps(): PaintMaps | null {
  if (typeof document === "undefined") return null; // bun probes: flat paint
  if (PAINT_MAPS) return PAINT_MAPS;
  const mk = (): CanvasRenderingContext2D => {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    return c.getContext("2d")!;
  };
  const a = mk();
  const r = mk();
  const m = mk();
  drawPaint(a, INK_ALBEDO, mulberry32(1));
  drawPaint(r, INK_ROUGH, mulberry32(1));
  drawPaint(m, INK_METAL, mulberry32(1));
  const map = new THREE.CanvasTexture(a.canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  PAINT_MAPS = { map, rough: new THREE.CanvasTexture(r.canvas), metal: new THREE.CanvasTexture(m.canvas) };
  return PAINT_MAPS;
}

/** per-face UVs from final positions. ExtrudeGeometry is non-indexed, so each
 *  face can pick its region without tearing shared verts; verts then map
 *  through the region transform so flanks/tops stay continuous. */
function assignShellUVs(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const nor = geo.getAttribute("normal") as THREE.BufferAttribute;
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i += 3) {
    let nx = 0;
    let ny = 0;
    for (let k = 0; k < 3; k++) {
      nx += nor.getX(i + k);
      ny += nor.getY(i + k);
    }
    // top first so the roof/hood bevel crowns keep the stripes wrapping;
    // arch interiors + nose/tail faces fall through to the chips
    const region = ny >= 0.5 ? 0 : nx >= 0.5 ? 1 : nx <= -0.5 ? 2 : ny <= -0.5 ? 3 : 4;
    for (let k = 0; k < 3; k++) {
      const px = pos.getX(i + k);
      const py = pos.getY(i + k);
      const uz = (pos.getZ(i + k) + 2.67) / 5.34;
      let u: number;
      let v: number;
      if (region === 0) {
        u = 0.45 * uz;
        v = 0.5 + 0.5 * ((px + 0.99) / 1.98);
      } else if (region === 1) {
        u = 0.45 + 0.55 * (1 - uz);
        v = 0.5 + 0.5 * ((py - 0.24) / 1.09);
      } else if (region === 2) {
        u = 0.45 + 0.55 * uz;
        v = 0.5 * ((py - 0.24) / 1.09);
      } else if (region === 3) {
        u = 0.22; // underbody strip
        v = 0.125;
      } else {
        u = 0.22; // clean chip
        v = 0.375;
      }
      uv.setXY(i + k, u, v);
    }
  }
  uv.needsUpdate = true;
}

/** pin every UV of a small painted part to the clean chip — solid tint, no
 *  features. Box/cylinder default UVs would sample stripes/flank art at
 *  random and speckle the part. */
function pinUVs(geo: THREE.BufferGeometry, u = 0.22, v = 0.375): void {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, v);
  uv.needsUpdate = true;
}

/** build the muscle-car shell — extruded-profile silhouette, ~4.6 m long */
export function buildMuscleBody(color: string): MuscleBody {
  const maps = buildPaintMaps();
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    // night paint must reflect the neon city env or the body reads black
    envMapIntensity: 1.8,
  });
  if (maps) {
    paint.metalness = 1; // values live in the canvases
    paint.roughness = 1;
    paint.map = maps.map;
    paint.roughnessMap = maps.rough;
    paint.metalnessMap = maps.metal;
  } else {
    paint.metalness = 0.85;
    paint.roughness = 0.32;
  }
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
  //  panel edge (tumblehome at the roof, tapered hood/tail) for free ──
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
  assignShellUVs(geo);
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
  // the painted flank (x ±0.98) so they read as inset glass, not buried —
  // plus louver slats over the opera window (street-machine dress-up)
  const louverGeo = new THREE.BoxGeometry(0.025, 0.016, 0.54);
  for (const x of [0.965, -0.965]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.5), glass);
    door.position.set(x, 1.03, 0.12);
    root.add(door);
    const opera = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.56), glass);
    opera.position.set(x, 1.04, -0.62);
    root.add(opera);
    for (let i = 0; i < 4; i++) {
      const slat = new THREE.Mesh(louverGeo, dark);
      slat.position.set(x < 0 ? -1.005 : 1.005, 0.955 + i * 0.055, -0.62);
      slat.rotation.z = (x < 0 ? -1 : 1) * 0.62; // outboard edge up
      root.add(slat);
    }
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

  // ── front end: scoop, hood pins, grille, badge, bumper, chin ──
  const scoopGeo = new THREE.BoxGeometry(0.52, 0.07, 0.42);
  pinUVs(scoopGeo);
  const scoop = new THREE.Mesh(scoopGeo, paint);
  scoop.position.set(0, 0.855, 1.2);
  root.add(scoop);
  const scoopInlet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.05), dark);
  scoopInlet.position.set(0, 0.855, 1.39);
  root.add(scoopInlet);

  // hood pins ahead of the scoop — the "street" tell
  const pinCapGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.018, 12);
  const pinStemGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8);
  for (const x of [0.42, -0.42]) {
    const cap = new THREE.Mesh(pinCapGeo, chrome);
    cap.position.set(x, 0.752, 1.92);
    root.add(cap);
    const stem = new THREE.Mesh(pinStemGeo, dark);
    stem.position.set(x, 0.764, 1.92);
    root.add(stem);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.18, 0.08), dark);
  grille.position.set(0, 0.46, 2.585);
  root.add(grille);
  for (const y of [0.43, 0.5]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.025, 0.09), chrome);
    bar.position.set(0, y, 2.585);
    root.add(bar);
  }
  const grilleBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), chrome);
  grilleBadge.rotation.x = Math.PI / 2;
  grilleBadge.position.set(0, 0.47, 2.632);
  root.add(grilleBadge);
  // headlight recesses for the lamp quads Car.ts mounts at (±0.62, 0.48)
  for (const x of [0.62, -0.62]) {
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.06), dark);
    bezel.position.set(x, 0.48, 2.6);
    root.add(bezel);
  }

  // full-width chrome bumpers (70s street iron) — proud of the bevels, tucked
  // under the grille / tail panel; exhausts exit below the rear one
  const bumperGeo = new THREE.BoxGeometry(1.9, 0.12, 0.12);
  const frontBumper = new THREE.Mesh(bumperGeo, chrome);
  frontBumper.position.set(0, 0.34, 2.62);
  root.add(frontBumper);

  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.28), dark);
  splitter.position.set(0, 0.245, 2.52);
  root.add(splitter);

  // ── tail: ducktail spoiler, panel, bumper, plate, exhausts ──
  const spoilerGeo = new THREE.BoxGeometry(1.58, 0.05, 0.28);
  pinUVs(spoilerGeo);
  const spoiler = new THREE.Mesh(spoilerGeo, paint);
  spoiler.position.set(0, 1.0, -2.4);
  spoiler.rotation.x = 0.21; // rear edge swept up 12°
  root.add(spoiler);

  const tailPanel = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.2, 0.06), dark);
  tailPanel.position.set(0, 0.6, -2.615);
  root.add(tailPanel);

  const rearBumper = new THREE.Mesh(bumperGeo, chrome);
  rearBumper.position.set(0, 0.48, -2.63);
  root.add(rearBumper);

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.13, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xd8d8de, roughness: 0.6 }),
  );
  plate.position.set(0, 0.48, -2.7); // on the bumper face
  root.add(plate);

  // mirrors: painted heads (pinned to the chip) on dark stalks
  const mirrorGeo = new THREE.BoxGeometry(0.17, 0.09, 0.07);
  pinUVs(mirrorGeo);
  for (const x of [1.05, -1.05]) {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.11), dark);
    stalk.position.set(x, 0.855, 0.45);
    root.add(stalk);
    const head = new THREE.Mesh(mirrorGeo, paint);
    head.position.set(x, 0.885, 0.4);
    root.add(head);
  }

  // antenna on the front fender, leaned back 17°
  const antBase = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), dark);
  antBase.position.set(0.78, 0.8, 1.05);
  root.add(antBase);
  const antRod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.48, 6), chrome);
  antRod.position.set(0.78, 1.035, 1.006);
  antRod.rotation.x = -0.3;
  root.add(antRod);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), chrome);
  antTip.position.set(0.78, 1.264, 0.935);
  root.add(antTip);

  // ── per-flank trim: arch rings, side skirt, fender gills, chrome V badge ──
  const archTrimGeo = new THREE.TorusGeometry(0.455, 0.016, 8, 26, 3.35);
  archTrimGeo.rotateZ(-0.09); // arc spans -5°..187°: over the top of the arch
  archTrimGeo.rotateY(Math.PI / 2); // profile plane → arch plane (normal = x)
  const skirtGeo = new THREE.BoxGeometry(0.06, 0.1, 2.06);
  const gillGeo = new THREE.BoxGeometry(0.02, 0.028, 0.16);
  const vBarGeo = new THREE.BoxGeometry(0.014, 0.012, 0.13);
  for (const sx of [1, -1]) {
    for (const az of [ARCH_FRONT_Z, ARCH_REAR_Z]) {
      const ring = new THREE.Mesh(archTrimGeo, dark);
      ring.position.set(sx * 0.955, ARCH_CY, az);
      root.add(ring);
    }
    const skirt = new THREE.Mesh(skirtGeo, dark);
    skirt.position.set(sx * 0.94, 0.28, -0.03);
    root.add(skirt);
    for (let i = 0; i < 3; i++) {
      const gill = new THREE.Mesh(gillGeo, dark);
      gill.position.set(sx * 0.985, 0.6, 0.98 - i * 0.08);
      root.add(gill);
    }
    // chrome V badge on the front fender, opening toward the nose
    const v1 = new THREE.Mesh(vBarGeo, chrome);
    v1.position.set(sx * 0.985, 0.717, 0.905);
    v1.rotation.x = 0.49;
    root.add(v1);
    const v2 = new THREE.Mesh(vBarGeo, chrome);
    v2.position.set(sx * 0.985, 0.717, 0.995);
    v2.rotation.x = -0.49;
    root.add(v2);
  }

  // fuel cap on the rear flank (driver side), like a real filler neck
  const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 20), chrome);
  fuelCap.rotation.z = Math.PI / 2;
  fuelCap.position.set(-0.975, 0.74, -2.1);
  root.add(fuelCap);
  const capDot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.024, 12), dark);
  capDot.rotation.z = Math.PI / 2;
  capDot.position.set(-0.976, 0.74, -2.1);
  root.add(capDot);

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

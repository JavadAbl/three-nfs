// ─── Car registry: the single source of truth for the garage ────────────────
// Data-only module (no three.js import) so every subsystem — garage UI,
// model loader, AI pool, persistence, preloading — can import from here
// without cycles. ADDING A CAR = one entry below + the GLB in /public/models
// (+ optional tuning overrides). No other file should list car ids.
import { CAR_TUNING } from "../constants";

/** physics + feel knobs; defaults reproduce the legacy global tuning */
export interface CarTuning {
  /** max engine acceleration m/s² */
  enginePower: number;
  /** extra acceleration while nitro is engaged */
  nitroPower: number;
  /** fraction of natural top speed (enginePower/drag) over which the nitro
   *  boost fades to zero — nitro never raises top speed */
  nitroFadeSpan: number;
  /** brake deceleration m/s² */
  brakeForce: number;
  /** reverse acceleration */
  reversePower: number;
  maxSpeed: number; // m/s
  maxReverseSpeed: number;
  /** rolling + air drag combined damping per second */
  drag: number;
  offRoadDrag: number;
  /** base lateral grip (how quickly lateral velocity is killed) */
  grip: number;
  driftGrip: number; // while handbraking
  /** max steering yaw rate rad/s at optimal speed */
  steerRate: number;
  /** speed where steering begins to tighten (m/s) */
  steerFalloffStart: number;
  /** fraction of steerRate at top speed */
  steerFalloffMin: number;
  /** lateral grip budget m/s² — the v·ω yaw cap (see CAR_TUNING.maxLatAccel) */
  maxLatAccel: number;
  /** downforce illusion — lateral budget growth 0→top speed
   *  (see CAR_TUNING.latAccelSpeedBoost) */
  latAccelSpeedBoost: number;
  nitroCapacity: number;
  nitroDrain: number; // per second
  nitroRegen: number; // passive per second
  /** drift points → nitro conversion rate */
  driftNitroGain: number;
  /** relative collision mass (1 = baseline) — impulse + separation weighting */
  mass: number;
}

/** per-entry deltas — anything unspecified falls back to the default */
export type CarTuningOverride = Partial<CarTuning>;

export const DEFAULT_CAR_TUNING: CarTuning = { ...CAR_TUNING, mass: 1 };

export interface CarDef {
  id: string;
  name: string;
  /** short chip label for the garage selector (GT-R / TT RS / SRT10 …) */
  short: string;
  /** null → procedural body (no GLB) */
  modelUrl: string | null;
  /** garage subtitle */
  spec: string;
  /** NFS class — sets the tuning bands + garage badge (see CLASS BANDS below) */
  class: CarClass;
  /** physics deltas over DEFAULT_CAR_TUNING (unspecified = default) */
  tuning?: CarTuningOverride;
}

// ─── class system ────────────────────────────────────────────────────────────
// 2026-11-01 normalization (user directive): specs follow the class, not the
// car's real-world résumé. Solved + validated by scripts/specs_calib.ts
// (analytic drag ODE cross-checked against the discrete integrator), which
// also asserts the strict class invariants:
//   accel:   muscle (0-100 2.28-2.47s, bars 81-97) > exotic (2.50-2.57s, 71-76)
//            > tuner (2.87-3.17s, 14-43)
//   handling: tuner (79-91) > exotic (63-69) > muscle (13-41)
//   top:      exotic (298-305 km/h, 92-94) > muscle (285-298, 70-86)
//            > tuner (240-265, 16-46)
// Identity inside the bands: MUSCLE = classic drift-king (fastest launch,
// wildest tail), SRT10 wild tail, C7 RWD bruiser, C6.R race-bred → top of
// the muscle handling band. TUNER = R5 twitchy lightest + fastest steering,
// R34 planted, TT RS nimble AWD. EXOTIC = ACR the fleet's best overall,
// GT-R right behind.
export type CarClass = "muscle" | "tuner" | "exotic";

/** garage-facing class metadata (badge label + NFS-Carbon-style colour) */
export const CAR_CLASS_META: Record<CarClass, { label: string; color: string }> = {
  muscle: { label: "MUSCLE", color: "#f87171" }, // red
  tuner: { label: "TUNER", color: "#38bdf8" }, // cyan
  exotic: { label: "EXOTIC", color: "#fbbf24" }, // gold
};

export const CAR_LIBRARY: CarDef[] = [
  {
    id: "gtr",
    name: "NISSAN GT-R R35",
    short: "GT-R",
    modelUrl: "/models/nissan-gtr-r35.glb",
    spec: "NISMO · 600 HP",
    class: "exotic",
    tuning: { enginePower: 13.22, drag: 0.157, maxSpeed: 88.2, grip: 7.4, steerRate: 2.1, maxLatAccel: 27.2, mass: 1.15 },
  },
  {
    id: "audi",
    name: "AUDI TT RS",
    short: "TT RS",
    modelUrl: "/models/audi-tt-rs-2010.glb",
    spec: "QUATTRO · 400 HP",
    class: "tuner",
    tuning: { enginePower: 11.82, drag: 0.17, maxSpeed: 73.4, grip: 7.9, steerRate: 2.35, maxLatAccel: 27.5, mass: 0.95 },
  },
  {
    id: "viper08",
    name: "VIPER SRT10 '08",
    short: "SRT10",
    modelUrl: "/models/viper-srt10-2008.glb",
    spec: "V10 · 600 HP",
    class: "muscle",
    tuning: { enginePower: 14.13, drag: 0.172, maxSpeed: 85.9, grip: 6.0, steerRate: 1.85, maxLatAccel: 24.5, mass: 1.05 },
  },
  {
    id: "viper16",
    name: "VIPER ACR '16",
    short: "ACR",
    modelUrl: "/models/viper-acr-2016.glb",
    spec: "V10 · 645 HP · ACR",
    class: "exotic",
    tuning: { enginePower: 13.46, drag: 0.159, maxSpeed: 88.7, grip: 7.5, steerRate: 2.15, maxLatAccel: 28, mass: 1.0 },
  },
  {
    // accepted 2026-11-01: KTX2/ETC1S baseColor + Draco meshes via
    // scripts/m4_compress.sh (22.5MB raw → 2.7MB). Raw original kept in
    // public/models/staging/ (gitignored) for regeneration.
    id: "m4",
    name: "BMW M4 COMPETITION",
    short: "M4",
    modelUrl: "/models/bmw-m4-competition-g82.glb",
    spec: "G82 · WIDEBODY · 510 HP",
    class: "exotic",
    tuning: { enginePower: 13.4, drag: 0.16, maxSpeed: 87.6, grip: 7.45, steerRate: 2.12, maxLatAccel: 27.6, mass: 1.1 },
  },
  {
    id: "elegy",
    name: "SKYLINE GT-R R34",
    short: "R34",
    modelUrl: "/models/skyline-gtr-r34.glb",
    spec: "RB26 · TWIN TURBO",
    class: "tuner",
    tuning: { enginePower: 12.24, drag: 0.166, maxSpeed: 77.6, grip: 8.0, steerRate: 2.2, maxLatAccel: 28.5, mass: 1.05 },
  },
  {
    // ACCEPTED (2026-11-03): Izzy NFS:MW RX-8, compressed via the KTX
    // pipeline (3.54MB → 859KB, Draco + basisu). Raw original kept in
    // public/models/staging/ for regeneration. Tuning solved by specs_calib.
    id: "rx8",
    name: "MAZDA RX-8",
    short: "RX-8",
    modelUrl: "/models/mazda-rx-8-nfsmw.glb",
    spec: "13B MSP · ROTARY",
    class: "tuner",
    tuning: { enginePower: 12.05, drag: 0.175, maxSpeed: 72.9, grip: 8.0, steerRate: 2.3, maxLatAccel: 28.2, mass: 0.88 },
  },
  {
    id: "r5",
    name: "RENAULT 5 GT TURBO",
    short: "R5",
    modelUrl: "/models/renault-5-turbo.glb",
    spec: "1.4 L · GT TURBO",
    class: "tuner",
    tuning: { enginePower: 11.41, drag: 0.171, maxSpeed: 70.7, grip: 8.2, steerRate: 2.5, maxLatAccel: 29, mass: 0.82 },
  },
  {
    id: "c7",
    name: "CHEVROLET CORVETTE C7",
    short: "C7",
    modelUrl: "/models/chevrolet-corvette-c7.glb",
    spec: "LT1 V8 · 460 HP",
    class: "muscle",
    tuning: { enginePower: 13.94, drag: 0.175, maxSpeed: 83.7, grip: 6.3, steerRate: 1.9, maxLatAccel: 25.2, mass: 1.05 },
  },
  {
    id: "c6r",
    name: "CORVETTE C6.R '10",
    short: "C6.R",
    modelUrl: "/models/corvette-c6r-2010.glb",
    spec: "GT2 · 6.0 V8",
    class: "muscle",
    tuning: { enginePower: 14.59, drag: 0.176, maxSpeed: 86.8, grip: 6.5, steerRate: 1.95, maxLatAccel: 26, mass: 1.08 },
  },
  {
    id: "classic",
    name: "STREET MUSCLE",
    short: "MUSCLE",
    modelUrl: null,
    spec: "V8 · PROCEDURAL",
    class: "muscle",
    tuning: { enginePower: 15.0, drag: 0.19, maxSpeed: 83.2, grip: 5.6, steerRate: 1.75, maxLatAccel: 23.5, mass: 1.1 },
  },
];

export function carDef(id: string): CarDef | undefined {
  return CAR_LIBRARY.find((c) => c.id === id);
}

/** fallback car when a persisted/foreign id no longer resolves */
export const DEFAULT_CAR_ID = "gtr";

/** map any id (localStorage, network peers, stale payloads) onto a real car */
export function resolveCarId(raw: string | null | undefined): string {
  const id = raw ?? "";
  return carDef(id)?.id ?? DEFAULT_CAR_ID;
}

/** fully-resolved tuning for a car id (defaults merged with the entry's deltas) */
export function resolveCarTuning(id: string | undefined): CarTuning {
  return { ...DEFAULT_CAR_TUNING, ...carDef(id ?? "")?.tuning };
}

/** car ids AI rivals rotate through (every garage car is AI-eligible) */
export const AI_POOL_IDS: string[] = CAR_LIBRARY.map((c) => c.id);

/** ids worth preloading before a race driven with the given player car */
export function preloadCarIds(playerCarId: string): string[] {
  return [playerCarId, ...AI_POOL_IDS.filter((id) => id !== playerCarId)];
}

// ─── display aliases + NFS-Carbon-style 3 specs (garage UI layer) ──────────

/** garage-facing alias of the catalog (RideSelect / lobby read this) */
export const CARS = CAR_LIBRARY;
export const carEntry = carDef;

/** normalized 0..100 display values — pure presentation, derived from
 *  tuning, never written by hand */
export interface CarStats {
  topSpeed: number;
  accel: number;
  handling: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const pct = (v: number) => Math.round(clamp01(v) * 100);

export function statsOf(t: CarTuning): CarStats {
  // Bars derive from what the physics ACTUALLY gives the player — the
  // natural top speed (enginePower/drag, the real ceiling) and the analytic
  // 0-100 time of the drag ODE — not the safety wall. Windows span the
  // 2026-11-01 normalized fleet (240-305 km/h, 2.25-3.3s 0-100) so bars
  // read as game-relative position, NFS-garage style.
  const naturalTop = t.enginePower / t.drag; // m/s — the real ceiling
  const v100 = 100 / 3.6;
  const t100 =
    naturalTop > v100 + 1 ? (1 / t.drag) * Math.log(naturalTop / (naturalTop - v100)) : 9.9;
  return {
    topSpeed: pct((naturalTop - 63) / 23), // 240→305 km/h window
    accel: pct((3.3 - t100) / 1.05), // 3.3s→2.25s 0-100 window
    // handling includes the lateral-grip budget — with the v·ω yaw cap
    // in place, maxLatAccel is what actually separates stiff from planted
    // at race speeds, so the bar must reflect it
    handling: pct(
      0.45 * clamp01((t.grip - 5.2) / 3.4) +
        0.25 * clamp01((t.steerRate - 1.7) / 0.7) +
        0.3 * clamp01((t.maxLatAccel - 22) / 8)
    ),
  };
}

export function carStats(id: string): CarStats {
  return statsOf(resolveCarTuning(id));
}

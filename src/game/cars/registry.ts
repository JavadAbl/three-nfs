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
  /** physics deltas over DEFAULT_CAR_TUNING (unspecified = default) */
  tuning?: CarTuningOverride;
}

// Initial values are first-pass, balanced by feel — tune here, nowhere else.
// Identity: GT-R = AWD launch monster, TT RS = nimble, SRT10 = wild tail,
// ACR = track weapon, Muscle = drift king.
export const CAR_LIBRARY: CarDef[] = [
  {
    id: "gtr",
    name: "NISSAN GT-R R35",
    short: "GT-R",
    modelUrl: "/models/nissan-gtr-r35.glb",
    spec: "NISMO · 600 HP",
    tuning: { enginePower: 15.5, grip: 8.0, steerRate: 2.0, mass: 1.15 },
  },
  {
    id: "audi",
    name: "AUDI TT RS",
    short: "TT RS",
    modelUrl: "/models/audi-tt-rs.glb",
    spec: "QUATTRO · 400 HP",
    tuning: { enginePower: 12.5, grip: 7.6, steerRate: 2.3, mass: 0.95 },
  },
  {
    id: "viper08",
    name: "VIPER SRT10 '08",
    short: "SRT10",
    modelUrl: "/models/viper-srt10-2008.glb",
    spec: "V10 · 600 HP",
    tuning: { enginePower: 16.5, grip: 6.4, steerRate: 1.9, mass: 1.05 },
  },
  {
    id: "viper16",
    name: "VIPER ACR '16",
    short: "ACR",
    modelUrl: "/models/viper-acr-2016.glb",
    spec: "V10 · 645 HP · ACR",
    tuning: { enginePower: 17.0, grip: 7.4, steerRate: 2.15 },
  },
  {
    id: "classic",
    name: "STREET MUSCLE",
    short: "MUSCLE",
    modelUrl: null,
    spec: "V8 · PROCEDURAL",
    tuning: { enginePower: 15.0, grip: 5.8, steerRate: 1.8, mass: 1.1 },
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
  return {
    topSpeed: pct((t.maxSpeed - 56) / 22),
    accel: pct((t.enginePower - 12.5) / 6),
    handling: pct(0.55 * clamp01((t.grip - 5.2) / 3.4) + 0.45 * clamp01((t.steerRate - 1.7) / 0.7)),
  };
}

export function carStats(id: string): CarStats {
  return statsOf(resolveCarTuning(id));
}

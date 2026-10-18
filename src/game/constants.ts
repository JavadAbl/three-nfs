// ─── THREE-NFS global configuration & tuning ────────────────────────────────
// All physics values are SI units (metres, seconds) unless noted.

export const GAME_CONFIG = {
  /** Track samples used for nearest-point queries (resolution of progress) */
  TRACK_SAMPLES: 700,
  /** How many checkpoints the lap is split into (index 0 = start/finish) */
  CHECKPOINTS: 14,
  /** Road half width in metres */
  ROAD_HALF_WIDTH: 8,
  /** Laps per race */
  LAPS: 3,
  /** Offline AI opponents */
  AI_COUNT: 3,
} as const;

// Baseline physics shared by every car — per-car deltas live in
// src/game/cars/registry.ts (CarDef.tuning) and merge over these values.
export const CAR_TUNING = {
  /** Max engine acceleration m/s² */
  enginePower: 14.5,
  /** Extra acceleration while nitro is engaged */
  nitroPower: 16,
  /** Brake deceleration m/s² */
  brakeForce: 26,
  /** Reverse acceleration */
  reversePower: 6,
  maxSpeed: 72, // m/s ≈ 259 km/h
  maxReverseSpeed: 12,
  /** Rolling + air drag combined damping per second */
  drag: 0.38,
  offRoadDrag: 1.8,
  /** Base lateral grip (how quickly lateral velocity is killed) */
  grip: 7.2,
  driftGrip: 1.7, // while handbraking
  /** Max steering yaw rate rad/s at optimal speed */
  steerRate: 2.1,
  /** Speed where steering begins to tighten (m/s) */
  steerFalloffStart: 18,
  steerFalloffMin: 0.42, // fraction of steerRate at top speed
  nitroCapacity: 100,
  nitroDrain: 34, // per second
  nitroRegen: 3.5, // passive per second
  /** Drift points → nitro conversion rate */
  driftNitroGain: 0.05,
} as const;

export const AI_TUNING = {
  /** Skill variance between AI racers 0..1 */
  skillRange: [0.78, 0.94] as [number, number],
  /** Lookahead distance along spline in metres */
  lookahead: 22,
  /** Rubber-band strength: speed bonus multiplier range */
  rubberBand: { behind: 1.08, ahead: 0.94 },
} as const;

/** NFS-Carbon-flavoured night palette */
export const PALETTE = {
  asphalt: 0x14151a,
  roadLine: 0xd8d8d8,
  roadEdge: 0xe8b23a,
  fog: 0x0b0a0c,
  sky: 0x07070a,
  ground: 0x0a0a0b,
  buildingA: 0x15161c,
  buildingB: 0x111014,
  buildingC: 0x17140f,
  windowWarm: "#ffcf8a",
  windowCool: "#b9d4e8",
  lamp: 0xffc873,
  finishPrimary: 0xf59e0b,
} as const;

/** Car paint choices offered in the garage */
export const CAR_COLORS = [
  { name: "Sunburst", value: "#f59e0b" },
  { name: "Ember", value: "#ea580c" },
  { name: "Blood", value: "#dc2626" },
  { name: "Toxic", value: "#84cc16" },
  { name: "Frost", value: "#e2e8f0" },
  { name: "Shadow", value: "#27272a" },
  { name: "Candy", value: "#db2777" },
  { name: "Mint", value: "#14b8a6" },
] as const;

/** Circuit control points [x, y (elevation), z] — a flowing night circuit */
export const TRACK_POINTS: [number, number, number][] = [
  [0, 0, 0],
  [70, 0, -6],
  [140, 1, -26],
  [188, 3, -74],
  [196, 5, -140],
  [160, 6, -198],
  [104, 7, -232],
  [40, 6, -238],
  [-14, 5, -216],
  [-46, 4, -170],
  [-72, 3, -122],
  [-118, 4, -96],
  [-172, 5, -108],
  [-212, 6, -152],
  [-246, 5, -196],
  [-296, 3, -178],
  [-318, 2, -120],
  [-300, 1, -62],
  [-244, 0, -26],
  [-180, 0, -8],
  [-110, 0, 2],
  [-52, 0, 4],
];

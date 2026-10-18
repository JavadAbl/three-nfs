// ─── Map registry: the single source of truth for circuits ──────────────────
// Data-only module (no three.js import) so every subsystem — track builder,
// environment, game core, menu UI, persistence, records API — can import from
// here without cycles. ADDING A MAP = one entry below (+ optional palette /
// envTheme / geometry overrides). No other file should list map ids.
import { PALETTE } from "../constants";

/** full look of a map's world — unspecified keys inherit the night defaults */
export interface MapPalette {
  asphalt: number;
  roadLine: number;
  roadEdge: number;
  fog: number;
  sky: number;
  ground: number;
  buildingA: number;
  buildingB: number;
  buildingC: number;
  windowWarm: string;
  windowCool: string;
  lamp: number;
  finishPrimary: number;
}

/** per-map deltas — anything unspecified falls back to the global night palette */
export type MapPaletteOverride = Partial<MapPalette>;

/** city furniture knobs — one named theme per environment style */
export interface EnvThemeSpec {
  id: string;
  /** grid radius (metres) that building candidates spawn within */
  range: number;
  /** building grid spacing */
  spacing: number;
  /** keep-clear corridor around the track centreline */
  clearance: number;
  /** candidate position jitter */
  jitter: number;
  /** building height = min + rand*rand*span (skews low, occasional towers) */
  minHeight: number;
  heightSpan: number;
  /** building footprint = minW + rand*widthSpan */
  minWidth: number;
  widthSpan: number;
  groundColor: number;
  buildingColors: [number, number, number];
  windowWarm: string;
  windowCool: string;
  windowAccent: string;
  neonColors: number[];
  starCount: number;
  neonCount: number;
  /** optional shipping-container stacks near the corridor (harbor/industrial) */
  containers?: ContainerSpec;
  /** optional gantry cranes (harbor) */
  cranes?: CraneSpec;
}

/** container-yard dressing — boxes stacked near the corridor (harbor/industrial) */
export interface ContainerSpec {
  count: number;
  colors: number[];
}

/** harbour gantry cranes running parallel to the circuit */
export interface CraneSpec {
  count: number;
  /** rail-to-beam height in metres */
  height: number;
  /** beam length in metres (runs parallel to the track) */
  boom: number;
}

/** named environment themes — a map picks one via MapDef.envTheme */
export const ENV_THEMES: Record<string, EnvThemeSpec> = {
  // exact values of the original procedural city (regression-safe default)
  city: {
    id: "city",
    range: 460,
    spacing: 34,
    clearance: 26,
    jitter: 14,
    minHeight: 14,
    heightSpan: 92,
    minWidth: 12,
    widthSpan: 16,
    groundColor: PALETTE.ground,
    buildingColors: [PALETTE.buildingA, PALETTE.buildingB, PALETTE.buildingC],
    windowWarm: PALETTE.windowWarm,
    windowCool: PALETTE.windowCool,
    windowAccent: "#ffd9a0",
    neonColors: [0xf59e0b, 0xff5e3a, 0xff2d78, 0x22d3a7],
    starCount: 900,
    neonCount: 10,
  },
  // container port: low wide warehouses, sodium lamps, hazier sky,
  // container stacks + gantry cranes near the corridor
  harbor: {
    id: "harbor",
    range: 430,
    spacing: 46,
    clearance: 30,
    jitter: 8,
    minHeight: 7,
    heightSpan: 26,
    minWidth: 20,
    widthSpan: 26,
    groundColor: 0x0b0d10,
    buildingColors: [0x241d1a, 0x1a2026, 0x201a12],
    windowWarm: "#ffb066",
    windowCool: "#c8dce8",
    windowAccent: "#ff8748",
    neonColors: [0xff8c1a, 0xff3355, 0x2dd4bf, 0xffb020],
    starCount: 420,
    neonCount: 6,
    containers: { count: 130, colors: [0xb4402f, 0x2e5f8a, 0x3f6b4f, 0x8a8f98, 0xb07a2a] },
    cranes: { count: 7, height: 34, boom: 42 },
  },
};

export const DEFAULT_ENV_THEME = "city";

/** one circuit — geometry, look and race format (deltas over the defaults) */
export interface MapDef {
  id: string;
  /** menu display name */
  name: string;
  /** menu subtitle */
  description: string;
  /** closed-loop control points [x, y (elevation), z] */
  points: [number, number, number][];
  /** road half width in metres (default GAME_CONFIG.ROAD_HALF_WIDTH) */
  roadHalfWidth?: number;
  /** spline sample count (default GAME_CONFIG.TRACK_SAMPLES) */
  samples?: number;
  /** lap checkpoint gates (default GAME_CONFIG.CHECKPOINTS) */
  checkpoints?: number;
  /** laps offered for quick races (default GAME_CONFIG.LAPS) */
  defaultLaps?: number;
  /** road/sky/fog look deltas */
  palette?: MapPaletteOverride;
  /** environment theme id (default "city") */
  envTheme?: string;
}

// The launch circuit — exact geometry of the former global TRACK_POINTS.
// Identity: flowing downtown loop, wide sweepers, mild elevation, short chute.
export const MAP_LIBRARY: MapDef[] = [
  {
    id: "downtown",
    name: "DOWNTOWN NEON",
    description: "Flowing night loop · wide sweepers",
    points: [
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
    ],
  },
  {
    id: "harbor",
    name: "HARBOR DOCKS",
    description: "Container port · long straights, tight hairpin",
    envTheme: "harbor",
    // port service roads are wide — room to trade paint on the straights
    roadHalfWidth: 9,
    samples: 720,
    checkpoints: 16,
    palette: {
      asphalt: 0x14161b,
      fog: 0x0a0d12,
      sky: 0x05070c,
      ground: 0x0b0d10,
      // sodium-vapour yard lighting
      lamp: 0xffb066,
      finishPrimary: 0x38bdf8,
    },
    points: [
      [0, 0, 0],
      [110, 0, -3],
      [205, 0, -18],
      [252, 1, -70],
      [256, 2, -138],
      [218, 2, -190],
      [130, 1, -214],
      [40, 1, -226],
      [-50, 0, -216],
      [-110, 0, -244],
      [-148, 0, -272],
      [-186, 0, -244],
      [-206, 1, -196],
      [-238, 2, -130],
      [-242, 2, -70],
      [-224, 3, -14],
      [-150, 3, -30],
      [-92, 2, -14],
      [-44, 1, -26],
      [-18, 0, -10],
    ],
  },
  {
    // ported from the local menu line — big-elevation GP circuit
    id: "skyline",
    name: "SKYLINE GP",
    description: "2.9 KM · fast sweepers · big climbs",
    points: [
      [0, 0, 0],
      [90, 0, -10],
      [170, 2, -44],
      [210, 5, -110],
      [200, 8, -190],
      [140, 10, -240],
      [60, 10, -260],
      [-20, 8, -250],
      [-80, 6, -208],
      [-140, 6, -160],
      [-210, 7, -170],
      [-270, 6, -206],
      [-310, 4, -160],
      [-320, 3, -92],
      [-285, 2, -30],
      [-220, 1, 4],
      [-140, 0, 14],
      [-70, 0, 10],
    ],
  },
];

export const DEFAULT_MAP_ID = "downtown";

export function mapDef(id: string | undefined): MapDef | undefined {
  return MAP_LIBRARY.find((m) => m.id === id);
}

// ─── display aliases (menu / lobby / browser UI layer) ─────────────────────
export type MapEntry = MapDef;
export const MAPS = MAP_LIBRARY;
export const mapEntry = mapDef;

/** resolve a persisted/foreign id onto a map that exists (fallback: default) */
export function resolveMapId(raw: string | null | undefined): string {
  const id = raw ?? DEFAULT_MAP_ID;
  return mapDef(id) ? id : DEFAULT_MAP_ID;
}

/** fully-resolved palette for a map (defaults merged with the entry's deltas) */
export function resolveMapPalette(def: MapDef): MapPalette {
  return { ...PALETTE, ...def.palette } as MapPalette;
}

/** environment theme spec for a map (unknown ids fall back to the city) */
export function resolveEnvTheme(def: MapDef): EnvThemeSpec {
  return ENV_THEMES[def.envTheme ?? DEFAULT_ENV_THEME] ?? ENV_THEMES[DEFAULT_ENV_THEME];
}

/** rough circuit length in km from the control-point polyline (menu display) */
export function approxTrackKm(points: [number, number, number][]): number {
  let len = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return Math.round((len / 1000) * 10) / 10;
}

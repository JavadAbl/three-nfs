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
];

export const DEFAULT_MAP_ID = "downtown";

export function mapDef(id: string | undefined): MapDef | undefined {
  return MAP_LIBRARY.find((m) => m.id === id);
}

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

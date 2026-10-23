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
  finishPrimary: number;
}

/** per-map deltas — anything unspecified falls back to the global night palette */
export type MapPaletteOverride = Partial<MapPalette>;

/** per-theme scanned ground set — every map gets its own terrain, so the
 *  empty lots read as the right material for the district (user: "each map
 *  should has its own ground texture"). Sources: Poly Haven CC0 2K PBR.
 *  Night recipe shared with the road scan: the color map is its own albedo,
 *  tint + self-glow keep it readable under ACES at night. */
export interface GroundSpec {
  /** texture dir: /textures/ground/<dir> (accepted) and staging twin (pending) */
  dir: string;
  /** color / OpenGL-normal / roughness file names inside the dir */
  files: [string, string, string];
  /** night tint multiplied into the scan (darker/earthier = dimmer lots) */
  tint: number;
  /** self-glow floor for night readability — dimmer than the road's 0.34 so
   *  the tarmac stays the hero surface */
  emissive: number;
  /** albedo tile reps over the 2200 m ground plane (≈18 m per tile at 122) */
  reps: number;
  /** normal/rough layers tile + rotate off the albedo grid (anti-wallpaper) */
  normalReps: number;
  roughReps: number;
}

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
  /** real-model city scatter tuning (defaults inlined at read site) */
  modelCity?: ModelCitySpec;
  /** the theme's own scanned ground set */
  ground: GroundSpec;
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

/** real-model city scatter tuning (CityModels upgrade) */
export interface ModelCitySpec {
  /** scatter grid spacing in metres (sparser than the old box grid) */
  modelSpacing: number;
  /** landmark hero count on the far fog ring (0 = none) */
  heroCount: number;
  /** tallest allowed filler in metres — keeps the harbor low-rise */
  maxTowerHeight: number;
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
    modelCity: { modelSpacing: 52, heroCount: 6, maxTowerHeight: 200 },
    // worn concrete plaza (Poly Haven concrete_floor_worn_001) — city lots
    // read as cracked pavement, cool grey so neon reflections stay the star.
    // 0x77747a + 0.30 read flat/dark to VLM; brighter keeps the plaza a
    // readable surface, not a near-void
    ground: {
      dir: "city",
      files: ["city-2k-color.jpg", "city-2k-normal.jpg", "city-2k-rough.jpg"],
      tint: 0x8a878f,
      emissive: 0.32,
      reps: 100,
      normalReps: 141,
      roughReps: 124,
    },
  },
  // neon touge district: dense low-rise street canyon, magenta/violet neon —
  // the curvy tuner map's backdrop. Denser grid + shorter buildings than
  // the city theme so the esses read as tight streets, not tower avenues
  touge: {
    id: "touge",
    range: 420,
    spacing: 30,
    clearance: 26,
    jitter: 10,
    minHeight: 9,
    heightSpan: 55,
    minWidth: 11,
    widthSpan: 12,
    groundColor: 0x0e0a12,
    buildingColors: [0x181420, 0x141019, 0x1a1410],
    windowWarm: "#ff9ed2",
    windowCool: "#c8d8f0",
    windowAccent: "#ff6ec7",
    neonColors: [0xe879f9, 0xff2d78, 0x7c6cf0, 0x22d3a7],
    starCount: 700,
    neonCount: 16,
    modelCity: { modelSpacing: 46, heroCount: 3, maxTowerHeight: 120 },
    // dry dirt + rock grain (Poly Haven aerial_ground_rock) — the touge's
    // mountain-pass shoulder; earthier + one notch dimmer than the road
    ground: {
      dir: "touge",
      files: ["touge-2k-color.jpg", "touge-2k-normal.jpg", "touge-2k-rough.jpg"],
      tint: 0x55483c,
      emissive: 0.28,
      reps: 122,
      normalReps: 173,
      roughReps: 151,
    },
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
    modelCity: { modelSpacing: 64, heroCount: 0, maxTowerHeight: 70 },
    containers: { count: 130, colors: [0xb4402f, 0x2e5f8a, 0x3f6b4f, 0x8a8f98, 0xb07a2a] },
    cranes: { count: 7, height: 34, boom: 42 },
    // packed gravel yard (Poly Haven gravel_floor) — dock lots are coarse
    // grey gravel between the container stacks; dimmest of the three so the
    // sodium-lamp harbor keeps its moody contrast
    ground: {
      dir: "harbor",
      files: ["harbor-2k-color.jpg", "harbor-2k-normal.jpg", "harbor-2k-rough.jpg"],
      tint: 0x5a544d,
      emissive: 0.26,
      reps: 130,
      normalReps: 184,
      roughReps: 161,
    },
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
    // replaces SKYLINE GP (too close to DOWNTOWN NEON). Identity: maximum
    // curve density — validated by scripts/track_check.cjs against the
    // game's exact spline: 14 corners vs downtown 4 / harbor 12, 65% of the
    // lap under 120 m radius, tightest corner 15 m (harbor's shipped hairpin
    // is 14 m). Esses → carousel → double-apex hairpin → kink rhythm
    // section → final carousel. Tuner territory: the lap is won in the
    // corners, not on the straights.
    id: "touge",
    name: "NEON TOUGE",
    description: "Twisty neon streets · 14 corners · esses + hairpin",
    envTheme: "touge",
    palette: {
      // violet-magenta drift vibe, distinct from downtown's blue-violet night
      asphalt: 0x16131c,
      fog: 0x3a2545,
      sky: 0x0a0510,
      ground: 0x0e0a12,
      finishPrimary: 0xe879f9,
    },
    points: [
      [0, 0, 0],
      [55, 0, -5],
      [110, 1, -18], // right sweep opens
      [150, 2, -55],
      [145, 3, -100], // S1: bend back left
      [100, 4, -125],
      [55, 5, -100], // S2: ess right
      [15, 5, -125],
      [10, 5, -170], // carousel down the left
      [50, 6, -205],
      [105, 6, -215],
      [150, 5, -245], // kink right
      [210, 4, -245],
      [250, 4, -282], // hairpin apex 1 (right)
      [242, 4, -322], // hairpin apex 2
      [192, 3, -340],
      [130, 3, -318], // rhythm section: left/right/left kinks
      [88, 3, -300],
      [42, 3, -322],
      [-4, 3, -298],
      [-50, 2, -312],
      [-95, 1, -330], // big left carousel
      [-140, 1, -300],
      [-130, 1, -255],
      [-96, 1, -210], // return: right sweeper
      [-76, 2, -160], // flowing NE over the crest
      [-112, 2, -118], // left sweeper
      [-158, 2, -98], // final carousel apex 1 (right)
      [-158, 2, -58], // final carousel apex 2
      [-100, 1, -28], // exit onto the straight
      [-42, 0, -8],
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

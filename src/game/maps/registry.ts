// ─── Map registry: the single source of truth for circuits ──────────────────
// Data-only module (no three.js import) so every subsystem — track builder,
// environment, game core, menu UI, persistence, records API — can import from
// here without cycles. ADDING A MAP = one entry below (+ optional palette /
// envTheme / geometry overrides). No other file should list map ids.
import { PALETTE } from "../constants";
import { SPA_POINTS, SPA_TERRAIN, SPA_GROUND_EXTENT } from "./spa_generated";
import { ISLAND_POINTS, ISLAND_TERRAIN, ISLAND_GROUND_EXTENT } from "./island_generated";

/** off-road base terrain: a coarse height grid rasterized from a scanned
 *  real-world model (see spa_generated.ts). terrainHeightAt() bilinearly
 *  samples it for every query outside the road corridor, so hills, valleys
 *  and the road's cuttings/embankments all sit at real elevations. */
export interface BaseTerrainSpec {
  /** grid half-extent in metres (grid spans [-half, half] on both axes) */
  half: number;
  /** cell size in metres; grid side = 2*half/cell + 1 nodes, row-major,
 *    z from -half (row 0), x fastest */
  cell: number;
  heights: number[];
}

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

/** island dressing — replaces the city grid entirely (IslandEnvironment) */
export interface IslandSpec {
  /** sea level: the water plane's y (terrain crosses it at the waterline) */
  waterLevel: number;
  /** palms ringed along the corridor + scattered inland (3 instanced protos) */
  palms: number;
  /** shoreline + corridor rocks (3 instanced displaced-icosahedron protos) */
  rocks: number;
  /** far horizon mountain-islands on the water (fogged ridged silhouettes) */
  islets: number;
  /** channel buoys bobbing in the shallows */
  buoys: number;
  /** interior mountain count (heightfield massifs in the island core) */
  mountains: number;
  /** coastal headland massifs — a mountain ring along the waterline */
  coastMountains: number;
  /** conifers — groves clumped on the massif slopes + inland scatter */
  conifers: number;
  /** lowland fern rosettes */
  ferns: number;
  /** dry-lowland shrubs */
  shrubs: number;
  /** grass tufts fringing the corridor */
  tufts: number;
}

/** city furniture knobs — one named theme per environment style */
export interface EnvThemeSpec {
  id: string;
  /** time of day the map plays in. Default (unset) = the game's night.
   * "day" rerigs everything the night look hangs on: scene lights, fog
   * density, exposure, IBL env, stars, headlight beams, the night
   * emissive-lifts on road/ground/imported scenery (Game.ts / Track.ts /
   * CityEnvironment.ts / SpaScene.ts all branch on this one flag). */
  timeOfDay?: "night" | "day";
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
  /** the theme brings its own imported scenery GLB (placed by
   * world/SpaScene.ts): procedural boxes AND the city-model scatter are
   * skipped — the file's forests/barriers/buildings ARE the environment */
  sceneGlb?: string;
  /** tropical island build: water plane + palms + rocks + islets + buoys
   *  INSTEAD of any city (IslandEnvironment.ts) */
  island?: IslandSpec;
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
    // packed dirt lots (ambientCG Ground086 — dirt/forest/stones path) —
    // downtown's empty blocks read as bare earth between towers. Warm brown,
    // brighter than the touge so neon reflections stay the star. Poly Haven
    // concrete plaza was swapped per user request for ambientCG picks
    ground: {
      dir: "city",
      files: ["city-2k-color.jpg", "city-2k-normal.jpg", "city-2k-rough.jpg"],
      tint: 0x8a7a68,
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
    // short grass (ambientCG Grass005 — clean lawn) — the touge's
    // mountain-pass shoulders; green but darkened to sit under the
    // violet/magenta night without fighting the neon
    ground: {
      dir: "touge",
      files: ["touge-2k-color.jpg", "touge-2k-normal.jpg", "touge-2k-rough.jpg"],
      tint: 0x52604a,
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
    // rocky ground (ambientCG Rock030 — grey cliff/stone) — the port's
    // craggy back lots; neutral grey, dimmest of the three so the
    // sodium-lamp harbor keeps its moody contrast
    ground: {
      dir: "harbor",
      files: ["harbor-2k-color.jpg", "harbor-2k-normal.jpg", "harbor-2k-rough.jpg"],
      tint: 0x6e6a66,
      emissive: 0.26,
      reps: 130,
      normalReps: 184,
      roughReps: 161,
    },
  },
  // ardennes forest night: the real-circuit map's backdrop — sparse low
  // farmhouses/village lights scattered through dark pine woods, sodium-warm
  // windows, zero neon billboards (a forest has no arcades) and the deepest
  // star field of the three. Ground reuses the touge's Grass005 set (same
  // dir/files = already accepted + preloaded, zero new bytes).
  spa: {
    id: "spa",
    // daytime circuit: the model's textures are day-authored, so the sun
    // rig lights them straight with NO night emissive-lift — the forests
    // and pit buildings read exactly as the author dressed them
    timeOfDay: "day",
    range: 1000,
    spacing: 70,
    clearance: 30,
    jitter: 20,
    minHeight: 6,
    heightSpan: 16,
    minWidth: 10,
    widthSpan: 12,
    groundColor: 0x51603f,
    buildingColors: [0x1a231c, 0x241f16, 0x181d24],
    windowWarm: "#ffc27a",
    windowCool: "#c8dce8",
    windowAccent: "#a3e4c4",
    neonColors: [0xffc27a, 0x22d3a7],
    starCount: 1200,
    neonCount: 0,
    // the map's own GLB — pine forests, catch fencing, tire walls, pit
    // buildings, grandstands — imported and placed by SpaScene.ts; the
    // ?v= rev guards the double browser cache (HTTP immutable + SW bucket)
    // against future in-place swaps of the same path (ASPHALT_REV lesson)
    sceneGlb: "/models/spa/spa-92-scene.glb?v=1",
    ground: {
      dir: "touge",
      files: ["touge-2k-color.jpg", "touge-2k-normal.jpg", "touge-2k-rough.jpg"],
      tint: 0x3d4a36,
      emissive: 0.22,
      reps: 144,
      normalReps: 204,
      roughReps: 178,
    },
  },
  // sun-drenched tropical island (ISLAND COVE): no city at all — the ground
  // IS the island (Coast Sand 04 scan, Poly Haven CC0 2k: coarse beach sand
  // with pebble + shell debris), ringed by an animated sea at waterLevel 0,
  // palm clusters along the corridor, shoreline rocks, far islets on the
  // horizon and channel buoys. Plays at day with its own world-aligned sky
  // bake (island_cove_sky_2k, scripts/hdr_remap_island.mjs) — the photo sun
  // sits on the SAME SUN_DIR as the light rig, so sand + sea stay sunlit.
  island: {
    id: "island",
    timeOfDay: "day",
    // city knobs are unused by the island branch (buildings never spawn) —
    // zero-ish values keep the type satisfied without implying furniture
    range: 0,
    spacing: 1,
    clearance: 26,
    jitter: 0,
    minHeight: 0,
    heightSpan: 0,
    minWidth: 0,
    widthSpan: 0,
    groundColor: 0xc2b190,
    buildingColors: [0x000000, 0x000000, 0x000000],
    windowWarm: "#ffd9a0",
    windowCool: "#c8dce8",
    windowAccent: "#a3e4c4",
    neonColors: [],
    starCount: 0,
    neonCount: 0,
    island: { waterLevel: 0, palms: 160, rocks: 90, islets: 6, buoys: 14, mountains: 3, coastMountains: 7, conifers: 8400, ferns: 420, shrubs: 420, tufts: 380 },
    // day branch runs the sand scan natural (color 0xffffff): bright beach
    ground: {
      dir: "island",
      files: ["island-2k-color.jpg", "island-2k-normal.jpg", "island-2k-rough.jpg"],
      tint: 0xc2b190,
      emissive: 0,
      reps: 100,
      normalReps: 141,
      roughReps: 124,
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
  /** ground plane size in metres (default 2200) — maps bigger than the
   *  default world (e.g. the 6.95 km spa) enlarge their ground + terrain */
  groundExtent?: number;
  /** real-model base terrain grid (default none — flat -0.4 base) */
  baseTerrain?: BaseTerrainSpec;
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
      [140, 0, -26],
      [188, 0, -74],
      [196, 0, -140],
      [160, 0, -198],
      [104, 0, -232],
      [40, 0, -238],
      [-14, 0, -216],
      [-46, 0, -170],
      [-72, 0, -122],
      [-118, 0, -96],
      [-172, 0, -108],
      [-212, 0, -152],
      [-246, 0, -196],
      [-296, 0, -178],
      [-318, 0, -120],
      [-300, 0, -62],
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
      [252, 0, -70],
      [256, 0, -138],
      [218, 0, -190],
      [130, 0, -214],
      [40, 0, -226],
      [-50, 0, -216],
      [-110, 0, -244],
      [-148, 0, -272],
      [-186, 0, -244],
      [-206, 0, -196],
      [-238, 0, -130],
      [-242, 0, -70],
      [-224, 0, -14],
      [-150, 0, -30],
      [-92, 0, -14],
      [-44, 0, -26],
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
      [110, 0, -18], // right sweep opens
      [150, 1, -55],
      [145, 2, -100], // S1: bend back left
      [100, 3, -125],
      [55, 4, -100], // S2: ess right
      [15, 5, -125],
      [10, 6, -170], // carousel down the left
      [50, 6.5, -205],
      [105, 7, -215],
      [150, 7.5, -245], // kink right
      [210, 8, -245],
      [250, 8.5, -282], // hairpin apex 1 (right)
      [242, 8, -322], // hairpin apex 2
      [192, 7, -340],
      [130, 6, -318], // rhythm section: left/right/left kinks
      [88, 5, -300],
      [42, 4, -322],
      [-4, 3, -298],
      [-50, 2.5, -312],
      [-95, 2, -330], // big left carousel
      [-140, 1.5, -300],
      [-130, 1, -255],
      [-96, 0.5, -210], // return: right sweeper
      [-76, 1.5, -160], // flowing NE over the crest
      [-112, 0.5, -118], // left sweeper
      [-158, 0, -98], // final carousel apex 1 (right)
      [-158, 0, -58], // final carousel apex 2
      [-100, 0, -28], // exit onto the straight
      [-42, 0, -8],
    ],
  },
  // The real thing: Spa-Francorchamps 1992 GP layout, centerline + terrain
  // extracted from the CC-BY-4.0 Sketchfab model by Dave Love (see
  // spa_generated.ts for full attribution). 6.954 km, ~100 m of real
  // elevation (Eau Rouge climbs at ~15%), La Source hairpin, Kemmel,
  // the mid-sector loop and Blanchimont. Track is 4.3x the length of the
  // other maps — defaultLaps 2 keeps a quick race quick.
  {
    id: "spa",
    name: "SPA '92",
    description: "Real 1992 GP layout · 6.95 km daytime forest epic",
    envTheme: "spa",
    palette: {
      // daytime look: hazy Belgian morning — bright sky, pale aerial haze,
      // dry light-grey tarmac. (Was the night set: sky 0x040705, fog 0x0d1a14,
      // asphalt 0x14161a.) The asphalt color is the procedural-fallback
      // tint; the scanned-surface day tint lives in Track.ts.
      asphalt: 0x3a3d42,
      fog: 0xb9d2e2,
      sky: 0x87b6e2,
      ground: 0x51603f,
      finishPrimary: 0xfde047,
    },
    points: SPA_POINTS,
    roadHalfWidth: 10,
    samples: 2200,
    checkpoints: 24,
    defaultLaps: 2,
    groundExtent: SPA_GROUND_EXTENT,
    baseTerrain: SPA_TERRAIN,
  },
  // The holiday map: a 3.35 km coastal loop around a palm island — flowing
  // beach sweepers, an ess chicane, the headland crest over the θ≈120° kink,
  // all above an animated tropical sea (baked terrain from
  // scripts/island_gen.mjs; water/palms/rocks/islets/buoys by
  // IslandEnvironment.ts). Day map — its own Poly Haven "Illovo Beach" sky
  // bake shares the spa light rig (same SUN_DIR), so the sun the player
  // sees is the sun that casts the shadows.
  {
    id: "island",
    name: "ISLAND COVE",
    description: "Tropical day loop · 3.4 km coastal sweepers",
    envTheme: "island",
    palette: {
      // bright sea-haze day: pale fog, light dry tarmac, warm sand ground
      asphalt: 0x45484e,
      fog: 0xcfe4ee,
      sky: 0x87b6e2,
      ground: 0xc2b190,
      finishPrimary: 0xff7a5c,
    },
    points: ISLAND_POINTS,
    roadHalfWidth: 8.5,
    samples: 1400,
    checkpoints: 18,
    defaultLaps: 3,
    groundExtent: ISLAND_GROUND_EXTENT,
    baseTerrain: ISLAND_TERRAIN,
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

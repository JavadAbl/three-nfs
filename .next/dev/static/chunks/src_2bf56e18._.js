(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/game/constants.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ─── THREE-NFS global configuration & tuning ────────────────────────────────
// All physics values are SI units (metres, seconds) unless noted.
__turbopack_context__.s([
    "AI_TUNING",
    ()=>AI_TUNING,
    "CAR_COLORS",
    ()=>CAR_COLORS,
    "CAR_TUNING",
    ()=>CAR_TUNING,
    "GAME_CONFIG",
    ()=>GAME_CONFIG,
    "PALETTE",
    ()=>PALETTE
]);
const GAME_CONFIG = {
    /** Track samples used for nearest-point queries (resolution of progress) */ TRACK_SAMPLES: 700,
    /** How many checkpoints the lap is split into (index 0 = start/finish) */ CHECKPOINTS: 14,
    /** Road half width in metres */ ROAD_HALF_WIDTH: 8,
    /** Laps per race */ LAPS: 3,
    /** Offline AI opponents */ AI_COUNT: 3
};
const CAR_TUNING = {
    /** Max engine acceleration m/s² */ enginePower: 14.5,
    /** Extra acceleration while nitro is engaged */ nitroPower: 16,
    /** Brake deceleration m/s² */ brakeForce: 26,
    /** Reverse acceleration */ reversePower: 6,
    maxSpeed: 72,
    maxReverseSpeed: 12,
    /** Rolling + air drag combined damping per second */ drag: 0.38,
    offRoadDrag: 1.8,
    /** Base lateral grip (how quickly lateral velocity is killed) */ grip: 7.2,
    driftGrip: 1.7,
    /** Max steering yaw rate rad/s at optimal speed */ steerRate: 2.1,
    /** Speed where steering begins to tighten (m/s) */ steerFalloffStart: 18,
    steerFalloffMin: 0.42,
    nitroCapacity: 100,
    nitroDrain: 34,
    nitroRegen: 3.5,
    /** Drift points → nitro conversion rate */ driftNitroGain: 0.05
};
const AI_TUNING = {
    /** Skill variance between AI racers 0..1 */ skillRange: [
        0.78,
        0.94
    ],
    /** Lookahead distance along spline in metres */ lookahead: 22,
    /** Rubber-band strength: speed bonus multiplier range */ rubberBand: {
        behind: 1.08,
        ahead: 0.94
    }
};
const PALETTE = {
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
    finishPrimary: 0xf59e0b
};
const CAR_COLORS = [
    {
        name: "Sunburst",
        value: "#f59e0b"
    },
    {
        name: "Ember",
        value: "#ea580c"
    },
    {
        name: "Blood",
        value: "#dc2626"
    },
    {
        name: "Toxic",
        value: "#84cc16"
    },
    {
        name: "Frost",
        value: "#e2e8f0"
    },
    {
        name: "Shadow",
        value: "#27272a"
    },
    {
        name: "Candy",
        value: "#db2777"
    },
    {
        name: "Mint",
        value: "#14b8a6"
    }
]; // Circuit control points now live in src/game/maps/registry.ts (MAP_LIBRARY)
 // — the registry is the single source of truth for every map.
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/maps/registry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_ENV_THEME",
    ()=>DEFAULT_ENV_THEME,
    "DEFAULT_MAP_ID",
    ()=>DEFAULT_MAP_ID,
    "ENV_THEMES",
    ()=>ENV_THEMES,
    "MAPS",
    ()=>MAPS,
    "MAP_LIBRARY",
    ()=>MAP_LIBRARY,
    "approxTrackKm",
    ()=>approxTrackKm,
    "mapDef",
    ()=>mapDef,
    "mapEntry",
    ()=>mapEntry,
    "resolveEnvTheme",
    ()=>resolveEnvTheme,
    "resolveMapId",
    ()=>resolveMapId,
    "resolveMapPalette",
    ()=>resolveMapPalette
]);
// ─── Map registry: the single source of truth for circuits ──────────────────
// Data-only module (no three.js import) so every subsystem — track builder,
// environment, game core, menu UI, persistence, records API — can import from
// here without cycles. ADDING A MAP = one entry below (+ optional palette /
// envTheme / geometry overrides). No other file should list map ids.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-client] (ecmascript)");
;
const ENV_THEMES = {
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
        groundColor: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"].ground,
        buildingColors: [
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"].buildingA,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"].buildingB,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"].buildingC
        ],
        windowWarm: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"].windowWarm,
        windowCool: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"].windowCool,
        windowAccent: "#ffd9a0",
        neonColors: [
            0xf59e0b,
            0xff5e3a,
            0xff2d78,
            0x22d3a7
        ],
        starCount: 900,
        neonCount: 10
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
        buildingColors: [
            0x241d1a,
            0x1a2026,
            0x201a12
        ],
        windowWarm: "#ffb066",
        windowCool: "#c8dce8",
        windowAccent: "#ff8748",
        neonColors: [
            0xff8c1a,
            0xff3355,
            0x2dd4bf,
            0xffb020
        ],
        starCount: 420,
        neonCount: 6,
        containers: {
            count: 130,
            colors: [
                0xb4402f,
                0x2e5f8a,
                0x3f6b4f,
                0x8a8f98,
                0xb07a2a
            ]
        },
        cranes: {
            count: 7,
            height: 34,
            boom: 42
        }
    }
};
const DEFAULT_ENV_THEME = "city";
const MAP_LIBRARY = [
    {
        id: "downtown",
        name: "DOWNTOWN NEON",
        description: "Flowing night loop · wide sweepers",
        points: [
            [
                0,
                0,
                0
            ],
            [
                70,
                0,
                -6
            ],
            [
                140,
                1,
                -26
            ],
            [
                188,
                3,
                -74
            ],
            [
                196,
                5,
                -140
            ],
            [
                160,
                6,
                -198
            ],
            [
                104,
                7,
                -232
            ],
            [
                40,
                6,
                -238
            ],
            [
                -14,
                5,
                -216
            ],
            [
                -46,
                4,
                -170
            ],
            [
                -72,
                3,
                -122
            ],
            [
                -118,
                4,
                -96
            ],
            [
                -172,
                5,
                -108
            ],
            [
                -212,
                6,
                -152
            ],
            [
                -246,
                5,
                -196
            ],
            [
                -296,
                3,
                -178
            ],
            [
                -318,
                2,
                -120
            ],
            [
                -300,
                1,
                -62
            ],
            [
                -244,
                0,
                -26
            ],
            [
                -180,
                0,
                -8
            ],
            [
                -110,
                0,
                2
            ],
            [
                -52,
                0,
                4
            ]
        ]
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
            finishPrimary: 0x38bdf8
        },
        points: [
            [
                0,
                0,
                0
            ],
            [
                110,
                0,
                -3
            ],
            [
                205,
                0,
                -18
            ],
            [
                252,
                1,
                -70
            ],
            [
                256,
                2,
                -138
            ],
            [
                218,
                2,
                -190
            ],
            [
                130,
                1,
                -214
            ],
            [
                40,
                1,
                -226
            ],
            [
                -50,
                0,
                -216
            ],
            [
                -110,
                0,
                -244
            ],
            [
                -148,
                0,
                -272
            ],
            [
                -186,
                0,
                -244
            ],
            [
                -206,
                1,
                -196
            ],
            [
                -238,
                2,
                -130
            ],
            [
                -242,
                2,
                -70
            ],
            [
                -224,
                3,
                -14
            ],
            [
                -150,
                3,
                -30
            ],
            [
                -92,
                2,
                -14
            ],
            [
                -44,
                1,
                -26
            ],
            [
                -18,
                0,
                -10
            ]
        ]
    },
    {
        // ported from the local menu line — big-elevation GP circuit
        id: "skyline",
        name: "SKYLINE GP",
        description: "2.9 KM · fast sweepers · big climbs",
        points: [
            [
                0,
                0,
                0
            ],
            [
                90,
                0,
                -10
            ],
            [
                170,
                2,
                -44
            ],
            [
                210,
                5,
                -110
            ],
            [
                200,
                8,
                -190
            ],
            [
                140,
                10,
                -240
            ],
            [
                60,
                10,
                -260
            ],
            [
                -20,
                8,
                -250
            ],
            [
                -80,
                6,
                -208
            ],
            [
                -140,
                6,
                -160
            ],
            [
                -210,
                7,
                -170
            ],
            [
                -270,
                6,
                -206
            ],
            [
                -310,
                4,
                -160
            ],
            [
                -320,
                3,
                -92
            ],
            [
                -285,
                2,
                -30
            ],
            [
                -220,
                1,
                4
            ],
            [
                -140,
                0,
                14
            ],
            [
                -70,
                0,
                10
            ]
        ]
    }
];
const DEFAULT_MAP_ID = "downtown";
function mapDef(id) {
    return MAP_LIBRARY.find((m)=>m.id === id);
}
const MAPS = MAP_LIBRARY;
const mapEntry = mapDef;
function resolveMapId(raw) {
    const id = raw ?? DEFAULT_MAP_ID;
    return mapDef(id) ? id : DEFAULT_MAP_ID;
}
function resolveMapPalette(def) {
    return {
        ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PALETTE"],
        ...def.palette
    };
}
function resolveEnvTheme(def) {
    return ENV_THEMES[def.envTheme ?? DEFAULT_ENV_THEME] ?? ENV_THEMES[DEFAULT_ENV_THEME];
}
function approxTrackKm(points) {
    let len = 0;
    for(let i = 0; i < points.length; i++){
        const a = points[i];
        const b = points[(i + 1) % points.length];
        len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    return Math.round(len / 1000 * 10) / 10;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/Track.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Track",
    ()=>Track
]);
// ─── Spline circuit: road mesh, samples, checkpoints ────────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
;
;
;
class Track {
    curve;
    samples = [];
    sampleCount;
    length;
    mapId;
    halfWidth;
    /** lateral metres (from centre line) where the guardrail mesh stands — physics matches the visual */ railLateral;
    checkpointCount;
    /** sample indices that mark each checkpoint gate */ checkpointIndices = [];
    group = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    /** fully-resolved look for this map (road, lines, lamps, finish) */ P;
    /**
   * Build a circuit from a registry MapDef. Unspecified fields fall back to
   * the global GAME_CONFIG defaults, so a bare points-only entry reproduces
   * the legacy hardcoded track exactly.
   */ constructor(def){
        this.mapId = def.id;
        this.P = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveMapPalette"])(def);
        const pts = def.points.map((p)=>new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](p[0], p[1], p[2]));
        this.curve = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CatmullRomCurve3"](pts, true, "catmullrom", 0.5);
        // ── resample the closed curve evenly by arc length ──
        const N = def.samples ?? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GAME_CONFIG"].TRACK_SAMPLES;
        this.sampleCount = N;
        this.halfWidth = def.roadHalfWidth ?? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GAME_CONFIG"].ROAD_HALF_WIDTH;
        this.railLateral = this.halfWidth + 1.4;
        this.checkpointCount = def.checkpoints ?? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GAME_CONFIG"].CHECKPOINTS;
        const positions = this.curve.getSpacedPoints(N);
        // getSpacedPoints(N) returns N+1 points with last == first; drop duplicate
        positions.pop();
        let dist = 0;
        for(let i = 0; i < N; i++){
            const pos = positions[i];
            const next = positions[(i + 1) % N];
            const prev = positions[(i - 1 + N) % N];
            const tangent = next.clone().sub(prev).normalize();
            const normal = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](-tangent.z, 0, tangent.x).normalize();
            this.samples.push({
                pos,
                tangent,
                normal,
                dist
            });
            dist += pos.distanceTo(next);
        }
        this.length = dist;
        // checkpoint gates evenly distributed; index 0 = start/finish
        for(let c = 0; c < this.checkpointCount; c++){
            this.checkpointIndices.push(Math.round(c / this.checkpointCount * N) % N);
        }
        this.buildRoad();
        this.buildRails();
        this.buildStartGate();
        this.buildStreetLights();
    }
    // ─── geometry construction ──────────────────────────────────────────────
    buildRoad() {
        const N = this.sampleCount;
        const hw = this.halfWidth;
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        // store per-vertex lateral sign so the shader-free approach works with vertex colors
        const colors = [];
        const base = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](this.P.asphalt);
        const edge = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](this.P.roadEdge);
        const line = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](this.P.roadLine);
        for(let i = 0; i <= N; i++){
            const s = this.samples[i % N];
            const v = i / N;
            for(let l = 0; l <= 8; l++){
                const t = l / 8; // 0..1 across width
                const x = (t - 0.5) * 2; // -1..1
                const p = s.pos.clone().addScaledVector(s.normal, x * hw);
                positions.push(p.x, p.y, p.z);
                normals.push(0, 1, 0);
                uvs.push(t, v * (this.length / 10));
                // default asphalt
                let col = base;
                if (Math.abs(Math.abs(x) - 0.94) < 0.02) col = edge; // edge lines
                else if (Math.abs(x) < 0.035 && i % 4 < 2) col = line; // dashed centre
                colors.push(col.r, col.g, col.b);
            }
        }
        const rowW = 9;
        for(let i = 0; i < N; i++){
            for(let l = 0; l < 8; l++){
                const a = i * rowW + l;
                const b = (i + 1) * rowW + l;
                indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
        }
        const geo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferGeometry"]();
        geo.setAttribute("position", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](positions, 3));
        geo.setAttribute("normal", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](normals, 3));
        geo.setAttribute("uv", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](uvs, 2));
        geo.setAttribute("color", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](colors, 3));
        geo.setIndex(indices);
        const roadTex = makeAsphaltTexture();
        const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            vertexColors: true,
            map: roadTex,
            roughness: 0.92,
            metalness: 0.02
        });
        const mesh = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](geo, mat);
        mesh.receiveShadow = true;
        mesh.name = "road";
        this.group.add(mesh);
    }
    buildRails() {
        const N = this.sampleCount;
        const hw = this.railLateral;
        const railH = 1.05;
        for (const side of [
            -1,
            1
        ]){
            const positions = [];
            const indices = [];
            for(let i = 0; i <= N; i++){
                const s = this.samples[i % N];
                const bottom = s.pos.clone().addScaledVector(s.normal, side * hw);
                const top = bottom.clone().setY(bottom.y + railH);
                positions.push(bottom.x, bottom.y + 0.25, bottom.z, top.x, top.y + 0.25, top.z);
            }
            for(let i = 0; i < N; i++){
                const a = i * 2;
                const b = (i + 1) * 2;
                indices.push(a, b, a + 1, b, b + 1, a + 1);
            }
            const geo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferGeometry"]();
            geo.setAttribute("position", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](positions, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
                color: 0x2a2a30,
                emissive: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](0x3a2a10),
                emissiveIntensity: 0.5,
                roughness: 0.5,
                metalness: 0.7,
                side: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DoubleSide"]
            });
            this.group.add(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](geo, mat));
        }
    }
    buildStartGate() {
        const s = this.samples[0];
        const hw = this.halfWidth + 1.6;
        const group = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
        // checkered finish line across the road
        const stripe = makeCheckeredTexture();
        const lineGeo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](hw * 2, 3);
        const lineMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            map: stripe,
            transparent: true
        });
        const line = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.rotation.z = -Math.atan2(s.tangent.z, s.tangent.x) + Math.PI / 2;
        line.position.copy(s.pos).setY(s.pos.y + 0.06);
        group.add(line);
        // gate posts + banner
        const postMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: 0x1c1c22,
            metalness: 0.8,
            roughness: 0.35
        });
        for (const side of [
            -1,
            1
        ]){
            const post = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CylinderGeometry"](0.28, 0.34, 9, 10), postMat);
            post.position.copy(s.pos).addScaledVector(s.normal, side * hw).setY(s.pos.y + 4.5);
            group.add(post);
        }
        const banner = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](hw * 2 + 1, 1.6, 0.5), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: 0x101014,
            emissive: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](this.P.finishPrimary),
            emissiveIntensity: 0.85
        }));
        banner.position.copy(s.pos).setY(s.pos.y + 8.6);
        banner.rotation.y = Math.atan2(s.tangent.x, s.tangent.z) + Math.PI / 2;
        group.add(banner);
        this.group.add(group);
    }
    buildStreetLights() {
        const N = this.sampleCount;
        const spacing = Math.floor(N / 46);
        const poleMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: 0x191920,
            roughness: 0.6,
            metalness: 0.6
        });
        const lampMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: this.P.lamp
        });
        const glowMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: this.P.lamp,
            transparent: true,
            opacity: 0.32,
            depthWrite: false
        });
        for(let i = 0; i < N; i += spacing){
            const s = this.samples[i];
            const side = i / spacing % 2 === 0 ? 1 : -1;
            const base = s.pos.clone().addScaledVector(s.normal, side * (this.halfWidth + 2.6));
            const pole = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CylinderGeometry"](0.09, 0.12, 6.5, 6), poleMat);
            pole.position.copy(base).setY(base.y + 3.25);
            this.group.add(pole);
            const lamp = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.5, 0.16, 0.5), lampMat);
            lamp.position.copy(base).addScaledVector(s.normal, -side * 0.8).setY(base.y + 6.5);
            lamp.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
            this.group.add(lamp);
            const glow = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SphereGeometry"](1.15, 8, 8), glowMat);
            glow.position.copy(lamp.position).setY(lamp.position.y - 0.35);
            this.group.add(glow);
        }
    }
    // ─── queries ─────────────────────────────────────────────────────────────
    sampleAt(i) {
        const N = this.sampleCount;
        return this.samples[(i % N + N) % N];
    }
    /**
   * Locate a world position on the track. `hint` speeds up the search by
   * scanning a window around the previous nearest index.
   */ locate(pos, hint = -1) {
        const N = this.sampleCount;
        let bestI = 0;
        let bestD = Infinity;
        if (hint >= 0) {
            const win = 36;
            for(let o = -win; o <= win; o++){
                const i = ((hint + o) % N + N) % N;
                const d = this.samples[i].pos.distanceToSquared(pos);
                if (d < bestD) {
                    bestD = d;
                    bestI = i;
                }
            }
            // if we drifted far off, fall back to a full scan
            if (bestD > 90 * 90) return this.locate(pos, -1);
        } else {
            for(let i = 0; i < N; i += 2){
                const d = this.samples[i].pos.distanceToSquared(pos);
                if (d < bestD) {
                    bestD = d;
                    bestI = i;
                }
            }
        }
        const s = this.samples[bestI];
        const next = this.sampleAt(bestI + 1);
        // lateral offset (signed, right positive)
        const rel = pos.clone().sub(s.pos);
        const lateral = rel.dot(s.normal);
        // longitudinal projection onto segment for smooth s-distance
        const along = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(rel.dot(s.tangent), 0, s.pos.distanceTo(next.pos));
        // height interpolation across the width
        const height = s.pos.y + (next.pos.y - s.pos.y) * (along / Math.max(0.001, s.pos.distanceTo(next.pos)));
        const pitch = Math.asin(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(next.pos.clone().sub(s.pos).normalize().y, -1, 1));
        return {
            index: bestI,
            sDist: (s.dist + along) % this.length,
            lateral,
            height,
            slopePitch: pitch,
            tangent: s.tangent
        };
    }
    /** Checkpoint gate index (0..checkpointCount-1) that a sample index belongs to */ checkpointForIndex(i) {
        const N = this.sampleCount;
        for(let c = this.checkpointCount - 1; c >= 0; c--){
            const gate = this.checkpointIndices[c];
            // how far past this gate are we (wrapping)?
            const d = (i - gate + N) % N;
            if (d < N / this.checkpointCount) return c;
        }
        return 0;
    }
    /** Approximate curvature (rad per metre) around sample index */ curvatureAt(i, span = 8) {
        const a = this.sampleAt(i - span).tangent;
        const b = this.sampleAt(i + span).tangent;
        const angle = Math.acos(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(a.dot(b), -1, 1));
        const length = span * 2 * this.length / this.sampleCount;
        return angle / length;
    }
    dispose() {
        this.group.traverse((o)=>{
            const m = o;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x)=>x.dispose());
            else if (mat) mat.dispose();
        });
    }
}
// ─── procedural textures ─────────────────────────────────────────────────────
function makeAsphaltTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    // asphalt grain
    const img = ctx.getImageData(0, 0, size, size);
    for(let i = 0; i < img.data.length; i += 4){
        const n = 232 + Math.random() * 23;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CanvasTexture"](canvas);
    tex.wrapS = tex.wrapT = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RepeatWrapping"];
    tex.repeat.set(2, 2);
    return tex;
}
function makeCheckeredTexture() {
    const cells = 8;
    const cell = 16;
    const canvas = document.createElement("canvas");
    canvas.width = cells * cell;
    canvas.height = cell * 2;
    const ctx = canvas.getContext("2d");
    for(let y = 0; y < 2; y++){
        for(let x = 0; x < cells; x++){
            ctx.fillStyle = (x + y) % 2 === 0 ? "#e8e8e8" : "#101010";
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CanvasTexture"](canvas);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/CityEnvironment.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CityEnvironment",
    ()=>CityEnvironment
]);
// ─── Night city: instanced buildings, ground, stars, neon ───────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
;
;
class CityEnvironment {
    group = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    theme;
    /** builds the world furniture from a map's environment theme */ constructor(track, theme = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ENV_THEMES"].city){
        this.theme = theme;
        this.group.add(this.makeGround());
        this.group.add(this.makeStars());
        this.buildBuildings(track);
        if (theme.containers) this.buildContainers(track, theme.containers);
        if (theme.cranes) this.buildCranes(track, theme.cranes);
    }
    makeGround() {
        const geo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](2200, 2200, 1, 1);
        const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: this.theme.groundColor,
            roughness: 1
        });
        const mesh = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.4;
        mesh.receiveShadow = true;
        return mesh;
    }
    makeStars() {
        const N = this.theme.starCount;
        const positions = new Float32Array(N * 3);
        for(let i = 0; i < N; i++){
            // dome distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(0.05, 0.95, Math.random()));
            const r = 900;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi);
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        }
        const geo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferGeometry"]();
        geo.setAttribute("position", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferAttribute"](positions, 3));
        const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PointsMaterial"]({
            color: 0xdfe6ee,
            size: 2.2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.75,
            fog: false
        });
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Points"](geo, mat);
    }
    buildBuildings(track) {
        const T = this.theme;
        // candidate grid, keep clear of the track corridor
        const spacing = T.spacing;
        const range = T.range;
        const cands = [];
        const samples = track.samples;
        const checkStep = 3; // coarse check against every 3rd sample
        const clearance = T.clearance;
        for(let x = -range; x <= range; x += spacing){
            for(let z = -range; z <= range; z += spacing){
                // jitter
                const jx = x + (Math.random() - 0.5) * T.jitter;
                const jz = z + (Math.random() - 0.5) * T.jitter;
                let ok = true;
                for(let i = 0; i < samples.length; i += checkStep){
                    const s = samples[i];
                    const dx = s.pos.x - jx;
                    const dz = s.pos.z - jz;
                    if (dx * dx + dz * dz < clearance * clearance) {
                        ok = false;
                        break;
                    }
                }
                if (ok) cands.push({
                    x: jx,
                    z: jz
                });
            }
        }
        // 3 instanced meshes with different window textures
        const variants = [
            {
                tex: windowTexture(T.windowWarm, 0.55),
                base: T.buildingColors[0]
            },
            {
                tex: windowTexture(T.windowCool, 0.35),
                base: T.buildingColors[1]
            },
            {
                tex: windowTexture(T.windowAccent, 0.7),
                base: T.buildingColors[2]
            }
        ];
        const boxGeo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1, 1, 1);
        // shift origin to bottom so scaling grows upward
        boxGeo.translate(0, 0.5, 0);
        const per = Math.ceil(cands.length / variants.length);
        for(let v = 0; v < variants.length; v++){
            const batch = cands.slice(v * per, (v + 1) * per);
            if (!batch.length) continue;
            const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
                color: variants[v].base,
                map: variants[v].tex,
                emissive: 0xffffff,
                emissiveMap: variants[v].tex,
                emissiveIntensity: 0.75,
                roughness: 0.85,
                metalness: 0.15
            });
            const inst = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InstancedMesh"](boxGeo, mat, batch.length);
            const m = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Matrix4"]();
            const color = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"]();
            batch.forEach((c, i)=>{
                const h = T.minHeight + Math.random() * Math.random() * T.heightSpan;
                const w = T.minWidth + Math.random() * T.widthSpan;
                const d = T.minWidth + Math.random() * T.widthSpan;
                m.makeScale(w, h, d);
                m.setPosition(c.x, -0.4, c.z);
                inst.setMatrixAt(i, m);
                // subtle per-instance tint
                const t = 0.75 + Math.random() * 0.45;
                color.setRGB(t, t * (0.95 + Math.random() * 0.05), t * (0.9 + Math.random() * 0.1));
                inst.setColorAt(i, color);
            });
            inst.instanceMatrix.needsUpdate = true;
            this.group.add(inst);
        }
        // a few neon billboards near the track for Carbon flavour
        const neonColors = T.neonColors;
        for(let i = 0; i < T.neonCount; i++){
            const s = samples[Math.floor(i / T.neonCount * samples.length)];
            const side = i % 2 === 0 ? 1 : -1;
            const p = s.pos.clone().addScaledVector(s.normal, side * (track.halfWidth + 8));
            const w = 7 + Math.random() * 6;
            const h = 3 + Math.random() * 2;
            const billboard = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](w, h), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
                color: neonColors[i % neonColors.length],
                transparent: true,
                opacity: 0.85,
                side: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DoubleSide"]
            }));
            billboard.position.copy(p).setY(p.y + 6 + Math.random() * 6);
            billboard.rotation.y = Math.atan2(-s.normal.x * side, -s.normal.z * side);
            this.group.add(billboard);
            const pole = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CylinderGeometry"](0.18, 0.22, 7, 6), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
                color: 0x181820,
                roughness: 0.6
            }));
            pole.position.copy(p).setY(p.y + 3);
            this.group.add(pole);
        }
    }
    /** shipping-container stacks clustered along the corridor (harbor/industrial) */ buildContainers(track, spec) {
        const samples = track.samples;
        const hw = track.halfWidth;
        // 20-ft container: 6.1 long × 2.44 wide × 2.6 tall
        const geo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](6.1, 2.6, 2.44);
        // some stacks are 2-high (occasionally 3) — one instance per box
        let total = 0;
        const stacks = [];
        for(let i = 0; i < spec.count; i++){
            const s = samples[Math.floor(Math.random() * samples.length)];
            const side = Math.random() < 0.5 ? 1 : -1;
            // rows start past the rail, sprawl outward toward the warehouses
            const lateral = hw + 6 + Math.random() * 26;
            const along = (Math.random() - 0.5) * 26;
            const p = s.pos.clone().addScaledVector(s.normal, side * lateral).addScaledVector(s.tangent, along);
            const r = Math.random();
            const n = r < 0.45 ? 1 : r < 0.85 ? 2 : 3;
            stacks.push({
                x: p.x,
                z: p.z,
                rot: Math.atan2(s.tangent.x, s.tangent.z),
                n
            });
            total += n;
        }
        const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: 0xffffff,
            roughness: 0.82,
            metalness: 0.25
        });
        const inst = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InstancedMesh"](geo, mat, total);
        const m = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Matrix4"]();
        const q = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Quaternion"]();
        const col = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"]();
        const up = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](0, 1, 0);
        let idx = 0;
        for (const st of stacks){
            const pick = spec.colors[Math.floor(Math.random() * spec.colors.length)];
            col.setHex(pick);
            // per-box brightness jitter so a stack of same-colour boxes still reads
            const jitter = 0.82 + Math.random() * 0.3;
            col.multiplyScalar(jitter);
            q.setFromAxisAngle(up, st.rot);
            for(let k = 0; k < st.n; k++){
                // second level sits slightly askew — yard workers aren't precise
                const wobble = k > 0 ? (Math.random() - 0.5) * 0.6 : 0;
                const qq = q.clone().multiply(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Quaternion"]().setFromAxisAngle(up, wobble));
                m.compose(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](st.x, -0.4 + 1.3 + k * 2.6, st.z), qq, new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](1, 1, 1));
                inst.setMatrixAt(idx, m);
                inst.setColorAt(idx, col);
                idx++;
            }
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        this.group.add(inst);
    }
    /** harbour gantry cranes in a row parallel to the circuit */ buildCranes(track, spec) {
        const samples = track.samples;
        const hw = track.halfWidth;
        const steel = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: 0xc23c26,
            roughness: 0.55,
            metalness: 0.4
        });
        const dark = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
            color: 0x1c1e24,
            roughness: 0.7
        });
        const warn = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xff2233
        });
        const legSpacing = spec.boom * 0.62;
        for(let i = 0; i < spec.count; i++){
            // evenly spaced around the lap, alternating sides of the corridor
            const s = samples[Math.floor((i + 0.5) / spec.count * samples.length)];
            const side = i % 2 === 0 ? 1 : -1;
            const base = s.pos.clone().addScaledVector(s.normal, side * (hw + 26));
            const yaw = Math.atan2(s.tangent.x, s.tangent.z);
            const crane = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
            crane.position.copy(base);
            crane.rotation.y = yaw;
            // two A-legs spanning the yard rows (along local x = track tangent)
            for (const lx of [
                -legSpacing / 2,
                legSpacing / 2
            ]){
                const leg = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](2.2, spec.height, 2.2), steel);
                leg.position.set(lx, spec.height / 2 - 0.4, 0);
                crane.add(leg);
                // diagonal brace
                const brace = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](legSpacing / 2 + 1, 1.2, 1.2), steel);
                brace.position.set(lx / 2, spec.height * 0.55, 0);
                brace.rotation.y = Math.atan2(2, legSpacing / 2) * Math.sign(lx);
                crane.add(brace);
            }
            // top beam running parallel to the track
            const beam = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](spec.boom, 2.6, 2.6), steel);
            beam.position.set(0, spec.height - 0.4, 0);
            crane.add(beam);
            // trolley + hanging spreader
            const trolley = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](3.4, 1.6, 3), dark);
            trolley.position.set((Math.random() - 0.5) * spec.boom * 0.5, spec.height - 2.6, 0);
            crane.add(trolley);
            const cable = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.3, 7, 0.3), dark);
            cable.position.set(trolley.position.x, spec.height - 6.5, 0);
            crane.add(cable);
            const spreader = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](6.5, 0.8, 2.6), dark);
            spreader.position.set(trolley.position.x, spec.height - 10, 0);
            crane.add(spreader);
            // aircraft-warning light
            const light = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SphereGeometry"](0.55, 8, 8), warn);
            light.position.set(0, spec.height + 1.4, 0);
            crane.add(light);
            this.group.add(crane);
        }
    }
    dispose() {
        this.group.traverse((o)=>{
            const m = o;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x)=>x.dispose());
            else if (mat) mat.dispose();
        });
    }
}
/** grid of lit windows baked to a canvas texture */ function windowTexture(windowColor, litRatio) {
    const cols = 12;
    const rows = 24;
    const cw = 12;
    const ch = 10;
    const canvas = document.createElement("canvas");
    canvas.width = cols * cw;
    canvas.height = rows * ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for(let y = 0; y < rows; y++){
        for(let x = 0; x < cols; x++){
            if (Math.random() < litRatio) {
                const bright = 0.35 + Math.random() * 0.65;
                ctx.fillStyle = windowColor;
                ctx.globalAlpha = bright;
                ctx.fillRect(x * cw + 2, y * ch + 2, cw - 5, ch - 5);
                ctx.globalAlpha = 1;
            }
        }
    }
    const tex = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CanvasTexture"](canvas);
    return tex;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/cars/registry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AI_POOL_IDS",
    ()=>AI_POOL_IDS,
    "CARS",
    ()=>CARS,
    "CAR_LIBRARY",
    ()=>CAR_LIBRARY,
    "DEFAULT_CAR_ID",
    ()=>DEFAULT_CAR_ID,
    "DEFAULT_CAR_TUNING",
    ()=>DEFAULT_CAR_TUNING,
    "carDef",
    ()=>carDef,
    "carEntry",
    ()=>carEntry,
    "carStats",
    ()=>carStats,
    "preloadCarIds",
    ()=>preloadCarIds,
    "resolveCarId",
    ()=>resolveCarId,
    "resolveCarTuning",
    ()=>resolveCarTuning,
    "statsOf",
    ()=>statsOf
]);
// ─── Car registry: the single source of truth for the garage ────────────────
// Data-only module (no three.js import) so every subsystem — garage UI,
// model loader, AI pool, persistence, preloading — can import from here
// without cycles. ADDING A CAR = one entry below + the GLB in /public/models
// (+ optional tuning overrides). No other file should list car ids.
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-client] (ecmascript)");
;
const DEFAULT_CAR_TUNING = {
    ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAR_TUNING"],
    mass: 1
};
const CAR_LIBRARY = [
    {
        id: "gtr",
        name: "NISSAN GT-R R35",
        short: "GT-R",
        modelUrl: "/models/nissan-gtr-r35.glb",
        spec: "NISMO · 600 HP",
        tuning: {
            enginePower: 15.5,
            grip: 8.0,
            steerRate: 2.0,
            mass: 1.15
        }
    },
    {
        id: "audi",
        name: "AUDI TT RS",
        short: "TT RS",
        modelUrl: "/models/audi-tt-rs.glb",
        spec: "QUATTRO · 400 HP",
        tuning: {
            enginePower: 12.5,
            grip: 7.6,
            steerRate: 2.3,
            mass: 0.95
        }
    },
    {
        id: "viper08",
        name: "VIPER SRT10 '08",
        short: "SRT10",
        modelUrl: "/models/viper-srt10-2008.glb",
        spec: "V10 · 600 HP",
        tuning: {
            enginePower: 16.5,
            grip: 6.4,
            steerRate: 1.9,
            mass: 1.05
        }
    },
    {
        id: "viper16",
        name: "VIPER ACR '16",
        short: "ACR",
        modelUrl: "/models/viper-acr-2016.glb",
        spec: "V10 · 645 HP · ACR",
        tuning: {
            enginePower: 17.0,
            grip: 7.4,
            steerRate: 2.15
        }
    },
    {
        id: "classic",
        name: "STREET MUSCLE",
        short: "MUSCLE",
        modelUrl: null,
        spec: "V8 · PROCEDURAL",
        tuning: {
            enginePower: 15.0,
            grip: 5.8,
            steerRate: 1.8,
            mass: 1.1
        }
    }
];
function carDef(id) {
    return CAR_LIBRARY.find((c)=>c.id === id);
}
const DEFAULT_CAR_ID = "gtr";
function resolveCarId(raw) {
    const id = raw ?? "";
    return carDef(id)?.id ?? DEFAULT_CAR_ID;
}
function resolveCarTuning(id) {
    return {
        ...DEFAULT_CAR_TUNING,
        ...carDef(id ?? "")?.tuning
    };
}
const AI_POOL_IDS = CAR_LIBRARY.map(_c = (c)=>c.id);
_c1 = AI_POOL_IDS;
function preloadCarIds(playerCarId) {
    return [
        playerCarId,
        ...AI_POOL_IDS.filter((id)=>id !== playerCarId)
    ];
}
const CARS = CAR_LIBRARY;
const carEntry = carDef;
const clamp01 = (v)=>Math.min(1, Math.max(0, v));
const pct = (v)=>Math.round(clamp01(v) * 100);
function statsOf(t) {
    return {
        topSpeed: pct((t.maxSpeed - 56) / 22),
        accel: pct((t.enginePower - 12.5) / 6),
        handling: pct(0.55 * clamp01((t.grip - 5.2) / 3.4) + 0.45 * clamp01((t.steerRate - 1.7) / 0.7))
    };
}
function carStats(id) {
    return statsOf(resolveCarTuning(id));
}
var _c, _c1;
__turbopack_context__.k.register(_c, "AI_POOL_IDS$CAR_LIBRARY.map");
__turbopack_context__.k.register(_c1, "AI_POOL_IDS");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/ProceduralMuscle.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MUSCLE_WHEEL_POS",
    ()=>MUSCLE_WHEEL_POS,
    "MUSCLE_WHEEL_RADIUS",
    ()=>MUSCLE_WHEEL_RADIUS,
    "buildMuscleBody",
    ()=>buildMuscleBody,
    "buildMuscleWheel",
    ()=>buildMuscleWheel
]);
// ─── ProceduralMuscle: shared low-poly muscle-car body ───────────────────────
// Single source for the procedural car silhouette: the race fallback skin in
// Car.ts AND the showroom turntable in CarPreview.tsx both build from this, so
// the car you pick in the garage is the car you drive.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
;
function buildMuscleBody(color) {
    const paint = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshPhysicalMaterial"]({
        color: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](color),
        metalness: 0.85,
        roughness: 0.32,
        clearcoat: 1,
        clearcoatRoughness: 0.12
    });
    const dark = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
        color: 0x0c0c0e,
        roughness: 0.55,
        metalness: 0.4
    });
    const glass = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshPhysicalMaterial"]({
        color: 0x090a12,
        metalness: 0.9,
        roughness: 0.08,
        transparent: true,
        opacity: 0.85
    });
    const root = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    const body = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](2.05, 0.5, 4.6), paint);
    body.position.y = 0.52;
    const nose = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.95, 0.34, 1.1), paint);
    nose.position.set(0, 0.42, 2.05);
    const tail = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](2.0, 0.42, 0.9), paint);
    tail.position.set(0, 0.55, -2.2);
    const cabin = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.62, 0.5, 2.1), paint);
    cabin.position.set(0, 0.98, -0.35);
    const windshield = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.56, 0.42, 0.7), glass);
    windshield.position.set(0, 1.0, 0.75);
    windshield.rotation.x = -0.42;
    const rearGlass = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.5, 0.38, 0.55), glass);
    rearGlass.position.set(0, 1.02, -1.42);
    rearGlass.rotation.x = 0.5;
    const spoiler = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.9, 0.08, 0.5), dark);
    spoiler.position.set(0, 1.15, -2.35);
    const spoilerStand1 = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.1, 0.3, 0.3), dark);
    spoilerStand1.position.set(0.7, 0.98, -2.3);
    const spoilerStand2 = spoilerStand1.clone();
    spoilerStand2.position.x = -0.7;
    const sideSkirtL = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.14, 0.18, 2.8), dark);
    sideSkirtL.position.set(1.02, 0.34, 0);
    const sideSkirtR = sideSkirtL.clone();
    sideSkirtR.position.x = -1.02;
    for (const m of [
        body,
        nose,
        tail,
        cabin,
        windshield,
        rearGlass,
        spoiler,
        spoilerStand1,
        spoilerStand2,
        sideSkirtL,
        sideSkirtR
    ])root.add(m);
    return {
        root,
        paint,
        mats: [
            paint,
            dark,
            glass
        ]
    };
}
const MUSCLE_WHEEL_RADIUS = 0.38;
function buildMuscleWheel() {
    const tireGeo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CylinderGeometry"](MUSCLE_WHEEL_RADIUS, MUSCLE_WHEEL_RADIUS, 0.3, 14);
    const rimGeo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CylinderGeometry"](0.21, 0.21, 0.32, 10);
    const tireMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
        color: 0x0a0a0a,
        roughness: 0.95
    });
    const rimMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
        color: 0xb8a06a,
        metalness: 0.95,
        roughness: 0.25,
        emissive: 0x241a05
    });
    const wheel = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    const tire = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    const rim = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(tire, rim);
    return wheel;
}
const MUSCLE_WHEEL_POS = [
    [
        0.95,
        MUSCLE_WHEEL_RADIUS,
        1.55,
        true
    ],
    [
        -0.95,
        MUSCLE_WHEEL_RADIUS,
        1.55,
        true
    ],
    [
        0.95,
        MUSCLE_WHEEL_RADIUS,
        -1.6,
        false
    ],
    [
        -0.95,
        MUSCLE_WHEEL_RADIUS,
        -1.6,
        false
    ]
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/Car.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Car",
    ()=>Car,
    "RemoteCar",
    ()=>RemoteCar
]);
// ─── Car: arcade physics + procedural low-poly visual OR GLB model ───────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/ProceduralMuscle.ts [app-client] (ecmascript)");
;
;
;
const UP = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](0, 1, 0);
const _rel = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
const _clamped = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
class Car {
    controls = {
        throttle: 0,
        brake: 0,
        steer: 0,
        handbrake: false,
        nitro: false
    };
    /** world position (y follows road) */ pos = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
    /** yaw heading, forward = (sin h, 0, cos h) */ heading = 0;
    /** velocity vector (xz plane) */ vel = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
    /** forward speed m/s */ speed = 0;
    /** per-car physics profile (resolved from the registry at spawn) */ tuning = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CAR_TUNING"];
    nitro = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CAR_TUNING"].nitroCapacity;
    kind;
    color;
    name;
    /** last track location result (updated in update()) */ loc = null;
    /** current drift angle (rad) — angle between velocity and heading */ slipAngle = 0;
    /** drift points accumulated this race */ driftScore = 0;
    /** live drift chain points (resets when drift ends) */ driftChain = 0;
    drifting = false;
    driftTimer = 0;
    lastTrackIndex = -1;
    // visuals
    group = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    bodyGroup = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    /** collision footprint (metres): half width / half length of the body box */ collHalfW = 1.05;
    collHalfL = 2.35;
    /**
   * visual body metrics (metres, model frame: +Z = front, y up from ground)
   * used by the camera rig to anchor cockpit views — GLB bounds on model
   * cars, hand-tuned defaults for the procedural muscle car
   */ camDims = {
        frontZ: 2.58,
        rearZ: -2.02,
        topY: 1.25,
        length: 4.6,
        width: 2.05
    };
    /** guardrail impact strength this frame (m/s) — consumed by Game for FX */ railHit = 0;
    wheels = [];
    modelWheels = [];
    model;
    wheelRadius = 0.38;
    wheelSpin = 0;
    brakeLights;
    nitroFlames = [];
    headBeamL;
    headBeamR;
    label;
    rollVisual = 0;
    /** resources owned by this instance (model cars share template resources) */ owned = [];
    /** smoke emission request consumed by the particle pool owner */ smokeRequest = null;
    constructor(kind, color, name = "", model, tuning){
        this.kind = kind;
        this.color = color;
        this.name = name;
        this.model = model;
        if (tuning) {
            this.tuning = tuning;
            this.nitro = tuning.nitroCapacity;
        }
        this.buildVisual();
    }
    // ─── visual construction ────────────────────────────────────────────────
    buildVisual() {
        if (this.model) this.buildModelVisual();
        else this.buildProceduralVisual();
    }
    // ─── GLB model path — real car with procedural lights/flare FX ──────────
    buildModelVisual() {
        const m = this.model;
        this.wheelRadius = m.wheelRadius || 0.38;
        this.modelWheels = m.wheels;
        this.bodyGroup.add(m.root);
        const d = m.dims;
        this.camDims = {
            frontZ: d.frontZ,
            rearZ: d.rearZ,
            topY: d.topY,
            length: d.length,
            width: d.width
        };
        const w2 = d.width / 2;
        this.collHalfW = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(d.width / 2, 0.85, 1.5);
        this.collHalfL = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(d.length / 2, 2.0, 3.0);
        // lights
        const headMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xfff2cf
        });
        this.owned.push(headMat);
        for (const sx of [
            1,
            -1
        ]){
            const head = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.34, 0.1, 0.06), headMat);
            head.position.set(sx * w2 * 0.62, d.topY * 0.62, d.frontZ - 0.02);
            this.bodyGroup.add(head);
        }
        const tailMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xff2222
        });
        this.owned.push(tailMat);
        for (const sx of [
            1,
            -1
        ]){
            const tail = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.4, 0.1, 0.06), tailMat);
            tail.position.set(sx * w2 * 0.6, d.topY * 0.6, d.rearZ + 0.02);
            this.bodyGroup.add(tail);
        }
        // red bloom sprites at the tail lights — rivals ship baked emissive
        // tails (GT-R "taillight" @ 1.0); models without them looked dark
        // from the chase cam, so every model car gets the same night glow
        const glowTex = radialGlowTexture();
        const tailGlowMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            map: glowTex,
            color: 0xff2a1a,
            transparent: true,
            opacity: 0.9,
            blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
            depthWrite: false
        });
        this.owned.push(tailGlowMat, glowTex);
        for (const sx of [
            1,
            -1
        ]){
            const glow = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](0.6, 0.6), tailGlowMat);
            glow.rotation.y = Math.PI; // face rearward
            glow.position.set(sx * w2 * 0.6, d.topY * 0.6, d.rearZ + 0.07);
            glow.renderOrder = 3;
            this.bodyGroup.add(glow);
        }
        this.brakeLights = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](d.width * 0.8, 0.09, 0.06), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
            depthWrite: false
        }));
        this.owned.push(this.brakeLights.material);
        this.brakeLights.position.set(0, d.topY * 0.62, d.rearZ + 0.03);
        this.bodyGroup.add(this.brakeLights);
        // nitro flames
        const flameMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xffb347,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        this.owned.push(flameMat);
        for (const sx of [
            1,
            -1
        ]){
            const flame = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConeGeometry"](0.12, 0.75, 7), flameMat);
            flame.rotation.x = Math.PI / 2;
            flame.position.set(sx * w2 * 0.35, 0.32, d.rearZ - 0.35);
            flame.visible = false;
            this.nitroFlames.push(flame);
            this.bodyGroup.add(flame);
        }
        // underglow — polygonOffset + clearance keeps it from z-fighting the
        // road when the body pitches/rolls over crests (looked like noise)
        const glowMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            map: glowTex,
            color: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](this.color),
            transparent: true,
            opacity: 0.55,
            blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3
        });
        this.owned.push(glowMat, glowTex);
        const underglow = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](d.width + 0.7, d.length + 0.9), glowMat);
        underglow.rotation.x = -Math.PI / 2;
        underglow.position.y = 0.09;
        underglow.renderOrder = 2;
        this.bodyGroup.add(underglow);
        this.attachHeadlightsAndLabel(d);
        this.group.add(this.bodyGroup);
        this.group.castShadow = true;
    }
    attachHeadlightsAndLabel(d) {
        const w2 = d.width / 2;
        if (this.kind === "player") {
            for (const sx of [
                0.62,
                -0.62
            ]){
                const beam = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SpotLight"](0xfff0c8, 90, 90, 0.45, 0.55, 1.6);
                beam.position.set(sx * w2, d.topY * 0.55, d.frontZ - 0.1);
                const target = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Object3D"]();
                target.position.set(sx * 6, 0, d.frontZ + 34);
                this.bodyGroup.add(target);
                beam.target = target;
                this.bodyGroup.add(beam);
                if (sx > 0) this.headBeamL = beam;
                else this.headBeamR = beam;
            }
        } else {
            const coneMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
                color: 0xfff0c0,
                transparent: true,
                opacity: 0.07,
                blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
                depthWrite: false
            });
            this.owned.push(coneMat);
            const cone = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConeGeometry"](3.2, 16, 8, 1, true), coneMat);
            cone.rotation.x = Math.PI / 2;
            cone.position.set(0, 0.5, d.frontZ + 9.5);
            this.bodyGroup.add(cone);
            if (this.kind === "remote") this.addLabel(d.topY);
        }
    }
    // ─── procedural fallback path (original stacked-box muscle car) ─────────
    buildProceduralVisual() {
        this.collHalfW = 1.05; // body 2.05 wide, wheels at ±0.95
        this.collHalfL = 2.35; // 4.6 long + bumpers
        // shared muscle silhouette — the same builder the showroom turntable
        // uses, so the car you preview in the garage is the car you drive
        // (shell carries body + glass + trim; disposal via the traverse below)
        const shell = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildMuscleBody"])(this.color);
        this.bodyGroup.add(shell.root);
        // lights
        const headMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xfff2cf
        });
        const headL = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.5, 0.16, 0.08), headMat);
        headL.position.set(0.62, 0.48, 2.58);
        const headR = headL.clone();
        headR.position.x = -0.62;
        const tailMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xff2222
        });
        const tailL = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](0.5, 0.14, 0.08), tailMat);
        tailL.position.set(0.6, 0.62, -2.63);
        const tailR = tailL.clone();
        tailR.position.x = -0.6;
        this.brakeLights = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BoxGeometry"](1.7, 0.1, 0.06), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xff0000,
            transparent: true,
            opacity: 0.35,
            blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
            depthWrite: false
        }));
        this.brakeLights.position.set(0, 0.72, -2.64);
        // tail bloom sprites (see model path — matches emissive rivals)
        const glowTex = radialGlowTexture();
        const tailGlowMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            map: glowTex,
            color: 0xff2a1a,
            transparent: true,
            opacity: 0.9,
            blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
            depthWrite: false
        });
        this.owned.push(tailGlowMat, glowTex);
        for (const x of [
            0.6,
            -0.6
        ]){
            const glow = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](0.6, 0.6), tailGlowMat);
            glow.rotation.y = Math.PI;
            glow.position.set(x, 0.62, -2.68);
            glow.renderOrder = 3;
            this.bodyGroup.add(glow);
        }
        // exhaust flames (nitro)
        const flameMat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            color: 0xffb347,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        for (const x of [
            0.45,
            -0.45
        ]){
            const flame = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ConeGeometry"](0.13, 0.8, 7), flameMat);
            flame.rotation.x = Math.PI / 2;
            flame.position.set(x, 0.34, -2.75);
            flame.visible = false;
            this.nitroFlames.push(flame);
            this.bodyGroup.add(flame);
        }
        // underglow (NFS night vibe) — offset material avoids road z-fighting
        const underglow = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PlaneGeometry"](4.2, 6.0), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
            map: glowTex,
            color: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](this.color),
            transparent: true,
            opacity: 0.55,
            blending: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AdditiveBlending"],
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -3,
            polygonOffsetUnits: -3
        }));
        underglow.rotation.x = -Math.PI / 2;
        underglow.position.y = 0.09;
        underglow.renderOrder = 2;
        // wheels — shared builder (tire + gold rim), slots + front flags from
        // the same single source the showroom preview uses
        for (const [x, y, z, front] of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MUSCLE_WHEEL_POS"]){
            const wheel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildMuscleWheel"])();
            wheel.position.set(x, y, z);
            wheel.isFront = front;
            this.wheels.push(wheel);
            this.bodyGroup.add(wheel);
        }
        for (const m of [
            headL,
            headR,
            tailL,
            tailR,
            this.brakeLights
        ])this.bodyGroup.add(m);
        this.bodyGroup.add(underglow);
        this.attachHeadlightsAndLabel({
            frontZ: 2.58,
            topY: 1.25,
            width: 2.05,
            length: 4.6
        });
        this.group.add(this.bodyGroup);
        this.group.castShadow = true;
    }
    addLabel(topY = 1.25) {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "rgba(10,10,12,0.75)";
        roundRect(ctx, 4, 8, 248, 48, 10);
        ctx.fill();
        ctx.font = "bold 30px 'Arial Black', sans-serif";
        ctx.fillStyle = this.color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.name.slice(0, 14).toUpperCase(), 128, 33);
        const tex = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CanvasTexture"](canvas);
        const sprite = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Sprite"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SpriteMaterial"]({
            map: tex,
            transparent: true,
            depthTest: false
        }));
        this.owned.push(tex, sprite.material);
        sprite.scale.set(5.2, 1.3, 1);
        sprite.position.y = topY + 1.4;
        this.group.add(sprite);
        this.label = sprite;
    }
    // ─── physics ────────────────────────────────────────────────────────────
    placeAt(startPos, heading) {
        this.pos.copy(startPos);
        this.heading = heading;
        this.vel.set(0, 0, 0);
        this.speed = 0;
        this.lastTrackIndex = -1;
        this.slipAngle = 0;
        this.driftChain = 0;
        this.drifting = false;
        this.syncVisual(0);
    }
    get forward() {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](Math.sin(this.heading), 0, Math.cos(this.heading));
    }
    get right() {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](-Math.cos(this.heading), 0, Math.sin(this.heading));
    }
    /** Lap progress helpers filled by RaceManager */ lap = 0;
    checkpoint = 0;
    progress = 0;
    finished = false;
    finishTime = 0;
    update(dt, track, controlsEnabled) {
        const T = this.tuning;
        const c = this.controls;
        // locate on track (hint = last index for O(1) search)
        this.loc = track.locate(this.pos, this.lastTrackIndex);
        this.lastTrackIndex = this.loc.index;
        const loc = this.loc;
        const offRoad = Math.abs(loc.lateral) > track.halfWidth;
        // ── decompose velocity ──
        const fwd = this.forward;
        const rgt = this.right;
        let vf = this.vel.dot(fwd);
        let vr = this.vel.dot(rgt);
        if (controlsEnabled && !this.finished) {
            // ── engine / brake ──
            const boosting = c.nitro && this.nitro > 0 && vf > 2;
            if (boosting) {
                this.nitro = Math.max(0, this.nitro - T.nitroDrain * dt);
                vf += T.nitroPower * dt;
            } else {
                this.nitro = Math.min(T.nitroCapacity, this.nitro + T.nitroRegen * dt);
            }
            if (c.throttle > 0) vf += T.enginePower * c.throttle * dt * (vf < 0 ? 2.2 : 1);
            if (c.brake > 0) {
                if (vf > 0.4) vf -= T.brakeForce * c.brake * dt;
                else vf -= T.reversePower * c.brake * dt;
            }
            if (c.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt);
            this.nitroActive = boosting;
            // ── steering ──
            const speedFactor = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(Math.abs(vf) / 3, 0, 1); // no turn at standstill
            const falloff = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(1, T.steerFalloffMin, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp((Math.abs(vf) - T.steerFalloffStart) / (T.maxSpeed - T.steerFalloffStart), 0, 1));
            const yawRate = c.steer * T.steerRate * falloff * speedFactor * (vf < -0.5 ? -1 : 1);
            this.heading -= yawRate * dt;
        } else {
            this.nitroActive = false;
        }
        // ── drag & clamps ──
        const dragCoef = T.drag + (offRoad ? T.offRoadDrag : 0);
        vf -= vf * dragCoef * dt;
        if (c.handbrake) vf -= vf * 0.25 * dt;
        vf = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(vf, -T.maxReverseSpeed, T.maxSpeed + (this.nitroActive ? 8 : 0));
        // ── lateral grip / drift ──
        const gripNow = c.handbrake ? T.driftGrip : T.grip * (1 - 0.25 * __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(Math.abs(vf) / T.maxSpeed, 0, 1));
        vr -= vr * Math.min(gripNow * dt, 0.95);
        // centrifugal bleed: turning at speed naturally pushes lateral velocity
        const turnPush = c.steer * Math.abs(vf) * 0.55 * dt * (c.handbrake ? 1.8 : 1);
        vr += -turnPush * (vf < -0.5 ? -1 : 1) * (c.handbrake ? 1 : 0.35);
        // ── recompose & integrate ──
        const fwd2 = this.forward;
        const rgt2 = this.right;
        this.vel.copy(fwd2).multiplyScalar(vf).addScaledVector(rgt2, vr);
        this.pos.addScaledVector(this.vel, dt);
        this.speed = vf;
        // ── guardrail collision — clamp the car BODY edge to the rail mesh ──
        // The rail visual stands at track.railLateral; the old clamp wall sat
        // 2.2m beyond it, which let cars drive straight through the guardrail.
        const s = track.sampleAt(loc.index);
        _rel.copy(this.pos).sub(s.pos);
        const lateralNow = _rel.dot(s.normal); // post-integration, frame-local
        const maxLateral = track.railLateral - this.collHalfW;
        this.railHit = 0;
        if (Math.abs(lateralNow) > maxLateral) {
            const sign = Math.sign(lateralNow);
            // keep along-track progress so rail-scraping at speed doesn't snap back
            const along = _rel.dot(s.tangent);
            _clamped.copy(s.pos).addScaledVector(s.tangent, along).addScaledVector(s.normal, sign * maxLateral);
            this.pos.x = _clamped.x;
            this.pos.z = _clamped.z;
            // reflect outward velocity component, scrub energy off along the rail
            const vlat = this.vel.dot(s.normal);
            if (Math.sign(vlat) === sign && Math.abs(vlat) > 0.05) {
                this.vel.addScaledVector(s.normal, -vlat * 1.45); // bounce back inward
                // hard hits scrub a lot of speed; shallow grinds bleed gently
                this.vel.multiplyScalar(Math.abs(vlat) > 3 ? 0.82 : 0.97);
                this.railHit = Math.min(Math.abs(vlat), 18);
                // scrape dust at the contact point
                if (Math.abs(vlat) > 3 && Math.random() < 0.75) {
                    const contact = this.pos.clone().addScaledVector(s.normal, sign * this.collHalfW);
                    contact.y += 0.35;
                    this.smokeRequest = {
                        pos: contact,
                        strength: 0.6
                    };
                }
            }
        }
        // ── ride height / pitch from track ──
        const targetY = offRoad ? loc.height - 0.05 : loc.height;
        this.pos.y = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.pos.y, targetY, 1 - Math.exp(-14 * dt));
        this.slipAngle = Math.abs(vf) > 4 ? Math.atan2(Math.abs(vr), Math.abs(vf)) : 0;
        // ── drift scoring ──
        const isDrifting = this.slipAngle > 0.22 && Math.abs(vf) > 12 && Math.abs(loc.lateral) < track.halfWidth + 3;
        if (isDrifting && controlsEnabled && !this.finished) {
            this.driftTimer = 0.9;
            const gain = this.slipAngle * Math.abs(vf) * 14 * dt;
            this.driftChain += gain;
            this.nitro = Math.min(T.nitroCapacity, this.nitro + gain * T.driftNitroGain);
        } else if (this.driftTimer > 0) {
            this.driftTimer -= dt;
            if (this.driftTimer <= 0) {
                this.driftScore += Math.round(this.driftChain);
                this.driftChain = 0;
            }
        }
        this.drifting = isDrifting && this.driftTimer > 0;
        // ── drift smoke request ──
        if ((this.drifting || offRoad && Math.abs(vf) > 6) && Math.random() < 0.7) {
            const back = this.pos.clone().addScaledVector(fwd2, -1.7);
            back.y += 0.25;
            this.smokeRequest = {
                pos: back,
                strength: this.drifting ? 1 : 0.45
            };
        }
        this.syncVisual(dt);
    }
    nitroActive = false;
    /** collision weight (relative, 1 = baseline) — from the car's tuning */ get mass() {
        return this.tuning.mass;
    }
    syncVisual(dt) {
        this.group.position.copy(this.pos);
        this.group.rotation.y = this.heading;
        // pitch from slope + body squat under accel/brake, roll from lateral slip
        const loc = this.loc;
        const pitch = loc ? -loc.slopePitch * 0.9 : 0;
        const targetRoll = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(this.slipAngle * Math.sign(this.vel.dot(this.right)) * -0.5, -0.16, 0.16);
        this.rollVisual = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.rollVisual, targetRoll, 1 - Math.exp(-6 * (dt || 0.016)));
        this.group.rotation.z = this.rollVisual;
        this.group.rotation.x = pitch;
        // wheels
        this.wheelSpin += this.speed / this.wheelRadius * (dt || 0.016);
        for (const w of this.wheels){
            w.rotation.x = this.wheelSpin;
            const isFront = w.isFront;
            if (isFront) w.rotation.y = this.controls.steer * -0.45;
        }
        for (const w of this.modelWheels){
            w.pivot.rotation[w.axis] = this.wheelSpin;
            if (w.isFront) w.pivot.rotation.y = this.controls.steer * -0.45;
        }
        // brake lights
        const braking = this.controls.brake > 0.05;
        this.brakeLights.material.opacity = braking ? 0.95 : 0.3;
        // nitro flames flicker
        for (const f of this.nitroFlames){
            f.visible = this.nitroActive;
            if (this.nitroActive) {
                const s = 0.8 + Math.random() * 0.6;
                f.scale.set(1, s, 1);
            }
        }
        if (this.headBeamL) this.headBeamL.intensity = this.headBeamR.intensity = 95;
    }
    /** Reset onto the road centre facing forward */ resetToTrack(track) {
        const loc = track.locate(this.pos, this.lastTrackIndex);
        const s = track.sampleAt(loc.index);
        this.pos.copy(s.pos).setY(s.pos.y + 0.1);
        this.heading = Math.atan2(s.tangent.x, s.tangent.z);
        this.vel.set(0, 0, 0);
        this.speed = 0;
        this.driftChain = 0;
        this.syncVisual(0);
    }
    snapshot() {
        return {
            p: [
                this.pos.x,
                this.pos.y,
                this.pos.z
            ],
            h: this.heading,
            s: this.speed,
            lap: this.lap,
            cp: this.checkpoint,
            prog: this.progress,
            drifting: this.drifting
        };
    }
    dispose() {
        if (this.model) {
            // model cars share template geometry/textures — only dispose own resources
            for (const r of this.owned)r.dispose();
            this.owned = [];
            for (const pm of this.model.paintMaterials)pm.dispose();
            return;
        }
        this.group.traverse((o)=>{
            const m = o;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x)=>x.dispose());
            else if (mat) mat.dispose();
        });
    }
}
class RemoteCar {
    id;
    car;
    targetPos;
    targetHeading;
    lerp;
    constructor(id, name, color, model){
        this.id = id;
        this.targetPos = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
        this.targetHeading = 0;
        this.lerp = 10;
        this.car = new Car("remote", color, name, model);
    }
    setTarget(snap) {
        this.targetPos.set(snap.p[0], snap.p[1], snap.p[2]);
        // unwrap heading for shortest-path interpolation
        let d = snap.h - this.targetHeading;
        while(d > Math.PI)d -= Math.PI * 2;
        while(d < -Math.PI)d += Math.PI * 2;
        this.targetHeading += d;
        this.car.speed = snap.s;
        this.car.lap = snap.lap;
        this.car.checkpoint = snap.cp;
        this.car.progress = snap.prog;
        this.car.drifting = snap.drifting;
        this.car.controls.brake = 0; // visuals via speed
    }
    update(dt) {
        const t = 1 - Math.exp(-this.lerp * dt);
        this.car.pos.lerp(this.targetPos, t);
        this.car.heading = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.car.heading, this.targetHeading, t);
        this.car.group.position.copy(this.car.pos);
        this.car.group.rotation.y = this.car.heading;
        this.car.syncVisual(dt);
    }
    dispose() {
        this.car.dispose();
    }
}
// ─── helpers ────────────────────────────────────────────────────────────────
function radialGlowTexture() {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CanvasTexture"](canvas);
}
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/AICar.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AICar",
    ()=>AICar
]);
// ─── AI driver: follows the racing line with curvature-aware speed ──────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Car$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/Car.ts [app-client] (ecmascript)");
;
;
;
class AICar extends __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Car$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Car"] {
    skill;
    lateralOffset;
    stuckTimer = 0;
    constructor(color, name, index, model, tuning){
        super("ai", color, name, model, tuning);
        const [lo, hi] = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AI_TUNING"].skillRange;
        this.skill = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(lo, hi, index % 5 / 4);
        this.lateralOffset = [
            -2.2,
            2.2,
            -1.1,
            1.6,
            3.0
        ][index % 5];
    }
    /** drive(dt, track, playerProgress): writes into this.controls */ drive(dt, track, playerProgress, racing) {
        const c = this.controls;
        if (!racing || this.finished) {
            c.throttle = 0;
            c.brake = this.speed > 2 ? 0.4 : 0;
            c.steer = 0;
            c.handbrake = false;
            return;
        }
        const loc = track.locate(this.pos, -1);
        const idx = loc.index;
        // ── steering toward lookahead point on racing line ──
        const metresPerSample = track.length / track.sampleCount;
        const lookSamples = Math.max(4, Math.round(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AI_TUNING"].lookahead / metresPerSample));
        const targetSample = track.sampleAt(idx + lookSamples);
        const target = targetSample.pos.clone().addScaledVector(targetSample.normal, this.lateralOffset * 0.6);
        const toTarget = target.sub(this.pos);
        const fwd = this.forward;
        const cross = fwd.x * toTarget.z - fwd.z * toTarget.x; // sign = side of target
        const angle = Math.atan2(Math.abs(cross), fwd.dot(toTarget));
        // positive cross → target on one side; steer sign chosen so car turns toward it
        c.steer = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp((cross > 0 ? 1 : -1) * angle * 3.2, -1, 1);
        // ── speed target from curvature ahead ──
        let maxCurv = 0;
        for(let ahead = 6; ahead <= lookSamples + 14; ahead += 4){
            maxCurv = Math.max(maxCurv, track.curvatureAt(idx + ahead, 6));
        }
        const cornerLimit = Math.sqrt(0.9 * 9.81 / Math.max(maxCurv, 1e-4)); // µ≈0.9
        const skillTop = this.tuning.maxSpeed * (0.62 + this.skill * 0.4);
        // rubber-banding relative to the player
        const delta = playerProgress - this.progress;
        let rubber = 1;
        if (delta > 40) rubber = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AI_TUNING"].rubberBand.behind;
        else if (delta < -40) rubber = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AI_TUNING"].rubberBand.ahead;
        const rubberBlend = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(Math.abs(delta) / 120, 0, 1);
        rubber = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(1, rubber, rubberBlend);
        const targetSpeed = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(Math.min(cornerLimit * (0.8 + this.skill * 0.3), skillTop) * rubber, 8, this.tuning.maxSpeed * 1.05);
        if (this.speed < targetSpeed - 1) {
            c.throttle = 1;
            c.brake = 0;
            c.nitro = this.speed > 30 && this.speed < 46 && angle < 0.1 && Math.random() < 0.3;
        } else if (this.speed > targetSpeed + 2) {
            c.throttle = 0;
            c.brake = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp((this.speed - targetSpeed) / 12, 0.25, 1);
            c.nitro = false;
        } else {
            c.throttle = 0.35;
            c.brake = 0;
            c.nitro = false;
        }
        // handbrake for hairpins
        c.handbrake = maxCurv > 0.05 && this.speed > cornerLimit * 1.15;
        // ── stuck recovery ──
        if (Math.abs(this.speed) < 1.5 && c.throttle > 0) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 2.4) {
                // reverse out, then snap to track
                if (this.stuckTimer < 4.5) {
                    c.brake = 1;
                    c.throttle = 0;
                    c.steer = -c.steer;
                } else {
                    this.resetToTrack(track);
                    this.stuckTimer = 0;
                }
            }
        } else {
            this.stuckTimer = 0;
        }
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/CarModelLoader.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyPaint",
    ()=>applyPaint,
    "hasCarModel",
    ()=>hasCarModel,
    "instantiateCar",
    ()=>instantiateCar,
    "loadCarModel",
    ()=>loadCarModel,
    "preloadAllCarModels",
    ()=>preloadAllCarModels,
    "registerKTX2Renderer",
    ()=>registerKTX2Renderer
]);
// ─── CarModelLoader: loads, normalizes & rigs GLB car models ─────────────────
// Any GLB dropped into /public/models can become a drivable car:
//   1. normalized: forward +Z, ground y=0, target length, centered
//   2. wheels auto-detected by node name (/wheel/i), axle pairs split L/R,
//      wrapped in spin/steer pivots
//   3. paint materials detected (/carpaint/i or /_details$/) for per-player tint
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.module.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$loaders$2f$GLTFLoader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/examples/jsm/loaders/GLTFLoader.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$loaders$2f$DRACOLoader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/examples/jsm/loaders/DRACOLoader.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$loaders$2f$KTX2Loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/examples/jsm/loaders/KTX2Loader.js [app-client] (ecmascript)");
// the car catalog (ids, model urls, tuning) lives in cars/registry — this
// file is purely the load → normalize → rig pipeline
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
;
;
;
;
;
/** how long every model car is normalized to (matches physics tuning) */ const TARGET_LENGTH = 4.55;
/** wheel mesh wider than this = a merged L+R axle pair needing a split */ const PAIR_WIDTH = 1.15;
/** wheel mesh longer than this = merged front+rear wheels needing a split */ const MERGED_AXLE_LENGTH = 1.2;
/** max distance for attaching loose nodes (brake discs, centre caps) to a wheel */ const ATTACH_RADIUS = 0.55;
const loader = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$loaders$2f$GLTFLoader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GLTFLoader"]();
// Draco-compressed GLBs (decoder is fetched once from /draco/ and cached;
// uncompressed GLBs are unaffected)
const dracoLoader = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$loaders$2f$DRACOLoader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DRACOLoader"]();
dracoLoader.setDecoderPath("/draco/");
dracoLoader.preload();
loader.setDRACOLoader(dracoLoader);
// KTX2 GPU-compressed textures (KHR_texture_basisu): decode straight to the
// GPU's native format (BC7/ASTC/ETC2) — stays compressed in VRAM, ~6-8x less
// than WebP which unpacks to raw RGBA. Transcoder cached from /ktx2/.
const ktx2Loader = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$loaders$2f$KTX2Loader$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["KTX2Loader"]();
ktx2Loader.setTranscoderPath("/ktx2/");
loader.setKTX2Loader(ktx2Loader);
// KTX2Loader needs to know the GPU's supported formats BEFORE the first
// KTX2 GLB is parsed — but models preload on the menu screen, before any
// renderer exists. Probe once with a throwaway 1x1 context; the detected
// formats persist on the loader (real renderers re-register later).
let ktx2Probed = false;
function ensureKTX2Support() {
    if (ktx2Probed) return;
    ktx2Probed = true;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const probe = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["WebGLRenderer"]({
            canvas
        });
        ktx2Loader.detectSupport(probe);
        probe.dispose();
        probe.forceContextLoss();
    } catch (e) {
        console.warn("[CarModelLoader] KTX2 GPU-texture probe failed:", e);
    }
}
function registerKTX2Renderer(renderer) {
    ktx2Loader.detectSupport(renderer);
}
const templates = new Map();
const inflight = new Map();
function loadCarModel(id) {
    const def = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carDef"])(id);
    if (!def) return Promise.reject(new Error(`unknown car "${id}"`));
    if (!def.modelUrl) return Promise.resolve(null);
    const cached = templates.get(id);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.get(id);
    if (pending) return pending;
    ensureKTX2Support(); // probe GPU formats before the first KTX2 GLB parse
    const p = loader.loadAsync(def.modelUrl).then((gltf)=>{
        const tpl = buildTemplate(id, gltf.scene);
        templates.set(id, tpl);
        inflight.delete(id);
        return tpl;
    }).catch((err)=>{
        inflight.delete(id);
        throw err;
    });
    inflight.set(id, p);
    return p;
}
function preloadAllCarModels() {
    return Promise.allSettled(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAR_LIBRARY"].map((c)=>loadCarModel(c.id)));
}
function hasCarModel(id) {
    return templates.has(id);
}
function instantiateCar(id, paintColor) {
    const tpl = templates.get(id);
    if (!tpl) return null;
    const root = tpl.wrapper.clone(true);
    // clone paint materials per-instance (so tinting one car doesn't tint all)
    const paintMaterials = [];
    const cloneMap = new Map();
    root.traverse((o)=>{
        const mesh = o;
        if (!mesh.isMesh || !mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [
            mesh.material
        ];
        const replaced = mats.map((m)=>{
            if (!tpl.paintNames.has(m.name ?? "")) return m;
            let c = cloneMap.get(m);
            if (!c) {
                c = m.clone();
                cloneMap.set(m, c);
                paintMaterials.push(c);
            }
            return c;
        });
        mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0];
    });
    if (paintColor) applyPaint(paintMaterials, paintColor);
    // collect wheel pivots from the clone (stable names from the template rig)
    const wheels = [];
    root.traverse((o)=>{
        const g = o;
        const m = /^wheelPivot_(F|R)(L|R)$/.exec(g.name ?? "");
        if (m) {
            wheels.push({
                pivot: g,
                isFront: m[1] === "F",
                side: m[2],
                radius: tpl.wheelRadius,
                axis: g.userData.spinAxis === "z" ? "z" : "x"
            });
        }
    });
    return {
        root,
        wheels,
        dims: {
            ...tpl.dims
        },
        wheelRadius: tpl.wheelRadius,
        paintMaterials
    };
}
function applyPaint(mats, color) {
    const c = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](color);
    for (const m of mats){
        // textured paints get a tint; plain paints get the full colour
        if (m.map) m.color.copy(c.clone().lerp(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](1, 1, 1), 0.25));
        else m.color.copy(c);
    }
}
// ─── template build: normalize + rig ────────────────────────────────────────
function buildTemplate(id, scene) {
    const wrapper = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
    wrapper.name = `carModel_${id}`;
    wrapper.add(scene);
    wrapper.updateMatrixWorld(true);
    // strip transmission (heavy per-frame render pass) → plain transparent glass
    scene.traverse((o)=>{
        const m = o.material;
        const list = Array.isArray(m) ? m : m ? [
            m
        ] : [];
        for (const mat of list){
            if (mat.isMeshPhysicalMaterial && mat.transmission > 0) {
                mat.transmission = 0;
                mat.transparent = true;
                mat.opacity = Math.min(mat.opacity >= 1 ? 0.4 : mat.opacity, 0.5);
                mat.depthWrite = false;
            }
        }
    });
    // ── strip showcase environment (Sketchfab studio floor/ceiling/curtains) ──
    // Giant or far-away meshes poison the bbox used for normalization (toy-car
    // scale, wrong forward axis). Runs BEFORE any bbox math.
    pruneShowroom(scene);
    // ── tag wheel-assembly groups BEFORE flatten ──
    // Game rips (CSR2/Forza) carry each wheel as a multi-mesh assembly under a
    // generically named group ("Object_4.001") whose tire mesh has no wheel-ish
    // name at all. Renaming qualifying groups lets flatten's semanticName carry
    // wheel identity down to EVERY child (tire, caps, badges) so the whole
    // assembly spins with the rim.
    tagWheelAssemblies(scene);
    // ── normalize: longest horizontal axis = forward (+Z), ground y=0 ──
    let bbox = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(wrapper);
    if (bbox.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).x > bbox.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).z) {
        wrapper.rotation.y = Math.PI / 2; // sideways model → rotate onto Z
        wrapper.updateMatrixWorld(true);
        bbox = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(wrapper);
    }
    const size = bbox.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
    const scale = TARGET_LENGTH / size.z;
    wrapper.scale.setScalar(scale);
    wrapper.updateMatrixWorld(true);
    bbox = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(wrapper);
    const center = bbox.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
    wrapper.position.x -= center.x;
    wrapper.position.z -= center.z;
    // forward direction: front wheels should sit at +Z
    const anchorProbe = findWheelAnchors(wrapper);
    if (anchorProbe.length > 0) {
        const namedFront = anchorProbe.find((a)=>/ft|front|fr\b/i.test(a.node.name));
        const namedRear = anchorProbe.find((a)=>/bk|rear|rr\b/i.test(a.node.name));
        if (namedFront && namedRear) {
            wrapper.updateMatrixWorld(true);
            const f = namedFront.node.getWorldPosition(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
            const r = namedRear.node.getWorldPosition(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
            if (f.z < r.z) {
                wrapper.rotation.y += Math.PI;
                wrapper.updateMatrixWorld(true);
            }
        }
    }
    // forward fallback for models whose semantics live in MATERIAL names
    // (generic "Object_42" nodes): head/fog lights at one end, tail/brake at
    // the other — orient so the lit end faces +Z
    if (!anchorProbe.some((a)=>/ft|front|fr\b|bk|rear|rr\b/i.test(a.node.name))) {
        const headZ = lightCentreZ(wrapper, /head.?light|fog.?light|front.?light|low.?beam|high.?beam/i);
        const tailZ = lightCentreZ(wrapper, /tail|brake.?light|reverse.?light|rear.?light|plate|license/i);
        if (headZ !== null && tailZ !== null && headZ < tailZ) {
            wrapper.rotation.y += Math.PI;
            wrapper.updateMatrixWorld(true);
        }
    }
    wrapper.updateMatrixWorld(true);
    bbox = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(wrapper);
    wrapper.position.y -= bbox.min.y; // ground contact
    wrapper.updateMatrixWorld(true);
    bbox = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(wrapper);
    const sz = bbox.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
    const ctr = bbox.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
    const dims = {
        length: sz.z,
        width: sz.x,
        height: sz.y,
        frontZ: bbox.max.z - 0.06,
        rearZ: bbox.min.z + 0.06,
        topY: bbox.max.y
    };
    // ── flatten: bake the normalization transform into the geometry itself ──
    // Afterwards the wrapper is the identity frame: world == local for every
    // mesh, so corner boxes, pivot positions and spin axes all live in ONE
    // consistent space (fixes wheels orbiting a displaced pivot when the model
    // was scaled/rotated/flipped during normalization).
    flattenTransforms(wrapper, id);
    // ── sweep showcase junk: animation-pose ghost meshes parked far outside
    // the car volume (they would drag wheel pivots sky-high and cast stray
    // shadows). Runs BEFORE rigging so ghosts never enter the corner math.
    sweepJunk(wrapper, dims);
    // ── rig wheels ──
    const { wheelRadius } = rigWheels(wrapper);
    // paint material names
    const paintNames = new Set();
    wrapper.traverse((o)=>{
        const mesh = o;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [
            mesh.material
        ];
        for (const m of mats){
            const mn = m?.name ?? "";
            // "…_by_Author": Sketchfab materialmerger names the primary body
            // material after the model — treat it as paint so garage colours work.
            // "painted2"/"pickup": CSR2 game rips name the tintable body paint
            // "<car>_painted<N>" / "pickup" (a leftover name, never "pickup_glass")
            if (m && (/carpaint/i.test(mn) || /(^|_)details$|(^|_)paint$/i.test(mn) || /by[_\s]/i.test(mn) || /painted/i.test(mn) || /(^|_)pickup$/i.test(mn))) {
                paintNames.add(m.name);
            }
        }
    });
    // ── night-light boost ──
    // Rips/exporters often bake light meshes with a faint gray emissive
    // (e.g. SRT10 "Lights_315" @ 0.35) while other cars ship full-bright
    // light mats. Lift the dim ones so every car's lights visibly glow at
    // night like its rivals; already-bright materials are left untouched.
    wrapper.traverse((o)=>{
        const mesh = o;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [
            mesh.material
        ];
        for (const m of mats){
            const sm = m;
            if (!sm || !sm.emissive) continue;
            if (!/light|tail|lamp|emiss|glow/i.test(sm.name ?? "")) continue;
            const s = sm.emissive.r + sm.emissive.g + sm.emissive.b;
            if (s >= 0.05 && s < 1.5) sm.emissive.multiplyScalar(2.2);
        }
    });
    // shadows for the whole car
    wrapper.traverse((o)=>{
        const mesh = o;
        if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = false;
        }
    });
    return {
        url: id,
        wrapper,
        dims,
        wheelRadius,
        paintNames
    };
}
/** wheel-ish names in MATERIALS — Sketchfab OBJ→glTF exports carry all
 *  semantics in material names (tireL, rim1, brakedisk…) while nodes are
 *  generic "Object_42" */ const WHEEL_MAT = /wheel|tire|tyre|(^|[_\s\d])rim|rim($|[_\s\d.])|brake/i;
/** wheel-ish material names that are NOT wheels (lights, signals, interior) */ const MAT_EXCLUDE = /light|lamp|glow|steer|turn|pedal/i;
/** every semantic label of a mesh: node name + its material names */ function meshLabels(m) {
    const mats = Array.isArray(m.material) ? m.material : m.material ? [
        m.material
    ] : [];
    return `${m.name ?? ""} ${mats.map((x)=>x?.name ?? "").join(" ")}`;
}
function findWheelAnchors(root) {
    const anchors = [];
    const anchored = new Set();
    // 1) wheel-NAMED nodes (the classic rig: "Wheel.Ft.L", "wheel_FL"…)
    root.traverse((o)=>{
        const name = o.name ?? "";
        // "steer" keeps the steering WHEEL (interior) out of the wheel rig
        if (!(/wheel/i.test(name) && !/brake|steer/i.test(name))) return;
        const meshes = [];
        if (o.isMesh) meshes.push(o);
        o.traverse((c)=>{
            if (c.isMesh && c !== o) meshes.push(c);
        });
        if (meshes.length) {
            anchors.push({
                node: o,
                meshes
            });
            for (const m of meshes)anchored.add(m);
        }
    });
    // 2) wheel-named MATERIALS on generically-named meshes
    root.traverse((o)=>{
        const m = o;
        if (!m.isMesh || anchored.has(m)) return;
        const labels = meshLabels(m);
        if (!WHEEL_MAT.test(labels) || MAT_EXCLUDE.test(labels)) return;
        anchors.push({
            node: m,
            meshes: [
                m
            ]
        });
        anchored.add(m);
    });
    return anchors;
}
/**
 * Rig wheels in the identity frame established by flattenTransforms():
 * every mesh is a flat wrapper child with an identity transform and geometry
 * already in final car space, so world boxes == local boxes and pivots land
 * exactly on the wheel centres they spin around.
 */ function rigWheels(wrapper) {
    const anchors = findWheelAnchors(wrapper);
    wrapper.updateMatrixWorld(true);
    const pieces = [];
    // shared piece pipeline: split merged L+R pairs and merged F+R axles so
    // every piece lands in exactly one corner (a whole-car "brakedisk" mesh
    // would otherwise drag one corner's pivot across the car)
    const addPiece = (mesh, forceBrake = false)=>{
        let parts = [
            mesh
        ];
        const wb = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(mesh);
        if (wb.max.x - wb.min.x > PAIR_WIDTH) {
            // merged L+R axle pair → split at the car centre line
            const halves = splitMeshByPlane(mesh, "x", 0);
            wrapper.remove(mesh);
            mesh.geometry.dispose();
            parts = halves;
        }
        for (const part of parts){
            const b = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(part);
            if (b.max.z - b.min.z > MERGED_AXLE_LENGTH) {
                // merged front+rear wheels (one mesh per side) → split at the
                // axle gap, which straddles the car centre
                const ends = splitMeshByPlane(part, "z", 0);
                part.parent?.remove(part);
                part.geometry.dispose();
                for (const e of ends)pieces.push({
                    mesh: e,
                    isBrake: forceBrake || /brake/i.test(meshLabels(e))
                });
            } else {
                pieces.push({
                    mesh: part,
                    isBrake: forceBrake || /brake/i.test(meshLabels(part))
                });
            }
        }
    };
    for (const a of anchors){
        for (const m of a.meshes)addPiece(m);
    }
    // brake discs / centre caps / calipers: named parts that ride with a wheel
    wrapper.traverse((o)=>{
        const m = o;
        if (!m.isMesh) return;
        if (/pedal/i.test(meshLabels(m))) return; // gas/clutch/brake pedals are interior, not wheel hardware
        if (/brake|disc|cap|caliper/i.test(meshLabels(m))) {
            if (!pieces.some((p)=>p.mesh === m)) addPiece(m, true);
        }
    });
    if (pieces.length === 0) return {
        wheelRadius: 0.38
    };
    const corners = [];
    const cornerFor = (mesh, isBrake)=>{
        const b = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(mesh);
        const c = b.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
        const front = c.z > 0;
        const side = c.x >= 0 ? "L" : "R";
        const key = `${front ? "F" : "R"}${side}`;
        let corner = corners.find((k)=>k.key === key);
        if (!corner) {
            corner = {
                key,
                meshes: [],
                bbox: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"](),
                drive: !isBrake
            };
            corners.push(corner);
        }
        corner.meshes.push(mesh);
        return corner;
    };
    for (const p of pieces){
        const c = cornerFor(p.mesh, p.isBrake);
        c.bbox.expandByObject(p.mesh);
        if (!p.isBrake) c.drive = true;
    }
    // ── prune non-wheel junk that rode in with the anchors ──
    // Showcase rigs parent badges/logos under wheel nodes; their tiny boxes
    // drag the corner bbox (and with it the spin pivot) off the wheel hub.
    // Keep pieces that are comparably sized to the corner's largest piece or
    // sit on the hub; reject the rest back to the static body.
    for (const corner of corners){
        if (corner.meshes.length < 2) continue;
        const boxes = new Map();
        let largest = null;
        let largestDim = 0;
        for (const m of corner.meshes){
            const b = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m);
            boxes.set(m, b);
            const d = b.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length();
            if (d > largestDim) {
                largestDim = d;
                largest = m;
            }
        }
        if (!largest) continue;
        const hub = boxes.get(largest).getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
        const kept = corner.meshes.filter((m)=>{
            if (m === largest) return true;
            const b = boxes.get(m);
            const dim = b.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length();
            const centre = b.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
            return dim >= 0.25 * largestDim || centre.distanceTo(hub) < 0.18;
        });
        if (kept.length === corner.meshes.length) continue;
        const bbox = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]();
        for (const m of kept)bbox.union(boxes.get(m));
        corner.meshes = kept;
        corner.bbox = bbox;
    }
    // small unnamed pieces hugging a wheel centre (e.g. GT-R centre caps)
    // join that wheel so they spin with it — never whole body panels
    const pieceSet = new Set(pieces.map((p)=>p.mesh));
    for (const child of [
        ...wrapper.children
    ]){
        const m = child;
        if (!m.isMesh || pieceSet.has(m)) continue;
        const name = meshLabels(m).toLowerCase();
        if (name.includes("wheel") || name.includes("brake") || name.includes("light")) continue;
        if (new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m).getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length() > 1.1) continue;
        const c = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m).getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
        for (const corner of corners){
            if (!corner.drive) continue;
            const centre = corner.bbox.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
            if (c.distanceTo(centre) < ATTACH_RADIUS) {
                corner.meshes.push(m);
                corner.bbox.expandByObject(m);
                pieceSet.add(m);
                break;
            }
        }
    }
    // ── build a pivot per corner ──
    let wheelRadius = 0.38;
    for (const corner of corners){
        if (!corner.drive) continue;
        const centre = corner.bbox.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
        const sz = corner.bbox.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
        wheelRadius = Math.max(wheelRadius, sz.y / 2);
        // axle = thinnest horizontal axis
        const axis = sz.x <= sz.z ? "x" : "z";
        const pivot = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
        pivot.name = `wheelPivot_${corner.key}`;
        pivot.rotation.order = axis === "x" ? "YXZ" : "YZX";
        pivot.userData.spinAxis = axis;
        pivot.position.copy(centre);
        wrapper.add(pivot);
        // attach() preserves world transforms — with the wrapper at identity the
        // mesh lands exactly at pivot-local (−centre), spinning on its own hub
        for (const mesh of corner.meshes)pivot.attach(mesh);
    }
    return {
        wheelRadius
    };
}
/** name patterns that mark a node as wheel hardware (mesh or ancestor) */ const WHEELISH = /wheel|brake|disc|caliper|tire|tyre|rim/i;
/**
 * Replace an attribute with a plain non-interleaved Float32 copy.
 * getComponent() returns denormalized values, so quantized (normalized
 * integer) and interleaved attributes become safe for applyMatrix4().
 */ function dequantizeAttribute(geo, name) {
    const attr = geo.getAttribute(name);
    if (!attr) return;
    const plain = attr;
    if (!plain.isInterleavedBufferAttribute && !plain.normalized && plain.array instanceof Float32Array) {
        return; // already a plain float attribute
    }
    const itemSize = attr.itemSize;
    const out = new Float32Array(attr.count * itemSize);
    for(let i = 0; i < attr.count; i++){
        for(let c = 0; c < itemSize; c++){
            out[i * itemSize + c] = attr.getComponent(i, c);
        }
    }
    geo.setAttribute(name, new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferAttribute"](out, itemSize));
}
/** flat mesh name: own name if wheel-ish, else nearest wheel-ish ancestor + own */ function semanticName(mesh, root) {
    const own = mesh.name ?? "";
    if (WHEELISH.test(own)) return own;
    let p = mesh.parent;
    while(p && p !== root){
        const n = p.name ?? "";
        if (WHEELISH.test(n)) return own ? `${n}_${own}` : n;
        p = p.parent;
    }
    return own;
}
/**
 * Bake the wrapper's normalization transform (scale/rotation/ground offset)
 * into every geometry and reparent all meshes flat under the wrapper, which
 * is then reset to the identity transform. Kills frame mismatches between
 * baked geometry, pivot positions and spin axes — no matter how the source
 * model was oriented, scaled or flipped.
 */ function flattenTransforms(wrapper, id = "") {
    wrapper.updateMatrixWorld(true);
    const meshes = [];
    wrapper.traverse((o)=>{
        const m = o;
        if (m.isMesh && m.parent !== wrapper) meshes.push(m);
    });
    if (meshes.length === 0) return;
    const copies = [];
    for (const mesh of meshes){
        mesh.updateWorldMatrix(true, false);
        if (mesh.isSkinnedMesh) {
            console.warn(`[CarModelLoader] skinned mesh "${mesh.name}" frozen to static pose`);
        }
        const geo = mesh.geometry.clone();
        // GLTF quantized models keep positions as NORMALIZED int16/int8 —
        // applyMatrix4() would truncate transformed floats back into the integer
        // array (geometry garbage). Convert to plain Float32 first.
        dequantizeAttribute(geo, "position");
        dequantizeAttribute(geo, "normal");
        dequantizeAttribute(geo, "tangent");
        geo.applyMatrix4(mesh.matrixWorld);
        const copy = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](geo, mesh.material);
        // keep wheel identity alive through flattening: meshes with generic
        // names (e.g. "Nismo-027001") inherit the nearest wheel-ish ancestor
        // name ("Wheel.Ft.L_...") so rigWheels can still find them
        copy.name = semanticName(mesh, wrapper);
        copies.push(copy);
    }
    // drop the original hierarchy and make the wrapper the identity frame
    for (const child of [
        ...wrapper.children
    ])wrapper.remove(child);
    wrapper.position.set(0, 0, 0);
    wrapper.rotation.set(0, 0, 0);
    wrapper.scale.setScalar(1);
    wrapper.updateMatrixWorld(true);
    for (const copy of copies)wrapper.add(copy);
    // free the pre-bake geometries — the flat copies own their baked clones
    const disposed = new Set();
    for (const mesh of meshes){
        if (mesh.geometry && !disposed.has(mesh.geometry)) {
            disposed.add(mesh.geometry);
            mesh.geometry.dispose();
        }
    }
}
/**
 * Remove meshes whose centre sits far outside the car volume — showcase
 * leftovers such as animation-pose ghost wheels hovering 28 m above the car.
 * They would otherwise drag wheel pivots sky-high, sweep through the road
 * while spinning and cast stray shadows.
 */ function sweepJunk(wrapper, dims) {
    const halfW = dims.width / 2 + 0.6;
    const halfL = Math.max(dims.length, 1) / 2 + 0.6;
    const maxY = dims.topY + 0.8;
    for (const child of [
        ...wrapper.children
    ]){
        const m = child;
        if (!m.isMesh) continue;
        const c = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m).getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]());
        if (c.y > maxY || c.y < -0.6 || Math.abs(c.x) > halfW || Math.abs(c.z) > halfL) {
            wrapper.remove(m);
            m.geometry.dispose();
            continue;
        }
        // flat ground-shadow quads (Sketchfab "carshadow") sit exactly on the
        // road plane and z-fight with it at speed
        if (/shadow/i.test(meshLabels(m)) && new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m).getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).y < 0.08) {
            wrapper.remove(m);
            m.geometry.dispose();
        }
    }
}
/**
 * Game rips (CSR2/Forza) ship each wheel as a multi-mesh assembly under a
 * generically named group ("Object_4.001"): rim + brake + caliper carry
 * wheel-ish names, but the tire ("Scene_-_Root") and caps/badges do not —
 * without help they stay welded to the body while the rim spins inside them.
 * A group whose DIRECT mesh children include >= 2 wheel-ish parts AND whose
 * children span only a wheel-sized cluster (vs the whole scene — v1's OBJ
 * container holds 58 meshes across the entire car) is a wheel assembly:
 * renaming it lets semanticName()/WHEEL_MAT see every child as wheel
 * hardware so the whole assembly is rigged to the corner pivot.
 */ function tagWheelAssemblies(root) {
    const WHEELISH_GROUP = /wheel|tire|tyre|rim|brake|caliper|disc/i;
    root.updateMatrixWorld(true);
    const sceneDiag = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(root).getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length();
    if (!(sceneDiag > 0)) return;
    root.traverse((o)=>{
        const g = o;
        if (!g.children || g.children.length < 2) return;
        if (WHEELISH_GROUP.test(g.name ?? "")) return;
        let wheelish = 0;
        let meshes = 0;
        const box = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]();
        for (const c of g.children){
            const m = c;
            if (!m.isMesh) continue;
            meshes++;
            box.expandByObject(m);
            const label = meshLabels(m);
            if (WHEELISH_GROUP.test(label) && !MAT_EXCLUDE.test(label)) wheelish++;
        }
        if (meshes < 2 || wheelish < 2) return;
        // containers (RootNode / OBJ merge roots) span the whole car — never tag
        const span = box.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length();
        if (span > 0.25 * sceneDiag) return;
        g.name = `wheelAssy_${g.name ?? "group"}`;
    });
}
/**
 * Strip the showcase environment that Sketchfab studio exports bake into
 * the file: a giant floor/ceiling/curtain box around the car plus far-away
 * props (banners, stands). They poison the bounding box used for
 * normalization (toy-car scale, wrong forward axis), so this runs BEFORE
 * any bbox math. Scale-invariant: thresholds are relative to mesh statistics.
 */ function pruneShowroom(root) {
    const meshes = [];
    root.traverse((o)=>{
        const m = o;
        if (m.isMesh) meshes.push(m);
    });
    if (meshes.length < 4) return;
    const boxes = new Map();
    const diags = [];
    for (const m of meshes){
        const b = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m);
        if (b.isEmpty()) continue;
        boxes.set(m, b);
        diags.push(b.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length());
    }
    if (diags.length < 4) return;
    diags.sort((a, b)=>a - b);
    const p90 = diags[Math.floor(diags.length * 0.9)];
    // pass 1 — giants: a showroom floor/ceiling/curtain dwarfs EVERY car part.
    // Detailed game rips have huge body shells that can trip a naive size
    // filter, so giants are only pruned when they truly dwarf the largest
    // surviving car part (ratio < 0.4). Otherwise the "giants" ARE the car.
    let alive = [
        ...boxes.entries()
    ].filter(([, b])=>b.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length() <= p90 * 2);
    if (alive.length === 0) return;
    if (alive.length < boxes.size) {
        const giantDiags = [
            ...boxes.entries()
        ].filter(([m])=>!alive.some(([am])=>am === m)).map(([, b])=>b.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length());
        const biggestCar = Math.max(...alive.map(([, b])=>b.getSize(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).length()));
        const smallestGiant = Math.min(...giantDiags);
        if (biggestCar >= 0.4 * smallestGiant) {
            alive = [
                ...boxes.entries()
            ]; // no real showroom here — keep everything
        }
    }
    // pass 2 — far props: outside the dense car cluster around the centroid
    if (alive.length > 3) {
        const centroid = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
        for (const [, b] of alive)centroid.add(b.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()));
        centroid.multiplyScalar(1 / alive.length);
        const near = alive.filter(([, b])=>b.getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).distanceTo(centroid) < Math.max(p90 * 0.9, 0.5));
        if (near.length >= 3 && near.length < alive.length) alive = near;
    }
    const survivors = new Set(alive.map(([m])=>m));
    for (const m of meshes){
        if (!boxes.has(m) || survivors.has(m)) continue;
        m.parent?.remove(m);
        m.geometry.dispose();
    }
}
/** average world Z of meshes whose node/material names match `re` */ function lightCentreZ(root, re) {
    let acc = 0;
    let n = 0;
    root.traverse((o)=>{
        const m = o;
        if (!m.isMesh || !re.test(meshLabels(m))) return;
        acc += new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Box3"]().setFromObject(m).getCenter(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]()).z;
        n++;
    });
    return n > 0 ? acc / n : null;
}
/** split a baked (identity-transform) mesh by a local x/z plane into halves */ function splitMeshByPlane(mesh, axis, splitAt) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
    const coord = axis === "x" ? (i)=>pos.getX(i) : (i)=>pos.getZ(i);
    const leftTris = [];
    const rightTris = [];
    for(let t = 0; t < triCount; t++){
        const a = idx ? idx.getX(t * 3) : t * 3;
        const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
        const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
        const centre = (coord(a) + coord(b) + coord(c)) / 3;
        (centre < splitAt ? leftTris : rightTris).push(a, b, c);
    }
    const out = [];
    for (const tris of [
        leftTris,
        rightTris
    ]){
        if (tris.length === 0) continue;
        const g = extractTriangles(geo, tris);
        const m = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](g, mesh.material);
        m.name = `${mesh.name}_${axis}half`;
        m.castShadow = true;
        mesh.parent?.add(m);
        out.push(m);
    }
    return out;
}
function extractTriangles(geo, triIndices) {
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const remap = new Map();
    const newPos = [];
    const newNor = [];
    const newUv = [];
    const newIndex = [];
    for (const vi of triIndices){
        let ni = remap.get(vi);
        if (ni === undefined) {
            ni = newPos.length / 3;
            remap.set(vi, ni);
            newPos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
            if (nor) newNor.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
            if (uv) newUv.push(uv.getX(vi), uv.getY(vi));
        }
        newIndex.push(ni);
    }
    const g = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferGeometry"]();
    g.setAttribute("position", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](newPos, 3));
    if (newNor.length) g.setAttribute("normal", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](newNor, 3));
    if (newUv.length) g.setAttribute("uv", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Float32BufferAttribute"](newUv, 2));
    g.setIndex(newIndex);
    return g;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/Particles.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ParticlePool",
    ()=>ParticlePool
]);
// ─── Lightweight particle pool for drift smoke / dust ───────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
;
class ParticlePool {
    points;
    puffs = [];
    max;
    positions;
    constructor(max = 220){
        this.max = max;
        this.positions = new Float32Array(max * 3);
        const sizes = new Float32Array(max);
        const opacities = new Float32Array(max);
        for(let i = 0; i < max; i++){
            this.positions[i * 3 + 1] = -9999;
            this.puffs.push({
                pos: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](0, -9999, 0),
                vel: new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](),
                life: 0,
                maxLife: 1,
                size: 1
            });
        }
        const geo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferGeometry"]();
        geo.setAttribute("position", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferAttribute"](this.positions, 3));
        geo.setAttribute("size", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferAttribute"](sizes, 1));
        geo.setAttribute("opacity", new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BufferAttribute"](opacities, 1));
        const mat = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ShaderMaterial"]({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uTex: {
                    value: puffTexture()
                }
            },
            vertexShader: /* glsl */ `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (260.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
            fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        varying float vOpacity;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          gl_FragColor = vec4(vec3(0.82, 0.78, 0.72), t.a * vOpacity);
        }
      `
        });
        this.points = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Points"](geo, mat);
        this.points.frustumCulled = false;
    }
    emit(pos, strength) {
        const puff = this.puffs.find((p)=>p.life <= 0);
        if (!puff) return;
        puff.pos.copy(pos);
        puff.vel.set((Math.random() - 0.5) * 2.4, 1.4 + Math.random() * 1.8, (Math.random() - 0.5) * 2.4);
        puff.maxLife = 0.85 + Math.random() * 0.5;
        puff.life = puff.maxLife;
        puff.size = 0.9 + Math.random() * 1.4 * strength;
    }
    update(dt) {
        const sizes = this.points.geometry.getAttribute("size");
        const opacities = this.points.geometry.getAttribute("opacity");
        for(let i = 0; i < this.max; i++){
            const p = this.puffs[i];
            if (p.life > 0) {
                p.life -= dt;
                p.pos.addScaledVector(p.vel, dt);
                p.vel.multiplyScalar(1 - 1.4 * dt);
                p.size += dt * 1.9;
                const t = Math.max(p.life / p.maxLife, 0);
                this.positions[i * 3] = p.pos.x;
                this.positions[i * 3 + 1] = p.pos.y;
                this.positions[i * 3 + 2] = p.pos.z;
                sizes.array[i] = p.size;
                opacities.array[i] = t * 0.5;
            } else {
                this.positions[i * 3 + 1] = -9999;
                opacities.array[i] = 0;
            }
        }
        this.points.geometry.getAttribute("position").needsUpdate = true;
        sizes.needsUpdate = true;
        opacities.needsUpdate = true;
    }
    dispose() {
        this.points.geometry.dispose();
        this.points.material.dispose();
    }
}
function puffTexture() {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CanvasTexture"](canvas);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/world/Collisions.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveCarCollisions",
    ()=>resolveCarCollisions
]);
// ─── Car-vs-car collision: oriented-box SAT + arcade impulse response ───────
// Cars are rotated rectangles in the XZ plane (heading + collHalfL/W).
// Resolution = positional separation along the minimum translation vector
// plus a mass-weighted impulse exchange (per-car tuning mass), a tangential
// scrub and a small yaw kick on offset hits so contacts feel physical.
// Remote cars are skipped: their transforms are network-authoritative and
// act as ghosts.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
;
const RESTITUTION = 0.25; // bounce of car-to-car hits
const TANGENT_SCRUB = 0.12; // fraction of relative tangential velocity killed
const YAW_GAIN = 0.01; // heading kick strength from offset hits
const YAW_MAX = 0.05; // rad per pair per frame
const SLOP = 0.02; // penetration allowance (m)
const MAX_SEPARATION = 1.6; // total per pair per frame (spawn-recovery safety)
const FX_MIN_IMPACT = 1.5; // m/s closing speed needed to report a contact
// scratch — avoid per-frame allocations
const _n = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
const _t = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
const _point = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
function resolveCarCollisions(cars) {
    const contacts = [];
    for(let i = 0; i < cars.length; i++){
        const a = cars[i];
        if (a.kind === "remote") continue;
        for(let j = i + 1; j < cars.length; j++){
            const b = cars[j];
            if (b.kind === "remote") continue;
            const contact = resolvePair(a, b);
            if (contact) contacts.push(contact);
        }
    }
    return contacts;
}
function resolvePair(a, b) {
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    // broad phase — bounding circles
    const rA = Math.hypot(a.collHalfL, a.collHalfW);
    const rB = Math.hypot(b.collHalfL, b.collHalfW);
    const rSum = rA + rB;
    if (dx * dx + dz * dz > rSum * rSum) return null;
    // narrow phase — SAT over both boxes' forward/right axes
    const aFx = Math.sin(a.heading), aFz = Math.cos(a.heading);
    const bFx = Math.sin(b.heading), bFz = Math.cos(b.heading);
    const axes = [
        aFx,
        aFz,
        -aFz,
        aFx,
        bFx,
        bFz,
        -bFz,
        bFx
    ];
    let bestOverlap = Infinity;
    let bestUx = 0, bestUz = 0, bestRA = 0, bestRB = 0, bestD = 0;
    for(let k = 0; k < 4; k++){
        const ux = axes[k * 2], uz = axes[k * 2 + 1];
        const ra = Math.abs(aFx * ux + aFz * uz) * a.collHalfL + Math.abs(-aFz * ux + aFx * uz) * a.collHalfW;
        const rb = Math.abs(bFx * ux + bFz * uz) * b.collHalfL + Math.abs(-bFz * ux + bFx * uz) * b.collHalfW;
        const d = Math.abs(dx * ux + dz * uz);
        const overlap = ra + rb - d;
        if (overlap <= 0) return null; // separating axis found
        if (overlap < bestOverlap) {
            bestOverlap = overlap;
            bestUx = ux;
            bestUz = uz;
            bestRA = ra;
            bestRB = rb;
            bestD = d;
        }
    }
    // MTV axis, oriented from A → B
    let nx = bestUx, nz = bestUz;
    if (dx * nx + dz * nz < 0) {
        nx = -nx;
        nz = -nz;
    }
    // ── positional separation (mass-weighted shares, capped) ──
    // heavier car budges less: share = oppositeMass / totalMass
    const mA = a.mass;
    const mB = b.mass;
    const total = Math.min(bestOverlap + SLOP, MAX_SEPARATION);
    const wA = mB / (mA + mB);
    const wB = mA / (mA + mB);
    a.pos.x -= nx * total * wA;
    a.pos.z -= nz * total * wA;
    b.pos.x += nx * total * wB;
    b.pos.z += nz * total * wB;
    // contact point = middle of the overlap interval along the MTV axis
    const centre = (bestD - bestRB + bestRA) * 0.5;
    _point.set(a.pos.x + nx * centre, Math.max(a.pos.y, b.pos.y) + 0.45, a.pos.z + nz * centre);
    // ── impulse along the normal (mass-weighted) ──
    let impact = 0;
    const relN = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
    if (relN < -0.4) {
        // J = -(1+e)·vRel / (1/mA + 1/mB); Δv = J/m applied ±along the normal
        const j = -(1 + RESTITUTION) * relN / (1 / mA + 1 / mB);
        impact = -relN;
        a.vel.x -= nx * j / mA;
        a.vel.z -= nz * j / mA;
        b.vel.x += nx * j / mB;
        b.vel.z += nz * j / mB;
        // tangential scrub — metal-on-metal drag (same mass weighting)
        const tx = -nz, tz = nx;
        const relT = (b.vel.x - a.vel.x) * tx + (b.vel.z - a.vel.z) * tz;
        const scrub = relT * TANGENT_SCRUB;
        a.vel.x += tx * scrub * wA;
        a.vel.z += tz * scrub * wA;
        b.vel.x -= tx * scrub * wB;
        b.vel.z -= tz * scrub * wB;
        // offset hits spin the cars slightly: τ.y = r.z·F.x − r.x·F.z
        // (yaw kick also damped by mass — inertia scales with it)
        const rax = _point.x - a.pos.x, raz = _point.z - a.pos.z;
        const rbx = _point.x - b.pos.x, rbz = _point.z - b.pos.z;
        const ta = (raz * (-nx * j) - rax * (-nz * j)) / mA;
        const tb = (rbz * (nx * j) - rbx * (nz * j)) / mB;
        a.heading += __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(ta * YAW_GAIN, -YAW_MAX, YAW_MAX);
        b.heading += __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(tb * YAW_GAIN, -YAW_MAX, YAW_MAX);
    }
    if (impact < FX_MIN_IMPACT) return null;
    return {
        a,
        b,
        point: _point.clone(),
        impact
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/race/RaceManager.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RaceManager",
    ()=>RaceManager
]);
// ─── Race state machine: checkpoints, laps, positions, timing ───────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
;
class RaceManager {
    track;
    cars;
    totalLaps;
    onEvent;
    standings;
    raceTimeMs;
    started;
    expectedCp;
    wrongWayTimer;
    constructor(track, cars, totalLaps, onEvent){
        this.track = track;
        this.cars = cars;
        this.totalLaps = totalLaps;
        this.onEvent = onEvent;
        this.standings = [];
        this.raceTimeMs = 0;
        this.started = false;
        this.expectedCp = new Map();
        this.wrongWayTimer = new Map();
        for (const car of cars){
            car.lap = 0;
            car.checkpoint = 0;
            car.progress = 0;
            car.finished = false;
            car.finishTime = 0;
            this.expectedCp.set(car, 1);
            this.standings.push({
                car,
                position: 0,
                lapsDone: 0,
                progress: 0,
                finished: false,
                totalTimeMs: 0,
                bestLapMs: 0,
                lapStartMs: 0,
                wrongWay: false
            });
        }
    }
    get isComplete() {
        return this.standings.length > 0 && this.standings.every((s)=>s.finished);
    }
    start() {
        this.started = true;
        this.raceTimeMs = 0;
        for (const s of this.standings)s.lapStartMs = 0;
    }
    update(dt, racing) {
        if (!racing) return;
        this.raceTimeMs += dt * 1000;
        const N = this.track.sampleCount;
        const count = this.track.checkpointCount;
        for (const s of this.standings){
            const car = s.car;
            if (!car.loc) continue;
            // ── remote cars: trust their reported lap, position via local interp ──
            if (car.kind === "remote") {
                s.lapsDone = car.lap;
                s.progress = car.lap * N + (car.loc.sDist + N) % N;
                s.wrongWay = false;
                continue;
            }
            // ── checkpoint progression ──
            const zone = this.track.checkpointForIndex(car.loc.index);
            const expected = this.expectedCp.get(car) ?? 1;
            if (zone === expected) {
                const next = (expected + 1) % count;
                this.expectedCp.set(car, next);
                car.checkpoint = expected;
                if (next === 1) {
                    // crossed the start/finish gate → lap complete
                    s.lapsDone += 1;
                    car.lap = s.lapsDone;
                    const lapMs = this.raceTimeMs - s.lapStartMs;
                    s.lapStartMs = this.raceTimeMs;
                    const isBest = lapMs > 500 && (s.bestLapMs === 0 || lapMs < s.bestLapMs);
                    if (isBest) s.bestLapMs = lapMs;
                    if (s.lapsDone >= this.totalLaps) {
                        s.finished = true;
                        car.finished = true;
                        car.finishTime = this.raceTimeMs;
                        s.totalTimeMs = this.raceTimeMs;
                        this.onEvent({
                            type: "finish",
                            car,
                            position: this.finishedCount(),
                            totalTimeMs: s.totalTimeMs,
                            bestLapMs: s.bestLapMs
                        });
                    } else if (car.kind !== "remote") {
                        this.onEvent({
                            type: "lap",
                            car,
                            lap: s.lapsDone,
                            lapTimeMs: lapMs,
                            isBest
                        });
                    }
                }
            }
            // ── progress for position sorting ──
            const base = s.lapsDone * N;
            const sDist = (car.loc.sDist + N) % N;
            s.progress = base + sDist;
            car.progress = s.progress;
            // ── wrong-way detection ──
            const alongVel = car.vel.dot(car.loc.tangent);
            let t = (this.wrongWayTimer.get(car) ?? 0) + (alongVel < -3 ? dt : -dt * 2);
            t = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(t, 0, 1.2);
            this.wrongWayTimer.set(car, t);
            s.wrongWay = t > 0.8 && !s.finished;
        }
        // ── recompute positions (leader first) ──
        const order = [
            ...this.standings
        ].sort((a, b)=>{
            if (a.finished !== b.finished) return a.finished ? 1 : -1; // finished cars keep order
            return b.progress - a.progress;
        });
        order.forEach((s, i)=>{
            s.position = i + 1;
        });
        // stable finish positions: finished cars ranked by finish order
        const finished = this.standings.filter((s)=>s.finished).sort((a, b)=>a.totalTimeMs - b.totalTimeMs);
        finished.forEach((s, i)=>s.position = i + 1);
    }
    finishedCount() {
        return this.standings.filter((s)=>s.finished).length;
    }
    standingFor(car) {
        return this.standings.find((s)=>s.car === car);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/core/CameraRig.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CameraRig",
    ()=>CameraRig,
    "DEFAULT_TUNING",
    ()=>DEFAULT_TUNING,
    "MODE_LABEL",
    ()=>MODE_LABEL
]);
// ─── NFS-Carbon-style camera: view modes, mouse free-look, live tuning ──────
// - C cycles: chase → far → hood → bumper (chase modes orbit-carbon style)
// - hold RIGHT MOUSE + move → free-look orbit around the car (chase modes)
//   or look around from the seat (hood/bumper); auto-recenters on release
// - camera drops & pulls back with speed (Carbon speed drama, drama-knob scalable)
// - user tuning (dist/height/FOV/sensitivity) applied on top of any mode,
//   driven by the HUD panel (F7), persisted to localStorage by the shell
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
;
const MODES = {
    chase: {
        dist: 7.2,
        height: 3.2,
        look: 7,
        fov: 74
    },
    far: {
        dist: 11,
        height: 5.2,
        look: 9,
        fov: 66
    },
    // cockpit modes anchor to the car's real body bounds (car.camDims) —
    // fixed offsets can't work across a fleet: -0.55m ahead of center sat
    // inside the engine bay of every GLB car (the "bumper in the engine" bug)
    hood: {
        look: 16,
        fov: 82
    },
    bumper: {
        look: 18,
        fov: 90
    }
};
const MODE_LABEL = {
    chase: "CHASE",
    far: "FAR CHASE",
    hood: "HOOD",
    bumper: "BUMPER"
};
const DEFAULT_TUNING = {
    distMul: 1,
    heightAdd: 0,
    fovAdd: 0,
    sens: 1,
    drama: 1
};
const UP = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"](0, 1, 0);
function isCockpitMode(m) {
    return m === "hood" || m === "bumper";
}
class CameraRig {
    camera;
    mode;
    tuning;
    current;
    // smoothed camera/look offsets relative to the car. Tracking in car space
    // (instead of lerping the world position) means the camera translates 1:1
    // with the car — speed can never build a v/λ lag that reads as the camera
    // sliding backward while you accelerate.
    camOff;
    lookOff;
    camPos;
    lookAt;
    init;
    // ── free-look (NFS Carbon right-stick / mouse look) ──
    looking;
    lookYaw;
    lookPitch;
    lookYawT;
    lookPitchT;
    constructor(camera){
        this.camera = camera;
        this.mode = "chase";
        this.tuning = {
            ...DEFAULT_TUNING
        };
        this.current = {
            dist: 7.2,
            height: 3.2,
            look: 7,
            fov: 74
        };
        this.camOff = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
        this.lookOff = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
        this.camPos = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
        this.lookAt = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Vector3"]();
        this.init = false;
        this.looking = false;
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.lookYawT = 0;
        this.lookPitchT = 0;
    }
    cycle() {
        const order = [
            "chase",
            "far",
            "hood",
            "bumper"
        ];
        this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
        return this.mode;
    }
    /** live-tune distance/height/FOV/sensitivity (HUD panel) */ applyTuning(t) {
        this.tuning = {
            ...this.tuning,
            ...t
        };
    }
    holdLook() {
        this.looking = true;
    }
    releaseLook() {
        this.looking = false;
        this.lookYawT = 0;
        this.lookPitchT = 0;
    }
    /** mouse deltas while right button held → orbit targets */ addLook(dx, dy) {
        if (!this.looking) return;
        const s = 0.0022 * this.tuning.sens;
        this.lookYawT = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(this.lookYawT - dx * s, -2.7, 2.7);
        this.lookPitchT = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(this.lookPitchT + dy * s * 0.7, -0.6, 0.9);
    }
    update(dt, car) {
        const cfg = MODES[this.mode];
        const tun = this.tuning;
        // desired preset values: mode base + user tuning. Cockpit anchors come
        // from the car's body bounds so the camera clears the actual mesh:
        //   hood   — a touch ahead of the cowl, just above the body line
        //   bumper — a hand's width past the nose, at headlight height
        let baseDist = cfg.dist ?? 0;
        let baseHeight = cfg.height ?? 0;
        if (isCockpitMode(this.mode)) {
            const d = car.camDims;
            if (this.mode === "hood") {
                baseDist = -d.length * 0.05;
                baseHeight = Math.max(1.35, d.topY + 0.03);
            } else {
                // +0.55 clears the underglow plane (length+0.9 → ~0.45m nose overhang)
                baseDist = -(d.frontZ + 0.55);
                baseHeight = Math.max(0.55, d.topY * 0.42 + 0.08);
            }
        }
        const wantDist = baseDist * tun.distMul;
        const wantHeight = baseHeight + tun.heightAdd;
        const wantFov = cfg.fov + tun.fovAdd;
        // smooth transitions between modes / tuning changes. Big jumps (mode
        // switches — esp. crossing the car body between chase and cockpit
        // anchors) converge ~3.4x faster so the camera CUTS instead of slowly
        // sweeping through the mesh; small tweaks (sliders) stay buttery.
        const rate = (p, want)=>Math.abs(want - p) > 2 ? 12 : 3.5;
        this.current.dist = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.current.dist, wantDist, 1 - Math.exp(-rate(this.current.dist, wantDist) * dt));
        this.current.height = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.current.height, wantHeight, 1 - Math.exp(-rate(this.current.height, wantHeight) * dt));
        this.current.look = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.current.look, cfg.look, 1 - Math.exp(-rate(this.current.look, cfg.look) * dt));
        this.current.fov = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.current.fov, wantFov, 1 - Math.exp(-rate(this.current.fov, wantFov) * dt));
        // free-look spring: track mouse target while held, recenter on release
        const lookT = 1 - Math.exp(-14 * dt);
        this.lookYaw = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.lookYaw, this.lookYawT, lookT);
        this.lookPitch = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.lookPitch, this.lookPitchT, lookT);
        const fwd = car.forward;
        const speedT = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(Math.abs(car.speed) / 70, 0, 1);
        const isCockpit = this.mode === "hood" || this.mode === "bumper";
        // Carbon speed drama: chase cams pull back a touch and drop lower;
        // the drama knob scales the whole effect (0 = framing locked to preset)
        const drama = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(this.tuning.drama ?? 1, 0, 1);
        let dist = this.current.dist;
        let height = this.current.height;
        if (this.mode === "chase" || this.mode === "far") {
            dist += speedT * 1.4 * drama;
            height -= speedT * 0.55 * drama;
        }
        // horizontal offset behind (or ahead for cockpit cams) the car
        const driftSide = isCockpit ? 0 : car.slipAngle * Math.sign(car.vel.dot(car.right)) * 2.2;
        const off = fwd.clone().multiplyScalar(-dist).addScaledVector(car.right, driftSide).applyAxisAngle(UP, this.lookYaw); // free-look orbits the camera around the car
        const anchor = car.pos.clone().add(off);
        anchor.y = car.pos.y + height + (isCockpit ? this.lookPitch * 0.25 : 0);
        // look target: ahead of the car, rotated with free-look; pitch swings it up/down
        const lookFwd = fwd.clone().applyAxisAngle(UP, this.lookYaw);
        const wantLookAt = car.pos.clone().addScaledVector(lookFwd, this.current.look * 0.4 + (isCockpit ? 2 : 0));
        wantLookAt.y += isCockpit ? this.lookPitch * 14 : this.lookPitch * 6;
        // track the car in its own frame: smooth the OFFSET, never the world
        // position — lerping a world-space anchor behind a moving car leaves a
        // velocity-proportional lag (the "camera slides back on launch" effect)
        const desiredOff = anchor.clone().sub(car.pos);
        const desiredLookOff = wantLookAt.clone().sub(car.pos);
        if (!this.init) {
            this.camOff.copy(desiredOff);
            this.lookOff.copy(desiredLookOff);
            this.init = true;
        } else {
            // faster catch-up at speed keeps the car framed through mode changes
            const t = 1 - Math.exp(-(5.5 + speedT * 4) * dt);
            this.camOff.lerp(desiredOff, t);
            this.lookOff.lerp(desiredLookOff, 1 - Math.exp(-9 * dt));
        }
        this.camPos.copy(car.pos).add(this.camOff);
        this.lookAt.copy(car.pos).add(this.lookOff);
        // keep camera above the road surface
        this.camPos.y = Math.max(this.camPos.y, car.pos.y + (isCockpit ? 0.45 : 1.2));
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.lookAt);
        // speed feel: widen FOV with velocity, extra kick on nitro (drama-scaled)
        const fovTarget = this.current.fov + (speedT * 14 + (car.nitroActive ? 6 : 0)) * drama;
        this.camera.fov = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(this.camera.fov, fovTarget, 1 - Math.exp(-4 * dt));
        this.camera.updateProjectionMatrix();
    }
    reset() {
        this.init = false;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/core/Input.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "InputManager",
    ()=>InputManager
]);
// ─── Keyboard + touch input manager ─────────────────────────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
;
class InputManager {
    keys = new Set();
    touch = {
        left: false,
        right: false,
        gas: false,
        brake: false,
        nitro: false,
        hb: false
    };
    target = null;
    /** extra one-shot actions consumed by the game */ onAction = null;
    /** mouse free-look (NFS Carbon style): deltas while RIGHT button held */ onLookDelta = null;
    onLookToggle = null;
    lookHeld = false;
    boundKeyDown = (e)=>{
        if (e.repeat) return;
        const k = e.code;
        // Prevent page scroll while racing
        if ([
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Space"
        ].includes(k) && this.target) e.preventDefault();
        this.keys.add(k);
        if (k === "KeyC") this.onAction?.("camera");
        if (k === "KeyM") this.onAction?.("mute");
        if (k === "KeyR") this.onAction?.("reset");
        if (k === "Escape" || k === "KeyP") this.onAction?.("pause");
    };
    boundKeyUp = (e)=>this.keys.delete(e.code);
    boundBlur = ()=>{
        this.keys.clear();
        if (this.lookHeld) {
            this.lookHeld = false;
            this.onLookToggle?.(false);
        }
    };
    boundMouseDown = (e)=>{
        if (e.button === 2) {
            this.lookHeld = true;
            this.onLookToggle?.(true);
        }
    };
    boundMouseUp = (e)=>{
        if (e.button === 2 && this.lookHeld) {
            this.lookHeld = false;
            this.onLookToggle?.(false);
        }
    };
    boundMouseMove = (e)=>{
        if (this.lookHeld && (e.movementX || e.movementY)) {
            this.onLookDelta?.(e.movementX, e.movementY);
        }
    };
    boundCtx = (e)=>{
        if (this.lookHeld) e.preventDefault(); // suppress context menu while looking
    };
    boundTouchEnd = ()=>this.touch = {
            left: false,
            right: false,
            gas: false,
            brake: false,
            nitro: false,
            hb: false
        };
    attach() {
        window.addEventListener("keydown", this.boundKeyDown, {
            passive: false
        });
        window.addEventListener("keyup", this.boundKeyUp);
        window.addEventListener("blur", this.boundBlur);
        window.addEventListener("mousedown", this.boundMouseDown);
        window.addEventListener("mouseup", this.boundMouseUp);
        window.addEventListener("mousemove", this.boundMouseMove);
        window.addEventListener("contextmenu", this.boundCtx);
        window.addEventListener("touchend", this.boundTouchEnd);
        window.addEventListener("touchcancel", this.boundTouchEnd);
    }
    detach() {
        window.removeEventListener("keydown", this.boundKeyDown);
        window.removeEventListener("keyup", this.boundKeyUp);
        window.removeEventListener("blur", this.boundBlur);
        window.removeEventListener("mousedown", this.boundMouseDown);
        window.removeEventListener("mouseup", this.boundMouseUp);
        window.removeEventListener("mousemove", this.boundMouseMove);
        window.removeEventListener("contextmenu", this.boundCtx);
        window.removeEventListener("touchend", this.boundTouchEnd);
        window.removeEventListener("touchcancel", this.boundTouchEnd);
        this.keys.clear();
        if (this.lookHeld) {
            this.lookHeld = false;
            this.onLookToggle?.(false);
        }
    }
    /** Reference to the controls struct the player car reads each frame */ bindControls(controls) {
        this.target = controls;
    }
    /** Called by TouchControls UI layer */ setTouch(button, pressed) {
        this.touch[button] = pressed;
    }
    /** Write current player intent into the bound CarControls */ update(dt) {
        if (!this.target) return;
        const k = this.keys;
        const has = (...codes)=>codes.some((c)=>k.has(c));
        const gasK = has("ArrowUp", "KeyW");
        const brakeK = has("ArrowDown", "KeyS");
        const leftK = has("ArrowLeft", "KeyA");
        const rightK = has("ArrowRight", "KeyD");
        const throttleIn = gasK || this.touch.gas ? 1 : 0;
        const brakeIn = brakeK || this.touch.brake ? 1 : 0;
        const steerIn = (leftK || this.touch.left ? -1 : 0) + (rightK || this.touch.right ? 1 : 0);
        const hbIn = k.has("Space") || this.touch.hb;
        const nitroIn = has("ShiftLeft", "ShiftRight") || this.touch.nitro;
        const c = this.target;
        // Smooth steering for keyboard (avoids twitchy yaw snapping)
        const steerSpeed = 3.6 * dt;
        const diff = steerIn - c.steer;
        c.steer = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(c.steer + __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(diff, -steerSpeed, steerSpeed), -1, 1);
        if (steerIn === 0 && Math.abs(c.steer) < 0.03) c.steer = 0;
        // throttle/brake ramping gives a bit of analogue feel
        c.throttle = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(c.throttle, throttleIn, 1 - Math.exp(-8 * dt));
        c.brake = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].lerp(c.brake, brakeIn, 1 - Math.exp(-12 * dt));
        c.handbrake = hbIn;
        c.nitro = nitroIn;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/audio/EngineAudio.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ─── Synth engine audio (WebAudio, no assets needed) ────────────────────────
__turbopack_context__.s([
    "EngineAudio",
    ()=>EngineAudio
]);
class EngineAudio {
    ctx = null;
    master = null;
    engineOsc = null;
    engineGain = null;
    subOsc = null;
    screechGain = null;
    windGain = null;
    noiseSource = null;
    muted = false;
    started = false;
    /** must be called from a user gesture handler */ resume() {
        if (!this.ctx) {
            try {
                this.ctx = new AudioContext();
            } catch  {
                return;
            }
            this.buildGraph();
        }
        if (this.ctx.state === "suspended") void this.ctx.resume();
    }
    buildGraph() {
        const ctx = this.ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(ctx.destination);
        // engine: saw + sub octave
        this.engineOsc = ctx.createOscillator();
        this.engineOsc.type = "sawtooth";
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0.0001;
        const engineFilter = ctx.createBiquadFilter();
        engineFilter.type = "lowpass";
        engineFilter.frequency.value = 950;
        this.engineOsc.connect(this.engineGain).connect(engineFilter).connect(this.master);
        this.engineOsc.start();
        this.subOsc = ctx.createOscillator();
        this.subOsc.type = "square";
        const subGain = ctx.createGain();
        subGain.gain.value = 0.5;
        this.subOsc.connect(subGain).connect(this.engineGain);
        this.subOsc.start();
        // shared noise buffer for screech + wind
        const len = ctx.sampleRate * 1.5;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for(let i = 0; i < len; i++)data[i] = Math.random() * 2 - 1;
        this.noiseSource = ctx.createBufferSource();
        this.noiseSource.buffer = buf;
        this.noiseSource.loop = true;
        // tyre screech: bandpassed noise
        const screechFilter = ctx.createBiquadFilter();
        screechFilter.type = "bandpass";
        screechFilter.frequency.value = 2400;
        screechFilter.Q.value = 6;
        this.screechGain = ctx.createGain();
        this.screechGain.gain.value = 0;
        this.noiseSource.connect(screechFilter).connect(this.screechGain).connect(this.master);
        // wind at speed
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = "lowpass";
        windFilter.frequency.value = 600;
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0;
        this.noiseSource.connect(windFilter).connect(this.windGain).connect(this.master);
        this.noiseSource.start();
        this.started = true;
    }
    setMuted(m) {
        this.muted = m;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
        }
    }
    /** rpm 0..1, speed m/s, drifting, nitro */ update(rpm, speed, drifting, nitro) {
        if (!this.started || !this.ctx || !this.engineOsc || !this.engineGain) return;
        const t = this.ctx.currentTime;
        const hz = 55 + rpm * 180;
        this.engineOsc.frequency.setTargetAtTime(hz, t, 0.03);
        this.subOsc?.frequency.setTargetAtTime(hz / 2, t, 0.03);
        const vol = 0.05 + Math.min(speed / 70, 1) * 0.14 + (nitro ? 0.06 : 0);
        this.engineGain.gain.setTargetAtTime(vol, t, 0.05);
        this.screechGain?.gain.setTargetAtTime(drifting ? 0.1 : 0, t, 0.05);
        this.windGain?.gain.setTargetAtTime(Math.max(0, (speed - 25) / 70) * 0.16, t, 0.1);
    }
    /** short UI blips: countdown / finish */ blip(freq = 660, dur = 0.12, type = "square", vol = 0.25) {
        if (!this.ctx || !this.master) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(g).connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + dur + 0.02);
    }
    fanfare(kind) {
        const seq = kind === "win" ? [
            523,
            659,
            784,
            1047
        ] : [
            392,
            330,
            262
        ];
        seq.forEach((f, i)=>setTimeout(()=>this.blip(f, 0.18, "triangle", 0.3), i * 130));
    }
    dispose() {
        try {
            this.engineOsc?.stop();
            this.subOsc?.stop();
            this.noiseSource?.stop();
            void this.ctx?.close();
        } catch  {
        /* noop */ }
        this.ctx = null;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/core/Game.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Game",
    ()=>Game,
    "fmtTime",
    ()=>fmtTime
]);
// ─── Game: renderer, world, race loop, HUD feed, online wiring ──────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.module.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Track$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/Track.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CityEnvironment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/CityEnvironment.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Car$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/Car.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$AICar$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/AICar.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/CarModelLoader.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Particles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/Particles.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Collisions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/Collisions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$race$2f$RaceManager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/race/RaceManager.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/CameraRig.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/Input.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$audio$2f$EngineAudio$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/audio/EngineAudio.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$environments$2f$RoomEnvironment$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/examples/jsm/environments/RoomEnvironment.js [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const AI_NAMES = [
    "VIPER",
    "KAIJU",
    "ONYX",
    "RAZOR",
    "NOMAD"
];
const AI_COLORS = [
    "#dc2626",
    "#14b8a6",
    "#e2e8f0",
    "#db2777",
    "#84cc16"
];
class Game {
    canvas;
    // core
    renderer;
    scene;
    camera;
    cameraRig;
    input;
    audio;
    clock;
    // world
    track;
    city;
    particles;
    // cars
    player;
    ais;
    remotes;
    allCars;
    // race
    raceManager;
    mode;
    laps;
    /** map actually being raced (resolved against the registry) */ mapId;
    phase;
    countdownTimer;
    countdownStep;
    hudTimer;
    netTimer;
    raf;
    disposed;
    moon;
    net;
    results;
    finishOrder;
    cb;
    opts;
    /** decaying camera-shake amplitude (0..1) fed by collisions / rail hits */ impactShake;
    railSoundCd;
    constructor(canvas, opts, callbacks){
        this.canvas = canvas;
        this.scene = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scene"]();
        this.input = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["InputManager"]();
        this.audio = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$audio$2f$EngineAudio$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["EngineAudio"]();
        this.clock = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Clock"]();
        this.particles = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Particles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ParticlePool"](240);
        this.ais = [];
        this.remotes = new Map();
        this.allCars = [];
        this.raceManager = null;
        this.phase = "idle";
        this.countdownTimer = 0;
        this.countdownStep = 0;
        this.hudTimer = 0;
        this.netTimer = 0;
        this.raf = 0;
        this.disposed = false;
        this.results = [];
        this.finishOrder = 0;
        this.impactShake = 0;
        this.railSoundCd = 0;
        this.paused = false;
        // ─── per-frame loop ─────────────────────────────────────────────────────
        this.onResize = ()=>{
            const w = this.canvas.clientWidth || window.innerWidth;
            const h = this.canvas.clientHeight || window.innerHeight;
            this.renderer.setSize(w, h, false);
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        };
        this.loop = ()=>{
            if (this.disposed) return;
            this.raf = requestAnimationFrame(this.loop);
            const dt = Math.min(this.clock.getDelta(), 1 / 30);
            this.advanceCountdown(dt);
            const controlsEnabled = this.phase === "racing" && !this.paused;
            if (!this.paused) {
                this.input.update(dt);
                // ── drive ──
                const playerProg = this.raceManager?.standingFor(this.player)?.progress ?? 0;
                for (const ai of this.ais)ai.drive(dt, this.track, playerProg, controlsEnabled);
                this.player.update(dt, this.track, controlsEnabled);
                for (const ai of this.ais)ai.update(dt, this.track, controlsEnabled);
                for (const rc of this.remotes.values())rc.update(dt);
                // ── car-vs-car collision ──
                this.resolveCollisions(dt);
                // remote cars contribute to standings
                if (this.raceManager) this.raceManager.update(dt, this.phase === "racing");
                // ── particles from cars ──
                for (const car of this.allCars){
                    if (car.smokeRequest) {
                        this.particles.emit(car.smokeRequest.pos, car.smokeRequest.strength);
                        car.smokeRequest = null;
                    }
                }
                this.particles.update(dt);
            }
            // ── camera & lights ──
            this.cameraRig.update(this.paused ? 0.0001 : dt, this.player);
            if (this.impactShake > 0.01) {
                const k = this.impactShake;
                this.camera.position.x += (Math.random() - 0.5) * k * 0.5;
                this.camera.position.y += (Math.random() - 0.5) * k * 0.35;
                this.camera.position.z += (Math.random() - 0.5) * k * 0.5;
                this.impactShake = Math.max(0, this.impactShake - 3.5 * dt);
            }
            this.moon.position.set(this.player.pos.x + 120, 220, this.player.pos.z + 80);
            this.moon.target.position.copy(this.player.pos);
            // ── audio ──
            if (!this.audio.muted) {
                const [gear, rpm] = gearAndRpm(this.player.speed);
                this.audio.update(rpm, Math.abs(this.player.speed), this.player.drifting, this.player.nitroActive);
            }
            // ── HUD feed at ~30 Hz ──
            this.hudTimer += dt;
            if (this.hudTimer > 1 / 30) {
                this.hudTimer = 0;
                this.emitHud();
            }
            // ── net state send at 20 Hz ──
            if (this.net && this.phase === "racing" && !this.paused) {
                this.netTimer += dt;
                if (this.netTimer > 1 / 20) {
                    this.netTimer = 0;
                    this.net.sendState(this.player.snapshot());
                }
            }
            this.renderer.render(this.scene, this.camera);
        };
        this.opts = opts;
        this.mode = opts.mode;
        // resolve the map first — geometry, look and laps all come from it
        const map = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mapDef"])(opts.mapId) ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mapDef"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_MAP_ID"]);
        this.mapId = map.id;
        this.laps = opts.laps ?? map.defaultLaps ?? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GAME_CONFIG"].LAPS;
        this.net = opts.net ?? null;
        this.cb = callbacks;
        // ── renderer ──
        this.renderer = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["WebGLRenderer"]({
            canvas,
            antialias: true,
            powerPreference: "high-performance"
        });
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["registerKTX2Renderer"])(this.renderer); // refresh KTX2 GPU-format detection
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        this.renderer.toneMapping = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ACESFilmicToneMapping"];
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PCFSoftShadowMap"];
        this.camera = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PerspectiveCamera"](74, canvas.clientWidth / canvas.clientHeight, 0.1, 1400);
        this.cameraRig = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CameraRig"](this.camera);
        // ── scene: night atmosphere (map palette) ──
        const P = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveMapPalette"])(map);
        this.scene.background = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Color"](P.sky);
        this.scene.fog = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["FogExp2"](P.fog, 0.0105);
        const pmrem = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["PMREMGenerator"](this.renderer);
        const env = pmrem.fromScene(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$examples$2f$jsm$2f$environments$2f$RoomEnvironment$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RoomEnvironment"](), 0.04);
        this.scene.environment = env.texture;
        this.scene.environmentIntensity = 0.22;
        pmrem.dispose();
        this.scene.add(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AmbientLight"](0x2a2430, 1.4));
        const hemi = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HemisphereLight"](0x30364a, 0x0a0a0c, 0.55);
        this.scene.add(hemi);
        this.moon = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DirectionalLight"](0xbcd0e8, 0.55);
        this.moon.position.set(120, 220, 80);
        this.moon.castShadow = true;
        this.moon.shadow.mapSize.set(2048, 2048);
        this.moon.shadow.camera.near = 10;
        this.moon.shadow.camera.far = 700;
        this.moon.shadow.camera.left = -160;
        this.moon.shadow.camera.right = 160;
        this.moon.shadow.camera.top = 160;
        this.moon.shadow.camera.bottom = -160;
        this.scene.add(this.moon, this.moon.target);
        // ── world ──
        this.track = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Track$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Track"](map);
        this.scene.add(this.track.group);
        this.city = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CityEnvironment$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CityEnvironment"](this.track, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveEnvTheme"])(map));
        this.scene.add(this.city.group);
        this.scene.add(this.particles.points);
        // ── cars ──
        this.setupCars();
        // ── input & audio hooks ──
        this.input.attach();
        this.input.bindControls(this.player.controls);
        this.input.onAction = (a)=>{
            if (a === "camera") this.cameraRig.cycle();
            if (a === "mute") this.audio.setMuted(!this.audio.muted);
            if (a === "reset") this.player.resetToTrack(this.track);
            if (a === "pause") this.togglePause();
        };
        // NFS-Carbon mouse free-look: hold right mouse, orbit, auto-recenter
        this.input.onLookToggle = (pressed)=>pressed ? this.cameraRig.holdLook() : this.cameraRig.releaseLook();
        this.input.onLookDelta = (dx, dy)=>this.cameraRig.addLook(dx, dy);
        // ── online wiring ──
        if (this.net) this.wireNet();
        window.addEventListener("resize", this.onResize);
        this.onResize();
        this.loop();
    }
    // ─── setup ──────────────────────────────────────────────────────────────
    setupCars() {
        // clear any previous grid (restart flow)
        for (const c of this.allCars){
            this.scene.remove(c.group);
            c.dispose();
        }
        this.ais = [];
        this.allCars = [];
        const total = this.mode === "quick" ? 1 + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GAME_CONFIG"].AI_COUNT : 1;
        // player starts at the back of the grid (NFS style)
        const playerGrid = total - 1;
        const carId = this.opts.carId ?? "classic";
        // AI rivals rotate through the registry's AI pool for variety
        const aiPool = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AI_POOL_IDS"].filter((c)=>c !== carId);
        for(let i = 0; i < total; i++){
            let car;
            if (i === playerGrid) {
                const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasCarModel"])(carId) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["instantiateCar"])(carId, this.opts.carColor) ?? undefined : undefined;
                if (!model && (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carDef"])(carId)?.modelUrl) {
                    console.warn(`[Game] model for "${carId}" (${(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carDef"])(carId).modelUrl}) failed to load — ` + "falling back to the procedural car. Check the file exists / re-select the car.");
                }
                car = this.player = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Car$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Car"]("player", this.opts.carColor, this.opts.playerName, model, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveCarTuning"])(carId));
            } else {
                const aiId = aiPool[i % aiPool.length];
                const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasCarModel"])(aiId) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["instantiateCar"])(aiId, AI_COLORS[i % AI_COLORS.length]) ?? undefined : undefined;
                const ai = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$AICar$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AICar"](AI_COLORS[i % AI_COLORS.length], AI_NAMES[i % AI_NAMES.length], i, model, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveCarTuning"])(aiId));
                this.ais.push(ai);
                car = ai;
            }
            const spot = this.gridSlot(i, total);
            car.placeAt(spot.pos, spot.heading);
            this.scene.add(car.group);
        }
        this.allCars = [
            this.player,
            ...this.ais
        ];
        this.input.bindControls(this.player.controls);
        this.cameraRig.reset();
        this.cameraRig.update(0.016, this.player);
    }
    gridSlot(i, total) {
        // grid behind the start line, two-wide — 6m rows keep bumpers apart
        const N = this.track.sampleCount;
        const back = 6 + Math.floor(i / 2) * 6;
        const idx = (N - back) % N;
        const s = this.track.sampleAt(idx);
        const lateral = i % 2 === 0 ? -3.4 : 3.4;
        const pos = s.pos.clone().addScaledVector(s.normal, lateral);
        pos.y += 0.15;
        return {
            pos,
            heading: Math.atan2(s.tangent.x, s.tangent.z)
        };
    }
    wireNet() {
        const net = this.net;
        net.onRemoteStates = (states)=>{
            for (const [id, snap] of Object.entries(states)){
                if (id === net.socket?.id) continue;
                let rc = this.remotes.get(id);
                if (!rc) {
                    const p = net.players.find((x)=>x.id === id);
                    // remote drivers race THEIR car, not ours — resolve their registry id
                    // (unknown/missing ids fall back to the garage default)
                    const carId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveCarId"])(p?.carId);
                    const model = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["hasCarModel"])(carId) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["instantiateCar"])(carId, p?.color ?? "#e2e8f0") ?? undefined : undefined;
                    rc = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Car$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RemoteCar"](id, p?.name ?? "RACER", p?.color ?? "#e2e8f0", model);
                    this.remotes.set(id, rc);
                    this.scene.add(rc.car.group);
                    if (!this.allCars.includes(rc.car)) this.allCars.push(rc.car);
                }
                rc.setTarget(snap);
            }
        };
        net.onRaceStart = (laps)=>{
            this.laps = laps;
            this.beginCountdown();
        };
        net.onFinishBroadcast = (entry)=>{
            this.results.push({
                name: entry.name,
                color: "#e2e8f0",
                position: 0,
                totalTimeMs: entry.totalTimeMs,
                bestLapMs: entry.bestLapMs,
                isPlayer: false,
                driftScore: 0
            });
            this.cb.onOnlineFinish(entry);
        };
    }
    // ─── race flow ──────────────────────────────────────────────────────────
    beginCountdown() {
        this.raceManager = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$race$2f$RaceManager$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RaceManager"](this.track, this.allCars, this.laps, (e)=>{
            if (e.type === "lap") {
                if (e.car === this.player) {
                    const msg = `LAP ${e.lap}/${this.laps} — ${fmtTime(e.lapTimeMs)}${e.isBest ? "  ★ BEST" : ""}`;
                    this.cb.onLapFlash(msg);
                    if (e.isBest) this.audio.blip(880, 0.14, "triangle");
                }
            } else if (e.type === "finish") {
                if (e.car === this.player) this.handlePlayerFinish();
                else if (e.car.kind === "ai") {
                    this.results.push({
                        name: e.car.name,
                        color: e.car.color,
                        position: e.position,
                        totalTimeMs: e.totalTimeMs,
                        bestLapMs: e.bestLapMs,
                        isPlayer: false,
                        driftScore: 0
                    });
                }
            }
        });
        this.phase = "countdown";
        this.countdownStep = 3;
        this.countdownTimer = 0;
        this.cb.onCountdown(3);
        this.audio.blip(520, 0.16);
    }
    handlePlayerFinish() {
        this.finishOrder += 1;
        const standing = this.raceManager.standingFor(this.player);
        // snapshot the FULL grid so the standings table shows every racer
        const order = [
            ...this.raceManager.standings
        ].sort((a, b)=>a.position - b.position);
        this.results = order.map((s)=>({
                name: s.car.name || this.opts.playerName,
                color: s.car.color,
                position: s.position,
                totalTimeMs: s.finished ? s.totalTimeMs : 0,
                bestLapMs: s.bestLapMs,
                isPlayer: s.car === this.player,
                driftScore: s.car === this.player ? this.player.driftScore + Math.round(this.player.driftChain) : 0
            }));
        if (this.net) this.net.sendFinish(standing.totalTimeMs, standing.bestLapMs);
        this.phase = "finished";
        this.audio.fanfare(this.finishOrder === 1 ? "win" : "lose");
        this.cb.onFinish(this.results);
    }
    togglePause() {
        // pause handled via React screen; game exposes it
        if (this.phase === "racing") this.paused = !this.paused;
    }
    paused;
    setPaused(p) {
        this.paused = p;
        if (p) this.input.update(0);
    }
    restart() {
        for (const rc of this.remotes.values()){
            this.scene.remove(rc.car.group);
            rc.dispose();
        }
        this.remotes.clear();
        this.results = [];
        this.finishOrder = 0;
        this.ais.forEach((ai)=>ai.stuckTimer = 0);
        this.setupCars();
        this.raceManager = null;
        this.paused = false;
        this.beginCountdown();
    }
    quit() {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        window.removeEventListener("resize", this.onResize);
        this.input.detach();
        this.audio.dispose();
        // release net callbacks so the lobby can re-wire them for the next race
        if (this.net) {
            this.net.onRemoteStates = null;
            this.net.onRaceStart = null;
            this.net.onFinishBroadcast = null;
        }
        this.track.dispose();
        this.city.dispose();
        this.particles.dispose();
        for (const c of this.allCars){
            this.scene.remove(c.group);
            c.dispose();
        }
        for (const rc of this.remotes.values())rc.dispose();
        this.remotes.clear();
        this.renderer.dispose();
    }
    onResize;
    getMinimapData() {
        return {
            outline: this.track.samples.map((s)=>({
                    x: s.pos.x,
                    z: s.pos.z
                })),
            cars: this.allCars.concat([
                ...this.remotes.values()
            ].map((r)=>r.car)).map((c)=>({
                    x: c.pos.x,
                    z: c.pos.z,
                    color: c === this.player ? "#ffffff" : c.color,
                    isPlayer: c === this.player
                }))
        };
    }
    loop;
    /** car-vs-car collision resolution + impact feedback (FX/sound/shake) */ resolveCollisions(dt) {
        const contacts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$Collisions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveCarCollisions"])(this.allCars);
        for (const c of contacts){
            // cars moved after their update() — refresh transforms for this frame
            c.a.syncVisual(1e-4);
            c.b.syncVisual(1e-4);
            this.particles.emit(c.point, 1);
            if (c.a === this.player || c.b === this.player) {
                const strength = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(c.impact / 9, 0.2, 1);
                this.impactShake = Math.max(this.impactShake, strength);
                if (!this.audio.muted) this.audio.blip(55 + Math.random() * 45, 0.18, "sawtooth", 0.08 + 0.3 * strength);
            }
        }
        // guardrail scrape feedback for the player (rate-limited thud)
        this.railSoundCd = Math.max(0, this.railSoundCd - dt);
        if (this.player.railHit > 3.5 && this.railSoundCd === 0) {
            const strength = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp(this.player.railHit / 12, 0.2, 1);
            this.impactShake = Math.max(this.impactShake, strength * 0.7);
            if (!this.audio.muted) this.audio.blip(70 + Math.random() * 50, 0.2, "sawtooth", 0.06 + 0.28 * strength);
            this.railSoundCd = 0.22;
        }
    }
    emitHud() {
        const standing = this.raceManager?.standingFor(this.player);
        const [gear, rpm] = gearAndRpm(this.player.speed);
        this.cb.onHud({
            speedKmh: Math.round(Math.abs(this.player.speed) * 3.6),
            gear,
            rpm,
            lap: Math.min((standing?.lapsDone ?? 0) + 1, this.laps),
            totalLaps: this.laps,
            position: standing?.position ?? 1,
            racers: this.allCars.length,
            timeMs: this.raceManager?.raceTimeMs ?? 0,
            bestLapMs: standing?.bestLapMs ?? 0,
            nitro: this.player.nitro,
            driftChain: Math.round(this.player.driftChain),
            driftTotal: this.player.driftScore + Math.round(this.player.driftChain),
            wrongWay: standing?.wrongWay ?? false,
            cameraMode: this.cameraRig.mode
        });
    }
    /** remote player left → drop their car */ syncRemotePlayers(players) {
        for (const [id, rc] of this.remotes){
            if (!players.find((p)=>p.id === id)) {
                this.scene.remove(rc.car.group);
                rc.dispose();
                this.remotes.delete(id);
                this.allCars = this.allCars.filter((c)=>c !== rc.car);
            }
        }
    }
    /** countdown sequencing shared by the rAF loop and debugTick */ advanceCountdown(dt) {
        if (this.phase !== "countdown" || this.paused) return;
        this.countdownTimer += dt;
        if (this.countdownTimer < 1) return;
        this.countdownTimer = 0;
        this.countdownStep -= 1;
        if (this.countdownStep > 0) {
            this.cb.onCountdown(this.countdownStep);
            this.audio.blip(520, 0.16);
        } else if (this.countdownStep === 0) {
            this.cb.onCountdown(0); // GO
            this.audio.blip(940, 0.3, "square", 0.3);
        } else {
            this.cb.onCountdown(null);
            this.phase = "racing";
            this.raceManager?.start();
        }
    }
    /**
   * Dev/test hook: advance the simulation synchronously without waiting for
   * rAF (headless browsers throttle rAF heavily). Optional auto-steer drives
   * the player car along the racing line like the AI does.
   */ debugTick(n = 60, opts = {}) {
        const dt = 1 / 60;
        for(let i = 0; i < n; i++){
            this.advanceCountdown(dt);
            const racing = this.phase === "racing";
            const c = this.player.controls;
            if (opts.autoSteer && this.player.loc) {
                const metresPerSample = this.track.length / this.track.sampleCount;
                const look = Math.max(4, Math.round(24 / metresPerSample));
                const target = this.track.sampleAt(this.player.loc.index + look).pos;
                const toT = target.clone().sub(this.player.pos);
                const fwd = this.player.forward;
                const cross = fwd.x * toT.z - fwd.z * toT.x;
                const angle = Math.atan2(Math.abs(cross), Math.max(fwd.dot(toT), 0.001));
                c.steer = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MathUtils"].clamp((cross > 0 ? 1 : -1) * angle * 3.2, -1, 1);
                c.throttle = opts.throttle ?? 1;
            } else if (opts.throttle !== undefined) {
                c.throttle = opts.throttle;
            }
            const playerProg = this.raceManager?.standingFor(this.player)?.progress ?? 0;
            for (const ai of this.ais)ai.drive(dt, this.track, playerProg, racing);
            this.player.update(dt, this.track, racing);
            for (const ai of this.ais)ai.update(dt, this.track, racing);
            this.resolveCollisions(dt);
            this.raceManager?.update(dt, racing);
        }
        this.emitHud();
        this.renderer.render(this.scene, this.camera);
        const standing = this.raceManager?.standingFor(this.player);
        return {
            phase: this.phase,
            speed: Math.round(this.player.speed * 3.6),
            pos: [
                Math.round(this.player.pos.x),
                Math.round(this.player.pos.z)
            ],
            lap: standing?.lapsDone ?? 0,
            position: standing?.position ?? 0,
            timeMs: this.raceManager?.raceTimeMs ?? 0,
            offRoad: this.player.loc ? Math.abs(this.player.loc.lateral) > this.track.halfWidth : false,
            results: this.results.length
        };
    }
}
// ─── helpers ────────────────────────────────────────────────────────────────
function gearAndRpm(speed) {
    const s = Math.abs(speed);
    if (speed < -0.5) return [
        "R",
        Math.min(s / 12, 1)
    ];
    if (s < 0.5) return [
        "N",
        0.12
    ];
    const bands = [
        0,
        11,
        21,
        32,
        44,
        57,
        74
    ];
    for(let g = 1; g < bands.length - 1; g++){
        if (s < bands[g]) {
            const frac = (s - bands[g - 1]) / (bands[g] - bands[g - 1]);
            return [
                String(g),
                0.25 + frac * 0.75
            ];
        }
    }
    return [
        "6",
        1
    ];
}
function fmtTime(ms) {
    if (!ms || ms < 0) return "--:--.---";
    const m = Math.floor(ms / 60000);
    const s = Math.floor(ms % 60000 / 1000);
    const mss = Math.floor(ms % 1000);
    return `${m}:${String(s).padStart(2, "0")}.${String(mss).padStart(3, "0")}`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/game/net/NetClient.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NetClient",
    ()=>NetClient
]);
// ─── Online multiplayer client (socket.io via gateway) ─────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <locals>");
;
class NetClient {
    socket = null;
    connected = false;
    roomId = "";
    isHost = false;
    /** host socket id of the current room (crown in the lobby) */ hostId = "";
    players = [];
    browsing = false;
    // callbacks wired by the UI / Game
    onPlayers = null;
    onConnected = null;
    onRemoteStates = null;
    onRaceStart = null;
    onFinishBroadcast = null;
    onDisconnected = null;
    onError = null;
    /** public room browser list */ onRooms = null;
    /** room's map changed (host pick) */ onRoomMap = null;
    /** this driver was kicked by the host */ onKicked = null;
    connect() {
        if (this.socket) return;
        this.socket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["io"])("/?XTransformPort=3003", {
            transports: [
                "websocket",
                "polling"
            ],
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: 6,
            reconnectionDelay: 1200,
            timeout: 10000
        });
        this.socket.on("connect", ()=>{
            this.connected = true;
            this.onConnected?.(true);
        });
        this.socket.on("disconnect", ()=>{
            this.connected = false;
            this.onConnected?.(false);
            this.onDisconnected?.();
        });
        this.socket.on("room:players", (payload)=>{
            this.players = payload.players;
            this.hostId = payload.hostId;
            this.onPlayers?.(payload.players);
        });
        this.socket.on("race:started", ({ laps })=>{
            this.onRaceStart?.(laps);
        });
        this.socket.on("states", (states)=>{
            this.onRemoteStates?.(states);
        });
        this.socket.on("race:finished", (entry)=>{
            this.onFinishBroadcast?.(entry);
        });
        this.socket.on("room:error", ({ message })=>{
            this.onError?.(message);
        });
        this.socket.on("rooms", (rooms)=>{
            this.onRooms?.(rooms);
        });
        this.socket.on("room:map", ({ mapId })=>{
            this.onRoomMap?.(mapId);
        });
        this.socket.on("room:kicked", ()=>{
            this.roomId = "";
            this.players = [];
            this.onKicked?.();
        });
    }
    // ── room lifecycle ──────────────────────────────────────────────────────
    createRoom(name, color, carId, visibility = "private", mapId = "downtown") {
        return new Promise((resolve, reject)=>{
            this.socket.emit("room:create", {
                name,
                color,
                carId,
                visibility,
                mapId
            }, (res)=>{
                if (res.ok && res.roomId) {
                    this.roomId = res.roomId;
                    this.isHost = true;
                    this.browsing = false;
                    resolve(res.roomId);
                } else reject(new Error(res.message ?? "Failed to create room"));
            });
        });
    }
    joinRoom(roomId, name, color, carId) {
        return new Promise((resolve, reject)=>{
            this.socket.emit("room:join", {
                roomId: roomId.trim().toUpperCase(),
                name,
                color,
                carId
            }, (res)=>{
                if (res.ok) {
                    this.roomId = res.roomId ?? roomId.trim().toUpperCase();
                    this.isHost = false;
                    this.browsing = false;
                    resolve(this.roomId);
                } else reject(new Error(res.message ?? "Room not found"));
            });
        });
    }
    updateColor(color) {
        this.socket?.emit("room:update", {
            color
        });
    }
    updateCar(carId) {
        this.socket?.emit("room:update", {
            carId
        });
    }
    setReady(ready) {
        this.socket?.emit("room:update", {
            ready
        });
    }
    setRoomMap(mapId) {
        this.socket?.emit("room:setmap", {
            mapId
        });
    }
    kickPlayer(id) {
        this.socket?.emit("room:kick", {
            id
        });
    }
    startRace(laps) {
        this.socket?.emit("race:start", {
            laps
        });
    }
    // ── server browser ──────────────────────────────────────────────────────
    subscribeRooms() {
        this.browsing = true;
        this.socket?.emit("rooms:list");
    }
    unsubscribeRooms() {
        this.browsing = false;
        this.socket?.emit("rooms:unlist");
    }
    // ── race data ───────────────────────────────────────────────────────────
    sendState(snap) {
        this.socket?.emit("state", snap);
    }
    sendFinish(totalTimeMs, bestLapMs) {
        this.socket?.emit("race:finish", {
            totalTimeMs,
            bestLapMs
        });
    }
    leave() {
        this.socket?.emit("room:leave");
        this.socket?.disconnect();
        this.socket = null;
        this.connected = false;
        this.roomId = "";
        this.isHost = false;
        this.hostId = "";
        this.players = [];
        this.browsing = false;
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/stores/gameStore.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useGameStore",
    ()=>useGameStore
]);
// ─── Global game UI state ────────────────────────────────────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
"use client";
;
;
;
const LS_NAME = "three-nfs:name";
const LS_COLOR = "three-nfs:color";
const LS_CAR = "three-nfs:car";
const LS_MAP = "three-nfs:map";
/** retired car ids → their replacement (SRT-10 is the SRT's successor) */ const LEGACY_CAR_IDS = {
    viper: "viper08",
    viper2: "viper08"
};
/** map a persisted id onto a car that still exists in the garage */ function resolvePersistedCar(raw) {
    const id = raw ? LEGACY_CAR_IDS[raw] ?? raw : "gtr";
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAR_LIBRARY"].some((c)=>c.id === id) ? id : "gtr";
}
function loadPersisted() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        return {
            name: window.localStorage.getItem(LS_NAME) ?? "",
            color: window.localStorage.getItem(LS_COLOR) ?? "#f59e0b",
            car: resolvePersistedCar(window.localStorage.getItem(LS_CAR)),
            map: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveMapId"])(window.localStorage.getItem(LS_MAP))
        };
    } catch  {
        return {
            name: "",
            color: "#f59e0b",
            car: "gtr",
            map: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_MAP_ID"]
        };
    }
}
const emptyHud = {
    speedKmh: 0,
    gear: "N",
    rpm: 0,
    lap: 1,
    totalLaps: 3,
    position: 1,
    racers: 1,
    timeMs: 0,
    bestLapMs: 0,
    nitro: 100,
    driftChain: 0,
    driftTotal: 0,
    wrongWay: false,
    cameraMode: "chase"
};
const useGameStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])((set)=>{
    const persisted = loadPersisted();
    let flashId = 0;
    let flashTimer = null;
    return {
        screen: "menu",
        mode: "quick",
        playerName: persisted.name,
        carColor: persisted.color,
        carId: persisted.car,
        mapId: persisted.map,
        muted: false,
        hud: emptyHud,
        countdown: null,
        lapFlash: null,
        results: [],
        lobby: {
            roomId: "",
            isHost: false,
            hostId: "",
            connected: false,
            players: [],
            laps: 3,
            visibility: "private",
            mapId: "downtown"
        },
        setScreen: (s)=>set({
                screen: s
            }),
        setMode: (m)=>set({
                mode: m
            }),
        setPlayerName: (n)=>{
            try {
                window.localStorage.setItem(LS_NAME, n);
            } catch  {}
            set({
                playerName: n
            });
        },
        setCarColor: (c)=>{
            try {
                window.localStorage.setItem(LS_COLOR, c);
            } catch  {}
            set({
                carColor: c
            });
        },
        setCarId: (id)=>{
            try {
                window.localStorage.setItem(LS_CAR, id);
            } catch  {}
            set({
                carId: id
            });
        },
        setMapId: (id)=>{
            try {
                window.localStorage.setItem(LS_MAP, id);
            } catch  {}
            set({
                mapId: id
            });
        },
        setMuted: (m)=>set({
                muted: m
            }),
        setHud: (h)=>set({
                hud: h
            }),
        setCountdown: (c)=>set({
                countdown: c
            }),
        flashLap: (msg)=>{
            flashId += 1;
            set({
                lapFlash: {
                    msg,
                    id: flashId
                }
            });
            if (flashTimer) clearTimeout(flashTimer);
            flashTimer = setTimeout(()=>set({
                    lapFlash: null
                }), 2800);
        },
        setResults: (r)=>set({
                results: r
            }),
        setLobby: (partial)=>set((st)=>({
                    lobby: {
                        ...st.lobby,
                        ...partial
                    }
                })),
        reset: ()=>set({
                screen: "menu",
                hud: emptyHud,
                countdown: null,
                lapFlash: null,
                results: [],
                lobby: {
                    roomId: "",
                    isHost: false,
                    hostId: "",
                    connected: false,
                    players: [],
                    laps: 3,
                    visibility: "private",
                    mapId: "downtown"
                }
            })
    };
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/HUD.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HUD",
    ()=>HUD
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── In-race HUD: speedometer, laps, nitro, drift, minimap ──────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/gameStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/Game.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/CameraRig.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const MAX_KMH = 260;
const GAUGE_START = 135; // degrees
const GAUGE_SWEEP = 270;
const TUNING_KEY = "nfs-carbon-cam";
function HUD({ gameRef }) {
    _s();
    const hud = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "HUD.useGameStore[hud]": (s)=>s.hud
    }["HUD.useGameStore[hud]"]);
    const countdown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "HUD.useGameStore[countdown]": (s)=>s.countdown
    }["HUD.useGameStore[countdown]"]);
    const lapFlash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "HUD.useGameStore[lapFlash]": (s)=>s.lapFlash
    }["HUD.useGameStore[lapFlash]"]);
    const needleAngle = GAUGE_START + Math.min(hud.speedKmh, MAX_KMH) / MAX_KMH * GAUGE_SWEEP;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "pointer-events-none absolute inset-0 select-none font-sans",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute left-3 top-3 sm:left-5 sm:top-5 space-y-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "hud-chip",
                                children: "LAP"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 26,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono text-xl sm:text-2xl font-bold text-white tabular-nums",
                                children: [
                                    hud.lap,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-zinc-500",
                                        children: [
                                            "/",
                                            hud.totalLaps
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/HUD.tsx",
                                        lineNumber: 29,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 27,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 25,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "hud-chip",
                                children: "POS"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 33,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono text-xl sm:text-2xl font-bold text-amber-400 tabular-nums",
                                children: [
                                    hud.position,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-zinc-500",
                                        children: [
                                            "/",
                                            hud.racers
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/HUD.tsx",
                                        lineNumber: 36,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 34,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "font-mono text-sm sm:text-base text-zinc-300 tabular-nums",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtTime"])(hud.timeMs)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, this),
                    hud.bestLapMs > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "font-mono text-[11px] sm:text-xs text-amber-500/90 tabular-nums",
                        children: [
                            "BEST ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtTime"])(hud.bestLapMs)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 43,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 24,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CameraControls, {
                gameRef: gameRef,
                mode: hud.cameraMode
            }, void 0, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this),
            lapFlash && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute left-1/2 top-14 -translate-x-1/2 lapflash font-mono font-bold text-2xl sm:text-3xl text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]",
                children: lapFlash.msg
            }, lapFlash.id, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 54,
                columnNumber: 9
            }, this),
            hud.wrongWay && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute left-1/2 top-1/3 -translate-x-1/2 wrongway font-black italic text-3xl sm:text-4xl text-red-500 tracking-widest",
                children: "⚠ WRONG WAY"
            }, void 0, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 64,
                columnNumber: 9
            }, this),
            hud.driftChain > 40 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-4 sm:right-8 top-1/4 text-right",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "font-black italic text-3xl sm:text-4xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] tabular-nums",
                        children: [
                            "+",
                            hud.driftChain.toLocaleString()
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 72,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs font-bold tracking-[0.3em] text-amber-500",
                        children: "DRIFT"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 75,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 71,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-24 sm:bottom-28 right-4 sm:right-6 w-28 sm:w-36",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-1 text-[10px] font-bold tracking-[0.25em] text-zinc-400",
                        children: "NITRO"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "nitro-bar h-2.5 sm:h-3",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("nitro-fill", hud.nitro < 25 && "animate-pulse"),
                            style: {
                                width: `${hud.nitro}%`
                            }
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 83,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 82,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 80,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 200 170",
                    className: "w-40 h-34 sm:w-52 sm:h-44 drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("defs", {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("linearGradient", {
                                id: "gaugeArc",
                                x1: "0%",
                                y1: "0%",
                                x2: "100%",
                                y2: "100%",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                        offset: "0%",
                                        stopColor: "#f59e0b",
                                        stopOpacity: "0.9"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/HUD.tsx",
                                        lineNumber: 95,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("stop", {
                                        offset: "100%",
                                        stopColor: "#ef4444",
                                        stopOpacity: "0.9"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/HUD.tsx",
                                        lineNumber: 96,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 94,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 93,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            d: "M 20 120 A 85 85 0 1 1 180 120",
                            fill: "none",
                            stroke: "#0c0c0f",
                            strokeWidth: "26",
                            strokeLinecap: "round"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 100,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                            d: "M 20 120 A 85 85 0 1 1 180 120",
                            fill: "none",
                            stroke: "url(#gaugeArc)",
                            strokeWidth: "4",
                            strokeLinecap: "round",
                            opacity: "0.5"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 101,
                            columnNumber: 11
                        }, this),
                        Array.from({
                            length: 14
                        }, (_, i)=>{
                            const kmh = i / 13 * MAX_KMH;
                            const a = (GAUGE_START + kmh / MAX_KMH * GAUGE_SWEEP - 90) * Math.PI / 180;
                            const r1 = i % 2 === 0 ? 66 : 72;
                            const cx = 100, cy = 105;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                x1: cx + Math.cos(a) * r1,
                                y1: cy + Math.sin(a) * r1,
                                x2: cx + Math.cos(a) * 80,
                                y2: cy + Math.sin(a) * 80,
                                stroke: kmh > 210 ? "#ef4444" : "#8a8a93",
                                strokeWidth: i % 2 === 0 ? 2.4 : 1.2
                            }, i, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 110,
                                columnNumber: 15
                            }, this);
                        }),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("g", {
                            transform: `rotate(${needleAngle} 100 105)`,
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                x1: "100",
                                y1: "105",
                                x2: "100",
                                y2: "34",
                                stroke: "#f5b93a",
                                strokeWidth: "3.4",
                                strokeLinecap: "round"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 123,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 122,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                            cx: "100",
                            cy: "105",
                            r: "7",
                            fill: "#1a1a1f",
                            stroke: "#f5b93a",
                            strokeWidth: "2"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 125,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                            x: "100",
                            y: "140",
                            textAnchor: "middle",
                            className: "font-mono",
                            fill: "#ffffff",
                            fontSize: "26",
                            fontWeight: "700",
                            children: hud.speedKmh
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 127,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                            x: "100",
                            y: "154",
                            textAnchor: "middle",
                            fill: "#8a8a93",
                            fontSize: "9",
                            letterSpacing: "3",
                            children: "KM/H"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 130,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("text", {
                            x: "100",
                            y: "88",
                            textAnchor: "middle",
                            fill: hud.gear === "R" ? "#ef4444" : "#f5b93a",
                            fontSize: "16",
                            fontWeight: "800",
                            children: hud.gear
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 133,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/HUD.tsx",
                    lineNumber: 92,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 91,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Minimap, {
                gameRef: gameRef
            }, void 0, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 147,
                columnNumber: 7
            }, this),
            countdown !== null && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 flex items-center justify-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("countdown-pop font-black italic text-[22vw] sm:text-[12rem] leading-none drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]", countdown === 0 ? "text-amber-400" : "text-white"),
                    children: countdown === 0 ? "GO!" : countdown
                }, countdown, false, {
                    fileName: "[project]/src/components/game/HUD.tsx",
                    lineNumber: 152,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 151,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/HUD.tsx",
        lineNumber: 22,
        columnNumber: 5
    }, this);
}
_s(HUD, "e1+n1rs2zu8J71tH3jTrlDnN7kI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"]
    ];
});
_c = HUD;
// ─── NFS-Carbon camera controls: mode chip + live tuning panel ─────────────
function CameraControls({ gameRef, mode }) {
    _s1();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [tuning, setTuning] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_TUNING"]);
    const [toast, setToast] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const lastMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(mode);
    // mode-change toast (C key cycles) — flash the new view for a beat
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CameraControls.useEffect": ()=>{
            if (mode !== lastMode.current) {
                lastMode.current = mode;
                setToast({
                    id: Date.now(),
                    label: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODE_LABEL"][mode]
                });
            }
        }
    }["CameraControls.useEffect"], [
        mode
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CameraControls.useEffect": ()=>{
            if (!toast) return;
            const t = setTimeout({
                "CameraControls.useEffect.t": ()=>setToast(null)
            }["CameraControls.useEffect.t"], 1200);
            return ({
                "CameraControls.useEffect": ()=>clearTimeout(t)
            })["CameraControls.useEffect"];
        }
    }["CameraControls.useEffect"], [
        toast
    ]);
    // F7 toggles the panel (prevent browser caret-browsing default)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CameraControls.useEffect": ()=>{
            const onKey = {
                "CameraControls.useEffect.onKey": (e)=>{
                    if (e.code === "F7") {
                        e.preventDefault();
                        setOpen({
                            "CameraControls.useEffect.onKey": (o)=>!o
                        }["CameraControls.useEffect.onKey"]);
                    }
                }
            }["CameraControls.useEffect.onKey"];
            window.addEventListener("keydown", onKey);
            return ({
                "CameraControls.useEffect": ()=>window.removeEventListener("keydown", onKey)
            })["CameraControls.useEffect"];
        }
    }["CameraControls.useEffect"], []);
    // restore saved tuning once the game exists, then keep rig in sync
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CameraControls.useEffect": ()=>{
            const g = gameRef.current;
            if (!g) return;
            try {
                const raw = localStorage.getItem(TUNING_KEY);
                if (raw) {
                    const saved = JSON.parse(raw);
                    const merged = {
                        ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_TUNING"],
                        ...saved
                    };
                    setTuning(merged);
                    g.cameraRig.applyTuning(merged);
                }
            } catch  {
            /* bad localStorage — ignore */ }
        }
    }["CameraControls.useEffect"], [
        gameRef
    ]);
    const change = (patch)=>{
        setTuning((prev)=>{
            const next = {
                ...prev,
                ...patch
            };
            gameRef.current?.cameraRig.applyTuning(next);
            try {
                localStorage.setItem(TUNING_KEY, JSON.stringify(next));
            } catch  {
            /* storage full/blocked — non-fatal */ }
            return next;
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            toast && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-3 top-3 sm:right-5 sm:top-5 lapflash hud-chip !text-amber-400 font-bold tracking-[0.25em]",
                children: toast.label
            }, toast.id, false, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 240,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-3 top-10 sm:right-5 sm:top-12 pointer-events-auto flex flex-col items-end gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "hud-chip text-[10px] font-bold tracking-[0.2em] text-zinc-400",
                        children: [
                            "CAM · ",
                            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MODE_LABEL"][mode]
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 250,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setOpen((o)=>!o),
                        className: "hud-chip text-[10px] font-bold tracking-[0.2em] text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer",
                        "aria-label": "Camera settings (F7)",
                        children: "⚙ TUNE"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 253,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 249,
                columnNumber: 7
            }, this),
            open && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-3 top-24 sm:right-5 sm:top-28 w-64 sm:w-72 rounded-xl bg-black/70 backdrop-blur-md border border-amber-500/20 p-4 space-y-3 pointer-events-auto select-none",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-xs font-bold tracking-[0.25em] text-amber-400",
                                children: "CAMERA TUNE"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 266,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "text-[10px] text-zinc-500 font-mono",
                                children: "F7"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 267,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 265,
                        columnNumber: 11
                    }, this),
                    [
                        {
                            key: "distMul",
                            label: "DISTANCE",
                            min: 0.6,
                            max: 1.6,
                            step: 0.05,
                            fmt: (v)=>`×${v.toFixed(2)}`
                        },
                        {
                            label: "HEIGHT",
                            key: "heightAdd",
                            min: -2,
                            max: 2,
                            step: 0.1,
                            fmt: (v)=>`${v > 0 ? "+" : ""}${v.toFixed(1)}m`
                        },
                        {
                            key: "fovAdd",
                            label: "FOV",
                            min: -12,
                            max: 12,
                            step: 1,
                            fmt: (v)=>`${v > 0 ? "+" : ""}${v}°`
                        },
                        {
                            key: "sens",
                            label: "LOOK SENS.",
                            min: 0.4,
                            max: 2,
                            step: 0.1,
                            fmt: (v)=>`×${v.toFixed(1)}`
                        },
                        {
                            key: "drama",
                            label: "SPEED DRAMA",
                            min: 0,
                            max: 1,
                            step: 0.05,
                            fmt: (v)=>`${Math.round(v * 100)}%`
                        }
                    ].map((s)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                            className: "block",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex justify-between text-[10px] font-mono text-zinc-400 mb-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: s.label
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/HUD.tsx",
                                            lineNumber: 281,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-amber-300",
                                            children: s.fmt(tuning[s.key])
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/HUD.tsx",
                                            lineNumber: 282,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/game/HUD.tsx",
                                    lineNumber: 280,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                    type: "range",
                                    min: s.min,
                                    max: s.max,
                                    step: s.step,
                                    value: tuning[s.key],
                                    onChange: (e)=>change({
                                            [s.key]: Number(e.target.value)
                                        }),
                                    onKeyDown: (e)=>e.stopPropagation(),
                                    className: "w-full accent-amber-500 cursor-pointer",
                                    "aria-label": s.label
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/HUD.tsx",
                                    lineNumber: 284,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, s.key, true, {
                            fileName: "[project]/src/components/game/HUD.tsx",
                            lineNumber: 279,
                            columnNumber: 13
                        }, this)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between pt-1",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>change(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$CameraRig$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_TUNING"]),
                                className: "text-[10px] font-bold tracking-[0.2em] text-zinc-400 hover:text-white transition-colors cursor-pointer",
                                children: "RESET"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 299,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setOpen(false),
                                className: "hud-chip !text-[10px] font-bold tracking-[0.2em] text-amber-400 hover:text-white transition-colors cursor-pointer",
                                children: "DONE"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/HUD.tsx",
                                lineNumber: 305,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 298,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-[9px] text-zinc-500 font-mono leading-relaxed border-t border-white/5 pt-2",
                        children: "C cycle views · hold RIGHT MOUSE to look · auto-centers on release"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/HUD.tsx",
                        lineNumber: 312,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/HUD.tsx",
                lineNumber: 264,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true);
}
_s1(CameraControls, "myG4VqNQz3uho1jCDZPMuTWI22k=");
_c1 = CameraControls;
// ─── Minimap: canvas drawn straight from the game (no React re-render) ──────
function Minimap({ gameRef }) {
    _s2();
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const outlineRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const boundsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Minimap.useEffect": ()=>{
            let raf = 0;
            const draw = {
                "Minimap.useEffect.draw": ()=>{
                    raf = requestAnimationFrame(draw);
                    const canvas = canvasRef.current;
                    const game = gameRef.current;
                    if (!canvas || !game) return;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    const W = canvas.width;
                    const H = canvas.height;
                    if (!outlineRef.current) {
                        const data = game.getMinimapData();
                        outlineRef.current = data.outline;
                        const xs = data.outline.map({
                            "Minimap.useEffect.draw.xs": (p)=>p.x
                        }["Minimap.useEffect.draw.xs"]);
                        const zs = data.outline.map({
                            "Minimap.useEffect.draw.zs": (p)=>p.z
                        }["Minimap.useEffect.draw.zs"]);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minZ = Math.min(...zs);
                        const maxZ = Math.max(...zs);
                        const pad = 14;
                        const scale = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
                        boundsRef.current = {
                            minX,
                            minZ,
                            scale
                        };
                    }
                    const { minX, minZ, scale } = boundsRef.current;
                    const tx = {
                        "Minimap.useEffect.draw.tx": (x)=>(x - minX) * scale + (W - (Math.max(...outlineRef.current.map({
                                "Minimap.useEffect.draw.tx": (p)=>p.x
                            }["Minimap.useEffect.draw.tx"])) - minX) * scale) / 2
                    }["Minimap.useEffect.draw.tx"];
                    const tz = {
                        "Minimap.useEffect.draw.tz": (z)=>(z - minZ) * scale + (H - (Math.max(...outlineRef.current.map({
                                "Minimap.useEffect.draw.tz": (p)=>p.z
                            }["Minimap.useEffect.draw.tz"])) - minZ) * scale) / 2
                    }["Minimap.useEffect.draw.tz"];
                    ctx.clearRect(0, 0, W, H);
                    // track ribbon
                    ctx.beginPath();
                    const outline = outlineRef.current;
                    ctx.moveTo(tx(outline[0].x), tz(outline[0].z));
                    for (const p of outline)ctx.lineTo(tx(p.x), tz(p.z));
                    ctx.closePath();
                    ctx.strokeStyle = "rgba(160,160,170,0.85)";
                    ctx.lineWidth = 5;
                    ctx.stroke();
                    ctx.strokeStyle = "rgba(20,20,26,0.9)";
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                    // cars
                    const data = game.getMinimapData();
                    for (const c of data.cars){
                        ctx.beginPath();
                        ctx.arc(tx(c.x), tz(c.z), c.isPlayer ? 5 : 4, 0, Math.PI * 2);
                        ctx.fillStyle = c.color;
                        ctx.fill();
                        if (c.isPlayer) {
                            ctx.strokeStyle = "#ffffff";
                            ctx.lineWidth = 2;
                            ctx.stroke();
                        }
                    }
                }
            }["Minimap.useEffect.draw"];
            raf = requestAnimationFrame(draw);
            return ({
                "Minimap.useEffect": ()=>cancelAnimationFrame(raf)
            })["Minimap.useEffect"];
        }
    }["Minimap.useEffect"], [
        gameRef
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
        ref: canvasRef,
        width: 150,
        height: 150,
        className: "absolute bottom-3 right-3 sm:bottom-5 sm:right-5 w-[110px] h-[110px] sm:w-[150px] sm:h-[150px] rounded-xl bg-black/45 backdrop-blur-sm border border-white/10",
        "aria-label": "Track minimap"
    }, void 0, false, {
        fileName: "[project]/src/components/game/HUD.tsx",
        lineNumber: 389,
        columnNumber: 5
    }, this);
}
_s2(Minimap, "f6gM8HDla8pPcD93oDjpL58mlAQ=");
_c2 = Minimap;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "HUD");
__turbopack_context__.k.register(_c1, "CameraControls");
__turbopack_context__.k.register(_c2, "Minimap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button,
    "buttonVariants",
    ()=>buttonVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-slot/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
            destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline: "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
            secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
            ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
            link: "text-primary underline-offset-4 hover:underline"
        },
        size: {
            default: "h-9 px-4 py-2 has-[>svg]:px-3",
            sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
            lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
            icon: "size-9"
        }
    },
    defaultVariants: {
        variant: "default",
        size: "default"
    }
});
function Button({ className, variant, size, asChild = false, ...props }) {
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Slot"] : "button";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        "data-slot": "button",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/button.tsx",
        lineNumber: 51,
        columnNumber: 5
    }, this);
}
_c = Button;
;
var _c;
__turbopack_context__.k.register(_c, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/scroll-area.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ScrollArea",
    ()=>ScrollArea,
    "ScrollBar",
    ()=>ScrollBar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-scroll-area/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function ScrollArea({ className, children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"], {
        "data-slot": "scroll-area",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative", className),
        ...props,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Viewport"], {
                "data-slot": "scroll-area-viewport",
                className: "focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1",
                children: children
            }, void 0, false, {
                fileName: "[project]/src/components/ui/scroll-area.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ScrollBar, {}, void 0, false, {
                fileName: "[project]/src/components/ui/scroll-area.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Corner"], {}, void 0, false, {
                fileName: "[project]/src/components/ui/scroll-area.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/ui/scroll-area.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_c = ScrollArea;
function ScrollBar({ className, orientation = "vertical", ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollAreaScrollbar"], {
        "data-slot": "scroll-area-scrollbar",
        orientation: orientation,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex touch-none p-px transition-colors select-none", orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent", orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent", className),
        ...props,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$scroll$2d$area$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollAreaThumb"], {
            "data-slot": "scroll-area-thumb",
            className: "bg-border relative flex-1 rounded-full"
        }, void 0, false, {
            fileName: "[project]/src/components/ui/scroll-area.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/ui/scroll-area.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_c1 = ScrollBar;
;
var _c, _c1;
__turbopack_context__.k.register(_c, "ScrollArea");
__turbopack_context__.k.register(_c1, "ScrollBar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/MapSchematic.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MapSchematic",
    ()=>MapSchematic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
function MapSchematic({ map, className }) {
    const pts = map.points;
    const xs = pts.map((p)=>p[0]);
    const zs = pts.map((p)=>p[2]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const pad = 10;
    const scale = (100 - pad * 2) / span;
    const ox = (100 - (maxX - minX) * scale) / 2;
    const oz = (100 - (maxZ - minZ) * scale) / 2;
    const P = (p)=>[
            ox + (p[0] - minX) * scale,
            100 - (oz + (p[2] - minZ) * scale)
        ];
    const d = pts.map((p, i)=>`${i === 0 ? "M" : "L"}${P(p).map((v)=>v.toFixed(1)).join(" ")}`).join(" ") + " Z";
    const [sx, sy] = P(pts[0]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
        viewBox: "0 0 100 100",
        className: className,
        "aria-hidden": true,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                d: d,
                fill: "none",
                stroke: "currentColor",
                strokeWidth: "3.4",
                strokeLinejoin: "round",
                strokeLinecap: "round",
                opacity: "0.9"
            }, void 0, false, {
                fileName: "[project]/src/components/game/MapSchematic.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("circle", {
                cx: sx,
                cy: sy,
                r: "3.6",
                fill: "#f59e0b"
            }, void 0, false, {
                fileName: "[project]/src/components/game/MapSchematic.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/MapSchematic.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_c = MapSchematic;
var _c;
__turbopack_context__.k.register(_c, "MapSchematic");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/CarPreview.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CarPreview",
    ()=>CarPreview
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── CarPreview: 3D showroom turntable for the garage / lobby ───────────────
// Alpha-rendered so the menu backdrop shows through. GLB cars load through
// the shared template cache; procedural cars use the same muscle builder as
// the race skin, so what you see is what you drive.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.module.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/three/build/three.core.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/CarModelLoader.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/ProceduralMuscle.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
function CarPreview({ carId, color, className }) {
    _s();
    const hostRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const rendererRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const sceneRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const cameraRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const carRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    /** latest paint color (async builds read this to avoid stale closures) */ const colorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(color);
    colorRef.current = color;
    /** bump to rebuild the current car from scratch */ const buildToken = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(0);
    // ── persistent three.js scaffolding (renderer / scene / lights / floor) ──
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CarPreview.useEffect": ()=>{
            const host = hostRef.current;
            if (!host) return;
            const renderer = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$module$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["WebGLRenderer"]({
                antialias: true,
                alpha: true
            });
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["registerKTX2Renderer"])(renderer); // refresh KTX2 GPU-format detection
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PCFSoftShadowMap"];
            renderer.toneMapping = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ACESFilmicToneMapping"];
            renderer.toneMappingExposure = 1.25;
            renderer.domElement.style.width = "100%";
            renderer.domElement.style.height = "100%";
            renderer.domElement.style.display = "block";
            renderer.domElement.style.touchAction = "none";
            host.appendChild(renderer.domElement);
            const scene = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Scene"]();
            const camera = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PerspectiveCamera"](38, 1, 0.1, 60);
            camera.position.set(5.6, 2.3, 6.8);
            camera.lookAt(0, 0.75, 0);
            // lighting: hemi fill + warm key + twin amber rim lights (showroom vibe)
            scene.add(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HemisphereLight"](0x39415c, 0x0a0a0c, 1.1));
            const key = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DirectionalLight"](0xffe9c4, 2.6);
            key.position.set(5, 8, 4);
            key.castShadow = true;
            key.shadow.mapSize.set(1024, 1024);
            key.shadow.camera.near = 1;
            key.shadow.camera.far = 30;
            key.shadow.camera.left = -6;
            key.shadow.camera.right = 6;
            key.shadow.camera.top = 6;
            key.shadow.camera.bottom = -6;
            scene.add(key);
            const rimL = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DirectionalLight"](0xf59e0b, 1.4);
            rimL.position.set(-6, 3, -5);
            const rimR = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DirectionalLight"](0xf59e0b, 1.1);
            rimR.position.set(6, 2.5, -6);
            scene.add(rimL, rimR);
            // floor: dark disc + amber halo ring
            const floor = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CircleGeometry"](3.6, 48), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshStandardMaterial"]({
                color: 0x0b0b0f,
                roughness: 0.9,
                metalness: 0.1
            }));
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            scene.add(floor);
            const halo = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Mesh"](new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RingGeometry"](3.15, 3.35, 64), new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MeshBasicMaterial"]({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.55,
                side: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DoubleSide"]
            }));
            halo.rotation.x = -Math.PI / 2;
            halo.position.y = 0.01;
            scene.add(halo);
            rendererRef.current = renderer;
            sceneRef.current = scene;
            cameraRef.current = camera;
            // ── drag-to-rotate + idle auto-spin ──
            const spin = {
                angle: 0.7,
                dragging: false,
                auto: 0.28
            };
            const onDown = {
                "CarPreview.useEffect.onDown": (e)=>{
                    spin.dragging = true;
                    e.target.setPointerCapture?.(e.pointerId);
                }
            }["CarPreview.useEffect.onDown"];
            const onMove = {
                "CarPreview.useEffect.onMove": (e)=>{
                    if (!spin.dragging) return;
                    spin.angle += e.movementX * 0.008;
                }
            }["CarPreview.useEffect.onMove"];
            const onUp = {
                "CarPreview.useEffect.onUp": ()=>spin.dragging = false
            }["CarPreview.useEffect.onUp"];
            const el = renderer.domElement;
            el.addEventListener("pointerdown", onDown);
            el.addEventListener("pointermove", onMove);
            el.addEventListener("pointerup", onUp);
            el.addEventListener("pointercancel", onUp);
            // ── resize ──
            const resize = {
                "CarPreview.useEffect.resize": ()=>{
                    const w = host.clientWidth || 1;
                    const h = host.clientHeight || 1;
                    renderer.setSize(w, h, false);
                    camera.aspect = w / h;
                    camera.updateProjectionMatrix();
                }
            }["CarPreview.useEffect.resize"];
            const ro = new ResizeObserver(resize);
            ro.observe(host);
            resize();
            // ── render loop ──
            let raf = 0;
            let last = performance.now();
            const clock = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Clock"]();
            const tick = {
                "CarPreview.useEffect.tick": ()=>{
                    raf = requestAnimationFrame(tick);
                    const now = performance.now();
                    const dt = Math.min(0.05, (now - last) / 1000);
                    last = now;
                    if (!spin.dragging) spin.angle += spin.auto * dt;
                    if (carRef.current) carRef.current.root.rotation.y = spin.angle;
                    // gentle halo pulse
                    halo.material.opacity = 0.4 + 0.18 * Math.sin(clock.getElapsedTime() * 2.2);
                    renderer.render(scene, camera);
                }
            }["CarPreview.useEffect.tick"];
            tick();
            return ({
                "CarPreview.useEffect": ()=>{
                    cancelAnimationFrame(raf);
                    ro.disconnect();
                    el.removeEventListener("pointerdown", onDown);
                    el.removeEventListener("pointermove", onMove);
                    el.removeEventListener("pointerup", onUp);
                    el.removeEventListener("pointercancel", onUp);
                    if (carRef.current) scene.remove(carRef.current.root);
                    disposeCar(carRef.current);
                    carRef.current = null;
                    floor.geometry.dispose();
                    floor.material.dispose();
                    halo.geometry.dispose();
                    halo.material.dispose();
                    renderer.dispose();
                    if (el.parentElement) el.parentElement.removeChild(el);
                    rendererRef.current = null;
                    sceneRef.current = null;
                    cameraRef.current = null;
                }
            })["CarPreview.useEffect"];
        }
    }["CarPreview.useEffect"], []);
    // ── build / swap the car when carId changes ──
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CarPreview.useEffect": ()=>{
            const scene = sceneRef.current;
            if (!scene) return;
            const token = ++buildToken.current;
            const build = {
                "CarPreview.useEffect.build": async ()=>{
                    const entry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carEntry"])(carId);
                    let handle = null;
                    if (entry?.modelUrl) {
                        // GLB path — template cache shared with the race
                        try {
                            const tpl = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadCarModel"])(carId);
                            if (token !== buildToken.current) return; // superseded mid-load
                            const inst = tpl ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["instantiateCar"])(carId, colorRef.current) : null;
                            if (inst) {
                                const root = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
                                root.add(inst.root);
                                handle = {
                                    root,
                                    paint: inst.paintMaterials,
                                    procedural: false
                                };
                            }
                        } catch  {
                        // missing GLB → procedural fallback below
                        }
                    }
                    if (!handle) {
                        // procedural muscle — same builder the race uses
                        const shell = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildMuscleBody"])(colorRef.current);
                        const root = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$three$2f$build$2f$three$2e$core$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Group"]();
                        root.add(shell.root);
                        for (const [x, y, z] of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MUSCLE_WHEEL_POS"]){
                            const wheel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$ProceduralMuscle$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["buildMuscleWheel"])();
                            wheel.position.set(x, y, z);
                            root.add(wheel);
                        }
                        handle = {
                            root,
                            paint: [
                                shell.paint
                            ],
                            procedural: true
                        };
                    }
                    setCastShadows(handle.root);
                    // Both the GLB wrapper (normalized: ground y=0) and the procedural
                    // muscle (wheel centers at y = radius) have ground contact at local
                    // y=0, matching the disc at y=0 — no offset needed. The previous
                    // -MUSCLE_WHEEL_RADIUS shift sank the wheels into the opaque disc.
                    if (token !== buildToken.current) {
                        disposeCar(handle);
                        return;
                    }
                    // swap: detach the old car from the scene BEFORE disposing — a disposed
                    // material still attached gets re-uploaded by the renderer, leaving a
                    // frozen ghost of the previous car overlapping the new one.
                    if (carRef.current) scene.remove(carRef.current.root);
                    disposeCar(carRef.current);
                    carRef.current = handle;
                    scene.add(handle.root);
                }
            }["CarPreview.useEffect.build"];
            void build();
        }
    }["CarPreview.useEffect"], [
        carId
    ]); // eslint-disable-line react-hooks/exhaustive-deps
    // ── live recolor (no rebuild) ──
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "CarPreview.useEffect": ()=>{
            const car = carRef.current;
            if (car) (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyPaint"])(car.paint, color);
        }
    }["CarPreview.useEffect"], [
        color
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: hostRef,
        className: className,
        "aria-label": "Car preview",
        role: "img"
    }, void 0, false, {
        fileName: "[project]/src/components/game/CarPreview.tsx",
        lineNumber: 228,
        columnNumber: 10
    }, this);
}
_s(CarPreview, "+U8xQ3wNbOQP3QtkdRK3fpBEgJQ=");
_c = CarPreview;
function setCastShadows(root) {
    root.traverse((o)=>{
        const m = o;
        if (m.isMesh) m.castShadow = true;
    });
}
function disposeCar(car) {
    if (!car) return;
    if (car.procedural) {
        // procedural cars own all their geometry + materials
        car.root.traverse((o)=>{
            const m = o;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material;
            if (Array.isArray(mat)) mat.forEach((x)=>x.dispose());
            else if (mat) mat.dispose();
        });
    } else {
        // GLB clones share template geometry — only the cloned paint materials are ours
        for (const p of car.paint)p.dispose();
    }
}
var _c;
__turbopack_context__.k.register(_c, "CarPreview");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/input.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
;
function Input({ className, type, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        type: type,
        "data-slot": "input",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]", "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/input.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = Input;
;
var _c;
__turbopack_context__.k.register(_c, "Input");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/RideSelect.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RideSelect",
    ()=>RideSelect
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── RideSelect: shared garage panel — turntable + NFS 3 specs + chips + paint
// Used by the menu wizard (car step) and the online lobby car modal.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$CarPreview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/CarPreview.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-client] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
"use client";
;
;
;
;
;
;
;
function RideSelect({ carId, onCarId, color, onColor, name, onName, compact }) {
    const stats = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carStats"])(carId);
    const entry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carEntry"])(carId);
    const idx = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CARS"].findIndex((c)=>c.id === carId);
    const cycle = (dir)=>onCarId(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CARS"][(idx + dir + __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CARS"].length) % __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CARS"].length].id);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `flex gap-4 ${compact ? "min-h-0" : "flex-1 min-h-0"} w-full`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative flex-1 min-w-0 rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950/40 to-black/50 overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$CarPreview$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CarPreview"], {
                        carId: carId,
                        color: color,
                        className: "absolute inset-0"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-3 left-3 pointer-events-none",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "logo-title text-xl font-black italic leading-none",
                                children: entry?.name
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 36,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-1 text-[10px] font-bold tracking-[0.25em] text-amber-500/90",
                                children: entry?.spec
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 37,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 35,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>cycle(-1),
                        "aria-label": "Previous car",
                        className: "absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/55 border border-white/10 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                            className: "size-5"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/RideSelect.tsx",
                            lineNumber: 48,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>cycle(1),
                        "aria-label": "Next car",
                        className: "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/55 border border-white/10 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                            className: "size-5"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/RideSelect.tsx",
                            lineNumber: 55,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 50,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-2 inset-x-0 text-center text-[9px] font-bold tracking-[0.35em] text-zinc-600 pointer-events-none",
                        children: "DRAG TO ROTATE"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/RideSelect.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `shrink-0 flex flex-col gap-3 ${compact ? "w-[300px]" : "w-[330px]"} justify-center`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2.5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatBar, {
                                label: "TOP SPEED",
                                value: stats.topSpeed
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 66,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatBar, {
                                label: "ACCELERATION",
                                value: stats.accel
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 67,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatBar, {
                                label: "HANDLING",
                                value: stats.handling
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 68,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 65,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-5 gap-1.5",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CARS"].map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>onCarId(c.id),
                                "aria-label": `Select ${c.name}`,
                                className: `car-chip ${carId === c.id ? "car-chip-active" : ""}`,
                                children: c.short
                            }, c.id, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 74,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 72,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between mb-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] font-bold tracking-[0.3em] text-zinc-500",
                                        children: "PAINT"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/RideSelect.tsx",
                                        lineNumber: 88,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[10px] font-bold tracking-wider",
                                        style: {
                                            color
                                        },
                                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAR_COLORS"].find((c)=>c.value === color)?.name ?? "CUSTOM"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/RideSelect.tsx",
                                        lineNumber: 89,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 87,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-8 gap-1.5",
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CAR_COLORS"].map((c)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        onClick: ()=>onColor(c.value),
                                        "aria-label": `Paint ${c.name}`,
                                        className: `swatch ${color === c.value ? "swatch-active" : ""}`,
                                        style: {
                                            backgroundColor: c.value
                                        }
                                    }, c.value, false, {
                                        fileName: "[project]/src/components/game/RideSelect.tsx",
                                        lineNumber: 95,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 93,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 86,
                        columnNumber: 9
                    }, this),
                    onName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                className: "size-4 text-amber-500 shrink-0"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 108,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                value: name ?? "",
                                onChange: (e)=>onName(e.target.value.slice(0, 16)),
                                placeholder: "DRIVER NAME",
                                className: "bg-zinc-950/70 border-amber-900/50 focus-visible:ring-amber-500/40 font-semibold tracking-wider h-9",
                                "aria-label": "Driver name"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/RideSelect.tsx",
                                lineNumber: 109,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 107,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/RideSelect.tsx",
                lineNumber: 64,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/RideSelect.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_c = RideSelect;
function StatBar({ label, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-baseline justify-between mb-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-[10px] font-bold tracking-[0.28em] text-zinc-500",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 127,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-xs font-bold text-amber-400 tabular-nums",
                        children: value
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/RideSelect.tsx",
                        lineNumber: 128,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/RideSelect.tsx",
                lineNumber: 126,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "stat-bar",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                    className: "stat-fill",
                    initial: {
                        width: 0
                    },
                    animate: {
                        width: `${value}%`
                    },
                    transition: {
                        duration: 0.55,
                        ease: [
                            0.22,
                            1,
                            0.36,
                            1
                        ]
                    }
                }, `${label}-${value}`, false, {
                    fileName: "[project]/src/components/game/RideSelect.tsx",
                    lineNumber: 131,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/game/RideSelect.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/RideSelect.tsx",
        lineNumber: 125,
        columnNumber: 5
    }, this);
}
_c1 = StatBar;
var _c, _c1;
__turbopack_context__.k.register(_c, "RideSelect");
__turbopack_context__.k.register(_c1, "StatBar");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/MainMenu.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MainMenu",
    ()=>MainMenu
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── Main menu: mode screen + segmented no-scroll setup wizard ───────────────
// Desktop layout is a fixed 16:9-style frame — never scrolls. Flow:
//   MODE screen (quick / trial / online + records sidebar)
//   → wizard: 1 TRACK → 2 RIDE (name + paint live here) → GO
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/scroll-area.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/Game.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/gameStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MapSchematic$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/MapSchematic.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$RideSelect$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/RideSelect.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gauge$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gauge$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/gauge.js [app-client] (ecmascript) <export default as Gauge>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$timer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Timer$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/timer.js [app-client] (ecmascript) <export default as Timer>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi.js [app-client] (ecmascript) <export default as Wifi>");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
function MainMenu({ onStart, onOpenBrowser }) {
    _s();
    const { playerName, setPlayerName, carColor, setCarColor, carId, setCarId, mapId, setMapId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])();
    const [records, setRecords] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [stage, setStage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("mode");
    const [pendingMode, setPendingMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("quick");
    const [step, setStep] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("map");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MainMenu.useEffect": ()=>{
            fetch("/api/records").then({
                "MainMenu.useEffect": (r)=>r.json()
            }["MainMenu.useEffect"]).then({
                "MainMenu.useEffect": (d)=>setRecords(d.records ?? [])
            }["MainMenu.useEffect"]).catch({
                "MainMenu.useEffect": ()=>setRecords([])
            }["MainMenu.useEffect"]);
        }
    }["MainMenu.useEffect"], []);
    const enterSetup = (m)=>{
        setPendingMode(m);
        setStep("map");
        setStage("setup");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 overflow-hidden menu-bg flex flex-col select-none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "shrink-0 flex items-center gap-4 px-6 sm:px-10 pt-5 pb-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "logo-title text-3xl sm:text-4xl font-black italic tracking-tight",
                        children: [
                            "THREE",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-amber-500",
                                children: "·"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 57,
                                columnNumber: 16
                            }, this),
                            "NFS"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 56,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "hidden md:block text-[9px] tracking-[0.45em] text-zinc-600 font-semibold mt-1",
                        children: "NIGHT CITY RACING — BAREBONE EDITION"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ml-auto flex items-center gap-2 text-[10px] font-bold tracking-[0.2em]",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-zinc-600",
                                children: "DRIVER"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 63,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "hud-chip text-amber-400",
                                children: playerName.trim() || "UNNAMED"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 64,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/MainMenu.tsx",
                lineNumber: 55,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 flex px-6 sm:px-10 pb-6 gap-6",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
                    mode: "wait",
                    initial: false,
                    children: stage === "mode" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                        initial: {
                            opacity: 0,
                            x: -24
                        },
                        animate: {
                            opacity: 1,
                            x: 0
                        },
                        exit: {
                            opacity: 0,
                            x: -24
                        },
                        transition: {
                            duration: 0.25
                        },
                        className: "flex-1 min-h-0 flex gap-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 max-w-xl flex flex-col justify-center gap-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModeCard, {
                                        onClick: ()=>enterSetup("quick"),
                                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gauge$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gauge$3e$__["Gauge"], {
                                            className: "size-6"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                            lineNumber: 84,
                                            columnNumber: 25
                                        }, void 0),
                                        title: "QUICK RACE",
                                        subtitle: "3 laps · 3 AI rivals · any circuit"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 82,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModeCard, {
                                        onClick: ()=>enterSetup("trial"),
                                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$timer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Timer$3e$__["Timer"], {
                                            className: "size-6"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                            lineNumber: 90,
                                            columnNumber: 25
                                        }, void 0),
                                        title: "TIME TRIAL",
                                        subtitle: "Solo hot lap · chase the record"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 88,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModeCard, {
                                        onClick: onOpenBrowser,
                                        icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                                            className: "size-6"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                            lineNumber: 96,
                                            columnNumber: 25
                                        }, void 0),
                                        title: "ONLINE RACE",
                                        subtitle: "Public server list · or a private code room",
                                        accent: true
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 94,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[10px] text-zinc-600 tracking-wider leading-relaxed px-1",
                                        children: [
                                            "Controls: ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                className: "text-zinc-400",
                                                children: "WASD"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 102,
                                                columnNumber: 29
                                            }, this),
                                            " drive · ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                className: "text-zinc-400",
                                                children: "SPACE"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 102,
                                                columnNumber: 75
                                            }, this),
                                            " drift ·",
                                            " ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                className: "text-zinc-400",
                                                children: "SHIFT"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 103,
                                                columnNumber: 19
                                            }, this),
                                            " nitro · ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                className: "text-zinc-400",
                                                children: "C"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 103,
                                                columnNumber: 66
                                            }, this),
                                            " camera ·",
                                            " ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                className: "text-zinc-400",
                                                children: "R"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 104,
                                                columnNumber: 19
                                            }, this),
                                            " reset · ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("b", {
                                                className: "text-zinc-400",
                                                children: "ESC"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 104,
                                                columnNumber: 62
                                            }, this),
                                            " pause"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 101,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 81,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                                className: "w-72 shrink-0 hidden lg:flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/70",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                className: "size-4 text-amber-500"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 111,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-xs font-bold tracking-[0.3em] text-zinc-400",
                                                children: "RECORDS"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 112,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-auto text-[10px] font-mono text-zinc-600",
                                                children: records.length
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 113,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 110,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$scroll$2d$area$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ScrollArea"], {
                                        className: "flex-1 min-h-0",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "p-3 space-y-1.5",
                                            children: records.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-zinc-600 text-center py-8 leading-relaxed",
                                                children: [
                                                    "No lap records yet.",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                                        lineNumber: 120,
                                                        columnNumber: 25
                                                    }, this),
                                                    "Go set one."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 118,
                                                columnNumber: 23
                                            }, this) : records.slice(0, 12).map((r, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "flex items-center gap-2 text-xs bg-zinc-900/60 rounded-md px-2.5 py-1.5",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "w-5 text-zinc-600 font-mono",
                                                            children: [
                                                                i + 1,
                                                                "."
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                                            lineNumber: 126,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "size-2.5 rounded-full shrink-0 border border-black/40",
                                                            style: {
                                                                backgroundColor: r.carColor
                                                            }
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                                            lineNumber: 127,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "flex-1 truncate font-semibold text-zinc-200",
                                                            children: r.playerName
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                                            lineNumber: 128,
                                                            columnNumber: 27
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "font-mono text-amber-400 tabular-nums",
                                                            children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtTime"])(r.lapTimeMs)
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                                            lineNumber: 129,
                                                            columnNumber: 27
                                                        }, this)
                                                    ]
                                                }, r.id, true, {
                                                    fileName: "[project]/src/components/game/MainMenu.tsx",
                                                    lineNumber: 125,
                                                    columnNumber: 25
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                            lineNumber: 116,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 115,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 109,
                                columnNumber: 15
                            }, this)
                        ]
                    }, "mode", true, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 72,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                        initial: {
                            opacity: 0,
                            x: 24
                        },
                        animate: {
                            opacity: 1,
                            x: 0
                        },
                        exit: {
                            opacity: 0,
                            x: 24
                        },
                        transition: {
                            duration: 0.25
                        },
                        className: "flex-1 min-h-0 flex flex-col gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "shrink-0 flex items-center gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        variant: "outline",
                                        size: "icon",
                                        onClick: ()=>step === "car" ? setStep("map") : setStage("mode"),
                                        className: "border-zinc-700 h-8 w-8",
                                        "aria-label": "Back",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                                            className: "size-4"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/MainMenu.tsx",
                                            lineNumber: 149,
                                            columnNumber: 19
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 148,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepCrumb, {
                                        n: 1,
                                        label: "TRACK",
                                        active: step === "map",
                                        done: step === "car"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 151,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-zinc-700 font-black",
                                        children: "›"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 152,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepCrumb, {
                                        n: 2,
                                        label: "RIDE",
                                        active: step === "car"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 153,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-zinc-700 font-black",
                                        children: "›"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 154,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StepCrumb, {
                                        n: 3,
                                        label: "RACE",
                                        active: false
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 155,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-auto text-[10px] font-bold tracking-[0.25em] text-zinc-600",
                                        children: pendingMode === "quick" ? "QUICK RACE" : "TIME TRIAL"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 156,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 147,
                                columnNumber: 15
                            }, this),
                            step === "map" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-h-0 flex flex-col gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex-1 min-h-0 grid grid-cols-3 gap-4",
                                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAPS"].map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setMapId(m.id),
                                                "aria-label": `Select ${m.name}`,
                                                className: `map-card ${mapId === m.id ? "map-card-active" : ""}`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MapSchematic$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapSchematic"], {
                                                        map: m,
                                                        className: "w-full flex-1 min-h-0 text-amber-400/70"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                                        lineNumber: 171,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "shrink-0 pt-2 text-left",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-sm font-black italic tracking-wide",
                                                                children: m.name
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                                lineNumber: 173,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "text-[9px] text-zinc-500 tracking-[0.18em] font-bold mt-0.5",
                                                                children: m.description
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                                lineNumber: 174,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                                        lineNumber: 172,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, m.id, true, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 165,
                                                columnNumber: 23
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 163,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "shrink-0 flex items-center gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-zinc-500 leading-relaxed flex-1",
                                                children: [
                                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAPS"].find((m)=>m.id === mapId)?.name,
                                                    " — ",
                                                    __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAPS"].find((m)=>m.id === mapId)?.description,
                                                    ".",
                                                    pendingMode === "trial" ? " Time trial runs this circuit solo; your best lap goes on the board." : " 3 laps against 3 AI rivals."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 180,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                onClick: ()=>setStep("car"),
                                                className: "menu-btn menu-btn-accent px-8 py-3 text-base",
                                                children: [
                                                    "NEXT: PICK RIDE ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                        className: "size-4 ml-1"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                                        lineNumber: 185,
                                                        columnNumber: 39
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 184,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 179,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 162,
                                columnNumber: 17
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-h-0 flex flex-col gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$RideSelect$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RideSelect"], {
                                        carId: carId,
                                        onCarId: setCarId,
                                        color: carColor,
                                        onColor: setCarColor,
                                        name: playerName,
                                        onName: setPlayerName
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 191,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "shrink-0 flex items-center gap-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-zinc-500 leading-relaxed flex-1",
                                                children: "Paint and driver tag apply instantly — your name rides the leaderboard."
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 200,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                onClick: ()=>onStart(pendingMode),
                                                className: "menu-btn menu-btn-accent px-10 py-3.5 text-lg",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                        className: "size-5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                                        lineNumber: 207,
                                                        columnNumber: 23
                                                    }, this),
                                                    " GO"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                                lineNumber: 203,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/MainMenu.tsx",
                                        lineNumber: 199,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/MainMenu.tsx",
                                lineNumber: 190,
                                columnNumber: 17
                            }, this)
                        ]
                    }, "setup", true, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 138,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/src/components/game/MainMenu.tsx",
                    lineNumber: 70,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/game/MainMenu.tsx",
                lineNumber: 69,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/MainMenu.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
_s(MainMenu, "DFZ5MHNuR1rva4hN80oD1UWQCFU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"]
    ];
});
_c = MainMenu;
function ModeCard({ onClick, icon, title, subtitle, accent }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
        onClick: onClick,
        className: `menu-btn h-auto py-4 px-5 justify-start group ${accent ? "menu-btn-accent" : ""}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "mr-4 p-2.5 rounded-md bg-black/50 text-amber-500 group-hover:scale-110 transition-transform",
                children: icon
            }, void 0, false, {
                fileName: "[project]/src/components/game/MainMenu.tsx",
                lineNumber: 235,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-left",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block text-lg font-black italic tracking-wide",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 237,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block text-[11px] font-medium text-zinc-400 tracking-wide",
                        children: subtitle
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/MainMenu.tsx",
                        lineNumber: 238,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/MainMenu.tsx",
                lineNumber: 236,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/MainMenu.tsx",
        lineNumber: 234,
        columnNumber: 5
    }, this);
}
_c1 = ModeCard;
function StepCrumb({ n, label, active, done }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.22em] px-2.5 py-1 rounded-md border ${active ? "border-amber-500/70 text-amber-400 bg-amber-500/10" : done ? "border-zinc-700 text-zinc-400" : "border-zinc-800 text-zinc-600"}`,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-mono",
                children: n
            }, void 0, false, {
                fileName: "[project]/src/components/game/MainMenu.tsx",
                lineNumber: 255,
                columnNumber: 7
            }, this),
            " ",
            label
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/MainMenu.tsx",
        lineNumber: 246,
        columnNumber: 5
    }, this);
}
_c2 = StepCrumb;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "MainMenu");
__turbopack_context__.k.register(_c1, "ModeCard");
__turbopack_context__.k.register(_c2, "StepCrumb");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/OnlineBrowser.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OnlineBrowser",
    ()=>OnlineBrowser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── OnlineBrowser: CS 1.6-style server list + private join + create ────────
// PUBLIC rooms stream in live; PRIVATE rooms stay unlisted (join by code).
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/gameStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MapSchematic$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/MapSchematic.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/use-toast.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.js [app-client] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.js [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/refresh-cw.js [app-client] (ecmascript) <export default as RefreshCw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/user.js [app-client] (ecmascript) <export default as User>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [app-client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi.js [app-client] (ecmascript) <export default as Wifi>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi-off.js [app-client] (ecmascript) <export default as WifiOff>");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
function OnlineBrowser({ net, ensureNet, netRef, onBack, onEnterRoom, onNetReset }) {
    _s();
    const { playerName, setPlayerName, carColor, carId } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])();
    const { toast } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const [rooms, setRooms] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [joinCode, setJoinCode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [busy, setBusy] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [createVisibility, setCreateVisibility] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("public");
    const [connected, setConnected] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(net?.connected ?? false);
    // subscribe to the public room list while this screen is open
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OnlineBrowser.useEffect": ()=>{
            const n = ensureNet();
            if (!n) return;
            n.onRooms = ({
                "OnlineBrowser.useEffect": (list)=>setRooms(list)
            })["OnlineBrowser.useEffect"];
            n.onConnected = ({
                "OnlineBrowser.useEffect": (c)=>setConnected(c)
            })["OnlineBrowser.useEffect"];
            n.onError = ({
                "OnlineBrowser.useEffect": (msg)=>toast({
                        title: "Online error",
                        description: msg,
                        variant: "destructive"
                    })
            })["OnlineBrowser.useEffect"];
            const wasConnected = n.connected;
            if (wasConnected) n.subscribeRooms();
            else n.connect();
            const t = setTimeout({
                "OnlineBrowser.useEffect.t": ()=>n.subscribeRooms()
            }["OnlineBrowser.useEffect.t"], 400); // after connect handshake
            return ({
                "OnlineBrowser.useEffect": ()=>{
                    clearTimeout(t);
                    if (netRef.current === n) {
                        n.onRooms = null;
                        // keep onConnected/onError wired — the lobby reuses this client
                        n.unsubscribeRooms();
                    }
                }
            })["OnlineBrowser.useEffect"];
        }
    }["OnlineBrowser.useEffect"], [
        net,
        ensureNet,
        netRef,
        toast
    ]);
    const ensureConnected = ()=>ensureNet();
    /** a failed connect left the socket dead (reconnection exhausted) — rebuild it */ const recoverNet = (n, err)=>{
        if (n && String(err?.message ?? "").includes("unreachable")) {
            onNetReset();
            return true;
        }
        return false;
    };
    const handleJoinPublic = async (code)=>{
        if (!playerName.trim()) return toast({
            title: "Enter a driver name first"
        });
        setBusy(true);
        try {
            const n = ensureConnected();
            if (!n) throw new Error("Could not start connection");
            await waitForSocket(n);
            await n.joinRoom(code, playerName.trim(), carColor, carId);
            onEnterRoom(code, false, "public");
        } catch (e) {
            recoverNet(netRef.current, e);
            toast({
                title: "Could not join",
                description: String(e.message),
                variant: "destructive"
            });
        } finally{
            setBusy(false);
        }
    };
    const handleJoinPrivate = async ()=>{
        if (!playerName.trim()) return toast({
            title: "Enter a driver name first"
        });
        if (joinCode.trim().length < 4) return toast({
            title: "Enter the 4-character room code"
        });
        setBusy(true);
        try {
            const n = ensureConnected();
            if (!n) throw new Error("Could not start connection");
            await waitForSocket(n);
            await n.joinRoom(joinCode, playerName.trim(), carColor, carId);
            onEnterRoom(joinCode.trim().toUpperCase(), false, "private");
        } catch (e) {
            recoverNet(netRef.current, e);
            toast({
                title: "Could not join",
                description: String(e.message),
                variant: "destructive"
            });
        } finally{
            setBusy(false);
        }
    };
    const handleCreate = async ()=>{
        if (!playerName.trim()) return toast({
            title: "Enter a driver name first"
        });
        setBusy(true);
        try {
            const n = ensureConnected();
            if (!n) throw new Error("Could not start connection");
            await waitForSocket(n);
            const roomId = await n.createRoom(playerName.trim(), carColor, carId, createVisibility, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState().mapId);
            onEnterRoom(roomId, true, createVisibility);
        } catch (e) {
            recoverNet(netRef.current, e);
            toast({
                title: "Failed to create room",
                description: String(e.message),
                variant: "destructive"
            });
        } finally{
            setBusy(false);
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 overflow-hidden menu-bg flex flex-col select-none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "shrink-0 flex items-center gap-3 px-6 sm:px-10 pt-5 pb-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        variant: "outline",
                        size: "icon",
                        onClick: onBack,
                        className: "border-zinc-700",
                        "aria-label": "Back to menu",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                            className: "size-4"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                            lineNumber: 128,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                        lineNumber: 127,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "logo-title text-3xl font-black italic",
                        children: "ONLINE"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                        lineNumber: 130,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${connected ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`,
                        children: [
                            connected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                                className: "size-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 134,
                                columnNumber: 24
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__["WifiOff"], {
                                className: "size-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 134,
                                columnNumber: 54
                            }, this),
                            connected ? "SERVER LIVE" : "CONNECTING"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                        lineNumber: 131,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "ml-auto flex items-center gap-2 w-64",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$user$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__User$3e$__["User"], {
                                className: "size-4 text-amber-500 shrink-0"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 138,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                value: playerName,
                                onChange: (e)=>setPlayerName(e.target.value.slice(0, 16)),
                                placeholder: "DRIVER NAME",
                                className: "bg-zinc-950/70 border-amber-900/50 focus-visible:ring-amber-500/40 font-semibold tracking-wider h-9",
                                "aria-label": "Driver name"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 139,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                        lineNumber: 137,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                lineNumber: 126,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 flex gap-5 px-6 sm:px-10 pb-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].section, {
                        initial: {
                            opacity: 0,
                            y: 12
                        },
                        animate: {
                            opacity: 1,
                            y: 0
                        },
                        className: "flex-1 min-w-0 flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/70",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "shrink-0 flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"], {
                                        className: "size-4 text-amber-500"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 157,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold tracking-[0.3em] text-zinc-400",
                                        children: "PUBLIC GAMES"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 158,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-auto flex items-center gap-1.5 text-[10px] font-mono text-zinc-600",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$refresh$2d$cw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RefreshCw$3e$__["RefreshCw"], {
                                                className: "size-3 animate-spin-slow"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 160,
                                                columnNumber: 15
                                            }, this),
                                            " LIVE"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 159,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 156,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-h-0 overflow-y-auto p-3 space-y-2",
                                children: rooms.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "h-full flex flex-col items-center justify-center text-center gap-2 py-10",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"], {
                                            className: "size-8 text-zinc-700"
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                            lineNumber: 167,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm text-zinc-500 font-semibold",
                                            children: "No public games right now."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                            lineNumber: 168,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-[11px] text-zinc-600",
                                            children: "Create one — it will show up here for everyone."
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                            lineNumber: 169,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                    lineNumber: 166,
                                    columnNumber: 15
                                }, this) : rooms.map((r)=>{
                                    const map = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mapEntry"])(r.mapId);
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "room-row group",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MapSchematic$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapSchematic"], {
                                                map: map ?? {
                                                    id: "?",
                                                    name: "?",
                                                    description: "",
                                                    points: [
                                                        [
                                                            0,
                                                            0,
                                                            0
                                                        ]
                                                    ]
                                                },
                                                className: "size-14 shrink-0 text-amber-400/70"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 179,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "min-w-0 flex-1",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-sm font-black italic tracking-wide truncate",
                                                                children: [
                                                                    r.host,
                                                                    "'s room"
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                                lineNumber: 182,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "font-mono text-[10px] text-zinc-500 tracking-[0.25em]",
                                                                children: r.code
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                                lineNumber: 183,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 181,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center gap-2 mt-0.5 text-[10px] font-bold tracking-[0.15em] text-zinc-500",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "truncate",
                                                                children: map?.name ?? r.mapId.toUpperCase()
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                                lineNumber: 186,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "text-zinc-700",
                                                                children: "·"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                                lineNumber: 187,
                                                                columnNumber: 25
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                children: r.racing ? "RACING" : "IN LOBBY"
                                                            }, void 0, false, {
                                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                                lineNumber: 188,
                                                                columnNumber: 25
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 185,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 180,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `shrink-0 inline-flex items-center gap-1 text-xs font-bold ${r.racing ? "text-red-400" : "text-emerald-400"}`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"], {
                                                        className: "size-3.5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 192,
                                                        columnNumber: 23
                                                    }, this),
                                                    " ",
                                                    r.players,
                                                    "/",
                                                    r.max
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 191,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                size: "sm",
                                                disabled: busy,
                                                onClick: ()=>handleJoinPublic(r.code),
                                                className: "menu-btn menu-btn-accent shrink-0 h-8",
                                                children: "JOIN"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 194,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, r.code, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 175,
                                        columnNumber: 19
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 164,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                        lineNumber: 151,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-[340px] shrink-0 flex flex-col gap-5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].section, {
                                initial: {
                                    opacity: 0,
                                    y: 12
                                },
                                animate: {
                                    opacity: 1,
                                    y: 0
                                },
                                transition: {
                                    delay: 0.05
                                },
                                className: "rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                                className: "size-4 text-amber-500"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 218,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-xs font-bold tracking-[0.3em] text-zinc-400",
                                                children: "CREATE ROOM"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 219,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 217,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-2 gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setCreateVisibility("public"),
                                                className: `vis-pick ${createVisibility === "public" ? "vis-pick-active" : ""}`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"], {
                                                        className: "size-4 mb-1"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 226,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[10px] font-black tracking-[0.18em]",
                                                        children: "PUBLIC"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 227,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[9px] text-zinc-500 font-semibold",
                                                        children: "listed for everyone"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 228,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 222,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>setCreateVisibility("private"),
                                                className: `vis-pick ${createVisibility === "private" ? "vis-pick-active" : ""}`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                                        className: "size-4 mb-1"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 234,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[10px] font-black tracking-[0.18em]",
                                                        children: "PRIVATE"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 235,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[9px] text-zinc-500 font-semibold",
                                                        children: "invite code only"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                        lineNumber: 236,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 230,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 221,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: handleCreate,
                                        disabled: busy,
                                        className: "menu-btn menu-btn-accent w-full py-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                className: "size-4"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 240,
                                                columnNumber: 15
                                            }, this),
                                            " CREATE"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 239,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 211,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].section, {
                                initial: {
                                    opacity: 0,
                                    y: 12
                                },
                                animate: {
                                    opacity: 1,
                                    y: 0
                                },
                                transition: {
                                    delay: 0.1
                                },
                                className: "rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                                className: "size-4 text-amber-500"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 251,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-xs font-bold tracking-[0.3em] text-zinc-400",
                                                children: "JOIN BY CODE"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 252,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 250,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                                value: joinCode,
                                                onChange: (e)=>setJoinCode(e.target.value.toUpperCase().slice(0, 4)),
                                                placeholder: "CODE",
                                                className: "bg-zinc-900/80 border-zinc-700 font-mono text-lg tracking-[0.4em] uppercase w-32 h-10",
                                                "aria-label": "Room code"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 255,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                onClick: handleJoinPrivate,
                                                disabled: busy,
                                                className: "menu-btn flex-1 h-10",
                                                children: "JOIN"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                                lineNumber: 262,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 254,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[10px] text-zinc-600 leading-relaxed",
                                        children: "Private rooms never appear in the list — only drivers with the 4-letter code can get in."
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                        lineNumber: 266,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                                lineNumber: 244,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                        lineNumber: 210,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/OnlineBrowser.tsx",
                lineNumber: 149,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/OnlineBrowser.tsx",
        lineNumber: 124,
        columnNumber: 5
    }, this);
}
_s(OnlineBrowser, "9RpFvvQRhI4XI1vY4Nwz4CFxPmU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"]
    ];
});
_c = OnlineBrowser;
function waitForSocket(net) {
    return new Promise((resolve, reject)=>{
        if (net.socket?.connected) return resolve();
        const t = setTimeout(()=>reject(new Error("Race server unreachable")), 8000);
        net.socket?.once("connect", ()=>{
            clearTimeout(t);
            resolve();
        });
    });
}
var _c;
__turbopack_context__.k.register(_c, "OnlineBrowser");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/OnlineLobby.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OnlineLobby",
    ()=>OnlineLobby
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── Online lobby: driver list, MY RIDE modal, READY gate, host controls ────
// The host picks map + laps and can kick; everyone (host included) toggles
// their own READY — START stays locked until the whole grid is ready.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/gameStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MapSchematic$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/MapSchematic.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$RideSelect$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/RideSelect.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/use-toast.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$car$2d$front$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CarFront$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/car-front.js [app-client] (ecmascript) <export default as CarFront>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crown$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crown$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/crown.js [app-client] (ecmascript) <export default as Crown>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.js [app-client] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/log-out.js [app-client] (ecmascript) <export default as LogOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.js [app-client] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [app-client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi.js [app-client] (ecmascript) <export default as Wifi>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi-off.js [app-client] (ecmascript) <export default as WifiOff>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
function OnlineLobby({ net, netRef, onBack, onRaceStarting, onLeaveRoom, onKicked }) {
    _s();
    const { carId, setCarId, carColor, setCarColor, lobby, setLobby } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])();
    const { toast } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const [rideModal, setRideModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const startedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const myId = netRef.current?.socket?.id ?? net?.socket?.id ?? "";
    const me = lobby.players.find((p)=>p.id === myId);
    const allReady = lobby.players.length > 0 && lobby.players.every((p)=>p.ready);
    const notReadyCount = lobby.players.filter((p)=>!p.ready).length;
    const roomMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mapEntry"])(lobby.mapId);
    // wire callbacks whenever the NetClient instance changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "OnlineLobby.useEffect": ()=>{
            if (!net) return;
            net.onPlayers = ({
                "OnlineLobby.useEffect": (players)=>setLobby({
                        players,
                        hostId: net.hostId
                    })
            })["OnlineLobby.useEffect"];
            net.onConnected = ({
                "OnlineLobby.useEffect": (connected)=>setLobby({
                        connected
                    })
            })["OnlineLobby.useEffect"];
            net.onRoomMap = ({
                "OnlineLobby.useEffect": (mapId)=>setLobby({
                        mapId
                    })
            })["OnlineLobby.useEffect"];
            net.onRaceStart = ({
                "OnlineLobby.useEffect": (laps)=>{
                    if (startedRef.current) return;
                    startedRef.current = true;
                    setRideModal(false);
                    onRaceStarting(laps);
                }
            })["OnlineLobby.useEffect"];
            net.onError = ({
                "OnlineLobby.useEffect": (msg)=>toast({
                        title: "Cannot start",
                        description: msg,
                        variant: "destructive"
                    })
            })["OnlineLobby.useEffect"];
            net.onKicked = ({
                "OnlineLobby.useEffect": ()=>{
                    startedRef.current = false;
                    setRideModal(false);
                    onKicked();
                }
            })["OnlineLobby.useEffect"];
            net.onDisconnected = ({
                "OnlineLobby.useEffect": ()=>{
                    if (!startedRef.current) {
                        setLobby({
                            connected: false,
                            roomId: "",
                            players: []
                        });
                        toast({
                            title: "Disconnected",
                            description: "Lost connection to the race server."
                        });
                    }
                }
            })["OnlineLobby.useEffect"];
            setLobby({
                connected: net.connected
            });
            return ({
                "OnlineLobby.useEffect": ()=>{
                    if (netRef.current === net) return; // still active — keep handlers
                }
            })["OnlineLobby.useEffect"];
        }
    }["OnlineLobby.useEffect"], [
        net,
        netRef,
        setLobby,
        toast,
        onRaceStarting,
        onKicked
    ]);
    // live-push car/paint choices to the room
    const changeCar = (id)=>{
        setCarId(id);
        net?.updateCar(id);
    };
    const changeColor = (c)=>{
        setCarColor(c);
        net?.updateColor(c);
    };
    const toggleReady = ()=>net?.setReady(!me?.ready);
    const handleKick = (id)=>{
        net?.kickPlayer(id);
    };
    const handleStart = ()=>{
        if (!allReady) return;
        net?.startRace(lobby.laps);
    };
    const handleLeave = ()=>{
        startedRef.current = false;
        setRideModal(false);
        onLeaveRoom();
        onBack();
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 overflow-hidden menu-bg flex flex-col select-none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "shrink-0 flex items-center gap-3 px-6 sm:px-10 pt-5 pb-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        variant: "outline",
                        size: "icon",
                        onClick: handleLeave,
                        className: "border-zinc-700",
                        "aria-label": "Leave room",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                            className: "size-4"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/OnlineLobby.tsx",
                            lineNumber: 108,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 107,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "logo-title text-2xl font-black italic",
                        children: "ROOM"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 110,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-mono text-2xl font-black tracking-[0.35em] text-amber-400",
                        children: lobby.roomId
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 111,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${lobby.visibility === "public" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"}`,
                        children: [
                            lobby.visibility === "public" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"], {
                                className: "size-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 115,
                                columnNumber: 44
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"], {
                                className: "size-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 115,
                                columnNumber: 75
                            }, this),
                            lobby.visibility.toUpperCase()
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 112,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$car$2d$front$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CarFront$3e$__["CarFront"], {
                                className: "size-3 text-amber-500"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 119,
                                columnNumber: 11
                            }, this),
                            " ",
                            roomMap?.name ?? lobby.mapId.toUpperCase()
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 118,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${lobby.connected ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`,
                        children: [
                            lobby.connected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                                className: "size-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 124,
                                columnNumber: 30
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2d$off$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WifiOff$3e$__["WifiOff"], {
                                className: "size-3"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 124,
                                columnNumber: 60
                            }, this),
                            lobby.connected ? "LIVE" : "OFFLINE"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 121,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                lineNumber: 106,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex-1 min-h-0 flex gap-5 px-6 sm:px-10 pb-6",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                        initial: {
                            opacity: 0,
                            y: 12
                        },
                        animate: {
                            opacity: 1,
                            y: 0
                        },
                        className: "flex-1 min-w-0 flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/70",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "shrink-0 flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"], {
                                        className: "size-4 text-amber-500"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 137,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-xs font-bold tracking-[0.3em] text-zinc-400",
                                        children: [
                                            lobby.players.length,
                                            " DRIVER",
                                            lobby.players.length === 1 ? "" : "S",
                                            " ON THE GRID"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 138,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "ml-auto text-[10px] font-mono text-zinc-600",
                                        children: allReady ? "ALL READY" : `${notReadyCount} NOT READY`
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 141,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 136,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 min-h-0 overflow-y-auto p-3 space-y-2",
                                children: lobby.players.map((p)=>{
                                    const car = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carEntry"])(p.carId);
                                    const isMe = p.id === myId;
                                    const isHost = p.id === lobby.hostId;
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `lobby-player ${p.ready ? "lobby-player-ready" : ""}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "size-3 rounded-full border border-black/50 shrink-0",
                                                style: {
                                                    backgroundColor: p.color
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 154,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-bold text-zinc-100 truncate",
                                                children: p.name
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 155,
                                                columnNumber: 19
                                            }, this),
                                            isHost && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crown$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crown$3e$__["Crown"], {
                                                className: "size-3.5 text-amber-500 shrink-0",
                                                "aria-label": "Host"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 156,
                                                columnNumber: 30
                                            }, this),
                                            isMe && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-[9px] font-black text-amber-500 tracking-widest shrink-0",
                                                children: "YOU"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 157,
                                                columnNumber: 28
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-auto inline-flex items-center gap-1 text-[9px] font-black tracking-[0.18em] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 shrink-0",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$car$2d$front$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CarFront$3e$__["CarFront"], {
                                                        className: "size-3 text-amber-500/80"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                        lineNumber: 159,
                                                        columnNumber: 21
                                                    }, this),
                                                    " ",
                                                    car?.short ?? "?"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 158,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: `inline-flex items-center gap-1 text-[9px] font-black tracking-[0.18em] px-1.5 py-0.5 rounded shrink-0 ${p.ready ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`,
                                                children: p.ready ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                            className: "size-3"
                                                        }, void 0, false, {
                                                            fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                            lineNumber: 168,
                                                            columnNumber: 25
                                                        }, this),
                                                        " READY"
                                                    ]
                                                }, void 0, true) : "NOT READY"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 161,
                                                columnNumber: 19
                                            }, this),
                                            lobby.isHost && !isMe && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>handleKick(p.id),
                                                "aria-label": `Kick ${p.name}`,
                                                className: "p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                    className: "size-3.5"
                                                }, void 0, false, {
                                                    fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                    lineNumber: 180,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 175,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, p.id, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 153,
                                        columnNumber: 17
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 147,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "shrink-0 p-3 border-t border-zinc-800/80 flex gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        variant: "outline",
                                        onClick: ()=>setRideModal(true),
                                        className: "border-zinc-700 flex-1 h-10",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$car$2d$front$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CarFront$3e$__["CarFront"], {
                                                className: "size-4 mr-2 text-amber-500"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 191,
                                                columnNumber: 15
                                            }, this),
                                            " MY RIDE",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-2 text-[9px] font-black tracking-[0.18em] text-zinc-500",
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["carEntry"])(carId)?.short
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 192,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 190,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: toggleReady,
                                        className: `menu-btn h-10 flex-1 ${me?.ready ? "menu-btn-accent" : ""}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                className: "size-4"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 200,
                                                columnNumber: 15
                                            }, this),
                                            " ",
                                            me?.ready ? "READY" : "READY UP"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 196,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 189,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 130,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-[340px] shrink-0 flex flex-col gap-5",
                        children: [
                            lobby.isHost ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].section, {
                                initial: {
                                    opacity: 0,
                                    y: 12
                                },
                                animate: {
                                    opacity: 1,
                                    y: 0
                                },
                                className: "rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3 flex-1 flex flex-col",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$crown$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Crown$3e$__["Crown"], {
                                                className: "size-4 text-amber-500"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 214,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-xs font-bold tracking-[0.3em] text-zinc-400",
                                                children: "HOST CONTROLS"
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 215,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "ml-auto flex gap-1",
                                                children: [
                                                    2,
                                                    3,
                                                    5
                                                ].map((l)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: ()=>setLobby({
                                                                laps: l
                                                            }),
                                                        className: `lap-pick ${lobby.laps === l ? "lap-pick-active" : ""}`,
                                                        "aria-label": `${l} laps`,
                                                        children: l
                                                    }, l, false, {
                                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                        lineNumber: 218,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 216,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 213,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "grid grid-cols-3 gap-2",
                                        children: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MAPS"].map((m)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                onClick: ()=>net?.setRoomMap(m.id),
                                                className: `map-mini ${lobby.mapId === m.id ? "map-mini-active" : ""}`,
                                                "aria-label": `Track ${m.name}`,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MapSchematic$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapSchematic"], {
                                                        map: m,
                                                        className: "w-10 h-10 text-amber-400/70"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                        lineNumber: 238,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-[8px] font-black tracking-[0.12em] mt-1",
                                                        children: m.name.split(" ")[0]
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                        lineNumber: 239,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, m.id, true, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 232,
                                                columnNumber: 19
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 230,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "mt-auto space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                onClick: handleStart,
                                                disabled: !allReady,
                                                className: "menu-btn menu-btn-accent w-full py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                        className: "size-5"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                        lineNumber: 250,
                                                        columnNumber: 19
                                                    }, this),
                                                    " START RACE"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 245,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-[11px] text-zinc-500 text-center leading-relaxed",
                                                children: allReady ? lobby.players.length < 2 ? "Solo grid — green light when you fire." : "Full grid ready — drop the flag." : `START unlocks when all ${lobby.players.length} drivers are READY.`
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 252,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 244,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 208,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].section, {
                                initial: {
                                    opacity: 0,
                                    y: 12
                                },
                                animate: {
                                    opacity: 1,
                                    y: 0
                                },
                                className: "rounded-xl border border-dashed border-zinc-700/80 p-6 flex-1 flex flex-col items-center justify-center text-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"], {
                                        className: "size-8 text-zinc-600"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 267,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-zinc-300 font-semibold",
                                        children: "Waiting for the host…"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 268,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[11px] text-zinc-500 leading-relaxed",
                                        children: [
                                            "Tune your ride, hit READY, and keep this tab open.",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("br", {}, void 0, false, {
                                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                                lineNumber: 271,
                                                columnNumber: 17
                                            }, this),
                                            "The race fires the moment the host starts it."
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 269,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 262,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "outline",
                                onClick: handleLeave,
                                className: "border-zinc-700 py-2.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__["LogOut"], {
                                        className: "size-4 mr-2"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 278,
                                        columnNumber: 13
                                    }, this),
                                    " LEAVE ROOM"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                lineNumber: 277,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                        lineNumber: 206,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                lineNumber: 129,
                columnNumber: 7
            }, this),
            rideModal && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                    initial: {
                        opacity: 0,
                        scale: 0.96
                    },
                    animate: {
                        opacity: 1,
                        scale: 1
                    },
                    className: "w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl p-5 flex flex-col gap-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center gap-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$car$2d$front$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CarFront$3e$__["CarFront"], {
                                    className: "size-5 text-amber-500"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                    lineNumber: 292,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "text-sm font-black tracking-[0.3em] text-zinc-300",
                                    children: "MY RIDE"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                    lineNumber: 293,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    variant: "outline",
                                    size: "icon",
                                    onClick: ()=>setRideModal(false),
                                    className: "ml-auto border-zinc-700 h-8 w-8",
                                    "aria-label": "Close",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        className: "size-4"
                                    }, void 0, false, {
                                        fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                        lineNumber: 301,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/OnlineLobby.tsx",
                                    lineNumber: 294,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/game/OnlineLobby.tsx",
                            lineNumber: 291,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$RideSelect$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RideSelect"], {
                            compact: true,
                            carId: carId,
                            onCarId: changeCar,
                            color: carColor,
                            onColor: changeColor
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/OnlineLobby.tsx",
                            lineNumber: 304,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[10px] text-zinc-600 text-center",
                            children: "Car and paint broadcast to the room instantly — the grid updates for everyone."
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/OnlineLobby.tsx",
                            lineNumber: 311,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/OnlineLobby.tsx",
                    lineNumber: 286,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/components/game/OnlineLobby.tsx",
                lineNumber: 285,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/OnlineLobby.tsx",
        lineNumber: 104,
        columnNumber: 5
    }, this);
}
_s(OnlineLobby, "SUbuNg4g9GvgwA0SjhVnmAWloN4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"]
    ];
});
_c = OnlineLobby;
var _c;
__turbopack_context__.k.register(_c, "OnlineLobby");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/ui/card.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Card",
    ()=>Card,
    "CardAction",
    ()=>CardAction,
    "CardContent",
    ()=>CardContent,
    "CardDescription",
    ()=>CardDescription,
    "CardFooter",
    ()=>CardFooter,
    "CardHeader",
    ()=>CardHeader,
    "CardTitle",
    ()=>CardTitle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
;
;
function Card({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = Card;
function CardHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-header",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 20,
        columnNumber: 5
    }, this);
}
_c1 = CardHeader;
function CardTitle({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-title",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("leading-none font-semibold", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 33,
        columnNumber: 5
    }, this);
}
_c2 = CardTitle;
function CardDescription({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-description",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-muted-foreground text-sm", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 43,
        columnNumber: 5
    }, this);
}
_c3 = CardDescription;
function CardAction({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-action",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 53,
        columnNumber: 5
    }, this);
}
_c4 = CardAction;
function CardContent({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-content",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("px-6", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
_c5 = CardContent;
function CardFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "data-slot": "card-footer",
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-center px-6 [.border-t]:pt-6", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/src/components/ui/card.tsx",
        lineNumber: 76,
        columnNumber: 5
    }, this);
}
_c6 = CardFooter;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6;
__turbopack_context__.k.register(_c, "Card");
__turbopack_context__.k.register(_c1, "CardHeader");
__turbopack_context__.k.register(_c2, "CardTitle");
__turbopack_context__.k.register(_c3, "CardDescription");
__turbopack_context__.k.register(_c4, "CardAction");
__turbopack_context__.k.register(_c5, "CardContent");
__turbopack_context__.k.register(_c6, "CardFooter");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/ResultsScreen.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ResultsScreen",
    ()=>ResultsScreen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── Post-race results screen ────────────────────────────────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/card.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/Game.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/gameStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/rotate-ccw.js [app-client] (ecmascript) <export default as RotateCcw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/house.js [app-client] (ecmascript) <export default as Home>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi.js [app-client] (ecmascript) <export default as Wifi>");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function ResultsScreen({ onRestart, onMenu, onLobby }) {
    _s();
    const results = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "ResultsScreen.useGameStore[results]": (s)=>s.results
    }["ResultsScreen.useGameStore[results]"]);
    const mode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "ResultsScreen.useGameStore[mode]": (s)=>s.mode
    }["ResultsScreen.useGameStore[mode]"]);
    const player = results.find((r)=>r.isPlayer);
    const sorted = [
        ...results
    ].sort((a, b)=>a.position - b.position);
    const place = player?.position;
    const headline = place === 1 ? "VICTORY" : place === 2 ? "SO CLOSE" : place === 3 ? "PODIUM" : place ? "FINISHED" : "RACE OVER";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 overflow-y-auto menu-bg flex items-center justify-center p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
            initial: {
                opacity: 0,
                scale: 0.94
            },
            animate: {
                opacity: 1,
                scale: 1
            },
            transition: {
                duration: 0.35
            },
            className: "w-full max-w-lg",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: `logo-title text-4xl sm:text-5xl font-black italic text-center mb-1 ${place === 1 ? "text-amber-400" : "text-white"}`,
                    children: headline
                }, void 0, false, {
                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                    lineNumber: 35,
                    columnNumber: 9
                }, this),
                player && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-center text-zinc-500 text-xs tracking-[0.35em] mb-5",
                    children: [
                        "P",
                        place,
                        " · ",
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtTime"])(player.totalTimeMs)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                    lineNumber: 43,
                    columnNumber: 11
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Card"], {
                    className: "bg-zinc-950/85 border-zinc-800",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardHeader"], {
                            className: "pb-2",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardTitle"], {
                                className: "text-sm font-bold tracking-[0.3em] text-zinc-400",
                                children: "FINAL STANDINGS"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                lineNumber: 50,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/ResultsScreen.tsx",
                            lineNumber: 49,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$card$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CardContent"], {
                            className: "space-y-1.5",
                            children: [
                                sorted.map((r, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `results-row flex items-center gap-3 rounded-md px-3 py-2.5 ${r.isPlayer ? "bg-amber-500/10 border border-amber-500/30" : "bg-zinc-900/70"}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "w-7 text-center font-black italic text-lg text-zinc-400",
                                                children: r.position || i + 1
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                lineNumber: 62,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "size-3 rounded-full shrink-0 border border-black/50",
                                                style: {
                                                    backgroundColor: r.color
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                lineNumber: 63,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "flex-1 truncate font-bold text-zinc-100",
                                                children: [
                                                    r.name,
                                                    r.isPlayer && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-amber-500",
                                                        children: " ◂ YOU"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                        lineNumber: 69,
                                                        columnNumber: 34
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                lineNumber: 67,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-right font-mono text-sm tabular-nums",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: r.totalTimeMs ? "text-zinc-200" : "text-zinc-600",
                                                        children: r.totalTimeMs ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtTime"])(r.totalTimeMs) : "DNF"
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                        lineNumber: 72,
                                                        columnNumber: 19
                                                    }, this),
                                                    r.bestLapMs > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "block text-[10px] text-amber-500/80",
                                                        children: [
                                                            "BL ",
                                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fmtTime"])(r.bestLapMs)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                        lineNumber: 76,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                                lineNumber: 71,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, `${r.name}-${i}`, true, {
                                        fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                        lineNumber: 56,
                                        columnNumber: 15
                                    }, this)),
                                player && player.driftScore > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "pt-2 text-right text-xs text-zinc-400",
                                    children: [
                                        "DRIFT SCORE ",
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-black text-amber-400 italic",
                                            children: player.driftScore.toLocaleString()
                                        }, void 0, false, {
                                            fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                            lineNumber: 85,
                                            columnNumber: 29
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                    lineNumber: 84,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/game/ResultsScreen.tsx",
                            lineNumber: 54,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                    lineNumber: 48,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-5 grid grid-cols-2 gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            onClick: onRestart,
                            className: "menu-btn menu-btn-accent py-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__["RotateCcw"], {
                                    className: "size-4 mr-2"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                    lineNumber: 96,
                                    columnNumber: 13
                                }, this),
                                " RESTART"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/game/ResultsScreen.tsx",
                            lineNumber: 92,
                            columnNumber: 11
                        }, this),
                        mode === "online" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            onClick: onLobby,
                            className: "menu-btn py-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                                    className: "size-4 mr-2"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                    lineNumber: 100,
                                    columnNumber: 15
                                }, this),
                                " BACK TO LOBBY"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/game/ResultsScreen.tsx",
                            lineNumber: 99,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            onClick: onMenu,
                            className: "menu-btn py-3",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
                                    className: "size-4 mr-2"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                                    lineNumber: 104,
                                    columnNumber: 15
                                }, this),
                                " MAIN MENU"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/src/components/game/ResultsScreen.tsx",
                            lineNumber: 103,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/ResultsScreen.tsx",
                    lineNumber: 91,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/game/ResultsScreen.tsx",
            lineNumber: 29,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/game/ResultsScreen.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
_s(ResultsScreen, "gjqNdPVpCKT6D+FywYbr+8oarUw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"]
    ];
});
_c = ResultsScreen;
var _c;
__turbopack_context__.k.register(_c, "ResultsScreen");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/TouchControls.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TouchControls",
    ()=>TouchControls,
    "_keep",
    ()=>_keep
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── Touch controls for mobile racing ───────────────────────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-client] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gauge$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gauge$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/gauge.js [app-client] (ecmascript) <export default as Gauge>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Triangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle.js [app-client] (ecmascript) <export default as Triangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
function TouchControls({ gameRef }) {
    const bind = (btn)=>({
            onPointerDown: (e)=>{
                e.preventDefault();
                e.target.setPointerCapture?.(e.pointerId);
                gameRef.current?.input.setTouch(btn, true);
            },
            onPointerUp: (e)=>{
                e.preventDefault();
                gameRef.current?.input.setTouch(btn, false);
            },
            onPointerCancel: ()=>gameRef.current?.input.setTouch(btn, false),
            onPointerLeave: ()=>gameRef.current?.input.setTouch(btn, false),
            onContextMenu: (e)=>e.preventDefault()
        });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "touch-only absolute inset-0 pointer-events-none",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-4 left-3 flex gap-3 pointer-events-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        ...bind("left"),
                        className: "touch-btn",
                        "aria-label": "Steer left",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                            className: "size-8"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/TouchControls.tsx",
                            lineNumber: 28,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/TouchControls.tsx",
                        lineNumber: 27,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        ...bind("right"),
                        className: "touch-btn",
                        "aria-label": "Steer right",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                            className: "size-8"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/TouchControls.tsx",
                            lineNumber: 31,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/TouchControls.tsx",
                        lineNumber: 30,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/TouchControls.tsx",
                lineNumber: 26,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-4 right-3 flex flex-col items-end gap-2 pointer-events-auto",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                ...bind("nitro"),
                                className: "touch-btn touch-btn-nitro",
                                "aria-label": "Nitro",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                                    className: "size-5"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/TouchControls.tsx",
                                    lineNumber: 39,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/TouchControls.tsx",
                                lineNumber: 38,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                ...bind("hb"),
                                className: "touch-btn touch-btn-drift",
                                "aria-label": "Handbrake drift",
                                children: "DRIFT"
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/TouchControls.tsx",
                                lineNumber: 41,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/TouchControls.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                ...bind("brake"),
                                className: "touch-btn touch-btn-brake",
                                "aria-label": "Brake",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Triangle$3e$__["Triangle"], {
                                    className: "size-6 rotate-180"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/TouchControls.tsx",
                                    lineNumber: 47,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/TouchControls.tsx",
                                lineNumber: 46,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                ...bind("gas"),
                                className: "touch-btn touch-btn-gas",
                                "aria-label": "Accelerate",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gauge$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gauge$3e$__["Gauge"], {
                                    className: "size-8"
                                }, void 0, false, {
                                    fileName: "[project]/src/components/game/TouchControls.tsx",
                                    lineNumber: 50,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/src/components/game/TouchControls.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/src/components/game/TouchControls.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/TouchControls.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/TouchControls.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, this);
}
_c = TouchControls;
const _keep = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"];
var _c;
__turbopack_context__.k.register(_c, "TouchControls");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/PauseOverlay.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PauseOverlay",
    ()=>PauseOverlay
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── Pause overlay ───────────────────────────────────────────────────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/house.js [app-client] (ecmascript) <export default as Home>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/rotate-ccw.js [app-client] (ecmascript) <export default as RotateCcw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wifi.js [app-client] (ecmascript) <export default as Wifi>");
"use client";
;
;
;
;
function PauseOverlay({ onResume, onRestart, onQuit }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
            initial: {
                opacity: 0,
                scale: 0.95
            },
            animate: {
                opacity: 1,
                scale: 1
            },
            className: "w-full max-w-xs space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "logo-title text-4xl font-black italic text-center text-white mb-4",
                    children: "PAUSED"
                }, void 0, false, {
                    fileName: "[project]/src/components/game/PauseOverlay.tsx",
                    lineNumber: 23,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    onClick: onResume,
                    className: "menu-btn menu-btn-accent w-full py-3.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                            className: "size-4 mr-2"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/PauseOverlay.tsx",
                            lineNumber: 25,
                            columnNumber: 11
                        }, this),
                        " RESUME"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/PauseOverlay.tsx",
                    lineNumber: 24,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    onClick: onRestart,
                    className: "menu-btn w-full py-3.5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__["RotateCcw"], {
                            className: "size-4 mr-2"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/PauseOverlay.tsx",
                            lineNumber: 28,
                            columnNumber: 11
                        }, this),
                        " RESTART RACE"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/PauseOverlay.tsx",
                    lineNumber: 27,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    onClick: onQuit,
                    variant: "outline",
                    className: "w-full py-3.5 border-zinc-700 bg-zinc-950/60",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$house$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Home$3e$__["Home"], {
                            className: "size-4 mr-2"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/PauseOverlay.tsx",
                            lineNumber: 31,
                            columnNumber: 11
                        }, this),
                        " QUIT TO MENU"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/PauseOverlay.tsx",
                    lineNumber: 30,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[11px] text-zinc-500 text-center pt-1 tracking-wider",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wifi$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wifi$3e$__["Wifi"], {
                            className: "inline size-3 mr-1 -mt-0.5"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/PauseOverlay.tsx",
                            lineNumber: 34,
                            columnNumber: 11
                        }, this),
                        "Progress is saved when a race finishes"
                    ]
                }, void 0, true, {
                    fileName: "[project]/src/components/game/PauseOverlay.tsx",
                    lineNumber: 33,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/src/components/game/PauseOverlay.tsx",
            lineNumber: 18,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/game/PauseOverlay.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
_c = PauseOverlay;
var _c;
__turbopack_context__.k.register(_c, "PauseOverlay");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/game/GameShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GameShell",
    ()=>GameShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
// ─── GameShell: canvas + screen orchestration + game lifecycle ───────────────
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/core/Game.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$net$2f$NetClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/net/NetClient.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/world/CarModelLoader.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/stores/gameStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$HUD$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/HUD.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MainMenu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/MainMenu.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$OnlineBrowser$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/OnlineBrowser.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$OnlineLobby$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/OnlineLobby.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$ResultsScreen$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/ResultsScreen.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$TouchControls$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/TouchControls.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$PauseOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/game/PauseOverlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/hooks/use-toast.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$volume$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Volume2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/volume-2.js [app-client] (ecmascript) <export default as Volume2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$volume$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__VolumeX$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/volume-x.js [app-client] (ecmascript) <export default as VolumeX>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ui/button.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function GameShell() {
    _s();
    const canvasRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const gameRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const netRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [net, setNet] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const { toast } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"])();
    const screen = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[screen]": (s)=>s.screen
    }["GameShell.useGameStore[screen]"]);
    const mode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[mode]": (s)=>s.mode
    }["GameShell.useGameStore[mode]"]);
    const playerName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[playerName]": (s)=>s.playerName
    }["GameShell.useGameStore[playerName]"]);
    const carColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[carColor]": (s)=>s.carColor
    }["GameShell.useGameStore[carColor]"]);
    const carId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[carId]": (s)=>s.carId
    }["GameShell.useGameStore[carId]"]);
    const muted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[muted]": (s)=>s.muted
    }["GameShell.useGameStore[muted]"]);
    const lobbyPlayers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[lobbyPlayers]": (s)=>s.lobby.players
    }["GameShell.useGameStore[lobbyPlayers]"]);
    const setScreen = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setScreen]": (s)=>s.setScreen
    }["GameShell.useGameStore[setScreen]"]);
    const setMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setMode]": (s)=>s.setMode
    }["GameShell.useGameStore[setMode]"]);
    const setHud = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setHud]": (s)=>s.setHud
    }["GameShell.useGameStore[setHud]"]);
    const setCountdown = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setCountdown]": (s)=>s.setCountdown
    }["GameShell.useGameStore[setCountdown]"]);
    const flashLap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[flashLap]": (s)=>s.flashLap
    }["GameShell.useGameStore[flashLap]"]);
    const setResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setResults]": (s)=>s.setResults
    }["GameShell.useGameStore[setResults]"]);
    const setLobby = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setLobby]": (s)=>s.setLobby
    }["GameShell.useGameStore[setLobby]"]);
    const setMuted = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"])({
        "GameShell.useGameStore[setMuted]": (s)=>s.setMuted
    }["GameShell.useGameStore[setMuted]"]);
    const [raceSession, setRaceSession] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const launchingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    // warm the model cache while the user is in the menus (all registry cars —
    // draco viper GLBs included — so the garage + countdown are instant)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameShell.useEffect": ()=>{
            void (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["preloadAllCarModels"])();
        }
    }["GameShell.useEffect"], []);
    const disposeGame = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[disposeGame]": ()=>{
            gameRef.current?.quit();
            gameRef.current = null;
        }
    }["GameShell.useCallback[disposeGame]"], []);
    // ── shared NetClient factory (state so the lobby re-wires callbacks when it changes) ──
    const ensureNet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[ensureNet]": ()=>{
            let n = net;
            if (!n) {
                n = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$net$2f$NetClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NetClient"]();
                n.connect();
                netRef.current = n;
                setNet(n);
            }
            return n;
        }
    }["GameShell.useCallback[ensureNet]"], [
        net
    ]);
    // ── build the Game instance (canvas is always mounted, so handler-time creation is safe) ──
    const launchGame = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[launchGame]": (m, laps)=>{
            if (!canvasRef.current || launchingRef.current) return;
            launchingRef.current = true;
            disposeGame();
            void ({
                "GameShell.useCallback[launchGame]": async ()=>{
                    // map: online rooms use the host's pick, offline uses the wizard pick
                    const mapId = m === "online" ? __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState().lobby.mapId : __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState().mapId;
                    // ensure every car that can appear is cached: player + AI pool
                    // offline; player + whatever the lobby peers drive online —
                    // derived from the registry, never listed here
                    const lobbyPlayers = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState().lobby.players;
                    const ids = m === "online" ? [
                        carId,
                        ...lobbyPlayers.map({
                            "GameShell.useCallback[launchGame]": (p)=>p.carId
                        }["GameShell.useCallback[launchGame]"]).filter({
                            "GameShell.useCallback[launchGame]": (id)=>id && id !== carId
                        }["GameShell.useCallback[launchGame]"])
                    ] : (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["preloadCarIds"])(carId);
                    await Promise.allSettled(ids.map({
                        "GameShell.useCallback[launchGame]": (id)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$world$2f$CarModelLoader$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["loadCarModel"])(id)
                    }["GameShell.useCallback[launchGame]"]));
                    launchingRef.current = false;
                    if (!canvasRef.current) return; // unmounted while loading
                    const game = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$core$2f$Game$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Game"](canvasRef.current, {
                        mode: m,
                        playerName: playerName.trim() || "DRIVER",
                        carColor,
                        carId,
                        mapId,
                        laps,
                        net: m === "online" ? netRef.current : null
                    }, {
                        onHud: setHud,
                        onCountdown: {
                            "GameShell.useCallback[launchGame]": (step)=>{
                                setCountdown(step);
                                if (step === null) setScreen("racing");
                            }
                        }["GameShell.useCallback[launchGame]"],
                        onLapFlash: flashLap,
                        onFinish: {
                            "GameShell.useCallback[launchGame]": (results)=>{
                                setResults(results);
                                setScreen("results");
                                // persist best lap
                                const mine = results.find({
                                    "GameShell.useCallback[launchGame].mine": (r)=>r.isPlayer
                                }["GameShell.useCallback[launchGame].mine"]);
                                if (mine && mine.bestLapMs > 500) {
                                    fetch("/api/records", {
                                        method: "POST",
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: JSON.stringify({
                                            playerName: playerName.trim() || "DRIVER",
                                            lapTimeMs: mine.bestLapMs,
                                            mode: m,
                                            carColor
                                        })
                                    }).catch({
                                        "GameShell.useCallback[launchGame]": ()=>{}
                                    }["GameShell.useCallback[launchGame]"]);
                                }
                            }
                        }["GameShell.useCallback[launchGame]"],
                        onOnlineFinish: {
                            "GameShell.useCallback[launchGame]": ()=>{}
                        }["GameShell.useCallback[launchGame]"]
                    });
                    gameRef.current = game;
                    // dev/test hook — lets the browser console & automated tests drive the sim
                    if ("TURBOPACK compile-time truthy", 1) {
                        window.__threeNfs = game;
                    }
                    game.audio.setMuted(muted);
                    game.beginCountdown();
                    setRaceSession({
                        mode: m,
                        laps
                    });
                }
            })["GameShell.useCallback[launchGame]"]();
        }
    }["GameShell.useCallback[launchGame]"], [
        disposeGame,
        playerName,
        carColor,
        carId,
        muted,
        setHud,
        setCountdown,
        flashLap,
        setResults,
        setScreen
    ]);
    // ── pause / resume sync ──
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameShell.useEffect": ()=>{
            const g = gameRef.current;
            if (!g) return;
            if (screen === "paused") g.setPaused(true);
            else if (screen === "racing") g.setPaused(false);
        }
    }["GameShell.useEffect"], [
        screen
    ]);
    // ── keep remote player list synced into the game ──
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameShell.useEffect": ()=>{
            gameRef.current?.syncRemotePlayers(lobbyPlayers);
        }
    }["GameShell.useEffect"], [
        lobbyPlayers
    ]);
    // ── global Esc handling for pause (React side) ──
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameShell.useEffect": ()=>{
            const onKey = {
                "GameShell.useEffect.onKey": (e)=>{
                    if (e.key !== "Escape") return;
                    const st = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState();
                    if (st.screen === "racing") setScreen("paused");
                    else if (st.screen === "paused") setScreen("racing");
                }
            }["GameShell.useEffect.onKey"];
            window.addEventListener("keydown", onKey);
            return ({
                "GameShell.useEffect": ()=>window.removeEventListener("keydown", onKey)
            })["GameShell.useEffect"];
        }
    }["GameShell.useEffect"], [
        setScreen
    ]);
    // ── navigation actions ──
    const requireName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[requireName]": ()=>{
            if (playerName.trim()) return true;
            toast({
                title: "Enter a driver name",
                description: "Set your tag in the menu first."
            });
            return false;
        }
    }["GameShell.useCallback[requireName]"], [
        playerName,
        toast
    ]);
    const startOffline = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[startOffline]": (m)=>{
            if (!requireName()) return;
            setMode(m);
            setScreen("countdown");
            // laps default to the selected circuit's registry value
            launchGame(m, (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mapDef"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState().mapId)?.defaultLaps ?? 3);
        }
    }["GameShell.useCallback[startOffline]"], [
        requireName,
        setMode,
        setScreen,
        launchGame
    ]);
    const handleQuitToMenu = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleQuitToMenu]": ()=>{
            disposeGame();
            setRaceSession(null);
            if (netRef.current) {
                netRef.current.leave();
                netRef.current = null;
                setNet(null);
            }
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"].getState().reset();
            setScreen("menu");
        }
    }["GameShell.useCallback[handleQuitToMenu]"], [
        disposeGame,
        setScreen
    ]);
    const handleOpenBrowser = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleOpenBrowser]": ()=>{
            if (!requireName()) return;
            setMode("online");
            setScreen("browser");
        }
    }["GameShell.useCallback[handleOpenBrowser]"], [
        requireName,
        setMode,
        setScreen
    ]);
    // ── browser told us we're in a room (created or joined) ──
    const handleEnterRoom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleEnterRoom]": (roomId, isHost, visibility)=>{
            setLobby({
                roomId,
                isHost,
                visibility,
                connected: true
            });
            setScreen("lobby");
        }
    }["GameShell.useCallback[handleEnterRoom]"], [
        setLobby,
        setScreen
    ]);
    // ── kicked by the host: drop room state, land back in the browser ──
    const handleKicked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleKicked]": ()=>{
            netRef.current?.leave();
            netRef.current = null;
            setNet(null);
            setLobby({
                roomId: "",
                isHost: false,
                players: [],
                connected: false
            });
            toast({
                title: "Kicked from room",
                description: "The host removed you from the grid."
            });
            setScreen("browser");
        }
    }["GameShell.useCallback[handleKicked]"], [
        setLobby,
        setScreen,
        toast
    ]);
    // ── leave the online room (destroys the NetClient + lobby state) ──
    const handleLeaveRoom = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleLeaveRoom]": ()=>{
            netRef.current?.leave();
            netRef.current = null;
            setNet(null);
            setLobby({
                roomId: "",
                isHost: false,
                players: [],
                connected: false
            });
        }
    }["GameShell.useCallback[handleLeaveRoom]"], [
        setLobby
    ]);
    const handleRaceStarting = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleRaceStarting]": (laps)=>{
            // server says GO — build the game with net wiring
            setLobby({
                laps
            });
            setScreen("countdown");
            launchGame("online", laps);
        }
    }["GameShell.useCallback[handleRaceStarting]"], [
        setLobby,
        setScreen,
        launchGame
    ]);
    const handleRestart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[handleRestart]": ()=>{
            const g = gameRef.current;
            if (!g) return;
            setResults([]);
            g.restart();
            g.audio.setMuted(muted);
            setScreen("countdown");
        }
    }["GameShell.useCallback[handleRestart]"], [
        muted,
        setResults,
        setScreen
    ]);
    const backToLobby = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[backToLobby]": ()=>{
            disposeGame();
            setRaceSession(null);
            setScreen("lobby");
        }
    }["GameShell.useCallback[backToLobby]"], [
        disposeGame,
        setScreen
    ]);
    // ── mute toggle button (in-race) ──
    const toggleMute = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "GameShell.useCallback[toggleMute]": ()=>{
            const next = !muted;
            setMuted(next);
            gameRef.current?.audio.setMuted(next);
        }
    }["GameShell.useCallback[toggleMute]"], [
        muted,
        setMuted
    ]);
    // cleanup on unmount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GameShell.useEffect": ()=>{
            return ({
                "GameShell.useEffect": ()=>{
                    gameRef.current?.quit();
                    gameRef.current = null;
                    netRef.current?.leave();
                    netRef.current = null;
                }
            })["GameShell.useEffect"];
        }
    }["GameShell.useEffect"], []);
    const inRaceUi = [
        "countdown",
        "racing",
        "paused"
    ].includes(screen);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "fixed inset-0 bg-[#07070a] overflow-hidden",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("canvas", {
                ref: canvasRef,
                className: `absolute inset-0 w-full h-full block ${inRaceUi || screen === "results" ? "" : "invisible"}`,
                "aria-label": "Race viewport"
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 283,
                columnNumber: 7
            }, this),
            inRaceUi && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$HUD$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["HUD"], {
                gameRef: gameRef
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 289,
                columnNumber: 20
            }, this),
            inRaceUi && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$TouchControls$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TouchControls"], {
                gameRef: gameRef
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 290,
                columnNumber: 20
            }, this),
            screen === "racing" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-3 right-3 flex gap-2 z-20",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        size: "icon",
                        variant: "outline",
                        onClick: toggleMute,
                        className: "bg-black/50 border-white/10 hover:bg-black/70",
                        "aria-label": muted ? "Unmute" : "Mute",
                        children: muted ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$volume$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__VolumeX$3e$__["VolumeX"], {
                            className: "size-4"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/GameShell.tsx",
                            lineNumber: 302,
                            columnNumber: 22
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$volume$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Volume2$3e$__["Volume2"], {
                            className: "size-4"
                        }, void 0, false, {
                            fileName: "[project]/src/components/game/GameShell.tsx",
                            lineNumber: 302,
                            columnNumber: 55
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/GameShell.tsx",
                        lineNumber: 295,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        size: "icon",
                        variant: "outline",
                        onClick: ()=>setScreen("paused"),
                        className: "bg-black/50 border-white/10 hover:bg-black/70 font-mono",
                        "aria-label": "Pause",
                        children: "II"
                    }, void 0, false, {
                        fileName: "[project]/src/components/game/GameShell.tsx",
                        lineNumber: 304,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 294,
                columnNumber: 9
            }, this),
            screen === "menu" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$MainMenu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MainMenu"], {
                onStart: startOffline,
                onOpenBrowser: handleOpenBrowser
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 316,
                columnNumber: 29
            }, this),
            screen === "browser" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$OnlineBrowser$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OnlineBrowser"], {
                net: net,
                ensureNet: ensureNet,
                netRef: netRef,
                onBack: ()=>setScreen("menu"),
                onEnterRoom: handleEnterRoom,
                onNetReset: handleLeaveRoom
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 318,
                columnNumber: 9
            }, this),
            screen === "lobby" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$OnlineLobby$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OnlineLobby"], {
                net: net,
                netRef: netRef,
                onBack: ()=>setScreen("browser"),
                onRaceStarting: handleRaceStarting,
                onLeaveRoom: handleLeaveRoom,
                onKicked: handleKicked
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 321,
                columnNumber: 9
            }, this),
            screen === "paused" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$PauseOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PauseOverlay"], {
                onResume: ()=>setScreen("racing"),
                onRestart: handleRestart,
                onQuit: mode === "online" ? backToLobby : handleQuitToMenu
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 331,
                columnNumber: 9
            }, this),
            screen === "results" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$game$2f$ResultsScreen$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ResultsScreen"], {
                onRestart: handleRestart,
                onMenu: handleQuitToMenu,
                onLobby: backToLobby
            }, void 0, false, {
                fileName: "[project]/src/components/game/GameShell.tsx",
                lineNumber: 338,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/game/GameShell.tsx",
        lineNumber: 281,
        columnNumber: 5
    }, this);
}
_s(GameShell, "/ERwvcpcZ4za5PgYXZzfYCM1fkI=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$hooks$2f$use$2d$toast$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useToast"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$stores$2f$gameStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useGameStore"]
    ];
});
_c = GameShell;
var _c;
__turbopack_context__.k.register(_c, "GameShell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_2bf56e18._.js.map
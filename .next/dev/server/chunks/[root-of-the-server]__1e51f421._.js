module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
const globalForPrisma = globalThis;
const db = globalForPrisma.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: [
        'query'
    ]
});
if ("TURBOPACK compile-time truthy", 1) globalForPrisma.prisma = db;
}),
"[project]/src/game/constants.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
}),
"[project]/src/game/cars/registry.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-route] (ecmascript)");
;
const DEFAULT_CAR_TUNING = {
    ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CAR_TUNING"],
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
const AI_POOL_IDS = CAR_LIBRARY.map((c)=>c.id);
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
}),
"[project]/src/game/maps/registry.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/constants.ts [app-route] (ecmascript)");
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
        groundColor: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"].ground,
        buildingColors: [
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"].buildingA,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"].buildingB,
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"].buildingC
        ],
        windowWarm: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"].windowWarm,
        windowCool: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"].windowCool,
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
        ...__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$constants$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PALETTE"],
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
}),
"[project]/src/app/api/records/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/cars/registry.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/game/maps/registry.ts [app-route] (ecmascript)");
;
;
;
;
/** keep an id only if it exists in its registry — otherwise store null */ function validId(raw, library) {
    if (typeof raw !== "string") return null;
    return library.some((x)=>x.id === raw) ? raw : null;
}
async function GET() {
    try {
        const records = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].lapRecord.findMany({
            orderBy: {
                lapTimeMs: "asc"
            },
            take: 10
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            records
        });
    } catch (error) {
        console.error("Failed to fetch lap records:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            records: []
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    try {
        const body = await request.json();
        const { playerName, lapTimeMs, mode, carColor, carId, mapId } = body;
        if (typeof playerName !== "string" || !playerName.trim() || typeof lapTimeMs !== "number" || lapTimeMs <= 0 || ![
            "quick",
            "trial",
            "online"
        ].includes(mode)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Invalid record payload"
            }, {
                status: 400
            });
        }
        const record = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["db"].lapRecord.create({
            data: {
                playerName: playerName.trim().slice(0, 24),
                lapTimeMs: Math.round(lapTimeMs),
                mode,
                carColor: typeof carColor === "string" ? carColor.slice(0, 9) : "#f59e0b",
                carId: validId(carId, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$cars$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CAR_LIBRARY"]),
                mapId: validId(mapId, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$game$2f$maps$2f$registry$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MAP_LIBRARY"])
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            record
        });
    } catch (error) {
        console.error("Failed to save lap record:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Failed to save record"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1e51f421._.js.map
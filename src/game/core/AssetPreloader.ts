// ─── AssetPreloader: boot-time download of the SHARED core + per-map warm on demand ──────────────────
// User report: "game freeze when i want to load contents … should preload and
// have a loading bar like other games, and it should cache assets, so it's not
// downloading them every game".
//
// What froze the game: ~20MB of assets (8MB city GLBs + 12MB asphalt PBR
// textures) had NO preload path — they were fetched by the Track /
// CityEnvironment constructors AFTER the race started, alongside multi-second
// mergeGeometries bakes on the main thread. Preloading at boot moves all of
// that work behind a real loading screen, and the service worker
// (public/sw.js) keeps the bytes across sessions.
//
// Later user report: "each map has its own assets. if we had 50 maps then it
// downloads all unnecessary data" — right. So boot now covers ONLY the shared
// core every race touches:
//   - 4 car GLBs        (loadCarModel → templates, exactly what races use)
//   - 4 city set GLBs   (loadCityModels → merged BuildingProtos)
//   - 3 asphalt maps    (the URLs Track will request, incl. ?v= rev)
//   - Draco/KTX2 WASM   (decoder warmup through the SW for session 2+)
// A map's OWN bytes — its scanned ground set, imported scenery GLB, the
// daytime sky HDR — load via warmMapAssets() the first time that map is
// launched (same NFS loading bar), then live in the SW bucket + module
// caches forever. N maps ⇒ players only ever pay for maps they actually
// drive.
import * as THREE from "three";
import { CAR_LIBRARY } from "../cars/registry";
import { loadCarModel } from "../world/CarModelLoader";
import { citySetUrls, loadCityModels, type CityLoadEvent } from "../world/CityModels";
import { ASPHALT_FILES, asphaltCandidates, groundCandidates } from "../world/Track";
import { mapDef, resolveEnvTheme } from "../maps/registry";
import { loadSpaScene } from "../world/SpaScene";
import { loadDaySkyTexture, skyAssetsFor } from "../world/DaySky";

/** decoder + transcoder payloads the loaders fetch on first use — warming them
 * through the service worker means session 2+ starts with zero downloads. */
const DECODER_URLS = [
  "/draco/draco_decoder.js",
  "/draco/draco_decoder.wasm",
  "/draco/draco_wasm_wrapper.js",
  "/ktx2/basis_transcoder.js",
  "/ktx2/basis_transcoder.wasm",
];

export interface AssetFileState {
  key: string;
  label: string;
  state: "pending" | "loading" | "baking" | "done" | "error";
  /** 0..1 within the file (download, then bake where applicable) */
  frac: number;
}

export interface BootProgress {
  pct: number;
  label: string;
  mbLoaded: string;
  mbTotal: string;
  files: AssetFileState[];
}

type Emit = (ev: BootProgress) => void;

/** register the asset cache worker and wait for it to control the page —
 * must happen BEFORE the downloads start so the very first session also
 * populates the Cache Storage bucket. Never blocks boot for more than 5s. */
export async function registerAssetServiceWorker(): Promise<void> {
  try {
    // session-level fetch dedup across every three.js loader
    THREE.Cache.enabled = true;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    await Promise.race([
      navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready),
      new Promise<void>((r) => setTimeout(r, 5000)),
    ]);
  } catch (e) {
    console.warn("[AssetPreloader] service worker unavailable:", e);
  }
}

// ─── byte accounting ────────────────────────────────────────────────────────

interface Unit {
  key: string;
  label: string;
  loaded: number;
  total: number;
  /** post-download work fraction (city bake) — folds into unit progress */
  bakeFrac: number;
  state: AssetFileState["state"];
}

const mb = (bytes: number) => (bytes / 1048576).toFixed(1);

/** HEAD-seed exact byte totals so the bar starts with the right denominator
 * (otherwise it jumps as streams open). Falls back to stream-reported totals
 * on any failure. */
async function seedSizes(urls: string[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u, { method: "HEAD" });
        const len = Number(res.headers.get("content-length"));
        if (res.ok && len > 0) sizes.set(u, len);
      } catch {
        /* HEAD is best-effort — streams still report totals */
      }
    })
  );
  return sizes;
}

/** fetch with byte-stream progress; resolves on success, throws after the
 * final candidate fails (callers tolerate errors — the game has fallbacks) */
async function fetchWithProgress(
  candidates: string[],
  onBytes: (loaded: number, total: number) => void,
): Promise<void> {
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue; // next candidate (staging fallback)
      const total = Number(res.headers.get("content-length")) || 0;
      if (!res.body || !total) {
        await res.arrayBuffer();
        onBytes(total, total);
        return;
      }
      const reader = res.body.getReader();
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        onBytes(loaded, total);
      }
      return;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error("no candidate reachable");
}

// ─── main entry ─────────────────────────────────────────────────────────────

const CITY_LABEL = new Map(citySetUrls().map((c) => [c.set, c.label]));
const CAR_ASSETS = CAR_LIBRARY.filter((c) => c.modelUrl).map((c) => ({
  id: c.id,
  url: c.modelUrl!,
  label: c.name,
}));
const CITY_ASSETS = citySetUrls();
const ASPHALT_ASSETS = ASPHALT_FILES.map((f) => ({
  key: "asphalt:" + f,
  label: "ROAD " + f.replace("asphalt-2k-", "").replace(".jpg", "").toUpperCase(),
  candidates: asphaltCandidates(f),
}));
// every theme's ground/scenery/sky set is warmed PER MAP by warmMapAssets()
// below — NOT at boot (user: "if we had 50 maps it downloads all unnecessary
// data"). Boot stays shared-core only. Themes may SHARE a ground set (spa
// reuses the touge's Grass005) — warmMapAssets dedupes by theme id.

/** preload the SHARED CORE (cars, city sets, asphalt, decoders), emitting
 * boot progress. Always resolves (units fail soft) — the loading screen must
 * never trap the user. Per-map bytes go through warmMapAssets() instead. */
export async function preloadGameAssets(onProgress: Emit): Promise<void> {
  const primaryUrls = [
    ...CAR_ASSETS.map((c) => c.url),
    ...CITY_ASSETS.map((c) => c.url),
    ...ASPHALT_ASSETS.map((a) => a.candidates[0]),
    ...DECODER_URLS,
  ];
  const seeds = await seedSizes(primaryUrls);

  const units: Unit[] = [];
  const unit = (key: string, label: string, url?: string): Unit => {
    const u: Unit = {
      key,
      label,
      loaded: 0,
      total: url ? seeds.get(url) ?? 0 : 0,
      bakeFrac: 0,
      state: "pending",
    };
    units.push(u);
    return u;
  };
  for (const c of CAR_ASSETS) unit("car:" + c.id, c.label, c.url);
  for (const c of CITY_ASSETS) unit("city:" + c.set, c.label, c.url);
  for (const a of ASPHALT_ASSETS) unit(a.key, a.label, a.candidates[0]);
  {
    // one unit for the whole decoder payload (5 small files)
    unit("decoders", "GPU DECODERS");
  }
  const decoderUnit = units[units.length - 1];

  // ── progress aggregation: 75% bytes + 25% unit completion ──
  let lastEmit = 0;
  let activeLabel = "CONNECTING";
  const emit = (force = false) => {
    const now = performance.now();
    if (!force && now - lastEmit < 90) return;
    lastEmit = now;
    let loaded = 0;
    let total = 0;
    let unitFrac = 0;
    for (const u of units) {
      loaded += u.loaded;
      total += u.total;
      const dl = u.total > 0 ? u.loaded / u.total : u.state === "done" ? 1 : 0;
      unitFrac += Math.min(1, (dl + u.bakeFrac) / 2);
    }
    const byteFrac = total > 0 ? loaded / total : 0;
    const pct = Math.min(99, Math.round(100 * (0.75 * byteFrac + 0.25 * (unitFrac / units.length))));
    onProgress({
      pct,
      label: activeLabel,
      mbLoaded: mb(loaded),
      mbTotal: total > 0 ? mb(total) : "—",
      files: units.map((u) => ({
        key: u.key,
        label: u.label,
        state: u.state,
        frac: Math.min(1, (u.total > 0 ? u.loaded / u.total : u.state === "done" ? 1 : 0) * 0.5 + u.bakeFrac * 0.5),
      })),
    });
  };

  const setLabel = (u: Unit, phase: string) => {
    activeLabel = phase + " " + u.label;
  };

  // ── unit runners (all parallel; each fails soft) ──
  const jobs: Promise<void>[] = [];

  for (const c of CAR_ASSETS) {
    const u = units.find((x) => x.key === "car:" + c.id)!;
    jobs.push(
      loadCarModel(c.id, (loaded, total) => {
        u.loaded = loaded;
        if (!u.total && total) u.total = total;
        u.state = "loading";
        setLabel(u, "LOADING");
        emit();
      })
        .then(() => {
          u.state = "done";
          u.bakeFrac = 1;
          emit(true);
        })
        .catch((e) => {
          console.warn("[AssetPreloader] car " + c.id + " failed:", e);
          u.state = "error";
          emit(true);
        }),
    );
  }

  const cityUnits = new Map<string, Unit>();
  for (const c of CITY_ASSETS) cityUnits.set(c.set, units.find((x) => x.key === "city:" + c.set)!);
  const onCityEvent = (ev: CityLoadEvent) => {
    const u = cityUnits.get(ev.set);
    if (!u) return;
    if (ev.phase === "download") {
      u.loaded = ev.loaded;
      if (!u.total && ev.total) u.total = ev.total;
      u.state = "loading";
      setLabel(u, "LOADING");
    } else if (ev.phase === "bake") {
      u.bakeFrac = ev.total > 0 ? ev.done / ev.total : 0;
      u.state = "baking";
      setLabel(u, "BAKING");
    } else {
      u.bakeFrac = 1;
      u.state = "done";
      emit(true);
    }
    emit();
  };
  jobs.push(
    loadCityModels(onCityEvent).then(() => {
      for (const u of cityUnits.values()) if (u.state !== "done") u.state = "done";
      emit(true);
    }),
  );

  for (const a of ASPHALT_ASSETS) {
    const u = units.find((x) => x.key === a.key)!;
    jobs.push(
      fetchWithProgress(a.candidates, (loaded, total) => {
        u.loaded = loaded;
        if (!u.total && total) u.total = total;
        u.state = "loading";
        setLabel(u, "LOADING");
        emit();
      })
        .then(() => {
          u.state = "done";
          u.bakeFrac = 1;
          emit(true);
        })
        .catch(() => {
          u.state = "error"; // procedural road stays — game is fine
          emit(true);
        }),
    );
  }

  // decoder payload: one byte pool across the 5 files
  {
    const u = decoderUnit;
    let decLoaded = 0;
    u.state = "loading";
    jobs.push(
      (async () => {
        const perFile = DECODER_URLS.map((url) => seeds.get(url) ?? 0);
        const perLoaded = new Array(DECODER_URLS.length).fill(0);
        await Promise.all(
          DECODER_URLS.map((url, i) =>
            fetchWithProgress([url], (loaded) => {
              perLoaded[i] = loaded;
              decLoaded = perLoaded.reduce((s, v) => s + v, 0);
              u.loaded = decLoaded;
              u.total = perFile.reduce((s, v) => s + v, 0) || decLoaded;
              setLabel(u, "LOADING");
              emit();
            }),
          ),
        );
        u.state = "done";
        u.bakeFrac = 1;
        emit(true);
      })().catch((e) => {
        console.warn("[AssetPreloader] decoder warmup failed:", e);
        u.state = "error";
        emit(true);
      }),
    );
  }

  // ── watchdog: never trap the boot behind a dead network ──
  await Promise.race([
    Promise.allSettled(jobs),
    new Promise<void>((r) => setTimeout(r, 45_000)),
  ]);
  activeLabel = "READY";
  emit(true);
}

// ─── per-map warm: theme ground / scenery / sky on first launch of a map ────
// The 50-maps future: boot stays flat no matter how many maps ship. A map's
// own bytes download exactly once — the first time it is launched — behind
// the same LoadingScreen UI (GameShell re-rendives it with this progress),
// then the SW bucket + module caches make every later launch of that map
// instant. Themes sharing a ground set (spa → touge's Grass005) warm under
// their own id; the shared files are already in the SW bucket by then.
const warmedThemes = new Set<string>();

/** warm one map's theme assets (ground set + scenery GLB + day sky).
 * Skips instantly when the theme already warmed this session. Always
 * resolves — the race's lazy loaders retry anything that failed. */
export async function warmMapAssets(mapId: string, onProgress?: Emit): Promise<void> {
  const def = mapDef(mapId);
  if (!def) return;
  const theme = resolveEnvTheme(def);
  if (warmedThemes.has(theme.id)) return;

  // exactly the lazy URLs this theme's race will request
  const groundUrls = theme.ground.files.map((f) => groundCandidates(theme.ground.dir, f));
  // the map's OWN day sky (spa bake ≠ island bake — same rig, different weather)
  const skyAssets = skyAssetsFor(mapId);
  const primaryUrls = [
    ...groundUrls.map((c) => c[0]),
    ...(theme.sceneGlb ? [theme.sceneGlb] : []),
    ...(theme.timeOfDay === "day" ? skyAssets.map((a) => a.candidates[0]) : []),
  ];
  const seeds = await seedSizes(primaryUrls);

  // one manifest line per warm unit (TERRAIN / SCENERY / SKY)
  const files: AssetFileState[] = [];
  const pools: { loaded: number; total: number }[] = [];
  const mkUnit = (label: string, seedBytes = 0): { f: AssetFileState; pool: { loaded: number; total: number } } => {
    const f: AssetFileState = { key: label, label, state: "pending", frac: 0 };
    files.push(f);
    const pool = { loaded: 0, total: seedBytes };
    pools.push(pool);
    return { f, pool };
  };
  const terrain = mkUnit(
    "TERRAIN " + theme.id.toUpperCase(),
    theme.ground.files.reduce((s, f) => s + (seeds.get(groundCandidates(theme.ground.dir, f)[0]) ?? 0), 0),
  );
  const scenery = theme.sceneGlb ? mkUnit("SCENERY " + theme.id.toUpperCase(), seeds.get(theme.sceneGlb) ?? 0) : null;
  const sky = theme.timeOfDay === "day" ? mkUnit("SKY PANORAMA", skyAssets.reduce((s, a) => s + (seeds.get(a.candidates[0]) ?? 0), 0)) : null;

  let failed = false;
  let lastEmit = 0;
  const emit = (force = false) => {
    if (!onProgress) return;
    const now = performance.now();
    if (!force && now - lastEmit < 90) return;
    lastEmit = now;
    let loaded = 0;
    let total = 0;
    let doneFrac = 0;
    for (const p of pools) {
      loaded += p.loaded;
      total += p.total;
    }
    for (const f of files) {
      const dl = f.state === "done" ? 1 : f.frac;
      doneFrac += Math.min(1, dl);
    }
    const byteFrac = total > 0 ? loaded / total : 0;
    const pct = total > 0 ? Math.min(99, Math.round(100 * byteFrac)) : Math.min(99, Math.round((100 * doneFrac) / files.length));
    onProgress({
      pct,
      label: "LOADING " + def.name,
      mbLoaded: mb(loaded),
      mbTotal: total > 0 ? mb(total) : "—",
      files: files.map((f) => ({ ...f })),
    });
  };
  emit(true);

  const jobs: Promise<void>[] = [];
  const onBytes = (u: { f: AssetFileState; pool: { loaded: number; total: number } }) => (loaded: number, total: number) => {
    u.pool.loaded = loaded;
    if (!u.pool.total && total) u.pool.total = total;
    u.f.state = "loading";
    u.f.frac = total > 0 ? loaded / total : 0.5;
    emit();
  };

  // terrain: 3 texture streams pooled into one unit (fail-soft: the lazy
  // ground loader retries with staging/flat fallbacks inside the race)
  jobs.push(
    (async () => {
      const parts = await Promise.allSettled(
        groundUrls.map((candidates) => fetchWithProgress(candidates, onBytes(terrain))),
      );
      terrain.f.state = parts.every((p) => p.status === "fulfilled") ? "done" : "error";
      if (terrain.f.state === "error") failed = true;
      terrain.f.frac = 1;
      emit(true);
    })(),
  );

  // scenery: parsed + cached by SpaScene's module cache (day variant match)
  if (scenery && theme.sceneGlb) {
    jobs.push(
      loadSpaScene(theme.sceneGlb, onBytes(scenery), theme.timeOfDay === "day")
        .then(() => {
          scenery.f.state = "done";
          scenery.f.frac = 1;
          emit(true);
        })
        .catch(() => {
          scenery.f.state = "error"; // race builds on ground + stars — fine
          failed = true;
          emit(true);
        }),
    );
  }

  // day sky: HDR parsed + uploaded into DaySky's module cache
  if (sky) {
    jobs.push(
      loadDaySkyTexture(mapId, onBytes(sky))
        .then(() => {
          sky.f.state = "done";
          sky.f.frac = 1;
          emit(true);
        })
        .catch(() => {
          sky.f.state = "error"; // flat palette background stays — fine
          failed = true;
          emit(true);
        }),
    );
  }

  // same watchdog contract as boot — never trap a launch
  await Promise.race([
    Promise.allSettled(jobs),
    new Promise<void>((r) => setTimeout(r, 45_000)),
  ]);
  // full success marks the theme warm (cached parts are instant on retry, so
  // a partial failure simply re-warms next launch without re-downloading)
  if (!failed) warmedThemes.add(theme.id);
  onProgress?.({
    pct: 100,
    label: "READY " + def.name,
    mbLoaded: mb(pools.reduce((s, p) => s + p.loaded, 0)),
    mbTotal: mb(pools.reduce((s, p) => s + p.total, 0)),
    files: files.map((f) => ({ ...f })),
  });
}

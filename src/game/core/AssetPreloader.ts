// ─── AssetPreloader: boot-time download of every game asset ──────────────────
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
// The preloader covers, in parallel, with byte-accurate progress:
//   - 4 car GLBs        (loadCarModel → templates, exactly what races use)
//   - 4 city set GLBs   (loadCityModels → merged BuildingProtos)
//   - 3 asphalt maps    (the URLs Track will request, incl. ?v= rev)
//   - Draco/KTX2 WASM   (decoder warmup through the SW for session 2+)
import * as THREE from "three";
import { CAR_LIBRARY } from "../cars/registry";
import { loadCarModel } from "../world/CarModelLoader";
import { citySetUrls, loadCityModels, type CityLoadEvent } from "../world/CityModels";
import { ASPHALT_FILES, asphaltCandidates, GROUND_FILES, groundCandidates } from "../world/Track";

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
const GROUND_ASSETS = GROUND_FILES.map((f) => ({
  key: "ground:" + f,
  label: "TERRAIN " + f.replace("ground-2k-", "").replace(".jpg", "").toUpperCase(),
  candidates: groundCandidates(f),
}));

/** preload EVERYTHING the game can load, emitting boot progress. Always
 * resolves (units fail soft) — the loading screen must never trap the user. */
export async function preloadGameAssets(onProgress: Emit): Promise<void> {
  const primaryUrls = [
    ...CAR_ASSETS.map((c) => c.url),
    ...CITY_ASSETS.map((c) => c.url),
    ...ASPHALT_ASSETS.map((a) => a.candidates[0]),
    ...GROUND_ASSETS.map((a) => a.candidates[0]),
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
  for (const a of GROUND_ASSETS) unit(a.key, a.label, a.candidates[0]);
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
  for (const a of GROUND_ASSETS) {
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
          u.state = "error"; // flat ground stays — game is fine
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

"use client";
// ─── Global game UI state ────────────────────────────────────────────────────
import { create } from "zustand";
import type { HudState, GameMode, RaceResultEntry } from "@/game/core/Game";
import type { NetPlayer } from "@/game/net/NetClient";
import { CAR_LIBRARY } from "@/game/cars/registry";
import { DEFAULT_MAP_ID, resolveMapId } from "@/game/maps/registry";

export type Screen = "menu" | "lobby" | "countdown" | "racing" | "paused" | "results";

interface GameStore {
  screen: Screen;
  mode: GameMode;
  playerName: string;
  carColor: string;
  carId: string;
  mapId: string;
  muted: boolean;

  hud: HudState;
  countdown: number | null;
  lapFlash: { msg: string; id: number } | null;
  results: RaceResultEntry[];

  lobby: {
    roomId: string;
    isHost: boolean;
    connected: boolean;
    players: NetPlayer[];
    laps: number;
    /** circuit the host picked for the room (registry id) */
    mapId: string;
  };

  setScreen: (s: Screen) => void;
  setMode: (m: GameMode) => void;
  setPlayerName: (n: string) => void;
  setCarColor: (c: string) => void;
  setCarId: (id: string) => void;
  setMapId: (id: string) => void;
  setMuted: (m: boolean) => void;
  setHud: (h: HudState) => void;
  setCountdown: (c: number | null) => void;
  flashLap: (msg: string) => void;
  setResults: (r: RaceResultEntry[]) => void;
  setLobby: (partial: Partial<GameStore["lobby"]>) => void;
  reset: () => void;
}

const LS_NAME = "three-nfs:name";
const LS_COLOR = "three-nfs:color";
const LS_CAR = "three-nfs:car";
const LS_MAP = "three-nfs:map";

/** retired car ids → their replacement (SRT-10 is the SRT's successor) */
const LEGACY_CAR_IDS: Record<string, string> = {
  viper: "viper08",
  viper2: "viper08",
};

/** retired map ids → their replacement (none retired yet — first maps ship now) */
const LEGACY_MAP_IDS: Record<string, string> = {};

/** map a persisted id onto a car that still exists in the garage */
function resolvePersistedCar(raw: string | null): string {
  const id = raw ? LEGACY_CAR_IDS[raw] ?? raw : "gtr";
  return CAR_LIBRARY.some((c) => c.id === id) ? id : "gtr";
}

/** map a persisted id onto a map that still exists in the registry */
function resolvePersistedMap(raw: string | null): string {
  return resolveMapId(raw ? LEGACY_MAP_IDS[raw] ?? raw : null);
}

function loadPersisted() {
  if (typeof window === "undefined") return { name: "", color: "#f59e0b", car: "gtr", map: DEFAULT_MAP_ID };
  try {
    return {
      name: window.localStorage.getItem(LS_NAME) ?? "",
      color: window.localStorage.getItem(LS_COLOR) ?? "#f59e0b",
      car: resolvePersistedCar(window.localStorage.getItem(LS_CAR)),
      map: resolvePersistedMap(window.localStorage.getItem(LS_MAP)),
    };
  } catch {
    return { name: "", color: "#f59e0b", car: "gtr", map: DEFAULT_MAP_ID };
  }
}

const emptyHud: HudState = {
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
  cameraMode: "chase",
};

export const useGameStore = create<GameStore>((set) => {
  const persisted = loadPersisted();
  let flashId = 0;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

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
    lobby: { roomId: "", isHost: false, connected: false, players: [], laps: 3, mapId: "" },

    setScreen: (s) => set({ screen: s }),
    setMode: (m) => set({ mode: m }),
    setPlayerName: (n) => {
      try {
        window.localStorage.setItem(LS_NAME, n);
      } catch {}
      set({ playerName: n });
    },
    setCarColor: (c) => {
      try {
        window.localStorage.setItem(LS_COLOR, c);
      } catch {}
      set({ carColor: c });
    },
    setCarId: (id) => {
      try {
        window.localStorage.setItem(LS_CAR, id);
      } catch {}
      set({ carId: id });
    },
    setMapId: (id) => {
      try {
        window.localStorage.setItem(LS_MAP, id);
      } catch {}
      set({ mapId: id });
    },
    setMuted: (m) => set({ muted: m }),
    setHud: (h) => set({ hud: h }),
    setCountdown: (c) => set({ countdown: c }),
    flashLap: (msg) => {
      flashId += 1;
      set({ lapFlash: { msg, id: flashId } });
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => set({ lapFlash: null }), 2800);
    },
    setResults: (r) => set({ results: r }),
    setLobby: (partial) => set((st) => ({ lobby: { ...st.lobby, ...partial } })),
    reset: () =>
      set({
        screen: "menu",
        hud: emptyHud,
        countdown: null,
        lapFlash: null,
        results: [],
        lobby: { roomId: "", isHost: false, connected: false, players: [], laps: 3, mapId: "" },
      }),
  };
});

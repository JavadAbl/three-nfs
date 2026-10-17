"use client";
// ─── Global game UI state ────────────────────────────────────────────────────
import { create } from "zustand";
import type { HudState, GameMode, RaceResultEntry } from "@/game/core/Game";
import type { NetPlayer } from "@/game/net/NetClient";

export type Screen = "menu" | "lobby" | "countdown" | "racing" | "paused" | "results";

interface GameStore {
  screen: Screen;
  mode: GameMode;
  playerName: string;
  carColor: string;
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
  };

  setScreen: (s: Screen) => void;
  setMode: (m: GameMode) => void;
  setPlayerName: (n: string) => void;
  setCarColor: (c: string) => void;
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

function loadPersisted() {
  if (typeof window === "undefined") return { name: "", color: "#f59e0b" };
  try {
    return {
      name: window.localStorage.getItem(LS_NAME) ?? "",
      color: window.localStorage.getItem(LS_COLOR) ?? "#f59e0b",
    };
  } catch {
    return { name: "", color: "#f59e0b" };
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
    muted: false,
    hud: emptyHud,
    countdown: null,
    lapFlash: null,
    results: [],
    lobby: { roomId: "", isHost: false, connected: false, players: [], laps: 3 },

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
        lobby: { roomId: "", isHost: false, connected: false, players: [], laps: 3 },
      }),
  };
});

"use client";
// ─── GameShell: canvas + screen orchestration + game lifecycle ───────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Game, type GameMode } from "@/game/core/Game";
import { NetClient } from "@/game/net/NetClient";
import { loadCarModel } from "@/game/world/CarModelLoader";
import { useGameStore } from "@/stores/gameStore";
import { HUD } from "@/components/game/HUD";
import { MainMenu } from "@/components/game/MainMenu";
import { OnlineLobby } from "@/components/game/OnlineLobby";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { TouchControls } from "@/components/game/TouchControls";
import { PauseOverlay } from "@/components/game/PauseOverlay";
import { useToast } from "@/hooks/use-toast";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StartRequest {
  mode: GameMode;
  laps: number;
}

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const netRef = useRef<NetClient | null>(null);
  const [net, setNet] = useState<NetClient | null>(null);
  const { toast } = useToast();

  const screen = useGameStore((s) => s.screen);
  const mode = useGameStore((s) => s.mode);
  const playerName = useGameStore((s) => s.playerName);
  const carColor = useGameStore((s) => s.carColor);
  const carId = useGameStore((s) => s.carId);
  const muted = useGameStore((s) => s.muted);
  const lobbyPlayers = useGameStore((s) => s.lobby.players);
  const setScreen = useGameStore((s) => s.setScreen);
  const setMode = useGameStore((s) => s.setMode);
  const setHud = useGameStore((s) => s.setHud);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const flashLap = useGameStore((s) => s.flashLap);
  const setResults = useGameStore((s) => s.setResults);
  const setLobby = useGameStore((s) => s.setLobby);
  const setMuted = useGameStore((s) => s.setMuted);

  const [raceSession, setRaceSession] = useState<StartRequest | null>(null);
  const launchingRef = useRef(false);

  // warm the model cache while the user is in the menus
  useEffect(() => {
    void loadCarModel("gtr").catch(() => {});
    void loadCarModel("audi").catch(() => {});
  }, []);

  const disposeGame = useCallback(() => {
    gameRef.current?.quit();
    gameRef.current = null;
  }, []);

  // ── shared NetClient factory (state so the lobby re-wires callbacks when it changes) ──
  const ensureNet = useCallback((): NetClient | null => {
    let n = net;
    if (!n) {
      n = new NetClient();
      n.connect();
      netRef.current = n;
      setNet(n);
    }
    return n;
  }, [net]);

  // ── build the Game instance (canvas is always mounted, so handler-time creation is safe) ──
  const launchGame = useCallback(
    (m: GameMode, laps: number) => {
      if (!canvasRef.current || launchingRef.current) return;
      launchingRef.current = true;
      disposeGame();
      void (async () => {
        // ensure the selected (and rival) car models are in cache — instant if warm
        await Promise.allSettled([
          loadCarModel(carId),
          loadCarModel("gtr"),
          loadCarModel("audi"),
          loadCarModel("viper"),
          loadCarModel("viper2"),
        ]);
        launchingRef.current = false;
        if (!canvasRef.current) return; // unmounted while loading
        const game = new Game(
          canvasRef.current,
          {
            mode: m,
            playerName: playerName.trim() || "DRIVER",
            carColor,
            carId,
            laps,
            net: m === "online" ? netRef.current : null,
          },
        {
          onHud: setHud,
          onCountdown: (step) => {
            setCountdown(step);
            if (step === null) setScreen("racing");
          },
          onLapFlash: flashLap,
          onFinish: (results) => {
            setResults(results);
            setScreen("results");
            // persist best lap
            const mine = results.find((r) => r.isPlayer);
            if (mine && mine.bestLapMs > 500) {
              fetch("/api/records", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  playerName: playerName.trim() || "DRIVER",
                  lapTimeMs: mine.bestLapMs,
                  mode: m,
                  carColor,
                }),
              }).catch(() => {});
            }
          },
          onOnlineFinish: () => {},
        }
      );
      gameRef.current = game;
      // dev/test hook — lets the browser console & automated tests drive the sim
      if (process.env.NODE_ENV === "development") {
        (window as unknown as { __threeNfs?: Game }).__threeNfs = game;
      }
      game.audio.setMuted(muted);
      game.beginCountdown();
      setRaceSession({ mode: m, laps });
      })();
    },
    [disposeGame, playerName, carColor, carId, muted, setHud, setCountdown, flashLap, setResults, setScreen]
  );

  // ── pause / resume sync ──
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (screen === "paused") g.setPaused(true);
    else if (screen === "racing") g.setPaused(false);
  }, [screen]);

  // ── keep remote player list synced into the game ──
  useEffect(() => {
    gameRef.current?.syncRemotePlayers(lobbyPlayers);
  }, [lobbyPlayers]);

  // ── global Esc handling for pause (React side) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const st = useGameStore.getState();
      if (st.screen === "racing") setScreen("paused");
      else if (st.screen === "paused") setScreen("racing");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScreen]);

  // ── navigation actions ──
  const requireName = useCallback(() => {
    if (playerName.trim()) return true;
    toast({ title: "Enter a driver name", description: "Set your tag in the menu first." });
    return false;
  }, [playerName, toast]);

  const startOffline = useCallback(
    (m: "quick" | "trial") => {
      if (!requireName()) return;
      setMode(m);
      setScreen("countdown");
      launchGame(m, 3);
    },
    [requireName, setMode, setScreen, launchGame]
  );

  const handleQuitToMenu = useCallback(() => {
    disposeGame();
    setRaceSession(null);
    if (netRef.current) {
      netRef.current.leave();
      netRef.current = null;
      setNet(null);
    }
    useGameStore.getState().reset();
    setScreen("menu");
  }, [disposeGame, setScreen]);

  const handleOpenLobby = useCallback(() => {
    if (!requireName()) return;
    setMode("online");
    setScreen("lobby");
  }, [requireName, setMode, setScreen]);

  // ── leave the online room (destroys the NetClient + lobby state) ──
  const handleLeaveRoom = useCallback(() => {
    netRef.current?.leave();
    netRef.current = null;
    setNet(null);
    setLobby({ roomId: "", isHost: false, players: [], connected: false });
  }, [setLobby]);

  const handleRaceStarting = useCallback(
    (laps: number) => {
      // server says GO — build the game with net wiring
      setLobby({ laps });
      setScreen("countdown");
      launchGame("online", laps);
    },
    [setLobby, setScreen, launchGame]
  );

  const handleRestart = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    setResults([]);
    g.restart();
    g.audio.setMuted(muted);
    setScreen("countdown");
  }, [muted, setResults, setScreen]);

  const backToLobby = useCallback(() => {
    disposeGame();
    setRaceSession(null);
    setScreen("lobby");
  }, [disposeGame, setScreen]);

  // ── mute toggle button (in-race) ──
  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    gameRef.current?.audio.setMuted(next);
  }, [muted, setMuted]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      gameRef.current?.quit();
      gameRef.current = null;
      netRef.current?.leave();
      netRef.current = null;
    };
  }, []);

  const inRaceUi = ["countdown", "racing", "paused"].includes(screen);

  return (
    <main className="fixed inset-0 bg-[#07070a] overflow-hidden">
      {/* three.js canvas — always mounted, hidden behind menus when idle */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full block ${inRaceUi || screen === "results" ? "" : "invisible"}`}
        aria-label="Race viewport"
      />

      {inRaceUi && <HUD gameRef={gameRef} />}
      {inRaceUi && <TouchControls gameRef={gameRef} />}

      {/* mute + pause quick buttons while racing */}
      {screen === "racing" && (
        <div className="absolute top-3 right-3 flex gap-2 z-20">
          <Button
            size="icon"
            variant="outline"
            onClick={toggleMute}
            className="bg-black/50 border-white/10 hover:bg-black/70"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setScreen("paused")}
            className="bg-black/50 border-white/10 hover:bg-black/70 font-mono"
            aria-label="Pause"
          >
            II
          </Button>
        </div>
      )}

      {screen === "menu" && <MainMenu onStart={startOffline} onOpenLobby={handleOpenLobby} />}
      {screen === "lobby" && (
        <OnlineLobby net={net} ensureNet={ensureNet} netRef={netRef} onBack={() => setScreen("menu")} onRaceStarting={handleRaceStarting} onLeaveRoom={handleLeaveRoom} />
      )}
      {screen === "paused" && (
        <PauseOverlay
          onResume={() => setScreen("racing")}
          onRestart={handleRestart}
          onQuit={mode === "online" ? backToLobby : handleQuitToMenu}
        />
      )}
      {screen === "results" && (
        <ResultsScreen onRestart={handleRestart} onMenu={handleQuitToMenu} onLobby={backToLobby} />
      )}
    </main>
  );
}

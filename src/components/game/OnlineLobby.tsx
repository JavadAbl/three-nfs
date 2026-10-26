"use client";
// ─── Online lobby: driver list, MY RIDE modal, READY gate, host controls ────
// The host picks map + laps and can kick; everyone (host included) toggles
// their own READY — START stays locked until the whole grid is ready.
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/stores/gameStore";
import { NetClient } from "@/game/net/NetClient";
import { MAPS, mapEntry } from "@/game/maps/registry";
import { carEntry } from "@/game/cars/registry";
import { MapSchematic } from "./MapSchematic";
import { RideSelect } from "./RideSelect";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CarFront, Check, Crown, Globe, LogOut, Lock, Play, Users, Wifi, WifiOff, X,
} from "lucide-react";

export function OnlineLobby({
  net,
  netRef,
  onBack,
  onRaceStarting,
  onLeaveRoom,
  onKicked,
}: {
  net: NetClient | null;
  netRef: React.MutableRefObject<NetClient | null>;
  onBack: () => void;
  onRaceStarting: (laps: number) => void;
  onLeaveRoom: () => void;
  onKicked: () => void;
}) {
  const { carId, setCarId, carColor, setCarColor, neonId, setNeonId, lobby, setLobby } = useGameStore();
  const { toast } = useToast();
  const [rideModal, setRideModal] = useState(false);
  const startedRef = useRef(false);

  const myId = netRef.current?.socket?.id ?? net?.socket?.id ?? "";
  const me = lobby.players.find((p) => p.id === myId);
  const allReady = lobby.players.length > 0 && lobby.players.every((p) => p.ready);
  const notReadyCount = lobby.players.filter((p) => !p.ready).length;
  const roomMap = mapEntry(lobby.mapId);

  // wire callbacks whenever the NetClient instance changes
  useEffect(() => {
    if (!net) return;
    net.onPlayers = (players) => setLobby({ players, hostId: net.hostId });
    net.onConnected = (connected) => setLobby({ connected });
    net.onRoomMap = (mapId) => setLobby({ mapId });
    net.onRaceStart = (laps) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setRideModal(false);
      onRaceStarting(laps);
    };
    net.onError = (msg) => toast({ title: "Cannot start", description: msg, variant: "destructive" });
    net.onKicked = () => {
      startedRef.current = false;
      setRideModal(false);
      onKicked();
    };
    net.onDisconnected = () => {
      if (!startedRef.current) {
        setLobby({ connected: false, roomId: "", players: [] });
        toast({ title: "Disconnected", description: "Lost connection to the race server." });
      }
    };
    setLobby({ connected: net.connected });
    return () => {
      if (netRef.current === net) return; // still active — keep handlers
    };
  }, [net, netRef, setLobby, toast, onRaceStarting, onKicked]);

  // live-push car/paint choices to the room
  const changeCar = (id: string) => {
    setCarId(id);
    net?.updateCar(id);
  };
  const changeColor = (c: string) => {
    setCarColor(c);
    net?.updateColor(c);
  };

  const toggleReady = () => net?.setReady(!me?.ready);

  const handleKick = (id: string) => {
    net?.kickPlayer(id);
  };

  const handleStart = () => {
    if (!allReady) return;
    net?.startRace(lobby.laps);
  };

  const handleLeave = () => {
    startedRef.current = false;
    setRideModal(false);
    onLeaveRoom();
    onBack();
  };

  return (
    <div className="absolute inset-0 overflow-hidden menu-bg flex flex-col select-none">
      {/* header */}
      <header className="shrink-0 flex items-center gap-3 px-6 sm:px-10 pt-5 pb-3">
        <Button variant="outline" size="icon" onClick={handleLeave} className="border-zinc-700" aria-label="Leave room">
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="logo-title text-2xl font-black italic">ROOM</h2>
        <span className="font-mono text-2xl font-black tracking-[0.35em] text-amber-400">{lobby.roomId}</span>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${
          lobby.visibility === "public" ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-400"
        }`}>
          {lobby.visibility === "public" ? <Globe className="size-3" /> : <Lock className="size-3" />}
          {lobby.visibility.toUpperCase()}
        </span>
        <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800">
          <CarFront className="size-3 text-amber-500" /> {roomMap?.name ?? lobby.mapId.toUpperCase()}
        </span>
        <span className={`ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${
          lobby.connected ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
        }`}>
          {lobby.connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {lobby.connected ? "LIVE" : "OFFLINE"}
        </span>
      </header>

      <div className="flex-1 min-h-0 flex gap-5 px-6 sm:px-10 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 min-w-0 flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/70"
        >
          {/* grid header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80">
            <Users className="size-4 text-amber-500" />
            <span className="text-xs font-bold tracking-[0.3em] text-zinc-400">
              {lobby.players.length} DRIVER{lobby.players.length === 1 ? "" : "S"} ON THE GRID
            </span>
            <span className="ml-auto text-[10px] font-mono text-zinc-600">
              {allReady ? "ALL READY" : `${notReadyCount} NOT READY`}
            </span>
          </div>

          {/* driver rows */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {lobby.players.map((p) => {
              const car = carEntry(p.carId);
              const isMe = p.id === myId;
              const isHost = p.id === lobby.hostId;
              return (
                <div key={p.id} className={`lobby-player ${p.ready ? "lobby-player-ready" : ""}`}>
                  <span className="size-3 rounded-full border border-black/50 shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="font-bold text-zinc-100 truncate">{p.name}</span>
                  {isHost && <Crown className="size-3.5 text-amber-500 shrink-0" aria-label="Host" />}
                  {isMe && <span className="text-[9px] font-black text-amber-500 tracking-widest shrink-0">YOU</span>}
                  <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-black tracking-[0.18em] text-zinc-500 border border-zinc-800 rounded px-1.5 py-0.5 shrink-0">
                    <CarFront className="size-3 text-amber-500/80" /> {car?.short ?? "?"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] font-black tracking-[0.18em] px-1.5 py-0.5 rounded shrink-0 ${
                      p.ready ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {p.ready ? (
                      <>
                        <Check className="size-3" /> READY
                      </>
                    ) : (
                      "NOT READY"
                    )}
                  </span>
                  {lobby.isHost && !isMe && (
                    <button
                      onClick={() => handleKick(p.id)}
                      aria-label={`Kick ${p.name}`}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* footer: my ride + ready */}
          <div className="shrink-0 p-3 border-t border-zinc-800/80 flex gap-3">
            <Button variant="outline" onClick={() => setRideModal(true)} className="border-zinc-700 flex-1 h-10">
              <CarFront className="size-4 mr-2 text-amber-500" /> MY RIDE
              <span className="ml-2 text-[9px] font-black tracking-[0.18em] text-zinc-500">
                {carEntry(carId)?.short}
              </span>
            </Button>
            <Button
              onClick={toggleReady}
              className={`menu-btn h-10 flex-1 ${me?.ready ? "menu-btn-accent" : ""}`}
            >
              <Check className="size-4" /> {me?.ready ? "READY" : "READY UP"}
            </Button>
          </div>
        </motion.div>

        {/* right column: host controls / waiting */}
        <div className="w-[340px] shrink-0 flex flex-col gap-5">
          {lobby.isHost ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3 flex-1 flex flex-col"
            >
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-amber-500" />
                <span className="text-xs font-bold tracking-[0.3em] text-zinc-400">HOST CONTROLS</span>
                <span className="ml-auto flex gap-1">
                  {[2, 3, 5].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLobby({ laps: l })}
                      className={`lap-pick ${lobby.laps === l ? "lap-pick-active" : ""}`}
                      aria-label={`${l} laps`}
                    >
                      {l}
                    </button>
                  ))}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {MAPS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => net?.setRoomMap(m.id)}
                    className={`map-mini ${lobby.mapId === m.id ? "map-mini-active" : ""}`}
                    aria-label={`Track ${m.name}`}
                  >
                    <MapSchematic map={m} className="w-10 h-10 text-amber-400/70" />
                    <span className="text-[8px] font-black tracking-[0.12em] mt-1">{m.name.split(" ")[0]}</span>
                  </button>
                ))}
              </div>

              <div className="mt-auto space-y-2">
                <Button
                  onClick={handleStart}
                  disabled={!allReady}
                  className="menu-btn menu-btn-accent w-full py-3.5 text-base disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="size-5" /> START RACE
                </Button>
                <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                  {allReady
                    ? lobby.players.length < 2
                      ? "Solo grid — green light when you fire."
                      : "Full grid ready — drop the flag."
                    : `START unlocks when all ${lobby.players.length} drivers are READY.`}
                </p>
              </div>
            </motion.section>
          ) : (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-dashed border-zinc-700/80 p-6 flex-1 flex flex-col items-center justify-center text-center gap-2"
            >
              <Users className="size-8 text-zinc-600" />
              <p className="text-sm text-zinc-300 font-semibold">Waiting for the host…</p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Tune your ride, hit READY, and keep this tab open.
                <br />
                The race fires the moment the host starts it.
              </p>
            </motion.section>
          )}

          <Button variant="outline" onClick={handleLeave} className="border-zinc-700 py-2.5">
            <LogOut className="size-4 mr-2" /> LEAVE ROOM
          </Button>
        </div>
      </div>

      {/* ── MY RIDE modal ── */}
      {rideModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950/95 shadow-2xl p-5 flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <CarFront className="size-5 text-amber-500" />
              <span className="text-sm font-black tracking-[0.3em] text-zinc-300">MY RIDE</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setRideModal(false)}
                className="ml-auto border-zinc-700 h-8 w-8"
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
            <RideSelect
              compact
              carId={carId}
              onCarId={changeCar}
              color={carColor}
              onColor={changeColor}
              neonId={neonId}
              onNeonId={setNeonId}
            />
            <p className="text-[10px] text-zinc-600 text-center">
              Car and paint broadcast to the room instantly — the grid updates for everyone.
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

"use client";
// ─── Online lobby: create / join rooms, player list, host starts race ────────
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameStore } from "@/stores/gameStore";
import { NetClient } from "@/game/net/NetClient";
import { CAR_COLORS } from "@/game/constants";
import { MAP_LIBRARY, mapDef, resolveMapId } from "@/game/maps/registry";
import { ArrowLeft, Crown, LogOut, MapPin, Play, Users, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function OnlineLobby({
  net,
  ensureNet,
  netRef,
  onBack,
  onRaceStarting,
  onLeaveRoom,
}: {
  net: NetClient | null;
  ensureNet: () => NetClient | null;
  netRef: React.MutableRefObject<NetClient | null>;
  onBack: () => void;
  onRaceStarting: (laps: number, mapId: string) => void;
  onLeaveRoom: () => void;
}) {
  const { playerName, setPlayerName, carColor, setCarColor, carId, mapId, setMapId, lobby, setLobby } = useGameStore();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const inRoom = lobby.roomId !== "";
  const startedRef = useRef(false);

  // wire callbacks whenever the NetClient instance changes
  useEffect(() => {
    if (!net) return;
    net.onPlayers = (players) => {
      setLobby({ players });
    };
    net.onConnected = (connected) => setLobby({ connected });
    net.onRoomMap = (roomMapId) => {
      // the host's pick is authoritative — keep the menu selection in sync too
      const resolved = resolveMapId(roomMapId || null);
      setLobby({ mapId: resolved });
      setMapId(resolved);
    };
    net.onRaceStart = (laps, mapId) => {
      if (startedRef.current) return;
      startedRef.current = true;
      onRaceStarting(laps, mapId);
    };
    net.onError = (msg) => toast({ title: "Online error", description: msg, variant: "destructive" });
    net.onDisconnected = () => {
      if (!startedRef.current) {
        setLobby({ connected: false, roomId: "", players: [] });
        toast({ title: "Disconnected", description: "Lost connection to the race server." });
      }
    };
    setLobby({ connected: net.connected });
    return () => {
      // detach callbacks so a new NetClient can wire fresh ones
      if (netRef.current === net) return; // still active — keep handlers
    };
  }, [net, netRef, setLobby, setMapId, toast, onRaceStarting]);

  // car changed in the garage while sitting in a room → announce it
  useEffect(() => {
    if (inRoom && net?.connected) net.updateCar(carId);
  }, [carId, inRoom, net]);

  const ensureConnected = (): NetClient | null => ensureNet();

  const handleCreate = async () => {
    if (!playerName.trim()) return toast({ title: "Enter a driver name first" });
    setBusy(true);
    try {
      const n = ensureConnected();
      if (!n) throw new Error("Could not start connection");
      await waitForSocket(n);
      const roomId = await n.createRoom(playerName.trim(), carColor, carId, mapId);
      setLobby({ roomId, isHost: true, players: [{ id: n.socket!.id, name: playerName.trim(), color: carColor, carId, ready: true }] });
      toast({ title: "Room created", description: `Share code ${roomId} with your crew.` });
    } catch (e) {
      toast({ title: "Failed to create room", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) return toast({ title: "Enter a driver name first" });
    if (joinCode.trim().length < 4) return toast({ title: "Enter the 4-character room code" });
    setBusy(true);
    try {
      const n = ensureConnected();
      if (!n) throw new Error("Could not start connection");
      await waitForSocket(n);
      await n.joinRoom(joinCode, playerName.trim(), carColor, carId);
      setLobby({ roomId: joinCode.trim().toUpperCase(), isHost: false });
    } catch (e) {
      toast({ title: "Could not join", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleStart = () => {
    (net ?? netRef.current)?.startRace(lobby.laps);
  };

  // host-only: switch the room's circuit
  const handlePickMap = (id: string) => {
    setMapId(id);
    setLobby({ mapId: id });
    (net ?? netRef.current)?.setRoomMap(id);
  };

  const handleLeave = () => {
    startedRef.current = false;
    onLeaveRoom();
  };

  return (
    <div className="absolute inset-0 overflow-y-auto menu-bg">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onBack} className="border-zinc-700" aria-label="Back">
              <ArrowLeft className="size-4" />
            </Button>
            <h2 className="logo-title text-3xl font-black italic">ONLINE</h2>
            {inRoom && (
              <span className={`ml-auto inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${
                lobby.connected ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
              }`}>
                {lobby.connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
                {lobby.connected ? "LIVE" : "OFFLINE"}
              </span>
            )}
          </div>

          {!inRoom ? (
            <>
              <Card className="bg-zinc-950/85 border-zinc-800">
                <CardContent className="p-4 space-y-4">
                  <Input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                    placeholder="DRIVER NAME"
                    className="bg-zinc-900/80 border-amber-900/50 font-semibold tracking-wider"
                    aria-label="Driver name"
                  />
                  <div className="grid grid-cols-8 gap-2">
                    {CAR_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setCarColor(c.value)}
                        aria-label={`Paint ${c.name}`}
                        className={`swatch ${carColor === c.value ? "swatch-active" : ""}`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                  <Button onClick={handleCreate} disabled={busy} className="menu-btn menu-btn-accent w-full py-3">
                    <Play className="size-4 mr-2" /> CREATE ROOM
                  </Button>
                  <div className="flex gap-2">
                    <Input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                      placeholder="CODE"
                      className="bg-zinc-900/80 border-zinc-700 font-mono text-lg tracking-[0.4em] uppercase w-32"
                      aria-label="Room code"
                    />
                    <Button onClick={handleJoin} disabled={busy} className="menu-btn flex-1">
                      JOIN
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                Rooms are hosted on this sandbox race server. Create a room, share the
                4-letter code, and wait for your crew to join.
              </p>
            </>
          ) : (
            <Card className="bg-zinc-950/85 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-sm font-bold tracking-[0.25em] text-zinc-400">ROOM</span>
                  <span className="font-mono text-2xl font-black tracking-[0.35em] text-amber-400">
                    {lobby.roomId}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold tracking-wider">
                  <Users className="size-3.5 text-amber-500" />
                  {lobby.players.length} DRIVER{lobby.players.length === 1 ? "" : "S"} IN LOBBY
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold tracking-wider">
                  <MapPin className="size-3.5 text-sky-400" />
                  TRACK:
                  <span className="text-zinc-100">{mapDef(lobby.mapId)?.name ?? "DOWNTOWN NEON"}</span>
                </div>
                <div className="space-y-1.5">
                  {lobby.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 bg-zinc-900/70 rounded-md px-3 py-2.5">
                      <span className="size-3 rounded-full border border-black/50" style={{ backgroundColor: p.color }} />
                      <span className="flex-1 font-bold text-zinc-100 truncate">{p.name}</span>
                      {p.id === netRef.current?.socket?.id ? (
                        <span className="text-[10px] font-bold text-amber-500 tracking-widest">YOU</span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {lobby.isHost ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Crown className="size-3.5 text-amber-500" />
                      <span className="text-xs text-zinc-400 tracking-wider font-semibold">HOST CONTROLS</span>
                      <span className="ml-auto flex gap-1">
                        {[2, 3, 5].map((l) => (
                          <button
                            key={l}
                            onClick={() => setLobby({ laps: l })}
                            className={`lap-pick ${lobby.laps === l ? "lap-pick-active" : ""}`}
                          >
                            {l}
                          </button>
                        ))}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {MAP_LIBRARY.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handlePickMap(m.id)}
                          className={`lap-pick flex-1 !px-2 !text-[10px] ${lobby.mapId === m.id ? "lap-pick-active" : ""}`}
                          title={m.description}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                    <Button
                      onClick={handleStart}
                      className="menu-btn menu-btn-accent w-full py-3.5 text-base"
                    >
                      <Play className="size-5 mr-2" /> START RACE
                    </Button>
                    <p className="text-[11px] text-zinc-500 text-center">
                      {lobby.players.length < 2
                        ? "You can test alone, or share the code above to race friends."
                        : "Everyone gets a 3-2-1 countdown when you start."}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-3 border border-dashed border-zinc-700 rounded-md">
                    <p className="text-sm text-zinc-300 font-semibold">Waiting for host to start…</p>
                    <p className="text-[11px] text-zinc-500 mt-1">Keep this tab open.</p>
                  </div>
                )}

                <Button variant="outline" onClick={handleLeave} className="w-full border-zinc-700">
                  <LogOut className="size-4 mr-2" /> LEAVE ROOM
                </Button>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function waitForSocket(net: NetClient): Promise<void> {
  return new Promise((resolve, reject) => {
    if (net.socket?.connected) return resolve();
    const t = setTimeout(() => reject(new Error("Race server unreachable")), 8000);
    net.socket?.once("connect", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

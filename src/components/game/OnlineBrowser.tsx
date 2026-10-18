"use client";
// ─── OnlineBrowser: CS 1.6-style server list + private join + create ────────
// PUBLIC rooms stream in live; PRIVATE rooms stay unlisted (join by code).
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/stores/gameStore";
import { NetClient, type NetRoomSummary, type RoomVisibility } from "@/game/net/NetClient";
import { mapEntry } from "@/game/maps/registry";
import { MapSchematic } from "./MapSchematic";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Globe, Lock, Play, Plus, RefreshCw, User, Users, Wifi, WifiOff } from "lucide-react";

export function OnlineBrowser({
  net,
  ensureNet,
  netRef,
  onBack,
  onEnterRoom,
  onNetReset,
}: {
  net: NetClient | null;
  ensureNet: () => NetClient | null;
  netRef: React.MutableRefObject<NetClient | null>;
  onBack: () => void;
  onEnterRoom: (roomId: string, isHost: boolean, visibility: RoomVisibility) => void;
  /** destroy the NetClient (used when reconnection is exhausted — server was down) */
  onNetReset: () => void;
}) {
  const { playerName, setPlayerName, carColor, carId } = useGameStore();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<NetRoomSummary[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createVisibility, setCreateVisibility] = useState<RoomVisibility>("public");
  const [connected, setConnected] = useState(net?.connected ?? false);

  // subscribe to the public room list while this screen is open
  useEffect(() => {
    const n = ensureNet();
    if (!n) return;
    n.onRooms = (list) => setRooms(list);
    n.onConnected = (c) => setConnected(c);
    n.onError = (msg) => toast({ title: "Online error", description: msg, variant: "destructive" });
    const wasConnected = n.connected;
    if (wasConnected) n.subscribeRooms();
    else n.connect();
    const t = setTimeout(() => n.subscribeRooms(), 400); // after connect handshake
    return () => {
      clearTimeout(t);
      if (netRef.current === n) {
        n.onRooms = null;
        // keep onConnected/onError wired — the lobby reuses this client
        n.unsubscribeRooms();
      }
    };
  }, [net, ensureNet, netRef, toast]);

  const ensureConnected = (): NetClient | null => ensureNet();

  /** a failed connect left the socket dead (reconnection exhausted) — rebuild it */
  const recoverNet = (n: NetClient | null, err: unknown) => {
    if (n && String((err as Error)?.message ?? "").includes("unreachable")) {
      onNetReset();
      return true;
    }
    return false;
  };

  const handleJoinPublic = async (code: string) => {
    if (!playerName.trim()) return toast({ title: "Enter a driver name first" });
    setBusy(true);
    try {
      const n = ensureConnected();
      if (!n) throw new Error("Could not start connection");
      await waitForSocket(n);
      await n.joinRoom(code, playerName.trim(), carColor, carId);
      onEnterRoom(code, false, "public");
    } catch (e) {
      recoverNet(netRef.current, e);
      toast({ title: "Could not join", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleJoinPrivate = async () => {
    if (!playerName.trim()) return toast({ title: "Enter a driver name first" });
    if (joinCode.trim().length < 4) return toast({ title: "Enter the 4-character room code" });
    setBusy(true);
    try {
      const n = ensureConnected();
      if (!n) throw new Error("Could not start connection");
      await waitForSocket(n);
      await n.joinRoom(joinCode, playerName.trim(), carColor, carId);
      onEnterRoom(joinCode.trim().toUpperCase(), false, "private");
    } catch (e) {
      recoverNet(netRef.current, e);
      toast({ title: "Could not join", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!playerName.trim()) return toast({ title: "Enter a driver name first" });
    setBusy(true);
    try {
      const n = ensureConnected();
      if (!n) throw new Error("Could not start connection");
      await waitForSocket(n);
      const roomId = await n.createRoom(playerName.trim(), carColor, carId, createVisibility, useGameStore.getState().mapId);
      onEnterRoom(roomId, true, createVisibility);
    } catch (e) {
      recoverNet(netRef.current, e);
      toast({ title: "Failed to create room", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden menu-bg flex flex-col select-none">
      {/* header */}
      <header className="shrink-0 flex items-center gap-3 px-6 sm:px-10 pt-5 pb-3">
        <Button variant="outline" size="icon" onClick={onBack} className="border-zinc-700" aria-label="Back to menu">
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="logo-title text-3xl font-black italic">ONLINE</h2>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${
          connected ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
        }`}>
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {connected ? "SERVER LIVE" : "CONNECTING"}
        </span>
        <div className="ml-auto flex items-center gap-2 w-64">
          <User className="size-4 text-amber-500 shrink-0" />
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
            placeholder="DRIVER NAME"
            className="bg-zinc-950/70 border-amber-900/50 focus-visible:ring-amber-500/40 font-semibold tracking-wider h-9"
            aria-label="Driver name"
          />
        </div>
      </header>

      <div className="flex-1 min-h-0 flex gap-5 px-6 sm:px-10 pb-6">
        {/* ── public games list ── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 min-w-0 flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/70"
        >
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80">
            <Globe className="size-4 text-amber-500" />
            <span className="text-xs font-bold tracking-[0.3em] text-zinc-400">PUBLIC GAMES</span>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-zinc-600">
              <RefreshCw className="size-3 animate-spin-slow" /> LIVE
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {rooms.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-10">
                <Globe className="size-8 text-zinc-700" />
                <p className="text-sm text-zinc-500 font-semibold">No public games right now.</p>
                <p className="text-[11px] text-zinc-600">Create one — it will show up here for everyone.</p>
              </div>
            ) : (
              rooms.map((r) => {
                const map = mapEntry(r.mapId);
                return (
                  <div
                    key={r.code}
                    className="room-row group"
                  >
                    <MapSchematic map={map ?? { id: "?", name: "?", description: "", points: [[0, 0, 0]] }} className="size-14 shrink-0 text-amber-400/70" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black italic tracking-wide truncate">{r.host}&apos;s room</span>
                        <span className="font-mono text-[10px] text-zinc-500 tracking-[0.25em]">{r.code}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold tracking-[0.15em] text-zinc-500">
                        <span className="truncate">{map?.name ?? r.mapId.toUpperCase()}</span>
                        <span className="text-zinc-700">·</span>
                        <span>{r.racing ? "RACING" : "IN LOBBY"}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold ${r.racing ? "text-red-400" : "text-emerald-400"}`}>
                      <Users className="size-3.5" /> {r.players}/{r.max}
                    </span>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => handleJoinPublic(r.code)}
                      className="menu-btn menu-btn-accent shrink-0 h-8"
                    >
                      JOIN
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </motion.section>

        {/* ── right column: create + private join ── */}
        <div className="w-[340px] shrink-0 flex flex-col gap-5">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-amber-500" />
              <span className="text-xs font-bold tracking-[0.3em] text-zinc-400">CREATE ROOM</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCreateVisibility("public")}
                className={`vis-pick ${createVisibility === "public" ? "vis-pick-active" : ""}`}
              >
                <Globe className="size-4 mb-1" />
                <span className="text-[10px] font-black tracking-[0.18em]">PUBLIC</span>
                <span className="text-[9px] text-zinc-500 font-semibold">listed for everyone</span>
              </button>
              <button
                onClick={() => setCreateVisibility("private")}
                className={`vis-pick ${createVisibility === "private" ? "vis-pick-active" : ""}`}
              >
                <Lock className="size-4 mb-1" />
                <span className="text-[10px] font-black tracking-[0.18em]">PRIVATE</span>
                <span className="text-[9px] text-zinc-500 font-semibold">invite code only</span>
              </button>
            </div>
            <Button onClick={handleCreate} disabled={busy} className="menu-btn menu-btn-accent w-full py-3">
              <Play className="size-4" /> CREATE
            </Button>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-amber-500" />
              <span className="text-xs font-bold tracking-[0.3em] text-zinc-400">JOIN BY CODE</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="CODE"
                className="bg-zinc-900/80 border-zinc-700 font-mono text-lg tracking-[0.4em] uppercase w-32 h-10"
                aria-label="Room code"
              />
              <Button onClick={handleJoinPrivate} disabled={busy} className="menu-btn flex-1 h-10">
                JOIN
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Private rooms never appear in the list — only drivers with the 4-letter code can get in.
            </p>
          </motion.section>
        </div>
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

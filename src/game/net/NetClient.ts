// ─── Online multiplayer client (socket.io via gateway) ─────────────────────
import { io, type Socket } from "socket.io-client";
import type { CarSnapshot } from "../world/Car";

export interface NetPlayer {
  id: string;
  name: string;
  color: string;
  /** garage car this driver races (registry id, resolved client-side) */
  carId: string;
  ready: boolean;
}

export interface NetFinishEntry {
  id: string;
  name: string;
  totalTimeMs: number;
  bestLapMs: number;
}

export class NetClient {
  socket: Socket | null = null;
  connected = false;
  roomId = "";
  isHost = false;
  players: NetPlayer[] = [];

  // callbacks wired by the Game / lobby
  onPlayers: ((p: NetPlayer[]) => void) | null = null;
  onConnected: ((connected: boolean) => void) | null = null;
  onRemoteStates: ((states: Record<string, CarSnapshot>) => void) | null = null;
  onRaceStart: ((laps: number, mapId: string) => void) | null = null;
  /** room's circuit changed (host pick) or catch-up on join */
  onRoomMap: ((mapId: string) => void) | null = null;
  onFinishBroadcast: ((entry: NetFinishEntry) => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onError: ((msg: string) => void) | null = null;

  connect() {
    if (this.socket) return;
    this.socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 6,
      reconnectionDelay: 1200,
      timeout: 10000,
    });
    this.socket.on("connect", () => {
      this.connected = true;
      this.onConnected?.(true);
    });
    this.socket.on("disconnect", () => {
      this.connected = false;
      this.onConnected?.(false);
      this.onDisconnected?.();
    });
    this.socket.on("room:players", (players: NetPlayer[]) => {
      this.players = players;
      this.onPlayers?.(players);
    });
    this.socket.on("race:started", ({ laps, mapId }: { laps: number; mapId?: string }) => {
      this.onRaceStart?.(laps, mapId ?? "");
    });
    this.socket.on("room:map", ({ mapId }: { mapId?: string }) => {
      this.onRoomMap?.(mapId ?? "");
    });
    this.socket.on("states", (states: Record<string, CarSnapshot>) => {
      this.onRemoteStates?.(states);
    });
    this.socket.on("race:finished", (entry: NetFinishEntry) => {
      this.onFinishBroadcast?.(entry);
    });
    this.socket.on("room:error", ({ message }: { message: string }) => {
      this.onError?.(message);
    });
  }

  createRoom(name: string, color: string, carId: string, mapId: string) {
    return new Promise<string>((resolve, reject) => {
      this.socket!.emit("room:create", { name, color, carId, mapId }, (res: { ok: boolean; roomId?: string; message?: string }) => {
        if (res.ok && res.roomId) {
          this.roomId = res.roomId;
          this.isHost = true;
          resolve(res.roomId);
        } else reject(new Error(res.message ?? "Failed to create room"));
      });
    });
  }

  joinRoom(roomId: string, name: string, color: string, carId: string) {
    return new Promise<void>((resolve, reject) => {
      this.socket!.emit(
        "room:join",
        { roomId: roomId.trim().toUpperCase(), name, color, carId },
        (res: { ok: boolean; message?: string }) => {
          if (res.ok) {
            this.roomId = roomId.trim().toUpperCase();
            resolve();
          } else reject(new Error(res.message ?? "Room not found"));
        }
      );
    });
  }

  updateColor(color: string) {
    this.socket?.emit("room:update", { color });
  }

  /** announce a car change made while sitting in a room */
  updateCar(carId: string) {
    this.socket?.emit("room:update", { carId });
  }

  /** host only — set the circuit the room will race */
  setRoomMap(mapId: string) {
    this.socket?.emit("room:setMap", { mapId });
  }

  startRace(laps: number) {
    this.socket?.emit("race:start", { laps });
  }

  sendState(snap: CarSnapshot) {
    this.socket?.emit("state", snap);
  }

  sendFinish(totalTimeMs: number, bestLapMs: number) {
    this.socket?.emit("race:finish", { totalTimeMs, bestLapMs });
  }

  leave() {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.roomId = "";
    this.players = [];
  }
}

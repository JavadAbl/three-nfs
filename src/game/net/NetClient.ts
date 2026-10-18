// ─── Online multiplayer client (socket.io via gateway) ─────────────────────
import { io, type Socket } from "socket.io-client";
import type { CarSnapshot } from "../world/Car";

export interface NetPlayer {
  id: string;
  name: string;
  color: string;
  carId: string;
  ready: boolean;
}

export interface NetRoomSummary {
  code: string;
  host: string;
  players: number;
  max: number;
  mapId: string;
  racing: boolean;
  laps: number;
}

export interface NetFinishEntry {
  id: string;
  name: string;
  totalTimeMs: number;
  bestLapMs: number;
}

export type RoomVisibility = "public" | "private";

export class NetClient {
  socket: Socket | null = null;
  connected = false;
  roomId = "";
  isHost = false;
  /** host socket id of the current room (crown in the lobby) */
  hostId = "";
  players: NetPlayer[] = [];
  browsing = false;

  // callbacks wired by the UI / Game
  onPlayers: ((p: NetPlayer[]) => void) | null = null;
  onConnected: ((connected: boolean) => void) | null = null;
  onRemoteStates: ((states: Record<string, CarSnapshot>) => void) | null = null;
  onRaceStart: ((laps: number) => void) | null = null;
  onFinishBroadcast: ((entry: NetFinishEntry) => void) | null = null;
  onDisconnected: (() => void) | null = null;
  onError: ((msg: string) => void) | null = null;
  /** public room browser list */
  onRooms: ((rooms: NetRoomSummary[]) => void) | null = null;
  /** room's map changed (host pick) */
  onRoomMap: ((mapId: string) => void) | null = null;
  /** this driver was kicked by the host */
  onKicked: (() => void) | null = null;

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
    this.socket.on("room:players", (payload: { players: NetPlayer[]; hostId: string }) => {
      this.players = payload.players;
      this.hostId = payload.hostId;
      this.onPlayers?.(payload.players);
    });
    this.socket.on("race:started", ({ laps }: { laps: number }) => {
      this.onRaceStart?.(laps);
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
    this.socket.on("rooms", (rooms: NetRoomSummary[]) => {
      this.onRooms?.(rooms);
    });
    this.socket.on("room:map", ({ mapId }: { mapId: string }) => {
      this.onRoomMap?.(mapId);
    });
    this.socket.on("room:kicked", () => {
      this.roomId = "";
      this.players = [];
      this.onKicked?.();
    });
  }

  // ── room lifecycle ──────────────────────────────────────────────────────

  createRoom(name: string, color: string, carId: string, visibility: RoomVisibility = "private", mapId = "downtown") {
    return new Promise<string>((resolve, reject) => {
      this.socket!.emit(
        "room:create",
        { name, color, carId, visibility, mapId },
        (res: { ok: boolean; roomId?: string; message?: string }) => {
          if (res.ok && res.roomId) {
            this.roomId = res.roomId;
            this.isHost = true;
            this.browsing = false;
            resolve(res.roomId);
          } else reject(new Error(res.message ?? "Failed to create room"));
        },
      );
    });
  }

  joinRoom(roomId: string, name: string, color: string, carId: string) {
    return new Promise<string>((resolve, reject) => {
      this.socket!.emit(
        "room:join",
        { roomId: roomId.trim().toUpperCase(), name, color, carId },
        (res: { ok: boolean; roomId?: string; message?: string }) => {
          if (res.ok) {
            this.roomId = res.roomId ?? roomId.trim().toUpperCase();
            this.isHost = false;
            this.browsing = false;
            resolve(this.roomId);
          } else reject(new Error(res.message ?? "Room not found"));
        },
      );
    });
  }

  updateColor(color: string) {
    this.socket?.emit("room:update", { color });
  }

  updateCar(carId: string) {
    this.socket?.emit("room:update", { carId });
  }

  setReady(ready: boolean) {
    this.socket?.emit("room:update", { ready });
  }

  setRoomMap(mapId: string) {
    this.socket?.emit("room:setmap", { mapId });
  }

  kickPlayer(id: string) {
    this.socket?.emit("room:kick", { id });
  }

  startRace(laps: number) {
    this.socket?.emit("race:start", { laps });
  }

  // ── server browser ──────────────────────────────────────────────────────

  subscribeRooms() {
    this.browsing = true;
    this.socket?.emit("rooms:list");
  }

  unsubscribeRooms() {
    this.browsing = false;
    this.socket?.emit("rooms:unlist");
  }

  // ── race data ───────────────────────────────────────────────────────────

  sendState(snap: CarSnapshot) {
    this.socket?.emit("state", snap);
  }

  sendFinish(totalTimeMs: number, bestLapMs: number) {
    this.socket?.emit("race:finish", { totalTimeMs, bestLapMs });
  }

  leave() {
    this.socket?.emit("room:leave");
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
    this.roomId = "";
    this.isHost = false;
    this.hostId = "";
    this.players = [];
    this.browsing = false;
  }
}

// ─── THREE·NFS online race service ─────────────────────────────────────────
// Rooms + 20Hz state relay + race lifecycle over socket.io.
// Room modes: PRIVATE (join by 4-letter code) and PUBLIC (listed in the
// server browser, CS 1.6 style). Host controls map/laps/kick; every driver
// toggles their own READY flag; race:start requires all drivers ready.
// Port 3003, forwarded by the gateway via /?XTransformPort=3003
import { createServer } from "http";
import { Server, type Socket } from "socket.io";

interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  carId: string;
  ready: boolean;
}

interface Room {
  id: string;
  hostId: string;
  players: Map<string, RoomPlayer>;
  racing: boolean;
  visibility: "public" | "private";
  mapId: string;
  /** laps for the next/current race (host picks, applied at race:start) */
  laps: number;
  lastStateAt: Map<string, number>; // rate limiting
  finishes: { id: string; name: string; totalTimeMs: number; bestLapMs: number }[];
  /** players counted at race start — the finish→lobby transition waits for them */
  finishTarget: number;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses it to route to this port
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e5,
});

const rooms = new Map<string, Room>();
/** room each socket currently occupies (mirrors the per-socket closure) */
const socketRoom = new Map<string, Room>();
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newRoomId(): string {
  let id = "";
  do {
    id = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (rooms.has(id));
  return id;
}

function emitPlayers(room: Room) {
  const players = [...room.players.values()];
  io.to(room.id).emit("room:players", { players, hostId: room.hostId });
}

function roomOrNull(roomId: string): Room | null {
  return rooms.get(String(roomId || "").toUpperCase()) ?? null;
}

// ─── public room browser ─────────────────────────────────────────────────────
const BROWSERS = "browsers";

interface RoomSummary {
  code: string;
  host: string;
  players: number;
  max: number;
  mapId: string;
  racing: boolean;
  laps: number;
}

function roomSummaries(): RoomSummary[] {
  const out: RoomSummary[] = [];
  for (const room of rooms.values()) {
    if (room.visibility !== "public") continue;
    out.push({
      code: room.id,
      host: room.players.get(room.hostId)?.name ?? "—",
      players: room.players.size,
      max: 8,
      mapId: room.mapId,
      racing: room.racing,
      laps: room.laps,
    });
  }
  return out;
}

/** push the public list to everyone sitting in the browser screen */
function broadcastRooms() {
  io.to(BROWSERS).emit("rooms", roomSummaries());
}

io.on("connection", (socket) => {
  let joinedRoom: Room | null = null;

  // ── server browser subscription ──
  socket.on("rooms:list", () => {
    socket.join(BROWSERS);
    socket.emit("rooms", roomSummaries());
  });
  socket.on("rooms:unlist", () => {
    socket.leave(BROWSERS);
  });

  function joinRoom(room: Room, player: RoomPlayer) {
    room.players.set(socket.id, player);
    socket.join(room.id);
    joinedRoom = room;
    socketRoom.set(socket.id, room);
  }

  socket.on("room:create", ({ name, color, carId, visibility, mapId }, cb) => {
    try {
      if (socketRoom.get(socket.id)) return cb?.({ ok: false, message: "Already in a room" });
      const room: Room = {
        id: newRoomId(),
        hostId: socket.id,
        players: new Map(),
        racing: false,
        visibility: visibility === "public" ? "public" : "private",
        mapId: String(mapId || "downtown").slice(0, 24),
        laps: 3,
        lastStateAt: new Map(),
        finishes: [],
        finishTarget: 0,
      };
      rooms.set(room.id, room);
      joinRoom(room, {
        id: socket.id,
        name: String(name).slice(0, 16),
        color: String(color).slice(0, 9),
        carId: String(carId || "gtr").slice(0, 24),
        ready: false,
      });
      cb?.({ ok: true, roomId: room.id });
      emitPlayers(room);
      socket.emit("room:map", { mapId: room.mapId });
      if (room.visibility === "public") broadcastRooms();
      log(`room ${room.id} (${room.visibility}) created by ${name}`);
    } catch (e) {
      cb?.({ ok: false, message: "create failed" });
    }
  });

  socket.on("room:join", ({ roomId, name, color, carId }, cb) => {
    if (socketRoom.get(socket.id)) return cb?.({ ok: false, message: "Already in a room" });
    const room = roomOrNull(roomId);
    if (!room) return cb?.({ ok: false, message: "Room not found" });
    if (room.players.size >= 8) return cb?.({ ok: false, message: "Room is full (8)" });
    joinRoom(room, {
      id: socket.id,
      name: String(name).slice(0, 16),
      color: String(color).slice(0, 9),
      carId: String(carId || "gtr").slice(0, 24),
      ready: false,
    });
    socket.leave(BROWSERS); // in a room now — stop receiving the list
    cb?.({ ok: true, roomId: room.id });
    socket.emit("room:map", { mapId: room.mapId });
    emitPlayers(room);
    if (room.visibility === "public") broadcastRooms();
    log(`${name} joined ${room.id}`);
  });

  // per-player updates: paint, car choice, ready flag
  socket.on("room:update", ({ color, carId, ready }) => {
    if (!joinedRoom) return;
    const p = joinedRoom.players.get(socket.id);
    if (!p) return;
    if (typeof color === "string") p.color = color.slice(0, 9);
    if (typeof carId === "string") p.carId = carId.slice(0, 24);
    if (typeof ready === "boolean") p.ready = ready;
    emitPlayers(joinedRoom);
  });

  // host-only: pick the room's map
  socket.on("room:setmap", ({ mapId }) => {
    if (!joinedRoom) return;
    if (joinedRoom.hostId !== socket.id) return;
    joinedRoom.mapId = String(mapId || "downtown").slice(0, 24);
    io.to(joinedRoom.id).emit("room:map", { mapId: joinedRoom.mapId });
    if (joinedRoom.visibility === "public") broadcastRooms();
    log(`room ${joinedRoom.id}: map -> ${joinedRoom.mapId}`);
  });

  // host-only: remove a driver (they get room:kicked + land back in the browser)
  socket.on("room:kick", ({ id }) => {
    if (!joinedRoom) return;
    if (joinedRoom.hostId !== socket.id) return;
    const target = joinedRoom.players.get(String(id));
    if (!target || target.id === socket.id) return;
    removeFromRoom(joinedRoom, target.id, "kicked");
    io.to(target.id).emit("room:kicked");
    emitPlayers(joinedRoom);
    if (joinedRoom.visibility === "public") broadcastRooms();
    log(`room ${joinedRoom.id}: ${target.name} kicked by host`);
  });

  socket.on("race:start", ({ laps }) => {
    if (!joinedRoom) return;
    if (joinedRoom.hostId !== socket.id) return; // host only
    const notReady = [...joinedRoom.players.values()].filter((p) => !p.ready);
    if (notReady.length > 0) {
      socket.emit("room:error", {
        message: notReady.length === 1 && notReady[0].id === socket.id
          ? "You must be READY first"
          : `Waiting on ${notReady.length} driver${notReady.length === 1 ? "" : "s"} to ready up`,
      });
      return;
    }
    const clamped = [2, 3, 5].includes(Number(laps)) ? Number(laps) : 3;
    joinedRoom.racing = true;
    joinedRoom.laps = clamped;
    joinedRoom.finishes = [];
    joinedRoom.finishTarget = joinedRoom.players.size;
    io.to(joinedRoom.id).emit("race:started", { laps: clamped });
    if (joinedRoom.visibility === "public") broadcastRooms();
    log(`race started in ${joinedRoom.id} (${clamped} laps, ${joinedRoom.players.size} players)`);
  });

  // 20Hz position relay with light rate-limiting
  socket.on("state", (snap) => {
    if (!joinedRoom) return;
    const now = Date.now();
    const last = joinedRoom.lastStateAt.get(socket.id) ?? 0;
    if (now - last < 40) return; // drop packets faster than 25Hz
    joinedRoom.lastStateAt.set(socket.id, now);
    socket.to(joinedRoom.id).emit("states", { [socket.id]: snap });
  });

  socket.on("race:finish", ({ totalTimeMs, bestLapMs }) => {
    if (!joinedRoom) return;
    const p = joinedRoom.players.get(socket.id);
    if (!p) return;
    const entry = {
      id: socket.id,
      name: p.name,
      totalTimeMs: Math.max(0, Math.round(Number(totalTimeMs) || 0)),
      bestLapMs: Math.max(0, Math.round(Number(bestLapMs) || 0)),
    };
    joinedRoom.finishes.push(entry);
    io.to(joinedRoom.id).emit("race:finished", entry);
    if (joinedRoom.finishes.length >= joinedRoom.finishTarget) {
      joinedRoom.racing = false;
      if (joinedRoom.visibility === "public") broadcastRooms();
    }
  });

  function removeFromRoom(room: Room, socketId: string, why: "left" | "kicked" | "disconnected") {
    room.players.delete(socketId);
    room.lastStateAt.delete(socketId);
    const targetSocket = why === "disconnected" ? socket : io.sockets.sockets.get(socketId);
    if (targetSocket) {
      targetSocket.leave(room.id);
      if (why !== "disconnected") targetSocket.leave(BROWSERS);
    }
    socketRoom.delete(socketId);
    if (room.players.size === 0) {
      rooms.delete(room.id);
      log(`room ${room.id} deleted (empty)`);
    } else {
      if (room.hostId === socketId) {
        // promote the earliest remaining socket
        room.hostId = room.players.keys().next().value as string;
        const promoted = room.players.get(room.hostId);
        if (promoted) promoted.ready = true; // a new host is implicitly ready
        log(`room ${room.id}: host promoted (${promoted?.name})`);
      }
      emitPlayers(room);
    }
    if (room.visibility === "public") broadcastRooms();
  }

  socket.on("room:leave", () => {
    if (!joinedRoom) return;
    const room = joinedRoom;
    const me = room.players.get(socket.id);
    removeFromRoom(room, socket.id, "left");
    log(`${me?.name ?? socket.id} left ${room.id}`);
    joinedRoom = null;
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = joinedRoom;
    const me = room.players.get(socket.id);
    removeFromRoom(room, socket.id, "disconnected");
    if (me) log(`${me.name} disconnected from ${room.id}`);
    joinedRoom = null;
  });

  socket.on("error", (err: Error) => console.error(`socket ${socket.id} error:`, err));
});

function log(msg: string) {
  console.log(`[race-service] ${new Date().toISOString()} ${msg}`);
}

const PORT = 3003;
httpServer.listen(PORT, () => {
  log(`race service listening on :${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});

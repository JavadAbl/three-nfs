// ─── THREE·NFS online race service ─────────────────────────────────────────
// Rooms + 20Hz state relay + race lifecycle over socket.io.
// Port 3003, forwarded by the gateway via /?XTransformPort=3003
import { createServer } from "http";
import { Server } from "socket.io";

interface RoomPlayer {
  id: string;
  name: string;
  color: string;
}

interface Room {
  id: string;
  hostId: string;
  players: Map<string, RoomPlayer>;
  racing: boolean;
  lastStateAt: Map<string, number>; // rate limiting
  finishes: { id: string; name: string; totalTimeMs: number; bestLapMs: number }[];
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
  io.to(room.id).emit("room:players", players);
}

function roomOrNull(roomId: string): Room | null {
  return rooms.get(String(roomId || "").toUpperCase()) ?? null;
}

io.on("connection", (socket) => {
  let joinedRoom: Room | null = null;

  socket.on("room:create", ({ name, color }, cb) => {
    try {
      const room: Room = {
        id: newRoomId(),
        hostId: socket.id,
        players: new Map(),
        racing: false,
        lastStateAt: new Map(),
        finishes: [],
      };
      rooms.set(room.id, room);
      room.players.set(socket.id, { id: socket.id, name: String(name).slice(0, 16), color: String(color) });
      socket.join(room.id);
      joinedRoom = room;
      cb?.({ ok: true, roomId: room.id });
      emitPlayers(room);
      log(`room ${room.id} created by ${name}`);
    } catch (e) {
      cb?.({ ok: false, message: "create failed" });
    }
  });

  socket.on("room:join", ({ roomId, name, color }, cb) => {
    const room = roomOrNull(roomId);
    if (!room) return cb?.({ ok: false, message: "Room not found" });
    if (room.players.size >= 8) return cb?.({ ok: false, message: "Room is full (8)" });
    room.players.set(socket.id, { id: socket.id, name: String(name).slice(0, 16), color: String(color) });
    socket.join(room.id);
    joinedRoom = room;
    cb?.({ ok: true });
    emitPlayers(room);
    log(`${name} joined ${room.id}`);
  });

  socket.on("room:update", ({ color }) => {
    if (!joinedRoom) return;
    const p = joinedRoom.players.get(socket.id);
    if (p && typeof color === "string") p.color = color.slice(0, 9);
    emitPlayers(joinedRoom);
  });

  socket.on("race:start", ({ laps }) => {
    if (!joinedRoom) return;
    if (joinedRoom.hostId !== socket.id) return; // host only
    const clamped = [2, 3, 5].includes(Number(laps)) ? Number(laps) : 3;
    joinedRoom.racing = true;
    joinedRoom.finishes = [];
    io.to(joinedRoom.id).emit("race:started", { laps: clamped });
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
    if (joinedRoom.finishes.length >= joinedRoom.players.size) joinedRoom.racing = false;
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    joinedRoom.players.delete(socket.id);
    joinedRoom.lastStateAt.delete(socket.id);
    if (joinedRoom.players.size === 0) {
      rooms.delete(joinedRoom.id);
      log(`room ${joinedRoom.id} deleted (empty)`);
    } else {
      if (joinedRoom.hostId === socket.id) {
        // promote the earliest remaining socket
        joinedRoom.hostId = joinedRoom.players.keys().next().value as string;
        log(`room ${joinedRoom.id}: host promoted`);
      }
      emitPlayers(joinedRoom);
    }
  });

  socket.on("error", (err) => console.error(`socket ${socket.id} error:`, err));
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

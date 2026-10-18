"use client";
// ─── Main menu: mode select, garage, leaderboard ─────────────────────────────
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CAR_COLORS } from "@/game/constants";
import { CAR_LIBRARY } from "@/game/cars/registry";
import { MAP_LIBRARY, approxTrackKm, mapDef } from "@/game/maps/registry";
import { fmtTime } from "@/game/core/Game";
import { useGameStore } from "@/stores/gameStore";
import { Trophy, Wifi, Timer, Gauge, User, CarFront, MapPin } from "lucide-react";

interface LapRecord {
  id: string;
  playerName: string;
  lapTimeMs: number;
  mode: string;
  carColor: string;
  carId: string | null;
  mapId: string | null;
  createdAt: string;
}

export function MainMenu({ onStart, onOpenLobby }: { onStart: (mode: "quick" | "trial") => void; onOpenLobby: () => void }) {
  const { playerName, setPlayerName, carColor, setCarColor, carId, setCarId, mapId, setMapId } = useGameStore();
  const [records, setRecords] = useState<LapRecord[]>([]);
  const [tab, setTab] = useState<"garage" | "board">("garage");
  const selectedMap = mapDef(mapId);

  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]));
  }, []);

  return (
    <div className="absolute inset-0 overflow-y-auto menu-bg">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-10">
        {/* ── logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="logo-title text-5xl sm:text-7xl font-black italic tracking-tight">
            THREE<span className="text-amber-500">·</span>NFS
          </h1>
          <p className="mt-2 text-[11px] sm:text-xs tracking-[0.5em] text-zinc-500 font-semibold">
            NIGHT CITY RACING — BAREBONE EDITION
          </p>
        </motion.div>

        {/* ── driver tag ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md space-y-5"
        >
          <div className="flex items-center gap-2">
            <User className="size-4 text-amber-500 shrink-0" />
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
              placeholder="DRIVER NAME"
              className="bg-zinc-950/70 border-amber-900/50 focus-visible:ring-amber-500/40 font-semibold tracking-wider"
              aria-label="Driver name"
            />
          </div>

          {/* ── tabs ── */}
          <div className="flex gap-2">
            <Button
              variant={tab === "garage" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("garage")}
              className={tab === "garage" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-zinc-700"}
            >
              GARAGE
            </Button>
            <Button
              variant={tab === "board" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("board")}
              className={tab === "board" ? "bg-amber-500 text-black hover:bg-amber-400" : "border-zinc-700"}
            >
              <Trophy className="size-3.5 mr-1" /> RECORDS
            </Button>
          </div>

          <Card className="bg-zinc-950/80 border-zinc-800/80">
            <CardContent className="p-4">
              {tab === "garage" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[0.25em] text-zinc-400">TRACK</span>
                    <span className="text-xs font-bold tracking-wider text-amber-400">
                      {selectedMap?.name ?? "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {MAP_LIBRARY.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMapId(m.id)}
                        aria-label={`Select track ${m.name}`}
                        className={`map-card ${mapId === m.id ? "map-card-active" : ""}`}
                      >
                        <MapThumb points={m.points} />
                        <span className="block text-[11px] font-black italic tracking-wide leading-tight">
                          {m.name}
                        </span>
                        <span className="block text-[9px] text-zinc-500 tracking-wider mt-0.5">
                          {approxTrackKm(m.points)} KM · {m.defaultLaps ?? 3} LAPS
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[0.25em] text-zinc-400">RIDE</span>
                    <span className="text-xs font-bold tracking-wider text-amber-400">
                      {CAR_LIBRARY.find((c) => c.id === carId)?.name ?? "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {CAR_LIBRARY.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCarId(c.id)}
                        aria-label={`Select ${c.name}`}
                        className={`car-card ${carId === c.id ? "car-card-active" : ""}`}
                      >
                        <CarFront className="size-4 mx-auto mb-1.5 text-amber-500/80" />
                        <span className="block text-[11px] font-black italic tracking-wide leading-tight">
                          {c.name}
                        </span>
                        <span className="block text-[9px] text-zinc-500 tracking-wider mt-0.5">
                          {c.spec}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-[0.25em] text-zinc-400">PAINT</span>
                    <span
                      className="text-xs font-bold tracking-wider"
                      style={{ color: carColor }}
                    >
                      {CAR_COLORS.find((c) => c.value === carColor)?.name ?? "CUSTOM"}
                    </span>
                  </div>
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
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Pick a ride, choose your paint and hit the grid. Controls: <b className="text-zinc-300">WASD</b> drive,{" "}
                    <b className="text-zinc-300">SPACE</b> drift,{" "}
                    <b className="text-zinc-300">SHIFT</b> nitro,{" "}
                    <b className="text-zinc-300">C</b> camera,{" "}
                    <b className="text-zinc-300">R</b> reset.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-44">
                  {records.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">
                      No lap records yet — go set one.
                    </p>
                  ) : (
                    <div className="space-y-1.5 pr-2">
                      {records.map((r, i) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-2 text-sm bg-zinc-900/60 rounded-md px-2.5 py-1.5"
                        >
                          <span className="w-6 text-zinc-500 font-mono">{i + 1}.</span>
                          <span
                            className="size-2.5 rounded-full shrink-0 border border-black/40"
                            style={{ backgroundColor: r.carColor }}
                          />
                          <span className="flex-1 truncate font-semibold text-zinc-200">
                            {r.playerName}
                            {r.mapId && mapDef(r.mapId) && (
                              <span className="ml-1.5 text-[9px] font-bold tracking-wider text-zinc-500 align-middle">
                                <MapPin className="inline size-2.5 mr-0.5 -mt-0.5" />
                                {mapDef(r.mapId)!.name}
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-amber-400 tabular-nums">
                            {fmtTime(r.lapTimeMs)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* ── race mode buttons ── */}
          <div className="grid gap-3">
            <MenuButton
              onClick={() => onStart("quick")}
              icon={<Gauge className="size-5" />}
              title="QUICK RACE"
              subtitle={`${selectedMap?.defaultLaps ?? 3} laps · 3 AI rivals · ${(selectedMap?.name ?? "night circuit").toLowerCase()}`}
            />
            <MenuButton
              onClick={() => onStart("trial")}
              icon={<Timer className="size-5" />}
              title="TIME TRIAL"
              subtitle="Solo hot lap · chase the record"
            />
            <MenuButton
              onClick={onOpenLobby}
              icon={<Wifi className="size-5" />}
              title="ONLINE RACE"
              subtitle="Create or join a room · race friends"
              accent
            />
          </div>

          <p className="text-[10px] text-zinc-600 text-center tracking-wider pb-2">
            An original NFS-Carbon-inspired arcade racer · three.js + Next.js
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function MenuButton({
  onClick,
  icon,
  title,
  subtitle,
  accent,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      className={`menu-btn h-auto py-3.5 px-4 justify-start group ${
        accent ? "menu-btn-accent" : ""
      }`}
    >
      <span className="mr-3 p-2 rounded-md bg-black/50 text-amber-500 group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-left">
        <span className="block text-base font-black italic tracking-wide">{title}</span>
        <span className="block text-[11px] font-medium text-zinc-400 tracking-wide">{subtitle}</span>
      </span>
    </Button>
  );
}

/** plan-view circuit thumbnail rendered straight from registry control points */
function MapThumb({ points }: { points: [number, number, number][] }) {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const w = maxX - minX || 1;
  const h = maxZ - minZ || 1;
  const scale = Math.min(84 / w, 44 / h);
  const offX = 50 - (minX + w / 2) * scale;
  const offY = 30 - (minZ + h / 2) * scale;
  const px = (x: number, z: number) => `${(x * scale + offX).toFixed(1)},${(z * scale + offY).toFixed(1)}`;
  // close the loop visually by repeating the first point
  const path = [...points, points[0]].map((p) => px(p[0], p[2])).join(" ");
  return (
    <svg viewBox="0 0 100 60" className="w-full h-14 block mb-1" aria-hidden="true">
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx={points[0][0] * scale + offX} cy={points[0][2] * scale + offY} r="3" fill="currentColor" />
    </svg>
  );
}

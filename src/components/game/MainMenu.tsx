"use client";
// ─── Main menu: mode screen + segmented no-scroll setup wizard ───────────────
// Desktop layout is a fixed 16:9-style frame — never scrolls. Flow:
//   MODE screen (quick / trial / online + records sidebar)
//   → wizard: 1 TRACK → 2 RIDE (name + paint live here) → GO
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fmtTime } from "@/game/core/Game";
import { useGameStore } from "@/stores/gameStore";
import { MAPS } from "@/game/maps/registry";
import { MapSchematic } from "./MapSchematic";
import { RideSelect } from "./RideSelect";
import { ArrowLeft, Gauge, Play, Timer, Trophy, Wifi } from "lucide-react";

interface LapRecord {
  id: string;
  playerName: string;
  lapTimeMs: number;
  mode: string;
  carColor: string;
  createdAt: string;
}

export function MainMenu({
  onStart,
  onOpenBrowser,
}: {
  onStart: (mode: "quick" | "trial") => void;
  onOpenBrowser: () => void;
}) {
  const { playerName, setPlayerName, carColor, setCarColor, neonId, setNeonId, carId, setCarId, mapId, setMapId } = useGameStore();
  const [records, setRecords] = useState<LapRecord[]>([]);
  const [stage, setStage] = useState<"mode" | "setup">("mode");
  const [pendingMode, setPendingMode] = useState<"quick" | "trial">("quick");
  const [step, setStep] = useState<"map" | "car">("map");

  useEffect(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((d) => setRecords(d.records ?? []))
      .catch(() => setRecords([]));
  }, []);

  const enterSetup = (m: "quick" | "trial") => {
    setPendingMode(m);
    setStep("map");
    setStage("setup");
  };

  return (
    <div className="absolute inset-0 overflow-hidden menu-bg flex flex-col select-none">
      {/* ── header ── */}
      <header className="shrink-0 flex items-center gap-4 px-6 sm:px-10 pt-5 pb-3">
        <h1 className="logo-title text-3xl sm:text-4xl font-black italic tracking-tight">
          THREE<span className="text-amber-500">·</span>NFS
        </h1>
        <p className="hidden md:block text-[9px] tracking-[0.45em] text-zinc-600 font-semibold mt-1">
          NIGHT CITY RACING — BAREBONE EDITION
        </p>
        <div className="ml-auto flex items-center gap-2 text-[10px] font-bold tracking-[0.2em]">
          <span className="text-zinc-600">DRIVER</span>
          <span className="hud-chip text-amber-400">{playerName.trim() || "UNNAMED"}</span>
        </div>
      </header>

      {/* ── body ── */}
      <div className="flex-1 min-h-0 flex px-6 sm:px-10 pb-6 gap-6">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "mode" ? (
            <motion.div
              key="mode"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25 }}
              className="flex-1 min-h-0 flex gap-6"
            >
              {/* mode column */}
              <div className="flex-1 max-w-xl flex flex-col justify-center gap-4">
                <ModeCard
                  onClick={() => enterSetup("quick")}
                  icon={<Gauge className="size-6" />}
                  title="QUICK RACE"
                  subtitle="3 laps · 3 AI rivals · any circuit"
                />
                <ModeCard
                  onClick={() => enterSetup("trial")}
                  icon={<Timer className="size-6" />}
                  title="TIME TRIAL"
                  subtitle="Solo hot lap · chase the record"
                />
                <ModeCard
                  onClick={onOpenBrowser}
                  icon={<Wifi className="size-6" />}
                  title="ONLINE RACE"
                  subtitle="Public server list · or a private code room"
                  accent
                />
                <p className="text-[10px] text-zinc-600 tracking-wider leading-relaxed px-1">
                  Controls: <b className="text-zinc-400">WASD</b> drive · <b className="text-zinc-400">SPACE</b> drift ·{" "}
                  <b className="text-zinc-400">SHIFT</b> nitro · <b className="text-zinc-400">C</b> camera ·{" "}
                  <b className="text-zinc-400">R</b> reset · <b className="text-zinc-400">ESC</b> pause
                </p>
              </div>

              {/* records sidebar */}
              <aside className="w-72 shrink-0 hidden lg:flex flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/70">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/80">
                  <Trophy className="size-4 text-amber-500" />
                  <span className="text-xs font-bold tracking-[0.3em] text-zinc-400">RECORDS</span>
                  <span className="ml-auto text-[10px] font-mono text-zinc-600">{records.length}</span>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-3 space-y-1.5">
                    {records.length === 0 ? (
                      <p className="text-xs text-zinc-600 text-center py-8 leading-relaxed">
                        No lap records yet.
                        <br />
                        Go set one.
                      </p>
                    ) : (
                      records.slice(0, 12).map((r, i) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs bg-zinc-900/60 rounded-md px-2.5 py-1.5">
                          <span className="w-5 text-zinc-600 font-mono">{i + 1}.</span>
                          <span className="size-2.5 rounded-full shrink-0 border border-black/40" style={{ backgroundColor: r.carColor }} />
                          <span className="flex-1 truncate font-semibold text-zinc-200">{r.playerName}</span>
                          <span className="font-mono text-amber-400 tabular-nums">{fmtTime(r.lapTimeMs)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </aside>
            </motion.div>
          ) : (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="flex-1 min-h-0 flex flex-col gap-3"
            >
              {/* step crumbs */}
              <div className="shrink-0 flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => (step === "car" ? setStep("map") : setStage("mode"))} className="border-zinc-700 h-8 w-8" aria-label="Back">
                  <ArrowLeft className="size-4" />
                </Button>
                <StepCrumb n={1} label="TRACK" active={step === "map"} done={step === "car"} />
                <span className="text-zinc-700 font-black">›</span>
                <StepCrumb n={2} label="RIDE" active={step === "car"} />
                <span className="text-zinc-700 font-black">›</span>
                <StepCrumb n={3} label="RACE" active={false} />
                <span className="ml-auto text-[10px] font-bold tracking-[0.25em] text-zinc-600">
                  {pendingMode === "quick" ? "QUICK RACE" : "TIME TRIAL"}
                </span>
              </div>

              {step === "map" ? (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <div className="flex-1 min-h-0 grid grid-cols-3 gap-4">
                    {MAPS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMapId(m.id)}
                        aria-label={`Select ${m.name}`}
                        className={`map-card ${mapId === m.id ? "map-card-active" : ""}`}
                      >
                        <MapSchematic map={m} className="w-full flex-1 min-h-0 text-amber-400/70" />
                        <div className="shrink-0 pt-2 text-left">
                          <div className="text-sm font-black italic tracking-wide">{m.name}</div>
                          <div className="text-[9px] text-zinc-500 tracking-[0.18em] font-bold mt-0.5">{m.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <p className="text-[11px] text-zinc-500 leading-relaxed flex-1">
                      {MAPS.find((m) => m.id === mapId)?.name} — {MAPS.find((m) => m.id === mapId)?.description}.
                      {pendingMode === "trial" ? " Time trial runs this circuit solo; your best lap goes on the board." : " 3 laps against 3 AI rivals."}
                    </p>
                    <Button onClick={() => setStep("car")} className="menu-btn menu-btn-accent px-8 py-3 text-base">
                      NEXT: PICK RIDE <Play className="size-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col gap-3">
                  <RideSelect
                    carId={carId}
                    onCarId={setCarId}
                    color={carColor}
                    onColor={setCarColor}
                    neonId={neonId}
                    onNeonId={setNeonId}
                    name={playerName}
                    onName={setPlayerName}
                  />
                  <div className="shrink-0 flex items-center gap-3">
                    <p className="text-[11px] text-zinc-500 leading-relaxed flex-1">
                      Paint and driver tag apply instantly — your name rides the leaderboard.
                    </p>
                    <Button
                      onClick={() => onStart(pendingMode)}
                      className="menu-btn menu-btn-accent px-10 py-3.5 text-lg"
                    >
                      <Play className="size-5" /> GO
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ModeCard({
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
    <Button onClick={onClick} className={`menu-btn h-auto py-4 px-5 justify-start group ${accent ? "menu-btn-accent" : ""}`}>
      <span className="mr-4 p-2.5 rounded-md bg-black/50 text-amber-500 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-left">
        <span className="block text-lg font-black italic tracking-wide">{title}</span>
        <span className="block text-[11px] font-medium text-zinc-400 tracking-wide">{subtitle}</span>
      </span>
    </Button>
  );
}

function StepCrumb({ n, label, active, done }: { n: number; label: string; active: boolean; done?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.22em] px-2.5 py-1 rounded-md border ${
        active
          ? "border-amber-500/70 text-amber-400 bg-amber-500/10"
          : done
            ? "border-zinc-700 text-zinc-400"
            : "border-zinc-800 text-zinc-600"
      }`}
    >
      <span className="font-mono">{n}</span> {label}
    </span>
  );
}

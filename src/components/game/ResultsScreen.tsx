"use client";
// ─── Post-race results screen ────────────────────────────────────────────────
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtTime, type RaceResultEntry } from "@/game/core/Game";
import { useGameStore } from "@/stores/gameStore";
import { RotateCcw, Home, Wifi } from "lucide-react";

export function ResultsScreen({
  onRestart,
  onMenu,
  onLobby,
}: {
  onRestart: () => void;
  onMenu: () => void;
  onLobby: () => void;
}) {
  const results = useGameStore((s) => s.results);
  const mode = useGameStore((s) => s.mode);
  const player = results.find((r) => r.isPlayer);
  const sorted = [...results].sort((a, b) => a.position - b.position);
  const place = player?.position;
  const headline =
    place === 1 ? "VICTORY" : place === 2 ? "SO CLOSE" : place === 3 ? "PODIUM" : place ? "FINISHED" : "RACE OVER";

  return (
    <div className="absolute inset-0 overflow-y-auto menu-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg"
      >
        <h1
          className={`logo-title text-4xl sm:text-5xl font-black italic text-center mb-1 ${
            place === 1 ? "text-amber-400" : "text-white"
          }`}
        >
          {headline}
        </h1>
        {player && (
          <p className="text-center text-zinc-500 text-xs tracking-[0.35em] mb-5">
            P{place} · {fmtTime(player.totalTimeMs)}
          </p>
        )}

        <Card className="bg-zinc-950/85 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold tracking-[0.3em] text-zinc-400">
              FINAL STANDINGS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {sorted.map((r: RaceResultEntry, i) => (
              <div
                key={`${r.name}-${i}`}
                className={`results-row flex items-center gap-3 rounded-md px-3 py-2.5 ${
                  r.isPlayer ? "bg-amber-500/10 border border-amber-500/30" : "bg-zinc-900/70"
                }`}
              >
                <span className="w-7 text-center font-black italic text-lg text-zinc-400">{r.position || i + 1}</span>
                <span
                  className="size-3 rounded-full shrink-0 border border-black/50"
                  style={{ backgroundColor: r.color }}
                />
                <span className="flex-1 truncate font-bold text-zinc-100">
                  {r.name}
                  {r.isPlayer && <span className="text-amber-500"> ◂ YOU</span>}
                </span>
                <span className="text-right font-mono text-sm tabular-nums">
                  <span className={r.totalTimeMs ? "text-zinc-200" : "text-zinc-600"}>
                    {r.totalTimeMs ? fmtTime(r.totalTimeMs) : "DNF"}
                  </span>
                  {r.bestLapMs > 0 && (
                    <span className="block text-[10px] text-amber-500/80">
                      BL {fmtTime(r.bestLapMs)}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {player && player.driftScore > 0 && (
              <div className="pt-2 text-right text-xs text-zinc-400">
                DRIFT SCORE <span className="font-black text-amber-400 italic">{player.driftScore.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            onClick={onRestart}
            className="menu-btn menu-btn-accent py-3"
          >
            <RotateCcw className="size-4 mr-2" /> RESTART
          </Button>
          {mode === "online" ? (
            <Button onClick={onLobby} className="menu-btn py-3">
              <Wifi className="size-4 mr-2" /> BACK TO LOBBY
            </Button>
          ) : (
            <Button onClick={onMenu} className="menu-btn py-3">
              <Home className="size-4 mr-2" /> MAIN MENU
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

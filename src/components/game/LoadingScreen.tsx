"use client";
// ─── LoadingScreen: boot-time asset loading bar ("like other games") ────────
// Full-screen NFS-styled gate shown while AssetPreloader pulls the whole asset
// set (cars / city sets / asphalt / decoders, ~26MB first run). Reuses the
// menu visual language (menu-bg, logo-title, amber accent) so the boot feels
// like part of the game, not a spinner.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AssetFileState, BootProgress } from "@/game/core/AssetPreloader";

const TIPS = [
  "HOLD SPACE MID-CORNER TO KICK THE TAIL OUT — DRIFT CHAINS FEED NITRO",
  "SHIFT ENGAGES NITRO — LATER, BRAKE LATER",
  "C CYCLES CHASE / ACTION / HOOD CAMERAS · RIGHT-DRAG LOOKS AROUND",
  "R SNAPS YOU BACK ONTO THE RACING LINE AFTER A WALL KISS",
  "SLIPSTREAM A RIVAL, SWING OUT ON EXIT, TAKE THE PLACE",
  "ASSETS ARE CACHED — THE NEXT LAUNCH LOADS IN SECONDS",
];

export function LoadingScreen({ progress }: { progress: BootProgress }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 z-50 menu-bg flex flex-col items-center justify-center select-none" role="progressbar" aria-label="Loading game assets" aria-valuenow={progress.pct}>
      {/* logo */}
      <div className="logo-title text-4xl sm:text-5xl font-black italic tracking-tight">
        THREE<span className="text-amber-500">·</span>NFS
      </div>
      <p className="text-[10px] tracking-[0.5em] text-zinc-600 font-semibold mt-1 mb-10">
        LOADING NIGHT CITY
      </p>

      {/* progress bar */}
      <div className="w-full max-w-xl px-6">
        <div className="relative h-2 rounded-full bg-zinc-800/90 border border-zinc-700/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-150 ease-out"
            style={{
              width: `${progress.pct}%`,
              background: "linear-gradient(90deg, #b45309, #f59e0b 55%, #fcd34d)",
            }}
          />
          <div className="loader-sheen" aria-hidden />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4 text-[10px] font-bold tracking-[0.22em]">
          <span className="text-amber-400/90 truncate">{progress.label}</span>
          <span className="font-mono text-zinc-400 shrink-0 tabular-nums">
            {progress.pct}%{" "}
            <span className="text-zinc-600">
              · {progress.mbLoaded}/{progress.mbTotal} MB
            </span>
          </span>
        </div>
      </div>

      {/* per-asset manifest */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 max-w-2xl w-full px-8">
        {progress.files.map((f) => (
          <div key={f.key} className="flex items-center gap-2 text-[9px] font-bold tracking-[0.14em]">
            <FileDot state={f.state} />
            <span className={labelClass(f.state)}>{f.label}</span>
          </div>
        ))}
      </div>

      {/* rotating tip ticker */}
      <div className="absolute bottom-6 inset-x-0 text-center px-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={tip}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-[10px] tracking-[0.2em] text-zinc-600"
          >
            <span className="text-zinc-500">TIP</span> — {TIPS[tip]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FileDot({ state }: { state: AssetFileState["state"] }) {
  if (state === "done") return <span className="text-amber-500 text-[10px] leading-none">✓</span>;
  if (state === "error") return <span className="text-red-500 text-[10px] leading-none">✗</span>;
  if (state === "baking")
    return (
      <span
        className="inline-block size-2 rounded-full border border-amber-400/90 border-t-transparent animate-spin shrink-0"
        aria-hidden
      />
    );
  if (state === "loading")
    return <span className="inline-block size-2 rounded-full bg-amber-500 animate-pulse shrink-0" aria-hidden />;
  return <span className="inline-block size-2 rounded-full bg-zinc-700 shrink-0" aria-hidden />;
}

function labelClass(state: AssetFileState["state"]): string {
  if (state === "done") return "text-zinc-400";
  if (state === "error") return "text-zinc-600 line-through";
  if (state === "loading" || state === "baking") return "text-zinc-300";
  return "text-zinc-600";
}

"use client";
// ─── Pause overlay ───────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, Play, RotateCcw, Wifi } from "lucide-react";

export function PauseOverlay({
  onResume,
  onRestart,
  onQuit,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xs space-y-3"
      >
        <h2 className="logo-title text-4xl font-black italic text-center text-white mb-4">PAUSED</h2>
        <Button onClick={onResume} className="menu-btn menu-btn-accent w-full py-3.5">
          <Play className="size-4 mr-2" /> RESUME
        </Button>
        <Button onClick={onRestart} className="menu-btn w-full py-3.5">
          <RotateCcw className="size-4 mr-2" /> RESTART RACE
        </Button>
        <Button onClick={onQuit} variant="outline" className="w-full py-3.5 border-zinc-700 bg-zinc-950/60">
          <Home className="size-4 mr-2" /> QUIT TO MENU
        </Button>
        <p className="text-[11px] text-zinc-500 text-center pt-1 tracking-wider">
          <Wifi className="inline size-3 mr-1 -mt-0.5" />
          Progress is saved when a race finishes
        </p>
      </motion.div>
    </div>
  );
}

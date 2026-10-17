"use client";
// ─── In-race HUD: speedometer, laps, nitro, drift, minimap ──────────────────
import { useEffect, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";
import { fmtTime, type Game } from "@/game/core/Game";
import { cn } from "@/lib/utils";

const MAX_KMH = 260;
const GAUGE_START = 135; // degrees
const GAUGE_SWEEP = 270;

export function HUD({ gameRef }: { gameRef: React.RefObject<Game | null> }) {
  const hud = useGameStore((s) => s.hud);
  const countdown = useGameStore((s) => s.countdown);
  const lapFlash = useGameStore((s) => s.lapFlash);

  const needleAngle = GAUGE_START + (Math.min(hud.speedKmh, MAX_KMH) / MAX_KMH) * GAUGE_SWEEP;

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-sans">
      {/* ── top-left: lap / position / timer ── */}
      <div className="absolute left-3 top-3 sm:left-5 sm:top-5 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="hud-chip">LAP</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums">
            {hud.lap}
            <span className="text-zinc-500">/{hud.totalLaps}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hud-chip">POS</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-amber-400 tabular-nums">
            {hud.position}
            <span className="text-zinc-500">/{hud.racers}</span>
          </span>
        </div>
        <div className="font-mono text-sm sm:text-base text-zinc-300 tabular-nums">
          {fmtTime(hud.timeMs)}
        </div>
        {hud.bestLapMs > 0 && (
          <div className="font-mono text-[11px] sm:text-xs text-amber-500/90 tabular-nums">
            BEST {fmtTime(hud.bestLapMs)}
          </div>
        )}
      </div>

      {/* ── lap flash ── */}
      {lapFlash && (
        <div
          key={lapFlash.id}
          className="absolute left-1/2 top-14 -translate-x-1/2 lapflash font-mono font-bold text-2xl sm:text-3xl text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]"
        >
          {lapFlash.msg}
        </div>
      )}

      {/* ── wrong way ── */}
      {hud.wrongWay && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 wrongway font-black italic text-3xl sm:text-4xl text-red-500 tracking-widest">
          ⚠ WRONG WAY
        </div>
      )}

      {/* ── drift counter (Carbon signature) ── */}
      {hud.driftChain > 40 && (
        <div className="absolute right-4 sm:right-8 top-1/4 text-right">
          <div className="font-black italic text-3xl sm:text-4xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] tabular-nums">
            +{hud.driftChain.toLocaleString()}
          </div>
          <div className="text-xs font-bold tracking-[0.3em] text-amber-500">DRIFT</div>
        </div>
      )}

      {/* ── nitro bar ── */}
      <div className="absolute bottom-24 sm:bottom-28 right-4 sm:right-6 w-28 sm:w-36">
        <div className="mb-1 text-[10px] font-bold tracking-[0.25em] text-zinc-400">NITRO</div>
        <div className="nitro-bar h-2.5 sm:h-3">
          <div
            className={cn("nitro-fill", hud.nitro < 25 && "animate-pulse")}
            style={{ width: `${hud.nitro}%` }}
          />
        </div>
      </div>

      {/* ── speedometer ── */}
      <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2">
        <svg viewBox="0 0 200 170" className="w-40 h-34 sm:w-52 sm:h-44 drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
          <defs>
            <linearGradient id="gaugeArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {/* dial background */}
          <path d="M 20 120 A 85 85 0 1 1 180 120" fill="none" stroke="#0c0c0f" strokeWidth="26" strokeLinecap="round" />
          <path d="M 20 120 A 85 85 0 1 1 180 120" fill="none" stroke="url(#gaugeArc)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          {/* ticks */}
          {Array.from({ length: 14 }, (_, i) => {
            const kmh = (i / 13) * MAX_KMH;
            const a = ((GAUGE_START + (kmh / MAX_KMH) * GAUGE_SWEEP - 90) * Math.PI) / 180;
            const r1 = i % 2 === 0 ? 66 : 72;
            const cx = 100,
              cy = 105;
            return (
              <line
                key={i}
                x1={cx + Math.cos(a) * r1}
                y1={cy + Math.sin(a) * r1}
                x2={cx + Math.cos(a) * 80}
                y2={cy + Math.sin(a) * 80}
                stroke={kmh > 210 ? "#ef4444" : "#8a8a93"}
                strokeWidth={i % 2 === 0 ? 2.4 : 1.2}
              />
            );
          })}
          {/* needle */}
          <g transform={`rotate(${needleAngle} 100 105)`}>
            <line x1="100" y1="105" x2="100" y2="34" stroke="#f5b93a" strokeWidth="3.4" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="105" r="7" fill="#1a1a1f" stroke="#f5b93a" strokeWidth="2" />
          {/* digital readout */}
          <text x="100" y="140" textAnchor="middle" className="font-mono" fill="#ffffff" fontSize="26" fontWeight="700">
            {hud.speedKmh}
          </text>
          <text x="100" y="154" textAnchor="middle" fill="#8a8a93" fontSize="9" letterSpacing="3">
            KM/H
          </text>
          <text
            x="100"
            y="88"
            textAnchor="middle"
            fill={hud.gear === "R" ? "#ef4444" : "#f5b93a"}
            fontSize="16"
            fontWeight="800"
          >
            {hud.gear}
          </text>
        </svg>
      </div>

      {/* ── minimap ── */}
      <Minimap gameRef={gameRef} />

      {/* ── countdown overlay ── */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            key={countdown}
            className={cn(
              "countdown-pop font-black italic text-[22vw] sm:text-[12rem] leading-none drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]",
              countdown === 0 ? "text-amber-400" : "text-white"
            )}
          >
            {countdown === 0 ? "GO!" : countdown}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Minimap: canvas drawn straight from the game (no React re-render) ──────
function Minimap({ gameRef }: { gameRef: React.RefObject<Game | null> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const outlineRef = useRef<{ x: number; z: number }[] | null>(null);
  const boundsRef = useRef<{ minX: number; minZ: number; scale: number } | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const game = gameRef.current;
      if (!canvas || !game) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;

      if (!outlineRef.current) {
        const data = game.getMinimapData();
        outlineRef.current = data.outline;
        const xs = data.outline.map((p) => p.x);
        const zs = data.outline.map((p) => p.z);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minZ = Math.min(...zs);
        const maxZ = Math.max(...zs);
        const pad = 14;
        const scale = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
        boundsRef.current = { minX, minZ, scale };
      }
      const { minX, minZ, scale } = boundsRef.current!;
      const tx = (x: number) => (x - minX) * scale + (W - (Math.max(...outlineRef.current!.map((p) => p.x)) - minX) * scale) / 2;
      const tz = (z: number) => (z - minZ) * scale + (H - (Math.max(...outlineRef.current!.map((p) => p.z)) - minZ) * scale) / 2;

      ctx.clearRect(0, 0, W, H);
      // track ribbon
      ctx.beginPath();
      const outline = outlineRef.current!;
      ctx.moveTo(tx(outline[0].x), tz(outline[0].z));
      for (const p of outline) ctx.lineTo(tx(p.x), tz(p.z));
      ctx.closePath();
      ctx.strokeStyle = "rgba(160,160,170,0.85)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(20,20,26,0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // cars
      const data = game.getMinimapData();
      for (const c of data.cars) {
        ctx.beginPath();
        ctx.arc(tx(c.x), tz(c.z), c.isPlayer ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.fill();
        if (c.isPlayer) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);

  return (
    <canvas
      ref={canvasRef}
      width={150}
      height={150}
      className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 w-[110px] h-[110px] sm:w-[150px] sm:h-[150px] rounded-xl bg-black/45 backdrop-blur-sm border border-white/10"
      aria-label="Track minimap"
    />
  );
}

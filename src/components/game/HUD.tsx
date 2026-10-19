"use client";
// ─── In-race HUD: speedometer, laps, nitro, drift, minimap ──────────────────
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { fmtTime, type Game } from "@/game/core/Game";
import { MODE_LABEL, DEFAULT_TUNING, type CameraTuning } from "@/game/core/CameraRig";
import { cn } from "@/lib/utils";

const MAX_KMH = 260;
const GAUGE_START = 135; // degrees
const GAUGE_SWEEP = 270;
const TUNING_KEY = "nfs-carbon-cam";

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

      {/* ── camera: current mode chip + ⚙ settings (top-right) ── */}
      <CameraControls gameRef={gameRef} mode={hud.cameraMode} />

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

// ─── NFS-Carbon camera controls: mode chip + live tuning panel ─────────────
function CameraControls({
  gameRef,
  mode,
}: {
  gameRef: React.RefObject<Game | null>;
  mode: keyof typeof MODE_LABEL;
}) {
  const [open, setOpen] = useState(false);
  const [tuning, setTuning] = useState<CameraTuning>(DEFAULT_TUNING);
  const [toast, setToast] = useState<{ id: number; label: string } | null>(null);
  const lastMode = useRef(mode);

  // mode-change toast (C key cycles) — flash the new view for a beat
  useEffect(() => {
    if (mode !== lastMode.current) {
      lastMode.current = mode;
      setToast({ id: Date.now(), label: MODE_LABEL[mode] });
    }
  }, [mode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1200);
    return () => clearTimeout(t);
  }, [toast]);

  // F7 toggles the panel (prevent browser caret-browsing default)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "F7") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // restore saved tuning once the game exists, then keep rig in sync
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    try {
      const raw = localStorage.getItem(TUNING_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as CameraTuning;
        const merged = { ...DEFAULT_TUNING, ...saved };
        setTuning(merged);
        g.cameraRig.applyTuning(merged);
      }
    } catch {
      /* bad localStorage — ignore */
    }
  }, [gameRef]);

  const change = (patch: Partial<CameraTuning>) => {
    setTuning((prev) => {
      const next = { ...prev, ...patch };
      gameRef.current?.cameraRig.applyTuning(next);
      try {
        localStorage.setItem(TUNING_KEY, JSON.stringify(next));
      } catch {
        /* storage full/blocked — non-fatal */
      }
      return next;
    });
  };

  return (
    <>
      {/* mode flash on C cycle */}
      {toast && (
        <div
          key={toast.id}
          className="absolute right-3 top-3 sm:right-5 sm:top-5 lapflash hud-chip !text-amber-400 font-bold tracking-[0.25em]"
        >
          {toast.label}
        </div>
      )}

      {/* always-visible: mode + gear */}
      <div className="absolute right-3 top-10 sm:right-5 sm:top-12 pointer-events-auto flex flex-col items-end gap-1">
        <div className="hud-chip text-[10px] font-bold tracking-[0.2em] text-zinc-400">
          CAM · {MODE_LABEL[mode]}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="hud-chip text-[10px] font-bold tracking-[0.2em] text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer"
          aria-label="Camera settings (F7)"
        >
          ⚙ TUNE
        </button>
      </div>

      {/* tuning panel (Carbon-blue) */}
      {open && (
        <div className="absolute right-3 top-24 sm:right-5 sm:top-28 w-64 sm:w-72 rounded-xl bg-black/70 backdrop-blur-md border border-amber-500/20 p-4 space-y-3 pointer-events-auto select-none">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold tracking-[0.25em] text-amber-400">CAMERA TUNE</div>
            <div className="text-[10px] text-zinc-500 font-mono">F7</div>
          </div>

          {(
            [
              { key: "distMul", label: "DISTANCE", min: 0.6, max: 1.6, step: 0.05, fmt: (v: number) => `×${v.toFixed(2)}` },
              { label: "HEIGHT", key: "heightAdd", min: -2, max: 2, step: 0.1, fmt: (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}m` },
              { key: "fovAdd", label: "FOV", min: -12, max: 12, step: 1, fmt: (v: number) => `${v > 0 ? "+" : ""}${v}°` },
              { key: "sens", label: "LOOK SENS.", min: 0.4, max: 2, step: 0.1, fmt: (v: number) => `×${v.toFixed(1)}` },
              { key: "drama", label: "SPEED DRAMA", min: 0, max: 1, step: 0.05, fmt: (v: number) => `${Math.round(v * 100)}%` },
            ] as const
          ).map((s) => (
            <label key={s.key} className="block">
              <div className="flex justify-between text-[10px] font-mono text-zinc-400 mb-1">
                <span>{s.label}</span>
                <span className="text-amber-300">{s.fmt(tuning[s.key])}</span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={tuning[s.key]}
                onChange={(e) => change({ [s.key]: Number(e.target.value) } as Partial<CameraTuning>)}
                onKeyDown={(e) => e.stopPropagation()} // don't drive the car while tuning
                className="w-full accent-amber-500 cursor-pointer"
                aria-label={s.label}
              />
            </label>
          ))}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => change(DEFAULT_TUNING)}
              className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              RESET
            </button>
            <button
              onClick={() => setOpen(false)}
              className="hud-chip !text-[10px] font-bold tracking-[0.2em] text-amber-400 hover:text-white transition-colors cursor-pointer"
            >
              DONE
            </button>
          </div>
          <div className="text-[9px] text-zinc-500 font-mono leading-relaxed border-t border-white/5 pt-2">
            C cycle views · hold RIGHT MOUSE to look · auto-centers on release
          </div>
        </div>
      )}
    </>
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

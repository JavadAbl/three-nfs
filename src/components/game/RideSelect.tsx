"use client";
// ─── RideSelect: shared garage panel — turntable + NFS 3 specs + chips + paint
// Used by the menu wizard (car step) and the online lobby car modal.
import { motion } from "framer-motion";
import { CarPreview } from "./CarPreview";
import { CARS, carStats, carEntry } from "@/game/cars/registry";
import { CAR_COLORS, NEON_COLORS, type NeonId } from "@/game/constants";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, User } from "lucide-react";

interface RideSelectProps {
  carId: string;
  onCarId: (id: string) => void;
  color: string;
  onColor: (c: string) => void;
  /** neon underglow pick (night maps); omit to hide the neon row */
  neonId?: NeonId;
  onNeonId?: (id: NeonId) => void;
  /** show the driver-name input (wizard step) — hidden in the lobby modal */
  name?: string;
  onName?: (n: string) => void;
  compact?: boolean;
}

export function RideSelect({ carId, onCarId, color, onColor, neonId, onNeonId, name, onName, compact }: RideSelectProps) {
  const stats = carStats(carId);
  const entry = carEntry(carId);
  const idx = CARS.findIndex((c) => c.id === carId);
  const cycle = (dir: 1 | -1) => onCarId(CARS[(idx + dir + CARS.length) % CARS.length].id);

  return (
    <div className={`flex gap-4 ${compact ? "min-h-0" : "flex-1 min-h-0"} w-full`}>
      {/* ── turntable ── */}
      <div className="relative flex-1 min-w-0 rounded-xl border border-zinc-800/80 bg-gradient-to-b from-zinc-950/40 to-black/50 overflow-hidden">
        <CarPreview carId={carId} color={color} neonId={neonId} className="absolute inset-0" />

        {/* name / spec plate */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <div className="logo-title text-xl font-black italic leading-none">{entry?.name}</div>
          <div className="mt-1 text-[10px] font-bold tracking-[0.25em] text-amber-500/90">
            {entry?.spec}
          </div>
        </div>

        {/* chevrons */}
        <button
          onClick={() => cycle(-1)}
          aria-label="Previous car"
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/55 border border-white/10 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          onClick={() => cycle(1)}
          aria-label="Next car"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-md bg-black/55 border border-white/10 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
        >
          <ChevronRight className="size-5" />
        </button>

        <div className="absolute bottom-2 inset-x-0 text-center text-[9px] font-bold tracking-[0.35em] text-zinc-600 pointer-events-none">
          DRAG TO ROTATE
        </div>
      </div>

      {/* ── specs column ── */}
      <div className={`shrink-0 flex flex-col gap-3 ${compact ? "w-[300px]" : "w-[330px]"} justify-center`}>
        <div className="space-y-2.5">
          <StatBar label="TOP SPEED" value={stats.topSpeed} />
          <StatBar label="ACCELERATION" value={stats.accel} />
          <StatBar label="HANDLING" value={stats.handling} />
        </div>

        {/* car chips */}
        <div className="grid grid-cols-5 gap-1.5">
          {CARS.map((c) => (
            <button
              key={c.id}
              onClick={() => onCarId(c.id)}
              aria-label={`Select ${c.name}`}
              className={`car-chip ${carId === c.id ? "car-chip-active" : ""}`}
            >
              {c.short}
            </button>
          ))}
        </div>

        {/* paint */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">PAINT</span>
            <span className="text-[10px] font-bold tracking-wider" style={{ color }}>
              {CAR_COLORS.find((c) => c.value === color)?.name ?? "CUSTOM"}
            </span>
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {CAR_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => onColor(c.value)}
                aria-label={`Paint ${c.name}`}
                className={`swatch ${color === c.value ? "swatch-active" : ""}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>

        {/* neon underglow (night maps) — AUTO follows the paint above */}
        {onNeonId && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold tracking-[0.3em] text-zinc-500">NEON</span>
              <span
                className="text-[10px] font-bold tracking-wider"
                style={{ color: NEON_COLORS.find((n) => n.id === neonId)?.value || color }}
              >
                {NEON_COLORS.find((n) => n.id === neonId)?.name ?? "AUTO (paint)"}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {NEON_COLORS.map((n) =>
                n.value ? (
                  <button
                    key={n.id}
                    onClick={() => onNeonId(n.id)}
                    aria-label={`Neon ${n.name}`}
                    className={`swatch ${neonId === n.id ? "swatch-active" : ""}`}
                    style={{
                      backgroundColor: n.value,
                      boxShadow: neonId === n.id ? `0 0 10px ${n.value}` : undefined,
                    }}
                  />
                ) : (
                  <button
                    key={n.id}
                    onClick={() => onNeonId("auto")}
                    aria-label="Neon auto, paint matched"
                    className={`swatch text-[8px] font-black tracking-tight text-zinc-400 ${!neonId || neonId === "auto" ? "swatch-active" : ""}`}
                    style={{ backgroundColor: "#1c1c22" }}
                  >
                    AUTO
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {onName && (
          <div className="flex items-center gap-2">
            <User className="size-4 text-amber-500 shrink-0" />
            <Input
              value={name ?? ""}
              onChange={(e) => onName(e.target.value.slice(0, 16))}
              placeholder="DRIVER NAME"
              className="bg-zinc-950/70 border-amber-900/50 focus-visible:ring-amber-500/40 font-semibold tracking-wider h-9"
              aria-label="Driver name"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] font-bold tracking-[0.28em] text-zinc-500">{label}</span>
        <span className="font-mono text-xs font-bold text-amber-400 tabular-nums">{value}</span>
      </div>
      <div className="stat-bar">
        <motion.div
          key={`${label}-${value}`}
          className="stat-fill"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

"use client";
// ─── Touch controls for mobile racing ───────────────────────────────────────
import { ChevronLeft, ChevronRight, Gauge, Triangle, Zap } from "lucide-react";
import type { Game } from "@/game/core/Game";
import { cn } from "@/lib/utils";

export function TouchControls({ gameRef }: { gameRef: React.RefObject<Game | null> }) {
  const bind = (btn: "left" | "right" | "gas" | "brake" | "nitro" | "hb") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      gameRef.current?.input.setTouch(btn, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      gameRef.current?.input.setTouch(btn, false);
    },
    onPointerCancel: () => gameRef.current?.input.setTouch(btn, false),
    onPointerLeave: () => gameRef.current?.input.setTouch(btn, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="touch-only absolute inset-0 pointer-events-none">
      {/* steering */}
      <div className="absolute bottom-4 left-3 flex gap-3 pointer-events-auto">
        <button {...bind("left")} className="touch-btn" aria-label="Steer left">
          <ChevronLeft className="size-8" />
        </button>
        <button {...bind("right")} className="touch-btn" aria-label="Steer right">
          <ChevronRight className="size-8" />
        </button>
      </div>

      {/* pedals + nitro + drift */}
      <div className="absolute bottom-4 right-3 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex gap-2">
          <button {...bind("nitro")} className="touch-btn touch-btn-nitro" aria-label="Nitro">
            <Zap className="size-5" />
          </button>
          <button {...bind("hb")} className="touch-btn touch-btn-drift" aria-label="Handbrake drift">
            DRIFT
          </button>
        </div>
        <div className="flex gap-3">
          <button {...bind("brake")} className="touch-btn touch-btn-brake" aria-label="Brake">
            <Triangle className="size-6 rotate-180" />
          </button>
          <button {...bind("gas")} className="touch-btn touch-btn-gas" aria-label="Accelerate">
            <Gauge className="size-8" />
          </button>
        </div>
      </div>
    </div>
  );
}

// helper used by the cn import lint rule (keeps imports tidy)
export const _keep = cn;

"use client";
// ─── MapSchematic: tiny SVG plan-view of a circuit's control points ─────────
import type { MapEntry } from "@/game/maps/registry";

/** closed-loop polyline projected to a 100×100 viewBox */
export function MapSchematic({ map, className }: { map: MapEntry; className?: string }) {
  const pts = map.points;
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const span = Math.max(maxX - minX, maxZ - minZ) || 1;
  const pad = 10;
  const scale = (100 - pad * 2) / span;
  const ox = (100 - (maxX - minX) * scale) / 2;
  const oz = (100 - (maxZ - minZ) * scale) / 2;
  const P = (p: [number, number, number]) => [
    ox + (p[0] - minX) * scale,
    100 - (oz + (p[2] - minZ) * scale), // screen y down = -z
  ];
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${P(p).map((v) => v.toFixed(1)).join(" ")}`).join(" ") + " Z";
  const [sx, sy] = P(pts[0]);
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      <circle cx={sx} cy={sy} r="3.6" fill="#f59e0b" />
    </svg>
  );
}

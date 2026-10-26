// ─── NeonGlow: shared neon-underglow factory (race cars + showroom preview) ──
// One source for the glow plane so the garage turntable shows exactly what
// ships at night: same radial falloff texture, same additive blend, same
// z-fight guards. neonColorFor resolves the player's neon pick — "auto"
// keeps the classic paint-matched glow (dark paints clamp to ice-cyan).
import * as THREE from "three";
import { NEON_COLORS } from "../constants";

/** rest opacity of the glow plane (pulse oscillates around ~0.83) */
export const NEON_BASE_OPACITY = 0.85;

/** paint-matched glow (the classic look): true blacks/charcoal/navy shift
 *  toward ice-cyan — a black car with a black glow is invisible */
function paintGlow(paint: string): THREE.Color {
  const c = new THREE.Color(paint);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum < 0.16) c.lerp(new THREE.Color(0x2bd9ff), 0.8);
  return c;
}

/** resolve a neon pick against the paint color; unknown/missing ids and
 *  "auto" fall back to the paint-matched glow */
export function neonColorFor(neonId: string | undefined, paint: string): THREE.Color {
  const pick = NEON_COLORS.find((n) => n.id === neonId);
  return pick && pick.value ? new THREE.Color(pick.value) : paintGlow(paint);
}

/** soft radial falloff sprite (white core → transparent edge) — also reused
 *  by the procedural car's tail-bloom quads */
export function radialGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.38)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export interface Underglow {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  /** caller-owned disposal (each glow bakes its own texture) */
  texture: THREE.CanvasTexture;
  dispose(): void;
}

/** build the underglow plane — polygonOffset + 9cm clearance keeps it from
 *  z-fighting the road when the body pitches over crests */
export function makeUnderglow(color: THREE.Color, width: number, length: number): Underglow {
  const texture = radialGlowTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity: NEON_BASE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.09;
  mesh.renderOrder = 2;
  return {
    mesh,
    mat,
    texture,
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
      texture.dispose();
    },
  };
}

/** breathing opacity — a static plane reads as a glow decal, a slow shimmer
 *  reads as a real tube. ~1.1 Hz, ±0.09, phase spreads the fleet so cars
 *  never pulse in lockstep (mechanical) */
export function neonPulseOpacity(t: number, phase = 0): number {
  return NEON_BASE_OPACITY - 0.05 + 0.11 * Math.sin(t * 6.9 + phase);
}

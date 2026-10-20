// ─── Procedural night environment for the PMREM IBL ─────────────────────────
// The old RoomEnvironment is a bright neutral studio — wrong mood for a night
// racer and useless for the wet-street look. This paints a night sky instead:
// deep blue gradient, a warm sodium-lamp haze band around the horizon (city
// glow), a pale moon smear, and a few cyan neon accents. PMREM blurs it into
// an irradiance/reflection probe, so the glossy road and the car paint pick
// up believable night reflections instead of studio grey.

import * as THREE from "three";

/** A painted night sky scene for PMREMGenerator.fromScene(). */
export function makeNightEnvironment(): THREE.Scene {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // vertical gradient: zenith deep night blue -> horizon warm city haze
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#05070f"); // zenith
  sky.addColorStop(0.4, "#0a1020"); // upper sky
  sky.addColorStop(0.49, "#221c33"); // haze band rising
  sky.addColorStop(0.53, "#33283d"); // horizon: sodium-orange city glow
  sky.addColorStop(0.56, "#0a0a10"); // just below horizon
  sky.addColorStop(1, "#050507"); // nadir (no light from below)
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // soft radial blob helper
  const blob = (x: number, y: number, r: number, rgb: string, a: number): void => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // moon smear (upper sky, off-centre)
  blob(W * 0.68, H * 0.16, 46, "200,215,245", 0.55);
  blob(W * 0.68, H * 0.16, 110, "160,180,230", 0.12);

  // sodium street-lamp glow around the horizon — this is what the wet road
  // reflects: a ring of warm light sources like driving through a lit city
  let seed = 7;
  const rand = (): number => {
    // deterministic LCG so every session gets the same night sky
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 22; i++) {
    const x = (i / 22) * W + rand() * 40;
    const y = H * (0.46 + rand() * 0.08);
    blob(x, y, 28 + rand() * 55, "255,150,60", 0.1 + rand() * 0.16);
  }
  // a few cyan neon accents (shopfronts / signs) for variety in reflections
  for (let i = 0; i < 6; i++) {
    blob(rand() * W, H * (0.48 + rand() * 0.05), 24 + rand() * 30, "90,210,255", 0.12 + rand() * 0.1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }),
  );
  scene.add(dome);
  return scene;
}

// ─── Procedural night environment for the PMREM IBL ─────────────────────────
// The old RoomEnvironment is a bright neutral studio — wrong mood for a night
// racer and useless for the wet-street look. This paints a night sky instead:
// deep blue gradient, a warm sodium-lamp haze band around the horizon (city
// glow), a pale moon smear, and a few cyan neon accents. PMREM blurs it into
// an irradiance/reflection probe, so the glossy road and the car paint pick
// up believable night reflections instead of studio grey.
//
// makeDayEnvironment() is the daytime sibling (SPA '92): bright blue gradient,
// a warm sun blob along the SAME azimuth the scene's directional light shines
// from, and a pale horizon haze — car paint and glassy road reflections read
// sunlit instead of sodium-lit.

import * as THREE from "three";

/** A painted night sky scene for PMREMGenerator.fromScene(). */
export function makeNightEnvironment(): THREE.Scene {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // vertical gradient: zenith deep night blue -> horizon warm city haze.
  // Base luminance is deliberately lifted vs a pitch sky: this env replaces
  // the old bright RoomEnvironment as the scene's IBL diffuse fill too, so a
  // too-dark dome starves every material of ambient and the start-grid road
  // reads blank-black until the headlights take over.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0a0f1e"); // zenith
  sky.addColorStop(0.4, "#131c34"); // upper sky
  sky.addColorStop(0.49, "#2b2440"); // haze band rising
  sky.addColorStop(0.53, "#3d2f47"); // horizon: sodium-orange city glow
  sky.addColorStop(0.56, "#101018"); // just below horizon
  sky.addColorStop(1, "#08080c"); // nadir (no light from below)
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

/** A painted daytime sky for PMREMGenerator.fromScene(). Sun azimuth kept in
 *  lockstep with DaySky.SUN_DIR / the scene's directional light so specular
 *  highlights on the road line up with the visible sun disc. */
export function makeDayEnvironment(): THREE.Scene {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // vertical gradient: azure zenith -> pale hazy horizon (Belgian morning).
  // Brighter overall than reality's — this dome is ALSO the scene's diffuse
  // IBL fill at day (environmentIntensity is pushed to 1.0), so it must carry
  // enough energy to light matte surfaces, not just paint reflections.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2f6ac2"); // zenith — saturated azure
  sky.addColorStop(0.35, "#6ba3dd"); // upper sky
  sky.addColorStop(0.48, "#a8c8e8"); // haze rising
  sky.addColorStop(0.53, "#d5e4ee"); // horizon — pale warm haze
  sky.addColorStop(0.56, "#8ea6b4"); // just below horizon (ground bounce)
  sky.addColorStop(1, "#5c6a72"); // nadir — dark soil/forest bounce
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const blob = (x: number, y: number, r: number, rgb: string, a: number): void => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // the sun: hot white-yellow core + wide warm glow. SUN_DIR (500,160,325)
  // → elevation 15°, azimuth ~57°; equirect y = 0.5 − elev/180 → ~0.42 H,
  // x ≈ 0.66 W — kept in lockstep with the visible disc + light rays.
  blob(W * 0.66, H * 0.42, 40, "255,248,225", 0.95);
  blob(W * 0.66, H * 0.42, 120, "255,235,190", 0.28);
  blob(W * 0.66, H * 0.42, 260, "255,225,170", 0.1);

  // a few soft cloud smears low on the dome for reflection variety
  let seed = 11;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 10; i++) {
    blob(rand() * W, H * (0.2 + rand() * 0.22), 60 + rand() * 90, "255,255,255", 0.05 + rand() * 0.07);
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

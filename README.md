# THREE·NFS — Night City Racing

An **NFS-Carbon-inspired** arcade street racer built from scratch with **three.js** and **Next.js**.
Barebone edition: procedural cars, night city circuit, drift scoring, offline AI rivals, and online multiplayer rooms.

> Original codebase — gameplay inspired by the *feel* of Need for Speed: Carbon (night city, drift, nitro). No EA assets are used. Drop in your own car models later via `public/models/`.

![status](https://img.shields.io/badge/status-barebone-amber) ![three](https://img.shields.io/badge/three.js-0.186-black) ![next](https://img.shields.io/badge/Next.js-16-black)

## Features

### Racing
- **Arcade drift physics** — forward/lateral velocity model with grip vs. handbrake drift, nitrous boost (refilled by drifting, very Carbon), off-road drag and guardrail bounces
- **Night city circuit** — spline-based closed track with elevation, checkpoints, start/finish gate, streetlights and neon billboards; instanced buildings with lit windows
- **3 AI rivals** — racing-line followers with curvature-aware corner speeds, rubber-banding, stuck recovery
- **Race systems** — countdown, lap validation, live positions, lap/best-lap timers, wrong-way warning, drift score
- **HUD** — analog speedometer with needle + digital readout, gear, nitro bar, lap/pos, minimap, drift counter
- **Sound** — synthesized engine, tyre screech, wind, countdown beeps (WebAudio, zero audio files)
- **Chase camera** — three modes (`C`), speed-reactive FOV, drift framing

### Modes
| Mode | Description |
|---|---|
| **Quick Race** | 3 laps vs 3 AI rivals |
| **Time Trial** | Solo hot-lap, best laps saved to the leaderboard |
| **Online Race** | Create/join rooms (4-char code), host-started 3-2-1 countdown, 20 Hz position sync, live standings |

### Online (socket.io race service)
- Rooms up to 8 players, host-controlled race start (2/3/5 laps)
- 20 Hz state relay with rate limiting, remote car interpolation + name tags
- Finish broadcast → shared results
- Host promotion when the host disconnects

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake / Reverse |
| `A` `D` / `←` `→` | Steer |
| `SPACE` | Handbrake (drift) |
| `SHIFT` | Nitro |
| `C` | Camera mode |
| `R` | Reset to track |
| `M` | Mute |
| `ESC` / `P` | Pause |

Touch controls appear automatically on mobile (coarse pointers).

## Tech Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind CSS 4** + shadcn/ui
- **three.js 0.186** — rendering, spline track, instanced city, custom shaders for smoke
- **socket.io** — race service (mini-service, port 3003)
- **Prisma + SQLite** — lap records leaderboard
- **Zustand** — game UI state

## Project Structure

```
src/
  game/
    constants.ts          # tuning, palette, circuit control points
    core/
      Game.ts             # orchestrator: scene, loop, race flow, net wiring
      Input.ts            # keyboard/touch input
      CameraRig.ts        # chase camera
    world/
      Track.ts            # spline track, road mesh, checkpoints, queries
      Car.ts              # physics + procedural car visual, RemoteCar
      AICar.ts            # AI driver
      CityEnvironment.ts  # buildings, neon, stars
      Particles.ts        # drift smoke
    race/RaceManager.ts   # laps, positions, timers
    net/NetClient.ts      # multiplayer client
    audio/EngineAudio.ts  # synth engine sound
  components/game/        # HUD, menus, lobby, results, touch controls
  stores/gameStore.ts     # Zustand store
  app/api/records/        # leaderboard API (Prisma)
mini-services/race-service/  # socket.io rooms + relay (port 3003)
prisma/schema.prisma      # LapRecord model
public/models/            # ← drop-in point for your car GLB assets (future)
```

## Getting Started

```bash
# 1. install
bun install

# 2. database (SQLite, lap records)
bun run db:push

# 3. race service (online multiplayer) — separate terminal
cd mini-services/race-service
bun install
bun run dev          # listens on :3003

# 4. game
bun run dev          # http://localhost:3000
```

The game connects to the race service through the gateway at `/?XTransformPort=3003`.

## Adding Your Own Assets (next iteration)

The barebone uses procedural geometry. The plan for the asset update:
1. Drop car model(s) at `public/models/` (GLTF/GLB, ~4.6 m long, forward = +Z)
2. A loader hook will replace the procedural body while keeping wheels, lights and physics
3. Track textures / skybox can be swapped in `Track.ts` / `CityEnvironment.ts`

## Roadmap Ideas

- GLB car models + customization (rims, vinyls, neon)
- Multiple tracks & track selection
- Damage model + traffic
- Crew/team race modes (Carbon's territory wars)
- Persistent online ladder

## License

MIT — do whatever you want, attribution appreciated.

## Asset credits

- Cars, buildings, asphalt/ground textures: ambientCG / Poly Haven (CC0)
- **SPA '92** circuit geometry (centerline + terrain heights): "Circuit de
  Spa-Francorchamps 1992 layout" by Dave Love
  (Sketchfab), [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) —
  extracted into `src/game/maps/spa_generated.ts` by `scripts/extract_spa.cjs`

// ─── Game: renderer, world, race loop, HUD feed, online wiring ──────────────
import * as THREE from "three";
import { GAME_CONFIG } from "../constants";
import { Track } from "../world/Track";
import { CityEnvironment } from "../world/CityEnvironment";
import { Car, RemoteCar, type CarSnapshot } from "../world/Car";
import { AICar } from "../world/AICar";
import { instantiateCar, hasCarModel, registerKTX2Renderer, type CarModelInstance } from "../world/CarModelLoader";
import { AI_POOL_IDS, carDef, resolveCarId, resolveCarTuning } from "../cars/registry";
import { DEFAULT_MAP_ID, mapDef, resolveEnvTheme, resolveMapPalette } from "../maps/registry";
import { ParticlePool } from "../world/Particles";
import { resolveCarCollisions } from "../world/Collisions";
import { RaceManager } from "../race/RaceManager";
import { CameraRig, type CameraMode } from "./CameraRig";
import { InputManager } from "./Input";
import { EngineAudio } from "../audio/EngineAudio";
import type { NetClient, NetFinishEntry } from "../net/NetClient";
import { makeNightEnvironment } from "./nightEnv";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

export type GameMode = "quick" | "trial" | "online";

export interface HudState {
  speedKmh: number;
  gear: string;
  rpm: number;
  lap: number;
  totalLaps: number;
  position: number;
  racers: number;
  timeMs: number;
  bestLapMs: number;
  nitro: number;
  driftChain: number;
  driftTotal: number;
  wrongWay: boolean;
  cameraMode: CameraMode;
  /** rolling frames-per-second (0.5 s window) — 0 until the first window closes */
  fps: number;
  /** rolling mean raw frame time in ms */
  frameMs: number;
}

export interface RaceResultEntry {
  name: string;
  color: string;
  position: number;
  totalTimeMs: number;
  bestLapMs: number;
  isPlayer: boolean;
  driftScore: number;
}

export interface GameOptions {
  mode: GameMode;
  playerName: string;
  carColor: string;
  /** selected car id from the registry (src/game/cars/registry.ts) */
  carId?: string;
  /** selected map id from the registry (src/game/maps/registry.ts) */
  mapId?: string;
  laps?: number;
  net?: NetClient | null;
}

export interface GameCallbacks {
  onHud: (h: HudState) => void;
  onCountdown: (step: number | null) => void;
  onLapFlash: (msg: string) => void;
  onFinish: (results: RaceResultEntry[]) => void;
  onOnlineFinish: (entry: NetFinishEntry) => void;
}

const AI_NAMES = ["VIPER", "KAIJU", "ONYX", "RAZOR", "NOMAD"];
const AI_COLORS = ["#dc2626", "#14b8a6", "#e2e8f0", "#db2777", "#84cc16"];

export class Game {
  // core
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  cameraRig: CameraRig;
  input = new InputManager();
  audio = new EngineAudio();
  clock = new THREE.Clock();

  // world
  track: Track;
  city: CityEnvironment;
  particles = new ParticlePool(240);

  // cars
  player!: Car;
  ais: AICar[] = [];
  remotes: Map<string, RemoteCar> = new Map();
  allCars: Car[] = [];

  // race
  raceManager: RaceManager | null = null;
  mode: GameMode;
  laps: number;
  /** map actually being raced (resolved against the registry) */
  readonly mapId: string;
  phase: "idle" | "countdown" | "racing" | "finished" = "idle";
  private countdownTimer = 0;
  private countdownStep = 0;
  private hudTimer = 0;
  private netTimer = 0;
  private raf = 0;
  private disposed = false;
  private moon: THREE.DirectionalLight;
  // fps meter — 0.5 s rolling window over RAW frame deltas (the physics
  // clamp on dt must not fake the number, and rAF-throttled headless
  // browsers report honestly)
  private fpsAcc = 0;
  private fpsFrames = 0;
  private fps = 0;
  private frameMs = 0;
  net: NetClient | null;
  results: RaceResultEntry[] = [];
  private finishOrder = 0;

  private cb: GameCallbacks;
  private opts: GameOptions;
  /** decaying camera-shake amplitude (0..1) fed by collisions / rail hits */
  private impactShake = 0;
  private railSoundCd = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    opts: GameOptions,
    callbacks: GameCallbacks
  ) {
    this.opts = opts;
    this.mode = opts.mode;
    // debug/verification handle — lets the console (and headless test runs)
    // drive the sim: __game.debugTick() bypasses rAF throttling entirely
    if (typeof window !== "undefined") {
      (window as { __game?: Game }).__game = this;
    }
    // resolve the map first — geometry, look and laps all come from it
    const map = mapDef(opts.mapId) ?? mapDef(DEFAULT_MAP_ID)!;
    this.mapId = map.id;
    this.laps = opts.laps ?? map.defaultLaps ?? GAME_CONFIG.LAPS;
    this.net = opts.net ?? null;
    this.cb = callbacks;

    // ── renderer ──
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    registerKTX2Renderer(this.renderer); // refresh KTX2 GPU-format detection
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 1.15 read as an under-exposed void once real textured buildings moved
    // in (VLM: 2/10, "near-black silhouettes") — lift the whole frame
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(74, canvas.clientWidth / canvas.clientHeight, 0.1, 1400);
    this.cameraRig = new CameraRig(this.camera);

    // ── scene: night atmosphere (map palette) ──
    const P = resolveMapPalette(map);
    this.scene.background = new THREE.Color(P.sky);
    // density 0.0105 -> 0.0048: the old fog capped city visibility at ~150m —
    // facades across the whole gameplay band were 45-90% dissolved into haze.
    // Fog COLOUR comes from the palette (lifted blue-violet): distance fades
    // read as city-glow atmosphere instead of a void swallowing the skyline
    this.scene.fog = new THREE.FogExp2(P.fog, 0.0048);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const nightEnv = makeNightEnvironment();
    const env = pmrem.fromScene(nightEnv, 0.08);
    this.scene.environment = env.texture;
    // dark night env (not the old bright studio room) — a touch more global IBL
    // so glossy surfaces actually reflect the city glow; matte ones barely move
    (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.36;
    pmrem.dispose();
    nightEnv.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });

    // ── A/B experiment (?env=hdri): swap procedural IBL for a real night HDRI ──
    // Staging-only, default path unchanged. ?envf=<basename.exr> picks the file
    // (no slashes allowed), ?envi=<num> overrides environmentIntensity for tuning.
    const params = new URLSearchParams(window.location.search);
    if (params.get("env") === "hdri") {
      const raw = params.get("envf") ?? "night002_2k.exr";
      const file = raw.includes("/") || raw.includes("..") ? "night002_2k.exr" : raw;
      const enviRaw = parseFloat(params.get("envi") ?? "");
      new EXRLoader().load(
        `/staging/${file}`,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          const pmrem2 = new THREE.PMREMGenerator(this.renderer);
          const envHDRI = pmrem2.fromEquirectangular(tex);
          this.scene.environment = envHDRI.texture;
          const inten = Number.isFinite(enviRaw) && enviRaw > 0 ? enviRaw : 0.36;
          (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = inten;
          pmrem2.dispose();
          tex.dispose();
          console.info(`[env] HDRI swap ok: ${file} intensity=${inten}`);
        },
        undefined,
        (err) => console.warn("[env] HDRI load failed:", err),
      );
    }

    // night fill lifted across the board (user: buildings "too dark"):
    // ambient is the omnidirectional facade light — the old 1.4 @ 0x2a2430
    // left every non-moon-facing wall at ~0.03 linear, i.e. pure black.
    // Warm hemisphere ground = sodium-lamp bounce off the streets.
    this.scene.add(new THREE.AmbientLight(0x4a4468, 3.8));
    const hemi = new THREE.HemisphereLight(0x3a4266, 0x1a1410, 1.0);
    this.scene.add(hemi);
    // warm sodium fill from the moon's opposite quadrant — without it every
    // moon-away facade was ambient-only and read as a flat black slab while
    // the lit side popped (VLM on iteration 2: right side "window grids, floor
    // lines", left side "near-black"). No shadow casting — it's a city bounce.
    const sodiumFill = new THREE.DirectionalLight(0x9a7a55, 0.55);
    sodiumFill.position.set(-160, 150, -120);
    this.scene.add(sodiumFill);
    this.moon = new THREE.DirectionalLight(0xbcd0e8, 0.8);
    this.moon.position.set(120, 220, 80);
    this.moon.castShadow = true;
    this.moon.shadow.mapSize.set(2048, 2048);
    this.moon.shadow.camera.near = 10;
    this.moon.shadow.camera.far = 700;
    this.moon.shadow.camera.left = -160;
    this.moon.shadow.camera.right = 160;
    this.moon.shadow.camera.top = 160;
    this.moon.shadow.camera.bottom = -160;
    this.scene.add(this.moon, this.moon.target);

    // ── world ──
    this.track = new Track(map);
    this.scene.add(this.track.group);
    this.city = new CityEnvironment(this.track, resolveEnvTheme(map));
    this.scene.add(this.city.group);
    this.scene.add(this.particles.points);

    // ── cars ──
    this.setupCars();

    // ── input & audio hooks ──
    this.input.attach();
    this.input.bindControls(this.player.controls);
    this.input.onAction = (a) => {
      if (a === "camera") this.cameraRig.cycle();
      if (a === "mute") this.audio.setMuted(!this.audio.muted);
      if (a === "reset") this.player.resetToTrack(this.track);
      if (a === "pause") this.togglePause();
    };
    // NFS-Carbon mouse free-look: hold right mouse, orbit, auto-recenter
    this.input.onLookToggle = (pressed) =>
      pressed ? this.cameraRig.holdLook() : this.cameraRig.releaseLook();
    this.input.onLookDelta = (dx, dy) => this.cameraRig.addLook(dx, dy);

    // ── online wiring ──
    if (this.net) this.wireNet();

    window.addEventListener("resize", this.onResize);
    this.onResize();
    this.loop();
  }

  // ─── setup ──────────────────────────────────────────────────────────────

  private setupCars() {
    // clear any previous grid (restart flow)
    for (const c of this.allCars) {
      this.scene.remove(c.group);
      c.dispose();
    }
    this.ais = [];
    this.allCars = [];

    const total = this.mode === "quick" ? 1 + GAME_CONFIG.AI_COUNT : 1;
    // player starts at the back of the grid (NFS style)
    const playerGrid = total - 1;
    const carId = this.opts.carId ?? "classic";
    // AI rivals rotate through the registry's AI pool for variety
    const aiPool = AI_POOL_IDS.filter((c) => c !== carId);
    for (let i = 0; i < total; i++) {
      let car: Car;
      if (i === playerGrid) {
        const model = hasCarModel(carId) ? instantiateCar(carId, this.opts.carColor) ?? undefined : undefined;
        if (!model && carDef(carId)?.modelUrl) {
          console.warn(
            `[Game] model for "${carId}" (${carDef(carId)!.modelUrl}) failed to load — ` +
              "falling back to the procedural car. Check the file exists / re-select the car.",
          );
        }
        car = this.player = new Car(
          "player",
          this.opts.carColor,
          this.opts.playerName,
          model,
          resolveCarTuning(carId)
        );
      } else {
        const aiId = aiPool[i % aiPool.length];
        const model = hasCarModel(aiId) ? instantiateCar(aiId, AI_COLORS[i % AI_COLORS.length]) ?? undefined : undefined;
        const ai = new AICar(
          AI_COLORS[i % AI_COLORS.length],
          AI_NAMES[i % AI_NAMES.length],
          i,
          model,
          resolveCarTuning(aiId)
        );
        this.ais.push(ai);
        car = ai;
      }
      const spot = this.gridSlot(i, total);
      car.placeAt(spot.pos, spot.heading);
      this.scene.add(car.group);
    }
    this.allCars = [this.player, ...this.ais];
    this.input.bindControls(this.player.controls);
    this.cameraRig.reset();
    this.cameraRig.update(0.016, this.player);
  }

  private gridSlot(i: number, total: number) {
    // grid behind the start line, two-wide — 6m rows keep bumpers apart
    const N = this.track.sampleCount;
    const back = 6 + Math.floor(i / 2) * 6;
    const idx = (N - back) % N;
    const s = this.track.sampleAt(idx);
    const lateral = i % 2 === 0 ? -3.4 : 3.4;
    const pos = s.pos.clone().addScaledVector(s.normal, lateral);
    pos.y += 0.15;
    return { pos, heading: Math.atan2(s.tangent.x, s.tangent.z) };
  }

  private wireNet() {
    const net = this.net!;
    net.onRemoteStates = (states) => {
      for (const [id, snap] of Object.entries(states)) {
        if (id === net.socket?.id) continue;
        let rc = this.remotes.get(id);
        if (!rc) {
          const p = net.players.find((x) => x.id === id);
          // remote drivers race THEIR car, not ours — resolve their registry id
          // (unknown/missing ids fall back to the garage default)
          const carId = resolveCarId(p?.carId);
          const model: CarModelInstance | undefined = hasCarModel(carId)
            ? instantiateCar(carId, p?.color ?? "#e2e8f0") ?? undefined
            : undefined;
          rc = new RemoteCar(id, p?.name ?? "RACER", p?.color ?? "#e2e8f0", model);
          this.remotes.set(id, rc);
          this.scene.add(rc.car.group);
          if (!this.allCars.includes(rc.car)) this.allCars.push(rc.car);
        }
        rc.setTarget(snap);
      }
    };
    net.onRaceStart = (laps) => {
      this.laps = laps;
      this.beginCountdown();
    };
    net.onFinishBroadcast = (entry) => {
      this.results.push({
        name: entry.name,
        color: "#e2e8f0",
        position: 0,
        totalTimeMs: entry.totalTimeMs,
        bestLapMs: entry.bestLapMs,
        isPlayer: false,
        driftScore: 0,
      });
      this.cb.onOnlineFinish(entry);
    };
  }

  // ─── race flow ──────────────────────────────────────────────────────────

  beginCountdown() {
    this.raceManager = new RaceManager(this.track, this.allCars, this.laps, (e) => {
      if (e.type === "lap") {
        if (e.car === this.player) {
          const msg = `LAP ${e.lap}/${this.laps} — ${fmtTime(e.lapTimeMs)}${e.isBest ? "  ★ BEST" : ""}`;
          this.cb.onLapFlash(msg);
          if (e.isBest) this.audio.blip(880, 0.14, "triangle");
        }
      } else if (e.type === "finish") {
        if (e.car === this.player) this.handlePlayerFinish();
        else if (e.car.kind === "ai") {
          this.results.push({
            name: e.car.name,
            color: e.car.color,
            position: e.position,
            totalTimeMs: e.totalTimeMs,
            bestLapMs: e.bestLapMs,
            isPlayer: false,
            driftScore: 0,
          });
        }
      }
    });
    this.phase = "countdown";
    this.countdownStep = 3;
    this.countdownTimer = 0;
    this.cb.onCountdown(3);
    this.audio.blip(520, 0.16);
  }

  private handlePlayerFinish() {
    this.finishOrder += 1;
    const standing = this.raceManager!.standingFor(this.player)!;
    // snapshot the FULL grid so the standings table shows every racer
    const order = [...this.raceManager!.standings].sort((a, b) => a.position - b.position);
    this.results = order.map((s) => ({
      name: s.car.name || this.opts.playerName,
      color: s.car.color,
      position: s.position,
      totalTimeMs: s.finished ? s.totalTimeMs : 0,
      bestLapMs: s.bestLapMs,
      isPlayer: s.car === this.player,
      driftScore: s.car === this.player ? this.player.driftScore + Math.round(this.player.driftChain) : 0,
    }));
    if (this.net) this.net.sendFinish(standing.totalTimeMs, standing.bestLapMs);
    this.phase = "finished";
    this.audio.fanfare(this.finishOrder === 1 ? "win" : "lose");
    this.cb.onFinish(this.results);
  }

  private togglePause() {
    // pause handled via React screen; game exposes it
    if (this.phase === "racing") this.paused = !this.paused;
  }

  paused = false;

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.input.update(0);
  }

  restart() {
    for (const rc of this.remotes.values()) {
      this.scene.remove(rc.car.group);
      rc.dispose();
    }
    this.remotes.clear();
    this.results = [];
    this.finishOrder = 0;
    this.ais.forEach((ai) => (ai.stuckTimer = 0));
    this.setupCars();
    this.raceManager = null;
    this.paused = false;
    this.beginCountdown();
  }

  quit() {
    this.disposed = true;
    if (typeof window !== "undefined" && (window as { __game?: Game }).__game === this) {
      delete (window as { __game?: Game }).__game;
    }
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.input.detach();
    this.audio.dispose();
    // release net callbacks so the lobby can re-wire them for the next race
    if (this.net) {
      this.net.onRemoteStates = null;
      this.net.onRaceStart = null;
      this.net.onFinishBroadcast = null;
    }
    this.track.dispose();
    this.city.dispose();
    this.particles.dispose();
    for (const c of this.allCars) {
      this.scene.remove(c.group);
      c.dispose();
    }
    for (const rc of this.remotes.values()) rc.dispose();
    this.remotes.clear();
    this.renderer.dispose();
  }

  // ─── per-frame loop ─────────────────────────────────────────────────────

  private onResize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  getMinimapData() {
    return {
      outline: this.track.samples.map((s) => ({ x: s.pos.x, z: s.pos.z })),
      cars: this.allCars.concat([...this.remotes.values()].map((r) => r.car)).map((c) => ({
        x: c.pos.x,
        z: c.pos.z,
        color: c === this.player ? "#ffffff" : c.color,
        isPlayer: c === this.player,
      })),
    };
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 1 / 30);

    // ── fps meter: raw deltas, 0.5 s window ──
    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.frameMs = (this.fpsAcc / this.fpsFrames) * 1000;
      // fractional — a slow frame (e.g. software GL) must not round to 0 and
      // hide the readout; the chip formats for display
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    this.advanceCountdown(dt);

    const controlsEnabled = this.phase === "racing" && !this.paused;
    if (!this.paused) {
      this.input.update(dt);
      // ── drive ──
      const playerProg = this.raceManager?.standingFor(this.player)?.progress ?? 0;
      for (const ai of this.ais) ai.drive(dt, this.track, playerProg, controlsEnabled);
      this.player.update(dt, this.track, controlsEnabled);
      for (const ai of this.ais) ai.update(dt, this.track, controlsEnabled);
      for (const rc of this.remotes.values()) rc.update(dt);

      // ── car-vs-car collision ──
      this.resolveCollisions(dt);

      // remote cars contribute to standings
      if (this.raceManager) this.raceManager.update(dt, this.phase === "racing");

      // ── particles from cars ──
      for (const car of this.allCars) {
        if (car.smokeRequest) {
          this.particles.emit(car.smokeRequest.pos, car.smokeRequest.strength);
          car.smokeRequest = null;
        }
      }
      this.particles.update(dt);
    }

    // ── camera & lights ──
    this.cameraRig.update(this.paused ? 0.0001 : dt, this.player);
    if (this.impactShake > 0.01) {
      const k = this.impactShake;
      this.camera.position.x += (Math.random() - 0.5) * k * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * k * 0.35;
      this.camera.position.z += (Math.random() - 0.5) * k * 0.5;
      this.impactShake = Math.max(0, this.impactShake - 3.5 * dt);
    }
    this.moon.position.set(this.player.pos.x + 120, 220, this.player.pos.z + 80);
    this.moon.target.position.copy(this.player.pos);

    // ── audio ──
    if (!this.audio.muted) {
      const [gear, rpm] = gearAndRpm(this.player.speed);
      this.audio.update(rpm, Math.abs(this.player.speed), this.player.drifting, this.player.nitroActive);
    }

    // ── HUD feed at ~30 Hz ──
    this.hudTimer += dt;
    if (this.hudTimer > 1 / 30) {
      this.hudTimer = 0;
      this.emitHud();
    }

    // ── net state send at 20 Hz ──
    if (this.net && this.phase === "racing" && !this.paused) {
      this.netTimer += dt;
      if (this.netTimer > 1 / 20) {
        this.netTimer = 0;
        this.net.sendState(this.player.snapshot());
      }
    }

    this.renderFrame();
  };

  /**
   * Single render seam. The speed-blur post chain was REMOVED by user
   * request (2026-10-22, "remove blur") after a run of iGPU pain (steady
   * FPS drops + first-engage compile stall) — this is now a plain direct
   * render; the renderer's own ACES + sRGB pipeline is unchanged, so colors
   * are identical to the old disengaged path. If a post effect is ever
   * re-added, do it here and mind the first-use compile stall (see
   * SpeedBlur in git history for the warm-up pattern).
   */
  private renderFrame() {
    this.renderer.render(this.scene, this.camera);
  }

  /** car-vs-car collision resolution + impact feedback (FX/sound/shake) */
  private resolveCollisions(dt: number) {
    const contacts = resolveCarCollisions(this.allCars);
    for (const c of contacts) {
      // cars moved after their update() — refresh transforms for this frame
      c.a.syncVisual(1e-4);
      c.b.syncVisual(1e-4);
      this.particles.emit(c.point, 1);
      if (c.a === this.player || c.b === this.player) {
        const strength = THREE.MathUtils.clamp(c.impact / 9, 0.2, 1);
        this.impactShake = Math.max(this.impactShake, strength);
        if (!this.audio.muted)
          this.audio.blip(55 + Math.random() * 45, 0.18, "sawtooth", 0.08 + 0.3 * strength);
      }
    }
    // guardrail scrape feedback for the player (rate-limited thud)
    this.railSoundCd = Math.max(0, this.railSoundCd - dt);
    if (this.player.railHit > 3.5 && this.railSoundCd === 0) {
      const strength = THREE.MathUtils.clamp(this.player.railHit / 12, 0.2, 1);
      this.impactShake = Math.max(this.impactShake, strength * 0.7);
      if (!this.audio.muted)
        this.audio.blip(70 + Math.random() * 50, 0.2, "sawtooth", 0.06 + 0.28 * strength);
      this.railSoundCd = 0.22;
    }
  }

  private emitHud() {
    const standing = this.raceManager?.standingFor(this.player);
    const [gear, rpm] = gearAndRpm(this.player.speed);
    this.cb.onHud({
      speedKmh: Math.round(Math.abs(this.player.speed) * 3.6),
      gear,
      rpm,
      lap: Math.min((standing?.lapsDone ?? 0) + 1, this.laps),
      totalLaps: this.laps,
      position: standing?.position ?? 1,
      racers: this.allCars.length,
      timeMs: this.raceManager?.raceTimeMs ?? 0,
      bestLapMs: standing?.bestLapMs ?? 0,
      nitro: this.player.nitro,
      driftChain: Math.round(this.player.driftChain),
      driftTotal: this.player.driftScore + Math.round(this.player.driftChain),
      wrongWay: standing?.wrongWay ?? false,
      cameraMode: this.cameraRig.mode,
      fps: this.fps,
      frameMs: Math.round(this.frameMs * 10) / 10,
    });
  }

  /** remote player left → drop their car */
  syncRemotePlayers(players: { id: string; name: string; color: string }[]) {
    for (const [id, rc] of this.remotes) {
      if (!players.find((p) => p.id === id)) {
        this.scene.remove(rc.car.group);
        rc.dispose();
        this.remotes.delete(id);
        this.allCars = this.allCars.filter((c) => c !== rc.car);
      }
    }
  }

  /** countdown sequencing shared by the rAF loop and debugTick */
  private advanceCountdown(dt: number) {
    if (this.phase !== "countdown" || this.paused) return;
    this.countdownTimer += dt;
    if (this.countdownTimer < 1) return;
    this.countdownTimer = 0;
    this.countdownStep -= 1;
    if (this.countdownStep > 0) {
      this.cb.onCountdown(this.countdownStep);
      this.audio.blip(520, 0.16);
    } else if (this.countdownStep === 0) {
      this.cb.onCountdown(0); // GO
      this.audio.blip(940, 0.3, "square", 0.3);
    } else {
      this.cb.onCountdown(null);
      this.phase = "racing";
      this.raceManager?.start();
    }
  }

  /**
   * Dev/test hook: advance the simulation synchronously without waiting for
   * rAF (headless browsers throttle rAF heavily). Optional auto-steer drives
   * the player car along the racing line like the AI does.
   */
  debugTick(n = 60, opts: { throttle?: number; autoSteer?: boolean } = {}) {
    const dt = 1 / 60;
    for (let i = 0; i < n; i++) {
      this.advanceCountdown(dt);
      const racing = this.phase === "racing";
      const c = this.player.controls;
      if (opts.autoSteer && this.player.loc) {
        const metresPerSample = this.track.length / this.track.sampleCount;
        const look = Math.max(4, Math.round(24 / metresPerSample));
        const target = this.track.sampleAt(this.player.loc.index + look).pos;
        const toT = target.clone().sub(this.player.pos);
        const fwd = this.player.forward;
        const cross = fwd.x * toT.z - fwd.z * toT.x;
        const angle = Math.atan2(Math.abs(cross), Math.max(fwd.dot(toT), 0.001));
        c.steer = THREE.MathUtils.clamp((cross > 0 ? 1 : -1) * angle * 3.2, -1, 1);
        c.throttle = opts.throttle ?? 1;
      } else if (opts.throttle !== undefined) {
        c.throttle = opts.throttle;
      }
      const playerProg = this.raceManager?.standingFor(this.player)?.progress ?? 0;
      for (const ai of this.ais) ai.drive(dt, this.track, playerProg, racing);
      this.player.update(dt, this.track, racing);
      for (const ai of this.ais) ai.update(dt, this.track, racing);
      this.resolveCollisions(dt);
      this.raceManager?.update(dt, racing);
    }
    this.emitHud();
    this.renderFrame();
    const standing = this.raceManager?.standingFor(this.player);
    return {
      phase: this.phase,
      speed: Math.round(this.player.speed * 3.6),
      pos: [Math.round(this.player.pos.x), Math.round(this.player.pos.z)],
      lap: standing?.lapsDone ?? 0,
      position: standing?.position ?? 0,
      timeMs: this.raceManager?.raceTimeMs ?? 0,
      offRoad: this.player.loc ? Math.abs(this.player.loc.lateral) > this.track.halfWidth : false,
      results: this.results.length,
    };
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────
function gearAndRpm(speed: number): [string, number] {
  const s = Math.abs(speed);
  if (speed < -0.5) return ["R", Math.min(s / 12, 1)];
  if (s < 0.5) return ["N", 0.12];
  const bands = [0, 11, 21, 32, 44, 57, 74];
  for (let g = 1; g < bands.length - 1; g++) {
    if (s < bands[g]) {
      const frac = (s - bands[g - 1]) / (bands[g] - bands[g - 1]);
      return [String(g), 0.25 + frac * 0.75];
    }
  }
  return ["6", 1];
}

export function fmtTime(ms: number): string {
  if (!ms || ms < 0) return "--:--.---";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mss = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, "0")}.${String(mss).padStart(3, "0")}`;
}

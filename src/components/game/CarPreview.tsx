"use client";
// ─── CarPreview: 3D showroom turntable for the garage / lobby ───────────────
// Alpha-rendered so the menu backdrop shows through. GLB cars load through
// the shared template cache; procedural cars use the same muscle builder as
// the race skin, so what you see is what you drive.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { loadCarModel, instantiateCar, applyPaint, registerKTX2Renderer } from "@/game/world/CarModelLoader";
import { checkWebGLSupport } from "@/game/core/webglSupport";
import { buildMuscleBody, buildMuscleWheel, MUSCLE_WHEEL_POS } from "@/game/world/ProceduralMuscle";
import { carEntry, CARS } from "@/game/cars/registry";
import { makeUnderglow, neonColorFor, neonPulseOpacity, type Underglow } from "@/game/world/NeonGlow";

interface CarHandle {
  root: THREE.Group;
  /** tintable materials for live recolor */
  paint: THREE.MeshStandardMaterial[];
  /** per-instance cloned LIT lamp materials (GLB only) — ours to dispose */
  lamps: THREE.MeshStandardMaterial[];
  /** disposal: GLB clones only own their cloned materials; procedural owns all */
  procedural: boolean;
}

/** RectAreaLightUniformsLib.init() rebuilds its LTC textures on every call —
 *  guard it so remounts don't leak them */
let rectAreaLightsReady = false;
function initRectAreaLights() {
  if (rectAreaLightsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightsReady = true;
}

/** soft elongated glow sprite for the tube lamps — canvas gradient, no asset */
function makeTubeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.translate(64, 32);
  ctx.scale(1, 0.5); // squash the radial gradient into a tube-shaped ellipse
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-64, -64, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function CarPreview({ carId, color, neonId, className }: { carId: string; color: string; neonId?: string; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carRef = useRef<CarHandle | null>(null);
  /** showroom neon — same factory as the race underglow, so what you pick in
   *  the garage is exactly what glows at night */
  const underglowRef = useRef<Underglow | null>(null);
  /** latest paint color (async builds read this to avoid stale closures) */
  const colorRef = useRef(color);
  colorRef.current = color;
  /** bump to rebuild the current car from scratch */
  const buildToken = useRef(0);
  /** built + compiled cars by id — a cached instance pins its linked programs
   *  (refcounted on the cloned materials), so revisiting a car never relinks */
  const cacheRef = useRef(new Map<string, CarHandle>());
  /** fleet prewarm runs once per mount */
  const prewarmDone = useRef(false);

  // ── persistent three.js scaffolding (renderer / scene / lights / floor) ──
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // no usable GPU → renderer creation would throw inside this effect and
    // take the whole React tree down. Stay empty; GameShell's WebGL gate
    // overlay explains the dead end.
    if (!checkWebGLSupport().ok) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    registerKTX2Renderer(renderer); // refresh KTX2 GPU-format detection
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(5.6, 2.3, 6.8);
    camera.lookAt(0, 0.75, 0);

    // lighting: hemi fill + warm key + twin amber rim lights (showroom vibe)
    scene.add(new THREE.HemisphereLight(0x39415c, 0x0a0a0c, 1.1));
    const key = new THREE.DirectionalLight(0xffe9c4, 2.6);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    scene.add(key);
    const rimL = new THREE.DirectionalLight(0xf59e0b, 1.4);
    rimL.position.set(-6, 3, -5);
    const rimR = new THREE.DirectionalLight(0xf59e0b, 1.1);
    rimR.position.set(6, 2.5, -6);
    scene.add(rimL, rimR);
    // soft cool fill from the camera side — lifts the faces the key leaves black
    const fill = new THREE.DirectionalLight(0xbcd0ff, 0.85);
    fill.position.set(0.5, 3, 9);
    scene.add(fill);

    // IBL: the GLB cars ship with envMapIntensity boosted for the race sky —
    // with no environment in here their metallic paint reflected pure black,
    // which is why the room read so dark. A PMREM'd RoomEnvironment gives the
    // paint (and the floor) something to mirror; intensity kept modest so the
    // dark showroom mood survives.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const envRT = pmrem.fromScene(room, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.6;
    room.dispose();
    pmrem.dispose();

    // floor: dark disc + amber halo ring
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.6, metalness: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(3.15, 3.35, 64),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.01;
    scene.add(halo);

    // neon underglow — pulses in the tick below, recolors on pick (effect)
    const underglow = makeUnderglow(neonColorFor(undefined, colorRef.current), 3.4, 5.6);
    underglow.mesh.position.y = 0.06; // just above the disc, under the halo
    scene.add(underglow.mesh);
    underglowRef.current = underglow;

    // ── garage roof lamps ── two rows of twin fluorescent tubes hung above
    // the turntable. The whole rig is yawed to face the camera so the rows
    // read as screen-horizontal "roof beams"; suspension wires run past the
    // top of the frame, implying the ceiling we never see. Each row carries
    // a RectAreaLight — the soft elongated highlight real tube fixtures
    // throw on car paint (and the light pool on the floor disc).
    initRectAreaLights();
    const lamps = new THREE.Group();
    lamps.rotation.y = Math.atan2(camera.position.x, camera.position.z);
    const lampDisposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];
    const housingGeo = new THREE.BoxGeometry(4.9, 0.12, 0.34);
    const tubeGeo = new THREE.BoxGeometry(4.5, 0.06, 0.1);
    const wireGeo = new THREE.CylinderGeometry(0.012, 0.012, 2.6, 6);
    const glowGeo = new THREE.PlaneGeometry(5.0, 1.15);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x15151b, metalness: 0.7, roughness: 0.45 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.5, roughness: 0.8 });
    const glowTex = makeTubeGlowTexture();
    lampDisposables.push(housingGeo, tubeGeo, wireGeo, glowGeo, housingMat, wireMat, glowTex);
    const lampGlows: THREE.MeshBasicMaterial[] = [];
    const lampTubes: THREE.MeshStandardMaterial[] = [];
    for (const z of [-1.7, 1.7]) {
      const fixture = new THREE.Group();
      fixture.position.set(0, 3.35, z);
      fixture.add(new THREE.Mesh(housingGeo, housingMat));
      // per-row tube material so the far row can hum independently
      const tubeMat = new THREE.MeshStandardMaterial({
        color: 0x0c0c10, emissive: 0xeaf3ff, emissiveIntensity: 3, roughness: 0.4,
      });
      lampTubes.push(tubeMat);
      lampDisposables.push(tubeMat);
      for (const tz of [-0.08, 0.08]) {
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.position.set(0, -0.09, tz);
        fixture.add(tube);
      }
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xcfe0ff, map: glowTex, transparent: true, opacity: 0.32,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      lampGlows.push(glowMat);
      lampDisposables.push(glowMat);
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.y = -0.09;
      fixture.add(glow);
      for (const wx of [-1.9, 1.9]) {
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.position.set(wx, 1.36, 0);
        fixture.add(wire);
      }
      const area = new THREE.RectAreaLight(0xdfeaff, 6, 4.5, 0.32);
      area.rotation.x = -Math.PI / 2; // panel flat under the housing, emitting straight down
      area.position.y = -0.12;
      fixture.add(area);
      lamps.add(fixture);
    }
    scene.add(lamps);


    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    // ── drag-to-rotate + idle auto-spin ──
    const spin = { angle: 0.7, dragging: false, auto: 0.28 };
    const onDown = (e: PointerEvent) => {
      spin.dragging = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!spin.dragging) return;
      spin.angle += e.movementX * 0.008;
    };
    const onUp = () => (spin.dragging = false);
    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);

    // ── resize ──
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ── render loop ──
    let raf = 0;
    let last = performance.now();
    const clock = new THREE.Clock();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!spin.dragging) spin.angle += spin.auto * dt;
      if (carRef.current) carRef.current.root.rotation.y = spin.angle;
      // gentle halo pulse + neon breath (same rhythm as the race underglow)
      const t = clock.getElapsedTime();
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.18 * Math.sin(t * 2.2);
      underglow.mat.opacity = neonPulseOpacity(t, 0.6);
      // garage lamps: glow breathes slowly; the far row hums like an old ballast
      for (let i = 0; i < lampGlows.length; i++) {
        lampGlows[i].opacity = 0.3 + 0.06 * Math.sin(t * 1.9 + i * 2.4);
      }
      lampTubes[0].emissiveIntensity = 3 + 0.22 * Math.sin(t * 2.1) * Math.sin(t * 6.3);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (carRef.current) scene.remove(carRef.current.root);
      carRef.current = null;
      // every shown car is also a cache entry — one loop disposes them all
      // (materials first, programs release with them)
      for (const h of cacheRef.current.values()) disposeCar(h);
      cacheRef.current.clear();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
      envRT.dispose();
      scene.environment = null;
      scene.remove(lamps);
      for (const d of lampDisposables) d.dispose();
      underglow.dispose();
      underglowRef.current = null;
      renderer.dispose();
      if (el.parentElement) el.parentElement.removeChild(el);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // ── build / swap the car when carId changes ──
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!scene || !renderer || !camera) return;
    const token = ++buildToken.current;

    const swapIn = (handle: CarHandle) => {
      if (token !== buildToken.current) return false;
      // detach the old car BEFORE any disposal — a disposed material still
      // attached gets re-uploaded, leaving a frozen ghost overlapping the new car
      if (carRef.current) scene.remove(carRef.current.root);
      carRef.current = handle;
      scene.add(handle.root);
      return true;
    };

    /** store a built handle, unless a racing build (prewarm vs. on-demand for
     *  the same car) got there first — then dispose ours and return theirs */
    const cacheOrDispose = (id: string, handle: CarHandle): CarHandle => {
      const existing = cacheRef.current.get(id);
      if (existing) {
        disposeCar(handle);
        return existing;
      }
      cacheRef.current.set(id, handle);
      return handle;
    };

    const build = async () => {
      // cache hit: instance + linked programs already exist — zero shader
      // work, pure scene-graph swap
      const cached = cacheRef.current.get(carId);
      if (cached) {
        applyPaint(cached.paint, colorRef.current); // recolor while it was away
        swapIn(cached);
        return;
      }

      const handle = await buildCarHandle(carId, colorRef.current);
      if (!handle || token !== buildToken.current) {
        if (handle) disposeCar(handle); // superseded mid-build
        return;
      }

      // Link every program BEFORE the car joins the scene. A trace of this
      // garage caught 1313/514/326 ms freezes on car switch — all synchronous
      // getProgramInfoLog inside the first render of the newly added car.
      // compileAsync compiles the detached object against the garage's light
      // rig (targetScene) and defers linking off the hot path via
      // KHR_parallel_shader_compile; the old car keeps spinning meanwhile.
      try {
        await renderer.compileAsync(handle.root, camera, scene);
      } catch {
        // exotic contexts may reject — the car still shows, it just links
        // lazily like it did before this warm-up
      }
      if (token !== buildToken.current) {
        disposeCar(handle);
        return;
      }
      if (swapIn(cacheOrDispose(carId, handle))) scheduleFleetPrewarm();
    };

    void build();

    /** one-time background prewarm: build + compile the rest of the fleet so
     *  the NEXT car switch is a pure cache hit. Delayed past the first paint
     *  and paced one car per 150 ms so the idle browse stays smooth.
     *  (const arrow, not a hoisted function — the non-null narrowing of
     *  camera/scene above must carry into the closure) */
    const scheduleFleetPrewarm = () => {
      if (prewarmDone.current) return;
      prewarmDone.current = true;
      window.setTimeout(async () => {
        for (const c of CARS) {
          if (cacheRef.current.has(c.id)) continue;
          if (!rendererRef.current) return; // unmounted mid-prewarm
          const handle = await buildCarHandle(c.id, colorRef.current);
          if (!rendererRef.current || !handle) {
            if (handle) disposeCar(handle);
            return;
          }
          try {
            await rendererRef.current.compileAsync(handle.root, camera, scene);
          } catch {
            // keep going — an unprewarmed car just links on demand
          }
          if (!rendererRef.current) {
            disposeCar(handle);
            return;
          }
          cacheOrDispose(c.id, handle);
          await new Promise((r) => window.setTimeout(r, 150));
        }
      }, 1200);
    };
  }, [carId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── live recolor (no rebuild) ──
  useEffect(() => {
    const car = carRef.current;
    if (car) applyPaint(car.paint, color);
  }, [color]);

  // ── live neon recolor (AUTO tracks the paint; explicit picks override) ──
  useEffect(() => {
    const u = underglowRef.current;
    if (u) u.mat.color.copy(neonColorFor(neonId, color));
  }, [neonId, color]);

  return <div ref={hostRef} className={className} aria-label="Car preview" role="img" />;
}

function setCastShadows(root: THREE.Group) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
}

/** build a preview car — GLB through the shared template cache, procedural
 *  muscle as fallback. Does NOT compile; callers own that step. */
async function buildCarHandle(carId: string, color: string): Promise<CarHandle | null> {
  const entry = carEntry(carId);
  if (entry?.modelUrl) {
    try {
      const tpl = await loadCarModel(carId);
      const inst = tpl ? instantiateCar(carId, color) : null;
      if (inst) {
        const root = new THREE.Group();
        root.add(inst.root);
        setCastShadows(root);
        // Both the GLB wrapper (normalized: ground y=0) and the procedural
        // muscle (wheel centers at y = radius) have ground contact at local
        // y=0, matching the disc at y=0 — no offset needed.
        return { root, paint: inst.paintMaterials, lamps: inst.lampMats.map((l) => l.mat), procedural: false };
      }
    } catch {
      // missing GLB → procedural fallback below
    }
  }
  // procedural muscle — same builder the race uses
  const shell = buildMuscleBody(color);
  const root = new THREE.Group();
  root.add(shell.root);
  for (const [x, y, z] of MUSCLE_WHEEL_POS) {
    const wheel = buildMuscleWheel();
    wheel.position.set(x, y, z);
    root.add(wheel);
  }
  setCastShadows(root);
  return { root, paint: [shell.paint], lamps: [], procedural: true };
}

function disposeCar(car: CarHandle | null) {
  if (!car) return;
  if (car.procedural) {
    // procedural cars own all their geometry + materials
    car.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  } else {
    // GLB clones share template geometry — the cloned paint + lamp materials are ours
    for (const p of car.paint) p.dispose();
    for (const l of car.lamps) l.dispose();
  }
}

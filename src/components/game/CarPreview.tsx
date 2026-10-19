"use client";
// ─── CarPreview: 3D showroom turntable for the garage / lobby ───────────────
// Alpha-rendered so the menu backdrop shows through. GLB cars load through
// the shared template cache; procedural cars use the same muscle builder as
// the race skin, so what you see is what you drive.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { loadCarModel, instantiateCar, applyPaint, registerKTX2Renderer } from "@/game/world/CarModelLoader";
import { buildMuscleBody, buildMuscleWheel, MUSCLE_WHEEL_POS } from "@/game/world/ProceduralMuscle";
import { carEntry } from "@/game/cars/registry";

interface CarHandle {
  root: THREE.Group;
  /** tintable materials for live recolor */
  paint: THREE.MeshStandardMaterial[];
  /** disposal: GLB clones only own their cloned materials; procedural owns all */
  procedural: boolean;
}

export function CarPreview({ carId, color, className }: { carId: string; color: string; className?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const carRef = useRef<CarHandle | null>(null);
  /** latest paint color (async builds read this to avoid stale closures) */
  const colorRef = useRef(color);
  colorRef.current = color;
  /** bump to rebuild the current car from scratch */
  const buildToken = useRef(0);

  // ── persistent three.js scaffolding (renderer / scene / lights / floor) ──
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

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

    // floor: dark disc + amber halo ring
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x0b0b0f, roughness: 0.9, metalness: 0.1 })
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
      // gentle halo pulse
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.18 * Math.sin(clock.getElapsedTime() * 2.2);
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
      disposeCar(carRef.current);
      carRef.current = null;
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
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
    if (!scene) return;
    const token = ++buildToken.current;

    const build = async () => {
      const entry = carEntry(carId);
      let handle: CarHandle | null = null;

      if (entry?.modelUrl) {
        // GLB path — template cache shared with the race
        try {
          const tpl = await loadCarModel(carId);
          if (token !== buildToken.current) return; // superseded mid-load
          const inst = tpl ? instantiateCar(carId, colorRef.current) : null;
          if (inst) {
            const root = new THREE.Group();
            root.add(inst.root);
            handle = { root, paint: inst.paintMaterials, procedural: false };
          }
        } catch {
          // missing GLB → procedural fallback below
        }
      }
      if (!handle) {
        // procedural muscle — same builder the race uses
        const shell = buildMuscleBody(colorRef.current);
        const root = new THREE.Group();
        root.add(shell.root);
        for (const [x, y, z] of MUSCLE_WHEEL_POS) {
          const wheel = buildMuscleWheel();
          wheel.position.set(x, y, z);
          root.add(wheel);
        }
        handle = { root, paint: [shell.paint], procedural: true };
      }

      setCastShadows(handle.root);
      // Both the GLB wrapper (normalized: ground y=0) and the procedural
      // muscle (wheel centers at y = radius) have ground contact at local
      // y=0, matching the disc at y=0 — no offset needed. The previous
      // -MUSCLE_WHEEL_RADIUS shift sank the wheels into the opaque disc.

      if (token !== buildToken.current) {
        disposeCar(handle);
        return;
      }
      // swap: detach the old car from the scene BEFORE disposing — a disposed
      // material still attached gets re-uploaded by the renderer, leaving a
      // frozen ghost of the previous car overlapping the new one.
      if (carRef.current) scene.remove(carRef.current.root);
      disposeCar(carRef.current);
      carRef.current = handle;
      scene.add(handle.root);
    };

    void build();
  }, [carId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── live recolor (no rebuild) ──
  useEffect(() => {
    const car = carRef.current;
    if (car) applyPaint(car.paint, color);
  }, [color]);

  return <div ref={hostRef} className={className} aria-label="Car preview" role="img" />;
}

function setCastShadows(root: THREE.Group) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
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
    // GLB clones share template geometry — only the cloned paint materials are ours
    for (const p of car.paint) p.dispose();
  }
}

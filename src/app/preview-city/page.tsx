"use client";
/* Dev-only contact sheet for the building library — NOT part of the game.
 * ?set=ny|night|lpcity|cc — renders the SAME baked prototypes the game
 * scatters (loadCityModels: merged parts, night dim, luminance window glow). */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { loadCityModels } from "@/game/world/CityModels";

export default function CityPreview() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("loading…");
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const set = qs.get("set") ?? "ny";
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);
    // NOTE: no fog here — at contact-sheet camera distances any FogExp2 fogs
    // the whole grid to the background color and kills the emissive test.
    const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 6000);

    // night IBL-ish stand-in matching the game's night rig intent
    scene.add(new THREE.AmbientLight(0x30405a, 0.5));
    const d = new THREE.DirectionalLight(0x8090c0, 0.35);
    d.position.set(-200, 500, 100);
    scene.add(d);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8000, 8000),
      new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const grid = new THREE.GridHelper(8000, 80, 0x30364a, 0x1a1f2c);
    grid.position.y = 0.2;
    scene.add(grid);

    (async () => {
      const protos = await loadCityModels();
      const idFilter = qs.get("ids");
      const items = protos.filter((p) => p.slug.startsWith(set + "-"))
        .filter((p) => (!idFilter ? true : idFilter.split(",").includes(p.slug)));
      if (!items.length) { setMsg("no prototypes for set=" + set); return; }
      const cols = idFilter ? Math.min(3, items.length) : Math.ceil(Math.sqrt(items.length));
      let maxFoot = 0;
      for (const p of items) maxFoot = Math.max(maxFoot, p.width, p.depth);
      const cell = maxFoot + 25;
      let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
      items.forEach((p, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const holder = new THREE.Group();
        holder.position.set(col * cell, 0, row * cell);
        for (const part of p.parts) holder.add(new THREE.Mesh(part.geometry, part.material));
        scene.add(holder);
        minX = Math.min(minX, holder.position.x); maxX = Math.max(maxX, holder.position.x);
        minZ = Math.min(minZ, holder.position.z); maxZ = Math.max(maxZ, holder.position.z);
        if (qs.get("labels") !== "0") {
          const c = document.createElement("canvas"); c.width = 256; c.height = 64;
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, 256, 64);
          ctx.fillStyle = "#ffe"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
          ctx.fillText(p.slug, 128, 42);
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
          sp.scale.set(Math.max(40, p.width * 1.2), Math.max(10, p.width * 0.3), 1);
          sp.position.set(holder.position.x, p.height + 14, holder.position.z);
          scene.add(sp);
        }
      });
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const spanX = (maxX - minX) + cell, spanZ = (maxZ - minZ) + cell;
      let maxH = 0;
      for (const p of items) maxH = Math.max(maxH, p.height);
      // close-up mode for a handful of ids; overview mode uses height-aware framing
      const dist = idFilter
        ? Math.max(spanX, spanZ) * 1.3 + maxH * 0.8 + 60
        : Math.min(Math.max(spanX, spanZ * 1.1) + maxH * 1.6, 2600);
      const camY = idFilter ? Math.max(spanZ * 0.5, maxH * 0.55) + 40 : Math.max(spanZ * 0.9, maxH * 1.1);
      camera.position.set(cx + dist * (idFilter ? 0.35 : 0.25), camY, cz + dist * (idFilter ? 0.85 : 0.6));
      camera.lookAt(cx, idFilter ? maxH * 0.4 : 60, cz);
      renderer.render(scene, camera);
      let frames = 0;
      const loop = () => { renderer.render(scene, camera); frames++; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      (window as unknown as { __frames: unknown }).__frames = () => frames;
      setMsg(`set=${set} buildings=${items.length} (game-baked prototypes)`);
      (window as unknown as { __preview: unknown }).__preview = { ready: true, count: items.length, cols, cell };
      (window as unknown as { __rig: unknown }).__rig = { scene, camera, renderer };
    })().catch((e) => setMsg("error: " + String(e)));
  }, []);
  return (
    <main style={{ margin: 0, overflow: "hidden" }}>
      <canvas ref={ref} style={{ width: "100vw", height: "100vh", display: "block" }} />
      <div style={{ position: "fixed", top: 8, left: 8, color: "#8cf", font: "12px monospace" }}>{msg}</div>
    </main>
  );
}

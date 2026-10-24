"use client";

// /skytest — isolated DaySky harness for headless verification.
// Renders ONLY: HDR background (unrotated, exactly like DaySky — the v7 bake
// is world-aligned), the PMREM environment, one grey reference box, the sun
// directional from SUN_DIR. No track, no cars, no HUD — if the sky is broken
// HERE it's either the HDR or a SwiftShader sampling failure, not the game
// wiring.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";

const SUN_DIR = new THREE.Vector3(500, 160, 325).normalize();

export default function SkyTest() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("booting");
  useEffect(() => {
    const canvas = ref.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      74,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1400,
    );
    camera.position.set(0, 2, 0);
    // pitch camera slightly up so the sun at 15 deg elevation frames
    camera.lookAt(new THREE.Vector3(0, 8, 20));

    // ?type=float → RGBA32F instead of the default RGBA16F (SwiftShader
    // half-float sampling is the prime suspect for the white-out)
    const loader = new HDRLoader();
    if (new URLSearchParams(window.location.search).get("type") === "float")
      loader.setDataType(THREE.FloatType);
    loader.load(
      "/models/sky/sunflowers_puresky_2k.hdr?v=7",
      (tex: THREE.DataTexture) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = tex;
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromEquirectangular(tex).texture;
        pmrem.dispose();
        // expose for eval diagnostics
        (window as unknown as Record<string, unknown>).__skytest = { renderer, scene, camera, tex };
        setStatus(
          "sky loaded type=" + tex.type + " sample=" + (tex.image.data as Float32Array)[500],
        );
      },
      undefined,
      (err: unknown) => setStatus("load failed " + String(err)),
    );

    // ground + reference box so IBL/shadows are judgeable
    const sun = new THREE.DirectionalLight(0xfff1d4, 3.2);
    sun.position.set(SUN_DIR.x * 263, SUN_DIR.y * 263, SUN_DIR.z * 263);
    sun.castShadow = true;
    scene.add(sun, sun.target);
    scene.add(new THREE.HemisphereLight(0x9dbfe8, 0x5c5844, 1.05));
    scene.add(new THREE.AmbientLight(0xcfe0ee, 0.35));
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x51603f }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x808288 }),
    );
    box.position.set(0, 3, 40);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);

    let raf = 0;
    const loop = () => {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, []);
  return (
    <main className="w-screen h-screen relative bg-black">
      <canvas ref={ref} className="w-full h-full block" />
      <div className="absolute top-2 left-2 text-xs text-white font-mono">
        skytest: {status}
      </div>
    </main>
  );
}

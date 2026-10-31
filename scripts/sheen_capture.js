// Wet-road sheen / halo hunt — camera-sweep capture driver.
//
// Installs once per page (like halo_capture.js); bash drives it stepwise so
// each eval stays short under SwiftShader. The suspected artifact: the night
// road is a semi-gloss mirror (roughness 0.5 x roughnessMap, envMapIntensity
// 0.85) so the car's own lights + the PMREM sodium blobs reflect as hard
// stretched streaks lying on the asphalt — the "rectangular halo near car".
//
//   __sheenInit()      fast-forward to racing, stop the car (throttle 0)
//   __sheenSweep(k)    render sweep position k (k = 0..23: yaw 15 deg steps,
//                      radius/height cycled) and bank the frame
//   __sheenMode(tag)   apply an FX bisection toggle:
//                      beamsOff / fillOff / envLow / roughHigh / underglowOff
//                      / allOff / baseline (re-enables everything)
window.__shots = null;
window.__sheenInit = () => {
  const g = window.__game;
  if (!g) return "nogame";
  const r = g.renderer;
  const gl = r.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  window.__shots = [];
  window.__grab = (meta) => {
    const px = new Uint8Array(4 * W * H);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const src = document.createElement("canvas"); src.width = W; src.height = H;
    const sctx = src.getContext("2d");
    const img = sctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray(4 * W * (H - 1 - y), 4 * W * (H - y)), 4 * W * y);
    sctx.putImageData(img, 0, 0);
    const dw = 384, dh = Math.round(384 * H / W);
    const dst = document.createElement("canvas"); dst.width = dw; dst.height = dh;
    dst.getContext("2d").drawImage(src, 0, 0, dw, dh);
    window.__shots.push({ b64: dst.toDataURL("image/png").split(",")[1], meta });
  };
  let guard = 0;
  while (g.phase !== "racing" && guard++ < 6) g.debugTick(300, { autoSteer: true });
  // freeze the car in place — the road patch under it stays constant across
  // the whole camera sweep, so sweep positions are directly comparable
  const c = g.player.controls;
  c.throttle = 0; c.brake = 0; c.nitro = false; c.steer = 0;
  g.debugTick(30, { autoSteer: false });
  window.__fx = {};
  // remember every light we toggle so 'baseline' can restore the exact state
  window.__fx.player = g.player;
  return "phase=" + g.phase;
};

window.__sheenSetup = () => {
  const g = window.__game;
  if (!g || window.__grab) return "setup-already";
  const gl = g.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  window.__shots = [];
  window.__grab = (meta) => {
    const px = new Uint8Array(4 * W * H);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const src = document.createElement("canvas"); src.width = W; src.height = H;
    const sctx = src.getContext("2d");
    const img = sctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray(4 * W * (H - 1 - y), 4 * W * (H - y)), 4 * W * y);
    sctx.putImageData(img, 0, 0);
    const dw = 384, dh = Math.round(384 * H / W);
    const dst = document.createElement("canvas"); dst.width = dw; dst.height = dh;
    dst.getContext("2d").drawImage(src, 0, 0, dw, dh);
    window.__shots.push({ b64: dst.toDataURL("image/png").split(",")[1], meta });
  };
  return "setup-ok";
};

// incremental fast-forward — one SHORT eval per call (the 6x300 single-eval
// version tripped agent-browser's tab-wedged recovery on a warm dev server;
// bash loops this until the phase reads 'racing')
window.__sheenTick = () => {
  window.__sheenSetup();
  const g = window.__game;
  if (!g) return "nogame";
  if (g.phase !== "racing") { g.debugTick(300, { autoSteer: true }); return g.phase; }
  // first call after racing: freeze the car for the whole sweep
  if (!window.__frozen) {
    window.__frozen = true;
    const c = g.player.controls;
    c.throttle = 0; c.brake = 0; c.nitro = false; c.steer = 0;
    g.debugTick(30, { autoSteer: false });
  }
  return "racing";
};

window.__sheenSweep = (k) => {
  const g = window.__game;
  if (!g || !window.__grab) return "nogame";
  window.__shots = []; // one shot per sweep call — the caller dumps __shots[0]
  const p = g.player;
  // yaw 15deg steps around the car; radius/height cycled for coverage — the
  // streak only aligns at some angles, the user's shot is a low rear 3/4 view
  const yaw = (k * Math.PI) / 12;
  const rad = [9, 7, 11][k % 3];
  const hgt = [2.1, 1.2, 3.0][k % 3];
  const cam = g.camera;
  cam.position.set(p.pos.x + Math.cos(yaw) * rad, p.pos.y + hgt, p.pos.z + Math.sin(yaw) * rad);
  cam.lookAt(p.pos.x, p.pos.y + 0.7, p.pos.z);
  g.renderFrame();
  window.__grab({
    k, yaw: +(yaw * 57.2958).toFixed(0), rad, hgt,
    speed: Math.round(p.speed * 3.6),
  });
  return "sweep " + k + " ok (" + window.__shots.length + ")";
};

window.__sheenMode = (tag) => {
  const g = window.__game;
  if (!g) return "nogame";
  const pl = g.player;
  const setBeams = (v) => { if (pl.headBeamL) pl.headBeamL.visible = v; if (pl.headBeamR) pl.headBeamR.visible = v; };
  const setFill = (v) => pl.group.traverse((o) => { if (o.isPointLight) o.visible = v; });
  const setRoad = (fn) => g.scene.traverse((o) => { if (o.name === "road" && o.material) fn(o.material); });
  const setUnder = (v) => pl.setUnderglow ? pl.setUnderglow(v) : null;
  // always start from the full baseline state (the shipped night road:
  // roughness 0.72 / env 0.55), then apply the requested arm
  setBeams(true); setFill(true); setUnder(true);
  setRoad((m) => { m.envMapIntensity = 0.55; m.roughness = 0.72; });
  if (tag === "beamsOff") setBeams(false);
  else if (tag === "fillOff") setFill(false);
  else if (tag === "envLow") setRoad((m) => (m.envMapIntensity = 0.25));
  else if (tag === "roughHigh") setRoad((m) => (m.roughness = 0.95));
  else if (tag === "underglowOff") setUnder(false);
  else if (tag === "oldBase") setRoad((m) => { m.envMapIntensity = 0.85; m.roughness = 0.5; }); // pre-fix mirror road, for A/B
  else if (tag === "r065e085") setRoad((m) => { m.roughness = 0.65; m.envMapIntensity = 0.85; });
  else if (tag === "r072e055") setRoad((m) => { m.roughness = 0.72; m.envMapIntensity = 0.55; });
  else if (tag === "r075e045") setRoad((m) => { m.roughness = 0.75; m.envMapIntensity = 0.45; });
  else if (tag === "allOff") { setBeams(false); setFill(false); setUnder(false); setRoad((m) => (m.envMapIntensity = 0.25)); }
  g.renderFrame();
  return "mode " + tag + " applied";
};

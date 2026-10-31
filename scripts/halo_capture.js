// Halo repro capture — installed once per page, then driven stepwise from bash
// (each __haloCap(k) call is a SHORT eval: SwiftShader renders twice per step,
// a long single eval trips Chrome's unresponsive-renderer recovery).
// Camera = the REAL rig (g.cameraRig.update) so captures show exactly the
// gameplay chase view; every 4th step forces nitro, steps 16-17 force a brake
// burst, steps 7 & 15 add a rear-view capture (AI cars behind us with their
// additive cones/tail quads).
window.__shots = null;
window.__haloInit = () => {
  const g = window.__game;
  if (!g) return "nogame";
  const r = g.renderer;
  const gl = r.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  window.__shots = [];
  window.__grab = (meta, rear) => {
    const px = new Uint8Array(4 * W * H);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // readPixels is bottom-up; flip + downscale to 384-wide for analysis
    const src = document.createElement("canvas"); src.width = W; src.height = H;
    const sctx = src.getContext("2d");
    const img = sctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray(4 * W * (H - 1 - y), 4 * W * (H - y)), 4 * W * y);
    sctx.putImageData(img, 0, 0);
    const dw = 384, dh = Math.round(384 * H / W);
    const dst = document.createElement("canvas"); dst.width = dw; dst.height = dh;
    dst.getContext("2d").drawImage(src, 0, 0, dw, dh);
    window.__shots.push({ b64: dst.toDataURL("image/png").split(",")[1], meta, rear });
  };
  // fast-forward the countdown: debugTick renders ONCE per call, so ONE call
  // with many steps beats a render-per-60-steps loop
  let guard = 0;
  while (g.phase !== "racing" && guard++ < 6) g.debugTick(300, { autoSteer: true });
  return "phase=" + g.phase;
};
window.__haloCap = (k) => {
  const g = window.__game;
  if (!g || !window.__grab) return "nogame";
  const nitro = k % 4 === 3;
  const brake = k === 16 || k === 17;
  const c = g.player.controls;
  g.debugTick(132, { autoSteer: true }); // 2.2 s sim (autoSteer sets throttle/steer)
  if (nitro) c.nitro = true;
  if (brake) { c.throttle = 0; c.brake = 1; }
  if (nitro || brake) g.debugTick(12, { autoSteer: false, throttle: brake ? 0 : 1 });
  const p = g.player;
  g.cameraRig.update(1 / 60, p); // exact gameplay chase cam
  g.renderFrame();
  const meta = {
    k, t: +(k * 2.2).toFixed(1), speed: Math.round(p.speed * 3.6),
    nitro, brake, phase: g.phase,
    pos: [Math.round(p.pos.x), Math.round(p.pos.z)],
  };
  window.__grab(meta, false);
  if (k === 7 || k === 15) {
    // rear view: stand ahead of the car, look back down the road — this is
    // where a chasing AI car's additive head-cone would frame OUR car
    const fwd = p.forward;
    g.camera.position.set(p.pos.x + fwd.x * 9, p.pos.y + 2.6, p.pos.z + fwd.z * 9);
    g.camera.lookAt(p.pos.x, p.pos.y + 0.6, p.pos.z);
    g.renderFrame();
    window.__grab({ ...meta, rear: true }, true);
  }
  return "cap " + k + " ok (" + window.__shots.length + " shots)";
};

// Clean same-task A/B of the speed-blur chain, computed fully in-page.
// Both frames are captured inside ONE eval (no rAF interleaving) so the
// only difference is the post chain — streak meshes, scene, HUD-free.
(() => {
  const g = window.__game;
  if (!g) return "NO-GAME";
  const cv = [...document.querySelectorAll("canvas")].sort(
    (a, b) => b.width * b.height - a.width * a.height)[0];
  const W = cv.width, H = cv.height;

  // force a solid slam strength — the frozen state may have decayed
  const sOn = Math.max(g.speedFX.strength, 0.85);
  g.cameraRig.tuning.drama = 1;

  const shoot = () => { g.renderFrame(); return cv.toDataURL("image/png"); };

  g.cameraRig.tuning.drama = 1; g.speedBlurLevel = sOn; g.speedFX.setStrength(sOn);
  const A = shoot();                                   // chain ON
  g.cameraRig.tuning.drama = 0; g.speedBlurLevel = 0; g.speedFX.setStrength(0);
  const B = shoot();                                   // direct render, same scene+streaks
  g.cameraRig.tuning.drama = 1; g.speedBlurLevel = sOn; g.speedFX.setStrength(sOn);
  g.renderFrame();                                     // restore the slam on screen

  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });

  const stat = (d) => {
    const c = { center: [0, 0], mid: [0, 0], periphery: [0, 0] };
    const lum = (x, y) => { const o = (y * W + x) * 4; return 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]; };
    for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
      const e = Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
      const r = Math.sqrt(((x - (W - 1) / 2) / ((W - 1) / 2)) ** 2 + ((y - (H - 1) / 2) / ((H - 1) / 2)) ** 2);
      const k = r < 0.35 ? "center" : r < 0.7 ? "mid" : "periphery";
      c[k][0] += e; c[k][1]++;
    }
    return c;
  };

  return load(A).then(async (ia) => {
    const ib = await load(B);
    const mk = (img) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, W, H).data; };
    const a = stat(mk(ia)), b = stat(mk(ib));
    const out = {};
    for (const k of ["center", "mid", "periphery"]) out[k] = +(((a[k][0] / a[k][1]) / (b[k][0] / b[k][1])) * 100 - 100).toFixed(1);
    window.__ab = { A, B, out };
    return JSON.stringify({ strength: sOn.toFixed(3), A_minus_B_deltaPct: out });
  });
})()

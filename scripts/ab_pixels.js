// Sample pixel colors from both A/B frames at key spots to identify the
// systematic chain-vs-direct difference (exposure? gamma? AA? nothing?)
(() => {
  const ab = window.__ab;
  if (!ab) return "NO-AB";
  const g = window.__game;
  const cv = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const W = cv.width, H = cv.height;
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });

  // spots as fractions of the frame: [x, y, label]
  const spots = [
    [0.5, 0.08, "top-sky"],
    [0.5, 0.5, "center-road"],
    [0.25, 0.35, "left-building-band"],
    [0.75, 0.35, "right-building-band"],
    [0.15, 0.9, "bottom-left-road"],
    [0.85, 0.9, "bottom-right-road"],
    [0.5, 0.72, "near-road"],
  ];

  const readAt = (img) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const out = {};
    for (const [fx, fy, label] of spots) {
      const px = Math.round(fx * (W - 1)), py = Math.round(fy * (H - 1));
      // average a 3x3 patch to dodge AA noise
      const d = x.getImageData(px - 1, py - 1, 3, 3).data;
      let r = 0, gg = 0, b = 0;
      for (let i = 0; i < 9; i++) { r += d[i * 4]; gg += d[i * 4 + 1]; b += d[i * 4 + 2]; }
      out[label] = [Math.round(r / 9), Math.round(gg / 9), Math.round(b / 9)];
    }
    return out;
  };

  return load(ab.A).then(async (ia) => {
    const ib = await load(ab.B);
    const a = readAt(ia), b = readAt(ib);
    const report = {};
    for (const k of Object.keys(a)) {
      const [r1, g1, b1] = a[k], [r2, g2, b2] = b[k];
      const lumA = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
      const lumB = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
      report[k] = { A: a[k], B: b[k], ratioAB: +(lumB / Math.max(lumA, 1)).toFixed(3) };
    }
    return JSON.stringify({ W, H, report });
  }).catch((e) => "ERR " + e);
})()

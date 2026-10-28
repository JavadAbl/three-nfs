// Corner-region pixel check: is the vignette + corner smear measurably
// present in A (chain @ 0.85 + nitro) vs B (direct)?
(() => {
  const ab = window.__ab;
  if (!ab) return "NO-AB";
  const cv = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const W = cv.width, H = cv.height;
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const corner = (img, fx, fy) => {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const px = Math.round(fx * (W - 1)), py = Math.round(fy * (H - 1));
    const d = x.getImageData(px - 2, py - 2, 5, 5).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 25; i++) { r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
    return [Math.round(r / 25), Math.round(g / 25), Math.round(b / 25)];
  };
  const spots = [[0.04, 0.06, "TL"], [0.96, 0.06, "TR"], [0.04, 0.94, "BL"], [0.96, 0.94, "BR"]];
  return load(ab.A).then(async (ia) => {
    const ib = await load(ab.B);
    const out = {};
    for (const [fx, fy, k] of spots) {
      const A = corner(ia, fx, fy), B = corner(ib, fx, fy);
      const lA = 0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2];
      const lB = 0.299 * B[0] + 0.587 * B[1] + 0.114 * B[2];
      out[k] = { A, B, "B_lum/A_lum": +(lB / Math.max(lA, 1)).toFixed(3) };
    }
    return JSON.stringify(out);
  });
})()

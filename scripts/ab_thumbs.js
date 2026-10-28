// Pull the A/B frames from window.__ab as small JPEG thumbs (fit in eval output)
// so they can be inspected offline. Returns compact JSON with both dataURLs.
(() => {
  const ab = window.__ab;
  if (!ab) return "NO-AB";
  const tw = 320, th = Math.round(320 * (innerHeight / innerWidth) || 144);
  const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
  const thumb = (img) => {
    const c = document.createElement("canvas");
    c.width = tw; c.height = th;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, tw, th);
    return c.toDataURL("image/jpeg", 0.72);
  };
  return load(ab.A).then(async (ia) => {
    const ib = await load(ab.B);
    return JSON.stringify({ A: thumb(ia).length < 26000 ? thumb(ia) : "TOO-BIG", B: thumb(ib) });
  }).catch((e) => "ERR " + e);
})()

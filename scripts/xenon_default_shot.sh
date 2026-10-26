#!/bin/bash
# One-off: capture the NEW spawn default (xenon, no __nightFx toggle touched)
# as public/xenon_default.png — proves the default wiring visually, alongside
# the 1ecf785 compare set. Same proven v7 rules as cmp_capture.sh:
#  - camset → render → readPixels in ONE eval (fresh frame)
#  - paint to a DOM overlay canvas, then browser-screenshot the DOM
# Session must already be sitting in a live night race (DOWNTOWN NEON).
set -u
SESS=${SESS:-xndefault}
DIR=/home/z/my-project/public

agent-browser --session $SESS eval "(() => { if (!document.getElementById('__cmpOut')) { const o = document.createElement('canvas'); o.id = '__cmpOut'; o.width = 480; o.height = 320; o.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none'; document.body.appendChild(o); } return 'overlay ok'; })()" >/dev/null

echo "── render default-xenon frame in ONE eval (no toggles!) ──"
agent-browser --session $SESS eval "(() => {
  const G = window.__nightFx.game;
  const gl = G.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const c = G.player; const hh = c.heading;
  const fv = Math.sin(hh), fw = Math.cos(hh), rv = Math.cos(hh), rw = -Math.sin(hh);
  const cam = G.camera;
  cam.position.set(c.pos.x + fv*5.5 + rv*3.6, c.pos.y + 1.0, c.pos.z + fw*5.5 + rw*3.6);
  cam.lookAt(c.pos.x, c.pos.y + 0.38, c.pos.z);
  G.renderer.setRenderTarget(null);
  G.renderer.render(G.scene, cam);
  const px = new Uint8Array(4 * W * H);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const row = 4 * W;
  for (let y = 0; y < H / 2; y++) { const a = y * row, b = (H-1-y) * row; const tmp = px.slice(a, a + row); px.set(px.subarray(b, b + row), a); px.set(tmp, b); }
  window.__frame = px;
  let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] + px[i+1] + px[i+2];
  return 'frame sum: ' + s + ' (' + W + 'x' + H + ')';
})()"

echo "── paint + screenshot ──"
agent-browser --session $SESS eval "(() => { const out = document.getElementById('__cmpOut'); const ctx = out.getContext('2d'); ctx.putImageData(new ImageData(new Uint8ClampedArray(window.__frame.buffer), 480, 320), 0, 0); return 'painted'; })()"
agent-browser --session $SESS screenshot "$DIR/xenon_default.png" >/dev/null && echo "  → $DIR/xenon_default.png"

agent-browser --session $SESS eval "document.getElementById('__cmpOut').remove(); window.__frame = null; 'clean'" >/dev/null
echo done

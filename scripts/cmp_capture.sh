#!/bin/bash
# Lamp-style compare capture v7.
# Proven-safe structure (empirically derived the hard way):
#  - setXenon() must NEVER be called between a camera op and the render —
#    it silently kills the underglow toggle for that render (SwiftShader/three
#    quirk). Safe: setXenon → camset → glowToggle → render → readPixels.
#  - all variants in ONE eval (same-eval reads are fresh; cross-eval stale)
#  - frames stored as Uint8Arrays; painted to a 2D overlay for screenshots
#    (DOM paints are always fresh for browser screenshots)
# Angles: front 3/4 (headlight compare) + LOW front 3/4 (underglow compare).
set -u
SESS=${SESS:-v6}
DIR=/home/z/my-project/public

agent-browser --session $SESS eval "(() => { if (!document.getElementById('__cmpOut')) { const o = document.createElement('canvas'); o.id = '__cmpOut'; o.width = 480; o.height = 320; o.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none'; document.body.appendChild(o); } return 'overlay ok'; })()" >/dev/null

echo "── render all 8 variants in ONE eval ──"
agent-browser --session $SESS eval "(() => {
  const fx = window.__nightFx; const G = fx.game;
  const gl = G.renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const c = G.player; const hh = c.heading;
  const fv = Math.sin(hh), fw = Math.cos(hh), rv = Math.cos(hh), rw = -Math.sin(hh);
  const cam = G.camera;
  const camset = (m) => {
    if (m === 'front') cam.position.set(c.pos.x + fv*5.5 + rv*3.6, c.pos.y + 1.0, c.pos.z + fw*5.5 + rw*3.6);
    else cam.position.set(c.pos.x + fv*5.2 + rv*3.4, c.pos.y + 0.5, c.pos.z + fw*5.2 + rw*3.4);
    cam.lookAt(c.pos.x, c.pos.y + 0.38, c.pos.z);
    G.renderer.setRenderTarget(null); G.renderer.render(G.scene, cam);
  };
  const cfg = [  // [xenon, glow, cam, name]
    [false, true,  'front', 'hal_glow_f'],
    [false, false, 'front', 'hal_noglow_f'],
    [false, true,  'low',   'hal_glow_l'],
    [false, false, 'low',   'hal_noglow_l'],
    [true,  true,  'front', 'xen_glow_f'],
    [true,  false, 'front', 'xen_noglow_f'],
    [true,  true,  'low',   'xen_glow_l'],
    [true,  false, 'low',   'xen_noglow_l'],
  ];
  window.__frames = []; window.__names = [];
  const sums = [];
  let curXenon = null;
  for (const [x, g, m, name] of cfg) {
    if (x !== curXenon) { fx.setXenon(x); curXenon = x; }  // NEVER after a camset
    camset(m);
    fx.setUnderglow(g);
    G.renderer.render(G.scene, cam);
    const px = new Uint8Array(4 * W * H);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const row = 4 * W;
    for (let y = 0; y < H / 2; y++) { const a = y * row, b = (H-1-y) * row; const tmp = px.slice(a, a + row); px.set(px.subarray(b, b + row), a); px.set(tmp, b); }
    window.__frames.push(px); window.__names.push(name);
    let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] + px[i+1] + px[i+2];
    sums.push(name + ':' + s);
  }
  fx.setXenon(false); fx.setUnderglow(true);
  return sums.join('  ');
})()"

echo "── paint + screenshot each frame (DOM-only) ──"
i=0
for f in front_halogen_glow front_halogen_noglow low_halogen_glow low_halogen_noglow front_xenon_glow front_xenon_noglow low_xenon_glow low_xenon_noglow; do
  agent-browser --session $SESS eval "(() => { const out = document.getElementById('__cmpOut'); const ctx = out.getContext('2d'); if (out.width !== 480 || out.height !== 320) { out.width = 480; out.height = 320; } ctx.putImageData(new ImageData(new Uint8ClampedArray(window.__frames[$i].buffer), 480, 320), 0, 0); return 'painted $i ' + window.__names[$i]; })()" | sed 's/^/  /'
  agent-browser --session $SESS screenshot "$DIR/$f.png" >/dev/null && echo "  → $f.png"
  i=$((i+1))
done

agent-browser --session $SESS eval "document.getElementById('__cmpOut').remove(); window.__frames = null; 'clean'" >/dev/null
echo done

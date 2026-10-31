// ─── PerfHUD: dev overlay answering "where does the frame time go?" ─────────
// Toggle: F8 (or `). Shown by default only in development builds.
//
// What each number means:
//   FRAME  ms between rAF ticks (target: 16.7 @60Hz / 8.3 @120Hz); p95 = worst frames
//   JS SIM ms of pure JavaScript per frame (physics, AI, collisions, camera…)
//   ISSUE  ms the CPU spends INSIDE renderer.render() — validating state and
//          issuing draw calls to the driver (NOT the GPU execution time; that
//          happens async and can only be seen in chrome://tracing / DevTools)
//   CALLS  draw calls issued this frame (renderer.info.render.calls)
//
// Reading the verdict:
//   GPU-bound / vsync-capped → main thread is mostly idle; the GPU (or the
//     display refresh) is the limit. Lower resolution, shadows, or geometry.
//   CPU-bound: render issue  → the JS thread is busy feeding the GPU. Merge
//     static meshes, InstancedMesh, fewer material switches — or WebGPU,
//     whose per-call CPU cost is far lower.
//   CPU-bound: JS simulation → the game logic itself is the limit.
import type { WebGLRenderer } from "three";

interface InfoSnapshot {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

export class PerfHUD {
  private el: HTMLDivElement | null = null;
  private rows = new Map<string, HTMLElement>();
  private visible = false;

  // per-window accumulators (flushed every FLUSH_MS)
  private frames = 0;
  private frameTimes: number[] = [];
  private simAcc = 0;
  private drawAcc = 0;
  private info: InfoSnapshot = { calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
  private windowStart = 0;

  private static readonly FLUSH_MS = 500;
  private static readonly MAX_SAMPLES = 240; // ~4s of samples retained

  constructor(private renderer: WebGLRenderer, startVisible = false) {
    if (startVisible) this.show();
  }

  toggle() {
    this.visible ? this.hide() : this.show();
  }

  /** call once per rendered frame, AFTER renderer.render() (info resets per frame) */
  frame(frameMs: number, simMs: number, drawMs: number) {
    if (!this.visible) return;
    this.frames++;
    this.frameTimes.push(frameMs);
    if (this.frameTimes.length > PerfHUD.MAX_SAMPLES) this.frameTimes.shift();
    this.simAcc += simMs;
    this.drawAcc += drawMs;
    const i = this.renderer.info;
    this.info = {
      calls: i.render.calls,
      triangles: i.render.triangles,
      geometries: i.memory.geometries,
      textures: i.memory.textures,
      programs: i.programs?.length ?? 0,
    };
    const now = performance.now();
    if (now - this.windowStart >= PerfHUD.FLUSH_MS) this.flush(now);
  }

  dispose() {
    this.hide();
  }

  // ─── internals ───────────────────────────────────────────────────────────

  private show() {
    this.visible = true;
    if (!this.el) this.build();
    this.el!.style.display = "block";
    // reset the averaging window so numbers are fresh
    this.frames = 0;
    this.frameTimes = [];
    this.simAcc = 0;
    this.drawAcc = 0;
    this.windowStart = performance.now();
  }

  private hide() {
    this.visible = false;
    if (this.el) this.el.style.display = "none";
  }

  private build() {
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed", "left:12px", "bottom:12px", "z-index:9999",
      "display:none", "pointer-events:none",
      "font:12px/1.5 ui-monospace,'SF Mono',Menlo,Consolas,monospace",
      "color:#dbe4f0", "background:rgba(8,10,14,0.82)",
      "border:1px solid rgba(255,255,255,0.16)", "border-radius:8px",
      "padding:8px 12px 9px", "min-width:215px", "white-space:pre",
      "backdrop-filter:blur(4px)",
    ].join(";");
    const title = document.createElement("div");
    title.textContent = "PERF  ·  F8";
    title.style.cssText = "font-weight:700;letter-spacing:0.14em;color:#93c5fd;margin-bottom:5px";
    el.appendChild(title);
    for (const key of ["fps", "frame", "sim", "issue", "calls", "tris", "mem", "verdict"]) {
      const row = document.createElement("div");
      row.dataset.k = key;
      if (key === "verdict") row.style.cssText = "margin-top:5px;color:#a7f3d0";
      el.appendChild(row);
      this.rows.set(key, row);
    }
    document.body.appendChild(el);
    this.el = el;
  }

  private flush(now: number) {
    if (this.frames === 0) return;
    const elapsedS = (now - this.windowStart) / 1000;
    const fps = this.frames / elapsedS;
    const avgSim = this.simAcc / this.frames;
    const avgDraw = this.drawAcc / this.frames;
    const avgFrame = (elapsedS * 1000) / this.frames;

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? avgFrame;

    const busy = avgSim + avgDraw;
    const load = busy / avgFrame; // fraction of the frame the main thread is busy
    let verdict: string;
    let color: string;
    if (load < 0.7) {
      verdict = `GPU / VSYNC bound — CPU idle ${Math.round((1 - load) * 100)}% of frame`;
      color = "#a7f3d0";
    } else if (avgDraw >= avgSim) {
      verdict = "CPU-bound: render issue (draw calls) → merge/instance";
      color = "#fcd34d";
    } else {
      verdict = "CPU-bound: JS simulation";
      color = "#fcd34d";
    }

    const set = (k: string, text: string) => {
      const r = this.rows.get(k);
      if (r) {
        r.textContent = text;
        if (k === "verdict") r.style.color = color;
      }
    };

    set("fps", `FPS      ${fps.toFixed(0)}${fps < 50 ? "  ⚠" : ""}`);
    set("frame", `FRAME    ${avgFrame.toFixed(1)} ms  (p95 ${p95.toFixed(1)})`);
    set("sim", `JS SIM   ${avgSim.toFixed(1)} ms`);
    set("issue", `ISSUE    ${avgDraw.toFixed(1)} ms  CPU cost of render()`);
    set("calls", `CALLS    ${this.info.calls}  draws/frame`);
    set("tris", `TRIS     ${fmtBig(this.info.triangles)}`);
    set("mem", `MEM      ${this.info.geometries} geo · ${this.info.textures} tex · ${this.info.programs} prog`);
    set("verdict", verdict);

    // reset window
    this.frames = 0;
    this.frameTimes = [];
    this.simAcc = 0;
    this.drawAcc = 0;
    this.windowStart = now;
  }
}

function fmtBig(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

#!/usr/bin/env python3
"""Chrome DevTools performance-trace analyzer (DevTools "Save" JSON or .cpuprofile-style gzip).

Answers the three questions that matter for a WebGL game:
  1. Is the game display-capped (vsync) or actually struggling?  → frame pacing + loop rates
  2. Is the limit the CPU (JS sim / draw-call issue) or the GPU? → main vs GPU utilization
  3. Are there single-frame stalls, and what is inside them?     → long-task autopsy with
     v8-sample attribution (catches shader-compile stalls: getProgramInfoLog, linkProgram…)

Usage:
  python3 analyze_trace.py <trace.json|trace.json.gz> [main_pid_tid_hint]

Notes learned from real traces (2026-10, three-nfs):
  - FPS must be read from the Game loop's FunctionCall series, NOT rAF total —
    devtools overlays (e.g. the minimap) double-count rAF ticks.
  - A single huge "span" value means stray events carry ts≈0: clamp to the
    event-mass window, not [min,max].
  - getProgramInfoLog / linkProgram concentration by second = mid-race shader
    compiles → precompile (renderer.compileAsync warm-up).
  - The one >150 ms long task at t~0 of every DevTools "Save" trace is
    CpuProfiler::StartProfiling — the Record button itself, before the first
    game frame. Don't chase it (autopsy_long_task.py can confirm contents).
  - A FunctionCall showing an absurd dur (seconds) next to a healthy RunTask
    series is a trace-writer quirk, not a real block.
Requires: ijson  (pip install ijson)  — 3 GB RAM handles 145 MB traces.
"""
import sys
import gzip
import collections
import statistics

try:
    import ijson
except ImportError:
    sys.exit("need ijson:  pip install ijson")

path = sys.argv[1] if len(sys.argv) > 1 else "trace.json"


def opener(p, mode="rb"):
    """DevTools 'Save' downloads often carry no .gz suffix — sniff magic bytes."""
    with open(p, "rb") as fh:
        is_gz = fh.read(2) == b"\x1f\x8b"
    return (gzip.open if is_gz else open)(p, mode)

MAIN = None  # (pid, tid) of CrRendererMain — auto-detected
thread_names = {}
proc_names = {}

# ── collections ──
func_calls = []          # (fnName, ts, dur) on main
run_tasks = []           # (ts, dur) on main
gpu_tasks = []           # (ts, dur) any GPU-process thread
main_events = []         # (ts, dur, name) on main
ts_all = []              # every event ts (for the sane window)

# v8 profiler state (persistent node map — nodes defined in early chunks)
node_fn = {}
# STRICT shader-compile family only — "run"/"createTask" are generic v8
# natives that burn ~100 ms/s constantly and drown the real signal
COMPILE_FAMILY = {"getProgramInfoLog", "getShaderInfoLog", "linkProgram", "compileShader",
                  "getParameters", "getProgram", "getShader",
                  "shaderSource", "initMaterials"}
compile_bins = collections.Counter()      # second -> true ms
compile_hits = []                          # (chunk_ts, ms) — binned after the window is known
stall_samples = collections.defaultdict(collections.Counter)  # (ts,dur) -> fn -> n
long_windows = []                         # discovered RunTask > 150 ms on main

with opener(path, "rb") as f:
    for ev in ijson.items(f, "traceEvents.item"):
        pid, tid = ev.get("pid"), ev.get("tid")
        name = ev.get("name", "")
        ts, dur = ev.get("ts"), ev.get("dur")

        if name == "thread_name":
            thread_names[(pid, tid)] = ev.get("args", {}).get("name", "?")
            if ev.get("args", {}).get("name") == "CrRendererMain":
                MAIN = (pid, tid)
        elif name == "process_name":
            proc_names[pid] = ev.get("args", {}).get("name", "?")

        if ts is not None:
            ts_all.append(ts)

        if (pid, tid) == MAIN:
            if name == "FunctionCall":
                fn = ev.get("args", {}).get("data", {}).get("functionName", "?")
                func_calls.append((fn, ts, dur or 0))
            elif name == "RunTask":
                run_tasks.append((ts, dur or 0))
                if (dur or 0) > 150000:
                    long_windows.append((ts, dur))
            if ts is not None and dur:
                main_events.append((ts, dur, name))

        if name == "GPUTask" and dur:
            gpu_tasks.append((ts, dur))

        if name == "ProfileChunk":
            data = ev.get("args", {}).get("data", {})
            prof = data.get("cpuProfile", {})
            for node in prof.get("nodes", []):
                cf = node.get("callFrame", {})
                node_fn[node["id"]] = f"{cf.get('functionName') or '(anon)'} @{(cf.get('url') or 'native').rsplit('/', 1)[-1][:30]}"
            deltas = data.get("timeDeltas", [])
            smp = prof.get("samples", [])
            # deferred binning — the sane time window is only known after the scan
            bin_t0 = ts
            t = data.get("startTime") or ts
            if t is None:
                continue
            for nid, d in zip(smp, deltas):
                d = d or 0
                t += d
                if d <= 0:
                    continue
                fn = node_fn.get(nid, "?")
                if fn.split(" @")[0] in COMPILE_FAMILY:
                    compile_hits.append((bin_t0, d / 1000.0))
                for w in long_windows:
                    if w[0] <= t <= w[0] + w[1]:
                        stall_samples[w][fn] += d / 1000.0

# GPU process pid (events named "GPU Process")
gpu_pid = None
for (pid, tid), nm in thread_names.items():
    pass
for pid, nm in proc_names.items():
    if "GPU" in str(nm):
        gpu_pid = pid
gpu_tasks = [(t, d) for (t, d) in gpu_tasks]  # keep all — cat filter happens by name anyway

# sane time window (drop stray ts≈0 / future ts outliers)
ts_all.sort()
lo, hi = ts_all[len(ts_all) // 200], ts_all[-len(ts_all) // 200]
span_ms = (hi - lo) / 1000
for ts_c, ms in compile_hits:
    compile_bins[int((ts_c - lo) / 1e6)] += ms

# ── loop rates ──
def series_rate(label, ts_list):
    if len(ts_list) < 2:
        print(f"{label:<26} n={len(ts_list)} (insufficient)")
        return None
    span = (ts_list[-1] - ts_list[0]) / 1e6
    ints = [(b - a) / 1000 for a, b in zip(ts_list, ts_list[1:])]
    s = sorted(ints)
    print(f"{label:<26} n={len(ts_list):>5}  span {span:5.1f} s  rate {len(ts_list)/span:6.1f}/s  "
          f"p50 {s[len(s)//2]:5.1f} ms  p95 {s[int(len(s)*0.95)]:5.1f}  max {max(ints):7.1f}")
    return ints

print(f"=== {path} — event window {span_ms/1000:.1f} s ===")
print(f"main thread: {MAIN}  gpu pid: {gpu_pid}  processes: {proc_names}")
print()

loops = collections.defaultdict(list)
for fn, ts, dur in func_calls:
    if fn and fn not in ("?", ""):
        loops[fn].append(ts)
# pick the actual game loop: prefer a Game-named series, else the longest-span
# stable series (30-240 Hz); dispatchEvent spam never qualifies
cands = [(fn, ts_list) for fn, ts_list in loops.items() if len(ts_list) > 30]
game_series = None
for fn, ts_list in cands:
    span_s = (ts_list[-1] - ts_list[0]) / 1e6
    rate = len(ts_list) / span_s if span_s else 0
    score = (1000 if "game" in fn.lower() or "loop" in fn.lower() else 0) + span_s + (30 <= rate <= 240) * 50
    if game_series is None or score > game_series[2]:
        game_series = (fn, ts_list, score)
print("\n=== JS entry-point series rates ===")
for fn, ts_list in sorted(cands, key=lambda kv: -len(kv[1]))[:6]:
    series_rate(fn[:26], ts_list)

# ── utilization over the game-loop window ──
if game_series:
    g0, g1 = game_series[1][0], game_series[1][-1]
    race_ms = (g1 - g0) / 1000
    mt_busy = sum(d for t, d in run_tasks if g0 <= t <= g1) / 1000
    gpu_ms = sum(d for t, d in gpu_tasks if g0 <= t <= g1) / 1000
    print(f"\n=== utilization during {game_series[0]} ({race_ms/1000:.1f} s) ===")
    print(f"  main thread : {mt_busy:7.0f} ms busy  = {mt_busy/race_ms*100:5.1f}%")
    print(f"  gpu process : {gpu_ms:7.0f} ms busy  = {gpu_ms/race_ms*100:5.1f}%")
    print(f"\n  verdict     : {'GPU / vsync-capped — headroom everywhere' if mt_busy/race_ms < 0.6 and gpu_ms/race_ms < 0.8 else 'CPU or GPU saturated — see breakdowns below'}")

# ── FunctionCall totals ──
fc = collections.Counter(); fcc = collections.Counter()
for fn, ts, d in func_calls:
    fc[fn] += d; fcc[fn] += 1
print("\n=== JS entry points (total ms) ===")
for fn, d in fc.most_common(8):
    print(f"  {d/1000:8.1f} ms in {fcc[fn]:>5} calls  {fn[:52]}")

# ── long tasks / stalls ──
big = sorted(run_tasks, key=lambda x: -x[1])[:5]
print(f"\n=== long tasks on main (>50 ms) — top {len([1 for _,d in run_tasks if d>50000])} total ===")
for bts, bdur in big:
    print(f"\n— stall {bdur/1000:.0f} ms @ t+{(bts-lo)/1e6:.1f} s —")
    hits = stall_samples.get((bts, bdur))
    if hits:
        for fn, ms in hits.most_common(8):
            print(f"     {ms:7.1f} ms  {fn[:64]}")
    else:
        print("     (no v8 samples captured inside)")

# ── compile-family concentration ──
if compile_bins:
    print("\n=== shader-compile family time by second (true ms) ===")
    peak = max(compile_bins.values()) or 1
    for sec in sorted(compile_bins):
        v = compile_bins[sec]
        print(f"   t={sec:>4} s: {v:7.0f} ms  {'█' * max(1, int(v * 40 / peak))}")

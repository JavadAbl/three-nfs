#!/usr/bin/env python3
"""Autopsy every >150 ms main-thread long task in a DevTools "Save" trace.

Companion to analyze_trace.py: the analyzer flags stalls and gives v8-sample
attribution when the profiler caught them; this one shows the raw nested
trace-event names inside each window instead — useful when a stall has no
v8 samples (e.g. the t~0 CpuProfiler::StartProfiling Record-button artifact,
which shows up as EvaluateScript + V8.InvokeApiInterruptCallbacks nesting).

Usage:
  python3 autopsy_long_task.py <trace.json|trace.json.gz>

Prints, per >150 ms RunTask window: top nested event names (true ms),
overlapping JS entry points, the first Game.loop call relative to the stall,
and the biggest individual events inside.
"""
import sys, gzip, collections
import ijson

path = sys.argv[1] if len(sys.argv) > 1 else "trace.json"


def opener(p, mode="rb"):
    """DevTools 'Save' downloads often carry no .gz suffix — sniff magic bytes."""
    with open(p, "rb") as fh:
        is_gz = fh.read(2) == b"\x1f\x8b"
    return (gzip.open if is_gz else open)(p, mode)

MAIN = None
long_windows = []        # RunTask (ts, dur) > 150 ms on main
main_events = []         # (ts, dur, name) main thread only
func_calls = []          # (fn, ts, dur)
ts_all = []

with opener(path, "rb") as f:
    for ev in ijson.items(f, "traceEvents.item"):
        pid, tid = ev.get("pid"), ev.get("tid")
        name = ev.get("name", "")
        ts, dur = ev.get("ts"), ev.get("dur")
        if name == "thread_name" and ev.get("args", {}).get("name") == "CrRendererMain":
            MAIN = (pid, tid)
        if ts is not None:
            ts_all.append(ts)
        if (pid, tid) == MAIN:
            if ts is not None and dur:
                main_events.append((ts, dur, name))
                if name == "RunTask" and dur > 150000:
                    long_windows.append((ts, dur))
            if name == "FunctionCall":
                func_calls.append((ev.get("args", {}).get("data", {}).get("functionName", "?"), ts, dur or 0))

ts_all.sort()
lo = ts_all[len(ts_all) // 200]

print(f"long windows >150ms on main: {[( (t-lo)/1e6, d/1000 ) for t, d in long_windows]}")

for wts, wdur in long_windows:
    w0, w1 = wts, wts + wdur
    print(f"\n=== stall {wdur/1000:.0f} ms @ t+{(wts-lo)/1e6:.1f} s ===")
    # top event names fully/partially inside
    inside = [(t, d, n) for (t, d, n) in main_events if t < w1 and t + d > w0 and n != "RunTask"]
    agg = collections.Counter()
    for t, d, n in inside:
        agg[n] += d / 1000
    print("  top nested event names (true ms):")
    for n, ms in agg.most_common(12):
        print(f"    {ms:8.1f}  {n[:70]}")
    # FunctionCalls inside
    fc_in = [(fn, d) for fn, t, d in func_calls if t < w1 and t + d > w0 and fn not in ("?", "")]
    print("  FunctionCalls overlapping:")
    for fn, d in sorted(fc_in, key=lambda x: -x[1])[:10]:
        print(f"    {d/1000:8.1f}  {fn[:70]}")
    # where is the first Game.loop relative to this stall?
    loops = sorted(t for fn, t, d in func_calls if fn == "Game.loop")
    if loops:
        print(f"  first Game.loop @ t+{(loops[0]-lo)/1e6:.1f} s "
              f"({'inside stall' if w0 <= loops[0] <= w1 else 'after stall'} "
              f"-> {1000*(loops[0]-w0)/1e6:.0f} ms after stall start)")
    # biggest leaf inside
    leafs = sorted(inside, key=lambda x: -x[1])[:8]
    print("  biggest individual events inside:")
    for t, d, n in leafs:
        print(f"    {d/1000:8.1f}  {n[:60]}  @+{(t-w0)/1000:.0f} ms")

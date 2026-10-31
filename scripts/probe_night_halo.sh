#!/bin/bash
# Halo repro — deterministic headless capture (works on SwiftShader):
#   ?start=quick&map=$MAP boots the race past the wedging menu wizard,
#   __haloInit fast-forwards the countdown, then 18 stepwise captures with
#   the REAL chase rig + readPixels (2 renders per step, short evals so the
#   renderer never trips Chrome's unresponsive-tab recovery).
# Results: /tmp/halo/shot_<k>[_rear].png + telemetry.txt
set -u
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-halohunt}
OUT=/tmp/halo
MAP=${MAP:-downtown}
mkdir -p "$OUT"; rm -f "$OUT"/*.png "$OUT"/telemetry.txt 2>/dev/null
cd /home/z/my-project

agent-browser close >/dev/null 2>&1
agent-browser set viewport 640 304 >/dev/null 2>&1
agent-browser open "http://localhost:3000/?start=quick&map=$MAP&name=PROBE" >/dev/null 2>&1
sleep 8

# wait for the Game (boot preload is cached after the first ever run)
for i in $(seq 1 30); do
  PH=$(agent-browser eval "window.__game ? window.__game.phase : 'nogame'" 2>/dev/null | tr -d '"')
  [ "$PH" != "nogame" ] && break
  sleep 4
done
echo "boot phase: $PH"

agent-browser eval "$(cat scripts/halo_capture.js)" >/dev/null 2>&1
agent-browser eval "window.__haloInit()" 2>&1 | tr -d '"'

for k in $(seq 0 17); do
  agent-browser eval "window.__haloCap($k)" 2>/dev/null | tr -d '"'
  sleep 1
done

# dump the banked frames
N=$(agent-browser eval "window.__shots.length" 2>/dev/null | tr -d '"')
echo "shots: $N"
for i in $(seq 0 $((N > 0 ? N - 1 : 0))); do
  agent-browser eval "window.__shots[$i].b64" 2>/dev/null | tr -d '"' > "$OUT/.b64_$i"
  base64 -d "$OUT/.b64_$i" > "$OUT/shot_$(printf %02d $i).png" 2>/dev/null
  rm -f "$OUT/.b64_$i"
done
agent-browser eval "JSON.stringify(window.__shots.map(s => s.meta))" 2>/dev/null | tr -d '"' > "$OUT/telemetry.txt"
ls "$OUT"/*.png 2>/dev/null | wc -l

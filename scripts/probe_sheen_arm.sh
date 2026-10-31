#!/bin/bash
# One candidate arm's full 24-position sweep, wedge-proof:
#   - fast-forward in SHORT evals (__sheenTick), never one long eval
#   - verify the road material readback matches the tag's expected values
#     (async PBR texture callbacks can clobber scalars on a fresh page)
#   usage: bash probe_sheen_arm.sh <tag> [start_k]
set -u
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-sheenhunt}
TAG=${1:?tag}
START=${2:-0}
OUT=/tmp/sheen_fix/$TAG
MAP=${MAP:-downtown}
case "$TAG" in
  base)      WANT="0.72/0.55";;
  oldBase)   WANT="0.50/0.85";;
  r065e085)  WANT="0.65/0.85";;
  r072e055)  WANT="0.72/0.55";;
  r075e045)  WANT="0.75/0.45";;
  *) echo "unknown tag $TAG"; exit 1;;
esac
mkdir -p "$OUT"
cd /home/z/my-project

agent-browser close >/dev/null 2>&1
agent-browser set viewport 640 304 >/dev/null 2>&1
agent-browser open "http://localhost:3000/?start=quick&map=$MAP&name=PROBE" >/dev/null 2>&1
sleep 8

PH=nogame
for i in $(seq 1 40); do
  PH=$(agent-browser eval "window.__game ? window.__game.phase : 'nogame'" 2>/dev/null | tr -d '"')
  [ "$PH" != "nogame" ] && break
  sleep 4
done
echo "boot phase: $PH"
agent-browser eval "$(cat scripts/sheen_capture.js)" >/dev/null 2>&1

# incremental fast-forward: one short eval per step
for i in $(seq 1 40); do
  R=$(agent-browser eval "window.__sheenTick()" 2>/dev/null | tr -d '"')
  [ "$R" = "racing" ] && break
  sleep 1
done
echo "tick loop end: $R"

agent-browser eval "window.__sheenMode('$TAG')" 2>/dev/null | tr -d '"'
sleep 2
# re-apply (async texture callbacks may have landed in between) + read back
agent-browser eval "window.__sheenMode('$TAG')" 2>/dev/null | tr -d '"'
ROAD=$(agent-browser eval "(function(){ let r='none'; window.__game.scene.traverse(o=>{ if(o.name==='road'&&o.material) r=o.material.roughness.toFixed(2)+'/'+o.material.envMapIntensity.toFixed(2); }); return r; })()" 2>/dev/null | tr -d '"')
echo "road roughness/env AFTER mode: $ROAD (want $WANT)"
if [ "$ROAD" != "$WANT" ]; then
  echo "FATAL: mode did not stick — aborting, shots not trustworthy"
  exit 1
fi

for k in $(seq "$START" 23); do
  agent-browser eval "window.__shots=null, window.__sheenSweep($k)" 2>/dev/null | tr -d '"'
  agent-browser eval "window.__shots[0].b64" 2>/dev/null | tr -d '"' | base64 -d > "$OUT/shot_$(printf %02d $k).png" 2>/dev/null
done
echo "$TAG: sweep $START..23 done ($(ls $OUT/*.png 2>/dev/null | wc -l) shots total)"
python3 scripts/analyze_halo_shots.py "$OUT/*.png" 2>/dev/null | sort -rn | head -5

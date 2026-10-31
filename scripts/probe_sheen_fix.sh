#!/bin/bash
# Candidate-fix verification — full 24-position sweep per candidate arm.
# A candidate PASSES if no sweep position yields a hard-edged bright blob
# (luma>170 connected component of size >= 24) anywhere in the bottom band.
set -u
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-sheenhunt}
OUT=/tmp/sheen_fix
MAP=${MAP:-downtown}
mkdir -p "$OUT"; rm -rf "$OUT"/*
cd /home/z/my-project

agent-browser close >/dev/null 2>&1
agent-browser set viewport 640 304 >/dev/null 2>&1
agent-browser open "http://localhost:3000/?start=quick&map=$MAP&name=PROBE" >/dev/null 2>&1
sleep 8

PH=nogame
for i in $(seq 1 30); do
  PH=$(agent-browser eval "window.__game ? window.__game.phase : 'nogame'" 2>/dev/null | tr -d '"')
  [ "$PH" != "nogame" ] && break
  sleep 4
done
echo "boot phase: $PH"

agent-browser eval "$(cat scripts/sheen_capture.js)" >/dev/null 2>&1
agent-browser eval "window.__sheenInit()" 2>&1 | tr -d '"'

for tag in base r065e085 r072e055 r075e045; do
  agent-browser eval "window.__sheenMode('$tag')" 2>/dev/null | tr -d '"'
  mkdir -p "$OUT/$tag"
  for k in $(seq 0 23); do
    agent-browser eval "window.__shots=null, window.__sheenSweep($k)" 2>/dev/null | tr -d '"'
    agent-browser eval "window.__shots[0].b64" 2>/dev/null | tr -d '"' | base64 -d > "$OUT/$tag/shot_$(printf %02d $k).png" 2>/dev/null
  done
  echo "$tag: sweep done"
done
echo "ALL SWEEPS DONE"
for tag in base r065e085 r072e055 r075e045; do
  echo "== $tag =="
  python3 scripts/analyze_halo_shots.py "$OUT/$tag/*.png" 2>/dev/null | sort -rn | head -5
done

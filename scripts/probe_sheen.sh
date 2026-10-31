#!/bin/bash
# Wet-road sheen/halo hunt — orchestrates sheen_capture.js under agent-browser.
#   phase 1: 24-position camera sweep around the frozen car (baseline)
#   phase 2: FX bisection (beamsOff / fillOff / envLow / roughHigh /
#            underglowOff / allOff) re-captured at the worst sweep position
# Output: /tmp/sheen/<pass>/shot_*.png + scores via analyze_halo_shots.py
set -u
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-sheenhunt}
OUT=/tmp/sheen
MAP=${MAP:-downtown}
mkdir -p "$OUT"
rm -rf "$OUT"/*
cd /home/z/my-project

dump_shots() { # $1 = subdir
  local dir="$OUT/$1"; mkdir -p "$dir"
  local N
  N=$(agent-browser eval "window.__shots.length" 2>/dev/null | tr -d '"')
  [ -z "$N" ] || [ "$N" = "undefined" ] && { echo "no shots for $1"; return; }
  for i in $(seq 0 $((N - 1))); do
    agent-browser eval "window.__shots[$i].b64" 2>/dev/null | tr -d '"' | base64 -d > "$dir/shot_$(printf %02d $i).png" 2>/dev/null
  done
  agent-browser eval "JSON.stringify(window.__shots.map(s => s.meta))" 2>/dev/null | tr -d '"' | python3 -c "import sys,json; [print(i, json.loads(m)) for i,m in enumerate(json.load(sys.stdin) if False else [])]" 2>/dev/null
  agent-browser eval "JSON.stringify(window.__shots.map(s => s.meta))" 2>/dev/null | tr -d '"' > "$dir/telemetry.json"
  echo "$1: $N shots -> $dir"
}

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
echo ""

echo "=== phase 1: baseline sweep (24 positions) ==="
for k in $(seq 0 23); do
  agent-browser eval "window.__shots=null, window.__sheenSweep($k)" 2>/dev/null | tr -d '"'
  # one shot per position: dump immediately to keep bash state simple
  mkdir -p "$OUT/base"
  agent-browser eval "window.__shots[0].b64" 2>/dev/null | tr -d '"' | base64 -d > "$OUT/base/shot_$(printf %02d $k).png" 2>/dev/null
done
agent-browser eval "JSON.stringify([window.__lastMeta])" >/dev/null 2>&1
echo "sweep done"
python3 scripts/analyze_halo_shots.py "$OUT/base/*.png" | sort -rn | head -8 > "$OUT/base_scores.txt"
cat "$OUT/base_scores.txt"

echo ""
echo "=== phase 2: FX bisection at worst positions ==="
# worst = highest score line; extract filename
WORST=$(head -1 "$OUT/base_scores.txt" | grep -o 'shot_[0-9]*\.png' | head -1)
KW=$(echo "$WORST" | grep -o '[0-9]*' | head -1)
K1=$(( (KW + 1) % 24 )); K2=$(( (KW + 23) % 24 ))
echo "worst: $WORST (k=$KW) + neighbours $K1/$K2"
for tag in beamsOff fillOff envLow roughHigh underglowOff allOff; do
  agent-browser eval "window.__sheenMode('$tag')" 2>/dev/null | tr -d '"'
  mkdir -p "$OUT/$tag"
  for k in $KW $K1 $K2; do
    agent-browser eval "window.__shots=null, window.__sheenSweep($k)" 2>/dev/null | tr -d '"'
    agent-browser eval "window.__shots[0].b64" 2>/dev/null | tr -d '"' | base64 -d > "$OUT/$tag/shot_$(printf %02d $k).png" 2>/dev/null
  done
done
echo "bisection captures done"

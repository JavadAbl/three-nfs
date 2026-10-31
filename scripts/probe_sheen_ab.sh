#!/bin/bash
# Single-session A/B: same page, same car position, same road patch.
# base sweep first (identifies which of the probe angles blob HERE), then
# each candidate arm re-sweeps exactly those angles, with material readback
# verification. Cross-session comparisons are invalid — the freeze point and
# the road's roughness patches differ per session.
set -u
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-sheenhunt}
OUT=/tmp/sheen_ab
MAP=${MAP:-downtown}
mkdir -p "$OUT"; rm -rf "$OUT"/*
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

R=nogame
for i in $(seq 1 40); do
  R=$(agent-browser eval "window.__sheenTick()" 2>/dev/null | tr -d '"')
  [ "$R" = "racing" ] && break
  sleep 1
done
echo "tick loop end: $R"
# drive on a bit — land on a mid-straight patch away from the start line
agent-browser eval "(function(){ const g=window.__game; const c=g.player.controls; c.throttle=1; c.brake=0; c.nitro=false; c.steer=0; g.debugTick(160,{autoSteer:false}); return 'driven'; })()" 2>/dev/null | tr -d '"'
agent-browser eval "(function(){ const g=window.__game; const c=g.player.controls; c.throttle=0; c.brake=0; c.nitro=false; c.steer=0; g.debugTick(40,{autoSteer:false}); const p=g.player; return 'pos='+Math.round(p.pos.x)+','+Math.round(p.pos.z); })()" 2>/dev/null | tr -d '"'

cap() { # $1 dir, $2... = positions
  local dir="$OUT/$1"; shift; mkdir -p "$dir"
  for k in "$@"; do
    agent-browser eval "window.__shots=null, window.__sheenSweep($k)" 2>/dev/null | tr -d '"'
    agent-browser eval "window.__shots[0].b64" 2>/dev/null | tr -d '"' | base64 -d > "$dir/shot_$(printf %02d $k).png" 2>/dev/null
  done
  echo "$dir: $(ls "$dir"/*.png 2>/dev/null | wc -l) shots"
}

mode() { # $1 tag, $2 want
  agent-browser eval "window.__sheenMode('$1')" 2>/dev/null | tr -d '"'
  sleep 1
  agent-browser eval "window.__sheenMode('$1')" 2>/dev/null | tr -d '"'
  local got
  got=$(agent-browser eval "(function(){ let r='none'; window.__game.scene.traverse(o=>{ if(o.name==='road'&&o.material) r=o.material.roughness.toFixed(2)+'/'+o.material.envMapIntensity.toFixed(2); }); return r; })()" 2>/dev/null | tr -d '"')
  if [ "$got" != "$2" ]; then echo "FATAL: mode $1 readback $got != $2"; exit 1; fi
  echo "mode $1 verified ($got)"
}

PROBES="0 1 2 3 4 5 8 16 19"
mode base "0.50/0.85"
cap base $PROBES

# candidates, most likely ship value first
mode r072e055 "0.72/0.55"
cap r072e055 $PROBES
mode r075e045 "0.75/0.45"
cap r075e045 $PROBES

echo "=== scores ==="
for tag in base r072e055 r075e045; do
  echo "== $tag =="
  python3 scripts/analyze_halo_shots.py "$OUT/$tag/*.png" 2>/dev/null | sort -rn | head -9
done

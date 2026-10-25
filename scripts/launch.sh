#!/bin/bash
# ─── launch.sh — start the Next.js dev server, sweeper-proof ─────────────────
# AGENTS.md §1c: the tool-call harness sweeps bash descendants when a call
# ends. `setsid nohup … &` is STILL A CHILD at sweep time (setsid changes the
# session, not the parent) and dies within seconds. `setsid -f` always forks:
# the server is reparented to init before the call returns and survives
# across tool calls indefinitely. Do NOT "simplify" this back.
#
# Memory: the sandbox cgroup is 4GB. Turbopack RSS ~1.2GB + headless chrome
# (SwiftShader) ~2.4GB with the city loaded = OOM. Cap the heap so a browser
# probe session fits. See AGENTS.md §1c.

set -euo pipefail
cd "$(dirname "$0")/.."

# already up? (dev server responding) → nothing to do
if curl -sf --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then
  echo "dev server already running (http://localhost:3000 → 200)"
  exit 0
fi

# port held by a zombie? free it
if ss -tlnH 2>/dev/null | grep -q ':3000 '; then
  echo "port 3000 busy but not serving — clearing"
  pkill -f "next dev -p 3000" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  sleep 2
fi

: > dev.log
NODE_OPTIONS="--max-old-space-size=1280" setsid -f \
  bash -c 'exec bun run dev </dev/null >>dev.log 2>&1' >/dev/null 2>&1

# wait for readiness (boot compile can take a while on a cold .next)
for i in $(seq 1 60); do
  if curl -sf --max-time 3 -o /dev/null http://localhost:3000/ 2>/dev/null; then
    echo "dev server up after ${i}s: http://localhost:3000 → 200"
    exit 0
  fi
  sleep 1
done

echo "ERROR: dev server not ready in 60s — tail of dev.log:"
tail -20 dev.log
exit 1

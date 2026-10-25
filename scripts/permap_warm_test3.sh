#!/bin/bash
# Final verification: launch SPA '92, confirm the per-map warm fills the SW cache.
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 1
setsid nohup npm run dev > dev.log 2>&1 < /dev/null &
code=000
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server: $code"
[ "$code" != "200" ] && exit 1

COUNT='(async () => { const out = []; for (const k of await caches.keys()) { const c = await caches.open(k); out.push(...(await c.keys()).map(r => r.url)); } const m = out.filter(u => /spa-92|\/ground\/|sunflowers/.test(u)); return JSON.stringify(m.length + " files: " + m.map(u => u.split("/").pop().split("?")[0]).join(", ")); })()'

agent-browser close >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
agent-browser wait --text "QUICK RACE" --timeout 240000 >/dev/null 2>&1
echo "menu up"
agent-browser find role button click --name "QUICK RACE" >/dev/null 2>&1; sleep 1
agent-browser find role button click --name "Select SPA '92" >/dev/null 2>&1; sleep 1
agent-browser find role button click --name "NEXT: PICK RIDE" >/dev/null 2>&1; sleep 2
agent-browser find label "Driver name" fill "TESTER" 2>&1 | tail -1
agent-browser find role button click --name "GO" 2>&1 | tail -1

echo "-- polling warm cache --"
for i in $(seq 1 36); do
  sleep 5
  GOT=$(agent-browser eval "$COUNT" 2>/dev/null | tail -1)
  echo "t=$((i*5))s: $GOT"
  echo "$GOT" | rg -q '"5 files' && break
done

echo "-- network requests for map assets during this session --"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(r => r.name).filter(u => /spa-92|\/ground\/|sunflowers/.test(u)).map(u => u.split('/').pop().split('?')[0]))" 2>/dev/null | tail -1
agent-browser close >/dev/null 2>&1
pkill -f "next dev" 2>/dev/null
echo "--- done ---"

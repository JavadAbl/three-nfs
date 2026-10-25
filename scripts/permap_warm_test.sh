#!/bin/bash
# Verify two-tier loading:
#  1) boot (menu) downloads NO per-map assets (spa scene / ground sets / sky HDR)
#  2) launching SPA '92 warms exactly those files into the SW cache
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
echo "-- waiting for menu (shared-core boot only) --"
agent-browser wait --text "QUICK RACE" --timeout 240000 2>&1 | tail -1

PERF=$(agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').map(r => r.name).filter(u => /spa-92|\/ground\/|sunflowers/.test(u)).length)" 2>/dev/null | tail -1)
echo "menu-time map-asset network requests: $PERF  (expect 0)"
CACHE=$(agent-browser eval "$COUNT" 2>/dev/null | tail -1)
echo "menu-time cached map assets: $CACHE  (expect 0 files)"

echo "-- driving UI: QUICK RACE -> SPA '92 -> name -> GO --"
agent-browser find text "QUICK RACE" click 2>&1 | tail -1
sleep 1
agent-browser find text "SPA '92" click 2>&1 | tail -1
sleep 1
agent-browser find text "NEXT: PICK RIDE" click 2>&1 | tail -1
sleep 2
REF=$(agent-browser snapshot -i 2>/dev/null | rg -o 'ref=e[0-9]+' -N | head -1 | cut -d= -f2)
echo "name textbox ref: $REF"
[ -n "$REF" ] && agent-browser fill "@$REF" "TESTER" 2>&1 | tail -1
agent-browser find role button click --name "GO" 2>&1 | tail -1 || agent-browser find text "GO" click 2>&1 | tail -1

echo "-- waiting for the SPA warm (scene + ground + sky) --"
GOT=""
for i in $(seq 1 30); do
  sleep 5
  GOT=$(agent-browser eval "$COUNT" 2>/dev/null | tail -1)
  echo "t=$((i*5))s warm-cache: $GOT"
  echo "$GOT" | rg -q '"5 files' && break
done

echo "-- boot byte sanity: total asset requests at this point --"
agent-browser eval "JSON.stringify(performance.getEntriesByType('resource').filter(r => /\\/models\\/|\\/textures\\//.test(r.name)).length + ' asset requests total')" 2>/dev/null | tail -1

agent-browser close >/dev/null 2>&1
pkill -f "next dev" 2>/dev/null
echo "--- done ---"

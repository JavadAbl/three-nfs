#!/bin/bash
# Warm verification via SERVER LOG (immune to page main-thread stalls):
# drive menu -> GO on SPA '92 -> watch dev.log for the 5 warm requests.
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; sleep 1
rm -f dev.log
setsid nohup npm run dev > dev.log 2>&1 < /dev/null &
code=000
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server: $code"
[ "$code" != "200" ] && exit 1

agent-browser close >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
agent-browser wait --text "QUICK RACE" --timeout 240000 >/dev/null 2>&1
echo "menu up ($(rg -c 'GET /(models|textures)/' dev.log 2>/dev/null || echo 0) core asset requests from server — rest served by SW)"
agent-browser find role button click --name "QUICK RACE" >/dev/null 2>&1; sleep 1
agent-browser find role button click --name "Select SPA '92" >/dev/null 2>&1; sleep 1
agent-browser find role button click --name "NEXT: PICK RIDE" >/dev/null 2>&1; sleep 2
agent-browser find label "Driver name" fill "TESTER" 2>&1 | tail -1
agent-browser find role button click --name "GO" 2>&1 | tail -1
echo "-- watching dev.log for the SPA warm requests --"
FOUND=0
for i in $(seq 1 60); do
  sleep 5
  SPA=$(rg -c "GET /models/spa/spa-92-scene" dev.log 2>/dev/null || echo 0)
  GRD=$(rg -c "GET /textures/ground/" dev.log 2>/dev/null || echo 0)
  SKY=$(rg -c "GET /models/sky/sunflowers" dev.log 2>/dev/null || echo 0)
  CAR=$(rg -c "GET /models/cars/" dev.log 2>/dev/null || echo 0)
  echo "t=$((i*5))s  spa-scene:$SPA  ground:$GRD  sky:$SKY  cars:$CAR"
  if [ "$SPA" -ge 1 ] && [ "$GRD" -ge 1 ] && [ "$SKY" -ge 1 ]; then
    FOUND=1
    echo "-- WARM FIRED: spa scene + ground + sky all requested after launch --"
    rg -o "GET /(models|textures)/[a-zA-Z0-9/_.-]+" dev.log | sort -u | tail -10
    break
  fi
done
[ "$FOUND" = "0" ] && echo "!! warm did not fire — dumping page state" && agent-browser errors 2>/dev/null | tail -8
agent-browser close >/dev/null 2>&1
pkill -f "next dev" 2>/dev/null
echo "--- done ---"

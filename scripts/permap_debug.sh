#!/bin/bash
# Debug run: drive the menu with snapshots + console error capture at each step.
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

agent-browser close >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
agent-browser wait --text "QUICK RACE" --timeout 240000 >/dev/null 2>&1
echo "=== STEP 0: menu ==="
agent-browser find role button click --name "QUICK RACE" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "Select SPA '92" 2>&1 | tail -1
sleep 1
agent-browser find role button click --name "NEXT: PICK RIDE" 2>&1 | tail -1
sleep 2
echo "=== STEP 1: ride select (snapshot) ==="
agent-browser snapshot -i 2>/dev/null | head -25
echo "=== fill driver name ==="
agent-browser find label "Driver name" fill "TESTER" 2>&1 | tail -1
sleep 1
agent-browser get value "@e9" 2>/dev/null | tail -1
echo "=== STEP 2: GO ==="
agent-browser find role button click --name "GO" 2>&1 | tail -1
sleep 5
echo "=== STEP 3: post-GO state (snapshot) ==="
agent-browser snapshot -i 2>/dev/null | head -15
echo "=== console errors ==="
agent-browser errors 2>/dev/null | tail -15
echo "=== console log tail ==="
agent-browser console 2>/dev/null | tail -10
sleep 20
echo "=== STEP 4: after 25s (snapshot head) ==="
agent-browser snapshot 2>/dev/null | head -12
agent-browser errors 2>/dev/null | tail -8
agent-browser close >/dev/null 2>&1
pkill -f "next dev" 2>/dev/null
echo "--- done ---"

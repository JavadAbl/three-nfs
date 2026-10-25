#!/bin/bash
# Pinpoint why GO doesn't launch: verify fill value, toast, screen state.
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

agent-browser close >/dev/null 2>&1
agent-browser open http://localhost:3000 >/dev/null 2>&1
agent-browser wait --text "QUICK RACE" --timeout 240000 >/dev/null 2>&1
echo "menu up"
agent-browser find role button click --name "QUICK RACE" >/dev/null 2>&1; sleep 1
agent-browser find role button click --name "Select SPA '92" 2>&1 | tail -1; sleep 1
agent-browser find role button click --name "NEXT: PICK RIDE" >/dev/null 2>&1; sleep 2
echo "--- before fill: input value ---"
agent-browser eval "document.querySelector('input[placeholder=\"DRIVER NAME\"]').value" 2>&1 | tail -1
agent-browser find label "Driver name" fill "TESTER" 2>&1 | tail -1
sleep 1
echo "--- after fill: input value ---"
agent-browser eval "document.querySelector('input[placeholder=\"DRIVER NAME\"]').value" 2>&1 | tail -1
echo "--- clicking GO ---"
agent-browser find role button click --name "GO" 2>&1 | tail -1
sleep 3
echo "--- page text after GO (toast check) ---"
agent-browser snapshot 2>/dev/null | rg -i "driver name|toast|enter|countdown|loading" | head -5
agent-browser get text "@e4" 2>/dev/null | tail -1
echo "--- full snapshot head ---"
agent-browser snapshot 2>/dev/null | head -18
agent-browser close >/dev/null 2>&1
pkill -f "next dev" 2>/dev/null
echo "--- done ---"

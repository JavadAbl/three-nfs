#!/bin/bash
# Service-worker cache verification: two visits in one browser profile.
# Visit 1: SW registers, cache bucket fills.
# Visit 2 (reload): count asset requests that hit the network (transferSize>0)
#                   vs served from Cache Storage (transferSize=0).
cd /home/z/my-project

pkill -f "next dev" 2>/dev/null
sleep 1
setsid nohup npm run dev > dev.log 2>&1 < /dev/null &
code=000
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:3000 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "server: $code (after ${i}s)"
[ "$code" != "200" ] && exit 1

agent-browser close >/dev/null 2>&1
echo "--- VISIT 1: open page, wait for cache bucket to fill ---"
agent-browser open http://localhost:3000 2>&1 | tail -1

n=0
for i in $(seq 1 24); do
  sleep 5
  n=$(agent-browser eval "caches.keys().then(ks => ks.length ? caches.open(ks[0]).then(c => c.keys().length) : 0)" 2>/dev/null | tail -1)
  echo "t=$((i*5))s cache-entries: $n"
  case "$n" in ''|*[!0-9]*) continue ;; esac
  [ "$n" -ge 25 ] && break
done
echo "sw: $(agent-browser eval "navigator.serviceWorker.controller ? 'CONTROLLING' : 'not-controlling'" 2>/dev/null | tail -1)"
echo "buckets: $(agent-browser eval "caches.keys().then(ks => ks.join(','))" 2>/dev/null | tail -1)"

echo "--- VISIT 2: reload, measure network vs cache ---"
agent-browser reload 2>&1 | tail -1
sleep 60  # let the boot run (SwiftShader is slow)
report=$(agent-browser eval "
(() => {
  const rs = performance.getEntriesByType('resource');
  const assets = rs.filter(r => /\\/models\\/|\\/textures\\/|\\/draco\\/|\\/ktx2\\//.test(r.name));
  const net = assets.filter(r => r.transferSize > 0);
  const cached = assets.filter(r => r.transferSize === 0);
  const mb = a => (a.reduce((s,r) => s + (r.transferSize||0), 0) / 1048576).toFixed(1);
  return JSON.stringify({
    assetRequests: assets.length,
    fromCacheStorage: cached.length,
    fromNetwork: net.length,
    networkMB: mb(net),
    sampleNet: net.slice(0,3).map(r => r.name.split('/').pop()),
  });
})()" 2>/dev/null | tail -1)
echo "visit2-report: $report"
echo "cache-entries-now: $(agent-browser eval "caches.keys().then(ks => ks.length ? caches.open(ks[0]).then(c => c.keys().length) : 0)" 2>/dev/null | tail -1)"

agent-browser close >/dev/null 2>&1
pkill -f "next dev" 2>/dev/null
echo "--- done ---"

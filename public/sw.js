/* ─── THREE·NFS asset service worker ─────────────────────────────────────────
 * Mission: static game assets (~25MB: car GLBs, city building sets, asphalt
 * PBR textures, Draco/KTX2 decoder WASM) must NEVER re-download on every
 * visit. The Next dev server ships public/ files with no-cache directives,
 * so plain HTTP caching can't be trusted — this SW owns a versioned
 * Cache Storage bucket instead and serves assets cache-first.
 *
 * Strategy: STALE-WHILE-REVALIDATE.
 *   - cached  → respond instantly, refresh the copy in the background
 *   - missing → network, store on success
 * After a model swap ships, sessions keep serving the stale copy once and
 * pull the new bytes in the background — next reload gets them. For urgent
 * invalidation bump CACHE_VERSION below (or rely on the ?v= query the
 * texture URLs already carry).
 *
 * Scope guard: ONLY same-origin GETs under the prefixes below are touched.
 * Everything else (Next routes, chunks, HMR websockets, APIs) passes
 * straight through untouched — dev-server safe.
 */
const CACHE_VERSION = "nfs-assets-v1";
const ASSET_PREFIXES = ["/models/", "/textures/", "/draco/", "/ktx2/", "/staging/"];

self.addEventListener("install", () => {
  // take over as soon as the new worker is ready
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      // control the page that registered us *now* — the preload downloads
      // must be intercepted on the very first session, not the next one
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!ASSET_PREFIXES.some((p) => url.pathname.startsWith(p))) return;
  event.respondWith(staleWhileRevalidate(req));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) {
    // background refresh — never blocks the response; failures are ignored,
    // and the immutable HTTP-cache headers usually absorb it (zero network)
    networkFetch(request).catch(() => null);
    return cached;
  }
  // MISS path (first visit, or CACHE_VERSION bumped after an asset swap):
  // bypass the HTTP cache so a version bump truly pulls authoritative bytes
  try {
    return await networkFetch(request, 3, "reload");
  } catch {
    /* fall through */
  }
  // offline + never cached → explicit network failure (browser error page)
  return new Response("asset unavailable offline", {
    status: 504,
    headers: { "Content-Type": "text/plain" },
  });
}

/** fetch with put-to-cache + short retry — the dev server serializes static
 *  file responses behind cold compiles, so the very first session can see
 *  transient blips on parallel asset downloads; a gentle retry absorbs
 *  them instead of failing a 2MB GLB forever. `httpCache` forces the mode
 *  used against the browser HTTP cache. */
async function networkFetch(request, attempts = 3, httpCache = "default") {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(new Request(request, { cache: httpCache }));
      if (res && res.ok && res.type === "basic") {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, res.clone());
      }
      // server hiccups (5xx) deserve one more chance too
      if (!res || res.status < 500 || i === attempts - 1) return res;
      lastError = new Error("upstream " + res.status);
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  throw lastError;
}

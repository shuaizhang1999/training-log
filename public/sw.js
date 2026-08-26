/*
 * App-shell service worker.
 *
 * Strategy:
 * - Navigations (HTML): network-first, falling back to the cached page when
 *   offline — so a deploy is picked up immediately, but the app still opens
 *   with no signal in the gym basement.
 * - /_next/static and icons: cache-first (hashed filenames are immutable).
 * - /api/*: never touched. Reads have their own localStorage fallback and
 *   writes live in the outbox, which must always hit the network.
 */
const CACHE = "training-log-v1";
const SHELL = ["/", "/history", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Best-effort precache; a failed page (e.g. redirect pre-login) is skipped.
      await Promise.allSettled(
        SHELL.map(async (path) => {
          const res = await fetch(path);
          if (res.ok && !res.redirected) await cache.put(path, res);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Immutable build assets + icons: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // Page navigations: network-first with cached fallback.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected) {
            const cache = await caches.open(CACHE);
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          const cached =
            (await caches.match(url.pathname)) || (await caches.match("/"));
          if (cached) return cached;
          return new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
        }
      })()
    );
  }
});

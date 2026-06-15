// ALMANAC service worker — offline app shell, dependency-free.
// Strategy: navigations are network-first (always get the freshest shell, fall back to
// cached index.html offline); same-origin assets (hashed, immutable) are cache-first.
// Cross-origin LIVE DATA (open-meteo, USGS, NOAA, geocoder) is NEVER intercepted —
// the almanac must always pull real readings when online.
const CACHE = "almanac-v1";
const CORE = ["index.html", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // live data APIs: straight to network

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("index.html") || caches.match("./")));
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

const VER = "v1";
const SHELL = "newsinfo-shell-" + VER;
const DATA = "newsinfo-data-" + VER;
const FILES = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];
const API_HOST = "newsinfo-fetcher.newsinfo9292.workers.dev";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = (await cache.match(req)) || (fallbackUrl ? await cache.match(fallbackUrl) : null);
    if (hit) return hit;
    throw err;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/admin")) return;
    if (req.mode === "navigate") {
      e.respondWith(networkFirst(req, SHELL, "/index.html"));
      return;
    }
    e.respondWith(networkFirst(req, SHELL));
    return;
  }

  if (url.hostname === API_HOST) {
    if (url.pathname.startsWith("/admin") || url.pathname === "/run") return;
    e.respondWith(networkFirst(req, DATA));
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(staleWhileRevalidate(req, SHELL));
  }
});

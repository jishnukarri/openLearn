// Minimal service worker: it exists so the app is installable, and to show a
// plain offline page when a navigation fails because the connection dropped.
// It deliberately caches NO app pages: they hold a signed-in student's own
// data, and a cached copy would be shown to whoever uses the device next.
// Only the static offline page and the icon are stored; every other request
// goes straight to the network, untouched.
const CACHE = "openlearn-shell-v2";
const SHELL = ["/offline.html", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drops the v1 cache, which could hold a copy of a signed-in page.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
});

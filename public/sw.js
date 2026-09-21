// Minimal service worker: cache the app shell (marketing page + manifest +
// icon) so the app installs as a real PWA and has something to show
// offline. Everything else (authenticated pages, AI-generated content) is
// always fetched fresh — this app is not meant to work fully offline, just
// to be installable and resilient to a brief connection drop.
const CACHE = "openlearn-shell-v1";
const SHELL = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("/")))
  );
});

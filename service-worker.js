const CACHE_NAME = "dona-maria-deck-v10";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app-core.js",
  "./pages-suppliers-fixed.js",
  "./pages-home-history.js",
  "./pages-results-analysis.js",
  "./auth.js",
  "./home-supplier-alert.js",
  "./summary-legacy.js",
  "./summary.js",
  "./assistant.js",
  "./sw-register.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

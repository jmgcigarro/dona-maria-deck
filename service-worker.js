const CACHE_NAME = "dona-maria-deck-v11";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/core/app-core.js",
  "./js/pages/pages-suppliers-fixed.js",
  "./js/pages/pages-home-history.js",
  "./js/pages/pages-results-analysis.js",
  "./js/auth.js",
  "./js/pages/home-supplier-alert.js",
  "./js/pages/summary-legacy.js",
  "./js/pages/summary.js",
  "./js/assistant.js",
  "./js/sw-register.js",
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

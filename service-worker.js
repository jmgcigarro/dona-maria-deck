importScripts("./js/config.js");

const CACHE_NAME = self.DECK_CONFIG.cacheName;
const FILES_TO_CACHE = self.DECK_CONFIG.filesToCache;

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

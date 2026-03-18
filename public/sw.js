const CACHE_NAME = 'bies-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and API/WS requests
  if (request.method !== 'GET' || request.url.includes('/api/') || request.url.includes('/ws')) {
    return;
  }

  // Navigation requests (HTML pages) — always network, never cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // Hashed assets (/assets/*) — cache for offline, network-first
  if (request.url.includes('/assets/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (icons, fonts, etc.) — network-first, cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

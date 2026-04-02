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

// ─── Push notifications (PWA background messages) ─────────────────────────

self.addEventListener('push', (event) => {
  let data = { title: 'BIES', body: 'You have a new notification' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch { /* use defaults */ }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'bies-notification',
    renotify: true,
    vibrate: [80, 40, 80],
    data: {
      url: data.url || '/notifications',
      notificationId: data.data?.notificationId,
      type: data.data?.type,
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing BIES tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});

// Re-subscribe when the browser rotates the push subscription keys
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((newSub) => {
        return fetch('/api/notifications/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSub.toJSON()),
        });
      })
      .catch((err) => {
        console.error('[SW] pushsubscriptionchange failed:', err);
      })
  );
});

const CACHE_NAME = 'dolarve-v10.6-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css?v=10.6',
  '/js/app.js?v=10.6',
  '/manifest.json',
  '/logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim()); // Take control of all open pages immediately
});

self.addEventListener('fetch', event => {
  // Pass-through explicitly for html2canvas CDN or API calls if needed, but network-first is fine
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cachedRes = await caches.match(event.request);
      if (cachedRes) {
        return cachedRes;
      }
      // CRITICAL FIX: If not in cache and network fails, MUST return a valid Response.
      // Returning undefined causes "TypeError: Failed to convert value to 'Response'" and crashes thread.
      return new Response('', { status: 503, statusText: 'Service Unavailable Offline' });
    })
  );
});

// WEB PUSH NOTIFICATIONS
self.addEventListener('push', event => {
  let data = { title: 'DolarVE Alerta', body: 'Hubo un cambio en las tasas.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow(event.notification.data.url || '/');
    })
  );
});

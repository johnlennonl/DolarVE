const CACHE_NAME = 'dolarve-v11.1-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.png',
  '/manifest.json',
  '/css/variables.css?v=11.0',
  '/css/layout.css?v=11.0',
  '/css/components.css?v=11.0',
  '/js/configuracion.js?v=11.0',
  '/js/interfaz.js?v=11.0',
  '/js/app.js?v=11.0'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache individual: si uno falla, los demás siguen
      return Promise.allSettled(
        urlsToCache.map(url => 
          cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err.message))
        )
      );
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

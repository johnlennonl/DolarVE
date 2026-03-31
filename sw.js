const CACHE_NAME = 'dolarve-v8.6-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css?v=8.5',
  '/js/app.js?v=8.5',
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

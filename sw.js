const CACHE_NAME = 'dolarve-v5-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css?v=5.0',
  '/app.js?v=5.0',
  '/manifest.json',
  '/logo.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Try network first, then fallback to cache for everything
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

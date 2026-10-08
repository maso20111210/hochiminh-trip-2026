const CACHE_PREFIX = 'hcm-trip-';
const CACHE = CACHE_PREFIX + '2026-10-08-v6';
const ASSETS = ['./', './index.html', './cloud-sync.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const scope = self.registration.scope;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (!response.ok) throw new Error('Navigation failed');
      const cache = await caches.open(CACHE);
      await cache.put(new URL('./index.html', scope), response.clone());
      return response;
    }).catch(() => caches.match(new URL('./index.html', scope))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type === 'basic') await cache.put(event.request, response.clone());
    return response;
  }));
});

const CACHE_PREFIX = 'hcm-trip-';
const CACHE = CACHE_PREFIX + '2026-10-08-v10';
const ASSETS = ['./', './index.html', './cloud-sync.js?v=20261008-v10', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
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
  if (event.request.mode === 'navigate' || new URL(event.request.url).pathname.endsWith('/cloud-sync.js')) {
    event.respondWith(fetch(event.request).then(async response => {
      if (!response.ok) throw new Error('Navigation failed');
      const cache = await caches.open(CACHE);
      await cache.put(event.request.mode === 'navigate' ? new URL('./index.html', scope) : event.request, response.clone());
      return response;
    }).catch(() => caches.match(event.request.mode === 'navigate' ? new URL('./index.html', scope) : event.request)));
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

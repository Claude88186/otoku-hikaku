const CACHE_VERSION = 'v1';
const CACHE_NAME = 'otoku-hikaku-' + CACHE_VERSION;
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './tests.html', './README.md'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('otoku-hikaku-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request))); });

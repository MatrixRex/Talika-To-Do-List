/* global self */
// Talika PWA Offline Service Worker
const CACHE_NAME = 'talika-pwa-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './site.webmanifest',
  './icon-v2.svg',
  './favicon.svg',
  './icons.svg',
  './icons/icon-16.png',
  './icons/icon-32.png',
  './icons/icon-48.png',
  './icons/icon-128.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('PWA Precache partial warning:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only intercept GET requests
  if (request.method !== 'GET') return;

  // 2. Ignore Chrome / browser extensions and dev server websockets
  if (url.protocol.startsWith('chrome') || url.protocol.startsWith('moz')) return;

  // 3. Bypass Firebase/Google backends (Firestore, Auth, APIs) — let Firebase SDK's local cache handle it
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken')
  ) {
    return;
  }

  // 4. Navigation requests (e.g. initial URL, #routes, reload)
  // Network-first with offline fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match('./index.html')) ||
            (await caches.match('./')) ||
            (await caches.match('index.html'));
          if (cached) return cached;
          return new Response('Talika is offline. Please reconnect to load fresh content.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        })
    );
    return;
  }

  // 5. Static Assets (JS, CSS, SVGs, PNGs, fonts, webmanifest)
  // Cache-first: return cached copy immediately, or fetch & cache dynamically
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (networkResponse.type === 'basic' || networkResponse.type === 'cors') &&
            url.origin === self.location.origin
          ) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const pathname = url.pathname;
          if (
            pathname.endsWith('.svg') ||
            pathname.endsWith('.png') ||
            pathname.endsWith('.webmanifest')
          ) {
            const fallback =
              (await caches.match(`.${pathname}`)) ||
              (await caches.match(pathname.split('/').pop() || ''));
            if (fallback) return fallback;
          }
          return new Response(null, { status: 504, statusText: 'Gateway Timeout' });
        });
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickAction = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(clickAction);
      }
    })
  );
});

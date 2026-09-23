/**
 * sw.js - Service Worker for Rukn PWA
 * Provides full offline resilience, cache-first local asset serving,
 * and seamless background synchronization.
 */

const CACHE_NAME = 'rukn-pwa-v2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './driveSync.js',
  './chat.js',
  './player.js',
  './recorder.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// External CDN dependencies to cache when loaded
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// Domains that must never be cached (APIs requiring direct network access)
const BYPASS_DOMAINS = [
  'googleapis.com',
  'generativelanguage.googleapis.com',
  'accounts.google.com',
  'nominatim.openstreetmap.org'
];

// Install: Pre-cache core application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('Rukn Service Worker precache warning:', err);
      })
  );
});

// Activate: Purge obsolete cache generations and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Stale-while-revalidate for local assets, network-first for external APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass cloud APIs completely
  if (BYPASS_DOMAINS.some((domain) => url.hostname.includes(domain))) {
    return;
  }

  // 2. Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. Navigation requests: return index.html if offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('./index.html');
          return cached || caches.match(event.request);
        })
    );
    return;
  }

  // 4. Cache-first strategy for static assets and CDN scripts
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch update in background for local scripts and styles
        if (url.origin === self.location.origin) {
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {
              // Ignore background update failures when offline
            });
        }
        return cachedResponse;
      }

      // If not in cache, fetch from network and cache if appropriate
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache local origin files or approved CDNs
          const shouldCache =
            url.origin === self.location.origin ||
            CDN_HOSTS.some((host) => url.hostname.includes(host));

          if (shouldCache) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch((fetchError) => {
          // Fallback for image requests when offline
          if (event.request.destination === 'image') {
            return caches.match('./icons/icon-192.png');
          }
          throw fetchError;
        });
    })
  );
});

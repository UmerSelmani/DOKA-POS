// Doka POS Service Worker - Network First strategy
// Never cache API calls, always fresh for Supabase

const CACHE_NAME = 'doka-pos-v5';
const STATIC_ASSETS = [
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/doka-logo.png',
  '/manifest.json',
];

// Install - only cache static icons
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - delete ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('SW: deleting old cache', key);
          return caches.delete(key);
        }
      }))
    )
  );
  self.clients.claim();
});

// Fetch - NETWORK FIRST for everything except static icons
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept Supabase API calls - let them go direct
  if (url.hostname.includes('supabase.co')) {
    return; // Don't intercept at all
  }

  // Never intercept non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For HTML/JS/CSS - always network first, fallback to cache
  if (url.pathname === '/' || url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update cache with fresh copy
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static icons - cache first
  if (STATIC_ASSETS.some(a => url.pathname.includes(a.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Everything else - network first
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

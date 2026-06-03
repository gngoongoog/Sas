const CACHE_NAME = 'supersas-v4-cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// Service Worker Install State
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SuperSAS SW] Caching app shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Service Worker Active State
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SuperSAS SW] Removing stale cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor: Network-First with Local Cache Fallback for Static assets, bypass API calls
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // bypass API routes to ensure we never cache server state or proxy microtik endpoints
  if (requestUrl.pathname.startsWith('/api/')) {
    return; // let browser fetch live
  }

  // Handle standard document/asset queries with network first
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful static responses
        if (
          networkResponse && 
          networkResponse.status === 200 && 
          networkResponse.type === 'basic' &&
          event.request.method === 'GET'
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline or connection drop: try loading from cache
        console.log('[SuperSAS SW] Network lost. Loading from cache:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If the page request failed, default back to index.html root
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});

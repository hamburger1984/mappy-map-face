// Service Worker — persistent tile cache
//
// Tile URLs are versioned: tiles/t3/12/34.json.gz?v=1234567890
// The same URL always returns the same bytes, so cache-first is safe and
// gives zero network latency on repeat visits.
//
// Everything else (HTML, JS, tile index) passes through to the network.

const TILE_CACHE = 'tile-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Remove any old tile caches (e.g. from previous SW versions)
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('tile-cache-') && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Only intercept tile requests (gzipped JSON tiles)
  if (!url.includes('/tiles/') || !url.includes('.json.gz')) return;

  event.respondWith(
    caches.open(TILE_CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Only cache successful responses
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    )
  );
});

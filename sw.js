// ── Muay Thai Plan — Service Worker ──
// Version hochzählen wenn du den Plan aktualisierst → alten Cache löschen
const CACHE_NAME = 'muaythai-plan-v1';

// Alle Dateien die offline verfügbar sein sollen
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Google Fonts werden ebenfalls gecacht damit der Plan
  // auch offline mit den richtigen Schriften angezeigt wird
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700;900&family=Sarabun:wght@300;400;600&display=swap'
];

// ── Install: Alle Assets in den Cache laden ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cache wird befüllt...');
      // Fonts separat cachen (können CORS-Probleme machen)
      return cache.addAll(ASSETS.filter(a => !a.startsWith('https://fonts')))
        .then(() => {
          // Fonts mit no-cors versuchen
          return fetch('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;700;900&family=Sarabun:wght@300;400;600&display=swap', { mode: 'no-cors' })
            .then(res => cache.put('fonts', res))
            .catch(() => console.log('[SW] Fonts konnten nicht gecacht werden — egal.'));
        });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: Alten Cache aufräumen ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Alter Cache gelöscht:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First Strategie ──
// → Erst aus Cache laden, nur bei Miss aus dem Netz holen
self.addEventListener('fetch', event => {
  // Nur GET-Anfragen cachen
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Aus Cache servieren & im Hintergrund aktualisieren (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then(networkRes => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkRes;
          })
          .catch(() => cached); // Netz nicht erreichbar → Cache bleibt
        return cached;
      }

      // Nicht im Cache → aus Netz holen & cachen
      return fetch(event.request)
        .then(networkRes => {
          if (!networkRes || networkRes.status !== 200 || networkRes.type === 'opaque') {
            return networkRes;
          }
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkRes;
        })
        .catch(() => {
          // Komplett offline und nicht im Cache
          // Fallback: Hauptseite zurückgeben
          return caches.match('./index.html');
        });
    })
  );
});

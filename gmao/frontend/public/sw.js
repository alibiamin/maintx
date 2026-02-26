// Minimal service worker for PWA installability (mobile techniciens - type Nom@d)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
// Ne pas intercepter fetch : un simple pass-through avec respondWith(fetch()) provoquait
// des "Uncaught (in promise) TypeError: Failed to fetch" en cas d'échec réseau/CORS.
// En n'appelant pas respondWith, les requêtes passent directement au réseau.

// Minimal service worker for PWA installability (mobile techniciens - type Nom@d)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const u = e.request.url;
  // Ne pas intercepter les ressources externes : sinon le SW fait fetch() et la CSP connect-src les bloque.
  // En laissant passer, le document les charge et style-src / img-src s'appliquent.
  if (u.startsWith('https://fonts.googleapis.com/') || u.startsWith('https://fonts.gstatic.com/') || u.startsWith('https://images.unsplash.com/')) {
    return;
  }
  e.respondWith(fetch(e.request));
});

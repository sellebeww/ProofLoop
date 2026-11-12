/* ProofLoop service worker: cangkang aplikasi tersedia offline. Data tetap di peramban (localStorage), bukan di cache ini.
   Strategi: jaringan dulu untuk berkas se-origin (rilis baru langsung terlihat), cache sebagai cadangan offline.
   Permintaan /api/ tidak pernah di-cache. © 2026 Vassel Goleyu. */
const CACHE = 'proofloop-__BUILD_ID__';
const SHELL = ['./', 'index.html', 'offline.html', 'css/app.css', 'css/public.css', 'js/domain.js', 'js/store.js', 'js/core.js', 'js/public.js', 'js/auth.js', 'js/pages1.js', 'js/pages2.js', 'js/pages3.js',
  'js/usability-ui.js', 'js/history-ui.js', 'js/evidence-ui.js', 'js/ai-ui.js', 'js/exchange-ui.js', 'js/main.js', 'vendor/lucide.min.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.match(r).then(hit => hit || (r.mode === 'navigate' ? caches.match('index.html').then(i => i || caches.match('offline.html')) : Response.error()))));
});

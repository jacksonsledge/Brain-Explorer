/* Brain Explorer service worker: keeps the app working offline after the first visit.
   The page itself is fetched from the network first so updates arrive straight away;
   the cached copy is used when there is no connection or the network is too slow. */
const CACHE = 'brain-explorer-v1';
const THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const CORE = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    c.addAll(CORE),
    c.add(new Request(THREE, { mode: 'cors' })).catch(() => {})
  ])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// the page: network first, falling back to the cached copy after a few seconds or when offline
function page(req) {
  return caches.open(CACHE).then(c => {
    const net = fetch(req).then(r => { if (r.ok) c.put('./', r.clone()); return r; });
    const slow = new Promise(res => setTimeout(() => c.match('./').then(m => m && res(m)), 4000));
    return Promise.race([net, slow]).catch(() => c.match('./').then(m => m || net));
  });
}
// files that never change at the same address: cache first
function cacheFirst(req) {
  return caches.match(req).then(m => m || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') caches.open(CACHE).then(c => c.put(req, r.clone()));
    return r;
  }));
}
// everything else we keep: answer from the cache, then refresh it in the background
function staleWhileRevalidate(req, e) {
  return caches.open(CACHE).then(c => c.match(req).then(m => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; });
    if (m) { e.waitUntil(net.catch(() => {})); return m; }
    return net;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) { e.respondWith(page(req)); return; }
  if (url.href === THREE || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.origin === location.origin) { e.respondWith(staleWhileRevalidate(req, e)); return; }
  // anything else (such as visit counting) goes straight to the network
});

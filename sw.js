/* Brain Explorer service worker: keeps the app working offline after the first visit.
   The page itself is fetched from the network first so updates arrive straight away;
   the cached copy is used when there is no connection or the network is too slow. */
/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);
const CACHE = 'brain-explorer-v3'; // v3: clears any bad copies an older version may have kept
const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.1.0/fuse.min.js'];
const CORE = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

sw.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    c.addAll(CORE),
    ...LIBS.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {}))
  ])).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => sw.clients.claim()));
});

// the page: network first, falling back to the cached copy after a few seconds or when offline
function page(req) {
  const p = new URL(req.url).pathname, scope = new URL(sw.registration.scope).pathname;
  const isApp = p === scope || p === scope + 'index.html';
  return caches.open(CACHE).then(c => {
    // only the app's own page is kept as the offline copy (not an icon or file opened in its own tab);
    // a server error counts as a failure, so the saved copy is used instead
    const net = fetch(req).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (isApp && (r.headers.get('content-type') || '').indexOf('text/html') >= 0) c.put('./', r.clone());
      return r;
    });
    const slow = new Promise(res => setTimeout(() => c.match('./').then(m => m && res(m)), 4000));
    return Promise.race([net, slow]).catch(() => c.match('./').then(m => m || fetch(req)));
  });
}
// files that never change at the same address: cache first
function cacheFirst(req) {
  return caches.match(req).then(m => m || fetch(req).then(r => {
    if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone())); // never keep a failed or unreadable download
    return r;
  }));
}
// everything else we keep: answer from the cache, then refresh it in the background
/** @param {Request} req @param {ExtendableEvent} e */
function staleWhileRevalidate(req, e) {
  return caches.open(CACHE).then(c => c.match(req).then(m => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; });
    if (m) { e.waitUntil(net.catch(() => {})); return m; }
    return net;
  }));
}

sw.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) { e.respondWith(page(req)); return; }
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.origin === location.origin) { e.respondWith(staleWhileRevalidate(req, e)); return; }
  // anything else (such as visit counting) goes straight to the network
});

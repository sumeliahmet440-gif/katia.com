const C = 'katia3';
const CORE = ['./', './index.html', './app.css', './extras.css', './config.js', './app.js', './extras.js', './manifest.json', './icon.svg', './reklam1.jpg', './reklam2.jpg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok) { const c = r.clone(); caches.open(C).then(x => x.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});

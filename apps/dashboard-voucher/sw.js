const CACHE_NAME = 'financesync-v4.1';
const STATIC_ASSETS = ['/', '/index.html', '/style.css', '/script.js'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(keys => 
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetchPromise = fetch(e.request).then(networkResp => {
                if (networkResp.ok) {
                    const respClone = networkResp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, respClone));
                }
                return networkResp;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});

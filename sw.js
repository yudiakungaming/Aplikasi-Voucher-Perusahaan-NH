// 🔧 FinanceSync Pro - Service Worker (Root)
const CACHE_NAME = 'financesync-portal-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Tambahkan file CSS/JS root jika ada
];

// ✅ Install: Cache file statis
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ✅ Activate: Hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ✅ Fetch: Cache-first strategy untuk portal, network-first untuk sub-apps
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Jika request ke subfolder apps, biarkan network handle (karena apps punya SW sendiri)
  if (url.pathname.startsWith('/apps/')) {
    return; // Biarkan service worker masing-masing app yang handle
  }

  // Untuk portal root: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        // Cache response baru jika sukses
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

// ✅ Push notification (opsional, bisa diaktifkan nanti)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Notifikasi baru dari FinanceSync Pro',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), primaryKey: 1 }
  };
  event.waitUntil(
    self.registration.showNotification('FinanceSync Pro', options)
  );
});

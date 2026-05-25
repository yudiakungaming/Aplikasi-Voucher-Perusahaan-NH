// 🔧 FinanceSync Pro - Service Worker (Root) - v2.1 IMPROVED
const CACHE_NAME = 'financesync-portal-v2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ✅ Install: Cache file statis portal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching portal assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((error) => {
        console.warn('[SW] Some assets failed to cache:', error);
      })
  );
  self.skipWaiting();
});

// ✅ Activate: Hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ✅ Fetch: Network-first untuk apps, Cache-first untuk portal
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Abaikan request non-GET atau dari extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Abaikan request ke Google APIs (biarkan network handle)
  if (['googleapis.com', 'google.com', 'gstatic.com'].some(domain => 
      url.hostname.includes(domain))) {
    return;
  }

  // ✅ STRATEGI: 
  // - /apps/* → network-first (biarkan SW masing-masing app handle)
  // - Root portal → cache-first dengan fallback
  if (url.pathname.startsWith('/apps/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Fallback ke cache jika offline
        return caches.match(request);
      })
    );
    return;
  }

  // ✅ Cache-first dengan stale-while-revalidate untuk portal
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Update cache jika response valid
        if (networkResponse?.ok && networkResponse.type === 'basic') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline: return cached atau fallback page
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline - Resource not available', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      });

      // Return cached immediately, update in background
      return cachedResponse || fetchPromise;
    })
  );
});

// ✅ Push Notification (opsional)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Notifikasi baru dari FinanceSync Pro',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), primaryKey: 1 },
    actions: [
      { action: 'open', title: 'Buka Aplikasi' },
      { action: 'close', title: 'Tutup' }
    ]
  };
  event.waitUntil(
    self.registration.showNotification('FinanceSync Pro', options)
  );
});

// ✅ Handle Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (!event.action || event.action === 'open') {
    event.waitUntil(clients.openWindow('/'));
  }
});

// ✅ Message Handler untuk komunikasi dengan main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }
});

console.log('[SW] ✅ FinanceSync Pro Portal Service Worker v2.1 loaded');

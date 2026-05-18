// 🔧 FinanceSync Pro - Service Worker (Root) - v2.0 FIXED
const CACHE_NAME = 'financesync-portal-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ✅ Install: Cache file statis portal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching portal assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch((error) => {
      console.log('[SW] Caching skipped for some assets:', error);
    })
  );
  self.skipWaiting();
});

// ✅ Activate: Hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// ✅ Fetch: Smart caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ FIX 1: Abaikan request dari browser extension (chrome-extension://)
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // ✅ FIX 2: Abaikan request ke Google APIs (tidak boleh di-cache)
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('google.com') ||
      url.hostname.includes('gstatic.com')) {
    return; // Biarkan network handle Google APIs
  }

  // ✅ FIX 3: Abaikan request dengan method non-GET
  if (request.method !== 'GET') {
    return;
  }

  // ✅ FIX 4: Jika request ke subfolder apps, biarkan network handle
  if (url.pathname.startsWith('/apps/')) {
    return; // Biarkan service worker masing-masing app yang handle
  }

  // ✅ FIX 5: Untuk portal root: cache-first dengan fallback network
  event.respondWith(
    caches.match(request).then((cached) => {
      // Jika ada di cache dan masih fresh, return cached
      if (cached) {
        // Fetch dari network di background untuk update cache (stale-while-revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Network error, tetap pakai cache
        });
        return cached;
      }

      // Jika tidak ada di cache, fetch dari network
      return fetch(request).then((response) => {
        // Cache response baru jika sukses
        if (response && response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch((error) => {
        // Fallback untuk offline
        console.log('[SW] Fetch failed:', error);
        
        // Jika request untuk navigasi (HTML), return offline page jika ada
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        
        // Return error response
        return new Response('Offline - Resource not cached', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      });
    }).catch((error) => {
      console.log('[SW] Cache match failed:', error);
      // Fallback terakhir: fetch dari network
      return fetch(request).catch(() => {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ✅ Push notification (opsional)
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

// ✅ Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// ✅ Message handler untuk komunikasi dengan main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }
});

// ✅ Log untuk debugging
console.log('[SW] Service Worker loaded - FinanceSync Pro Portal v2.0');

// ═══════════════════════════════════════════════════════
// FINANCE SYNC PRO - SERVICE WORKER (v4.12 - Multi-App)
// ✅ Support caching untuk root + /apps/* subfolders
// ✅ Cache versioning + auto cleanup
// ✅ Offline fallback + network-first untuk API
// ✅ Message handler untuk komunikasi dengan UI
// ═══════════════════════════════════════════════════════

// ✅ UPDATE INI SETIAP KALI ADA PERUBAHAN BESAR
const CACHE_VERSION = 'v4.12';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// ✅ Files yang wajib di-cache saat install (App Shell)
const STATIC_ASSETS = [
  // Root files
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  
  // Icons (pastikan file ini ada!)
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  
  // ✅ Dashboard App
  '/apps/dashboard-voucher/',
  '/apps/dashboard-voucher/index.html',
  '/apps/dashboard-voucher/script.js',
  '/apps/dashboard-voucher/style.css',
  
  // ✅ Input Voucher App
  '/apps/input-voucher/',
  '/apps/input-voucher/index.html',
  '/apps/input-voucher/session-manager.js',
  '/apps/input-voucher/css/styles.css',
  '/apps/input-voucher/js/app.js',
  '/apps/input-voucher/js/config.js',
  '/apps/input-voucher/js/firebase-init.js',
  '/apps/input-voucher/js/firestore-db.js',
  '/apps/input-voucher/js/utils.js',
  
  // CDN libraries (opsional - bisa juga network-only)
  // 'https://cdn.tailwindcss.com',
  // 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

// ✅ URL patterns untuk API (network-first strategy)
const API_PATTERNS = [
  'script.google.com',           // Google Apps Script
  'firestore.googleapis.com',    // Firebase Firestore
  'identitytoolkit.googleapis.com', // Firebase Auth
  'storage.googleapis.com'       // Firebase Storage
];

// ═══════════════════════════════════════════════════════
// 📦 INSTALL: Cache static assets
// ═══════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('✅ [SW] Installing:', CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skip waiting to activate immediately');
        return self.skipWaiting();
      })
      .catch((err) => console.error('[SW] Install error:', err))
  );
});

// ═══════════════════════════════════════════════════════
// 🗑️ ACTIVATE: Cleanup old caches + claim clients
// ═══════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Activating:', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => 
              name !== STATIC_CACHE && 
              name !== DYNAMIC_CACHE &&
              name.startsWith('financesync-') // Hapus cache versi lama
            )
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
      .catch((err) => console.error('[SW] Activate error:', err))
  );
});

// ═══════════════════════════════════════════════════════
// 🌐 FETCH: Smart caching strategy per request type
// ═══════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') return;
  
  // ✅ Skip cross-origin requests that aren't APIs
  if (!url.origin.startsWith(self.location.origin) && 
      !API_PATTERNS.some(p => url.hostname.includes(p))) {
    return;
  }

  // ✅ API requests: Network-first with cache fallback
  if (API_PATTERNS.some(pattern => url.hostname.includes(pattern))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ✅ Navigation requests (HTML pages): Cache-first with network fallback
  if (request.mode === 'navigate') {
    event.respondWith(cacheFirstNavigation(request));
    return;
  }

  // ✅ Static assets (JS, CSS, images, fonts): Cache-first
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // ✅ Default fallback: Cache-first
  event.respondWith(cacheFirst(request));
});

// ═══════════════════════════════════════════════════════
// 🔄 CACHING STRATEGIES
// ═══════════════════════════════════════════════════════

// 🌐 Network-first: Untuk API calls (data selalu fresh)
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache successful responses for offline fallback
    if (response.ok && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // Return offline response for API failures
    return new Response(
      JSON.stringify({ error: 'Offline - tidak bisa terhubung ke server' }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// 📄 Cache-first navigation: Untuk HTML pages (multi-app support)
async function cacheFirstNavigation(request) {
  // 1. Try cache first
  const cached = await caches.match(request);
  if (cached) return cached;

  // 2. Fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Navigation failed, fallback to root index');
    // 3. Fallback to root index.html for SPA-style navigation
    return caches.match('/index.html');
  }
}

// 📦 Cache-first: Untuk static assets (JS, CSS, images)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Cache-first failed:', request.url);
    return new Response('Resource not available offline', { status: 503 });
  }
}

// ═══════════════════════════════════════════════════════
// 🔔 PUSH NOTIFICATIONS (Opsional - siap digunakan)
// ═══════════════════════════════════════════════════════
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Notifikasi baru',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
      actions: data.actions || []
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'FinanceSync Pro', options)
    );
  } catch (err) {
    console.error('[SW] Push error:', err);
  }
});

// ═══════════════════════════════════════════════════════
// 🖱️ NOTIFICATION CLICK HANDLER
// ═══════════════════════════════════════════════════════
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if already open
        for (let client of windowClients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new tab if not found
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
      .catch(err => console.error('[SW] Notification click error:', err))
  );
});

// ═══════════════════════════════════════════════════════
// 💬 MESSAGE HANDLER: Komunikasi dengan main thread
// ═══════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  // ✅ Skip waiting: Force SW activation without reload
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING');
    self.skipWaiting();
    return;
  }
  
  // ✅ Clear dynamic cache: Untuk force refresh data
  if (event.data?.type === 'CLEAR_DYNAMIC_CACHE') {
    console.log('[SW] Clearing dynamic cache');
    event.waitUntil(
      caches.delete(DYNAMIC_CACHE)
        .then(() => {
          console.log('[SW] Dynamic cache cleared');
          // Notify all clients
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ 
                type: 'CACHE_CLEARED', 
                success: true,
                timestamp: new Date().toISOString()
              });
            });
          });
        })
        .catch(err => {
          console.error('[SW] Failed to clear cache:', err);
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ 
                type: 'CACHE_CLEARED', 
                success: false,
                error: err.message 
              });
            });
          });
        })
    );
    return;
  }
  
  // ✅ Get cache status: Untuk debug / UI display
  if (event.data?.type === 'GET_CACHE_STATUS') {
    event.waitUntil(
      Promise.all([
        caches.keys(),
        caches.open(STATIC_CACHE).then(c => c.keys()),
        caches.open(DYNAMIC_CACHE).then(c => c.keys()).catch(() => [])
      ])
      .then(([allCaches, staticKeys, dynamicKeys]) => {
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'CACHE_STATUS',
              caches: allCaches,
              staticCount: staticKeys.length,
              dynamicCount: dynamicKeys.length,
              version: CACHE_VERSION
            });
          });
        });
      })
    );
    return;
  }
});

// ═══════════════════════════════════════════════════════
// 📊 DEBUG: Log SW activity (bisa di-disable di production)
// ═══════════════════════════════════════════════════════
// self.addEventListener('fetch', (e) => {
//   console.log('[SW] Fetch:', e.request.url);
// });

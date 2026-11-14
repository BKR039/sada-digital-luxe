// ============================================================
// SADA OS — PRODUCTION SERVICE WORKER (PWA)
// Cache Name: sada-os-pwa-v8
// Features: App Shell Caching, Offline Fallback, Web Push & Action Routing
// ============================================================

const CACHE_NAME = 'sada-os-pwa-v9';

const STATIC_SHELL_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-512x512.png',
  '/icons/pwa-icon-180x180.png',
  '/icons/pwa-icon-192x192.png',
  '/icons/pwa-icon-512x512.png',
  '/icons/pwa-icon-maskable-512x512.png',
  '/icons/sada-logo-light.svg',
  '/icons/sada-logo-dark.svg',
  '/fonts/thmanyahseriftext-Regular.otf',
  '/fonts/thmanyahseriftext-Bold.otf',
  '/fonts/thmanyah-400.woff2',
  '/fonts/thmanyah-700.woff2',
  '/sada-emblem-1024.png',
  '/pwa-launch-screen.png',
];

// Install: Pre-cache core app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate: Prune stale caches and claim existing clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never cache non-GET requests, Supabase API/Auth endpoints, or sensitive data
  if (request.method !== 'GET') {
    return;
  }
  // Strictly bypass SW cache for all Supabase API/Auth/Storage/Realtime requests
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/storage/v1/')
  ) {
    return;
  }

  // 2. Navigation requests: Network-first, fallback to /offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(async (err) => {
          console.log('[SW] Navigation fetch failed for:', request.url, err);
          const cache = await caches.open(CACHE_NAME);
          const cachedOffline = await cache.match('/offline.html');
          console.log('[SW] Found cached offline.html?', Boolean(cachedOffline));
          if (cachedOffline) {
            return cachedOffline;
          }
          const globalCached = await caches.match('/offline.html');
          if (globalCached) {
            return globalCached;
          }
          return new Response('<h1>Offline</h1>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 3. Static assets (fonts, images, svg, icons): Cache-first with network fallback
  const isStaticAsset =
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.otf') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Default: Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// ============================================================
// WEB PUSH NOTIFICATION HANDLER (PUSH 3.0)
// ============================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'SADA OS Notification',
    body: 'You have a new update in your SADA OS workspace.',
    url: '/admin/my-work',
    tag: 'sada-notification',
    priority: 'normal',
    icon: '/icons/pwa-icon-192x192.png',
    badge: '/favicon-32x32.png',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (_) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/pwa-icon-192x192.png',
    badge: data.badge || '/favicon-32x32.png',
    tag: data.tag || `sada-notif-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '/admin/my-work',
      id: data.data?.id,
      entityType: data.data?.entityType,
      entityId: data.data?.entityId,
    },
    vibrate: data.priority === 'urgent' ? [200, 100, 200, 100, 300] : [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Task • عرض المهمة' },
      { action: 'dismiss', title: 'Dismiss • إغلاق' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, notificationOptions)
  );
});

// ============================================================
// NOTIFICATION CLICK / ACTION HANDLER (DEEP-LINKING)
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const rawUrl = event.notification.data?.url || '/admin/my-work';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // 1. Try to focus an existing window matching our origin
      for (const client of windowClients) {
        if (client.url && client.url.startsWith(self.location.origin)) {
          if ('focus' in client) {
            await client.focus();
          }
          if ('navigate' in client && targetUrl) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // 2. Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

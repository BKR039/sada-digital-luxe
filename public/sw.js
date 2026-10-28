// ============================================================
// SADA OS — PRODUCTION SERVICE WORKER (PWA)
// Cache Name: sada-os-pwa-v1
// Features: App Shell Caching, Offline Fallback, Web Push & Action Routing
// ============================================================

const CACHE_NAME = 'sada-os-pwa-v4';

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
  '/sada-emblem-1024.png',
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
        .catch(() => {
          return caches.match('/offline.html');
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
// WEB PUSH NOTIFICATION HANDLER
// ============================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'SADA OS Notification',
    body: 'You have a new update in your SADA OS workspace.',
    url: '/admin/my-work',
    tag: 'sada-notification',
    priority: 'normal',
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
    icon: '/icons/icon-192x192.png',
    badge: '/favicon-32x32.png',
    tag: data.tag || 'sada-task-alert',
    renotify: true,
    data: {
      url: data.url || '/admin/my-work',
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
// NOTIFICATION CLICK / ACTION HANDLER
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = event.notification.data?.url || '/admin/my-work';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if open
      for (const client of windowClients) {
        if ((client.url.includes('/admin') || client.url.includes('/sada-os')) && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

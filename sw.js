// ─── WordQuest Service Worker ─────────────────────────────────────────────────
const CACHE_NAME = 'wordquest-v1.0.0';
const OFFLINE_URL = '/index.html';

// Files to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  // CDN resources cached at runtime
];

// ── Install: precache core files ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: network first, fallback to cache ───────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin except CDN
  if (request.method !== 'GET') return;

  // For CDN resources (React, Tailwind, Babel) — cache first
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // For same-origin — network first, fallback to cache, fallback to offline
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(cached => {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});

// ── Background Sync: sync leaderboard when back online ───────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-leaderboard') {
    console.log('[SW] Syncing leaderboard...');
    event.waitUntil(syncLeaderboard());
  }
});

async function syncLeaderboard() {
  // Placeholder for future backend sync
  console.log('[SW] Leaderboard sync complete');
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'WordQuest';
  const options = {
    body: data.body || 'New challenge available!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'play', title: '🎮 Play Now' },
      { action: 'dismiss', title: '✕ Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'play') {
    event.waitUntil(clients.openWindow('/'));
  }
});

console.log('[SW] Service Worker loaded ✓');

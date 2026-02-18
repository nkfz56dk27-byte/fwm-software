// Gestione messaggi dal client (postMessage)
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const notifica = event.data.notifica;
    self.registration.showNotification(notifica.titolo, {
      body: notifica.messaggio,
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      tag: notifica.id,
      requireInteraction: true,
      data: { url: notifica.url }
    });
  }
  // Puoi gestire altri tipi come KEEP_ALIVE qui se serve
});
// Basic Service Worker for Web Push Notifications
self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        data = { body: event.data.text() };
      } catch (e2) {
        data = {};
      }
    }
  }
  const headings = data.headings || (data.notification && data.notification.headings) || {};
  const contents = data.contents || (data.notification && data.notification.contents) || {};
  const custom = data.custom || {};
  const customA = (custom && custom.a) || {};

  const title =
    data.title ||
    headings.it ||
    headings.en ||
    (data.notification && data.notification.title) ||
    customA.title ||
    'Nuova notifica';

  const body =
    data.body ||
    contents.it ||
    contents.en ||
    (data.notification && (data.notification.body || data.notification.content)) ||
    data.alert ||
    customA.body ||
    customA.message ||
    '';

  const url =
    data.url ||
    (data.data && data.data.url) ||
    (data.notification && data.notification.url) ||
    customA.url ||
    (typeof customA.u === 'string' ? customA.u : undefined) ||
    '/';
  const options = {
    body,
    icon: data.icon || '/icona_notifiche.png',
    badge: data.badge || '/icona_notifiche.png',
    data: { ...(data.data || {}), url },
    actions: data.actions || []
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// Optional: Handle service worker updates
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

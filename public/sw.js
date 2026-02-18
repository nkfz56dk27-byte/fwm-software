// Service Worker per notifiche push
self.addEventListener('install', event => {
  console.log('Service Worker installato');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker attivato');
});

self.addEventListener('message', event => {
  console.log('Service Worker messaggio:', event.data);
});

self.addEventListener('push', event => {
  console.log('Service Worker push:', event);
  const data = event.data ? event.data.json() : {};
  self.registration.showNotification(data.title || 'Notifica', {
    body: data.body || '',
    icon: data.icon || '/icona_notifiche.png',
    data: data.data || {}
  });
});

self.addEventListener('notificationclick', event => {
  console.log('Service Worker notification click:', event);
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
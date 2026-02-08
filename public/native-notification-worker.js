// Service Worker nativo per notifiche Supabase con corpo forzato

console.log('🔥 NATIVE NOTIFICATION WORKER CARICATO');

// Database delle notifiche in cache
let notificationCache = [];

// Intercepta i messaggi dal client
self.addEventListener('message', function(event) {
  console.log('📩 Messaggio ricevuto:', event.data);
  
  if (event.data.type === 'STORE_NOTIFICATION') {
    notificationCache.push(event.data.notification);
    console.log('📦 Notifica salvata in cache:', event.data.notification);
  }
});

// Intercepta sync events per notifiche in background
self.addEventListener('sync', function(event) {
  console.log('🔄 Sync event:', event.tag);
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(processNotificationQueue());
  }
});

// Processa la coda delle notifiche
async function processNotificationQueue() {
  console.log('🔄 Processando coda notifiche...');
  
  for (const notification of notificationCache) {
    try {
      await showForcedNotification(notification);
    } catch (error) {
      console.error('❌ Errore processando notifica:', error);
    }
  }
  
  notificationCache = [];
}

// Funzione per mostrare notifica con corpo forzato
async function showForcedNotification(notification) {
  const title = notification.titolo || 'FWM';
  const body = notification.messaggio || 'Notifica da FWM';
  
  console.log('🔥 MOSTRANDO NOTIFICA FORZATA:', { title, body });
  
  return self.registration.showNotification(title, {
    body: body,
    icon: '/icona_notifiche.png',
    badge: '/icona_notifiche.png',
    tag: `fwm-${Date.now()}`,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'open',
        title: '📱 Apri App'
      },
      {
        action: 'dismiss',
        title: '❌ Chiudi'
      }
    ],
    data: {
      url: notification.url || '/',
      notificationId: notification.id
    }
  });
}

// Intercepta push events (se usati con Firebase/FCM)
self.addEventListener('push', function(event) {
  console.log('📩 PUSH EVENT NATIVO:', event);
  
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('📩 DATI PUSH NATIVI:', data);
      
      // Se è una notifica Supabase
      if (data.type === 'supabase_notification' || data.record) {
        const notification = data.record || data;
        event.waitUntil(showForcedNotification(notification));
      } else {
        // Fallback per altri tipi
        event.waitUntil(showForcedNotification({
          titolo: data.title || 'FWM',
          messaggio: data.body || data.message || 'Notifica da FWM',
          url: data.url || '/'
        }));
      }
      
    } catch (error) {
      console.error('❌ Errore push nativo:', error);
      event.waitUntil(showForcedNotification({
        titolo: 'FWM',
        messaggio: 'Hai una nuova notifica',
        url: '/'
      }));
    }
  }
});

// Handler per click
self.addEventListener('notificationclick', function(event) {
  console.log('🔥 CLICK NOTIFICA NATIVA:', event);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
  }
});

// Override showNotification per forzare corpo
const originalShowNotification = self.registration.showNotification;
self.registration.showNotification = function(title, options = {}) {
  console.log('🔥 INTERCETTATO showNotification NATIVO:', title, options);
  
  // Forza il corpo se mancante
  if (!options.body || options.body.trim() === '') {
    options.body = options.contents?.it || options.message || 'Notifica FWM';
  }
  
  // Forza opzioni per visibilità massima
  options = {
    ...options,
    requireInteraction: true,
    silent: false,
    icon: options.icon || '/icona_notifiche.png',
    badge: options.badge || '/icona_notifiche.png',
    vibrate: options.vibrate || [200, 100, 200],
    actions: options.actions || [
      {
        action: 'open',
        title: '📱 Apri App'
      }
    ]
  };
  
  console.log('🔥 OPZIONI FORZATE NATIVE:', options);
  
  return originalShowNotification.call(this, title, options);
};

// Registra per background sync periodico
self.addEventListener('periodicsync', function(event) {
  console.log('🔄 Periodic sync:', event.tag);
  
  if (event.tag === 'notification-check') {
    event.waitUntil(checkForNotifications());
  }
});

// Controlla nuove notifiche
async function checkForNotifications() {
  console.log('🔍 Controllo nuove notifiche...');
  // Qui potresti implementare un check periodico del database
}

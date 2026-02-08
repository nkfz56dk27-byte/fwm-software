// Service Worker per gestire notifiche FCM in background
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')
importScripts('/active-tab-check.js')

console.log('🔧 Firebase Messaging Service Worker caricato')

// Handler per messaggi dal client (necessario per compatibilità Service Worker)
self.addEventListener('message', (event) => {
  // Puoi gestire qui i messaggi ricevuti dal client
  // Esempio: aggiorna qualcosa, rispondi, ecc.
  console.log('📩 Messaggio ricevuto nel SW:', event.data);
});

// Configurazione Firebase (stessa di firebase.js)
firebase.initializeApp({
  apiKey: "AIzaSyASYRYMo19ruUjkuootTVZGzm0ajjXqN70",
  authDomain: "fwm-notifiche.firebaseapp.com",
  projectId: "fwm-notifiche",
  storageBucket: "fwm-notifiche.firebasestorage.app",
  messagingSenderId: "422434674992",
  appId: "1:422434674992:web:b0561219198dd62cacd0f5"
})

const messaging = firebase.messaging()
console.log('✅ Firebase Messaging inizializzato nel Firebase SW')

// Gestisce notifiche FCM quando il browser/app è in background
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Notifica FCM ricevuta in background:', payload)
  
  const notificationTitle = payload.notification?.title || '🔔 Notifica'
  const notificationBody = payload.notification?.body || 'Hai una nuova notifica'
  const notificationData = payload.data || {}
  
  // Se la tab è attiva e visibile, non mostrare la notifica
  self.isTabActiveAndVisible().then(isActive => {
    if (isActive) {
      console.log('🔕 Tab attiva e visibile: non mostro la notifica FCM')
      return;
    }
    const notificationOptions = {
      body: notificationBody,
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      tag: notificationData.id || 'fwm-notification',
      requireInteraction: true,
      data: {
        url: notificationData.url || '/',
        ...notificationData
      },
      silent: false,
      actions: [
        { action: 'open', title: '📖 Apri' },
        { action: 'close', title: '✖️ Chiudi' }
      ]
    };
    console.log('🔔 Mostrando notifica FCM:', notificationTitle)
    self.registration.showNotification(notificationTitle, notificationOptions)
  });
})

// Gestisci i click sulle notifiche FCM
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Click notifica FCM:', event.notification.tag)
  
  if (event.action === 'close') {
    event.notification.close()
    return
  }
  
  event.notification.close()
  
  const url = event.notification.data?.url || '/'
  
  // Apri/Foca la finestra dell'app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Cerca una finestra già aperta
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i]
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        // Se non trovata, apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})

// Gestisci la chiusura delle notifiche
self.addEventListener('notificationclose', (event) => {
  console.log('✖️ Notifica FCM chiusa:', event.notification.tag)
})

// Installa il Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Firebase Messaging SW installato')
  self.skipWaiting()
})

// Attiva il Service Worker
self.addEventListener('activate', (event) => {
  console.log('✨ Firebase Messaging SW attivato')
  event.waitUntil(clients.claim())
})
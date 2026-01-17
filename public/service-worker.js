// Service Worker per gestire le notifiche push (FCM + Realtime)
// Questo file viene eseguito anche quando il browser/tab non è in focus

console.log('🔧 Service Worker caricato')

let notificationQueue = []

// Importa Firebase Messaging per il Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js')

// Inizializza Firebase nel Service Worker
const firebaseConfig = {
  apiKey: 'AIzaSyASYRYMo19ruUjkuootTVZGzm0ajjXqN70',
  authDomain: 'fwm-notifiche.firebaseapp.com',
  projectId: 'fwm-notifiche',
  storageBucket: 'fwm-notifiche.firebasestorage.app',
  messagingSenderId: '422434674992',
  appId: '1:422434674992:web:b0561219198dd62cacd0f5'
}

firebase.initializeApp(firebaseConfig)
const messaging = firebase.messaging()

console.log('✅ Firebase Cloud Messaging inizializzato nel SW')

// Gestisce i messaggi FCM ricevuti in background (quando la tab è chiusa)
messaging.onBackgroundMessage((payload) => {
  console.log('📬 FCM messaggio ricevuto in background:', payload)
  
  const notificationTitle = payload.notification?.title || '🔔 Notifica'
  const notificationOptions = {
    body: payload.notification?.body || 'Hai una nuova notifica',
    icon: payload.notification?.icon || '/press.png',
    badge: payload.notification?.badge || '/press.png',
    tag: payload.data?.id || 'notification',
    requireInteraction: true,
    data: payload.data || {}
  }
  
  console.log('🔔 SW mostrando notifica FCM:', notificationTitle)
  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Ascolta i messaggi dal client (pushNotificationService.js - Realtime)
self.addEventListener('message', (event) => {
  console.log('📬 SW ricevuto messaggio da client:', event.data)
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const notifica = event.data.notifica
    const options = {
      body: notifica.messaggio,
      icon: '/press.png',
      badge: '/press.png',
      tag: notifica.id,
      requireInteraction: true,
      data: {
        url: notifica.url || '/',
        id: notifica.id
      }
    }
    
    console.log('🔔 SW mostrando notifica Realtime:', notifica.titolo)
    
    // Mostra la notifica
    self.registration.showNotification(notifica.titolo, options)
      .then(() => {
        console.log('✅ Notifica Realtime mostrata dal SW')
        notificationQueue.push(notifica.id)
      })
      .catch(err => {
        console.error('❌ Errore mostrando notifica Realtime:', err)
      })
  }
})

// Ascolta i click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notifica cliccata:', event.notification.tag)
  event.notification.close()
  
  const url = event.notification.data?.url || '/'
  
  // Apri la finestra o foca la tab esistente
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      console.log('🔍 Finestre aperte:', clientList.length)
      
      // Cerca una finestra già aperta
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        console.log('📍 Client URL:', client.url)
        if ('focus' in client) {
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

// Ascolta i close delle notifiche
self.addEventListener('notificationclose', (event) => {
  console.log('✖️ Notifica chiusa:', event.notification.tag)
})

// Keep the service worker alive
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installato')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('✨ Service Worker attivato')
  event.waitUntil(clients.claim())
})


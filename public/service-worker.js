// Service Worker per gestire le notifiche push (FCM + Realtime + Background Sync)
// Questo file viene eseguito anche quando il browser/tab non è in focus
// Supporta: Notifiche background, Sync in background, Keep-alive

console.log('🔧 Service Worker principale caricato')

let notificationQueue = []
let isOnline = navigator.onLine
let clientInfo = {}

// Monitora la connessione online/offline
self.addEventListener('online', () => {
  console.log('🟢 Online - Service Worker attivo')
  isOnline = true
})

self.addEventListener('offline', () => {
  console.log('🔴 Offline - Notifiche in coda')
  isOnline = false
})

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

/**
 * Gestisce i messaggi FCM ricevuti in background (quando la tab è chiusa)
 * Funziona anche su iOS con PWA e Android Chrome
 */
messaging.onBackgroundMessage((payload) => {
  console.log('📬 FCM messaggio ricevuto in background:', payload)
  
  const notificationTitle = payload.notification?.title || '🔔 Notifica'
  const notificationBody = payload.notification?.body || 'Hai una nuova notifica'
  const notificationType = payload.data?.type || 'default'
  
  let iconUrl = '/icona_notifiche.png'
  let badgeUrl = '/icona_notifiche.png'
  
  // Personalizza l'icona in base al tipo di notifica
  if (payload.notification?.icon) {
    iconUrl = payload.notification.icon
  }
  
  // Opzioni notifica con supporto per mobile
  let notificationOptions = {
    body: notificationBody,
    icon: iconUrl,
    badge: badgeUrl,
    tag: payload.data?.id || `notification_${Date.now()}`,
    requireInteraction: true,
    silent: false,
    data: {
      url: payload.data?.url || '/',
      type: notificationType,
      id: payload.data?.id || `notif_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...payload.data
    },
    actions: []
  }
  
  // Aggiungi azioni in base al tipo di notifica
  if (notificationType === 'event') {
    notificationOptions.actions = [
      { action: 'accept', title: '✅ Accetta' },
      { action: 'decline', title: '❌ Rifiuta' }
    ]
  } else if (notificationType === 'message') {
    notificationOptions.actions = [
      { action: 'open', title: '📖 Apri' },
      { action: 'close', title: '✖️ Chiudi' }
    ]
  } else if (notificationType === 'reminder') {
    notificationOptions.tag = 'reminder'
    notificationOptions.actions = [
      { action: 'snooze', title: '⏰ Dopo 5 min' },
      { action: 'close', title: '✖️ Chiudi' }
    ]
  } else {
    notificationOptions.actions = [
      { action: 'open', title: '📖 Apri' }
    ]
  }
  
  console.log('🔔 SW mostrando notifica FCM:', notificationTitle)
  
  self.registration.showNotification(notificationTitle, notificationOptions)
    .then(() => {
      console.log('✅ Notifica FCM mostrata dal SW')
    })
    .catch(err => {
      console.error('❌ Errore mostrando notifica FCM:', err)
    })
})

/**
 * Ascolta i messaggi dal client (pushNotificationService.js - Realtime)
 */
self.addEventListener('message', (event) => {
  const data = event.data
  
  // Log dei messaggi ricevuti
  if (data?.type !== 'KEEP_ALIVE') {
    console.log('📬 SW ricevuto messaggio da client:', data)
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const notifica = event.data.notifica
    const options = {
      body: notifica.messaggio,
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      tag: notifica.id,
      requireInteraction: true,
      silent: false,
      data: {
        url: notifica.url || '/',
        id: notifica.id,
        timestamp: new Date().toISOString()
      },
      actions: [
        { action: 'open', title: '📖 Apri' },
        { action: 'close', title: '✖️ Chiudi' }
      ]
    }
    
    console.log('🔔 SW mostrando notifica Realtime:', notifica.titolo)
    
    // Mostra la notifica
    self.registration.showNotification(notifica.titolo, options)
      .then(() => {
        console.log('✅ Notifica Realtime mostrata dal SW')
        notificationQueue.push(notifica.id)
        
        // Mantieni il SW attivo per i prossimi messaggi
        if (event.ports && event.ports.length > 0) {
          event.ports[0].postMessage({ type: 'ACK' })
        }
      })
      .catch(err => {
        console.error('❌ Errore mostrando notifica Realtime:', err)
      })
  } else if (event.data?.type === 'KEEP_ALIVE') {
    // Mantieni il SW attivo per ricevere notifiche realtime
    console.log('❤️ Keep-alive dal client - SW attivo')
  } else if (event.data?.type === 'CLEAR_NOTIFICATIONS') {
    // Pulisci le notifiche quando richiesto
    console.log('🧹 Pulizia notifiche richiesta')
    notificationQueue = []
  }
})

/**
 * Gestisci i click sulle notifiche (sia FCM che Realtime)
 */
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notifica cliccata - Action:', event.action)
  
  const action = event.action
  const url = event.notification.data?.url || '/'
  const notifId = event.notification.tag
  
  // Gestisci le azioni specifiche
  if (action === 'close' || action === 'decline') {
    event.notification.close()
    return
  }
  
  if (action === 'snooze') {
    // Snooze per 5 minuti
    event.notification.close()
    setTimeout(() => {
      self.registration.showNotification(event.notification.title, {
        body: 'Reminder ripetuto dopo 5 minuti',
        ...event.notification.options
      })
    }, 5 * 60 * 1000)
    return
  }
  
  // Per tutte le altre azioni (open, accept, etc)
  event.notification.close()
  
  // Apri/Foca la finestra dell'app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        console.log('🔍 Finestre aperte:', clientList.length)
        
        // Cerca una finestra già aperta
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i]
          if ('focus' in client) {
            client.focus()
            // Manda il messaggio di click al client
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              notificationId: notifId,
              url: url,
              action: action
            })
            return
          }
        }
        
        // Se non trovata, apri una nuova finestra/tab
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
      .catch(err => {
        console.error('❌ Errore gestione click notifica:', err)
      })
  )
})

/**
 * Gestisci la chiusura delle notifiche
 */
self.addEventListener('notificationclose', (event) => {
  const notifId = event.notification.tag
  console.log('✖️ Notifica chiusa:', notifId)
  
  // Rimuovi dalla coda
  notificationQueue = notificationQueue.filter(id => id !== notifId)
  
  // Manda l'evento al client se è attivo
  clients.matchAll({ type: 'window' }).then(clientList => {
    clientList.forEach(client => {
      client.postMessage({
        type: 'NOTIFICATION_CLOSED',
        notificationId: notifId
      })
    })
  })
})

/**
 * Installa il Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installato')
  // Salta l'attesa e diventa subito attivo
  self.skipWaiting()
})

/**
 * Attiva il Service Worker e pulisce vecchie versioni
 */
self.addEventListener('activate', (event) => {
  console.log('✨ Service Worker attivato')
  // TEST: Mostra notifica statica all'attivazione
  event.waitUntil(
    self.registration.showNotification('🔔 Test Notifica SW', {
      body: 'Questa è una notifica di test dal Service Worker.',
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      data: { test: true }
    })
  );
  event.waitUntil(clients.claim())
})

/**
 * Supporto per Background Sync (sincronizzazione in background su Android)
 * Utile quando l'app viene riaperta dopo aver perso la connessione
 */
self.addEventListener('sync', (event) => {
  console.log('🔄 Background Sync richiesto:', event.tag)
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Qui puoi aggiungere logica per sincronizzare le notifiche
      Promise.resolve()
    )
  }
})

/**
 * Periodic Background Sync (per aggiornamenti periodici)
 * Nota: Disponibile solo su Android, non su iOS
 */
self.addEventListener('periodicsync', (event) => {
  console.log('⏰ Periodic Sync richiesto:', event.tag)
  
  if (event.tag === 'update-notifications') {
    event.waitUntil(
      // Qui puoi aggiungere logica per controllare nuove notifiche
      Promise.resolve()
    )
  }
})


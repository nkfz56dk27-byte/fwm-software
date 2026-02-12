// File rimosso: questo Service Worker non è più necessario per le notifiche web.
// Gestione notifiche web ora affidata solo a OneSignal.
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
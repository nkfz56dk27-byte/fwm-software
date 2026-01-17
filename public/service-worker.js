// Service Worker per gestire le notifiche push
// Questo file viene eseguito anche quando il browser/tab non è in focus

console.log('🔧 Service Worker caricato')

let notificationQueue = []

// Ascolta i messaggi dal client (pushNotificationService.js)
self.addEventListener('message', (event) => {
  console.log('📬 SW ricevuto messaggio:', event.data)
  
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
    
    console.log('🔔 SW mostrando notifica:', notifica.titolo)
    
    // Mostra la notifica
    self.registration.showNotification(notifica.titolo, options)
      .then(() => {
        console.log('✅ Notifica mostrata dal SW')
        notificationQueue.push(notifica.id)
      })
      .catch(err => {
        console.error('❌ Errore mostrando notifica:', err)
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


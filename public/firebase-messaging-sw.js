// Service Worker per gestire notifiche in background
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// Configurazione Firebase (stessa di firebase.js)
firebase.initializeApp({
  apiKey: "AIzaSyDb3oiIZKryEp0vcoIw2Qem5By5KL7rM6s",
  authDomain: "fwm-software.firebaseapp.com",
  projectId: "fwm-software",
  storageBucket: "fwm-software.firebasestorage.app",
  messagingSenderId: "432548991978",
  appId: "1:432548991978:web:f2ccacda120778d38e5893"
})

const messaging = firebase.messaging()

// Gestisce notifiche quando il sito è chiuso
messaging.onBackgroundMessage((payload) => {
  console.log('📬 Notifica in background:', payload)
  
  const notificationTitle = payload.notification.title
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/press.png',
    badge: '/press.png',
    tag: 'fwm-notification',
    requireInteraction: true
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

// Apri il sito quando clicchi sulla notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow('https://localhost:5173/calendario')
  )
})
import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDb3oiIZKryEp0vcoIw2Qem5By5KL7rM6s",
  authDomain: "fwm-software.firebaseapp.com",
  projectId: "fwm-software",
  storageBucket: "fwm-software.firebasestorage.app",
  messagingSenderId: "432548991978",
  appId: "1:432548991978:web:f2ccacda120778d38e5893"
}

const app = initializeApp(firebaseConfig)
const messaging = getMessaging(app)

}

// Gestisci notifiche in foreground (quando il sito è aperto)
export function ascoltaNotifiche(callback) {
  onMessage(messaging, (payload) => {
    console.log('📬 Notifica ricevuta:', payload)
    
    // Mostra notifica anche se il sito è aperto
    if (Notification.permission === 'granted') {
      new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icona_notifiche.png',
        badge: '/icona_notifiche.png'
      })
    }
    
    // Callback per aggiornare l'UI
    if (callback) callback(payload)
  })
}

export { messaging }
// Firebase Configuration
// Cloud Messaging per notifiche push a livello di sistema operativo

import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyASYRYMo19ruUjkuootTVZGzm0ajjXqN70',
  authDomain: 'fwm-notifiche.firebaseapp.com',
  projectId: 'fwm-notifiche',
  storageBucket: 'fwm-notifiche.firebasestorage.app',
  messagingSenderId: '422434674992',
  appId: '1:422434674992:web:b0561219198dd62cacd0f5'
}

// Inizializza Firebase
const app = initializeApp(firebaseConfig)

// Inizializza Cloud Messaging
let messaging = null
try {
  messaging = getMessaging(app)
  console.log('✅ Firebase Cloud Messaging inizializzato')
} catch (error) {
  console.warn('⚠️ FCM non disponibile:', error.message)
}

export { app, messaging, getToken, onMessage }

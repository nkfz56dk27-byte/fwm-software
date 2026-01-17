import { supabase } from '../supabaseClient'
// Salva o aggiorna il token FCM su Supabase
export async function salvaTokenFCM(token, browserInfo = navigator.userAgent) {
  if (!token) return;
  try {
    await supabase.from('firebase_tokens').upsert({
      token,
      browser_info: browserInfo,
      last_updated: new Date().toISOString()
    }, { onConflict: 'token' })
    console.log('✅ Token FCM salvato su Supabase:', token)
  } catch (err) {
    console.error('❌ Errore salvataggio token FCM:', err)
  }
}
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

// Richiedi permesso e ottieni token
export async function richiediPermessoNotifiche() {
  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BGvqYWgPKX88CXE1ZfhyCTnsgsgjvrK0FxO-007YdC-3t96_khYZjlG9HiNO5SFKx1VhAoPyQwHGaqnBW-vwW_0'
      })
      console.log('🔔 Token notifiche:', token)
      await salvaTokenFCM(token)
      return token
    } else {
      console.log('❌ Permesso notifiche negato')
      return null
    }
  } catch (error) {
    console.error('Errore richiesta permesso:', error)
    return null
  }
}
// Aggiorna il token FCM su Supabase quando cambia
import { onTokenRefresh } from 'firebase/messaging'
onTokenRefresh(messaging, async () => {
  const token = await getToken(messaging)
  await salvaTokenFCM(token)
})
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
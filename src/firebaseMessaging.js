// Firebase Cloud Messaging - Gestione delle notifiche push
// Richiede permessi e gestisce i token FCM

import { messaging, getToken, onMessage } from './firebase'

/**
 * Richiede il permesso e ottiene il token FCM
 * @param {string} username
 * @returns {Promise<string|null>}
 */
export async function getFirebaseToken(username) {
  if (!messaging) {
    console.warn('⚠️ Firebase Messaging non disponibile')
    return null
  }

  try {
    // Richiedi permesso notifiche
    if (Notification.permission === 'denied') {
      console.warn('❌ Permesso notifiche rifiutato')
      return null
    }

    let permission = Notification.permission
    if (permission !== 'granted') {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
      console.warn('⚠️ Permesso notifiche non concesso')
      return null
    }

    console.log('✅ Permesso notifiche concesso')

    // Ottieni il token FCM
    const token = await getToken(messaging, {
      vapidKey: 'BKjxqPsqJXqfAyLFJJ6uE-0RjhLfQFyZ6sZ8x4QZ8t4Y9K_Q9Z9Z9Z9Z9Z9Z9Z9Z9Z9'
    })

    if (token) {
      console.log('✅ Firebase Token ottenuto:', token.substring(0, 20) + '...')
      
      // Salva il token su Supabase per tracking
      await saveFirebaseToken(username, token)
      
      return token
    } else {
      console.warn('⚠️ Token FCM non disponibile')
      return null
    }
  } catch (error) {
    console.error('❌ Errore ottenimento token FCM:', error)
    return null
  }
}

/**
 * Salva il token FCM su Supabase
 */
async function saveFirebaseToken(username, token) {
  try {
    const { supabase } = await import('./supabaseClient')
    
    const { error } = await supabase.from('firebase_tokens').upsert({
      username: username,
      token: token,
      browser_info: navigator.userAgent.substring(0, 100),
      last_updated: new Date().toISOString()
    }, {
      onConflict: 'username,token'
    })

    if (error) {
      console.warn('⚠️ Errore salvataggio token:', error.message)
    } else {
      console.log('✅ Token Firebase salvato')
    }
  } catch (error) {
    console.error('⚠️ Non critico - errore salvataggio token:', error.message)
  }
}

/**
 * Ascolta i messaggi FCM ricevuti quando l'app è in foreground
 */
export function setupForegroundMessaging(callback) {
  if (!messaging) {
    console.warn('⚠️ Firebase Messaging non disponibile')
    return
  }

  onMessage(messaging, (payload) => {
    console.log('📬 FCM messaggio ricevuto in foreground:', payload)
    
    const notifica = {
      titolo: payload.notification?.title || '🔔 Notifica',
      messaggio: payload.notification?.body || '',
      url: payload.data?.url || '/',
      id: payload.messageId
    }
    
    // Chiama il callback
    if (callback) {
      callback(notifica)
    }
  })
}

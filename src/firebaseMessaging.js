// Firebase Cloud Messaging - Gestione delle notifiche push
// Richiede permessi e gestisce i token FCM

import { messaging, getToken, onMessage } from './firebase'

/**
 * Richiede il permesso e ottiene il token FCM
 * @param {string} username
 * @returns {Promise<string|null>}
 */
export async function getFirebaseToken(username, user_uid = null) {
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
      vapidKey: 'BJGXWXkiYyFKydho7dfS3wr83G_z2FIHJ1tCzgUsWTcLeYQFPdrCVk55Hy1XtqOvVxtkEL6HvthoH52klD8L_yU'
    })

    if (token) {
      console.log('✅ Firebase Token ottenuto:', token.substring(0, 20) + '...')
      
      // Salva il token su Supabase per tracking
      await saveFirebaseToken(username, token, user_uid)
      
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
async function saveFirebaseToken(username, token, user_uid = null) {
  try {
    const { supabase } = await import('./supabaseClient')
    // Log sessione utente
    const sessionResult = await supabase.auth.getSession();
    console.log('[DEBUG] Sessione Supabase prima di upsert token:', sessionResult);
    // Usa user_uid passato dalla funzione, se non c'è prova a prenderlo dalla sessione
    let final_user_uid = user_uid;
    if (!final_user_uid) {
      final_user_uid = sessionResult?.data?.session?.user?.id || null;
    }

    // Log dati inviati
    const payload = {
      username: username,
      token: token,
      browser_info: navigator.userAgent.substring(0, 100),
      last_updated: new Date().toISOString(),
      user_uid: final_user_uid
    };
    console.log('[DEBUG] Payload upsert token:', payload);

    const { data, error } = await supabase.from('firebase_tokens').upsert(payload, {
      onConflict: 'username,token'
    });

    // Log risposta Supabase
    console.log('[DEBUG] Risposta upsert token:', { data, error });

    if (error) {
      console.warn('⚠️ Errore salvataggio token:', error.message, error);
    } else {
      console.log('✅ Token Firebase salvato')
    }
  } catch (error) {
    console.error('⚠️ Non critico - errore salvataggio token:', error.message, error)
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

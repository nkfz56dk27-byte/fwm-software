// Firebase Cloud Messaging - Gestione delle notifiche push
// Richiede permessi e gestisce i token FCM

import { messaging, getToken, onMessage } from './firebase'

/**
 * Richiede il permesso e ottiene il token FCM
 * @param {string} username
 * @returns {Promise<string|null>}
 */
export async function getFirebaseToken(username, user_uid = null) {
  console.log('[LOG] getFirebaseToken INIZIO', { username, user_uid, messaging, permission: Notification.permission });
  if (!messaging) {
    console.warn('⚠️ Firebase Messaging non disponibile', { messaging });
    return null;
  }

  try {
    // Richiedi permesso notifiche
    if (Notification.permission === 'denied') {
      console.warn('❌ Permesso notifiche rifiutato', { permission: Notification.permission });
      return null;
    }

    let permission = Notification.permission;
    console.log('[LOG] Stato permission iniziale:', permission);
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
      console.log('[LOG] Permission richiesta, nuovo stato:', permission);
    }

    if (permission !== 'granted') {
      console.warn('⚠️ Permesso notifiche non concesso', { permission });
      return null;
    }

    console.log('✅ Permesso notifiche concesso', { permission });

    // Ottieni il token FCM
    const token = await getToken(messaging, {
      vapidKey: 'BJGXWXkiYyFKydho7dfS3wr83G_z2FIHJ1tCzgUsWTcLeYQFPdrCVk55Hy1XtqOvVxtkEL6HvthoH52klD8L_yU'
    });
    console.log('[LOG] getToken chiamato', { token });

    if (token) {
      console.log('✅ Firebase Token ottenuto:', token.substring(0, 20) + '...', { token });
      // Salva il token su Supabase per tracking
      await saveFirebaseToken(username, token, user_uid);
      return token;
    } else {
      console.warn('⚠️ Token FCM non disponibile', { token });
      return null;
    }
  } catch (error) {
    console.error('❌ Errore ottenimento token FCM:', error, { username, user_uid });
    return null;
  }
}

/**
 * Salva il token FCM su Supabase
 */
async function saveFirebaseToken(username, token, user_uid = null) {
  console.log('[LOG] saveFirebaseToken INIZIO', { username, token, user_uid });
  try {
    const { supabase } = await import('./supabaseClient');
    console.log('[LOG] Modulo supabase importato', { supabase });
    // Log sessione utente
    const sessionResult = await supabase.auth.getSession();
    console.log('[DEBUG] Sessione Supabase prima di upsert token:', sessionResult);
    // Log dettagli sessione
    if (!sessionResult || !sessionResult.data || !sessionResult.data.session) {
      console.warn('[WARN] Nessuna sessione attiva!', { sessionResult });
    } else {
      console.log('[LOG] Sessione attiva:', sessionResult.data.session);
    }
    // Usa user_uid passato dalla funzione, se non c'è prova a prenderlo dalla sessione
    let final_user_uid = user_uid;
    if (!final_user_uid) {
      final_user_uid = sessionResult?.data?.session?.user?.id || null;
      console.log('[LOG] Ricavato final_user_uid dalla sessione:', final_user_uid);
    }
    // Log dati inviati

    // Recupera device_id dal localStorage (come fa getDeviceId)
    let deviceId = null;
    try {
      deviceId = localStorage.getItem('fwm_device_id');
    } catch (e) {
      // fallback: deviceId non disponibile
    }
    if (!deviceId) {
      // fallback: genera un id temporaneo (non dovrebbe mai servire)
      deviceId = 'unknown-device';
    }

    const payload = {
      username: username,
      token: token,
      device_id: deviceId,
      browser_info: navigator.userAgent.substring(0, 100),
      last_updated: new Date().toISOString(),
      user_uid: final_user_uid
    };
    console.log('[DEBUG] Payload upsert token:', payload);

    // Log pre-query
    console.log('[LOG] Chiamo upsert su firebase_tokens con payload:', payload);
    const { data, error } = await supabase.from('firebase_tokens').upsert(payload, {
      onConflict: 'username,device_id'
    });

    // Log risposta Supabase
    console.log('[DEBUG] Risposta upsert token:', { data, error });

    if (error) {
      console.warn('⚠️ Errore salvataggio token:', error.message, error, { payload, sessionResult });
    } else {
      console.log('✅ Token Firebase salvato', { data });
    }
  } catch (error) {
    console.error('⚠️ Non critico - errore salvataggio token:', error.message, error, { username, token, user_uid });
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

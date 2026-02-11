/**
 * Invia una notifica push di test al player_id specificato
 * @param {string} playerId - Player ID OneSignal
 * @param {string} titolo - Titolo della notifica
 * @param {string} messaggio - Messaggio della notifica
 */
export async function inviaNotificaPushTest(playerId, titolo = 'Test Push', messaggio = 'Questa è una notifica di test') {
  const ONESIGNAL_APP_ID = '32bc9e36-a2ac-449c-a07c-70168b9b3e37'; // Sostituisci con il tuo app_id se diverso
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY || '';
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: [playerId],
    headings: { en: titolo },
    contents: { en: messaggio },
    data: { test: true }
  };
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  console.log('[TEST PUSH] Risposta OneSignal:', result);
  return result;
}
/**
 * Inserisce una notifica nella tabella push_notifications (OneSignal pipeline)
 * @param {Object} param0 - Oggetto con i dati della notifica
 * @param {string} param0.title - Titolo della notifica
 * @param {string} param0.body - Corpo della notifica
 * @param {string} [param0.notification_type] - Tipo di notifica (es: disponibilita_weekend)
 * @param {boolean} [param0.target_all] - Se true, invia a tutti
 * @param {string[]} [param0.target_users] - Array di username destinatari (opzionale)
 * @param {Object} [param0.data] - Dati aggiuntivi (opzionale)
 * @returns {Promise<{id?: number, error?: any}>}
 */
export async function inserisciNotificaPush({ title, body, notification_type = 'info', target_all = false, target_users = null, data = {} }) {
  try {
    const { data: insertData, error } = await supabase.from('push_notifications').insert({
      title,
      body,
      notification_type,
      target_all,
      target_users,
      data,
      status: 'pending',
      created_at: new Date().toISOString()
    }).select().single();
    if (error) {
      return { error };
    }
    return { id: insertData?.id };
  } catch (error) {
    return { error };
  }
}
// Sistema di notifiche push realtime con Supabase
// Registra dispositivi e ascolta notifiche in tempo reale

import { supabase } from './supabaseClient'

/**
 * Rilevare il tipo di dispositivo
 */
function detectDeviceType() {
  const ua = navigator.userAgent
  if (/mobile|android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase())) {
    if (/ipad|android(?!.*mobi)|android.*tablet/i.test(ua.toLowerCase())) {
      return 'tablet'
    }
    return 'mobile'
  }
  return 'desktop'
}

/**
 * Genera un ID unico per il dispositivo
 */
function generateDeviceId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  const userAgent = navigator.userAgent.substring(0, 30)
  return `${userAgent}_${timestamp}_${random}`
}

/**
 * Ottieni il device ID, creandolo se non esiste
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem('fwm_device_id')
  if (!deviceId) {
    deviceId = generateDeviceId()
    localStorage.setItem('fwm_device_id', deviceId)
    console.log('📱 Device ID creato:', deviceId)
  }
  return deviceId
}

/**
 * Registra il dispositivo per ricevere notifiche
 * @param {string} username - Username dell'utente
 * @returns {Promise<boolean>}
 */
export async function registraDispositivoNotifiche(username) {
  try {
    console.log('[DEBUG] Inizio registraDispositivoNotifiche per', username);
    const deviceId = getDeviceId();
    const deviceType = detectDeviceType();
    const browserInfo = `${username} - ${navigator.userAgent.substring(0, 50)} - ${new Date().toLocaleString('it-IT')}`;
    console.log('[DEBUG] deviceId:', deviceId, '| deviceType:', deviceType, '| browserInfo:', browserInfo);

    // Recupera player_id OneSignal dal browser (tutti i metodi noti)
    let playerId = null;
    let errorMsg = '';
    try {
      console.log('[DEBUG] Tentativo METODO 1 - User.PushSubscription.id');
      if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
        playerId = await window.OneSignal.User.PushSubscription.id;
        console.log('[OneSignal] METODO 1 - User.PushSubscription.id:', playerId);
      }
      console.log('[DEBUG] Tentativo METODO 2 - User.onesignalId');
      if (!playerId && window.OneSignal && window.OneSignal.User && window.OneSignal.User.onesignalId) {
        playerId = await window.OneSignal.User.onesignalId;
        console.log('[OneSignal] METODO 2 - User.onesignalId:', playerId);
      }
      console.log('[DEBUG] Tentativo METODO 3 - getSubscriptionId');
      if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscriptionId === 'function') {
        playerId = await window.OneSignal.getSubscriptionId();
        console.log('[OneSignal] METODO 3 - getSubscriptionId:', playerId);
      }
      console.log('[DEBUG] Tentativo METODO 4 - getUserId');
      if (!playerId && window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
        playerId = await window.OneSignal.getUserId();
        console.log('[OneSignal] METODO 4 - getUserId:', playerId);
      }
      console.log('[DEBUG] Tentativo METODO 5 - getSubscription');
      if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscription === 'function') {
        const subscription = await window.OneSignal.getSubscription();
        playerId = subscription?.id || null;
        console.log('[OneSignal] METODO 5 - getSubscription:', subscription);
      }
    } catch (e) {
      errorMsg = e.message || e.toString();
      console.warn('[OneSignal] Errore durante il recupero player_id:', errorMsg);
    }

    if (!playerId) {
      const msg = '❌ [OneSignal] player_id non ottenuto con nessun metodo.' + (errorMsg ? ' Errore: ' + errorMsg : '');
      console.warn(msg);
      alert(msg);
      return false;
    } else {
      alert('✅ [OneSignal] Player ID ottenuto: ' + playerId);
    }

    // Salva il dispositivo su Supabase solo se player_id trovato
    // Pulizia duplicati: elimina tutte le righe con stesso username e device_id prima di upsert
    console.log('[DEBUG] Pulizia duplicati push_devices per', username, deviceId);
    const deleteResult = await supabase.from('push_devices')
      .delete()
      .eq('username', username)
      .eq('device_id', deviceId);
    console.log('🧹 Pulizia duplicati push_devices:', deleteResult);

    const upsertPayload = {
      username: username,
      device_id: deviceId,
      device_type: deviceType,
      browser_info: browserInfo,
      ultimo_accesso: new Date().toISOString(),
      attivo: true,
      player_id: playerId
    };
    console.log('⬆️ Upsert push_devices payload:', upsertPayload);
    const { error } = await supabase.from('push_devices').upsert(upsertPayload, {
      onConflict: 'username,device_id'
    });
    if (error) {
      console.warn('⚠️ Errore upsert push_devices:', error);
      alert('⚠️ Errore salvataggio push_devices: ' + (error.message || error.toString()));
    } else {
      console.log('✅ Upsert push_devices completato');
      alert('✅ Dispositivo mobile registrato su Supabase!');
    }

    // Aggiorna player_id se era null (per utenti già registrati)
    // Retry già gestito sopra, non serve timeout aggiuntivo

    console.log('✅ Dispositivo registrato per notifiche:', { username, deviceId })
    return true
  } catch (error) {
    console.error('❌ Errore registrazione dispositivo:', error)
    return false
  }
}

/**
 * Ascolta le notifiche in tempo reale per l'utente corrente
 * @param {string} username - Username dell'utente
 * @param {Function} callback - Funzione da chiamare quando arriva una notifica
 * @returns {Function} Funzione per stoppare l'ascolto
 */
export function ascolaNotificheRealtime(username, callback) {
  try {
    console.log(`👂 Inizio ascolto notifiche per ${username}`)

    const subscription = supabase
      .channel(`notifiche_${username}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifiche_push',
        filter: `destinatario=eq.${username}`
      }, (payload) => {
        console.log('🔔 Notifica ricevuta:', payload.new)
        
        // Mostra la notifica nativa
        const notifica = payload.new
        console.log('🔐 Permesso notifiche:', Notification.permission)
        
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            // Prova a mostrare via Service Worker (funziona anche quando la tab non è in focus)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              console.log('📡 Inviando notifica via Service Worker')
              navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                notifica: notifica
              })
            } else {
              // Fallback: Notifica nativa direttamente (visibile solo se la tab è in focus)
              const notification = new Notification(notifica.titolo, {
                body: notifica.messaggio,
                icon: '/icona_notifiche.png',
                badge: '/icona_notifiche.png',
                tag: notifica.id,
                requireInteraction: true
              })
              console.log('✅ Notifica nativa creata:', notifica.titolo)
              console.log('📢 Notifica visibile - clicca per interagire')

              // Gestisci il click sulla notifica
              notification.onclick = () => {
                if (notifica.url) {
                  window.location.href = notifica.url
                }
                notification.close()
              }
            }
          } catch (error) {
            console.error('❌ Errore creazione notifica:', error)
          }
        } else {
          // Se il permesso non è granted, mostra un alert
          console.warn('⚠️ Permesso notifiche non concesso. Permesso attuale:', Notification.permission)
          alert(`📢 Notifica: ${notifica.titolo}\n${notifica.messaggio}`)
        }

        // Chiama il callback
        if (callback) {
          callback(notifica)
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Sottoscritto a notifiche realtime')
          // Manda un ping al SW per mantenerlo attivo
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'KEEP_ALIVE'
            })
          }
        }
      })

    // Restituisci funzione per stoppare l'ascolto
    return () => {
      subscription.unsubscribe()
      console.log('❌ Ascolto notifiche stoppato')
    }
  } catch (error) {
    console.error('❌ Errore ascolto notifiche:', error)
    return () => {}
  }
}

/**
 * Invia una notifica a uno specifico utente
 * La notifica viene inviata a TUTTI i dispositivi registrati dell'utente
 * @param {string} destinatario - Username del destinatario
 * @param {Object} options - Opzioni della notifica
 * @param {string} options.titolo - Titolo della notifica
 * @param {string} options.messaggio - Corpo del messaggio
 * @param {string} options.url - URL da aprire al click (opzionale)
 * @param {Object} options.data - Dati aggiuntivi (opzionale)
 * @returns {Promise<boolean>}
 */
export async function inviaNotificaAUtente(destinatario, options) {
  try {
    const { titolo, messaggio, url = '/', data = {} } = options

    console.log(`📤 Invio notifica a ${destinatario}:`, { titolo, messaggio })

    const { data: insertData, error } = await supabase.from('notifiche_push').insert({
      destinatario: destinatario,
      titolo: titolo,
      messaggio: messaggio,
      url: url,
      data: data,
      letta: false,
      created_at: new Date().toISOString()
    })

    if (error) {
      console.error('❌ Errore invio notifica:', error)
      return false
    }

    console.log('✅ Notifica inviata a:', destinatario)
    return true
  } catch (error) {
    console.error('❌ Errore invio notifica:', error)
    return false
  }
}

/**
 * Disabilita le notifiche per il dispositivo corrente
 * @param {string} username
 * @returns {Promise<boolean>}
 */
export async function disabilitaNotifiche(username) {
  try {
    const deviceId = getDeviceId()

    const { error } = await supabase
      .from('push_devices')
      .update({ attivo: false })
      .eq('username', username)
      .eq('device_id', deviceId)

    if (error) throw error

    console.log('✅ Notifiche disabilitate')
    return true
  } catch (error) {
    console.error('❌ Errore disabilitazione notifiche:', error)
    return false
  }
}

/**
 * Ottieni tutti i dispositivi attivi di un utente
 * @param {string} username
 * @returns {Promise<Array>}
 */
export async function getDispositiviUtente(username) {
  try {
    const { data, error } = await supabase
      .from('push_devices')
      .select('*')
      .eq('username', username)
      .eq('attivo', true)
      .order('ultimo_accesso', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('❌ Errore recupero dispositivi:', error)
    return []
  }
}

// Funzione di test FCM per browser
  export async function sendPushNotification({ title, body, url = '/', data = {} }) {
    try {
      const apiUrl =
        window.location.hostname === 'localhost'
          ? 'http://localhost:3000/api/send-notification'
          : '/api/send-notification';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, body, url, data })
      });
      if (!res.ok) throw new Error('Errore invio notifica');
      return await res.json();
    } catch (err) {
      console.error('Errore invio notifica:', err);
      return { success: false, error: err.message };
    }
  }
export async function testFCMPushSetup() {
  try {
    const token = await import('./firebase').then(m => m.richiediPermessoNotifiche())
    if (token) {
      alert('✅ Token FCM generato!\n' + token)
      console.log('✅ Token FCM:', token)
    } else {
      alert('❌ Permesso notifiche negato o errore')
      console.warn('❌ Permesso notifiche negato o errore')
    }
  } catch (err) {
    alert('❌ Errore test FCM: ' + err)
    console.error('❌ Errore test FCM:', err)
  }
}

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
    const deviceId = getDeviceId()
    const deviceType = detectDeviceType()
    const browserInfo = `${username} - ${navigator.userAgent.substring(0, 50)} - ${new Date().toLocaleString('it-IT')}`

    // Recupera player_id OneSignal dal browser (se disponibile)
    let playerId = null;
    let tentativi = 0;
    const maxTentativi = 15;
    while (!playerId && tentativi < maxTentativi) {
      tentativi++;
      if (window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
        try {
          playerId = await window.OneSignal.getUserId();
          console.log(`🎯 [OneSignal] player_id tentativo ${tentativi}:`, playerId);
          if (!playerId) {
            console.warn(`⚠️ [OneSignal] player_id non ottenuto al tentativo ${tentativi}`);
            await new Promise(res => setTimeout(res, 2000));
          }
        } catch (e) {
          console.warn(`⚠️ [OneSignal] Errore recupero player_id al tentativo ${tentativi}:`, e);
          await new Promise(res => setTimeout(res, 2000));
        }
      } else {
        console.warn('⚠️ OneSignal non inizializzato o getUserId non disponibile.');
        break;
      }
    }
    if (!playerId) {
      console.warn('❌ [OneSignal] player_id non ottenuto dopo tutti i tentativi.');
    }

    // Salva il dispositivo su Supabase
    // Pulizia duplicati: elimina tutte le righe con stesso username e device_id prima di upsert
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
    } else {
      console.log('✅ Upsert push_devices completato');
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

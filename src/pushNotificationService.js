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

    // Salva il dispositivo su Supabase
    const { error } = await supabase.from('push_devices').upsert({
      username: username,
      device_id: deviceId,
      device_type: deviceType,
      browser_info: browserInfo,
      ultimo_accesso: new Date().toISOString(),
      attivo: true
    }, {
      onConflict: 'username,device_id'
    })

    if (error) {
      console.error('❌ Errore registrazione device:', error)
      return false
    }

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
      const res = await fetch('/api/send-notification', {
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

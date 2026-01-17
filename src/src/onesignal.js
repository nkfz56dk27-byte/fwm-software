// OneSignal SDK Integration - Web Push Notifications
// Supporta: Desktop e Mobile push notifications

const ONESIGNAL_APP_ID = 'os_v2_app_gk6j4nvcvrcjzid4oalixgz6g5hixkki7lxezn5zocmjx62jajrodin74o2ddebyw36a2map5rprjbrq5h4p6intqgxzjfwfu6isrpy' // App ID OneSignal

let oneSignalInitialized = false

/**
 * Inizializza OneSignal per le notifiche push
 * Deve essere chiamato una sola volta all'avvio
 */
export async function initializeOneSignal() {
  if (oneSignalInitialized) {
    console.log('✅ OneSignal già inizializzato')
    return true
  }

  try {
    // Verifica se OneSignal è disponibile globalmente
    if (!window.OneSignal) {
      console.log('📦 Caricamento OneSignal SDK...')
      await loadOneSignalSDK()
    }

    if (!window.OneSignal) {
      throw new Error('OneSignal SDK non disponibile dopo il caricamento')
    }

    // Inizializza OneSignal con la nuova API
    await window.OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: '/OneSignalSDKWorker.js'
    })

    console.log('✅ OneSignal inizializzato con successo')
    oneSignalInitialized = true
    return true
  } catch (error) {
    console.error('❌ Errore inizializzazione OneSignal:', error)
    return false
  }
}

/**
 * Carica lo script OneSignal dal CDN
 */
function loadOneSignalSDK() {
  return new Promise((resolve, reject) => {
    if (window.OneSignal) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.charset = 'utf-8'

    script.onload = () => {
      console.log('✅ OneSignal SDK script caricato')
      resolve()
    }

    script.onerror = () => {
      console.error('❌ Errore caricamento OneSignal SDK')
      reject(new Error('Errore caricamento OneSignal SDK'))
    }

    document.head.appendChild(script)
  })
}

/**
 * Richiede il permesso per le notifiche push
 * @returns {Promise<boolean>}
 */
export async function richiediPermessoNotifiche() {
  try {
    if (!oneSignalInitialized) {
      const success = await initializeOneSignal()
      if (!success) {
        console.warn('⚠️ OneSignal non inizializzato')
        return false
      }
    }

    // Usa l'API nativa del browser per richiedere i permessi
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        console.log('✅ Permesso notifiche già concesso')
        return true
      }

      if (Notification.permission === 'denied') {
        console.log('❌ Permesso notifiche rifiutato in precedenza')
        return false
      }

      // Richiedi il permesso
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        console.log('✅ Permesso notifiche concesso!')
        
        // Imposta il tag dell'utente in OneSignal per il tracking
        if (window.OneSignal) {
          try {
            await setUserTags({ notifiche_abilitate: 'true' })
          } catch (e) {
            console.log('⚠️ Errore impostazione tag OneSignal (non critico)')
          }
        }
        
        return true
      } else {
        console.log('❌ Permesso notifiche negato')
        return false
      }
    } else {
      console.warn('⚠️ Notifiche non supportate da questo browser')
      return false
    }
  } catch (error) {
    console.error('❌ Errore richiesta permesso:', error)
    return false
  }
}

/**
 * Imposta i tag personalizzati per l'utente
 * @param {Object} tags
 */
export async function setUserTags(tags) {
  try {
    if (!oneSignalInitialized || !window.OneSignal) {
      console.warn('⚠️ OneSignal non inizializzato')
      return false
    }

    await window.OneSignal.api.parseSubscription()
    await window.OneSignal.setTags(tags)
    console.log('✅ Tag utente impostati:', tags)
    return true
  } catch (error) {
    console.error('❌ Errore impostazione tag:', error)
    return false
  }
}

/**
 * Ottiene l'ID del dispositivo (Player ID)
 * @returns {Promise<string|null>}
 */
export async function getPlayerId() {
  try {
    if (!oneSignalInitialized || !window.OneSignal) {
      console.warn('⚠️ OneSignal non inizializzato')
      return null
    }

    // Ottieni l'ID della subscription push
    const playerId = await window.OneSignal.getSubscriptionId?.() || 
                     window.OneSignal.getUserId?.() ||
                     null
    
    if (playerId) {
      console.log('✅ Player ID ottenuto:', playerId)
      return playerId
    } else {
      console.log('⚠️ Player ID non disponibile')
      return null
    }
  } catch (error) {
    console.error('❌ Errore recupero Player ID:', error)
    return null
  }
}

/**
 * Verifica se l'utente ha il permesso per le notifiche
 * @returns {Promise<boolean>}
 */
export async function hasNotificationPermission() {
  try {
    if (!oneSignalInitialized || !window.OneSignal) {
      return false
    }

    const permission = await window.OneSignal.Notifications.permission
    return permission === true
  } catch (error) {
    console.error('❌ Errore verifica permesso:', error)
    return false
  }
}


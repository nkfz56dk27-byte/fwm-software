/**
 * Gestore nativo delle notifiche per iOS e Android PWA
 * Fornisce un wrapper per la Web Push API e il supporto nativo dei dispositivi
 */

/**
 * Richiedi permesso per le notifiche e registra il Service Worker per PWA
 * @param {string} username - Username dell'utente
 * @returns {Promise<boolean>}
 */
export async function initializeNativeNotifications(username) {
  try {
    // Verifica il supporto delle notifiche
    if (!('Notification' in window)) {
      console.warn('⚠️ Le notifiche non sono supportate su questo dispositivo')
      return false
    }

    // Se il permesso è già stato negato, non chiedere di nuovo
    if (Notification.permission === 'denied') {
      console.warn('❌ Le notifiche sono state negate dall\'utente')
      return false
    }

    // Richiedi il permesso se non è stato ancora concesso
    let permission = Notification.permission
    if (permission !== 'granted') {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
      console.warn('⚠️ Permesso notifiche non concesso')
      return false
    }

    console.log('✅ Permesso notifiche concesso')

    // Registra il Service Worker se disponibile (per Web Push)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        console.log('✅ Service Worker pronto per le notifiche')

        // Per iOS: abilita le notifiche via Web Push
        if (isIOS()) {
          console.log('📱 Configurazione notifiche per iOS')
          setupIOSNotifications(username)
        }

        // Per Android: abilita le notifiche via Web Push e FCM
        if (isAndroid()) {
          console.log('🤖 Configurazione notifiche per Android')
          setupAndroidNotifications(username)
        }

        return true
      } catch (error) {
        console.error('⚠️ Errore Service Worker:', error)
        return false
      }
    }

    return true
  } catch (error) {
    console.error('❌ Errore inizializzazione notifiche native:', error)
    return false
  }
}

/**
 * Richiedi l'abbonamento a Web Push per le notifiche in background
 * @returns {Promise<PushSubscription|null>}
 */
export async function subscribeToPushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('⚠️ Web Push non supportato')
      return null
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      console.log('✅ Già sottoscritto a Web Push')
      return subscription
    }

    // Se non sottoscritto, crea una nuova sottoscrizione
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        'BJGXWXkiYyFKydho7dfS3wr83G_z2FIHJ1tCzgUsWTcLeYQFPdrCVk55Hy1XtqOvVxtkEL6HvthoH52klD8L_yU'
      )
    })

    console.log('✅ Nuova sottoscrizione Web Push creata')
    return subscription
  } catch (error) {
    console.error('❌ Errore sottoscrizione Web Push:', error)
    return null
  }
}

/**
 * Ottieni la sottoscrizione corrente a Web Push
 * @returns {Promise<PushSubscription|null>}
 */
export async function getPushSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null
    }

    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch (error) {
    console.error('❌ Errore recupero sottoscrizione:', error)
    return null
  }
}

/**
 * Cancella la sottoscrizione a Web Push
 * @returns {Promise<boolean>}
 */
export async function unsubscribeFromPushNotifications() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      await subscription.unsubscribe()
      console.log('✅ Sottoscrizione Web Push cancellata')
      return true
    }

    return false
  } catch (error) {
    console.error('❌ Errore cancellazione sottoscrizione:', error)
    return false
  }
}

/**
 * Configura le notifiche specifiche per iOS
 * iOS richiede una gestione speciale tramite PWA
 */
function setupIOSNotifications(username) {
  try {
    // iOS supporta le notifiche attraverso una PWA con manifest.json
    // Verifica che il manifest sia stato caricato
    const manifestLink = document.querySelector('link[rel="manifest"]')
    if (!manifestLink) {
      console.warn('⚠️ Manifest non trovato per iOS PWA')
    }

    // Per iOS 16.4+: supporto migliorato per PWA
    // Abilita le notifiche tramite localStorage per tracking
    localStorage.setItem('fwm_ios_notifications_enabled', 'true')
    localStorage.setItem('fwm_notifications_username', username)
    console.log('✅ Notifiche iOS configurate')
  } catch (error) {
    console.error('❌ Errore configurazione iOS:', error)
  }
}

/**
 * Configura le notifiche specifiche per Android
 * Android supporta sia Web Push che FCM
 */
function setupAndroidNotifications(username) {
  try {
    // Ottieni la sottoscrizione Web Push per Android
    subscribeToPushNotifications()
      .then(subscription => {
        if (subscription) {
          console.log('✅ Web Push sottoscritto su Android')
          // Puoi salvare l'endpoint su Supabase per invii server-side
          localStorage.setItem('fwm_push_endpoint', subscription.endpoint)
        }
      })
      .catch(err => console.error('⚠️ Errore Web Push Android:', err))

    // Abilita anche FCM (già gestito dal firebase)
    localStorage.setItem('fwm_android_notifications_enabled', 'true')
    localStorage.setItem('fwm_notifications_username', username)
    console.log('✅ Notifiche Android configurate')
  } catch (error) {
    console.error('❌ Errore configurazione Android:', error)
  }
}

/**
 * Controlla se il dispositivo è iOS
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
}

/**
 * Controlla se il dispositivo è Android
 */
function isAndroid() {
  return /android/i.test(navigator.userAgent)
}

/**
 * Controlla se il dispositivo è un mobile
 */
function isMobile() {
  return isIOS() || isAndroid()
}

/**
 * Converti una VAPID key da base64 a Uint8Array
 * Necessario per la sottoscrizione a Web Push
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

/**
 * Mostra una notifica di test (per debug)
 */
export async function showTestNotification(title, options = {}) {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service Worker non disponibile')
      return
    }

    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      ...options
    })

    console.log('✅ Notifica di test mostrata')
  } catch (error) {
    console.error('❌ Errore notifica di test:', error)
  }
}

/**
 * Ascolta i messaggi dal Service Worker
 */
export function setupNotificationMessageListener(callback) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'NOTIFICATION_CLICK') {
        console.log('📬 Notifica cliccata dal SW:', event.data)
        if (callback) {
          callback(event.data)
        }
      }
    })
  }
}

export default {
  initializeNativeNotifications,
  subscribeToPushNotifications,
  getPushSubscription,
  unsubscribeFromPushNotifications,
  setupNotificationMessageListener,
  showTestNotification,
  isIOS,
  isAndroid,
  isMobile
}

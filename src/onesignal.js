// Configurazione OneSignal per notifiche push cross-platform
// Supporta: iOS Safari, macOS, Windows, Android

const ONESIGNAL_APP_ID = '929f6f6156-9a35-4a5f-900c-4e77e881e899'

let oneSignalInitialized = false

/**
 * Aspetta che OneSignal sia caricato dall'HTML
 */
function waitForOneSignal() {
  return new Promise((resolve, reject) => {
    if (window.OneSignalDeferred) {
      resolve()
      return
    }

    const checkLoaded = setInterval(() => {
      if (window.OneSignalDeferred) {
        clearInterval(checkLoaded)
        resolve()
      }
    }, 100)
    
    // Timeout dopo 10 secondi
    setTimeout(() => {
      clearInterval(checkLoaded)
      if (!window.OneSignalDeferred) {
        reject(new Error('OneSignal SDK failed to load from HTML'))
      }
    }, 10000)
  })
}

/**
 * Inizializza OneSignal per le notifiche push
 * Da chiamare una sola volta all'avvio dell'app
 */
export async function initializeOneSignal() {
  if (oneSignalInitialized) {
    console.log('✅ OneSignal già inizializzato')
    return
  }

  try {
    console.log('🔔 Inizializzazione OneSignal...')
    
    // Aspetta che lo script OneSignal sia caricato dall'HTML
    await waitForOneSignal()
    
    // Inizializza OneSignal (UNA SOLA VOLTA)
    await window.OneSignalDeferred.push(async function(OneSignal) {
      // Controlla se è già inizializzato
      try {
        const currentPermission = await OneSignal.Notifications.permission
        if (currentPermission !== undefined) {
          console.log('✅ OneSignal già inizializzato dal sistema')
          oneSignalInitialized = true
          return
        }
      } catch (e) {
        // Non è ancora inizializzato, procediamo
      }

      // Inizializza
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        safari_web_id: 'web.onesignal.auto.929f6f6156-9a35-4a5f-900c-4e77e881e899',
        notifyButton: {
          enable: false // Non mostriamo il bottone di OneSignal, usiamo il nostro
        },
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: {
          scope: '/'
        },
        serviceWorkerPath: '/OneSignalSDKWorker.js'
      })

      console.log('✅ OneSignal inizializzato con successo')
      oneSignalInitialized = true

      // Debug: mostra lo stato del permesso
      const permission = await OneSignal.Notifications.permission
      console.log('📱 Stato permesso notifiche:', permission)
    })
  } catch (error) {
    console.error('❌ Errore inizializzazione OneSignal:', error)
  }
}

/**
 * Richiede il permesso per le notifiche push
 * Mostra il prompt nativo del browser/sistema operativo
 * @returns {Promise<boolean>} true se il permesso è stato concesso
 */
export async function richiediPermessoNotifiche() {
  try {
    if (!oneSignalInitialized) {
      console.warn('⚠️ OneSignal non ancora inizializzato')
      await initializeOneSignal()
    }

    // Verifica se il permesso è già stato concesso
    const permission = await window.OneSignalDeferred.push(async function(OneSignal) {
      return await OneSignal.Notifications.permission
    })

    if (permission) {
      console.log('✅ Permesso notifiche già concesso')
      return true
    }

    // Richiedi il permesso
    const result = await window.OneSignalDeferred.push(async function(OneSignal) {
      return await OneSignal.Notifications.requestPermission()
    })

    if (result) {
      console.log('✅ Permesso notifiche concesso!')
      
      // Ottieni il Player ID (serve per targeting specifico se necessario)
      const playerId = await window.OneSignalDeferred.push(async function(OneSignal) {
        return await OneSignal.User.PushSubscription.id
      })
      console.log('📱 Player ID:', playerId)
      
      return true
    } else {
      console.log('❌ Permesso notifiche negato')
      return false
    }
  } catch (error) {
    console.error('❌ Errore richiesta permesso:', error)
    return false
  }
}

/**
 * Verifica se l'utente ha già concesso il permesso
 * @returns {Promise<boolean>}
 */
export async function hasNotificationPermission() {
  try {
    if (!oneSignalInitialized) return false
    
    const permission = await window.OneSignalDeferred.push(async function(OneSignal) {
      return await OneSignal.Notifications.permission
    })
    
    return permission === true
  } catch (error) {
    console.error('❌ Errore verifica permesso:', error)
    return false
  }
}

/**
 * Ottiene l'ID del giocatore (player ID) per targeting specifico
 * @returns {Promise<string|null>}
 */
export async function getPlayerId() {
  try {
    if (!oneSignalInitialized) return null
    
    const playerId = await window.OneSignalDeferred.push(async function(OneSignal) {
      return await OneSignal.User.PushSubscription.id
    })
    
    return playerId
  } catch (error) {
    console.error('❌ Errore recupero Player ID:', error)
    return null
  }
}

/**
 * Imposta tag personalizzati per l'utente (utile per targeting)
 * @param {Object} tags - Oggetto con chiave-valore dei tag
 * @example setUserTags({ username: 'giuseppe', ruolo: 'admin' })
 */
export async function setUserTags(tags) {
  try {
    if (!oneSignalInitialized) {
      console.warn('⚠️ OneSignal non inizializzato')
      return
    }

    await window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.User.addTags(tags)
    })
    
    console.log('✅ Tag utente impostati:', tags)
  } catch (error) {
    console.error('❌ Errore impostazione tag:', error)
  }
}

/**
 * Rimuove i tag dell'utente
 * @param {string[]} tagKeys - Array di chiavi da rimuovere
 */
export async function removeUserTags(tagKeys) {
  try {
    if (!oneSignalInitialized) return

    await window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.User.removeTags(tagKeys)
    })
    
    console.log('✅ Tag rimossi:', tagKeys)
  } catch (error) {
    console.error('❌ Errore rimozione tag:', error)
  }
}

/**
 * Disabilita le notifiche per l'utente corrente
 */
export async function disableNotifications() {
  try {
    if (!oneSignalInitialized) return

    await window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.User.PushSubscription.optOut()
    })
    
    console.log('✅ Notifiche disabilitate')
  } catch (error) {
    console.error('❌ Errore disabilitazione notifiche:', error)
  }
}

/**
 * Riabilita le notifiche per l'utente corrente
 */
export async function enableNotifications() {
  try {
    if (!oneSignalInitialized) return

    await window.OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.User.PushSubscription.optIn()
    })
    
    console.log('✅ Notifiche riabilitate')
  } catch (error) {
    console.error('❌ Errore riabilitazione notifiche:', error)
  }
}

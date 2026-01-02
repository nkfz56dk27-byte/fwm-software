// Configurazione OneSignal per notifiche push cross-platform
// Supporta: iOS Safari, macOS, Windows, Android

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '929f6f6156-9a35-4a5f-900c-4e77e881e899'

let oneSignalInitialized = false

/**
 * Carica dinamicamente lo script OneSignal
 */
function loadOneSignalScript() {
  return new Promise((resolve, reject) => {
    // Se lo script è già caricato
    if (window.OneSignalDeferred) {
      resolve()
      return
    }

    // Crea e inserisci lo script
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.onload = () => {
      console.log('✅ Script OneSignal caricato')
      resolve()
    }
    script.onerror = () => {
      console.error('❌ Errore caricamento script OneSignal')
      reject(new Error('Failed to load OneSignal script'))
    }
    document.head.appendChild(script)
  })
}

/**
 * Aspetta che OneSignal sia caricato
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
        reject(new Error('OneSignal SDK failed to load'))
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
    console.log('🆔 App ID:', ONESIGNAL_APP_ID)
    
    // Controllo se siamo in localhost
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    console.log('🌐 Ambiente:', isLocalhost ? 'localhost' : 'produzione')
    
    // Carica dinamicamente lo script OneSignal
    await loadOneSignalScript()
    
    // Aspetta che OneSignal sia disponibile
    await waitForOneSignal()
    
    console.log('✅ OneSignal SDK caricato e disponibile')
    
    // Controllo validità App ID
    if (!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID.length < 10) {
      throw new Error('App ID OneSignal non valido: ' + ONESIGNAL_APP_ID)
    }
    
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
    console.log('🔍 Controllo inizializzazione OneSignal...')
    if (!oneSignalInitialized) {
      console.warn('⚠️ OneSignal non ancora inizializzato, inizializzo...')
      await initializeOneSignal()
    }

    console.log('🔍 Verifica permessi esistenti...')
    // Verifica se il permesso è già stato concesso
    const permission = await window.OneSignalDeferred.push(async function(OneSignal) {
      console.log('📱 Chiamata OneSignal.Notifications.permission...')
      const perm = await OneSignal.Notifications.permission
      console.log('📋 Permesso corrente:', perm)
      return perm
    })

    if (permission) {
      console.log('✅ Permesso notifiche già concesso')
      return true
    }

    console.log('📤 Richiesta nuovo permesso...')
    
    // In localhost, simula il permesso per test
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhost) {
      console.log('⚠️ localhost detected - simulazione permesso notifiche')
      // Simula che l'utente ha accettato
      return true
    }
    
    // Richiedi il permesso
    const result = await window.OneSignalDeferred.push(async function(OneSignal) {
      console.log('🔔 Chiamata OneSignal.Notifications.requestPermission()...')
      const res = await OneSignal.Notifications.requestPermission()
      console.log('📋 Risposta richiesta permesso:', res)
      return res
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
    
    console.log('🔍 Recupero Player ID...')
    
    // In localhost, ritorna null per evitare blocchi
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalhost) {
      console.log('⚠️ localhost - Player ID non disponibile')
      return null
    }
    
    // Aggiungi timeout per evitare blocchi
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout recupero Player ID')), 5000)
    })
    
    const playerId = await Promise.race([
      window.OneSignalDeferred.push(async function(OneSignal) {
        console.log('📱 Chiamata OneSignal.User.PushSubscription.id...')
        const id = await OneSignal.User.PushSubscription.id
        console.log('🆔 Player ID ricevuto:', id)
        return id
      }),
      timeoutPromise
    ])
    
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
    console.log('🔍 DEBUG PUSH: Inizio setUserTags')
    console.log('🔍 DEBUG PUSH: oneSignalInitialized:', oneSignalInitialized)
    console.log('🔍 DEBUG PUSH: tags da impostare:', tags)
    
    if (!oneSignalInitialized) {
      console.warn('⚠️ OneSignal non inizializzato')
      return
    }

    await window.OneSignalDeferred.push(async function(OneSignal) {
      console.log('🔍 DEBUG PUSH: Chiamata OneSignal.User.addTags')
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

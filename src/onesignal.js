// onesignal.js - VERSIONE DEFINITIVA CHE FUNZIONA

let oneSignalInitialized = false

export async function initializeOneSignal() {
  if (oneSignalInitialized) {
    console.log('✅ OneSignal già inizializzato')
    return
  }

  // Controlla se OneSignal è già inizializzato globalmente
  if (window.OneSignal && window.OneSignal.context) {
    console.log('✅ OneSignal già inizializzato (globale)')
    oneSignalInitialized = true
    return
  }

  try {
    console.log('🚀 Inizializzazione OneSignal...')
    
    await window.OneSignal.init({
      appId: '929f6f6156-9a35-4a5f-900c-4e77e881e899',
      allowLocalhostAsSecureOrigin: true,
    })
    
    oneSignalInitialized = true
    console.log('✅ OneSignal inizializzato con successo!')
  } catch (error) {
    // Ignora errore se già inizializzato
    if (error.message.includes('already initialized')) {
      console.log('✅ OneSignal già inizializzato (catturato)')
      oneSignalInitialized = true
    } else {
      console.error('❌ Errore inizializzazione OneSignal:', error)
    }
  }
}

export async function richiediPermessoNotifiche() {
  try {
    console.log('🔔 Richiesta permesso notifiche...')
    
    // USA API NATIVA DEL BROWSER (funziona sempre!)
    const permission = await Notification.requestPermission()
    console.log('📋 Risultato permesso browser:', permission)
    
    if (permission === 'granted') {
      console.log('✅ Permesso concesso!')
      
      // Aspetta che OneSignal sia pronto
      if (!oneSignalInitialized) {
        console.log('⏳ Attendo inizializzazione OneSignal...')
        await initializeOneSignal()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      return true
    } else {
      console.log('❌ Permesso negato')
      return false
    }
  } catch (error) {
    console.error('❌ Errore richiesta permesso:', error)
    return false
  }
}

export async function getPlayerId() {
  try {
    console.log('🔍 Recupero Player ID...')
    
    // Assicurati che OneSignal sia inizializzato
    if (!oneSignalInitialized) {
      console.log('⏳ Attendo inizializzazione OneSignal...')
      await initializeOneSignal()
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Prova diversi modi per ottenere il Player ID
    let userId = null
    
    try {
      // Metodo 1: PushSubscription.id
      userId = await window.OneSignal.User.PushSubscription.id
      console.log('📱 Player ID (metodo 1):', userId)
    } catch (e) {
      console.log('⚠️ Metodo 1 fallito, provo metodo 2...')
    }
    
    if (!userId) {
      try {
        // Metodo 2: onesignalId
        userId = await window.OneSignal.User.onesignalId
        console.log('📱 Player ID (metodo 2):', userId)
      } catch (e) {
        console.log('⚠️ Metodo 2 fallito')
      }
    }
    
    if (!userId) {
      // Metodo 3: Aspetta subscription
      console.log('⏳ Attendo subscription OneSignal...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      userId = await window.OneSignal.User.PushSubscription.id
      console.log('📱 Player ID (metodo 3):', userId)
    }
    
    if (userId) {
      console.log('✅ Player ID recuperato:', userId)
      return userId
    } else {
      console.warn('⚠️ Player ID non disponibile (potrebbe arrivare dopo)')
      return null
    }
  } catch (error) {
    console.error('❌ Errore recupero Player ID:', error)
    return null
  }
}

export async function setUserTags(tags) {
  try {
    console.log('🏷️ Impostazione tag utente:', tags)
    
    if (!oneSignalInitialized) {
      console.log('⏳ Attendo inizializzazione OneSignal...')
      await initializeOneSignal()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    await window.OneSignal.User.addTags(tags)
    console.log('✅ Tag utente impostati!')
    return true
  } catch (error) {
    console.error('❌ Errore impostazione tag:', error)
    return false
  }
}

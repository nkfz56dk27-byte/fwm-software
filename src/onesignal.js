// onesignal.js - VERSIONE CORRETTA

let oneSignalInitialized = false

export async function initializeOneSignal() {
  if (oneSignalInitialized) {
    console.log('⚠️ OneSignal già inizializzato')
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
    console.error('❌ Errore inizializzazione OneSignal:', error)
  }
}

export async function richiediPermessoNotifiche() {
  try {
    console.log('🔍 Controllo inizializzazione OneSignal...')
    
    if (!oneSignalInitialized) {
      console.log('⏳ OneSignal non ancora inizializzato, attendo...')
      await initializeOneSignal()
    }

    console.log('🔍 Verifica permessi esistenti...')
    console.log('📱 Chiamata OneSignal.Notifications.permission...')
    
    const hasPermission = await window.OneSignal.Notifications.permission
    console.log('📋 Permesso corrente:', hasPermission)

    if (hasPermission) {
      console.log('✅ Permesso già concesso!')
      return true
    }

    console.log('📤 Richiesta nuovo permesso...')
    console.log('🔔 Chiamata OneSignal.Notifications.requestPermission()...')
    
    // CORREZIONE: requestPermission() ritorna direttamente true/false
    const result = await window.OneSignal.Notifications.requestPermission()
    
    console.log('📋 Risultato requestPermission:', result)
    
    if (result) {
      console.log('✅ Permesso concesso!')
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
    
    if (!oneSignalInitialized) {
      console.log('⏳ Attendo inizializzazione OneSignal...')
      await initializeOneSignal()
      // Aspetta un po' per essere sicuri
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Usa l'API corretta di OneSignal
    const userId = await window.OneSignal.User.PushSubscription.id
    
    console.log('📱 Player ID recuperato:', userId)
    return userId
  } catch (error) {
    console.error('❌ Errore recupero Player ID:', error)
    return null
  }
}

export async function setUserTags(tags) {
  try {
    console.log('🔍 DEBUG PUSH: Inizio setUserTags')
    console.log('🔍 DEBUG PUSH: oneSignalInitialized:', oneSignalInitialized)
    console.log('🔍 DEBUG PUSH: tags da impostare:', tags)
    
    if (!oneSignalInitialized) {
      console.log('⏳ OneSignal non inizializzato, attendo...')
      await initializeOneSignal()
    }

    console.log('🔍 DEBUG PUSH: Chiamata OneSignal.User.addTags')
    await window.OneSignal.User.addTags(tags)
    
    console.log('✅ Tag utente impostati:', tags)
    return true
  } catch (error) {
    console.error('❌ Errore impostazione tag:', error)
    return false
  }
}

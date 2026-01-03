let oneSignalInitialized = false

export async function initializeOneSignal() {
  // STUB: OneSignal inizializzato in App.jsx, non qui
  console.log('⏭️ initializeOneSignal chiamato ma OneSignal già inizializzato in App.jsx')
  return
}

export async function richiediPermessoNotifiche() {
  try {
    console.log('🔔 Richiesta permesso notifiche...')
    
    // Se già concesso, registra OneSignal e ritorna
    if (Notification.permission === 'granted') {
      console.log('✅ Permesso già concesso!')
      
      // Aspetta e prova a registrare su OneSignal
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ OneSignal subscription registrata!')
      } catch (e) {
        console.log('ℹ️ optIn non disponibile:', e.message)
      }
      
      return true
    }
    
    // Richiedi permesso browser NATIVO (funziona sempre)
    console.log('📱 Richiesta permesso browser nativo...')
    const permission = await Notification.requestPermission()
    console.log('📱 Permesso risposta:', permission)
    
    if (permission === 'granted') {
      console.log('✅ Permesso browser concesso!')
      
      // Aspetta che OneSignal sia pronto
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Registra su OneSignal
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ OneSignal subscription registrata!')
      } catch (e) {
        console.log('ℹ️ optIn fallito:', e.message)
        // Non è critico, continua comunque
      }
      
      return true
    }
    
    console.log('❌ Permesso browser negato')
    return false
    
  } catch (error) {
    console.error('❌ Errore richiesta permesso:', error)
    return false
  }
}

export async function getPlayerId() {
  try {
    console.log('🔍 Attendo subscription OneSignal...')
    
    // Aspetta fino a 30 secondi che appaia un ID (importante per iOS PWA)
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      let userId = null
      
      try {
        userId = window.OneSignal.User.PushSubscription.id
      } catch (e) {}
      
      if (!userId) {
        try {
          userId = window.OneSignal.User.PushSubscription.token
        } catch (e) {}
      }
      
      if (!userId) {
        try {
          userId = await window.OneSignal.User.onesignalId
        } catch (e) {}
      }
      
      if (userId) {
        console.log('✅ Player ID trovato:', userId)
        return userId
      }
      
      console.log(`⏳ Tentativo ${i+1}/30...`)
    }
    
    console.log('⚠️ Player ID non trovato dopo 30 secondi')
    return null
    
  } catch (error) {
    console.error('❌ Errore:', error)
    return null
  }
}

export async function setUserTags(tags) {
  try {
    await window.OneSignal.User.addTags(tags)
    return true
  } catch (error) {
    return false
  }
}


let oneSignalInitialized = false

export async function initializeOneSignal() {
  // STUB: OneSignal inizializzato in App.jsx, non qui
  console.log('⏭️ initializeOneSignal chiamato ma OneSignal già inizializzato in App.jsx')
  return
}

export async function richiediPermessoNotifiche() {
  try {
    // IMPORTANTE: Su iOS PWA, DEVE usare il prompt nativo OneSignal!
    // Chiamiamo Slidedown.promptPush che mostra il prompt OneSignal
    console.log('🔔 Triggero prompt nativo OneSignal...')
    
    try {
      // Questo mostrerà il prompt nativo OneSignal
      await window.OneSignal.Slidedown.promptPush()
      console.log('✅ Prompt nativo OneSignal triggerato!')
      
      // Aspetta che l'utente risponda
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Verifica se ha accettato
      if (Notification.permission === 'granted') {
        console.log('✅ Permesso concesso!')
        return true
      } else {
        console.log('❌ Permesso negato')
        return false
      }
    } catch (e) {
      console.log('⚠️ Slidedown non disponibile, uso fallback:', e.message)
      
      // Fallback: richiesta diretta
      if (Notification.permission === 'granted') {
        console.log('✅ Permesso già concesso!')
        return true
      }
      
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    
  } catch (error) {
    console.error('❌ Errore:', error)
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


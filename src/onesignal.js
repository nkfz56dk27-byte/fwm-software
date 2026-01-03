let oneSignalInitialized = false

export async function initializeOneSignal() {
  // STUB: OneSignal inizializzato in App.jsx, non qui
  console.log('⏭️ initializeOneSignal chiamato ma OneSignal già inizializzato in App.jsx')
  return
}

export async function richiediPermessoNotifiche() {
  try {
    if (Notification.permission === 'granted') {
      console.log('✅ Permesso già concesso!')
      
      // Aspetta che OneSignal sia pronto e registralo
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // IMPORTANTE: Registra esplicitamente OneSignal
      try {
        await window.OneSignal.Slidedown.promptPush()
      } catch (e) {
        console.log('ℹ️ Slidedown.promptPush non disponibile')
      }
      
      try {
        await window.OneSignal.User.PushSubscription.optIn()
      } catch (e) {
        console.log('ℹ️ PushSubscription.optIn non disponibile')
      }
      
      return true
    }
    
    const permission = await Notification.requestPermission()
    
    if (permission === 'granted') {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // IMPORTANTE: Registra esplicitamente OneSignal dopo permesso
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ OneSignal subscription registrata!')
      } catch (e) {
        console.log('ℹ️ Errore optIn:', e.message)
      }
      
      return true
    }
    return false
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


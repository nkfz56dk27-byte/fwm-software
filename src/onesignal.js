let oneSignalInitialized = false

export async function initializeOneSignal() {
  if (oneSignalInitialized || (window.OneSignal && window.OneSignal.context)) {
    return
  }

  try {
    await window.OneSignal.init({
      appId: '929f6f6156-9a35-4a5f-900c-4e77e881e899',
      allowLocalhostAsSecureOrigin: true,
    })
    oneSignalInitialized = true
  } catch (error) {
    oneSignalInitialized = true
  }
}

export async function richiediPermessoNotifiche() {
  try {
    if (Notification.permission === 'granted') {
      console.log('✅ Permesso già concesso!')
      
      // Aspetta che OneSignal sia pronto
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      return true
    }
    
    const permission = await Notification.requestPermission()
    
    if (permission === 'granted') {
      await new Promise(resolve => setTimeout(resolve, 2000))
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
    
    // Aspetta fino a 10 secondi che appaia un ID
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 500))
      
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
      
      console.log(`⏳ Tentativo ${i+1}/20...`)
    }
    
    console.log('⚠️ Player ID non trovato dopo 10 secondi')
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

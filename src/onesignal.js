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
    if (error.message.includes('already initialized')) {
      oneSignalInitialized = true
    }
  }
}

export async function richiediPermessoNotifiche() {
  try {
    // CONTROLLA SE GIÀ CONCESSO
    if (Notification.permission === 'granted') {
      console.log('✅ Permesso già concesso!')
      
      if (!oneSignalInitialized) {
        await initializeOneSignal()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ Push subscription attivata')
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (e) {
        console.log('⚠️ Subscription già attiva')
      }
      
      return true
    }
    
    const permission = await Notification.requestPermission()
    
    if (permission === 'granted') {
      if (!oneSignalInitialized) {
        await initializeOneSignal()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ Push subscription attivata')
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (e) {
        console.log('⚠️ Subscription già attiva')
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
    if (!oneSignalInitialized) {
      await initializeOneSignal()
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    let userId = window.OneSignal.User.PushSubscription.token
    
    if (!userId) {
      userId = window.OneSignal.User.PushSubscription.id
    }
    
    if (!userId) {
      userId = await window.OneSignal.User.onesignalId
    }
    
    console.log('📱 Player ID finale:', userId)
    return userId || null
    
  } catch (error) {
    console.error('❌ Errore:', error)
    return null
  }
}

export async function setUserTags(tags) {
  try {
    if (!oneSignalInitialized) {
      await initializeOneSignal()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    await window.OneSignal.User.addTags(tags)
    return true
  } catch (error) {
    return false
  }
}

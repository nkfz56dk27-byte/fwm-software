let oneSignalInitialized = false

export async function initializeOneSignal() {
  if (oneSignalInitialized || (window.OneSignal && window.OneSignal.context)) {
    console.log('⏭️ OneSignal già inizializzato')
    return
  }

  try {
    console.log('🔧 Inizializzazione OneSignal...')
    await window.OneSignal.init({
      appId: '929f6f6156-9a35-4a5f-900c-4e77e881e899',
      allowLocalhostAsSecureOrigin: true,
    })
    oneSignalInitialized = true
    console.log('✅ OneSignal init completato')
  } catch (error) {
    if (error.message.includes('already initialized')) {
      oneSignalInitialized = true
      console.log('✅ OneSignal già inizializzato (catch)')
    } else {
      console.error('❌ Errore init:', error)
    }
  }
}

export async function richiediPermessoNotifiche() {
  try {
    console.log('📋 Notification.permission:', Notification.permission)
    
    if (Notification.permission === 'granted') {
      console.log('✅ Permesso già concesso!')
      
      if (!oneSignalInitialized) {
        console.log('⏳ Inizializzo OneSignal...')
        await initializeOneSignal()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      console.log('🔔 Attivo push subscription...')
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ optIn() completato')
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (e) {
        console.log('⚠️ optIn() errore:', e.message)
      }
      
      console.log('🎯 Ritorno true da richiediPermessoNotifiche')
      return true
    }
    
    console.log('📤 Richiedo permesso...')
    const permission = await Notification.requestPermission()
    console.log('📋 Permesso ricevuto:', permission)
    
    if (permission === 'granted') {
      if (!oneSignalInitialized) {
        await initializeOneSignal()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      try {
        await window.OneSignal.User.PushSubscription.optIn()
        console.log('✅ optIn() completato')
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch (e) {
        console.log('⚠️ optIn() errore:', e.message)
      }
      
      return true
    }
    return false
  } catch (error) {
    console.error('❌ Errore richiediPermessoNotifiche:', error)
    return false
  }
}

export async function getPlayerId() {
  try {
    console.log('🔍 getPlayerId INIZIO')
    
    if (!oneSignalInitialized) {
      console.log('⏳ Inizializzo OneSignal per getPlayerId...')
      await initializeOneSignal()
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    console.log('⏳ Aspetto 3 secondi...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('📡 Tento recupero Player ID...')
    let userId = window.OneSignal.User.PushSubscription.token
    console.log('🔹 token:', userId)
    
    if (!userId) {
      userId = window.OneSignal.User.PushSubscription.id
      console.log('🔹 id:', userId)
    }
    
    if (!userId) {
      userId = await window.OneSignal.User.onesignalId
      console.log('🔹 onesignalId:', userId)
    }
    
    console.log('📱 Player ID FINALE:', userId)
    return userId || null
    
  } catch (error) {
    console.error('❌ Errore getPlayerId:', error)
    return null
  }
}

export async function setUserTags(tags) {
  try {
    console.log('🏷️ setUserTags INIZIO:', tags)
    
    if (!oneSignalInitialized) {
      await initializeOneSignal()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    await window.OneSignal.User.addTags(tags)
    console.log('✅ setUserTags COMPLETATO')
    return true
  } catch (error) {
    console.error('❌ Errore setUserTags:', error)
    return false
  }
}

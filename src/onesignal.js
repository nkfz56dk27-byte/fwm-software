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
    oneSignalInitialized = true
    console.log('✅ OneSignal già inizializzato (catch)')
  }
}

export async function richiediPermessoNotifiche() {
  try {
    console.log('📋 Notification.permission:', Notification.permission)
    
    if (Notification.permission === 'granted') {
      console.log('✅ Permesso già concesso!')
      
      // NON reinizializzare, è già fatto in App.jsx
      console.log('⏭️ Skip inizializzazione (già fatto)')
      
      console.log('🔔 Attivo push subscription...')
      try {
        const optInPromise = window.OneSignal.User.PushSubscription.optIn()
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 3000)
        )
        
        await Promise.race([optInPromise, timeoutPromise])
        console.log('✅ optIn() completato')
      } catch (e) {
        console.log('⚠️ optIn() timeout/errore (ignoro):', e.message)
      }
      
      console.log('🎯 Ritorno true')
      return true
    }
    
    console.log('📤 Richiedo permesso...')
    const permission = await Notification.requestPermission()
    
    if (permission === 'granted') {
      try {
        await window.OneSignal.User.PushSubscription.optIn()
      } catch (e) {
        console.log('⚠️ optIn() errore (ignoro)')
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
    console.log('🔍 getPlayerId INIZIO')
    
    console.log('⏳ Aspetto 3 secondi...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('📡 Recupero Player ID...')
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
    console.error('❌ Errore:', error)
    return null
  }
}

export async function setUserTags(tags) {
  try {
    console.log('🏷️ setUserTags:', tags)
    await window.OneSignal.User.addTags(tags)
    console.log('✅ Tag impostati')
    return true
  } catch (error) {
    console.error('❌ Errore:', error)
    return false
  }
}

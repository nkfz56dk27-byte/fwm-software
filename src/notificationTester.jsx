// Fallback globale: definisci window.username all'import se non esiste
if (typeof window !== 'undefined' && !window.username) {
  window.username = sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user';
}
// dummy change to trigger deploy
/**
 * Helper per testare le notifiche in background
 * Aggiungi questo codice nella console DevTools per testare
 */

// TEST 1: Controlla il supporto delle notifiche
export async function testNotificationSupport() {
  console.log('🧪 TEST 1: Supporto Notifiche')
  console.log('- Notification API:', 'Notification' in window)
  console.log('- Service Workers:', 'serviceWorker' in navigator)
  console.log('- Push Manager:', 'PushManager' in window)
  console.log('- Permesso attuale:', Notification.permission)
}

// TEST 2: Registra il Service Worker
export async function testServiceWorkerRegistration() {
  console.log('🧪 TEST 2: Registrazione Service Worker')
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers non supportati')
    return false
  }
  
  try {
    // Registrazione service worker custom rimossa per compatibilità OneSignal
    console.log('✅ Service Worker registrato:', reg)
    return true
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return false
  }
}

// TEST 3: Ottieni il Firebase Token
export async function testFirebaseToken() {
  console.log('🧪 TEST 3: Firebase Token')
  
  try {
    const { messaging, getToken } = await import('./firebase')
    
    if (!messaging) {
      console.warn('Firebase Messaging non disponibile')
      return null
    }
    
    const token = await getToken(messaging, {
      vapidKey: 'BJGXWXkiYyFKydho7dfS3wr83G_z2FIHJ1tCzgUsWTcLeYQFPdrCVk55Hy1XtqOvVxtkEL6HvthoH52klD8L_yU'
    })
    
    console.log('✅ Firebase Token ottenuto:', token ? token.substring(0, 30) + '...' : 'NULL')
    return token
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return null
  }
}

// TEST 4: Mostra una notifica di test
export async function testShowNotification() {
  console.log('🧪 TEST 4: Mostra Notifica Di Test')
  
  if (Notification.permission !== 'granted') {
    console.warn('Permesso notifiche non concesso')
    return false
  }
  
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('🧪 Test Notifica', {
        body: 'Questa è una notifica di test - Cliccami!',
        icon: '/android-chrome-512x512.png',
        badge: '/android-chrome-512x512.png',
        tag: 'test-notification',
        requireInteraction: true
      })
      console.log('✅ Notifica di test mostrata')
      return true
    }
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return false
  }
}

// TEST 5: Sottoscrivi a Web Push
export async function testWebPushSubscription() {
  console.log('🧪 TEST 5: Web Push Subscription')
  
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Web Push non supportato')
    return null
  }
  
  try {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    
    if (subscription) {
      console.log('✅ Già sottoscritto a Web Push')
      console.log('Endpoint:', subscription.endpoint.substring(0, 50) + '...')
      return subscription
    } else {
      console.log('⚠️ Non sottoscritto a Web Push')
      return null
    }
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return null
  }
}

// TEST 6: Controlla lo stato di Supabase
export async function testSupabaseStatus() {
  console.log('🧪 TEST 6: Supabase Status')
  
  try {
    const { supabase } = await import('./supabaseClient')
    
    // Testa la connessione
    const { data, error } = await supabase
      .from('push_devices')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Errore Supabase:', error)
      return false
    }
    
    console.log('✅ Supabase connesso')
    return true
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return false
  }
}

// TEST 7: Controlla i dispositivi registrati
export async function testRegisteredDevices(username) {
<<<<<<< HEAD
  // Fallback globale per Safari/console: window.username
  if (!username) {
    username = window.username || sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user';
  }
  window.username = username;
  console.log(`🧪 TEST 7: Dispositivi Registrati per ${username}`)
  try {
    const { getDispositiviUtente } = await import('./pushNotificationService')
    const devices = await getDispositiviUtente(username)
=======
  console.log(`🧪 TEST 7: Dispositivi Registrati per ${username}`)
  
  try {
    const { getDispositiviUtente } = await import('./pushNotificationService')
    const devices = await getDispositiviUtente(username)
    
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
    console.log(`✅ Dispositivi trovati: ${devices.length}`)
    devices.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device.device_type} - Ultimo accesso: ${device.ultimo_accesso}`)
    })
<<<<<<< HEAD
=======
    
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
    return devices
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return []
  }
}

// TEST 8: Invia una notifica di test via Supabase
export async function testSendNotification(username) {
<<<<<<< HEAD
  // Fallback globale per Safari/console: window.username
  if (!username) {
    username = window.username || sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user';
  }
  window.username = username;
  console.log(`🧪 TEST 8: Invia Notifica A ${username}`)
  try {
    const { inviaNotificaAUtente } = await import('./pushNotificationService')
=======
  // Se username non fornito, prova a recuperarlo
  if (!username) {
    username = sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user'
  }
  
  console.log(`🧪 TEST 8: Invia Notifica A ${username}`)
  
  try {
    const { inviaNotificaAUtente } = await import('./pushNotificationService')
    
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
    const success = await inviaNotificaAUtente(username, {
      titolo: '🧪 Test Notifica Supabase',
      messaggio: 'Se vedi questa notifica, il sistema funziona!',
      url: '/calendario',
      data: { test: true, timestamp: new Date().toISOString() }
    })
<<<<<<< HEAD
=======
    
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
    if (success) {
      console.log('✅ Notifica inviata con successo')
    } else {
      console.log('❌ Errore nell\'invio della notifica')
    }
<<<<<<< HEAD
=======
    
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
    return success
  } catch (error) {
    if (error && typeof error === 'object') {
      console.error('❌ Errore:', JSON.stringify(error, null, 2))
    } else {
      console.error('❌ Errore:', error)
    }
    return false
  }
}

// TEST 9: Mostra un report completo
export async function testFullReport(username = 'test_user') {
<<<<<<< HEAD
  // Fallback globale per Safari/console: window.username
  if (!username) {
    username = window.username || sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user';
  }
  window.username = username;
  console.log('═══════════════════════════════════════════════════')
  console.log('🧪 REPORT COMPLETO NOTIFICHE')
  console.log('═══════════════════════════════════════════════════')
  // Test 1: Support
  testNotificationSupport()
  // Test 2: Service Worker
  console.log('\n')
  const swOk = await testServiceWorkerRegistration()
  // Test 3: Firebase Token
  console.log('\n')
  const firebaseToken = await testFirebaseToken()
=======
  console.log('═══════════════════════════════════════════════════')
  console.log('🧪 REPORT COMPLETO NOTIFICHE')
  console.log('═══════════════════════════════════════════════════')
  
  // Test 1: Support
  testNotificationSupport()
  
  // Test 2: Service Worker
  console.log('\n')
  const swOk = await testServiceWorkerRegistration()
  
  // Test 3: Firebase Token
  console.log('\n')
  const firebaseToken = await testFirebaseToken()
  
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
  // Test 4: Notification
  if (swOk) {
    console.log('\n')
    await testShowNotification()
  }
<<<<<<< HEAD
  // Test 5: Web Push
  console.log('\n')
  await testWebPushSubscription()
  // Test 6: Supabase
  console.log('\n')
  const supabaseOk = await testSupabaseStatus()
=======
  
  // Test 5: Web Push
  console.log('\n')
  await testWebPushSubscription()
  
  // Test 6: Supabase
  console.log('\n')
  const supabaseOk = await testSupabaseStatus()
  
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
  // Test 7: Devices
  if (supabaseOk) {
    console.log('\n')
    await testRegisteredDevices(username)
  }
<<<<<<< HEAD
=======
  
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
  // Test 8: Send Test Notification
  if (supabaseOk) {
    console.log('\n')
    await testSendNotification(username)
  }
<<<<<<< HEAD
=======
  
>>>>>>> 08f5642 (first commit: inizializzazione repository locale e sincronizzazione con remoto)
  console.log('\n═══════════════════════════════════════════════════')
  console.log('🧪 REPORT COMPLETATO')
  console.log('═══════════════════════════════════════════════════')
}

// TEST 10: Monitora i messaggi del Service Worker
export function monitorServiceWorker() {
  console.log('🧪 TEST 10: Monitor Service Worker')
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('📬 SW Message:', event.data)
    })
    
    console.log('✅ Monitor attivato - Controlla la console per i messaggi del SW')
  } else {
    console.warn('Service Workers non supportati')
  }
}

// Comandi rapidi per testare
console.log(`
🧪 COMANDI DI TEST NOTIFICHE

Usa i seguenti comandi nella console per testare:

1. testNotificationSupport() - Controlla il supporto
2. testServiceWorkerRegistration() - Registra il SW
3. testFirebaseToken() - Ottieni token FCM
4. testShowNotification() - Mostra una notifica di test
5. testWebPushSubscription() - Controlla Web Push
6. testSupabaseStatus() - Verifica Supabase
7. testRegisteredDevices('username') - Vedi i tuoi dispositivi
8. testSendNotification('username') - Invia una notifica di test
9. testFullReport('username') - Report completo
10. monitorServiceWorker() - Monitora il Service Worker

Esempio completo:
  await testFullReport('giuseppe')
`)


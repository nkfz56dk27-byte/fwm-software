<<<<<<< HEAD
/**
 * Helper per testare le notifiche in background
 * Aggiungi questo codice nella console DevTools per testare
 */

// TEST 1: Controlla il supporto delle notifiche
async function testNotificationSupport() {
  console.log('🧪 TEST 1: Supporto Notifiche')
=======
// notificationTester.js - Test notifiche push e Supabase
import { inviaNotificaAUtente } from './pushNotificationService'

export async function testNotificationSupport() {
  console.log('🧪 TEST: Supporto Notifiche')
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)
  console.log('- Notification API:', 'Notification' in window)
  console.log('- Service Workers:', 'serviceWorker' in navigator)
  console.log('- Push Manager:', 'PushManager' in window)
  console.log('- Permesso attuale:', Notification.permission)
}

<<<<<<< HEAD
// TEST 2: Registra il Service Worker
async function testServiceWorkerRegistration() {
  console.log('🧪 TEST 2: Registrazione Service Worker')
=======
export async function testServiceWorkerRegistration() {
  console.log('🧪 TEST: Registrazione Service Worker')
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers non supportati')
    return false
  }
<<<<<<< HEAD
  
  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js')
=======
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)
    console.log('✅ Service Worker registrato:', reg)
    return true
  } catch (error) {
    console.error('❌ Errore:', error)
    return false
  }
}

<<<<<<< HEAD
// TEST 3: Ottieni il Firebase Token
async function testFirebaseToken() {
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
    console.error('❌ Errore:', error)
    return null
  }
}

// TEST 4: Mostra una notifica di test
async function testShowNotification() {
  console.log('🧪 TEST 4: Mostra Notifica Di Test')
  
  if (Notification.permission !== 'granted') {
    console.warn('Permesso notifiche non concesso')
    return false
  }
  
=======
export async function testShowNotification() {
  console.log('🧪 TEST: Mostra Notifica Di Test')
  if (Notification.permission !== 'granted') {
    alert('Permesso notifiche non concesso')
    return false
  }
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)
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
    console.error('❌ Errore:', error)
    return false
  }
}

<<<<<<< HEAD
// TEST 5: Sottoscrivi a Web Push
async function testWebPushSubscription() {
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
    console.error('❌ Errore:', error)
    return null
  }
}

// TEST 6: Controlla lo stato di Supabase
async function testSupabaseStatus() {
  console.log('🧪 TEST 6: Supabase Status')
  
  try {
    const { supabase } = await import('./supabaseClient')
    
}

// TEST 7: Controlla i dispositivi registrati
async function testRegisteredDevices(username) {
  console.log(`🧪 TEST 7: Dispositivi Registrati per ${username}`)
  
}

// TEST 8: Invia una notifica di test via Supabase
async function testSendNotification(username) {
  // Se username non fornito, prova a recuperarlo
  if (!username) {
    username = sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user'
  }
    if (success) {
      console.log('✅ Notifica inviata con successo')
    } else {
      console.log('❌ Errore nell\'invio della notifica')
    }
    
=======
    if (success) {
      console.log('✅ Notifica inviata con successo')
      // Mostra anche una notifica locale visibile
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        await reg.showNotification('🧪 Test Notifica Supabase', {
          body: 'Se vedi questa notifica, il sistema funziona!',
          icon: '/android-chrome-512x512.png',
          badge: '/android-chrome-512x512.png',
          tag: 'test-notification-supabase',
          requireInteraction: true
        })
      }
    } else {
      console.log('❌ Errore nell\'invio della notifica')
    }
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)
    return success
  } catch (error) {
    console.error('❌ Errore:', error)
    return false
  }
}

<<<<<<< HEAD
// TEST 9: Mostra un report completo
async function testFullReport(username = 'test_user') {
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
  
  // Test 4: Notification
  if (swOk) {
    console.log('\n')
    await testShowNotification()
  }
  
  // Test 5: Web Push
  console.log('\n')
  await testWebPushSubscription()
  
  // Test 6: Supabase
  console.log('\n')
  const supabaseOk = await testSupabaseStatus()
  
  // Test 7: Devices
  if (supabaseOk) {
    console.log('\n')
    await testRegisteredDevices(username)
  }
  
  // Test 8: Send Test Notification
  if (supabaseOk) {
    console.log('\n')
    await testSendNotification(username)
  }
  
=======
export async function testFullReport(username = 'test_user') {
  console.log('═══════════════════════════════════════════════════')
  console.log('🧪 REPORT COMPLETO NOTIFICHE')
  console.log('═══════════════════════════════════════════════════')
  await testNotificationSupport()
  console.log('\n')
  const swOk = await testServiceWorkerRegistration()
  console.log('\n')
  if (swOk) {
    await testShowNotification()
    console.log('\n')
    await testSendNotification(username)
  }
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)
  console.log('\n═══════════════════════════════════════════════════')
  console.log('🧪 REPORT COMPLETATO')
  console.log('═══════════════════════════════════════════════════')
}
<<<<<<< HEAD

// TEST 10: Monitora i messaggi del Service Worker
function monitorServiceWorker() {
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

// Esporta le funzioni
export {
  testNotificationSupport,
  testServiceWorkerRegistration,
  testFirebaseToken,
  testShowNotification,
  testWebPushSubscription,
  testSupabaseStatus,
  testRegisteredDevices,
  testSendNotification,
  testFullReport,
  monitorServiceWorker
}
=======
>>>>>>> 079afb9 (Deploy: integrazione notifiche push mobile, fix FCM, test e istruzioni)

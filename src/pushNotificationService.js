// pushNotificationService.js - Mock per test notifiche

export async function inviaNotificaAUtente(destinatario, options) {
  // Mock: simula invio notifica
  console.log(`📤 (MOCK) Invio notifica a ${destinatario}:`, options)
  // Simula successo
  return true;
}

/**
 * Test: Richiedi permesso e mostra token FCM
 * Da eseguire in console browser o in un componente React
 */
export async function testFCMPushSetup() {
  try {
    const token = await import('./firebase').then(m => m.richiediPermessoNotifiche())
    if (token) {
      alert('✅ Token FCM generato!\n' + token)
      console.log('✅ Token FCM:', token)
    } else {
      alert('❌ Permesso notifiche negato o errore')
      console.warn('❌ Permesso notifiche negato o errore')
    }
  } catch (err) {
    alert('❌ Errore test FCM: ' + err)
    console.error('❌ Errore test FCM:', err)
  }
}

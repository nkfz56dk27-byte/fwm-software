// Fallback globale: definisci window.username all'import se non esiste
if (typeof window !== 'undefined' && !window.username) {
  window.username = sessionStorage.getItem('username') || localStorage.getItem('username') || 'test_user';
}

/**
 * Helper per testare le notifiche in background
 * Aggiungi questo codice nella console DevTools per testare
 */

// TEST 1: Controlla il supporto delle notifiche
export async function testNotificationSupport() {
  console.log('🧪 TEST 1: Supporto Notifiche')
  console.log('- Notification API:', 'Notification' in window)

  // File svuotato: tutti i test legacy su Firebase Messaging e notifiche sono stati rimossi.
  console.log('- Permesso attuale:', Notification.permission)

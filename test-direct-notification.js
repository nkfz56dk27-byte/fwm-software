// Test diretto notifiche nel browser
console.log('🧪 Test diretto notifiche...');

// Test 1: Notifica base
if ('Notification' in window && Notification.permission === 'granted') {
  console.log('✅ Permessi notifiche OK');
  
  // Test notifica semplice
  new Notification('🧪 Test Diretto 1', {
    body: 'Questo è un test diretto - DOVRESTI VEDERE QUESTO!',
    icon: '/icona_notifiche.png',
    badge: '/icona_notifiche.png',
    requireInteraction: true,
    tag: 'test-direct-1'
  });
  
  // Test notifica con opzioni complete
  setTimeout(() => {
    new Notification('🧪 Test Diretto 2', {
      body: 'Secondo test con opzioni complete - CORPO VISIBILE?',
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      requireInteraction: true,
      silent: false,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: '📱 Apri'
        }
      ],
      tag: 'test-direct-2'
    });
  }, 2000);
  
  // Test notifica con emoji e testo lungo
  setTimeout(() => {
    new Notification('🔥 Test Completo', {
      body: '📅 Data: 9 Febbraio 2026\n🏎️ Evento: Presentazione Aston Martin\n📍 Luogo: Circuito\n\nQuesta è una notifica completa con tutte le informazioni che dovresti vedere!',
      icon: '/icona_notifiche.png',
      badge: '/icona_notifiche.png',
      requireInteraction: true,
      tag: 'test-complete'
    });
  }, 4000);
  
} else {
  console.error('❌ Permessi notifiche non disponibili');
  if (Notification.permission === 'denied') {
    console.error('❌ Permessi negati dall\'utente');
  } else if (Notification.permission === 'default') {
    console.error('❌ Permessi non richiesti');
    Notification.requestPermission().then(permission => {
      console.log('📝 Permessi:', permission);
    });
  }
}

// Test 2: Service Worker test
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    console.log('✅ Service Worker ready:', registration);
    
    // Invia messaggio al Service Worker
    registration.active.postMessage({
      type: 'TEST_NOTIFICATION',
      title: '📡 Test SW',
      body: 'Messaggio dal Service Worker - VEDI IL CORPO?'
    });
  });
}

console.log('🧪 Test completato! Controlla le notifiche.');

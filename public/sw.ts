// Handler 'message' registrato subito all'inizio
self.addEventListener('message', function(event) {
  console.log('[SW] Messaggio ricevuto:', event);
  // Gestisci il messaggio qui
  // Logica per OneSignal o altri client
});

// Registrazione di altri event handler necessari
self.addEventListener('install', function(event) {
  console.log('[SW] Install event');
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activate event');
});

// ...existing code...

#!/usr/bin/env node
const admin = require('firebase-admin');

// Carica le credenziali di servizio dalle variabili d'ambiente
const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!firebaseServiceAccount) {
  console.error('❌ Variabile d\'ambiente FIREBASE_SERVICE_ACCOUNT non trovata!');
  console.error('📝 Imposta la variabile d\'ambiente con il contenuto JSON del service account Firebase');
  process.exit(1);
}

const serviceAccount = JSON.parse(firebaseServiceAccount);

// Inizializza Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'fwm-notifiche'
});

const messaging = admin.messaging();

async function sendTestNotification() {
  try {
    const message = {
      notification: {
        title: '🏁 Nuova classifica',
        body: 'Questa notifica viene dal Service Worker quando il browser è chiuso!'
      },
      data: {
        id: 'test-' + Date.now(),
        type: 'test-notification',
        url: '/'
      },
      webpush: {
        notification: {
          requireInteraction: true,
          badge: '/icona_notifiche.png',
          icon: '/icona_notifiche.png',
          title: '🔔 Notifica di Prova Firebase',
          body: 'Questa notifica viene dal Service Worker quando il browser è chiuso!'
        }
      }
    };

    // Invia al topic (tutti gli utenti iscritti)
    const response = await messaging.sendToTopic('all-users', message);
    
    // ...log notifica inviata rimosso...
    // ...log topic all-users rimosso...
    // ...log message id rimosso...
    // ...log notification center rimosso...
    
  } catch (error) {
    console.error('❌ Errore nell\'invio:', error.message);
    if (error.code === 'app/invalid-credential') {
      console.error('\n📝 Verifica che firebase-service-account.json sia valido');
    }
    process.exit(1);
  }
}

sendTestNotification();

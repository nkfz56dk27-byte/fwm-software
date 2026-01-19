#!/usr/bin/env node
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Carica le credenziali di servizio
const credentialsPath = path.join(__dirname, '../firebase-service-account.json');

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ File firebase-service-account.json non trovato!');
  console.error('📝 Scaricalo da: Firebase Console → ⚙️ Impostazioni → Account di servizio → "Genera nuova chiave privata"');
  process.exit(1);
}

const serviceAccount = require(credentialsPath);

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
    
    console.log('✅ Notifica inviata con successo!');
    console.log('📱 Topic: all-users');
    console.log('🆔 Message ID:', response);
    console.log('\n💡 Controlla il Notification Center di macOS (anche se il browser è chiuso)');
    
  } catch (error) {
    console.error('❌ Errore nell\'invio:', error.message);
    if (error.code === 'app/invalid-credential') {
      console.error('\n📝 Verifica che firebase-service-account.json sia valido');
    }
    process.exit(1);
  }
}

sendTestNotification();

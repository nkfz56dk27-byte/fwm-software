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
        }
      }
    };

    // Recupera SOLO i token unici per device_id (uno per device, per tutti gli utenti)
    const { supabase } = require('./supabaseClient.cjs');
    const { data, error } = await supabase
      .from('firebase_tokens')
      .select('token, username, device_id, device_type, browser_info, last_updated')
      .not('token', 'is', null);

    if (error) {
      console.error('❌ Errore query Supabase:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.error('❌ Nessun token FCM trovato!');
      process.exit(1);
    }

    // Raggruppa per device_id (un token per device)
    const unique = {};
    for (const row of data) {
      const key = row.device_id || row.token;
      if (!unique[key] || new Date(row.last_updated) > new Date(unique[key].last_updated)) {
        unique[key] = row;
      }
    }
    const uniqueTokens = Object.values(unique);
    console.log('✅ Token FCM unici trovati (broadcast):', uniqueTokens.length);

    // Invia la notifica push a tutti i token unici
    let success = 0, fail = 0;
    for (const row of uniqueTokens) {
      try {
        const response = await messaging.send({
          ...message,
          token: row.token
        });
        console.log(`✅ Notifica inviata a ${row.username} (${row.device_type || 'unknown'}):`, response);
        success++;
      } catch (err) {
        console.error(`❌ Errore invio a ${row.username} (${row.device_type || 'unknown'}):`, err.message);
        fail++;
      }
    }
    console.log(`Totale notifiche inviate: ${success}, fallite: ${fail}`);
  } catch (error) {
    console.error('❌ Errore invio notifica:', error);
  }
}

sendTestNotification();

// Script polling per invio notifiche push automatiche da Supabase
// Esegui: node scripts/process-push-notifications.js

const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
console.log('firebase-admin version:', admin.SDK_VERSION);
const path = require('path');
const fs = require('fs');

// Configura Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://vfflpwrneminmnzmmwtu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'INSERISCI_LA_SERVICE_ROLE_KEY_SUPABASE'
);

// Configura Firebase Admin
const credentialsPath = path.join(__dirname, '../firebase-service-account.json');
const serviceAccount = require(credentialsPath);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'fwm-notifiche'
  });
}
const messaging = admin.messaging();
console.log('Funzioni disponibili su messaging:', Object.keys(messaging));

async function processNotifications() {
  // 1. Prendi tutte le notifiche pending
  const { data: notifications, error } = await supabase
    .from('push_notifications')
    .select('*')
    .eq('status', 'pending');
  if (error) throw error;

  // 2. Prendi tutti i token FCM
  const { data: tokensData, error: tokenError } = await supabase
    .from('firebase_tokens')
    .select('token');
  if (tokenError) throw tokenError;
  const tokens = (tokensData || []).map(row => row.token).filter(Boolean);

  for (const notif of notifications) {
    const message = {
      notification: {
        title: notif.title,
        body: notif.body
      },
      data: {
        tipo: notif.notification_type || 'info',
        timestamp: new Date().toISOString(),
        url: '/'
      }
    };
    // Invia la notifica a tutti i token (uno per uno)
    if (tokens.length > 0) {
      console.log('Invio a tokens:', tokens);
      if (typeof messaging.sendToDevice === 'function') {
        for (const token of tokens) {
          try {
            const response = await messaging.sendToDevice(token, message);
            console.log(`Risposta Firebase per token ${token}:`, response);
          } catch (err) {
            console.error(`Errore invio token ${token}:`, err);
          }
        }
      } else if (typeof messaging.send === 'function') {
        for (const token of tokens) {
          try {
            const response = await messaging.send({ token, ...message });
            console.log(`Risposta Firebase (send) per token ${token}:`, response);
          } catch (err) {
            console.error(`Errore invio token ${token} con send:`, err);
          }
        }
      } else {
        console.error('Nessun metodo valido per invio notifiche trovato su messaging!');
      }
    } else {
      console.warn('Nessun token trovato per invio notifiche.');
    }
    // Aggiorna lo status a 'sent'
    await supabase
      .from('push_notifications')
      .update({ status: 'sent' })
      .eq('id', notif.id);
  }
  console.log('✅ Notifiche processate!');
}

processNotifications().catch(console.error);


const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Carica le credenziali di servizio Firebase dalle variabili d'ambiente
const firebaseServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!firebaseServiceAccount) {
  throw new Error('❌ Variabile d\'ambiente FIREBASE_SERVICE_ACCOUNT non trovata!');
}

const serviceAccount = JSON.parse(firebaseServiceAccount);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'fwm-notifiche'
  });
}

const messaging = admin.messaging();

// Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://vfflpwrneminmnzmmwtu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'INSERISCI_LA_SERVICE_ROLE_KEY_SUPABASE';
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/', async (req, res) => {
  const { titolo, messaggio, tipo } = req.body;
  const message = {
    notification: {
      title: titolo,
      body: messaggio
    },
    data: {
      tipo,
      timestamp: new Date().toISOString(),
      url: '/'
    },
    webpush: {
      notification: {
        requireInteraction: true,
        badge: '/icona_notifiche.png',
        icon: '/icona_notifiche.png',
        title: titolo,
        body: messaggio
      }
    }
  };

  try {
    // Recupera tutti i token FCM dalla tabella Supabase
    const { data: tokensData, error } = await supabase
      .from('firebase_tokens')
      .select('token');
    if (error) throw error;
    const tokens = (tokensData || []).map(row => row.token).filter(Boolean);
    if (tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'Nessun token FCM trovato' });
    }
    // Invia la notifica a tutti i token
    const response = await messaging.sendMulticast({ tokens, ...message });
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

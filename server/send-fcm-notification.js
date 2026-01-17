const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Carica le credenziali di servizio Firebase
const credentialsPath = path.join(__dirname, '../firebase-service-account.json');
if (!fs.existsSync(credentialsPath)) {
  throw new Error('❌ File firebase-service-account.json non trovato!');
}
const serviceAccount = require(credentialsPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'fwm-notifiche'
  });
}

const messaging = admin.messaging();

router.post('/', async (req, res) => {
  const { titolo, messaggio, tipo, targetTokens = [], targetTopic = 'all-users' } = req.body;
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
    let response;
    if (targetTokens.length > 0) {
      response = await messaging.sendEachForMulticast({ tokens: targetTokens, ...message });
    } else {
      response = await messaging.sendToTopic(targetTopic, message);
    }
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

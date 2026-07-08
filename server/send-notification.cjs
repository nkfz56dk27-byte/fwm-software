const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Inserisci qui le tue chiavi OneSignal
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '32bc9e36-a2ac-449c-a07c-70168b9b3e37';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

router.post('/', async (req, res) => {
  const { titolo, messaggio, tipo, targetUsers = [] } = req.body;
  const requestBody = {
    app_id: ONESIGNAL_APP_ID,
    headings: { it: titolo, en: titolo },
    contents: { it: messaggio, en: messaggio },
    included_segments: targetUsers.length ? undefined : ['All'],
    filters: targetUsers.length
      ? targetUsers.map((username, i) => [
          { field: 'tag', key: 'username', relation: '=', value: username },
          ...(i < targetUsers.length - 1 ? [{ operator: 'OR' }] : [])
        ]).flat()
      : undefined,
    data: { tipo, timestamp: new Date().toISOString() },
    chrome_web_icon: '/icona_notifiche.png',
    chrome_web_badge: '/icona_notifiche.png'
  };

  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  const result = await response.json();
  if (response.ok) {
    res.json({ success: true, data: result });
  } else {
    res.status(500).json({ success: false, error: result });
  }
});

module.exports = router;

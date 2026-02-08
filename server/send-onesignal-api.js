// API endpoint per invio notifiche OneSignal
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
if (!ONESIGNAL_API_KEY) {
  throw new Error('[FATAL] ONESIGNAL_API_KEY non impostata!');
}

async function sendOneSignalNotification({ title, body, url = '/', data = {} }) {
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ['All'],
    headings: { en: title },
    contents: { en: body },
    url,
    data
  };

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OneSignal API error: ${err}`);
  }
  return res.json();
}

router.post('/send-notification', async (req, res) => {
  try {
    const { title, body, url, data } = req.body;
    await sendOneSignalNotification({ title, body, url, data });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

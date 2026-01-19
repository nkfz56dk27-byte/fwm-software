// OneSignal backend notification sender (CommonJS)
const fetch = require('node-fetch');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '32bc9e36-a2ac-449c-a07c-70168b9b3e37';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || 'hixkki7lxezn5zocmjx62jajr';

/**
 * Invia una notifica push a tutti gli utenti OneSignal
 * @param {Object} opts {title, body, url, data}
 */
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

module.exports = { sendOneSignalNotification };

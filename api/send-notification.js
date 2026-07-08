// Vercel Serverless Function per invio notifiche OneSignal
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
  if (!ONESIGNAL_API_KEY) {
    throw new Error('[FATAL] ONESIGNAL_API_KEY non impostata!');
  }

    let fetchFn;
    try {
      fetchFn = (typeof fetch !== 'undefined') ? fetch : require('node-fetch');
    } catch (e) {
      fetchFn = require('node-fetch');
    }

    const { title, body, url = '/', data = {} } = req.body;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ['All'],
    headings: { it: title, en: title },
    contents: { it: body, en: body },
    url,
    data,
    chrome_web_icon: '/icona_notifiche.png',
    chrome_web_badge: '/icona_notifiche.png'
  };

  try {
      const response = await fetchFn('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${ONESIGNAL_API_KEY}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        console.error('❌ OneSignal API error:', result);
        return res.status(500).json({ success: false, error: result });
      }
      return res.status(200).json({ success: true, result });
  } catch (error) {
      console.error('❌ Serverless error:', error);
      return res.status(500).json({ success: false, error: error.message });
  }
}

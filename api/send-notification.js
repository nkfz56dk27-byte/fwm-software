// Vercel Serverless Function per invio notifiche OneSignal
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

  const { title, body, url = '/', data = {} } = req.body;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ['All'],
    headings: { en: title },
    contents: { en: body },
    url,
    data
  };

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ success: false, error: err });
    }
    const result = await response.json();
    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

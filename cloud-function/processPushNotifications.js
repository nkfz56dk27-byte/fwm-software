// Google Cloud Function per invio notifiche push con OneSignal
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

exports.processPushNotifications = async (req, res) => {
  const start = Date.now();
  try {
    // Prendi tutte le notifiche pending
    const { data: notifications, error } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('status', 'pending');
    if (error) throw error;

    let sent = 0;
    for (const notif of notifications) {
      try {
        await sendOneSignalNotification({
          title: notif.title,
          body: notif.body,
          url: '/',
          data: {
            tipo: notif.notification_type || 'info',
            timestamp: new Date().toISOString()
          }
        });
        sent++;
        // Aggiorna lo status a 'sent'
        await supabase.from('push_notifications').update({ status: 'sent' }).eq('id', notif.id);
      } catch (err) {
        await supabase.from('push_notifications').update({ status: 'error', error: err.message }).eq('id', notif.id);
      }
    }
    const end = Date.now();
    res.status(200).json({ success: true, sent, durationMs: end - start });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

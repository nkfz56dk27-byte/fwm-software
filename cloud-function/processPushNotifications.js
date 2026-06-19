// Google Cloud Function per invio notifiche push con OneSignal
// [DEPLOY TEST] Patch forzata per verifica deploy e trigger Vercel
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
if (!ONESIGNAL_API_KEY) {
  throw new Error('[FATAL] ONESIGNAL_API_KEY non impostata!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendOneSignalNotification({ title, body, url = '/', data = {}, targetUsers = [], targetAll = false, notificationType = 'info' }) {
  const useTargeting = notificationType === 'rss_filter'
    && Array.isArray(targetUsers)
    && targetUsers.length > 0
    && !targetAll;
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: title },
    contents: { en: body },
    url,
    data,
    included_segments: useTargeting ? undefined : ['All'],
    filters: useTargeting
      ? targetUsers.map((username, i) => [
          { field: 'tag', key: 'username', relation: '=', value: username },
          ...(i < targetUsers.length - 1 ? [{ operator: 'OR' }] : [])
        ]).flat()
      : undefined
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
    // Prendi tutte le notifiche pending da tutte e tre le tabelle
    const { data: weekendNotifications, error: errorWeekend } = await supabase
      .from('push_disponibilita_weekend')
      .select('*')
      .eq('status', 'pending');
    if (errorWeekend) throw errorWeekend;

    const { data: accreditiNotifications, error: errorAccrediti } = await supabase
      .from('push_calendario_accrediti')
      .select('*')
      .eq('status', 'pending');
    if (errorAccrediti) throw errorAccrediti;
    console.log('[DEBUG] Notifiche calendario accrediti pending:', accreditiNotifications);

    const { data: generalNotifications, error: errorGeneral } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('status', 'pending');
    if (errorGeneral) throw errorGeneral;

    let sent = 0;
    // Processa notifiche weekend
    for (const notif of weekendNotifications) {
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
        await supabase.from('push_disponibilita_weekend').update({ status: 'sent' }).eq('id', notif.id);
      } catch (err) {
        await supabase.from('push_disponibilita_weekend').update({ status: 'error', error: err.message }).eq('id', notif.id);
      }
    }

    // Processa notifiche calendario accrediti
    for (const notif of accreditiNotifications) {
      try {
        console.log('[DEBUG] Invio notifica calendario accrediti:', notif);
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
        await supabase.from('push_calendario_accrediti').update({ status: 'sent' }).eq('id', notif.id);
      } catch (err) {
        console.error('[ERROR] Invio notifica calendario accrediti:', err);
        await supabase.from('push_calendario_accrediti').update({ status: 'error', error: err.message }).eq('id', notif.id);
      }
    }

    // Processa notifiche generali
    for (const notif of generalNotifications) {
      try {
        await sendOneSignalNotification({
          title: notif.title,
          body: notif.body,
          url: '/',
          data: {
            tipo: notif.notification_type || 'info',
            timestamp: new Date().toISOString()
          },
          targetUsers: notif.target_users || [],
          targetAll: notif.target_all,
          notificationType: notif.notification_type || 'info'
        });
        sent++;
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

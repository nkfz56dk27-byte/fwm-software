const dotenv = require('dotenv');
dotenv.config();
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

async function sendOneSignalNotification({ title, body, url = '/', data = {}, targetUsers = [], notificationType = 'rss_filter' }) {
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { it: title, en: title },
    contents: { it: body, en: body },
    url,
    data,
    included_player_ids: targetUsers
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

async function main() {
  const { data: rssFilterNotifications, error } = await supabase
    .from('push_notifications_rss_filter')
    .select('*')
    .eq('status', 'pending');
  if (error) {
    console.error('Errore query:', error);
    process.exit(1);
  }
  if (!rssFilterNotifications.length) {
    console.log('Nessuna notifica RSS filtrata pending da processare');
    process.exit(0);
  }
  for (const notif of rssFilterNotifications) {
    try {
      console.log('[DEBUG] Processo notifica RSS:', notif);
      const target = notif.target_users && notif.target_users.length > 0 ? notif.target_users : [];
      console.log('[DEBUG] target_users:', target);
      const onesignalRes = await sendOneSignalNotification({
        title: notif.title,
        body: notif.body,
        url: notif.data?.link || '/',
        data: notif.data || {},
        targetUsers: target
      });
      console.log('[DEBUG] Risposta OneSignal:', onesignalRes);
      await supabase.from('push_notifications_rss_filter').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', notif.id);
      console.log('[DEBUG] Notifica aggiornata come sent:', notif.id);
    } catch (err) {
      console.log('[DEBUG] Errore invio notifica:', err);
      await supabase.from('push_notifications_rss_filter').update({ status: 'error', error: err.message }).eq('id', notif.id);
    }
  }
  console.log('[DEBUG] Fine ciclo notifiche RSS filtrate');
}

main();

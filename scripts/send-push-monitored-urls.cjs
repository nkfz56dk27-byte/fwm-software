// Script: send-push-monitored-urls.cjs
// Invia notifiche push agli utenti per i link web monitorati

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendOneSignalNotification({ title, body, userId, url }) {
  // Recupera player_id dal device dell'utente
  const { data: devices, error: devicesError } = await supabase
    .from('push_devices')
    .select('player_id')
    .eq('user_id', userId)
    .eq('active', true);
  if (devicesError || !devices || devices.length === 0) return;
  const playerIds = devices.map(d => d.player_id).filter(Boolean);
  if (playerIds.length === 0) return;

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: title },
    contents: { en: body },
    url: url || undefined
  };

  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
}

async function main() {
  // Prendi tutte le notifiche pending
  const { data: notifications, error } = await supabase
    .from('push_notifications_monitored_urls')
    .select('*')
    .eq('status', 'pending');
  if (error || !notifications) return;
  for (const notif of notifications) {
    try {
      await sendOneSignalNotification({
        title: notif.title,
        body: notif.body,
        userId: notif.user_id,
        url: undefined // puoi aggiungere url se vuoi
      });
      await supabase.from('push_notifications_monitored_urls').update({ status: 'sent' }).eq('id', notif.id);
    } catch (err) {
      await supabase.from('push_notifications_monitored_urls').update({ status: 'error', error: err.message }).eq('id', notif.id);
    }
  }
  console.log('Notifiche push inviate.');
}

main();

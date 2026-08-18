// Vercel Serverless Function per invio notifiche push con OneSignal
import { createClient } from '@supabase/supabase-js';

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

  // fetch è globale nei runtime Node moderni di Vercel: non serve importare node-fetch
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

// Controlla quanti articoli critici sono ancora liberi (non assegnati) per un weekend.
// Ritorna null in caso di errore nella query (da gestire separatamente dal caso "zero").
async function contaArticoliCriticiLiberi(weekendId) {
  const { count, error } = await supabase
    .from('articoli')
    .select('id', { count: 'exact', head: true })
    .eq('weekend_id', weekendId)
    .eq('critico', true)
    .eq('stato', 'libero');
  if (error) {
    console.error('[ERROR] Conteggio articoli critici liberi:', error);
    return null; // null = errore nel controllo, non sappiamo lo stato reale
  }
  return count ?? 0;
}

export default async function handler(req, res) {
  const start = Date.now();
  const nowIso = new Date().toISOString();
  try {
    // Prendi tutte le notifiche pending E già "mature" (scheduled_for nullo o già passato)
    const { data: weekendNotifications, error: errorWeekend } = await supabase
      .from('push_disponibilita_weekend')
      .select('*')
      .eq('status', 'pending')
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`);
    if (errorWeekend) throw errorWeekend;

    const { data: accreditiNotifications, error: errorAccrediti } = await supabase
      .from('push_calendario_accrediti')
      .select('*')
      .eq('status', 'pending')
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`);
    if (errorAccrediti) throw errorAccrediti;

    const { data: generalNotifications, error: errorGeneral } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('status', 'pending')
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`);
    if (errorGeneral) throw errorGeneral;

    let sent = 0;
    let skipped = 0;

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
        // Caso speciale: "articoli critici ancora liberi" — verifica lo stato REALE
        // al momento dell'invio, non fidarti del messaggio scritto alla creazione del weekend.
        if (notif.notification_type === 'articoli_critici') {
          const weekendId = notif.data?.weekend_id;
          const countLiberi = await contaArticoliCriticiLiberi(weekendId);
          if (countLiberi === null) {
            await supabase.from('push_notifications').update({ status: 'error', error: 'Impossibile verificare articoli critici liberi' }).eq('id', notif.id);
            continue;
          }
          if (countLiberi === 0) {
            await supabase.from('push_notifications').update({ status: 'skipped', error: 'Nessun articolo critico ancora libero' }).eq('id', notif.id);
            skipped++;
            continue;
          }
        }

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
    res.status(200).json({ success: true, sent, skipped, durationMs: end - start });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

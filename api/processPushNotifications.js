// API Route per Vercel: processa notifiche push da tabella push_disponibilita_weekend
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;
// Stesso app_id usato in send-rss-push.js: se la env var non è impostata su
// questa function, usiamo lo stesso valore come fallback invece di mandare
// app_id undefined a OneSignal (che altrimenti fallisce silenziosamente
// notifica per notifica, salvandole come 'error' senza dare un motivo chiaro).
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '32bc9e36-a2ac-449c-a07c-70168b9b3e37';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// fetch() nativo/node-fetch con l'opzione `timeout` non è affidabile su tutte
// le versioni. Senza un vero timeout, una chiamata a OneSignal lenta o che
// non risponde blocca l'esecuzione senza limiti: è la causa più probabile
// del fallimento del cron. Questo helper impone un timeout reale.
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Esegue fn su ogni elemento di items con al massimo `limit` esecuzioni in
// parallelo, invece che una alla volta in sequenza (che è ciò che sommava i
// tempi di tutte le notifiche di tutte le tabelle fino al timeout).
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function sendOneSignalNotification({ title, body, url = '/', data = {}, targetUsers = [], targetAll = false, notificationType = 'info' }) {
  const useTargeting = notificationType === 'rss_filter'
    && Array.isArray(targetUsers)
    && targetUsers.length > 0
    && !targetAll;
  const payload = {
    app_id: ONESIGNAL_APP_ID,
    headings: { it: title, en: title, default: title },
    contents: { it: body, en: body, default: body },
    subtitle: { it: body, en: body, default: body },
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

  const res = await fetchWithTimeout('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify(payload)
  }, 8000);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OneSignal API error: ${err}`);
  }
  return res.json();
}

// Processa in parallelo (concorrenza limitata) tutte le notifiche pending di
// UNA tabella, aggiornando lo stato di ciascuna in base all'esito.
async function processaTabella(tableName, notifiche, buildPayload) {
  let sentCount = 0;
  await mapWithConcurrency(notifiche || [], 5, async (notif) => {
    try {
      await sendOneSignalNotification(buildPayload(notif));
      sentCount++;
      await supabase.from(tableName).update({ status: 'sent' }).eq('id', notif.id);
    } catch (err) {
      console.error(`❌ [PUSH] Errore notifica ${notif.id} (${tableName}):`, err);
      await supabase.from(tableName).update({ status: 'error', error: err.message }).eq('id', notif.id);
    }
  });
  return sentCount;
}

export default async function handler(req, res) {
  const start = Date.now();
  try {
    if (!ONESIGNAL_API_KEY) {
      // Prima veniva lanciato a livello di modulo (fuori da ogni try/catch):
      // se la env var mancava, la function falliva al caricamento stesso,
      // prima ancora di poter rispondere con un errore leggibile.
      throw new Error('ONESIGNAL_API_KEY non impostata');
    }

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

    const { data: generalNotifications, error: errorGeneral } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('status', 'pending');
    if (errorGeneral) throw errorGeneral;

    // Le tre tabelle vengono processate in parallelo tra loro (oltre alla
    // concorrenza interna su ogni singola tabella), invece che una dopo
    // l'altra in sequenza.
    const [sentWeekend, sentAccrediti, sentGeneral] = await Promise.all([
      processaTabella('push_disponibilita_weekend', weekendNotifications, (notif) => ({
        title: notif.title,
        body: notif.body,
        url: '/',
        data: {
          tipo: notif.notification_type || 'info',
          timestamp: new Date().toISOString()
        }
      })),
      processaTabella('push_calendario_accrediti', accreditiNotifications, (notif) => ({
        title: notif.title,
        body: notif.body,
        url: '/',
        data: {
          tipo: notif.notification_type || 'info',
          timestamp: new Date().toISOString()
        }
      })),
      processaTabella('push_notifications', generalNotifications, (notif) => ({
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
      }))
    ]);

    const sent = sentWeekend + sentAccrediti + sentGeneral;
    const end = Date.now();
    res.status(200).json({ success: true, sent, durationMs: end - start });
  } catch (err) {
    console.error('❌ [PUSH] Errore processPushNotifications:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

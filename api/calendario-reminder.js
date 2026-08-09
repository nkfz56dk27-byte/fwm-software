// API unificata: reminder calendario + articoli critici + penalty in scadenza
// Esecuzione: Cron job giornaliero alle 9:00 CET tramite Vercel (chiamato da cron-job.org)

import { createClient } from '@supabase/supabase-js';
import { getPenaltyScadutaNotification } from '../src/notificationTemplates.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VERSION = '2026-08-09-1';

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

/**
 * Calcola la data di 2 giorni da oggi (fuso orario italiano)
 * @returns {string} Data in formato YYYY-MM-DD
 */
function getDueDaysFromNow() {
  const now = new Date();
  const italianTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  italianTime.setDate(italianTime.getDate() + 2);
  const year = italianTime.getFullYear();
  const month = String(italianTime.getMonth() + 1).padStart(2, '0');
  const day = String(italianTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Invia una notifica push via OneSignal
 * @param {object} payload - Payload della notifica
 * @returns {Promise<object>} Risposta da OneSignal
 */
async function sendOneSignalNotification(payload) {
  try {
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    const response = await fetchFn('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`OneSignal API error: ${JSON.stringify(data)}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('❌ Errore OneSignal:', error.message);
    throw error;
  }
}

/* ===================== 1. REMINDER CALENDARIO ===================== */

async function sendCalendarioReminders() {
  try {
    console.log('[INFO] Inizio controllo reminder calendario...');
    const supabase = getSupabaseClient();

    const oggi = new Date();
    const oggiStr = oggi.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log('[CLEANUP] Cancellazione reminder di eventi passati...');
    const { error: errDelete } = await supabase
      .from('calendario_reminder_sent')
      .delete()
      .lt('notification_sent_at', `${oggiStr}T00:00:00Z`);

    if (errDelete) {
      console.error('[CLEANUP] Errore cancellazione:', errDelete.message);
    } else {
      console.log('[CLEANUP] Cleanup completato');
    }

    const dueDateStr = getDueDaysFromNow();
    console.log(`[INFO] Cercando eventi per la data: ${dueDateStr}`);

    const { data: eventi, error: errEventi } = await supabase
      .from('eventi_calendario')
      .select('id, titolo, data_inizio, tipo')
      .eq('data_inizio', dueDateStr);

    if (errEventi) {
      throw new Error(`Errore query eventi: ${errEventi.message}`);
    }

    console.log(`[INFO] Trovati ${eventi?.length || 0} eventi per il ${dueDateStr}`);

    if (!eventi || eventi.length === 0) {
      console.log('[INFO] Nessun evento da notificare');
      return {
        message: 'Nessun evento da notificare',
        checkedDate: dueDateStr,
        eventsFound: 0,
        successCount: 0,
        failureCount: 0,
        results: []
      };
    }

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    for (const evento of eventi) {
      try {
        const { data: reminderSent, error: errCheck } = await supabase
          .from('calendario_reminder_sent')
          .select('id')
          .eq('evento_id', evento.id)
          .eq('reminder_type', 'due_days')
          .eq('status', 'sent')
          .single();

        if (reminderSent && !errCheck) {
          console.log(`[SKIP] Reminder già inviato per evento ${evento.id}`);
          results.push({
            eventoId: evento.id,
            status: 'skipped',
            reason: 'Reminder già inviato'
          });
          continue;
        }

        const dataFormattata = new Date(evento.data_inizio).toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        const titoloEvento = evento.titolo || 'Evento';
        const bodyText = `L'evento ${titoloEvento} è previsto per il ${dataFormattata}`;
        const notificationPayload = {
          app_id: ONESIGNAL_APP_ID,
          included_segments: ['All'],
          headings: { it: 'Promemoria Evento', en: 'Promemoria Evento' },
          contents: { it: bodyText, en: bodyText },
          url: 'https://fwm-software.vercel.app/',
          data: {
            type: 'calendario_reminder',
            evento_id: evento.id,
            reminder_type: 'due_days'
          },
          chrome_web_icon: '/icona_notifiche.png',
          chrome_web_badge: '/icona_notifiche.png'
        };

        console.log(`[SEND] Inviando reminder per evento ${evento.id}: ${evento.titolo}`);
        await sendOneSignalNotification(notificationPayload);

        const { error: errInsert } = await supabase
          .from('calendario_reminder_sent')
          .insert({
            evento_id: evento.id,
            reminder_type: 'due_days',
            status: 'sent',
            notification_sent_at: new Date().toISOString()
          });

        if (errInsert) {
          throw new Error(`Errore registrazione reminder: ${errInsert.message}`);
        }

        console.log(`[SUCCESS] Reminder inviato per evento ${evento.id}`);
        results.push({
          eventoId: evento.id,
          status: 'sent',
          titolo: evento.titolo
        });
        successCount++;

      } catch (error) {
        console.error(`[ERROR] Errore evento ${evento.id}:`, error.message);

        try {
          await supabase
            .from('calendario_reminder_sent')
            .insert({
              evento_id: evento.id,
              reminder_type: 'due_days',
              status: 'failed',
              error_message: error.message
            });
        } catch (err) {
          console.error('Errore registrazione fallimento:', err);
        }

        results.push({
          eventoId: evento.id,
          status: 'error',
          error: error.message
        });
        failureCount++;
      }
    }

    console.log(`[SUMMARY CALENDARIO] Completato: ${successCount} inviati, ${failureCount} falliti`);

    return {
      message: 'Controllo reminder completato',
      checkedDate: dueDateStr,
      eventsFound: eventi.length,
      successCount,
      failureCount,
      results
    };

  } catch (error) {
    console.error('[FATAL CALENDARIO]', error);
    return {
      error: 'Errore durante il controllo reminder',
      message: error?.stack || error.message
    };
  }
}

/* ===================== 2. ARTICOLI CRITICI ===================== */

async function sendArticoliCriticiReminders() {
  try {
    console.log('[INFO] Inizio controllo articoli critici...');
    const supabase = getSupabaseClient();

    const now = new Date();
    const nowIso = now.toISOString();

    console.log(`[INFO] Cercando notifiche programmate prima di: ${nowIso}`);

    const { data: notifiche, error: errNotifiche } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('notification_type', 'articoli_critici')
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso);

    if (errNotifiche) {
      throw new Error(`Errore query notifiche: ${errNotifiche.message}`);
    }

    console.log(`[INFO] Trovate ${notifiche?.length || 0} notifiche di articoli critici scadute`);

    if (!notifiche || notifiche.length === 0) {
      console.log('[INFO] Nessuna notifica da inviare');
      return {
        message: 'Nessuna notifica da inviare',
        notificationsFound: 0,
        successCount: 0,
        skipCount: 0,
        failureCount: 0,
        results: []
      };
    }

    let successCount = 0;
    let skipCount = 0;
    let failureCount = 0;
    const results = [];

    for (const notifica of notifiche) {
      try {
        const weekendId = notifica.data?.weekend_id;

        if (!weekendId) {
          console.log(`[SKIP] Notifica ${notifica.id} senza weekend_id`);
          skipCount++;
          continue;
        }

        const { data: alreadySent, error: errCheck } = await supabase
          .from('notifiche_articoli_critici')
          .select('id')
          .eq('weekend_id', String(weekendId))
          .single();

        if (alreadySent && !errCheck) {
          console.log(`[SKIP] Notifica già inviata per weekend ${weekendId}`);
          await supabase
            .from('push_notifications')
            .update({ status: 'sent' })
            .eq('id', notifica.id);

          results.push({
            notificaId: notifica.id,
            weekendId,
            status: 'skipped',
            reason: 'Notifica già inviata'
          });
          skipCount++;
          continue;
        }

        const { data: articoliCritici, error: errArticoli } = await supabase
          .from('articoli')
          .select('id')
          .eq('weekend_id', weekendId)
          .eq('critico', true)
          .eq('stato', 'libero');

        if (errArticoli) {
          throw new Error(`Errore query articoli: ${errArticoli.message}`);
        }

        const articoliCriticiCount = articoliCritici?.length || 0;

        if (articoliCriticiCount === 0) {
          console.log(`[SKIP] Nessun articolo critico libero per weekend ${weekendId}`);
          await supabase
            .from('push_notifications')
            .update({ status: 'sent' })
            .eq('id', notifica.id);

          results.push({
            notificaId: notifica.id,
            weekendId,
            status: 'skipped',
            reason: 'Nessun articolo critico libero'
          });
          skipCount++;
          continue;
        }

        const notificationPayload = {
          app_id: ONESIGNAL_APP_ID,
          included_segments: ['All'],
          headings: { it: notifica.title, en: notifica.title },
          contents: { it: notifica.body, en: notifica.body },
          url: 'https://fwm-software.vercel.app/',
          data: {
            type: 'articoli_critici',
            weekend_id: weekendId,
            articoli_critici_count: articoliCriticiCount
          },
          chrome_web_icon: '/icona_notifiche.png',
          chrome_web_badge: '/icona_notifiche.png'
        };

        console.log(`[SEND] Inviando notifica per weekend ${weekendId} (${articoliCriticiCount} articoli critici)`);
        await sendOneSignalNotification(notificationPayload);

        const { error: errInsert } = await supabase
          .from('notifiche_articoli_critici')
          .insert({
            weekend_id: String(weekendId),
            inviata_at: new Date().toISOString(),
            articoli_critici_count: articoliCriticiCount
          });

        if (errInsert) {
          throw new Error(`Errore registrazione notifica: ${errInsert.message}`);
        }

        await supabase
          .from('push_notifications')
          .update({ status: 'sent' })
          .eq('id', notifica.id);

        console.log(`[SUCCESS] Notifica inviata per weekend ${weekendId}`);
        results.push({
          notificaId: notifica.id,
          weekendId,
          status: 'sent',
          articoliCriticiCount
        });
        successCount++;

      } catch (error) {
        console.error(`[ERROR] Errore notifica ${notifica.id}:`, error.message);

        try {
          await supabase
            .from('push_notifications')
            .update({ status: 'failed' })
            .eq('id', notifica.id);
        } catch (err) {
          console.error('Errore aggiornamento stato:', err);
        }

        results.push({
          notificaId: notifica.id,
          status: 'error',
          error: error.message
        });
        failureCount++;
      }
    }

    console.log(`[SUMMARY ARTICOLI CRITICI] Completato: ${successCount} inviati, ${skipCount} saltati, ${failureCount} falliti`);

    return {
      message: 'Controllo articoli critici completato',
      notificationsFound: notifiche.length,
      successCount,
      skipCount,
      failureCount,
      results
    };

  } catch (error) {
    console.error('[FATAL ARTICOLI CRITICI]', error);
    return {
      error: 'Errore durante il controllo articoli critici',
      message: error?.stack || error.message
    };
  }
}

/* ===================== 3. PENALTY IN SCADENZA ===================== */

async function sendPenaltyScadutiReminders() {
  try {
    console.log('[INFO] Inizio controllo penalty in scadenza...');
    const supabase = getSupabaseClient();

    const oggi = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { data: infrazioniScadute, error: errInfrazioni } = await supabase
      .from('infrazioni')
      .select('*')
      .eq('data_scadenza', oggi);

    if (errInfrazioni) {
      throw new Error(`Errore query infrazioni: ${errInfrazioni.message}`);
    }

    console.log(`[INFO] Trovate ${infrazioniScadute?.length || 0} infrazioni in scadenza oggi`);

    if (!infrazioniScadute || infrazioniScadute.length === 0) {
      console.log('[INFO] Nessun penalty in scadenza oggi');
      return {
        message: 'Nessun penalty in scadenza oggi',
        inviate: 0,
        results: []
      };
    }

    const { data: classificheStandard } = await supabase.from('classifiche').select('id, nome, piloti');
    const { data: classificheCustom } = await supabase.from('classifiche_custom').select('id, nome, piloti');
    const tutteLeClassifiche = [...(classificheStandard || []), ...(classificheCustom || [])];

    const results = [];

    for (const infrazione of infrazioniScadute) {
      try {
        const campionato = tutteLeClassifiche.find(c => String(c.id) === String(infrazione.campionato_id));
        const categoriaNome = campionato?.nome || 'Categoria sconosciuta';
        const pilota = campionato?.piloti?.find(p => String(p.id) === String(infrazione.pilota_id));
        const pilotaNome = pilota?.nome || 'Pilota sconosciuto';

        const notifica = getPenaltyScadutaNotification({
          pilotaNome,
          categoriaNome,
          punti: infrazione.punti,
          motivo: infrazione.motivo
        });

        const notificationPayload = {
          app_id: ONESIGNAL_APP_ID,
          included_segments: ['All'],
          headings: { it: notifica.titolo, en: notifica.titolo },
          contents: { it: notifica.messaggio, en: notifica.messaggio },
          url: 'https://fwm-software.vercel.app/',
          data: {
            type: notifica.tipo,
            infrazione_id: infrazione.id,
            pilota_id: infrazione.pilota_id,
            campionato_id: infrazione.campionato_id
          },
          chrome_web_icon: '/icona_notifiche.png',
          chrome_web_badge: '/icona_notifiche.png'
        };

        console.log(`[SEND] Inviando notifica penalty scaduto per ${pilotaNome} (${categoriaNome})`);
        await sendOneSignalNotification(notificationPayload);

        results.push({
          infrazioneId: infrazione.id,
          pilotaNome,
          categoriaNome,
          status: 'sent'
        });

      } catch (error) {
        console.error(`[ERROR] Errore infrazione ${infrazione.id}:`, error.message);
        results.push({
          infrazioneId: infrazione.id,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log(`[SUMMARY PENALTY] Completato: ${results.length} elaborate`);

    return {
      message: 'Controllo penalty completato',
      inviate: results.length,
      results
    };

  } catch (error) {
    console.error('[FATAL PENALTY]', error);
    return {
      error: 'Errore durante il controllo penalty',
      message: error?.stack || error.message
    };
  }
}

/* ===================== HANDLER PRINCIPALE (Vercel) ===================== */

export default async function handler(req, res) {
  // Verifica che sia una GET request (chiamata da cron-job.org)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const missing = [];
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!process.env.ONESIGNAL_APP_ID) missing.push('ONESIGNAL_APP_ID');
  if (!process.env.ONESIGNAL_API_KEY) missing.push('ONESIGNAL_API_KEY');
  if (missing.length) {
    return res.status(500).json({
      version: VERSION,
      error: 'Missing environment variables',
      missing
    });
  }

  const calendarioResult = await sendCalendarioReminders();
  const articoliCriticiResult = await sendArticoliCriticiReminders();
  const penaltyResult = await sendPenaltyScadutiReminders();

  res.status(200).json({
    version: VERSION,
    calendario: calendarioResult,
    articoliCritici: articoliCriticiResult,
    penaltyScaduti: penaltyResult
  });
}

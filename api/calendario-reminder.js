// API per inviare reminder di 2 giorni prima per gli eventi del calendario accrediti
// Esecuzione: Cron job giornaliero alle 9:00 CET tramite Vercel

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VERSION = '2026-02-06-1';

// OneSignal config
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
  
  // Converti a fuso orario italiano (CET/CEST)
  const italianTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  
  // Aggiungi 2 giorni
  italianTime.setDate(italianTime.getDate() + 2);
  
  // Formato YYYY-MM-DD
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

/**
 * Invia reminder di 2 giorni prima per gli eventi
 */
async function sendCalendarioReminders() {
  try {
    console.log('[INFO] Inizio controllo reminder calendario...');
    const supabase = getSupabaseClient();
    
    // 0. CLEANUP: Cancella reminder di eventi passati per non appesantire il DB
    const oggi = new Date();
    const oggiStr = oggi.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log('[CLEANUP] Cancellazione reminder di eventi passati...');
    
    // Cancella reminder inviati prima di oggi (sull'arrivo della data evento)
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
    
    // 1. Trova tutti gli eventi (inclusi gare) previsti per 2 giorni da oggi
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
        statusCode: 200,
        body: JSON.stringify({
          version: VERSION,
          message: 'Nessun evento da notificare',
          checkedDate: dueDateStr,
          eventsFound: 0
        })
      };
    }
    
    let successCount = 0;
    let failureCount = 0;
    const results = [];
    
    // 2. Per ogni evento, verifica se il reminder è già stato inviato
    for (const evento of eventi) {
      try {
        const { data: reminderSent, error: errCheck } = await supabase
          .from('calendario_reminder_sent')
          .select('id')
          .eq('evento_id', evento.id)
          .eq('reminder_type', 'due_days')
          .eq('status', 'sent')
          .single();
        
        // Se il reminder è già stato inviato, skippa
        if (reminderSent && !errCheck) {
          console.log(`[SKIP] Reminder già inviato per evento ${evento.id}`);
          results.push({
            eventoId: evento.id,
            status: 'skipped',
            reason: 'Reminder già inviato'
          });
          continue;
        }
        
        // 3. Invia la notifica push via OneSignal
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
        const onesignalResult = await sendOneSignalNotification(notificationPayload);
        
        // 4. Registra l'invio del reminder
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
          titre: evento.titolo
        });
        successCount++;
        
      } catch (error) {
        console.error(`[ERROR] Errore evento ${evento.id}:`, error.message);
        
        // Registra l'errore
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
    
    console.log(`[SUMMARY] Completato: ${successCount} inviati, ${failureCount} falliti`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        version: VERSION,
        message: 'Controllo reminder completato',
        checkedDate: dueDateStr,
        eventsFound: eventi.length,
        successCount,
        failureCount,
        results
      })
    };
    
  } catch (error) {
    console.error('[FATAL]', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        version: VERSION,
        error: 'Errore durante il controllo reminder',
        message: error?.stack || error.message
      })
    };
  }
}

// Esporta la funzione per Vercel
export default async function handler(req, res) {
  // Verifica che sia una GET request (Vercel Cron)
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
  
  const result = await sendCalendarioReminders();
  res.status(result.statusCode).json(JSON.parse(result.body));
}
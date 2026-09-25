

import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = '32bc9e36-a2ac-449c-a07c-70168b9b3e37';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Senza questa config, Vercel applica il maxDuration di default del piano
// (10s su Hobby senza Fluid Compute attivo): è la causa più probabile del
// Timeout osservato, indipendentemente dai timeout/concorrenza interni.
export const config = {
  maxDuration: 60,
};

// Funzione per decodificare entità HTML
function decodeHtmlEntities(str) {
  if (!str) return '';
  
  // Decodifica entità numeriche
  let decoded = str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Decodifica entità named
  const entities = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—',
    '&lsquo;': '\u2018', '&rsquo;': '\u2019',
    '&ldquo;': '\u201C', '&rdquo;': '\u201D',
    '&hellip;': '…', '&euro;': '€', '&pound;': '£',
    '&copy;': '©', '&reg;': '®', '&trade;': '™'
  };
  
  Object.keys(entities).forEach(entity => {
    decoded = decoded.replace(new RegExp(entity, 'g'), entities[entity]);
  });
  
  return decoded;
}

function getDomainLabel(url) {
  if (!url || typeof url !== 'string') return 'Fonte sconosciuta';

  try {
    const hostname = new URL(url).hostname || '';
    return hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/^m\./, '') || 'Fonte sconosciuta';
  } catch {
    return 'Fonte sconosciuta';
  }
}

// fetch() nativo IGNORA silenziosamente l'opzione `timeout`. Senza un vero
// timeout, una chiamata a OneSignal lenta o che non risponde blocca
// l'esecuzione senza limiti: è la causa più probabile del Timeout segnalato
// dal cron. Questo helper impone un timeout reale via AbortController.
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
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
// tempi di tutte le notifiche una dopo l'altra fino al timeout).
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

export default async function handler(req, res) {
  const start = Date.now();
  const lockId = `rss-push-${Date.now()}-${Math.random()}`;
  
  try {
    console.log(`🔒 [RSS PUSH] Tentativo lock: ${lockId}`);
    
    // DISTRIBUTED LOCK: verifica se c'è già un'esecuzione in corso
    const { data: existingLock, error: lockCheckError } = await supabase
      .from('rss_push_locks')
      .select('*')
      .eq('lock_name', 'send_rss_push')
      .gte('locked_at', new Date(Date.now() - 30000).toISOString()) // Lock attivi ultimi 30 secondi
      .maybeSingle();
    
    if (existingLock && !lockCheckError) {
      console.log(`⏭️ [RSS PUSH] Lock già attivo (locked_at: ${existingLock.locked_at}), skip`);
      return res.status(200).json({ 
        success: true, 
        sent: 0,
        skipped: true,
        reason: 'Lock already active',
        durationMs: Date.now() - start
      });
    }
    
    // Crea il lock
    const { error: lockError } = await supabase
      .from('rss_push_locks')
      .upsert({ 
        lock_name: 'send_rss_push',
        locked_at: new Date().toISOString(),
        lock_id: lockId
      }, { onConflict: 'lock_name' });
    
    if (lockError) {
      console.error('❌ [RSS PUSH] Errore creazione lock:', lockError);
      // Continua comunque
    } else {
      console.log(`✅ [RSS PUSH] Lock acquisito: ${lockId}`);
    }
    
    console.log('📢 [RSS PUSH] Inizio elaborazione notifiche RSS pending (da rss_notifications_sent)...');

    // 1. Leggi tutte le notifiche pending da rss_notifications_sent
    // Limite volutamente basso: cron-job.org (piano attuale) chiude la
    // connessione a 30s fissi e non è configurabile. Con concorrenza 10 e
    // timeout 6s per notifica, il caso peggiore è ceil(30/10)*6 = 18s,
    // ben sotto i 30s anche se OneSignal è lento su ogni singola chiamata.
    // Le notifiche in eccesso restano 'pending' e vengono processate dal
    // prossimo giro del cron (esegue ogni pochi minuti).
    const { data: notifichePending, error: fetchError } = await supabase
      .from('rss_notifications_sent')
      .select('*')
      .eq('status', 'pending')
      .limit(30);

    if (fetchError) {
      console.error('❌ [RSS PUSH] Errore:', fetchError);
      return res.status(500).json({ 
        success: false, 
        error: fetchError.message,
        durationMs: Date.now() - start
      });
    }

    if (!notifichePending || notifichePending.length === 0) {
      console.log('📭 [RSS PUSH] Nessuna notifica RSS pending');
      return res.status(200).json({ 
        success: true, 
        sent: 0,
        durationMs: Date.now() - start
      });
    }

    console.log(`📢 [RSS PUSH] Trovate ${notifichePending.length} notifiche RSS pending`);

    let sentCount = 0;
    let failedCount = 0;

    // Concorrenza limitata invece di un ciclo sequenziale: se OneSignal è
    // lento, prima si sommavano i tempi di TUTTE le notifiche una dopo
    // l'altra fino al timeout della function.
    await mapWithConcurrency(notifichePending, 10, async (notifica) => {
      try {
        // LOG: Mostra il valore di article_guid e id notifica
        console.log(`[RSS PUSH] Notifica ID: ${notifica.id}, article_guid: ${notifica.article_guid}`);
        // Ricostruisci i dati articolo da rss_articles
        const { data: article, error: articleError } = await supabase
          .from('rss_articles')
          .select('title, description, content, link, feed_id, guid')
          .eq('guid', notifica.article_guid)
          .maybeSingle();

        // LOG: Mostra il risultato della query articolo
        if (articleError) {
          console.error(`[RSS PUSH] Errore query articolo per guid=${notifica.article_guid}:`, articleError);
        }
        if (!article) {
          console.warn(`[RSS PUSH] Articolo non trovato per guid=${notifica.article_guid}`);
        } else {
          console.log(`[RSS PUSH] Articolo trovato: guid=${article.guid}, title=${article.title}`);
        }

        if (articleError || !article) {
          console.log(`⚠️ [RSS PUSH] Notifica ${notifica.id}: articolo non trovato`);
          await supabase
            .from('rss_notifications_sent')
            .update({ 
              status: 'failed', 
              error: 'Articolo non trovato',
              sent_at: DateTime.now().setZone('Europe/Rome').toUTC().toISO(),
              debug_article_guid: notifica.article_guid
            })
            .eq('id', notifica.id);
          failedCount++;
          return;
        }

        // Trova i device dell'utente (dichiarazione UNA SOLA VOLTA per ciclo)
        let devices, devicesError;
        try {
          const res = await supabase
            .from('push_devices')
            .select('player_id, username, device_type')
            .eq('username', notifica.username)
            .not('player_id', 'is', null);
          devices = res.data;
          devicesError = res.error;
        } catch (err) {
          devices = null;
          devicesError = err;
        }

        if (devicesError || !devices || devices.length === 0) {
          console.log(`⚠️ [RSS PUSH] Notifica ${notifica.id}: nessun device`);
          await supabase
            .from('rss_notifications_sent')
            .update({ 
              status: 'failed', 
              error: 'No devices found',
              sent_at: DateTime.now().setZone('Europe/Rome').toUTC().toISO()
            })
            .eq('id', notifica.id);
          failedCount++;
          return;
        }

        const playerIds = devices.map(d => d.player_id).filter(Boolean);
        console.log(`🔍 [RSS PUSH] Notifica ${notifica.id}: ${playerIds.length} player_id`);
        devices.forEach(d => {
          console.log(`[DEBUG DEVICE] username=${d.username}, player_id=${d.player_id}, device_type=${d.device_type}`);
        });
        console.log(`[RSS PUSH] Device trovati per utente ${notifica.username}:`, devices);
        if (devicesError) {
          console.error(`[RSS PUSH] Errore query device:`, devicesError);
        }
        if (!devices || devices.length === 0) {
          console.warn(`[RSS PUSH] Nessun device trovato per utente ${notifica.username}`);
        }

        // Decodifica titolo e descrizione
        const titoloDecodificato = decodeHtmlEntities(article.title || 'Nuovo articolo RSS');
        const descrizioneDecodificata = decodeHtmlEntities(article.description || article.title || 'Nuovo articolo RSS');
        const domainLabel = getDomainLabel(article.link);
        const titoloConFonte = `[${domainLabel}] ${titoloDecodificato}`;
        
        // Prepara payload notifica
        const oneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: playerIds,
          headings: { en: titoloConFonte },
          contents: { en: descrizioneDecodificata },
          data: {
            link: article.link || null,
            feed_id: article.feed_id,
            guid: notifica.article_guid,
            source_domain: domainLabel
          },
          url: article.link || null
        };

        const oneSignalResponse = await fetchWithTimeout('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
          },
          body: JSON.stringify(oneSignalPayload)
        });

        const oneSignalResult = await oneSignalResponse.json();

        if (!oneSignalResponse.ok) {
          console.error(`❌ [RSS PUSH] OneSignal error:`, oneSignalResult);
          await supabase
            .from('rss_notifications_sent')
            .update({ 
              status: 'failed', 
              error: JSON.stringify(oneSignalResult),
              sent_at: new Date().toISOString()
            })
            .eq('id', notifica.id);
          failedCount++;
          return;
        }

        console.log(`✅ [RSS PUSH] Notifica ${notifica.id} inviata!`);
        await supabase
          .from('rss_notifications_sent')
          .update({ 
            status: 'sent',
            sent_at: DateTime.now().setZone('Europe/Rome').toUTC().toISO(),
            onesignal_id: oneSignalResult.id
          })
          .eq('id', notifica.id);
        sentCount++;

      } catch (error) {
        console.error(`❌ [RSS PUSH] Errore notifica ${notifica.id}:`, error);
        await supabase
          .from('rss_notifications_sent')
          .update({ 
            status: 'failed', 
            error: error.message,
            sent_at: DateTime.now().setZone('Europe/Rome').toUTC().toISO()
          })
          .eq('id', notifica.id);
        failedCount++;
      }
    });

    console.log(`✅ [RSS PUSH] Completato! Sent: ${sentCount}, Failed: ${failedCount}`);
    
    // Rilascia il lock
    try {
      await supabase
        .from('rss_push_locks')
        .delete()
        .eq('lock_name', 'send_rss_push')
        .eq('lock_id', lockId);
      console.log(`🔓 [RSS PUSH] Lock rilasciato: ${lockId}`);
    } catch (lockReleaseError) {
      console.error('❌ [RSS PUSH] Errore rilascio lock:', lockReleaseError);
    }
    
    return res.status(200).json({ 
      success: true, 
      sent: sentCount, 
      failed: failedCount,
      total: notifichePending.length,
      durationMs: Date.now() - start
    });

  } catch (error) {
    console.error('❌ [RSS PUSH] Errore generale:', error);
    
    // Rilascia il lock anche in caso di errore
    try {
      await supabase
        .from('rss_push_locks')
        .delete()
        .eq('lock_name', 'send_rss_push');
      console.log(`🔓 [RSS PUSH] Lock rilasciato (errore)`);
    } catch (lockReleaseError) {
      console.error('❌ [RSS PUSH] Errore rilascio lock:', lockReleaseError);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      durationMs: Date.now() - start
    });
  }
}

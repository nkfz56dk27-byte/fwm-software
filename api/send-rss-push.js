
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = '32bc9e36-a2ac-449c-a07c-70168b9b3e37';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const start = Date.now();
  try {
    console.log('📢 [RSS PUSH] Inizio elaborazione notifiche RSS pending (da rss_notifications_sent)...');

    // 1. Leggi tutte le notifiche pending da rss_notifications_sent
    const { data: notifichePending, error: fetchError } = await supabase
      .from('rss_notifications_sent')
      .select('*')
      .eq('status', 'pending')
      .limit(100);

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

    for (const notifica of notifichePending) {
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
              sent_at: new Date().toISOString(),
              debug_article_guid: notifica.article_guid
            })
            .eq('id', notifica.id);
          failedCount++;
          continue;
        }

        // Trova i device dell'utente (dichiarazione UNA SOLA VOLTA per ciclo)
        let devices, devicesError;
        try {
          const res = await supabase
            .from('push_devices')
            .select('player_id, username')
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
              sent_at: new Date().toISOString()
            })
            .eq('id', notifica.id);
          failedCount++;
          continue;
        }

        const playerIds = devices.map(d => d.player_id).filter(Boolean);
        console.log(`🔍 [RSS PUSH] Notifica ${notifica.id}: ${playerIds.length} player_id`);
        console.log(`[RSS PUSH] Device trovati per utente ${notifica.username}:`, devices);
        if (devicesError) {
          console.error(`[RSS PUSH] Errore query device:`, devicesError);
        }
        if (!devices || devices.length === 0) {
          console.warn(`[RSS PUSH] Nessun device trovato per utente ${notifica.username}`);
        }

        // Prepara payload notifica
        const oneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: playerIds,
          headings: { en: article.title || 'Nuovo articolo RSS' },
          contents: { en: article.description || '' },
          data: {
            link: article.link || null,
            feed_id: article.feed_id,
            guid: notifica.article_guid
          },
          url: article.link || null
        };

        const oneSignalResponse = await fetch('https://onesignal.com/api/v1/notifications', {
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
          continue;
        }

        console.log(`✅ [RSS PUSH] Notifica ${notifica.id} inviata!`);
        await supabase
          .from('rss_notifications_sent')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            onesignal_id: oneSignalResult.id
          })
          .eq('id', notifica.id);
        sentCount++;

      } catch (error) {
        console.error(`❌ [RSS PUSH] Errore notifica ${notifica.id}:`, error);
        if (typeof oneSignalPayload !== 'undefined') {
          console.log(`[RSS PUSH] Payload OneSignal:`, oneSignalPayload);
        }
        await supabase
          .from('rss_notifications_sent')
          .update({ 
            status: 'failed', 
            error: error.message,
            sent_at: new Date().toISOString()
          })
          .eq('id', notifica.id);
        failedCount++;
      }
    }

    console.log(`✅ [RSS PUSH] Completato! Sent: ${sentCount}, Failed: ${failedCount}`);
    return res.status(200).json({ 
      success: true, 
      sent: sentCount, 
      failed: failedCount,
      total: notifichePending.length,
      durationMs: Date.now() - start
    });

  } catch (error) {
    console.error('❌ [RSS PUSH] Errore generale:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      durationMs: Date.now() - start
    });
  }
}
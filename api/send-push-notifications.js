import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = '32bc9e36-a2ac-449c-a07c-70168b9b3e37';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY; // ⚠️ Aggiungi in Vercel Env

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const start = Date.now();
  
  try {
    console.log('📢 [PUSH] Inizio elaborazione notifiche pending...');

    // 1. Leggi tutte le notifiche pending
    const { data: notifichePending, error: fetchError } = await supabase
      .from('push_notifications')
      .select('*')
      .eq('status', 'pending')
      .limit(100);

    if (fetchError) {
      console.error('❌ [PUSH] Errore caricamento notifiche:', fetchError);
      return res.status(500).json({ 
        success: false, 
        error: fetchError.message,
        durationMs: Date.now() - start
      });
    }

    if (!notifichePending || notifichePending.length === 0) {
      console.log('📭 [PUSH] Nessuna notifica pending');
      return res.status(200).json({ 
        success: true, 
        sent: 0,
        durationMs: Date.now() - start
      });
    }

    console.log(`📢 [PUSH] Trovate ${notifichePending.length} notifiche pending`);

    let sentCount = 0;
    let failedCount = 0;

    // 2. Per ogni notifica
    for (const notifica of notifichePending) {
      try {
        const targetUsers = notifica.target_users || [];
        
        if (targetUsers.length === 0) {
          console.log(`⚠️ [PUSH] Notifica ${notifica.id}: nessun target_user`);
          await supabase
            .from('push_notifications')
            .update({ 
              status: 'failed', 
              error: 'No target users',
              sent_at: new Date().toISOString()
            })
            .eq('id', notifica.id);
          failedCount++;
          continue;
        }

        // 3. Trova player_id per ogni username
        const { data: devices, error: devicesError } = await supabase
          .from('push_devices')
          .select('player_id, username')
          .in('username', targetUsers)
          .not('player_id', 'is', null);

        if (devicesError || !devices || devices.length === 0) {
          console.log(`⚠️ [PUSH] Notifica ${notifica.id}: nessun device per utenti ${targetUsers.join(', ')}`);
          await supabase
            .from('push_notifications')
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
        console.log(`🔍 [PUSH] Notifica ${notifica.id}: ${playerIds.length} player_id trovati per ${targetUsers.length} utenti`);

        // 4. Invia notifica via OneSignal REST API
        const oneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: playerIds,
          headings: { en: notifica.title || 'Notifica' },
          contents: { en: notifica.body || '' },
          data: notifica.data || {},
          url: notifica.data?.link || null
        };

        console.log(`📤 [PUSH] Invio a OneSignal:`, { 
          playerIds: playerIds.length, 
          title: notifica.title 
        });

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
          console.error(`❌ [PUSH] OneSignal error per notifica ${notifica.id}:`, oneSignalResult);
          await supabase
            .from('push_notifications')
            .update({ 
              status: 'failed', 
              error: JSON.stringify(oneSignalResult),
              sent_at: new Date().toISOString()
            })
            .eq('id', notifica.id);
          failedCount++;
          continue;
        }

        // 5. Aggiorna status a 'sent'
        console.log(`✅ [PUSH] Notifica ${notifica.id} inviata! Recipients: ${oneSignalResult.recipients}`);
        
        await supabase
          .from('push_notifications')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            onesignal_id: oneSignalResult.id
          })
          .eq('id', notifica.id);
        
        sentCount++;

      } catch (error) {
        console.error(`❌ [PUSH] Errore notifica ${notifica.id}:`, error);
        await supabase
          .from('push_notifications')
          .update({ 
            status: 'failed', 
            error: error.message,
            sent_at: new Date().toISOString()
          })
          .eq('id', notifica.id);
        failedCount++;
      }
    }

    console.log(`✅ [PUSH] Completato! Sent: ${sentCount}, Failed: ${failedCount}`);

    return res.status(200).json({ 
      success: true, 
      sent: sentCount, 
      failed: failedCount,
      total: notifichePending.length,
      durationMs: Date.now() - start
    });

  } catch (error) {
    console.error('❌ [PUSH] Errore generale:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      durationMs: Date.now() - start
    });
  }
}

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_APP_ID = '32bc9e36-a2ac-449c-a07c-70168b9b3e37';
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const start = Date.now();
  
  try {
    console.log('📢 [RSS PUSH] Inizio elaborazione notifiche RSS pending...');

    const { data: notifichePending, error: fetchError } = await supabase
      .from('push_notifications_rss_filter')
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
        const targetUsers = notifica.target_users || [];
        
        if (targetUsers.length === 0) {
          console.log(`⚠️ [RSS PUSH] Notifica ${notifica.id}: nessun target_user`);
          await supabase
            .from('push_notifications_rss_filter')
            .update({ 
              status: 'failed', 
              error: 'No target users',
              sent_at: new Date().toISOString()
            })
            .eq('id', notifica.id);
          failedCount++;
          continue;
        }

        const { data: devices, error: devicesError } = await supabase
          .from('push_devices')
          .select('player_id, username')
          .in('username', targetUsers)
          .not('player_id', 'is', null);

        if (devicesError || !devices || devices.length === 0) {
          console.log(`⚠️ [RSS PUSH] Notifica ${notifica.id}: nessun device`);
          await supabase
            .from('push_notifications_rss_filter')
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

        const oneSignalPayload = {
          app_id: ONESIGNAL_APP_ID,
          include_player_ids: playerIds,
          headings: { en: notifica.title || 'Nuovo articolo RSS' },
          contents: { en: notifica.body || '' },
          data: notifica.data || {},
          url: notifica.data?.link || null
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
            .from('push_notifications_rss_filter')
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
          .from('push_notifications_rss_filter')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            onesignal_id: oneSignalResult.id
          })
          .eq('id', notifica.id);
        
        sentCount++;

      } catch (error) {
        console.error(`❌ [RSS PUSH] Errore notifica ${notifica.id}:`, error);
        await supabase
          .from('push_notifications_rss_filter')
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
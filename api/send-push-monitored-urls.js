import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || process.env.ONESIGNAL_REST_API_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '32bc9e36-a2ac-449c-a07c-70168b9b3e37';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getPlayerIds({ userId, username }) {
  // Schema nuovo: user_id + active
  if (userId) {
    const q1 = await supabase
      .from('push_devices')
      .select('player_id')
      .eq('user_id', userId)
      .eq('active', true)
      .not('player_id', 'is', null);

    if (!q1.error && Array.isArray(q1.data) && q1.data.length > 0) {
      const ids = q1.data.map(d => d.player_id).filter(Boolean);
      if (ids.length > 0) return ids;
    }
  }

  // Schema legacy: username + attivo
  if (username) {
    const q2 = await supabase
      .from('push_devices')
      .select('player_id')
      .eq('username', username)
      .eq('attivo', true)
      .not('player_id', 'is', null);

    if (!q2.error && Array.isArray(q2.data) && q2.data.length > 0) {
      const ids = q2.data.map(d => d.player_id).filter(Boolean);
      if (ids.length > 0) return ids;
    }

    // Fallback: username senza colonna attivo
    const q3 = await supabase
      .from('push_devices')
      .select('player_id')
      .eq('username', username)
      .not('player_id', 'is', null);

    if (!q3.error && Array.isArray(q3.data) && q3.data.length > 0) {
      return q3.data.map(d => d.player_id).filter(Boolean);
    }
  }

  return [];
}

async function sendOneSignalNotification({ title, body, userId, username, url }) {
  const playerIds = await getPlayerIds({ userId, username });
  if (playerIds.length === 0) {
    return { success: false, reason: 'no_devices' };
  }

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: playerIds,
    headings: { en: title || 'Novità sul link monitorato' },
    contents: { en: body || 'È stata rilevata una modifica su un link monitorato.' },
    url: url || undefined
  };

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${ONESIGNAL_API_KEY}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(result));
  }

  return { success: true, onesignalId: result.id };
}

export default async function handler(req, res) {
  const start = Date.now();

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ success: false, error: 'Missing Supabase env vars', durationMs: Date.now() - start });
    }
    if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
      return res.status(500).json({ success: false, error: 'Missing OneSignal env vars', durationMs: Date.now() - start });
    }

    const { data: notifications, error } = await supabase
      .from('push_notifications_monitored_urls')
      .select('id, user_id, username, url_id, title, body, status')
      .eq('status', 'pending')
      .limit(100);

    if (error) {
      return res.status(500).json({ success: false, error: error.message, durationMs: Date.now() - start });
    }

    if (!notifications || notifications.length === 0) {
      return res.status(200).json({ success: true, sent: 0, failed: 0, durationMs: Date.now() - start });
    }

    let sent = 0;
    let failed = 0;

    for (const notif of notifications) {
      try {
        const { data: monitoredUrl } = await supabase
          .from('monitored_urls')
          .select('url')
          .eq('id', notif.url_id)
          .maybeSingle();

        const sendResult = await sendOneSignalNotification({
          title: notif.title,
          body: notif.body,
          userId: notif.user_id,
          username: notif.username,
          url: monitoredUrl?.url || undefined
        });

        if (!sendResult.success) {
          await supabase
            .from('push_notifications_monitored_urls')
            .update({ status: 'failed', error: sendResult.reason || 'send_failed', sent_at: new Date().toISOString() })
            .eq('id', notif.id);
          failed++;
          continue;
        }

        await supabase
          .from('push_notifications_monitored_urls')
          .update({ status: 'sent', sent_at: new Date().toISOString(), onesignal_id: sendResult.onesignalId || null })
          .eq('id', notif.id);

        sent++;
      } catch (err) {
        await supabase
          .from('push_notifications_monitored_urls')
          .update({ status: 'failed', error: err.message, sent_at: new Date().toISOString() })
          .eq('id', notif.id);
        failed++;
      }
    }

    return res.status(200).json({
      success: true,
      sent,
      failed,
      total: notifications.length,
      durationMs: Date.now() - start
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, durationMs: Date.now() - start });
  }
}

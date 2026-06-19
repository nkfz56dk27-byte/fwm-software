// Script di monitoraggio automatico per monitored_urls
// Controlla periodicamente i link, rileva modifiche e invia notifiche solo agli utenti che hanno attivato il filtro su quel feed

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getMonitoredUrls() {
  const { data, error } = await supabase.from('monitored_urls').select('*');
  if (error) throw error;
  return data || [];
}

async function getNotificationFiltersForUrl(urlId) {
  // feedId è monitored_{id}
  const feedId = `monitored_${urlId}`;
  const { data, error } = await supabase
    .from('rss_notification_filters')
    .select('username')
    .eq('filter_type', 'feed')
    .eq('value', feedId);
  if (error) throw error;
  return (data || []).map(row => row.username);
}

async function getLastHash(urlId) {
  const { data, error } = await supabase
    .from('monitored_urls')
    .select('last_hash')
    .eq('id', urlId)
    .single();
  if (error) return null;
  return data?.last_hash || null;
}

async function updateLastHash(urlId, hash) {
  await supabase.from('monitored_urls').update({ last_hash: hash }).eq('id', urlId);
}

async function sendNotification(usernames, url) {
  if (!usernames.length) return;
  await supabase.from('push_notifications').insert({
    title: 'Modifica rilevata su link monitorato',
    body: `Il link ${url} è stato modificato.`,
    notification_type: 'monitored_url',
    target_all: false,
    target_users: usernames,
    data: { url }
  });
}

async function monitor() {
  const urls = await getMonitoredUrls();
  for (const urlObj of urls) {
    try {
      const res = await fetch(urlObj.url);
      const text = await res.text();
      const hash = crypto.createHash('sha256').update(text).digest('hex');
      const lastHash = await getLastHash(urlObj.id);
      if (lastHash && lastHash !== hash) {
        // Modifica rilevata
        const usernames = await getNotificationFiltersForUrl(urlObj.id);
        await sendNotification(usernames, urlObj.url);
      }
      await updateLastHash(urlObj.id, hash);
    } catch (err) {
      console.error('Errore monitoraggio url', urlObj.url, err);
    }
  }
}

monitor().then(() => process.exit(0));

// Script: process-monitored-urls.cjs
// Controlla periodicamente i link in monitored_urls e invia notifiche agli utenti attivi

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Prendi tutti i link monitorati
  const { data: links, error: linksError } = await supabase
    .from('monitored_urls')
    .select('*');
  if (linksError) {
    console.error('Errore query monitored_urls:', linksError);
    process.exit(1);
  }
  for (const link of links) {
    try {
      // 2. Fai fetch del contenuto del link
      const response = await fetch(link.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Monitor Link Web)' } });
      if (!response.ok) continue;
      const html = await response.text();
      // 3. Controlla se ci sono novità (esempio: hash del contenuto)
      const contentHash = require('crypto').createHash('sha256').update(html).digest('hex');
      // 4. Confronta con ultimo hash salvato (aggiungi campo last_hash in monitored_urls)
      if (link.last_hash !== contentHash) {
        // 5. Aggiorna hash nel db
        await supabase.from('monitored_urls').update({ last_hash: contentHash }).eq('id', link.id);
        // 6. Trova utenti attivi per questo link (esempio: tabella monitored_urls_subscriptions)
        const { data: subs, error: subsError } = await supabase
          .from('monitored_urls_subscriptions')
          .select('user_id')
          .eq('url_id', link.id)
          .eq('active', true);
        if (subsError) continue;
        // 7. Inserisci notifica pending per ogni utente attivo
        for (const sub of subs) {
          await supabase.from('push_notifications_monitored_urls').insert({
            user_id: sub.user_id,
            url_id: link.id,
            status: 'pending',
            title: 'Novità sul link monitorato',
            body: `Il link ${link.url} ha subito modifiche.`
          });
        }
      }
    } catch (err) {
      console.error('Errore controllo link:', link.url, err);
    }
  }
  console.log('Controllo link web completato.');
}

main();

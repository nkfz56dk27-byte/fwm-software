import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Funzione automatica: processa tutti i nuovi articoli RSS
async function processNewRssArticles() {
  // Recupera tutti gli articoli non notificati (status = 'new')
  const { data: articles, error: articleError } = await supabase
    .from('rss_articles_buffer')
    .select('*')
    .eq('status', 'new');

  if (articleError) throw articleError;

  for (const article of articles) {
    // Recupera tutti i filtri degli utenti
    const { data: filters, error: filterError } = await supabase
      .from('push_notification_filters')
      .select('username, feed_id, keywords');
    if (filterError) throw filterError;

    // Trova utenti che hanno selezionato il feed o parole chiave
    let targetUsers = [];
    for (const filter of filters) {
      // Se il feed corrisponde
      if (filter.feed_id === article.feed_id) {
        targetUsers.push(filter.username);
        continue;
      }
      // Se ci sono parole chiave e il titolo contiene almeno una
      if (filter.keywords && Array.isArray(filter.keywords)) {
        for (const kw of filter.keywords) {
          if (article.title && article.title.toLowerCase().includes(kw.toLowerCase())) {
            targetUsers.push(filter.username);
            break;
          }
        }
      }
    }
    // Rimuovi duplicati
    targetUsers = [...new Set(targetUsers)];
    if (targetUsers.length === 0) {
      // Nessun destinatario, segna l'articolo come ignorato
      await supabase.from('rss_articles_buffer').update({ status: 'ignored' }).eq('id', article.id);
      continue;
    }
    // Inserisci la notifica RSS filtrata
    await supabase.from('push_notifications_rss_filter').insert([{
      title: article.title,
      body: article.description || article.title,
      notification_type: 'rss_filter',
      target_users: targetUsers,
      data: { link: article.link, guid: article.guid, feed_id: article.feed_id },
      status: 'pending'
    }]);
    // Segna l'articolo come notificato
    await supabase.from('rss_articles_buffer').update({ status: 'notified' }).eq('id', article.id);
    console.log('Notifica inserita per:', targetUsers, 'articolo:', article.title);
  }
}

// Esegui la funzione automatica
processNewRssArticles();

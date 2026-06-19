import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function insertRssNotification({ feed_id, title, body, link, guid }) {
  // Recupera utenti che hanno selezionato il feed
  const { data: filterRows, error: filterError } = await supabase
    .from('push_notification_filters')
    .select('username')
    .eq('feed_id', feed_id);

  if (filterError) throw filterError;
  const targetUsers = filterRows.map(row => row.username);

  // Inserisci la notifica
  const { error } = await supabase
    .from('push_notifications_rss_filter')
    .insert([{
      title,
      body,
      notification_type: 'rss_filter',
      target_users: targetUsers,
      data: { link, guid, feed_id },
      status: 'pending'
    }]);

  if (error) throw error;
  console.log('Notifica RSS inserita per:', targetUsers);
}

// Esegui questo script quando trovi un nuovo articolo RSS
// Esempio di utilizzo:
insertRssNotification({
  feed_id: '41ef9510-af38-4a4b-bd34-82265e512357',
  title: 'Nuovo articolo Formula 1',
  body: 'Leggi subito l\'ultimo articolo!',
  link: 'https://www.formula1.it/',
  guid: 'test-guid-456'
});

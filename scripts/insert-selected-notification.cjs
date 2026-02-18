const dotenv = require('dotenv');
dotenv.config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

// Inserisci qui i player_id OneSignal degli utenti selezionati
const selectedPlayerIds = [
  '4e95d530-9903-4787-b7a7-eecf932ed34d',
  // aggiungi altri player_id se vuoi inviare a più utenti
];

async function inserisciNotificaSoloSelezionati() {
  const { error } = await supabase
    .from('push_notifications_rss_filter')
    .insert([
      {
        title: 'Test notifica solo utenti selezionati',
        body: 'Questa è una notifica di test inviata solo ai player_id selezionati',
        notification_type: 'rss_filter',
        target_users: selectedPlayerIds,
        data: {
          link: 'https://www.formula1.it/',
          feed_id: '41ef9510-af38-4a4b-bd34-82265e512357',
          guid: 'test-guid-selezionati'
        },
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ]);
  if (error) {
    console.error('Errore inserimento notifica:', error);
    process.exit(1);
  }
  console.log('Notifica inserita solo per player_id selezionati:', selectedPlayerIds);
  process.exit(0);
}

inserisciNotificaSoloSelezionati();

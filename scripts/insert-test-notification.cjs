const dotenv = require('dotenv');
dotenv.config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function inserisciNotificaConDeviceId(username) {
  // Recupera i device_id attivi
  const { data: devices, error: errorDevices } = await supabase
    .from('push_devices')
    .select('device_id')
    .eq('username', username)
    .eq('attivo', true);

  if (errorDevices) {
    console.error('Errore recupero device_id:', errorDevices);
    process.exit(1);
  }

  const deviceIds = devices.map(d => d.device_id);
  if (!deviceIds.length) {
    console.error('Nessun device_id attivo trovato per', username);
    process.exit(1);
  }

  // Inserisce la notifica push con device_id
  const { error: errorInsert } = await supabase
    .from('push_notifications_rss_filter')
    .insert([
      {
        title: 'Test notifica RSS con device_id',
        body: 'Questa è una notifica di test con device_id',
        notification_type: 'rss_filter',
        target_users: deviceIds,
        data: {
          link: 'https://www.formula1.it/',
          feed_id: '41ef9510-af38-4a4b-bd34-82265e512357',
          guid: 'test-guid-456'
        },
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ]);

  if (errorInsert) {
    console.error('Errore inserimento notifica:', errorInsert);
    process.exit(1);
  }

  console.log('Notifica di test inserita con device_id:', deviceIds);
  process.exit(0);
}

inserisciNotificaConDeviceId('gcianci');

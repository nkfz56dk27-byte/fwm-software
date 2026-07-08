// Script polling per invio notifiche push automatiche da Supabase
// Esegui: node scripts/process-push-notifications.js
const { createClient } = require('@supabase/supabase-js');
const { sendOneSignalNotification } = require('./send-onesignal.cjs');

// Configura Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://vfflpwrneminmnzmmwtu.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'INSERISCI_LA_SERVICE_ROLE_KEY_SUPABASE';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceRoleKey === 'INSERISCI_LA_SERVICE_ROLE_KEY_SUPABASE') {
  console.error('[FATAL] Service Role Key NON impostata! Esci subito.');
  process.exit(1);
}

console.log('[DEBUG] Supabase URL:', supabaseUrl);
console.log('[DEBUG] Service Role Key (inizio):', supabaseServiceRoleKey.substring(0, 8) + '...');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Funzione generica per processare una tabella di notifiche pending
async function processTable(tableName) {
  const { data: notifications, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('status', 'pending');

  if (error) {
    console.error(`[FATAL] Errore query pending su ${tableName}:`, error);
    return 0;
  }

  console.log(`[DEBUG] Notifiche pending trovate (${tableName}): ${notifications ? notifications.length : 0}`);

  let sent = 0;

  for (const notif of notifications || []) {
    console.log(`[DEBUG] PROCESSO NOTIFICA (${tableName}):`, notif);
    try {
      const onesignalRes = await sendOneSignalNotification({
        title: notif.title,
        body: notif.body,
        url: notif.url || '/',
        data: notif.data || {}
      });
      console.log(`[DEBUG] Notifica inviata tramite OneSignal (${tableName}): ${notif.title}`, onesignalRes);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ status: 'sent' })
        .eq('id', notif.id);

      if (updateError) {
        console.error(`[ERROR] Errore update notifica id ${notif.id} (${tableName}):`, updateError.message, updateError);
      } else {
        console.log(`[DEBUG] Notifica id ${notif.id} (${tableName}) aggiornata a sent`);
        sent++;
      }
    } catch (err) {
      console.error(`[ERROR] Errore invio OneSignal (${tableName}):`, err && err.message, err);

      const { error: updateError } = await supabase
        .from(tableName)
        .update({ status: 'error', error_message: (err && err.message) ? err.message : String(err) })
        .eq('id', notif.id);

      if (updateError) {
        console.error(`[ERROR] Errore update notifica id ${notif.id} (${tableName}) a error:`, updateError.message, updateError);
      } else {
        console.log(`[DEBUG] Notifica id ${notif.id} (${tableName}) aggiornata a error con messaggio:`, (err && err.message) ? err.message : String(err));
      }
    }
  }

  return sent;
}

async function processNotifications() {
  let totalSent = 0;

  // Processa tutte e tre le tabelle di notifiche
  totalSent += await processTable('push_disponibilita_weekend');
  totalSent += await processTable('push_calendario_accrediti');
  totalSent += await processTable('push_notifications');

  console.log(`✅ Notifiche processate! Totale inviate: ${totalSent}`);
}

processNotifications().catch(err => {
  console.error('[FATAL] Errore generale:', err);
  process.exit(1);
});

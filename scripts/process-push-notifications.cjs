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




async function processNotifications() {
  // 1. Prendi tutte le notifiche pending dalla tabella push_notifications
  const { data: notifications, error } = await supabase
    .from('push_notifications')
    .select('*')
    .eq('status', 'pending');
  if (error) {
    console.error('[FATAL] Errore query pending:', error);
    process.exit(1);
  }
  console.log(`[DEBUG] Notifiche pending trovate (disponibilita_weekend): ${notifications ? notifications.length : 0}`);

  for (const notif of notifications) {
    console.log('[DEBUG] PROCESSO NOTIFICA:', notif);
    try {
      const onesignalRes = await sendOneSignalNotification({
        title: notif.title,
        body: notif.body,
        url: '/',
        data: notif.data || {}
      });
      console.log(`[DEBUG] Notifica inviata tramite OneSignal: ${notif.title}`, onesignalRes);
      // Aggiorna lo status a 'sent'
      const { error: updateError } = await supabase
        .from('push_disponibilita_weekend')
        .from('push_calendario_accrediti')
        .from('push_notifications')
        .update({ status: 'sent' })
        .eq('id', notif.id);
      if (updateError) {
        console.error(`[ERROR] Errore update notifica id ${notif.id}:`, updateError.message, updateError);
      } else {
        console.log(`[DEBUG] Notifica id ${notif.id} aggiornata a sent`);
      }
    } catch (err) {
      console.error(`[ERROR] Errore invio OneSignal:`, err && err.message, err);
      // Aggiorna lo status a 'error' e salva il messaggio di errore
      const { error: updateError } = await supabase
        .from('push_notifications')
        .update({ status: 'error', error_message: (err && err.message) ? err.message : String(err) })
        .eq('id', notif.id);
      if (updateError) {
        console.error(`[ERROR] Errore update notifica id ${notif.id} a error:`, updateError.message, updateError);
      } else {
        console.log(`[DEBUG] Notifica id ${notif.id} aggiornata a error con messaggio:`, (err && err.message) ? err.message : String(err));
      }
    }
  }
  console.log('✅ Notifiche processate!');
}

processNotifications().catch(console.error);

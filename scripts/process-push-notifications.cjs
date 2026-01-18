// Script polling per invio notifiche push automatiche da Supabase
// Esegui: node scripts/process-push-notifications.js

const { createClient } = require('@supabase/supabase-js');
const { sendOneSignalNotification } = require('./send-onesignal.cjs');

// Configura Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://vfflpwrneminmnzmmwtu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'INSERISCI_LA_SERVICE_ROLE_KEY_SUPABASE'
);



async function processNotifications() {
  // 1. Prendi tutte le notifiche pending
  const { data: notifications, error } = await supabase
    .from('push_notifications')
    .select('*')
    .eq('status', 'pending');
  if (error) throw error;
  console.log(`[DEBUG] Notifiche pending trovate: ${notifications ? notifications.length : 0}`);



  for (const notif of notifications) {
    try {
      await sendOneSignalNotification({
        title: notif.title,
        body: notif.body,
        url: '/',
        data: {
          tipo: notif.notification_type || 'info',
          timestamp: new Date().toISOString()
        }
      });
      console.log(`[DEBUG] Notifica inviata tramite OneSignal: ${notif.title}`);
    } catch (err) {
      console.log(`[DEBUG] Errore invio OneSignal:`, err && err.message);
    }
    // Aggiorna lo status a 'sent'
    const { error: updateError } = await supabase
      .from('push_notifications')
      .update({ status: 'sent' })
      .eq('id', notif.id);
    if (updateError) {
      console.log(`[DEBUG] Errore update notifica id ${notif.id}:`, updateError.message);
    } else {
      console.log(`[DEBUG] Notifica id ${notif.id} aggiornata a sent`);
    }
  }
  console.log('✅ Notifiche processate!');
}

processNotifications().catch(console.error);

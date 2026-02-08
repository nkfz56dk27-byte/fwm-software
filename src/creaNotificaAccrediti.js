// Adattamento della funzione creaNotifica da DisponibilitaWeekend per Accrediti
import { supabase } from './supabaseClient'
import { inserisciNotificaPush } from './pushNotificationService'

/**
 * Crea una notifica interna e una push per accrediti
 * @param {string} messaggio - Testo della notifica
 * @param {string|number|null} evento_id - ID evento calendario (opzionale)
 */
export async function creaNotificaAccrediti(messaggio, evento_id = null) {
  try {
    // evento_id deve essere un intero o null, mai una stringa UUID
    let eventoIdInt = null;
    if (evento_id && typeof evento_id === 'string' && /^[0-9]+$/.test(evento_id)) {
      eventoIdInt = parseInt(evento_id, 10);
    } else if (typeof evento_id === 'number') {
      eventoIdInt = evento_id;
    } else {
      eventoIdInt = null;
    }
    const payload = { messaggio, evento_id: eventoIdInt };
    console.log('[DEBUG CREA NOTIFICA ACCREDITI] Payload che verrà inserito:', payload);
    const { data, error } = await supabase.from('notifiche_calendario').insert(payload);
    if (error) {
      console.error('[ERRORE SUPABASE INSERT ACCREDITI]', error, 'Payload:', payload);
    } else {
      console.log('[DEBUG CREA NOTIFICA ACCREDITI] Insert riuscito:', data);
      // --- PUSH NOTIFICATION (OneSignal pipeline, tabella push_notifications) ---
      try {
        const { error: pushError, id } = await inserisciNotificaPush({
          title: 'Accrediti',
          body: messaggio,
          notification_type: 'accrediti',
          target_all: true,
          data: { evento_id: eventoIdInt }
        });
        if (pushError) {
          console.error('[ERRORE INSERIMENTO push_notifications ACCREDITI]', pushError);
        } else {
          console.log('[DEBUG CREA NOTIFICA PUSH ACCREDITI] Inserita in push_notifications', id);
        }
      } catch (pushErr) {
        console.error('[ERRORE JS INSERIMENTO push_notifications ACCREDITI]', pushErr);
      }
    }
  } catch (err) {
    console.error('[ERRORE JS CREA NOTIFICA ACCREDITI]', err);
  }
}

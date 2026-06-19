import { supabase } from './supabaseClient'

/**
 * Inserisce una notifica push nella tabella push_calendario_accrediti
 * @param {Object} param0 - Oggetto con i dati della notifica
 * @param {string} param0.title - Titolo della notifica
 * @param {string} param0.body - Corpo della notifica
 * @param {string} [param0.notification_type] - Tipo di notifica (es: calendario_accrediti)
 * @param {boolean} [param0.target_all] - Se true, invia a tutti
 * @param {Object} [param0.data] - Dati aggiuntivi (opzionale)
 * @returns {Promise<{id?: number, error?: any}>}
 */
export async function inserisciNotificaPushCalendario({ title, body, notification_type = 'calendario_accrediti', target_all = true, data = {} }) {
  try {
    const { data: insertData, error } = await supabase.from('push_calendario_accrediti').insert({
      title,
      body,
      notification_type,
      target_all,
      data,
      status: 'pending',
      created_at: new Date().toISOString()
    }).select().single();
    if (error) {
      console.error('[PUSH_CALENDARIO] Errore inserimento:', error);
      return { error };
    }
    return { id: insertData?.id };
  } catch (error) {
    console.error('[PUSH_CALENDARIO] Errore try/catch:', error);
    return { error };
  }
}

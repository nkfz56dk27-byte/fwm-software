import { supabase } from './supabaseClient'

/**
 * Inserisce una notifica interna nella tabella notifiche_calendario
 * @param {Object} params
 * @param {string} params.tipo - Tipo notifica (es: 'nuovo_evento', 'modifica', 'nota')
 * @param {string} params.messaggio - Testo della notifica
 * @param {number|string|null} [params.evento_id] - ID evento calendario (BIGINT)
 * @param {string|null} [params.weekend_id] - UUID weekend (opzionale)
 * @returns {Promise<{data: any, error: any}>}
 */
export async function inserisciNotificaCalendario({ tipo, messaggio, evento_id = null, weekend_id = null }) {
  try {
    console.error('FORZATO: ENTRATA in inserisciNotificaCalendario', { tipo, messaggio, evento_id, weekend_id, chiamata: new Error().stack });
    if (typeof window !== 'undefined') {
      window._debugNotificaCalendario = window._debugNotificaCalendario || [];
      window._debugNotificaCalendario.push({ step: 'ENTRATA in inserisciNotificaCalendario', args: { tipo, messaggio, evento_id, weekend_id }, time: new Date().toISOString(), stack: new Error().stack });
    }
    // Conversione tipi: evento_id solo se è un numero intero valido
    // Gestione evento_id (BIGINT) e evento_uuid (UUID)
    // Log input
    console.error('[DEBUG CREA NOTIFICA CALENDARIO] input:', { tipo, messaggio, evento_id, weekend_id });
    // Payload minimale, nessuna conversione
    const payload = {
      tipo: String(tipo),
      messaggio: String(messaggio),
      evento_id: evento_id !== null && evento_id !== undefined ? Number(evento_id) : null,
      weekend_id: weekend_id || null,
      created_at: new Date().toISOString()
    };
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
    // ...log debug payload rimosso...
    try {
      const { data, error } = await supabase.from('notifiche_calendario').insert([payload]).select();
      if (error) {
        console.error('[ERRORE SUPABASE INSERT CALENDARIO]', error, 'Payload:', payload);
      } else {
        // ...log debug insert rimosso...
      }
      return { data, error };
    } catch (err) {
      console.error('[ERRORE CREA NOTIFICA CALENDARIO] Errore generico:', err);
      return { data: null, error: err };
    }
    return { data, error };
  } catch (err) {
    console.error('[NOTIFICA CALENDARIO] Errore JS:', err);
    return { data: null, error: err };
  }
}

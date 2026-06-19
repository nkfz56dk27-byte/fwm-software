// Funzione centralizzata per inviare una notifica a tutti gli utenti registrati
import { supabase } from './supabaseClient'

/**
 * Invia una notifica interna a tutti gli utenti registrati
 * @param {string} titolo - Titolo della notifica
 * @param {string} messaggio - Messaggio della notifica
 * @param {string} [url='/'] - URL di destinazione opzionale
 * @param {object} [data={}] - Payload extra opzionale
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export async function inviaNotificaCalendario(titolo, messaggio, url = '/', data = {}) {
  try {
    // Recupera tutti gli utenti registrati
    const { data: utenti, error: utentiError } = await supabase.from('utenti').select('username')
    if (utentiError) throw utentiError
    if (!utenti || utenti.length === 0) throw new Error('Nessun utente trovato')

    // Prepara le notifiche per tutti
    const notifiche = utenti.map(u => ({
      destinatario: u.username,
      titolo,
      messaggio,
      url,
      data,
      letta: false
    }))

    // Inserisce tutte le notifiche in una sola query
    const { error: insertError } = await supabase.from('notifiche_push').insert(notifiche)
    if (insertError) throw insertError
    return { success: true }
  } catch (error) {
    console.error('Errore invio notifica calendario:', error)
    return { success: false, error }
  }
}

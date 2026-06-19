// Attiva la sessione Supabase Auth usando email
// Da usare dopo login username/password

import { supabase } from './supabaseClient'

export async function activateSupabaseSessionWithEmail(email, password) {
  if (!email) {
    console.warn('[DEBUG LOGIN] Nessuna mail trovata per l’utente, sessione Supabase Auth non attivata')
    return null
  }
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      console.error('[DEBUG LOGIN] Errore Supabase Auth:', authError)
      return null
    } else {
      console.log('[DEBUG LOGIN] Sessione Supabase Auth attivata:', authData)
      return authData
    }
  } catch (err) {
    console.error('[DEBUG LOGIN] Errore attivazione sessione Supabase Auth:', err)
    return null
  }
}

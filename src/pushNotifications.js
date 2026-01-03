// Sistema di notifiche push intelligente
// Invia notifiche SOLO quando l'utente NON è sul sito

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '32bc9e36-a2ac-449c-a07c-70168b9b3e37'
const ONESIGNAL_REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY || 'os_v2_app_skpw6vu2gvff7eamjz36rapithmhbxuxj3oed2uosta3aqfgyr45gwu6jq4r4dwxh2o3ahtlndft7lz42mvqlqb6ek2nstrnpd5o7ba'

/**
 * TIPI DI NOTIFICHE SUPPORTATE
 */
export const NOTIFICATION_TYPES = {
  CLASSIFICA_AGGIORNATA: 'classifica_aggiornata',
  DISPONIBILITA_WEEKEND: 'disponibilita_weekend',
  CALENDARIO_ACCREDITI: 'calendario_accrediti',
  NUOVO_EVENTO: 'nuovo_evento',
  MODIFICA_PASS: 'modifica_pass'
}

/**
 * Invia una notifica push a tutti gli utenti
 * La notifica viene inviata SOLO se l'utente NON è sul sito (tab nascosto/chiuso)
 * 
 * @param {Object} options - Opzioni della notifica
 * @param {string} options.titolo - Titolo della notifica
 * @param {string} options.messaggio - Corpo del messaggio
 * @param {string} options.tipo - Tipo di notifica (da NOTIFICATION_TYPES)
 * @param {string} options.url - URL di destinazione al click (opzionale)
 * @param {Object} options.data - Dati aggiuntivi (opzionale)
 * @param {string[]} options.targetUsers - Array di username specifici (opzionale, invia a tutti se vuoto)
 * 
 * @returns {Promise<Object>} Risposta dell'API OneSignal
 */
export async function inviaNotificaPush(options) {
  const {
    titolo,
    messaggio,
    tipo,
    url = 'https://fwm-software.vercel.app',
    data = {},
    targetUsers = [] // Se vuoto, invia a tutti
  } = options

  try {
    console.log('📤 DEBUG PUSH: Inizio invio notifica')
    console.log('📤 DEBUG PUSH: document.hidden:', document.hidden)
    console.log('📤 DEBUG PUSH: targetUsers:', targetUsers)
    console.log('📤 DEBUG PUSH: titolo:', titolo)
    console.log('📤 DEBUG PUSH: messaggio:', messaggio)

    // IMPORTANTE: Verifica se l'utente è SUL SITO
    // Se la tab è visibile, NON inviare la notifica push
    if (!document.hidden) {
      console.log('✅ Utente sul sito - notifica push NON inviata (usa notifiche interne)')
      return { success: false, reason: 'user_on_site', useInternal: true }
    }

    console.log('📤 DEBUG PUSH: Utente non sul sito, procedo con invio push')
    console.log('📤 DEBUG PUSH: CONTROLLO UTENTE SUL SITO STESSO PANELLO')
    
    // AGGIUNTA: Se chi crea l'evento è già sul sito, non inviare push
    if (skipIfUserOnSite && document.hidden === false) {
      console.log('⚠️ Creatore evento già sul sito - non invio notifica push')
      return { success: false, reason: 'creator_on_site' }
    }
    
    console.log('📤 Invio notifica push:', { titolo, messaggio, tipo })

    const requestBody = {
      app_id: ONESIGNAL_APP_ID,
      headings: { it: titolo, en: titolo },
      contents: { it: messaggio, en: messaggio },
      url: url,
      data: {
        tipo: tipo,
        timestamp: new Date().toISOString(),
        ...data
      },
      // Icona e badge
      chrome_web_icon: '/press.png',
      firefox_icon: '/press.png',
      chrome_web_badge: '/press.png',
      // Suono
      ios_sound: 'default',
      android_sound: 'default',
      // Priorità
      priority: 10,
      // Web push options
      web_buttons: [
        {
          id: 'open',
          text: 'Apri',
          icon: '/press.png',
          url: url
        }
      ]
    }

    // Se targetUsers è specificato, invia solo a quegli utenti
    if (targetUsers.length > 0) {
      // Usa i tag per targetizzare utenti specifici
      requestBody.filters = targetUsers.map((username, index) => {
        const filter = { field: 'tag', key: 'username', relation: '=', value: username }
        // Aggiungi OR tra i filtri (tranne per l'ultimo)
        if (index < targetUsers.length - 1) {
          return [filter, { operator: 'OR' }]
        }
        return [filter]
      }).flat()
    } else {
      // Invia a tutti gli utenti iscritti
      requestBody.included_segments = ['All']
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${ONESIGNAL_REST_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    const result = await response.json()

    console.log('📤 DEBUG PUSH: Risposta OneSignal:', result)

    if (response.ok) {
      console.log('✅ Notifica push inviata con successo!', result)
      return { success: true, data: result }
    } else {
      console.error('❌ Errore invio notifica:', result)
      return { success: false, error: result }
    }
  } catch (error) {
    console.error('❌ Errore invio notifica push:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Invia notifica per aggiornamento classifica
 * @param {string} nomeClassifica - Nome della classifica aggiornata
 * @param {string} dettagli - Dettagli dell'aggiornamento (opzionale)
 * @param {string[]} targetUsers - Array di username specifici (opzionale)
 */
export async function notificaClassificaAggiornata(nomeClassifica, dettagli = '', targetUsers = []) {
  return await inviaNotificaPush({
    titolo: `🏁 ${nomeClassifica} aggiornata 📊`,
    messaggio: `La classifica ${nomeClassifica} è stata aggiornata${dettagli ? ': ' + dettagli : ''}`,
    tipo: NOTIFICATION_TYPES.CLASSIFICA_AGGIORNATA,
    targetUsers: targetUsers,
    data: {
      classifica: nomeClassifica,
      dettagli: dettagli
    }
  })
}

/**
 * Invia notifica per disponibilità weekend modificata
 * @param {string} nomeWeekend - Nome del weekend
 * @param {string} redattore - Nome del redattore che ha modificato la disponibilità
 * @param {string} nuovoStato - Nuovo stato (disponibile/non disponibile)
 */
export async function notificaDisponibilitaWeekend(nomeWeekend, redattore, nuovoStato) {
  const emoji = nuovoStato === 'disponibile' ? '✅' : '❌'
  
  return await inviaNotificaPush({
    titolo: `${emoji} Disponibilità Weekend Modificata`,
    messaggio: `${redattore} è ora ${nuovoStato} per ${nomeWeekend}`,
    tipo: NOTIFICATION_TYPES.DISPONIBILITA_WEEKEND,
    data: {
      weekend: nomeWeekend,
      redattore: redattore,
      stato: nuovoStato
    }
  })
}

/**
 * Invia notifica quando viene creato un nuovo weekend
 * @param {string} nomeWeekend - Nome del weekend creato
 */
export async function notificaNuovoWeekend(nomeWeekend) {
  return await inviaNotificaPush({
    titolo: '📅 È stato creato un nuovo weekend GP',
    messaggio: `Da adesso è possibile selezionare la propria disponibilità per ${nomeWeekend}`,
    tipo: NOTIFICATION_TYPES.NUOVO_EVENTO,
    data: {
      weekend: nomeWeekend,
      tipo: 'nuovo_weekend'
    }
  })
}

/**
 * Invia notifica quando qualcuno seleziona articoli
 * @param {string} username - Nome dell'utente che ha selezionato
 * @param {string} nomeWeekend - Nome del weekend
 * @param {number} numeroArticoli - Numero di articoli selezionati
 */
export async function notificaSelezioneArticoli(username, nomeWeekend, numeroArticoli) {
  return await inviaNotificaPush({
    titolo: '📝 Articoli selezionati',
    messaggio: `${username} ha selezionato ${numeroArticoli} articoli per il weekend ${nomeWeekend}`,
    tipo: NOTIFICATION_TYPES.MODIFICA_PASS,
    data: {
      username: username,
      weekend: nomeWeekend,
      articoli: numeroArticoli,
      tipo: 'selezione_articoli'
    }
  })
}

/**
 * Invia notifica quando gli articoli di un giorno finiscono
 * @param {string} nomeGiorno - Nome del giorno
 */
export async function notificaArticoliFiniti(nomeGiorno) {
  return await inviaNotificaPush({
    titolo: '🏁 Disponibilità completata',
    messaggio: `La disponibilità per ${nomeGiorno} è completa`,
    tipo: NOTIFICATION_TYPES.DISPONIBILITA_WEEKEND,
    data: {
      giorno: nomeGiorno,
      tipo: 'disponibilita_completa'
    }
  })
}

/**
 * Invia notifica per nuovo evento nel calendario accrediti
 * @param {string} nomeEvento - Nome dell'evento
 * @param {string} data - Data dell'evento
 * @param {string} circuito - Nome del circuito (opzionale)
 */
export async function notificaNuovoEvento(nomeEvento, data, circuito = '') {
  return await inviaNotificaPush({
    titolo: '� È stato creato un nuovo evento',
    messaggio: `È stato creato un nuovo evento ${nomeEvento} in data ${data}📆`,
    tipo: NOTIFICATION_TYPES.NUOVO_EVENTO,
    data: {
      evento: nomeEvento,
      data: data,
      circuito: circuito
    }
  })
}

/**
 * Invia notifica quando lo stato disponibilità si aggiorna a RICHIESTO
 * @param {string} nomeEvento - Nome dell'evento
 */
export async function notificaStatoRichiesto(nomeEvento) {
  return await inviaNotificaPush({
    titolo: '⏰ Stato accrediti aggiornato',
    messaggio: `Lo stato accrediti per ${nomeEvento} è stato aggiornato a RICHIESTO, prenota ora il tuo pass`,
    tipo: NOTIFICATION_TYPES.MODIFICA_PASS,
    data: {
      evento: nomeEvento,
      stato: 'RICHIESTO',
      tipo: 'stato_richiesto'
    }
  })
}

/**
 * Invia notifica quando lo stato disponibilità si aggiorna a CONFERMATO
 * @param {string} nomeEvento - Nome dell'evento
 */
export async function notificaStatoConfermato(nomeEvento) {
  return await inviaNotificaPush({
    titolo: '✅ Stato accrediti aggiornato',
    messaggio: `Lo stato accrediti per ${nomeEvento} è stato aggiornato a CONFERMATO, prenota ora il tuo pass`,
    tipo: NOTIFICATION_TYPES.MODIFICA_PASS,
    data: {
      evento: nomeEvento,
      stato: 'CONFERMATO',
      tipo: 'stato_confermato'
    }
  })
}

/**
 * Invia notifica quando qualcuno prenota il pass
 * @param {string} username - Nome dell'utente che ha prenotato
 * @param {string} nomeEvento - Nome dell'evento
 * @param {number} accreditiRimasti - Numero di accrediti rimasti
 */
export async function notificaPrenotazionePass(username, nomeEvento, accreditiRimasti) {
  return await inviaNotificaPush({
    titolo: '🎫 Pass prenotato',
    messaggio: `${username} ha prenotato un pass per l'evento ${nomeEvento}. Sono rimasti ancora ${accreditiRimasti} accrediti. È possibile!`,
    tipo: NOTIFICATION_TYPES.MODIFICA_PASS,
    data: {
      username: username,
      evento: nomeEvento,
      accrediti_rimasti: accreditiRimasti,
      tipo: 'prenotazione_pass'
    }
  })
}

/**
 * Invia notifica per modifica pass disponibili
 * @param {string} nomeEvento - Nome dell'evento
 * @param {number} passDisponibili - Numero di pass disponibili
 */
export async function notificaModificaPass(nomeEvento, passDisponibili) {
  return await inviaNotificaPush({
    titolo: '🎫 Pass Disponibili Modificati',
    messaggio: `${nomeEvento}: ${passDisponibili} pass disponibili`,
    tipo: NOTIFICATION_TYPES.MODIFICA_PASS,
    data: {
      evento: nomeEvento,
      pass_disponibili: passDisponibili
    }
  })
}

/**
 * Invia notifica personalizzata
 * @param {string} titolo - Titolo della notifica
 * @param {string} messaggio - Messaggio della notifica
 * @param {string[]} targetUsers - Array di username (opzionale)
 */
export async function notificaPersonalizzata(titolo, messaggio, targetUsers = []) {
  return await inviaNotificaPush({
    titolo: titolo,
    messaggio: messaggio,
    tipo: 'personalizzata',
    targetUsers: targetUsers
  })
}

/**
 * Verifica se l'utente è sul sito (tab visibile)
 * @returns {boolean} true se l'utente è sul sito
 */
export function isUserOnSite() {
  return !document.hidden
}

/**
 * Invia notifica a utenti specifici
 * @param {string[]} usernames - Array di username
 * @param {string} titolo - Titolo notifica
 * @param {string} messaggio - Messaggio notifica
 */
export async function notificaUtentiSpecifici(usernames, titolo, messaggio) {
  if (!usernames || usernames.length === 0) {
    console.warn('⚠️ Nessun username specificato')
    return { success: false, reason: 'no_users' }
  }

  return await inviaNotificaPush({
    titolo: titolo,
    messaggio: messaggio,
    tipo: 'notifica_diretta',
    targetUsers: usernames
  })
}

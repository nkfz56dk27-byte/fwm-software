/**
 * Invia notifica per creazione nuova classifica
 * @param {string} nomeClassifica - Nome della classifica creata
 */
export async function notificaClassificaCreata(nomeClassifica) {
  return await inviaNotificaPush({
    titolo: '🏁 Nuova classifica',
    messaggio: `La classifica "${nomeClassifica}" è stata creata.`,
    tipo: 'classifica_creata',
    data: {
      classifica: nomeClassifica
    }
  })
}
// Sistema di notifiche push intelligente
// Invia notifiche SOLO quando l'utente NON è sul sito
/**
 * Funzione di test: mostra una notifica locale (Notification API)
 * Usare da console: window.mostraNotificaLocale('Titolo', 'Messaggio')
 */
export function mostraNotificaLocale(titolo = '🏁 Nuova classifica', messaggio = 'La classifica di test è stata creata.') {
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      new Notification(titolo, {
        body: messaggio,
        icon: '/icona_notifiche.png',
        badge: '/icona_notifiche.png'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(titolo, {
            body: messaggio,
            icon: '/icona_notifiche.png',
            badge: '/icona_notifiche.png'
          });
        }
      });
    }
  } else {
    alert('Notification API non supportata dal browser.');
  }
}

/**
 * Funzione di test: invia una notifica di nuova classifica con titolo/emote aggiornato
 * Usare da console: window.testNotificaClassificaCreata('Nome di test')
 */
export async function testNotificaClassificaCreata(nomeClassifica = 'Test') {
  return await notificaClassificaCreata(nomeClassifica)
}

const ONESIGNAL_APP_ID = '32bc9e36-a2ac-449c-a07c-70168b9b3e37'
const ONESIGNAL_REST_API_KEY = 'os_v2_app_skpw6vu2gvff7eamjz36rapithmhbxuxj3oed2uosta3aqfgyr45gwu6jq4r4dwxh2o3ahtlndft7lz42mvqlqb6ek2nstrnpd5o7ba'

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

  // Invio sempre la notifica push tramite API Vercel

  try {
    // ...log invio notifica rimosso...

    // Invio tramite API Vercel
    const apiUrl =
      window.location.hostname === 'localhost'
        ? 'http://localhost:3000/api/send-notification'
        : '/api/send-notification';
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: titolo,
        body: messaggio,
        url,
        data: {
          tipo,
          timestamp: new Date().toISOString(),
          ...data
        }
      })
    });
    const result = await res.json();
    if (res.ok) {
      // ...log notifica inviata rimosso...
      return { success: true, data: result };
    } else {
      console.error('❌ Errore invio notifica:', result);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('❌ Errore invio notifica push:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Invia notifica per aggiornamento classifica
 * @param {string} nomeClassifica - Nome della classifica aggiornata
 * @param {string} dettagli - Dettagli dell'aggiornamento (opzionale)
 */
export async function notificaClassificaAggiornata(nomeClassifica, dettagli = '') {
  return await inviaNotificaPush({
    titolo: '🏁 Classifica Aggiornata',
    messaggio: `La classifica "${nomeClassifica}" è stata aggiornata${dettagli ? ': ' + dettagli : ''}.`,
    tipo: NOTIFICATION_TYPES.CLASSIFICA_AGGIORNATA,
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
 * Invia notifica per nuovo evento nel calendario accrediti
 * @param {string} nomeEvento - Nome dell'evento
 * @param {string} data - Data dell'evento
 * @param {string} circuito - Nome del circuito (opzionale)
 */
export async function notificaNuovoEvento(nomeEvento, data, circuito = '') {
  return await inviaNotificaPush({
    titolo: '📅 Nuovo Evento Aggiunto',
    messaggio: `${nomeEvento} - ${data}${circuito ? ' @ ' + circuito : ''}`,
    tipo: NOTIFICATION_TYPES.NUOVO_EVENTO,
    data: {
      evento: nomeEvento,
      data: data,
      circuito: circuito
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
    // ...log warning username rimosso...
    return { success: false, reason: 'no_users' }
  }

  return await inviaNotificaPush({
    titolo: titolo,
    messaggio: messaggio,
    tipo: 'notifica_diretta',
    targetUsers: usernames
  })
}
  // Espone la funzione di test nel window per uso da console
  if (typeof window !== 'undefined') {
    window.testNotificaClassificaCreata = testNotificaClassificaCreata;
      window.mostraNotificaLocale = mostraNotificaLocale;
  }

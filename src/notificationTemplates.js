// ATTENZIONE: Le notifiche PUSH e le notifiche INTERNE devono restare SEPARATE.
// Modifica non funzionale per forzare deploy Vercel (safe change)
// Commit di test per verifica webhook Vercel
// - Le notifiche interne vanno SOLO nelle tabelle interne (notifiche_disponibilita, notifiche_calendario, ecc.)
// - Le notifiche push NON devono MAI essere salvate nelle tabelle delle notifiche interne.
// - Se aggiungi nuove notifiche push, assicurati che non "inquinino" le tabelle delle notifiche interne.
// - Se aggiungi nuove notifiche interne, assicurati che non parta una push a meno che non sia richiesto esplicitamente.
/**
 * Invia la notifica di creazione weekend per una categoria (helper per centralizzare la logica)
 * @param {string} nomeWeekend
 * @param {string} categoriaId
 * @param {string} creatoreUsername
 * @param {function} inviaNotificaAUtente - funzione per inviare la notifica push
 * @param {Array} categorie - array delle categorie disponibili
 * @param {object} supabase - istanza supabase
 * @returns {Promise<void>}
 */
export async function notificaCreazioneWeekendCategoria(nomeWeekend, categoriaId, creatoreUsername, inviaNotificaAUtente, categorie, supabase) {
  const categoriaNome = categorie.find(c => c.id === categoriaId)?.nome || '';
  const { titolo, messaggio, tipo } = getCreazioneWeekendCategoriaNotification(nomeWeekend, categoriaNome, creatoreUsername);
  const { data: utenti, error } = await supabase
    .from('utenti')
    .select('username')
    .eq('categoria_id', categoriaId)
    .eq('attivo', true);
  if (error) {
    console.error('Errore recupero utenti categoria:', error);
    return;
  }
  if (!utenti || utenti.length === 0) return;
  for (const utente of utenti) {
    await inviaNotificaAUtente(utente.username, {
      titolo,
      messaggio,
      tipo,
      url: '/',
      data: { weekend: nomeWeekend, categoria: categoriaId }
    });
  }
}
/**
 * Genera il testo della notifica per creazione classifica
 * @param {string} nomeClassifica
 * @returns {Object} { titolo, messaggio, tipo }
 */
export function getClassificaCreataNotification(nomeClassifica) {
  return {
    titolo: '🏁 Nuova classifica',
    messaggio: `La classifica "${nomeClassifica}" è stata creata.`,
    tipo: 'classifica_creata'
  };
}

/**
 * Genera il testo della notifica per aggiornamento classifica
 * @param {string} nomeClassifica
 * @param {string} dettagli (opzionale)
 * @returns {Object} { titolo, messaggio, tipo }
 */
export function getClassificaAggiornataNotification(nomeClassifica, dettagli = '') {
  return {
    titolo: '🏁 Classifica Aggiornata',
    messaggio: `La classifica "${nomeClassifica}" è stata aggiornata${dettagli ? ': ' + dettagli : ''}.`,
    tipo: 'classifica_aggiornata'
  };
}
// src/notificationTemplates.js

/**
 * Genera il testo della notifica penalty points
 * @param {Object} params
 * @param {number} punti - Numero punti penalità
 * @param {string} pilotaId - ID pilota
 * @param {Array} piloti - Array piloti del campionato
 * @param {string} categoriaNome - Nome della categoria/campionato
 * @param {string} motivo - Motivo della penalità
 * @returns {Object} { titolo, messaggio, tipo }
 */
export function getPenaltyNotification({ punti, pilotaId, piloti, categoriaNome, motivo }) {
  let pilotaNome = 'Pilota sconosciuto';
  if (Array.isArray(piloti)) {
    const pilotaObj = piloti.find(p => String(p.id) === String(pilotaId));
    if (pilotaObj && pilotaObj.nome) pilotaNome = pilotaObj.nome;
  }
  if (punti === 1) {
    return {
      titolo: 'Nuova penalità',
      messaggio: `${categoriaNome} ${pilotaNome} ha ricevuto 1 punto penalità per: ${motivo}`,
      tipo: 'infrazione_minima'
    };
  } else if (punti >= 2) {
    return {
      titolo: 'Nuova penalità',
      messaggio: `${categoriaNome} ${pilotaNome} ha ricevuto ${punti} punti penalità per: ${motivo}`,
      tipo: 'infrazione'
    };
  }
  return null;
}

/**
 * Genera il testo della notifica per creazione weekend di una categoria
 * @param {string} nomeWeekend
 * @param {string} categoriaNome
 * @param {string} creatoreUsername
 * @returns {Object} { titolo, messaggio, tipo }
 */
export function getCreazioneWeekendCategoriaNotification(nomeWeekend, categoriaNome, creatoreUsername) {
    return {
      titolo: `Nuovo weekend (${categoriaNome}) aperto`,
      messaggio: `${creatoreUsername} ha aperto le prenotazioni per ${nomeWeekend} di ${categoriaNome}: prenota adesso i tuoi articoli`,
      tipo: 'creazione_weekend_categoria'
    };
}

/**
 * Genera il testo della notifica per selezione articoli in un weekend di una categoria
 * @param {string} nomeWeekend
 * @param {string} categoriaNome
 * @param {string} username
 * @param {number} quantiArticoli
 * @returns {Object} { titolo, messaggio, tipo }
 */

/**
 * Notifica per selezione di UN SOLO articolo
 * @param {string} nomeWeekend
 * @param {string} categoriaNome
 * @param {string} username
 * @returns {Object} { titolo, messaggio, tipo }
 */
export function getSelezioneArticoloSingoloWeekendCategoriaNotification(nomeWeekend, categoriaNome, username) {
  return {
    titolo: 'Prenotazione articoli',
    messaggio: `${username} ha selezionato 1 articolo per ${nomeWeekend} di ${categoriaNome}`,
    tipo: 'selezione_articolo_singolo_weekend_categoria'
  };
}

/**
 * Notifica per selezione di DUE O PIÙ articoli
 * @param {string} nomeWeekend
 * @param {string} categoriaNome
 * @param {string} username
 * @param {number} quantiArticoli
 * @returns {Object} { titolo, messaggio, tipo }
 */
export function getSelezioneArticoliMultipliWeekendCategoriaNotification(nomeWeekend, categoriaNome, username, quantiArticoli) {
  return {
    titolo: 'Prenotazione articoli',
    messaggio: `${username} ha selezionato ${quantiArticoli} articoli per ${nomeWeekend} di ${categoriaNome}`,
    tipo: 'selezione_articoli_multipli_weekend_categoria'
  };
}

// --- NOTIFICHE PUSH CALENDARIO ACCREDITI ---

/**
 * Notifica push: prenotazione pass
 * @param {string} username - Utente che ha prenotato
 * @param {string} titoloEvento - Titolo dell'evento
 * @returns {{titolo: string, messaggio: string, tipo: string}}
 */
export function getPrenotazionePassNotification(username, titoloEvento) {
  return {
    titolo: 'Nuova prenotazione pass',
    messaggio: `${username} ha prenotato un pass per l'evento: ${titoloEvento}`,
    tipo: 'prenotazione_pass'
  };
}

/**
 * Notifica push: annullamento prenotazione pass
 * @param {string} username - Utente che ha annullato
 * @param {string} titoloEvento - Titolo dell'evento
 * @returns {{titolo: string, messaggio: string, tipo: string}}
 */
export function getAnnullamentoPrenotazionePassNotification(username, titoloEvento) {
  return {
    titolo: 'Prenotazione pass annullata',
    messaggio: `${username} ha annullato la prenotazione del pass per l'evento: ${titoloEvento}`,
    tipo: 'annullamento_prenotazione_pass'
  };
}

/**
 * Notifica push: creazione evento gara
 * @param {string} titoloEvento
 * @param {string} dataEvento
 * @param {string} creatore
 * @param {string} campionatoNome
 * @returns {{titolo: string, messaggio: string, tipo: string}}
 */
export function getCalendarioGaraCreataNotification(titoloEvento, dataEvento, creatore, campionatoNome, accreditoAttivo) {
  return {
    titolo: `Nuova gara in calendario!`,
    messaggio: `${creatore} ha aggiunto la gara: ${titoloEvento} (${campionatoNome}) in data ${dataEvento}` +
      (accreditoAttivo ? ' — Accredito attivo' : '') +
      ': guarda i dettagli',
    tipo: 'calendario_gara_creata'
  };
}

/**
 * Notifica push: creazione evento generico
 */
export function getCalendarioEventoCreatoNotification(titoloEvento, dataEvento, creatore, statoAccredito) {
  return {
    titolo: `Nuovo evento in calendario!`,
    messaggio:
      `${creatore} ha creato l'evento: ${titoloEvento} in data ${dataEvento}` +
      (statoAccredito ? ` — Stato accredito: ${statoAccredito}` : '') +
      ': guarda i dettagli',
    tipo: 'calendario_evento_creato'
  };
}

/**
 * Notifica push: impostazione numero pass
 */
export function getCalendarioNumeroPassNotification(titoloEvento, dataEvento, maxPass, creatore) {
  return {
    titolo: `Numero pass aggiornato`,
    messaggio: `${creatore} ha impostato il numero massimo di pass a ${maxPass} per l'evento: ${titoloEvento} del ${dataEvento}`,
    tipo: 'calendario_numero_pass'
  };
}

/**
 * Notifica push: modifica evento
 */
export function getCalendarioEventoModificatoNotification(titoloEvento, dataEvento, modificatore) {
  return {
    titolo: `Evento modificato`,
    messaggio: `${modificatore} ha modificato l'evento: ${titoloEvento} del ${dataEvento}`,
    tipo: 'calendario_evento_modificato'
  };
}

/**
 * Notifica push: aggiunta nota ad evento
 */
export function getCalendarioNotaAggiuntaNotification(titoloEvento, dataEvento, autoreNota) {
  return {
    titolo: `Nuova nota evento`,
    messaggio: `${autoreNota} ha aggiunto una nota all'evento: ${titoloEvento} del ${dataEvento}`,
    tipo: 'calendario_nota_aggiunta'
  };
}

/**
 * Notifica push: accredito DOVREMMO RICHIEDERLO
 */
export function getCalendarioStatoAccreditoDovremmoNotification(titoloEvento, dataEvento, utente) {
  return {
    titolo: `Richiesta accredito suggerita`,
    messaggio: `${utente} ha consigliato di richiedere l'accredito per ${titoloEvento} del ${dataEvento}`,
    tipo: 'calendario_stato_accredito_dovremmo'
  };
}

/**
 * Notifica push: accredito RICHIESTO
 */
export function getCalendarioStatoAccreditoRichiestoNotification(titoloEvento, dataEvento, utente) {
  return {
    titolo: `Accredito richiesto`,
    messaggio: `L'accredito per l'evento ${titoloEvento} del ${dataEvento} è stato RICHIESTO`,
    tipo: 'calendario_stato_accredito_richiesto'
  };
}

/**
 * Notifica push: accredito CONFERMATO
 */
export function getCalendarioStatoAccreditoConfermatoNotification(titoloEvento, dataEvento, utente) {
  return {
    titolo: `Accredito accettato`,
    messaggio: `L'accredito per l'evento ${titoloEvento} del ${dataEvento} è stato ACCETTATO`,
    tipo: 'calendario_stato_accredito_confermato'
  };
}
// --- FINE NOTIFICHE PUSH CALENDARIO ACCREDITI ---

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
    titolo: `Nuovo weekend disponibilità (${categoriaNome}) aperto.`,
    messaggio: `${creatoreUsername} ha aperto le prenotazioni per ${nomeWeekend} di ${categoriaNome}: seleziona ora i tuoi articoli`,
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
    titolo: `Articolo selezionato per ${nomeWeekend} (${categoriaNome})`,
    messaggio: `${username} ha selezionato 1 articolo per il weekend di ${categoriaNome}`,
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
    titolo: `Articoli selezionati per ${nomeWeekend} (${categoriaNome})`,
    messaggio: `${username} ha selezionato ${quantiArticoli} articoli per il weekend di ${categoriaNome}`,
    tipo: 'selezione_articoli_multipli_weekend_categoria'
  };
}

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

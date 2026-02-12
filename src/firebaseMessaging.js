// Firebase Cloud Messaging - Gestione delle notifiche push
// Richiede permessi e gestisce i token FCM

import { messaging, getToken, onMessage } from './firebase'

/**
 * Richiede il permesso e ottiene il token FCM
 * @param {string} username
 * @returns {Promise<string|null>}
 */
export async function getFirebaseToken(username, user_uid = null) {
  console.log('[LOG] getFirebaseToken INIZIO', { username, user_uid, messaging, permission: Notification.permission });
  if (!messaging) {
    if (Notification.permission === 'denied') {
      console.warn('❌ Permesso notifiche rifiutato', { permission: Notification.permission });
      return null;
    }
      return;
    } else {
        titolo: payload.notification?.title || '🔔 Notifica',
        messaggio: payload.notification?.body || '',
    // File rimosso: la logica di Firebase Messaging per web push non è più utilizzata.
    // Tutte le notifiche web sono ora gestite da OneSignal.


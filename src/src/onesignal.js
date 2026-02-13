// OneSignal SDK Integration - Web Push Notifications
// Supporta: Desktop e Mobile push notifications

const ONESIGNAL_APP_ID =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ONESIGNAL_APP_ID)
    ? import.meta.env.VITE_ONESIGNAL_APP_ID
    : (typeof process !== 'undefined' && process.env && process.env.ONESIGNAL_APP_ID)
      ? process.env.ONESIGNAL_APP_ID
      : '32bc9e36-a2ac-449c-a07c-70168b9b3e37'; // App ID OneSignal

let oneSignalInitialized = false

/**
 * Inizializza OneSignal per le notifiche push
 * Resetta le impostazioni precedenti per evitare conflitti
 */
export async function initializeOneSignal() {
  if (window.location.hostname === 'localhost') {
    console.warn('[OneSignal] Inizializzazione bloccata su localhost');
    return false;
  }
    // Abilita log dettagliati OneSignal per debug mobile
    if (window.OneSignal && window.OneSignal.log && typeof window.OneSignal.log.setLevel === 'function') {
      window.OneSignal.log.setLevel('trace');
    }
  // Permetti l'inizializzazione anche su localhost per test
  if (oneSignalInitialized) {
    return true
  }

  try {
    // Carica SDK se non presente
    if (!window.OneSignal) {
      await loadOneSignalSDK()
    }

    // Attendi che OneSignal sia disponibile (max 2s)
    let tentativi = 0;
    while (!window.OneSignal && tentativi < 20) {
      await new Promise(r => setTimeout(r, 100));
      tentativi++;
    }
    if (!window.OneSignal) {
      throw new Error('OneSignal SDK non disponibile dopo il caricamento')
    }

    // Inizializza OneSignal - FORZA SEMPRE IL POPUP
    await window.OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      serviceWorkerPath: '/OneSignalSDKWorker.js',
      serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
      serviceWorkerParam: { scope: '/' },
      notifyButton: { enable: true },
      promptOptions: {
        slidedown: {
          enabled: true,
          autoPrompt: false, // Mostra il prompt solo su richiesta esplicita
          actionMessage: "Vuoi ricevere le nostre notifiche?",
          acceptButton: "Sì, grazie!",
          cancelButton: "No grazie"
        }
      }
    });

    // RIMOSSO: la visualizzazione automatica del popup OneSignal viene ora gestita solo dopo il login
    oneSignalInitialized = true
    return true
  } catch (error) {
    console.error('❌ Errore inizializzazione OneSignal:', error)
    return false
  }
}

/**
 * Carica lo script OneSignal dal CDN
 */
function loadOneSignalSDK() {
  return new Promise((resolve, reject) => {
    if (window.OneSignal) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.charset = 'utf-8'

    script.onload = () => {
      resolve()
    }

    script.onerror = () => {
      console.error('❌ Errore caricamento OneSignal SDK')
      reject(new Error('Errore caricamento OneSignal SDK'))
    }

    document.head.appendChild(script)
  })
}

/**
 * Richiede il permesso per le notifiche push
 * @returns {Promise<boolean>}
 */
export async function richiediPermessoNotifiche() {
  if (window.location.hostname === 'localhost') {
    console.warn('[OneSignal] Permesso notifiche bloccato su localhost');
    return false;
  }
  try {
    if (!oneSignalInitialized) {
      const success = await initializeOneSignal()
      if (!success) {
        return false
      }
    }

    // Usa l'API nativa del browser per richiedere i permessi
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        return true
      }

      if (Notification.permission === 'denied') {
        return false
      }

      // Richiedi il permesso
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        // Imposta il tag dell'utente in OneSignal per il tracking
        if (window.OneSignal) {
          try {
            await setUserTags({ notifiche_abilitate: 'true' })
          } catch (e) {
            console.error('Errore tag:', e)
          }
        }
        
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  } catch (error) {
    console.error('❌ Errore richiesta permesso:', error)
    return false
  }
}

/**
 * Imposta i tag personalizzati per l'utente
 * @param {Object} tags
 */
export async function setUserTags(tags) {
  try {
    if (!oneSignalInitialized || !window.OneSignal) {
      return false
    }

    await window.OneSignal.setTags(tags)
    return true
  } catch (error) {
    console.error('❌ Errore impostazione tag:', error)
    return false
  }
}

/**
 * Ottiene l'ID del dispositivo (Player ID)
 * @returns {Promise<string|null>}
 */
export async function getPlayerId() {
  try {
    if (!oneSignalInitialized || !window.OneSignal) {
      console.warn('[OneSignal] Non inizializzato!');
      return null;
    }

    let playerId = null;
    
    // METODO 1: User.PushSubscription.id (OneSignal SDK v16+)
    try {
      if (window.OneSignal.User && window.OneSignal.User.PushSubscription) {
        playerId = await window.OneSignal.User.PushSubscription.id;
        console.log('[OneSignal] METODO 1 - User.PushSubscription.id:', playerId);
      }
    } catch (e) {
      console.log('[OneSignal] METODO 1 fallito:', e.message);
    }
    
    // METODO 2: User.onesignalId (OneSignal SDK v16+)
    if (!playerId) {
      try {
        if (window.OneSignal.User && window.OneSignal.User.onesignalId) {
          playerId = await window.OneSignal.User.onesignalId;
          console.log('[OneSignal] METODO 2 - User.onesignalId:', playerId);
        }
      } catch (e) {
        console.log('[OneSignal] METODO 2 fallito:', e.message);
      }
    }
    
    // METODO 3: getSubscriptionId (vecchia API)
    if (!playerId && typeof window.OneSignal.getSubscriptionId === 'function') {
      playerId = await window.OneSignal.getSubscriptionId();
      console.log('[OneSignal] METODO 3 - getSubscriptionId:', playerId);
    }
    
    // METODO 4: getUserId (vecchia API)
    if (!playerId && typeof window.OneSignal.getUserId === 'function') {
      playerId = await window.OneSignal.getUserId();
      console.log('[OneSignal] METODO 4 - getUserId:', playerId);
    }

    // METODO 5: getSubscription (vecchia API)
    if (!playerId && typeof window.OneSignal.getSubscription === 'function') {
      try {
        const subscription = await window.OneSignal.getSubscription();
        console.log('[OneSignal] METODO 5 - getSubscription:', subscription);
        playerId = subscription?.id || null;
      } catch (e) {
        console.warn('[OneSignal] METODO 5 fallito:', e);
      }
    }

    if (playerId) {
      console.log('✅ [OneSignal] Player ID ottenuto:', playerId);
      return playerId;
    } else {
      console.warn('❌ [OneSignal] Player ID non disponibile dopo tutti i tentativi!');
      return null;
    }
  } catch (error) {
    console.error('❌ Errore recupero Player ID:', error);
    return null;
  }
}

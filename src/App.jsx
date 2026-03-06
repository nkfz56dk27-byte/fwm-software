import React, { useState, useEffect } from 'react';
import VersusModal from './VersusModal';

// ===== CALCOLA PUNTI POSIZIONE =====
function calcolaPuntiPosizione(pos, tipoGara, classifica = null) {
  // Se è attivo il modificatore libero, usa l'array personalizzato
  if (classifica && classifica.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti)) {
    const arr = classifica.modificatore_libero_punti
    return pos <= arr.length ? (arr[pos - 1] || 0) : 0
  }

  const puntiStandard = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
  const puntiSprint = [8, 7, 6, 5, 4, 3, 2, 1]
  const puntiF2Feature = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
  const puntiF2Sprint = [10, 8, 6, 5, 4, 3, 2, 1]
  
  if (tipoGara === 'sprint' || tipoGara === 'sprintRace') {
    return pos <= puntiSprint.length ? puntiSprint[pos - 1] : 0
  } else if (tipoGara === 'featureRace') {
    return pos <= puntiF2Feature.length ? puntiF2Feature[pos - 1] : 0
  } else if (tipoGara === 'f2sprint') {
    return pos <= puntiF2Sprint.length ? puntiF2Sprint[pos - 1] : 0
  }
  return pos <= puntiStandard.length ? puntiStandard[pos - 1] : 0
}
// ===== CALCOLA COMBINAZIONI VITTORIA =====
function calcolaCombinazioniVittoria(pilota, classifica, gpRimanenti, sprintRimanenti) {
  const combinazioni = []
  const pilotiOrdinati = (classifica.piloti || []).filter(p => p.attivo).sort((a, b) => (b.punti || 0) - (a.punti || 0))
  if (pilotiOrdinati.length < 2) return []

  const leader = pilotiOrdinati[0]
  const secondo = pilotiOrdinati[1]

  // Calcola punti massimi
  const puntiDaGP = gpRimanenti * 25
  const puntiDaSprint = sprintRimanenti * 8
  let bonusPossibili = 0
  if (classifica.punti_pole_attivo) bonusPossibili += gpRimanenti * (classifica.punti_pole_valore || 3)
  if (classifica.giro_veloce_attivo) bonusPossibili += gpRimanenti * (classifica.giro_veloce_valore || 1)
  const puntiMassimi = (pilota.punti || 0) + puntiDaGP + puntiDaSprint + bonusPossibili

  // Se fuori matematicamente
  if (puntiMassimi < (leader.punti || 0) && String(pilota.id) !== String(leader.id)) {
    return []
  }

  // Se già campione
  if (String(pilota.id) === String(leader.id) && (pilota.punti || 0) > (secondo.punti || 0) + puntiDaGP + puntiDaSprint + bonusPossibili) {
    combinazioni.push('🏆 Già campione matematico!')
    return combinazioni
  }

  // Trova rivale
  const rivale = String(pilota.id) === String(leader.id) ? secondo : leader
  const differenzaPunti = (rivale.punti || 0) - (pilota.punti || 0)
  const puntiPerPosizione = (classifica && classifica.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti) && classifica.modificatore_libero_punti.length > 0)
    ? classifica.modificatore_libero_punti
    : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

  // Combinazione 1: Vittorie consecutive
  if (gpRimanenti > 0) {
    const vittorieNecessarie = Math.max(1, Math.ceil(differenzaPunti / 25))
    if (vittorieNecessarie <= gpRimanenti) {
      combinazioni.push(`${pilota.nome} vince ${vittorieNecessarie} gare + ${rivale.nome} fuori dal podio`)
    }
  }

  // Combinazioni 2-10: Varie posizioni
  let contatore = 0
  for (let posPilota = 1; posPilota <= 5 && contatore < 9; posPilota++) {
    const puntiPilotaPerGara = puntiPerPosizione[posPilota - 1]

    for (let posRivale = Math.max(posPilota + 1, 1); posRivale <= 10 && contatore < 9; posRivale++) {
      const puntiRivalePerGara = posRivale <= puntiPerPosizione.length ? puntiPerPosizione[posRivale - 1] : 0
      const differenzaPerGara = puntiPilotaPerGara - puntiRivalePerGara

      if (differenzaPerGara > 0) {
        const gareNecessarie = Math.ceil(Math.abs(differenzaPunti) / differenzaPerGara)

        if (gareNecessarie > 0 && gareNecessarie <= gpRimanenti) {
          const posizione = `${posPilota}°`
          const posizioneRivale = posRivale > 10 ? 'fuori dai punti' : `${posRivale}° o peggio`

          combinazioni.push(`${pilota.nome} ${posizione} + ${rivale.nome} ${posizioneRivale} per ${gareNecessarie} gare`)
          contatore++
        }
      }
    }
  }

  // Scenario prossimo GP: usa il primo GP non completato (in ordine nell'array), robusto verso tipi diversi di flag
  if (gpRimanenti > 0 && Array.isArray(classifica.gp)) {
    const prossimoIndex = classifica.gp.findIndex(g => !Boolean(g.completato))
    const gpCompletatiCount = classifica.gp.filter(g => Boolean(g.completato)).length
    const nomeGP = prossimoIndex !== -1 ? classifica.gp[prossimoIndex].nome : `GP #${gpCompletatiCount + 1}`

    for (let posPilota = 1; posPilota <= 5; posPilota++) {
      const puntiPilota = puntiPerPosizione[posPilota - 1]

      for (let posRivale = posPilota + 1; posRivale <= 10; posRivale++) {
        const puntiRivale = posRivale <= puntiPerPosizione.length ? puntiPerPosizione[posRivale - 1] : 0
        const puntiDopoGara = (pilota.punti || 0) + puntiPilota
        const puntiRivaleDopoGara = (rivale.punti || 0) + puntiRivale

        const gareDopoQuesta = gpRimanenti - 1
        const puntiMassimiRivaleFinali = puntiRivaleDopoGara + (gareDopoQuesta * 25)

        if (puntiDopoGara > puntiMassimiRivaleFinali) {
          const posizione = `${posPilota}°`
          const posizioneRivale = posRivale > 10 ? 'fuori punti' : `${posRivale}° o peggio`

          combinazioni.unshift(`🏁 A ${nomeGP}: ${pilota.nome} ${posizione} + ${rivale.nome} ${posizioneRivale} = CAMPIONE!`)
          return combinazioni.slice(0, 10)
        }
      }
    }
  }

  return combinazioni.slice(0, 10)
}
import PannelloFonti from './PannelloFonti.jsx'
import GestioneRSSModal from './GestioneRSSModal.jsx'
import MonitorUrlModal from './MonitorUrlModal';
// ...existing code...
// Cancella IndexedDB OneSignal solo al primo avvio (controllo con localStorage)
// Cancellazione IndexedDB OneSignal solo se versione app cambia o mai fatta
let oneSignalReadyPromise = null;
const APP_VERSION = window?.APP_VERSION || '1.0.0';
if (typeof window !== 'undefined' && window.indexedDB) {
  const cleanedVersion = localStorage.getItem('onesignal_db_cleaned_version');
  if (cleanedVersion !== APP_VERSION) {
    oneSignalReadyPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.deleteDatabase('OneSignalSDKDB');
        req.onsuccess = function() {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[OneSignal] IndexedDB cancellato con successo');
          }
          localStorage.setItem('onesignal_db_cleaned_version', APP_VERSION);
          resolve();
        };
        req.onerror = function(e) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[OneSignal] Errore cancellazione IndexedDB:', e);
          }
          localStorage.setItem('onesignal_db_cleaned_version', APP_VERSION);
          resolve(); // Prosegui comunque
        };
        req.onblocked = function() {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[OneSignal] Cancellazione IndexedDB bloccata');
          }
          localStorage.setItem('onesignal_db_cleaned_version', APP_VERSION);
          resolve(); // Prosegui comunque
        };
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[OneSignal] Errore generale cancellazione IndexedDB:', e);
        }
        localStorage.setItem('onesignal_db_cleaned_version', APP_VERSION);
        resolve();
      }
    });
  } else {
    oneSignalReadyPromise = Promise.resolve();
  }
} else {
  oneSignalReadyPromise = Promise.resolve();
}
import { supabase } from './supabaseClient'
import CoppaSVG from "./assets/coppa.svg"
import StatistichePNG from "./assets/Statistiche.png"
import PenaltypointSVG from "./assets/Penalitypoint.svg"
import FotoSVG from "./assets/foto.svg"
import DisponibilitàSVG from "./assets/disponibilità.svg"
import PressPNG from "./assets/press.png"
import CestinoSVG from "./assets/cestino.svg"
import CheckSVG from "./assets/check.svg"
import VidaPNG from "./assets/vida.png"
import InformazioniPNG from "./assets/inormazioni.png"
import RitaglioImmagine from './RitaglioImmagine'
import VidaMenu from './VidaMenu'
import CalendarioAccrediti from './CalendarioAccrediti'
import DisponibilitaWeekend from './DisponibilitaWeekend.jsx'
import GestioneCategorie from './GestioneCategorie.jsx'
import GestioneTemplateArticoli from './GestioneTemplateArticoli.jsx'
import ProssimoEvento from './ProssimoEvento.jsx'
import EventiMobileMenu from './EventiMobileMenu.jsx'
import GuidaFunzioni from './GuidaFunzioni.jsx'
import OrdinaTabellaClassifica from './OrdinaTabellaClassifica.jsx'
import { notificaClassificaAggiornata } from './src/pushNotifications.js'

import { initializeOneSignal } from './src/onesignal.js'
import NotificationPrompt from './NotificationPrompt.jsx'
import { ascolaNotificheRealtime } from './pushNotificationService'
import { sendPushNotification } from './pushNotificationService'
import GestioneDispositiviNotifiche from './GestioneDispositiviNotifiche.jsx'
import { ToastNotification } from './ToastNotification.jsx'
// import { getFirebaseToken, setupForegroundMessaging } from './firebaseMessaging'

import './App.css'

function App() {
    // DEBUG: Bottone per forzare il popup OneSignal se non appare
    const showDebugOneSignalButton = process.env.NODE_ENV !== 'production' || window.location.hostname.includes('localhost');

    // Inizializza OneSignal solo dopo la cancellazione di IndexedDB
    useEffect(() => {
      oneSignalReadyPromise.then(() => {
        if (typeof initializeOneSignal === 'function') {
          initializeOneSignal();
        }
      });
    }, []);

    // Bottone per abilitare notifiche dopo login
    async function abilitaNotifichePush() {
      if (window.OneSignal && typeof window.OneSignal.showSlidedownPrompt === 'function') {
        window.OneSignal.showSlidedownPrompt();
        // Listener per accettazione OneSignal
        window.OneSignal.on && window.OneSignal.on('subscriptionChange', async function(isSubscribed) {
          if (isSubscribed) {
            // Mostra prompt nativo solo dopo accettazione OneSignal
            if ('Notification' in window && Notification.permission === 'default') {
              try {
                const perm = await Notification.requestPermission();
                if (perm === 'granted' && user && user.username) {
                  import('./pushNotificationService').then(({ registraDispositivoNotifiche }) => {
                    registraDispositivoNotifiche(user.username);
                  });
                }
              } catch (e) {
                console.error('Errore richiesta permesso nativo:', e);
              }
            } else if (Notification.permission === 'granted' && user && user.username) {
              import('./pushNotificationService').then(({ registraDispositivoNotifiche }) => {
                registraDispositivoNotifiche(user.username);
              });
            }
          }
        });
      }
    }
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [showGestione, setShowGestione] = useState(false)
  const [showDispositiviNotifiche, setShowDispositiviNotifiche] = useState(false)
  const [showClassificheMainMenu, setShowClassificheMainMenu] = useState(false)
  const [showClassificheMenu, setShowClassificheMenu] = useState(false)
  const [showClassifica, setShowClassifica] = useState(false)
  const [classificaId, setClassificaId] = useState(null)
  const [showNuovaPagina, setShowNuovaPagina] = useState(false)
  const [showOrdinaTabellaClassifica, setShowOrdinaTabellaClassifica] = useState(false)
  const [showPannelloFonti, setShowPannelloFonti] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showRitaglioImmagine, setShowRitaglioImmagine] = useState(false)
  const [showCalendario, setShowCalendario] = useState(false)
  const [showDisponibilita, setShowDisponibilita] = useState(null) // null o { categoria }
  const [notificheNonLetteCalendario, setNotificheNonLetteCalendario] = useState(0)
  const [notificheNonLetteDisponibilita, setNotificheNonLetteDisponibilita] = useState(0)
  const [showVidaMenu, setShowVidaMenu] = useState(false) // NUOVO STATO PER MENU VIDA
  const [showEventiMobile, setShowEventiMobile] = useState(false) // NUOVO STATO PER MENU EVENTI MOBILE
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false) // Stato per mostrare il prompt notifiche
  const [notificheUnsubscribe, setNotificheUnsubscribe] = useState(null) // Funzione per stoppare l'ascolto notifiche
  const [toastNotification, setToastNotification] = useState(null) // Toast fallback per notifiche
  const [showNuovaSchermata, setShowNuovaSchermata] = useState(false) // Stato per la nuova schermata
  
  // Detect mobile
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768
      setIsMobile(mobile)
      console.log('📱 isMobile aggiornato:', mobile, 'width:', window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    console.log('📱 isMobile iniziale:', isMobile, 'width:', window.innerWidth)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Effect per ascoltare le notifiche realtime quando l'utente è loggato
  useEffect(() => {
    if (!user) {
      // Se l'utente si disconnette, stoppa l'ascolto
      if (notificheUnsubscribe) {
        notificheUnsubscribe()
        setNotificheUnsubscribe(null)
      }
      return
    }

    // Avvia l'ascolto delle notifiche realtime
    console.log('🎧 Avvio ascolto notifiche realtime per:', user.username)
    const unsubscribe = ascolaNotificheRealtime(user.username, (notifica) => {
      console.log('🔔 Notifica ricevuta in App.jsx:', notifica)
      // Mostra il toast fallback in-app
      setToastNotification(notifica)
    })

    setNotificheUnsubscribe(() => unsubscribe)
    // RIMOSSO: Ascolto notifiche push in foreground (FCM) - ora gestite solo da OneSignal

    // Cleanup: stoppa l'ascolto quando il componente si smonta
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user])

  async function caricaNotificheCalendario(username) {
    try {
      console.log('🔍 DEBUG HOME: Inizio caricaNotificheCalendario')
      console.log('🔍 DEBUG HOME: username:', username)
      
      const { data: notifiche } = await supabase.from('notifiche_calendario').select('*').order('created_at', { ascending: false }).limit(50)
      console.log('🔍 DEBUG HOME: notifiche totali caricate:', notifiche?.length || 0)
      
      const { data: lette } = await supabase.from('notifiche_lette').select('notifica_id').eq('username', username)
      console.log('🔍 DEBUG HOME: notifiche lette caricate:', lette?.length || 0)
      
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      console.log('🔍 DEBUG HOME: IDs lette:', Array.from(idsLette))
      
      const nonLette = (notifiche || []).filter(n => !idsLette.has(n.id))
      console.log('🔍 DEBUG HOME: notifiche non lette calcolate:', nonLette.length)
      
      setNotificheNonLetteCalendario(nonLette.length)
      console.log('✅ DEBUG HOME: caricaNotificheCalendario completato')
    } catch (e) {
      console.error('❌ Errore caricaNotificheCalendario (HOME):', e)
    }
  }

  async function caricaNotificheDisponibilita(username) {
    try {
      console.log('🔍 DEBUG HOME: Inizio caricaNotificheDisponibilita')
      console.log('🔍 DEBUG HOME: username:', username)
      console.log('🔍 DEBUG HOME: isAdmin:', user?.ruolo === 'admin')
      
      const isAdmin = user?.ruolo === 'admin'
      
      // 1. Carica tutte le notifiche (con limite e ordinamento come Disponibilità)
      const { data: tutteNotifiche } = await supabase
        .from('notifiche_disponibilita')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      console.log('🔍 DEBUG HOME: notifiche totali caricate:', tutteNotifiche?.length || 0)
      
      let notificheFiltrate = tutteNotifiche || []
      
      // 2. Se NON admin: filtra per categorie
      if (!isAdmin) {
        console.log('🔍 DEBUG HOME: Filtro per categorie utente')
        // Carica categorie utente
        const { data: gruppiUtente } = await supabase
          .from('gruppi_redattori')
          .select('categoria_id')
          .eq('username', username)
        
        const categorieIds = (gruppiUtente || []).map(g => g.categoria_id).filter(Boolean)
        console.log('🔍 DEBUG HOME: categorieIds:', categorieIds)
        
        // Carica weekend di quelle categorie
        let queryWeekend = supabase.from('weekend').select('id')
        
        if (categorieIds.length > 0) {
          queryWeekend = queryWeekend.or(`categoria_id.in.(${categorieIds.join(',')}),categoria_id.is.null`)
        } else {
          queryWeekend = queryWeekend.is('categoria_id', null)
        }
        
        const { data: weekendConsentiti } = await queryWeekend
        const weekendIdsConsentiti = new Set((weekendConsentiti || []).map(w => w.id))
        console.log('🔍 DEBUG HOME: weekendIdsConsentiti:', Array.from(weekendIdsConsentiti))
        
        // Filtra notifiche
        notificheFiltrate = notificheFiltrate.filter(n => 
          !n.weekend_id || weekendIdsConsentiti.has(n.weekend_id)
        )
        console.log('🔍 DEBUG HOME: notifiche dopo filtro categorie:', notificheFiltrate.length)
      }
      
      // 3. Conta notifiche NON lette
      const { data: lette } = await supabase
        .from('notifiche_disponibilita_lette')
        .select('notifica_id')
        .eq('username', username)
      
      console.log('🔍 DEBUG HOME: notifiche lette caricate:', lette?.length || 0)
      
      const idsLette = new Set((lette || []).map(l => l.notifica_id))
      console.log('🔍 DEBUG HOME: IDs lette:', Array.from(idsLette))
      
      const nonLette = notificheFiltrate.filter(n => !idsLette.has(n.id))
      console.log('🔍 DEBUG HOME: notifiche non lette calcolate:', nonLette.length)
      
      setNotificheNonLetteDisponibilita(nonLette.length)
      console.log('✅ DEBUG HOME: caricaNotificheDisponibilita completato')
    } catch (e) {
      console.error('[HOME] Errore caricamento notifiche disponibilità:', e)
    }
  }

  useEffect(() => {
    if (user && user.username) {
      // Caricamento iniziale
      caricaNotificheCalendario(user.username)
      caricaNotificheDisponibilita(user.username)
      // Registra dispositivo e player_id OneSignal su push_devices
      // Forza la registrazione del dispositivo mobile e player_id OneSignal subito dopo login

      // --- REGISTRAZIONE PLAYER_ID ONESIGNAL CON POLLING ---
      let playerIdPollingInterval = null;
      let playerIdRegistrato = false;
      import('./pushNotificationService').then(async ({ registraDispositivoNotifiche, getDeviceId }) => {
        const tryRegister = async () => {
          // Attendi che OneSignal sia pronto (max 10s)
          let ready = false;
          for (let i = 0; i < 20; i++) {
            if (window.OneSignal && (window.OneSignal.User || window.OneSignal.getUserId || window.OneSignal.getSubscriptionId)) {
              ready = true;
              break;
            }
            await new Promise(res => setTimeout(res, 500));
          }
          if (!ready) {
            //alert('❌ OneSignal non inizializzato dopo il login!');
            return;
          }
          // Recupera playerId OneSignal
          let playerId = null;
          try {
            if (window.OneSignal && window.OneSignal.User && window.OneSignal.User.PushSubscription) {
              playerId = await window.OneSignal.User.PushSubscription.id;
            }
            if (!playerId && window.OneSignal && window.OneSignal.User && window.OneSignal.User.onesignalId) {
              playerId = await window.OneSignal.User.onesignalId;
            }
            if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscriptionId === 'function') {
              playerId = await window.OneSignal.getSubscriptionId();
            }
            if (!playerId && window.OneSignal && typeof window.OneSignal.getUserId === 'function') {
              playerId = await window.OneSignal.getUserId();
            }
            if (!playerId && window.OneSignal && typeof window.OneSignal.getSubscription === 'function') {
              const subscription = await window.OneSignal.getSubscription();
              playerId = subscription?.id || null;
            }
          } catch (e) {
            // Silenzia errori qui
          }
          const deviceId = getDeviceId();
          // Controlla su Supabase se esiste già la riga
          if (playerId) {
            let existing = null;
            let checkError = null;
            try {
              const res = await supabase
                .from('push_devices')
                .select('id')
                .eq('username', user.username)
                .eq('device_id', deviceId)
                .eq('player_id', playerId)
                .limit(1);
              existing = res.data;
              checkError = res.error;
            } catch (err) {
              checkError = err;
            }
            if (checkError) {
              console.warn('[DEBUG LOGIN] Errore query push_devices:', checkError, { username: user.username, deviceId, playerId });
              // Se errore 400, non tentare la registrazione
              if (checkError.status === 400) {
                playerIdRegistrato = true;
                clearInterval(playerIdPollingInterval);
                return;
              }
            }
            if (existing && existing.length > 0) {
              // Già registrato, non fare nulla
              playerIdRegistrato = true;
              clearInterval(playerIdPollingInterval);
              return;
            }
          }
          // Se non esiste, procedi con la registrazione
          const esito = await registraDispositivoNotifiche(user.username);
          if (esito) {
            playerIdRegistrato = true;
            clearInterval(playerIdPollingInterval);
            //console.log('✅ [POLLING] player_id OneSignal registrato con successo!');
          } else {
            //console.log('⏳ [POLLING] player_id OneSignal non ancora disponibile, riprovo...');
          }
        };
        // Primo tentativo subito
        tryRegister();
        // Polling ogni 30 secondi finché non registrato
        playerIdPollingInterval = setInterval(() => {
          if (!playerIdRegistrato) tryRegister();
        }, 30000);
      });

      // Polling notifiche ogni 30 secondi (come prima)
      const interval = setInterval(() => {
        caricaNotificheCalendario(user.username)
        caricaNotificheDisponibilita(user.username)
      }, 30000)
      
      // AGGIUNTA: Ascolta eventi custom da Calendario/Disponibilità
      const handleNotificheAggiornate = (event) => {
        console.log('🔄 HOME: Ricevuto evento notificheAggiornate', event.detail)
        // Forza ricaricamento immediato delle notifiche
        caricaNotificheCalendario(user.username)
        caricaNotificheDisponibilita(user.username)
      }
      
      window.addEventListener('notificheAggiornate', handleNotificheAggiornate)
      
      // REALTIME SUBSCRIPTION per notifiche disponibilità
      const channelDisponibilita = supabase
        .channel('home_notifiche_disponibilita')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifiche_disponibilita'
        }, (payload) => {
          console.log('[HOME] Notifica disponibilità ricevuta in realtime:', payload)
          caricaNotificheDisponibilita(user.username)
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'notifiche_disponibilita_lette'
        }, (payload) => {
          console.log('[HOME] Notifica letta in realtime:', payload)
          caricaNotificheDisponibilita(user.username)
        })
        .subscribe()
      
      console.log('[HOME] Subscription realtime notifiche attivata')
      
      return () => {
        clearInterval(interval)
        supabase.removeChannel(channelDisponibilita)
        window.removeEventListener('notificheAggiornate', handleNotificheAggiornate)
        console.log('[HOME] Subscription realtime notifiche rimossa')
      }
    }
  }, [user])

 const handleLogin = async (e) => {
  e.preventDefault()
  setLoading(true)
  setLoginError('')
  console.log('[DEBUG LOGIN] Inizio handleLogin')
  try {
    console.log('[DEBUG LOGIN] Chiamata supabase.from utenti', { username, password })
    const { data, error } = await supabase.from('utenti').select('*').eq('username', username).eq('password', password).limit(1)
    console.log('[DEBUG LOGIN] Risultato query utenti:', { data, error })
    if (error || !data || data.length === 0) {
      setLoginError('Username o password non corretti')
      setLoading(false)
      console.log('[DEBUG LOGIN] Login fallito: credenziali errate')
      return
    }
    const user = data[0];
    
    // *** LOGIN SUPABASE AUTH PER SALVARE TOKEN FCM ***
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      })
      
      if (authError) {
        console.warn('[DEBUG LOGIN] Errore login Supabase Auth:', authError)
        const { error: signUpError } = await supabase.auth.signUp({
          email: user.email,
          password: password
        })
        if (signUpError) {
          console.error('[DEBUG LOGIN] Errore signup Supabase Auth:', signUpError)
        } else {
          console.log('[DEBUG LOGIN] Utente creato su Supabase Auth')
        }
      } else {
        console.log('[DEBUG LOGIN] Login Supabase Auth riuscito')
      }
    } catch (authErr) {
      console.error('[DEBUG LOGIN] Errore Supabase Auth:', authErr)
    }
    
    setUser(user)
    setMustChangePassword(user.deve_cambiare_password)
    console.log('[DEBUG LOGIN] Login riuscito, user:', user)
    sessionStorage.setItem('username', username)
    sessionStorage.setItem('user', JSON.stringify(user))
    console.log('[DEBUG LOGIN] Username e user salvati in sessionStorage')
    // RIMOSSO: Inizializzazione Firebase Messaging per notifiche web
    
    // Inizializza OneSignal con polling intelligente
    // Rimosso: la registrazione OneSignal viene gestita solo all'avvio
    
    // Inizializza notifiche native
    console.log('[DEBUG LOGIN] Inizializzando notifiche native per iOS/Android...')
    const { initializeNativeNotifications, setupNotificationMessageListener } = await import('./nativeNotificationHandler')
    await initializeNativeNotifications(username)
    setupNotificationMessageListener((event) => {
      console.log('[DEBUG LOGIN] Notifica cliccata - Navigazione:', event.url)
    })
    
    const { getDeviceId } = await import('./pushNotificationService')
    const deviceId = getDeviceId()
    console.log('[DEBUG LOGIN] DeviceId:', deviceId)
    const { data: dispositivo } = await supabase
      .from('push_devices')
      .select('device_id')
      .eq('username', username)
      .eq('device_id', deviceId)
      .limit(1)
    console.log('[DEBUG LOGIN] Query push_devices:', dispositivo)
    
    if (!dispositivo || dispositivo.length === 0) {
      setShowNotificationPrompt(true)
      console.log('[DEBUG LOGIN] Prompt notifiche push mostrato')
    }
    setLoading(false)
    console.log('[DEBUG LOGIN] Fine handleLogin')
  } catch (err) {
    console.error('[DEBUG LOGIN] Errore durante il login:', err)
    setLoginError('Errore di connessione')
    setLoading(false)
  }
}

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('La password deve essere di almeno 8 caratteri')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono')
      return
    }
    try {
      const { error } = await supabase.from('utenti').update({ password: newPassword, deve_cambiare_password: false }).eq('id', user.id)
      if (error) throw error
      setUser({ ...user, deve_cambiare_password: false })
      setMustChangePassword(false)
    } catch (err) {
      setPasswordError('Errore nel cambio password')
    }
  }

  const handleLogout = () => {
    setUser(null)
    setMustChangePassword(false)
    setUsername('')
    setPassword('')
    setShowGestione(false)
    setShowClassifica(false)
  }

  if (!user) {
    return <LoginView username={username} setUsername={setUsername} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} loginError={loginError} loading={loading} handleLogin={handleLogin} />
  }

  if (mustChangePassword) {
    return <PasswordChangeView newPassword={newPassword} setNewPassword={setNewPassword} confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword} showNewPassword={showNewPassword} setShowNewPassword={setShowNewPassword} showConfirmPassword={showConfirmPassword} setShowConfirmPassword={setShowConfirmPassword} passwordError={passwordError} handlePasswordChange={handlePasswordChange} />
  }

  // ...existing code...
    if (showGestione) {
      // Porta il titolo molto più in alto su mobile (350px)
      return <GestioneUtentiView 
        onClose={() => setShowGestione(false)} 
        onOpenDispositiviNotifiche={() => setShowDispositiviNotifiche(true)} 
        currentUser={user}
        isMobile={isMobile} 
        titoloMarginTop={isMobile ? 350 : 0} 
      />
    }
    // ...existing code...

  if (showDispositiviNotifiche) {
    return <GestioneDispositiviNotifiche username={user.username} onClose={() => setShowDispositiviNotifiche(false)} />
  }

  if (showClassificheMainMenu) {
    return <ClassificheMainMenuView user={user} isMobile={isMobile} onBack={() => { setShowClassificheMainMenu(false); setShowClassificheMenu(false) }} onOpenClassificheMenu={() => { setShowClassificheMainMenu(false); setShowClassificheMenu(true) }} onOpenNuovaPagina={() => { setShowClassificheMainMenu(false); setShowNuovaPagina(true) }} onOpenOrdinaTabellaClassifica={() => { setShowClassificheMainMenu(false); setShowOrdinaTabellaClassifica(true) }} />
  }

  if (showClassificheMenu) {
    return <ClassificheMenuView user={user} isMobile={isMobile} onBack={() => { setShowClassificheMenu(false); setShowClassificheMainMenu(true) }} onOpenClassifica={(id) => { setClassificaId(id); setShowClassifica(true); setShowClassificheMenu(false) }} />
  }


  if (showPannelloFonti) {
    return <PannelloFonti onClose={() => setShowPannelloFonti(false)} />
  }
  if (showNuovaPagina) {
    return <NuovaPaginaView onClose={() => { setShowNuovaPagina(false); setShowClassificheMainMenu(true); }} isMobile={isMobile} />
  }

  if (showOrdinaTabellaClassifica) {
    return <OrdinaTabellaClassifica user={user} onClose={() => { setShowOrdinaTabellaClassifica(false); setShowClassificheMainMenu(true); }} />
  }

  if (showClassifica) {
    return <ClassificaView classificaId={classificaId} user={user} isMobile={isMobile} onBack={() => { setShowClassifica(false); setShowClassificheMenu(true); setClassificaId(null) }} />
  }

  // ← AGGIUNTO: Render condizionale RitaglioImmagine
  if (showRitaglioImmagine) {
    return <RitaglioImmagine user={user} onClose={() => setShowRitaglioImmagine(false)} />
  }

  // ← AGGIUNTO: Render condizionale Vida Menu
  if (showVidaMenu) {
    return <VidaMenu onClose={() => setShowVidaMenu(false)} />
  }

  // ← AGGIUNTO: Render condizionale Eventi Mobile
  if (showEventiMobile) {
    return <EventiMobileMenu onClose={() => setShowEventiMobile(false)} />
  }

  if (showCalendario) {
    return <CalendarioAccrediti utenteCorrente={user} onClose={() => setShowCalendario(false)} onNotificheChange={() => user && user.username && caricaNotificheCalendario(user.username)} />
  }

  if (showDisponibilita) {
    return <DisponibilitaWeekend categoria={showDisponibilita.categoria} utenteCorrente={user} onClose={() => setShowDisponibilita(null)} onNotificheChange={() => user && user.username && caricaNotificheDisponibilita(user.username)} />
  }

  if (showNuovaSchermata) {
    return <GuidaFunzioni user={user} onClose={() => setShowNuovaSchermata(false)} />
  }

  const handleSendNotification = async () => {
    await sendPushNotification({
      title: 'Test Notifica',
      body: 'Questa è una notifica inviata da OneSignal tramite API backend!',
      url: '/',
      data: { tipo: 'test' }
    });
    alert('Notifica inviata!');
  };

  return (
    <>
      {/* Bottone visibile solo dopo login e se non già granted */}
      {/* Bottone abilitazione notifiche push rimosso su richiesta */}
      {showDebugOneSignalButton && isMobile && (typeof Notification === 'undefined' || Notification.permission === 'default') && (
          <button
            className="btn-login btn-green"
          onClick={async () => {
            if (window.OneSignal && typeof window.OneSignal.showSlidedownPrompt === 'function') {
              window.OneSignal.showSlidedownPrompt();
              alert('Richiesta popup OneSignal forzata!');
            } else {
              alert('OneSignal non è pronto o il metodo non è disponibile.');
            }
          }}
        >
          <img src="/icona_notifiche.png" alt="notifiche" style={{height:'54px',width:'54px',objectFit:'contain',marginRight:'12px'}} />
          <span style={{whiteSpace: 'nowrap', fontWeight: 'bold'}}>Attiva notifiche push</span>
        </button>
      )}
      <HomeView
        user={user}
        isMobile={isMobile}
        onLogout={handleLogout}
        onOpenGestione={() => setShowGestione(true)}
        onOpenDispositiviNotifiche={() => setShowDispositiviNotifiche(true)}
        onOpenClassificheMainMenu={() => setShowClassificheMainMenu(true)}
        onOpenRitaglio={() => setShowRitaglioImmagine(true)}
        onOpenCalendario={() => setShowCalendario(true)}
        onOpenDisponibilita={(categoria) => setShowDisponibilita({ categoria })}
        onOpenVidaMenu={() => setShowVidaMenu(true)}
        onOpenEventiMobile={() => setShowEventiMobile(true)}
        notificheNonLetteCalendario={notificheNonLetteCalendario}
        notificheNonLetteDisponibilita={notificheNonLetteDisponibilita}
        onOpenPannelloFonti={() => setShowPannelloFonti(true)}
        onOpenNuovaSchermata={() => setShowNuovaSchermata(true)}
      />
      {/* Floating button per attivare notifiche ora gestito in Home.jsx, non qui */}
      {/* Disabilitato: NotificationPrompt non più necessario, si usa solo OneSignal */}
      {/* {showNotificationPrompt && <NotificationPrompt username={user.username} onClose={() => setShowNotificationPrompt(false)} />} */}
      {toastNotification && <ToastNotification notification={toastNotification} onClose={() => setToastNotification(null)} />}
      {/* End disabled notification */}
    </>
  )
}
// ===== CLASSIFICA VIEW COMPLETA =====
function ClassificaView({ classificaId, user, isMobile, onBack }) {
  const [classifica, setClassifica] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSetup, setShowSetup] = useState(false)
  const [showImpostazioni, setShowImpostazioni] = useState(false)
  const [showInserimentoGP, setShowInserimentoGP] = useState(false)
  const [showGrafico, setShowGrafico] = useState(false)
  const [gpSelezionato, setGpSelezionato] = useState(null)
  const [expandedGP, setExpandedGP] = useState({})

  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    caricaClassifica()
  }, [classificaId])

  useEffect(() => {
    if (classifica) {
      document.title = `FWM - ${classifica.nome}`
    }
  }, [classifica])

  const caricaClassifica = async () => {
    try {
      console.log('📖 Caricando classificazione con ID:', classificaId)
      // Prima cerca nella tabella standard
      let { data, error } = await supabase.from('classifiche').select('*').eq('id', classificaId)
      console.log('📖 Dati ricevuti dal database:', data)
      console.log('📖 Errore:', error)
      
      if (!error && data && data.length > 0) {
        const classifica = data[0]
        console.log('📖 Classificazione caricata:', classifica.nome)
        console.log('📖 Piloti array:', classifica.piloti)
        console.log('📖 Piloti length:', classifica.piloti?.length)
        console.log('📖 GP array:', classifica.gp)
        console.log('📖 GP length:', classifica.gp?.length)
        
        setClassifica(classifica)
        if (!classifica.piloti || classifica.piloti.length === 0) {
          console.warn('⚠️ Piloti vuoti o mancanti, mostro setup')
          setShowSetup(true)
        } else {
          console.log('✅ Classificazione completa, nascondo setup')
          setShowSetup(false)
        }
        setLoading(false)
        return
      }
      // Se non trovata, cerca nella tabella custom
      let customRes = await supabase.from('classifiche_custom').select('*').eq('id', classificaId)
      if (!customRes.error && customRes.data && customRes.data.length > 0) {
        const classifica = customRes.data[0]
        console.log('📖 Classificazione custom caricata:', classifica.nome)
        console.log('📖 Piloti array:', classifica.piloti)
        console.log('📖 Piloti length:', classifica.piloti?.length)
        
        setClassifica(classifica)
        if (!classifica.piloti || classifica.piloti.length === 0) {
          console.warn('⚠️ Piloti vuoti o mancanti, mostro setup')
          setShowSetup(true)
        } else {
          console.log('✅ Classificazione completa, nascondo setup')
          setShowSetup(false)
        }
        setLoading(false)
        return
      }
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const salvaClassifica = async (nuovaClassifica) => {
    try {
      const updateObj = {
        nome: nuovaClassifica.nome,
        gp: nuovaClassifica.gp || [],
        piloti: nuovaClassifica.piloti || [],
        costruttori: nuovaClassifica.costruttori || [],
        numero_gp_stagione: nuovaClassifica.numero_gp_stagione || nuovaClassifica.numeroGP || null,
        numero_sprint_stagione: nuovaClassifica.numero_sprint_stagione || nuovaClassifica.numeroSprint || null,
      }

      console.log('💾 Salvando classificazione:', updateObj)
      
      // Determina la tabella corretta: controlla prima se esiste in classifiche_custom
      let targetTable = 'classifiche'
      const { data: customCheck } = await supabase.from('classifiche_custom').select('id').eq('id', classificaId)
      if (customCheck && customCheck.length > 0) {
        targetTable = 'classifiche_custom'
        console.log('📝 Salvataggio su tabella custom')
      } else {
        console.log('📝 Salvataggio su tabella standard')
      }
      
      const { error } = await supabase.from(targetTable).update(updateObj).eq('id', classificaId)
      if (!error) {
        console.log('✅ Classificazione salvata con successo su', targetTable)
        // Aggiorna lo stato locale con i dati salvati
        setClassifica(nuovaClassifica)
        setShowSetup(false)
        
        // Verifica che i dati siano stati salvati leggendoli dal db
        console.log('🔍 Verificando salvataggio dal database...')
        const { data: verifyData, error: verifyError } = await supabase
          .from(targetTable)
          .select('piloti, gp')
          .eq('id', classificaId)
        
        if (verifyError) {
          console.error('❌ Errore verifica salvataggio:', verifyError)
        } else if (verifyData && verifyData.length > 0) {
          console.log('✅ Dati verificati nel database - Piloti:', verifyData[0].piloti?.length, 'GP:', verifyData[0].gp?.length)
        }
      } else {
        console.error('Errore salvataggio classifica:', error)
        alert('❌ Errore durante il salvataggio della classifica')
      }
    } catch (err) {
      console.error('Errore salvataggio classifica:', err)
      alert('❌ Errore durante il salvataggio della classifica')
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Caricamento...</div>
  if (!classifica) return <div style={{ padding: '40px', textAlign: 'center' }}>Classifica non trovata</div>
  if (showSetup) return <SetupIniziale classifica={classifica} onSave={salvaClassifica} onBack={onBack} />
  if (showImpostazioni) return <ImpostazioniClassifica classifica={classifica} onClose={() => { setShowImpostazioni(false); caricaClassifica() }} onSave={salvaClassifica} />
  if (showInserimentoGP) return <InserimentoRisultatiGP 
    classifica={classifica} 
    gpPreselezionato={gpSelezionato} 
    onClose={() => { setShowInserimentoGP(false); setGpSelezionato(null) }} 
    onSave={(nuovaClassifica) => {
      setShowInserimentoGP(false);
      setGpSelezionato(null);
      setClassifica(nuovaClassifica);
    }} 
  />
  if (showGrafico) return <GraficoPronostico classifica={classifica} isMobile={isMobile} onClose={() => setShowGrafico(false)} />

  const pilotiOrdinati = classifica.piloti ? [...classifica.piloti].filter(p => p.attivo).sort((a, b) => b.punti - a.punti) : []
  const costruttoriOrdinati = classifica.costruttori ? [...classifica.costruttori].sort((a, b) => b.punti - a.punti) : []
  const gpCompletati = classifica.gp
    ? classifica.gp.filter(g => g.completato).sort((a, b) => a.id - b.id)
    : []
  const gpDaCompletare = classifica.gp ? classifica.gp.filter(g => !g.completato) : []

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#f5f5f7', padding: isMobile ? '10px' : '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '15px', marginBottom: '20px', padding: isMobile ? '15px' : '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', position: 'relative' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', minHeight: isMobile ? '44px' : 'auto', padding: isMobile ? '8px 0' : '0' }}>
            ← Indietro
          </button>
          <h1 style={{ fontSize: isMobile ? '22px' : '34px', fontWeight: 'bold', margin: 0, flex: 1, textAlign: isMobile ? 'left' : 'center', order: isMobile ? -1 : 0 }}>{classifica.nome}</h1>
          <div style={{ display: 'flex', gap: '10px', alignSelf: isMobile ? 'flex-end' : 'auto', alignItems: 'center' }}>
            {isAdmin && (
              <button onClick={() => setShowImpostazioni(true)}
                style={{
                  width: isMobile ? '44px' : '40px',
                  height: isMobile ? '44px' : '40px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  boxShadow: 'none',
                  borderWidth: 0,
                  borderColor: 'transparent',
                  borderStyle: 'none',
                  marginBottom: 0,
                }}
              >
                <svg viewBox="0 0 24 24" fill="#000" style={{ width: isMobile ? '28px' : '30px', height: isMobile ? '28px' : '30px' }}>
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
                </svg>
              </button>
            )}
            <div style={{ position: 'relative' }}>
              <button onClick={(e) => { const menu = e.currentTarget.nextSibling; menu.style.display = menu.style.display === 'block' ? 'none' : 'block' }} style={{ width: isMobile ? '44px' : '40px', height: isMobile ? '44px' : '40px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" fill="#34C759" style={{ width: isMobile ? '38px' : '38px', height: isMobile ? '38px' : '38px' }}>
                  <circle cx="12" cy="12" r="10" fill="#34C759"/>
                  <path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              <div style={{ display: 'none', position: 'absolute', top: '100%', right: 0, background: 'white', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: isMobile ? '200px' : '250px', zIndex: 1000, marginTop: '10px' }}>
                {gpDaCompletare.length === 0 ? (
                  <div style={{ padding: '15px', color: '#999' }}>Nessun GP da completare</div>
                ) : (
                  gpDaCompletare.map(gp => (
                    <div key={gp.id} onClick={() => { setGpSelezionato(gp); setShowInserimentoGP(true) }} style={{ padding: isMobile ? '12px 15px' : '15px', cursor: 'pointer', borderBottom: '1px solid #eee', minHeight: isMobile ? '44px' : 'auto' }}>
                      {gp.tipo_weekend === 'sprintF1' ? '⚡️' : gp.tipo_weekend === 'f2' ? '🏎️' : '🏆'} {gp.nome}
                    </div>
                  ))
                )}
                {isAdmin && (
                  <>
                    <div style={{ borderTop: '2px solid #eee' }}></div>
                    <div onClick={() => { setGpSelezionato(null); setShowInserimentoGP(true) }} style={{ padding: isMobile ? '12px 15px' : '15px', cursor: 'pointer', color: '#007AFF', fontWeight: 'bold', minHeight: isMobile ? '44px' : 'auto' }}>+ Aggiungi nuovo GP</div>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setShowGrafico(true)} style={{ width: isMobile ? '44px' : '40px', height: isMobile ? '44px' : '40px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="#000" style={{ width: isMobile ? '28px' : '30px', height: isMobile ? '28px' : '30px' }}>
                <path d="M3 3v18h18M7 14l4-4 4 4 6-6"/>
              </svg>
            </button>
          </div>
        </div>

       {/* GP COMPLETATI */}
{gpCompletati.length > 0 && (
  <div style={{ marginBottom: '20px' }}>
    <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '15px' }}>GP già inseriti</h2>

    {gpCompletati.map(gp => (
      <div
        key={gp.id}
        style={{
          background: 'white',
          borderRadius: '10px',
          marginBottom: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header GP cliccabile */}
        <div
          onClick={() => setExpandedGP(prev => ({ ...prev, [gp.id]: !prev[gp.id] }))}
          style={{
            padding: '15px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontWeight: '600', fontSize: '16px' }}>
            {gp.tipo_weekend === 'sprintF1' ? '⚡️' : gp.tipo_weekend === 'f2' ? '🏎️' : '🏆'} {gp.nome}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setGpSelezionato(gp)
                setShowInserimentoGP(true)
              }}
              style={{
                background: '#FF3B30',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '5px 8px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              }}
              title="Modifica risultati"
            >
              MODIFICA
            </button>
            <span>{expandedGP[gp.id] ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Contenuto gare espandibile */}
        {expandedGP[gp.id] &&
          gp.gare &&
          gp.gare
            .filter(g => g.completata)
            .map(gara => (
              <div
                key={gara.id}
                style={{
                  padding: '15px',
                  borderTop: gp.tipo_weekend === 'sprintF1' ? '1px solid #eee' : 'none', // solo Sprint
                  background: gp.tipo_weekend === 'sprintF1' ? '#f9f9f9' : 'white',       // solo Sprint
                }}
              >
                {/* Risultati piloti ordinati */}
                {Object.entries(gara.risultati || {})
                  .map(([pilotaId, info]) => {
                    let posizione = null;
                    let flag = null;
                    if (typeof info === 'object' && info !== null) {
                      posizione = 'posizione' in info ? Number(info.posizione) : null;
                      flag = 'flag' in info ? info.flag : null;
                    } else {
                      posizione = Number(info);
                    }
                    return { pilotaId, posizione, flag };
                  })
                  .filter(({ posizione, flag }) => posizione !== null || flag)
                  .sort((a, b) => {
                    if (a.posizione !== null && b.posizione !== null) return a.posizione - b.posizione;
                    if (a.posizione !== null) return -1;
                    if (b.posizione !== null) return 1;
                    return String(a.flag).localeCompare(String(b.flag));
                  })
                  .map(({ pilotaId, posizione, flag }) => {
                    const pilota = classifica.piloti.find(p => String(p.id) === String(pilotaId));
                    if (!pilota) return null;
                    let desc = '';
                    if (flag) {
                      desc = String(flag).toUpperCase();
                    } else if (posizione !== null) {
                      desc = `${posizione}°`;
                    }
                    // Calcola punti gara
                    let puntiPos = 0;
                    let puntiPole = 0;
                    let puntiGiroVeloce = 0;
                    if (!flag && posizione !== null) {
                      puntiPos = calcolaPuntiPosizione(posizione, gara.tipo_gara, classifica);
                    }
                    const isPole = classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId);
                    const isGiroVeloce = classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId);
                    if (isPole) puntiPole = classifica.punti_pole_valore || 3;
                    if (isGiroVeloce) puntiGiroVeloce = classifica.giro_veloce_valore || 1;
                    const puntiTot = puntiPos + puntiPole + puntiGiroVeloce;
                    // Dettaglio punti
                    let dettaglio = '';
                    if (puntiTot > 0) {
                      dettaglio = `+${puntiTot} (`;
                      if (puntiPos > 0) dettaglio += puntiPos;
                      if (puntiPole > 0) dettaglio += (puntiPos > 0 ? '+' : '') + puntiPole + 'P';
                      if (puntiGiroVeloce > 0) dettaglio += ((puntiPos > 0 || puntiPole > 0) ? '+' : '') + puntiGiroVeloce + 'FL';
                      dettaglio += ')';
                    }
                    return (
                      <div
                        key={pilotaId}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}
                      >
                        <span>
                          {desc} {pilota.nome}
                          {isPole && (
                            <span title="Pole Position" style={{
                              display: 'inline-block',
                              background: 'linear-gradient(90deg, #34c759 0%, #28a745 100%)',
                              color: 'white',
                              borderRadius: '8px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              padding: '2px 7px',
                              marginLeft: 6,
                              verticalAlign: 'middle',
                              letterSpacing: '1px',
                              boxShadow: '0 1px 3px rgba(52,199,89,0.15)'
                            }}>POLE</span>
                          )}
                          {isGiroVeloce && (
                            <span title="Giro Veloce" style={{
                              display: 'inline-block',
                              background: 'linear-gradient(90deg, #a259ff 0%, #6e27c5 100%)',
                              color: 'white',
                              borderRadius: '8px',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              padding: '2px 7px',
                              marginLeft: 6,
                              verticalAlign: 'middle',
                              letterSpacing: '1px',
                              boxShadow: '0 1px 3px rgba(162,89,255,0.15)'
                            }}>FL</span>
                          )}
                        </span>
                        <span style={{ fontWeight: 'bold', color: '#333', minWidth: 32, textAlign: 'right' }}>{dettaglio}</span>
                      </div>
                    );
                  })}
              </div>
            ))}
      </div>
    ))}
  </div>
)}

        {/* CLASSIFICA PILOTI */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '15px' }}>Classifica Piloti</h2>
          <div style={{ background: 'white', borderRadius: '10px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {pilotiOrdinati.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Nessun pilota inserito</div>
            ) : (
              pilotiOrdinati.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: i < pilotiOrdinati.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', minWidth: '30px' }}>{i + 1}</div>
                  <div style={{ width: '8px', height: '40px', background: p.colore || '#007AFF', borderRadius: '4px' }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{p.nome}</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>{p.team}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{p.punti || 0}</div>
                    {i > 0 && <div style={{ fontSize: '14px', color: '#999' }}>+{pilotiOrdinati[0].punti - p.punti}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CLASSIFICA COSTRUTTORI */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '15px' }}>Classifica Costruttori</h2>
          <div style={{ background: 'white', borderRadius: '10px', padding: '15px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {costruttoriOrdinati.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>Nessun costruttore inserito</div>
            ) : (
              costruttoriOrdinati.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: i < costruttoriOrdinati.length - 1 ? '1px solid #eee' : 'none' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', minWidth: '30px' }}>{i + 1}</div>
                  <div style={{ width: '8px', height: '40px', background: c.colore || '#007AFF', borderRadius: '4px' }}></div>
                  <div style={{ flex: 1, fontWeight: '600', fontSize: '16px' }}>{c.nome}</div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{c.punti || 0}</div>
                    {i > 0 && <div style={{ fontSize: '14px', color: '#999' }}>+{costruttoriOrdinati[0].punti - c.punti}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== INSERIMENTO RISULTATI GP =====
function InserimentoRisultatiGP({ classifica, gpPreselezionato, onClose, onSave }) {
            const [showGaraAccorciata, setShowGaraAccorciata] = useState(false);
          const [giroVeloceId, setGiroVeloceId] = useState(null);
        const [poleId, setPoleId] = useState(null);
      const [risultati, setRisultati] = useState({});
    // Trova posizioni duplicate
    const posizioniValide = Object.values(risultati).filter(v => v && !isNaN(Number(v)));
    const posizioniDuplicate = posizioniValide.filter((val, idx, arr) => arr.indexOf(val) !== idx);
  const isDoppione = (val) => val && !isNaN(Number(val)) && posizioniValide.filter(v => v === val).length > 1;

  const [searchTerm, setSearchTerm] = useState('');
  const [pilotaSelezionato, setPilotaSelezionato] = useState(null);
  const [step, setStep] = useState(gpPreselezionato ? 1 : 0)
  const [nomeGP, setNomeGP] = useState(gpPreselezionato ? gpPreselezionato.nome : '')
  const [tipoWeekend, setTipoWeekend] = useState(gpPreselezionato ? gpPreselezionato.tipo_weekend : 'standard')
  const [gp, setGp] = useState(gpPreselezionato ? {
    ...gpPreselezionato,
    gare: gpPreselezionato.gare && gpPreselezionato.gare.length > 0 ? gpPreselezionato.gare : 
          gpPreselezionato.tipo_weekend === 'standard' ? [{ id: Date.now(), tipo_gara: 'principale', risultati: {}, completata: false }] :
          gpPreselezionato.tipo_weekend === 'sprintF1' ? [{ id: Date.now(), tipo_gara: 'sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'principale', risultati: {}, completata: false }] :
          [{ id: Date.now(), tipo_gara: 'f2sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'featureRace', risultati: {}, completata: false }]
  } : null)
  const [garaCorrente, setGaraCorrente] = useState(0)
  // Funzione per mappare i risultati salvati nel formato adatto agli input
  function mapRisultatiInput(ris) {
    if (!ris) return {};
    const out = {};
    Object.entries(ris).forEach(([pilotaId, val]) => {
      if (val && typeof val === 'object') {
        if ('posizione' in val) out[pilotaId] = val.posizione;
        if ('flag' in val) out[`${pilotaId}_flag`] = val.flag;
      } else {
        out[pilotaId] = val;
      }
    });
    return out;
  }
// RIMOSSI BLOCCHI JSX ERRATI FUORI DAL RETURN

  useEffect(() => {
    if (gpPreselezionato && gp && gp.gare && gp.gare[garaCorrente]) {
      const garaAttuale = gp.gare[garaCorrente];
      setRisultati(mapRisultatiInput(garaAttuale.risultati));
      setPoleId(garaAttuale.pole_id || null);
      setGiroVeloceId(garaAttuale.giro_veloce_id || null);
    }
  }, [gpPreselezionato, garaCorrente, gp]);

  const aggiungiGP = () => {
    if (!nomeGP) return
    const nuovoGP = {
      id: Date.now(),
      nome: nomeGP,
      tipo_weekend: tipoWeekend,
      completato: false,
      gare: tipoWeekend === 'standard' ? [{ id: Date.now(), tipo_gara: 'principale', risultati: {}, completata: false }] : 
             tipoWeekend === 'sprintF1' ? [{ id: Date.now(), tipo_gara: 'sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'principale', risultati: {}, completata: false }] :
             [{ id: Date.now(), tipo_gara: 'f2sprint', risultati: {}, completata: false }, { id: Date.now() + 1, tipo_gara: 'featureRace', risultati: {}, completata: false }]
    }
    setGp(nuovoGP)
    setStep(1)
  }

  const salvaRisultatiGara = () => {
    const gare = [...gp.gare]
    // Prepara risultati con flag DNS/DNF/DSQ
    const risultatiConFlag = {};
    Object.keys(risultati).forEach(key => {
      if (key.endsWith('_flag')) return;
      const pilotaId = key;
      const flag = risultati[`${pilotaId}_flag`] || '';
      if (flag) {
        risultatiConFlag[pilotaId] = { flag };
      } else if (risultati[pilotaId]) {
        risultatiConFlag[pilotaId] = { posizione: risultati[pilotaId] };
      }
    });
    gare[garaCorrente] = {
      ...gare[garaCorrente],
      risultati: risultatiConFlag,
      pole_id: poleId,
      giro_veloce_id: giroVeloceId,
      completata: true
    }
    
    const gpAggiornato = { ...gp, gare }
    
    if (garaCorrente < gp.gare.length - 1) {
      setGp(gpAggiornato)
      setGaraCorrente(garaCorrente + 1)
      setRisultati({})
      setPoleId(null)
      setGiroVeloceId(null)
    } else {
      const gpFinale = { ...gpAggiornato, completato: true };
      // Sostituisci il GP modificato nella lista (nessun duplicato)
      let nuoviGP = Array.isArray(classifica.gp) ? [...classifica.gp] : [];
      const idx = nuoviGP.findIndex(g => g.id === gpFinale.id);
      if (idx >= 0) {
        nuoviGP[idx] = gpFinale;
      } else {
        nuoviGP.push(gpFinale);
      }

      // Azzera i punti prima del ricalcolo
      const nuoviPiloti = classifica.piloti.map(p => ({ ...p, punti: 0 }));
      const nuoviCostruttori = classifica.costruttori.map(c => ({ ...c, punti: 0 }));

      nuoviGP.forEach(gpItem => {
        gpItem.gare.forEach(gara => {
          Object.entries(gara.risultati || {}).forEach(([pilotaId, info]) => {
            const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId));
            if (!pilota) return;
            if (info.flag === 'DNS' || info.flag === 'DSQ' || info.flag === 'DNF') return;
            const pos = info.posizione;
            let punti = calcolaPuntiPosizione(pos, gara.tipo_gara, classifica);
            if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) {
              punti += classifica.punti_pole_valore || 3;
            }
            if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) {
              punti += classifica.giro_veloce_valore || 1;
            }
            pilota.punti = (pilota.punti || 0) + punti;
            const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team);
            if (costruttore) {
              costruttore.punti = (costruttore.punti || 0) + punti;
            }
          });
        });
      });

      nuoviPiloti.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((p, i) => {
        p.distacco = i === 0 ? 0 : (nuoviPiloti[0].punti || 0) - (p.punti || 0);
      });
      nuoviCostruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((c, i) => {
        c.distacco = i === 0 ? 0 : (nuoviCostruttori[0].punti || 0) - (c.punti || 0);
      });
      onSave({ ...classifica, gp: nuoviGP, piloti: nuoviPiloti, costruttori: nuoviCostruttori });
      onClose();
    }
  }

  const garaNoNDispudata = () => {
    const gare = [...gp.gare]
    gare[garaCorrente] = {
      ...gare[garaCorrente],
      risultati: {},  // Nessun risultato
      pole_id: null,
      giro_veloce_id: null,
      completata: true,
      non_disputata: true  // Flag per marcare come non disputata
    }
    
    const gpAggiornato = { ...gp, gare }
    
    if (garaCorrente < gp.gare.length - 1) {
      setGp(gpAggiornato)
      setGaraCorrente(garaCorrente + 1)
      setRisultati({})
      setPoleId(null)
      setGiroVeloceId(null)
    } else {
      const gpFinale = { ...gpAggiornato, completato: true }
      const nuoviGP = classifica.gp ? [...classifica.gp.filter(g => g.id !== gpFinale.id), gpFinale] : [gpFinale]
      
      const nuoviPiloti = [...classifica.piloti]
      const nuoviCostruttori = [...classifica.costruttori]
      
      // Non assegna alcun punto poiché la gara non è stata disputata
      
      console.log('Gara non disputata - Nessun punto assegnato')
      
      onSave({ ...classifica, gp: nuoviGP, piloti: nuoviPiloti, costruttori: nuoviCostruttori })
      onClose()
    }
  }

  const calcolaPuntiAccorciati = (pos, percentuale) => {
    // Secondo regole FIA
    if (percentuale === 25) {
      // TOP 5: 6-4-3-2-1
      const punti = [6, 4, 3, 2, 1]
      return pos <= punti.length ? punti[pos - 1] : 0
    } else if (percentuale === 50) {
      // TOP 9: 13-10-8-6-5-4-3-2-1
      const punti = [13, 10, 8, 6, 5, 4, 3, 2, 1]
      return pos <= punti.length ? punti[pos - 1] : 0
    } else if (percentuale === 75) {
      // TOP 10: 19-14-12-10-8-6-4-3-2-1
      const punti = [19, 14, 12, 10, 8, 6, 4, 3, 2, 1]
      return pos <= punti.length ? punti[pos - 1] : 0
    }
    return 0
  }

  const garaAccorciata = () => {
    const gare = [...gp.gare]
    gare[garaCorrente] = {
      ...gare[garaCorrente],
      risultati,
      pole_id: poleId,
      giro_veloce_id: giroVeloceId,
      completata: true,
      accorciata: true,
      percentuale_accorciata: percentualeAccorciata
    }
    
    const gpAggiornato = { ...gp, gare }
    let gpFinale = null
    
    if (garaCorrente < gp.gare.length - 1) {
      setGp(gpAggiornato)
      setGaraCorrente(garaCorrente + 1)
      setRisultati({})
      setPoleId(null)
      setGiroVeloceId(null)
      setShowGaraAccorciata(false)
    } else {
      gpFinale = { ...gpAggiornato, completato: true }
      const nuoviGP = classifica.gp ? [...classifica.gp.filter(g => g.id !== gpFinale.id), gpFinale] : [gpFinale]
      
      const nuoviPiloti = [...classifica.piloti]
      const nuoviCostruttori = [...classifica.costruttori]
      
      // Se è una MODIFICA, sottrai i punti vecchi
      if (gpPreselezionato && gpPreselezionato.completato) {
        console.log('MODIFICA: Sottraggo punti vecchi...')
        gpPreselezionato.gare.forEach(garaVecchia => {
          if (!garaVecchia.completata || garaVecchia.non_disputata) return
          
          Object.entries(garaVecchia.risultati || {}).forEach(([pilotaId, pos]) => {
            const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
            if (!pilota) return
            
            let punti
            if (garaVecchia.accorciata) {
              punti = calcolaPuntiAccorciati(pos, garaVecchia.percentuale_accorciata)
            } else {
              punti = calcolaPuntiPosizione(pos, garaVecchia.tipo_gara, classifica)
            }
            
            if (classifica.punti_pole_attivo && String(garaVecchia.pole_id) === String(pilotaId)) {
              punti += classifica.punti_pole_valore || 3
            }
            if (classifica.giro_veloce_attivo && String(garaVecchia.giro_veloce_id) === String(pilotaId)) {
              punti += classifica.giro_veloce_valore || 1
            }
            
            console.log(`${pilota.nome}: -${punti} pts (rimozione risultato vecchio)`)
            pilota.punti = Math.max(0, (pilota.punti || 0) - punti)
            
            const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
            if (costruttore) {
              costruttore.punti = Math.max(0, (costruttore.punti || 0) - punti)
            }
          })
        })
      }
      
      // Calcola e assegna punti NUOVI per ogni gara del GP
      gpFinale.gare.forEach(gara => {
        Object.entries(gara.risultati).forEach(([pilotaId, pos]) => {
          const pilota = nuoviPiloti.find(p => String(p.id) === String(pilotaId))
          if (!pilota) {
            console.warn('Pilota non trovato:', pilotaId)
            return
          }
          
          let punti
          if (gara.accorciata) {
            punti = calcolaPuntiAccorciati(pos, gara.percentuale_accorciata)
          } else {
            punti = calcolaPuntiPosizione(pos, gara.tipo_gara, classifica)
          }
          
          if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) {
            punti += classifica.punti_pole_valore || 3
          }
          if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) {
            punti += classifica.giro_veloce_valore || 1
          }
          
          console.log(`${pilota.nome}: +${punti} pts (gara accorciata ${gara.percentuale_accorciata}%)`)
          
          pilota.punti = (pilota.punti || 0) + punti
          
          const costruttore = nuoviCostruttori.find(c => c.nome === pilota.team)
          if (costruttore) {
            costruttore.punti = (costruttore.punti || 0) + punti
          } else {
            console.warn('Costruttore non trovato:', pilota.team)
          }
        })
      })
      
      nuoviPiloti.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((p, i) => {
        p.distacco = i === 0 ? 0 : (nuoviPiloti[0].punti || 0) - (p.punti || 0)
      })
      
      nuoviCostruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)).forEach((c, i) => {
        c.distacco = i === 0 ? 0 : (nuoviCostruttori[0].punti || 0) - (c.punti || 0)
      })
      
      console.log('Salvando classifica aggiornata (gara accorciata):', { piloti: nuoviPiloti, costruttori: nuoviCostruttori })
      
      onSave({ ...classifica, gp: nuoviGP, piloti: nuoviPiloti, costruttori: nuoviCostruttori })
      onClose()
    }
  }

  if (step === 0) {
    return (
      <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Indietro</button>
        <h1 style={{ fontSize: '28px', marginBottom: '30px', textAlign: 'center' }}>Aggiungi nuovo GP</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome GP</label>
          <input type="text" value={nomeGP} onChange={(e) => setNomeGP(e.target.value)} placeholder="es. Bahrain" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Tipo Weekend</label>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button onClick={() => setTipoWeekend('standard')} style={{ padding: '15px', background: tipoWeekend === 'standard' ? '#007AFF' : 'white', color: tipoWeekend === 'standard' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>🏆 Weekend Standard</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Solo gara principale (25-18-15...)</div>
            </button>
            <button onClick={() => setTipoWeekend('sprintF1')} style={{ padding: '15px', background: tipoWeekend === 'sprintF1' ? '#007AFF' : 'white', color: tipoWeekend === 'sprintF1' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>⚡️ Weekend Sprint F1</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Sprint sabato (8-7-6...) + GP domenica (25-18-15...)</div>
            </button>
            <button onClick={() => setTipoWeekend('f2')} style={{ padding: '15px', background: tipoWeekend === 'f2' ? '#007AFF' : 'white', color: tipoWeekend === 'f2' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>🏎️ Weekend Formula 2</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>Sprint Race (15-12-10...) + Feature Race (25-18-15...)</div>
            </button>
          </div>
        </div>

        <button onClick={aggiungiGP} disabled={!nomeGP} style={{ width: '100%', padding: '15px', background: nomeGP ? '#007AFF' : '#ccc', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: nomeGP ? 'pointer' : 'not-allowed' }}>
          Avanti
        </button>
      </div>
    )
  }

  const garaAttuale = gp.gare[garaCorrente]
  const pilotiAttivi = classifica.piloti.filter(p => p.attivo)

  // Calcola le posizioni già assegnate (escludendo il pilota corrente)
  const posizioniAssegnate = Object.entries(risultati)
    .filter(([key, val]) => !key.endsWith('_flag') && val)
    .map(([key, val]) => val);

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', maxHeight: '90vh', overflow: 'auto' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Annulla</button>
      <h1 style={{ fontSize: '28px', marginBottom: '10px', textAlign: 'center' }}>GP: {gp.nome}</h1>
      <h2 style={{ fontSize: '20px', marginBottom: '30px', textAlign: 'center', color: '#666' }}>
        {garaAttuale.tipo_gara === 'principale' ? '🏁 Gara Principale' :
         garaAttuale.tipo_gara === 'sprint' ? '⚡️ Sprint Race' :
         garaAttuale.tipo_gara === 'featureRace' ? '🏆 Feature Race' :
         '🏎️ Sprint Race'}
      </h2>
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px', fontWeight: '600' }}>Inserisci posizioni:</h3>
        {/* BARRA DI RICERCA PILOTA */}
        <div style={{ position: 'sticky', top: '-40px', background: 'white', zIndex: 10, paddingBottom: '15px', marginTop: '-10px' }}>
          <input 
            type="text"
            placeholder="🔍 Cerca pilota per nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '2px solid #007AFF',
              fontSize: '16px',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(0,122,255,0.1)'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(() => {
            // Ordina piloti: prima quelli con posizione (ordine crescente), poi solo flag o vuoti
            const pilotiOrdinati = pilotiAttivi
              .filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
              .slice(); // copia
            pilotiOrdinati.sort((a, b) => {
              const posA = risultati[a.id] ? parseInt(risultati[a.id]) : null;
              const posB = risultati[b.id] ? parseInt(risultati[b.id]) : null;
              if (posA && posB) return posA - posB;
              if (posA) return -1;
              if (posB) return 1;
              return 0;
            });
            return pilotiOrdinati.map((pilota) => {
              const isSelezionato = pilotaSelezionato === pilota.id;
              const flag = risultati[`${pilota.id}_flag`] || '';
              const posizione = risultati[pilota.id] || '';
              const altrePosizioni = Object.entries(risultati)
                .filter(([key, val]) => !key.endsWith('_flag') && key !== String(pilota.id) && val)
                .map(([key, val]) => val);
              return (
                <div 
                  key={pilota.id} 
                  onClick={() => setPilotaSelezionato(pilota.id)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '15px', 
                    padding: '12px', 
                    background: isSelezionato ? 'rgba(0, 0, 0, 0.15)' : '#f8f8f8',
                    borderRadius: '12px',
                    border: isSelezionato ? '1px solid #333' : '1px solid transparent',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ flex: 1, fontWeight: isSelezionato ? '800' : '600', color: isSelezionato ? '#000' : '#333' }}>
                    {pilota.nome}
                  </div>
                  <input 
                    type="number" 
                    min="1" 
                    max="20" 
                    value={posizione}
                    disabled={!!flag}
                    onFocus={() => setPilotaSelezionato(pilota.id)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Permetti sempre di svuotare
                      if (raw === '' || raw === null) {
                        setRisultati({ ...risultati, [pilota.id]: '' });
                        return;
                      }
                      // Permetti la cancellazione e la scrittura progressiva (es: da 1 a 10)
                      const prev = risultati[pilota.id] ? String(risultati[pilota.id]) : '';
                      if (raw.length < prev.length || raw.length > prev.length) {
                        setRisultati({ ...risultati, [pilota.id]: raw });
                        return;
                      }
                      // Blocca solo se il valore è un numero valido, completo e già usato da altri (stessa lunghezza)
                      const val = Number(raw);
                      if (!isNaN(val) && raw !== '' && altrePosizioni.map(p => Number(p)).filter(n => !isNaN(n)).includes(val)) return;
                      setRisultati({ ...risultati, [pilota.id]: raw });
                    }}
                    placeholder="Pos" 
                    style={{ 
                      width: '80px', 
                      padding: '10px', 
                      borderRadius: '8px', 
                      border: '1px solid #ddd', 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      background: flag ? '#eee' : 'white',
                      color: flag ? '#aaa' : '#000'
                    }} 
                  />
                  <select
                    value={flag}
                    disabled={!!posizione}
                    onChange={e => setRisultati({ ...risultati, [`${pilota.id}_flag`]: e.target.value, [pilota.id]: '' })}
                    style={{ width: '90px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontWeight: 'bold', background: posizione ? '#eee' : 'white', color: posizione ? '#aaa' : '#000', marginLeft: 8 }}
                  >
                    <option value="">-</option>
                    <option value="DNS">DNS</option>
                    <option value="DNF">DNF</option>
                    <option value="DSQ">DSQ</option>
                  </select>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {classifica.punti_pole_attivo && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '10px', fontWeight: '600' }}>Pole Position:</h3>
          <select value={poleId || ''} onChange={(e) => setPoleId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Nessuno</option>
            {pilotiAttivi.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      {classifica.giro_veloce_attivo && (
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '10px', fontWeight: '600' }}>Giro Veloce:</h3>
          <select value={giroVeloceId || ''} onChange={(e) => setGiroVeloceId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Nessuno</option>
            {pilotiAttivi.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      )}

      <button onClick={garaNoNDispudata} style={{ width: '100%', padding: '15px', background: '#FF3B30', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
        Gara non disputata
      </button>

      <button onClick={() => setShowGaraAccorciata(true)} style={{ width: '100%', padding: '15px', background: '#FF9500', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>
        Gara Accorciata
      </button>

      {showGaraAccorciata && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '400px', width: '90%' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Seleziona percentuale di distanza</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => setPercentualeAccorciata(25)}
                style={{
                  padding: '15px',
                  background: percentualeAccorciata === 25 ? '#007AFF' : 'white',
                  color: percentualeAccorciata === 25 ? 'white' : '#000',
                  border: '2px solid #007AFF',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                25% (TOP 5: 6-4-3-2-1)
              </button>
              <button
                onClick={() => setPercentualeAccorciata(50)}
                style={{
                  padding: '15px',
                  background: percentualeAccorciata === 50 ? '#007AFF' : 'white',
                  color: percentualeAccorciata === 50 ? 'white' : '#000',
                  border: '2px solid #007AFF',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                50% (TOP 9: 13-10-8-6-5-4-3-2-1)
              </button>
              <button
                onClick={() => setPercentualeAccorciata(75)}
                style={{
                  padding: '15px',
                  background: percentualeAccorciata === 75 ? '#007AFF' : 'white',
                  color: percentualeAccorciata === 75 ? 'white' : '#000',
                  border: '2px solid #007AFF',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                75% (TOP 10: 19-14-12-10-8-6-4-3-2-1)
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowGaraAccorciata(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#e0e0e0',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  garaAccorciata()
                  setShowGaraAccorciata(false)
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#FF9500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }}
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={salvaRisultatiGara} 
        disabled={posizioniDuplicate.length > 0}
        style={{ 
          width: '100%', 
          padding: '15px', 
          background: posizioniDuplicate.length > 0 ? '#ccc' : '#34C759',
          color: 'white', 
          border: 'none', 
          borderRadius: '15px', 
          fontSize: '18px', 
          fontWeight: 'bold', 
          cursor: posizioniDuplicate.length > 0 ? 'not-allowed' : 'pointer',
          opacity: posizioniDuplicate.length > 0 ? 0.7 : 1
        }}
      >
        {garaCorrente < gp.gare.length - 1 ? 'Prossima Gara' : 'Salva GP'}
      </button>
    </div>
  )
}

// ===== IMPOSTAZIONI CLASSIFICA =====
function ImpostazioniClassifica({ classifica, onClose, onSave }) {
    // Stato per feedback visivo drag attivo per ogni pilota
    const [dragActive, setDragActive] = useState({});
  // Stato per la modale modifica foto piloti
  const [showModificaFotoPiloti, setShowModificaFotoPiloti] = useState(false);
  const [fotoPilotaFiles, setFotoPilotaFiles] = useState({}); // { [pilotaId]: File|null }
  const fileInputRefs = React.useRef({});
  const handleFotoPilotaChange = (pilotaId, file) => {
    setFotoPilotaFiles(prev => ({ ...prev, [pilotaId]: file }));
  };
  const handleFotoPilotaClick = (pilotaId) => {
    if (fileInputRefs.current[pilotaId]) fileInputRefs.current[pilotaId].click();
  };
  const handleFotoPilotaDrop = (pilotaId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFotoPilotaChange(pilotaId, e.dataTransfer.files[0]);
    }
  };
  // ...existing code...
  // ...existing code...
  const [dati, setDati] = useState(classifica)
  const [showCambiaPilota, setShowCambiaPilota] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [modificatoreRaw, setModificatoreRaw] = useState((classifica.modificatore_libero_punti || []).join(', '))

  const salva = async () => {
    setSalvando(true)
    try {
      const updateObj = {
        usa_sync_automatica: !!dati.usa_sync_automatica,
        url_sync: dati.url_sync || null,
        punti_pole_attivo: !!dati.punti_pole_attivo,
        punti_pole_valore: Number(dati.punti_pole_valore) || 0,
        giro_veloce_attivo: !!dati.giro_veloce_attivo,
        giro_veloce_valore: Number(dati.giro_veloce_valore) || 0,
        usa_sistema_fia: !!dati.usa_sistema_fia,
        usa_sprint: !!dati.usa_sprint,
        usa_modificatore_libero: !!dati.usa_modificatore_libero,
        modificatore_libero_numero: Number(dati.modificatore_libero_numero) || 0,
        modificatore_libero_punti: Array.isArray(dati.modificatore_libero_punti) ? dati.modificatore_libero_punti : []
      }

      const { error } = await supabase.from('classifiche').update(updateObj).eq('id', classifica.id)
      if (error) {
        console.error('Errore salvataggio impostazioni:', error)
        // Se l'errore è dovuto a colonne mancanti, riproviamo senza i campi del modificatore
        const msg = String(error.message || error.details || JSON.stringify(error))
        if (/modificatore_libero_punti|modificatore_libero_numero/.test(msg) || /column .* does not exist/.test(msg)) {
          const fallback = { ...updateObj }
          delete fallback.modificatore_libero_punti
          delete fallback.modificatore_libero_numero
          const { error: err2 } = await supabase.from('classifiche').update(fallback).eq('id', classifica.id)
          if (!err2) {
            setSaveSuccess(true)
            setSalvando(false)
            setTimeout(() => {
              onSave({ ...classifica, ...fallback })
              onClose()
            }, 1000)
            alert('⚠️ Alcuni campi (modificatore) non sono supportati dal DB: salvati gli altri valori. Esegui la migrazione SQL per aggiungerli.')
            return
          }
        }
        alert('❌ Errore durante il salvataggio delle impostazioni: ' + msg)
        setSalvando(false)
        return
      }
      // Mostra conferma visiva, poi chiudi/aggiorna
      setSaveSuccess(true)
      setSalvando(false)
      setTimeout(() => {
        onSave({ ...classifica, ...updateObj })
        onClose()
      }, 1000)
    } catch (err) {
      console.error('Errore salvataggio impostazioni:', err)
      alert('❌ Errore durante il salvataggio delle impostazioni')
      setSalvando(false)
    }
  }

  const cancellaDati = async () => {
  if (!confirm(
    '⚠️ ATTENZIONE!\n\nQuesta azione cancellerà TUTTO:\n' +
    '- Tutti i GP inseriti\n' +
    '- Tutti i piloti e costruttori\n' +
    '- Tutti i punti e distacchi\n\n' +
    'La classifica sarà completamente vuota. Continuare?'
  )) return;

  // Reset completo
  const reset = {
    gp: [],
    piloti: [],
    costruttori: []
  };

  const { error } = await supabase
    .from('classifiche')
    .update(reset)
    .eq('id', classifica.id);

  if (!error) {
    alert('✅ Classifica completamente resettata');
    
    // Aggiorna stato locale
    onSave(reset);

    // Torna alla home delle classifiche
    navigate('/home-classifiche'); // sostituisci con la tua route reale
  } else {
    alert('❌ Errore durante il reset della classifica');
  }
};


  if (showCambiaPilota) {
    return <CambiaPilotaView 
      classifica={dati} 
      onClose={() => setShowCambiaPilota(false)} 
      onSave={(nuovaClassifica) => { 
        setDati(nuovaClassifica)
        setShowCambiaPilota(false)
      }} 
    />
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>← Indietro</button>
        <h1 style={{ fontSize: '28px', margin: 0 }}>Impostazioni: {classifica.nome}</h1>
        <div style={{ width: '100px' }}></div>
      </div>

      <div style={{ marginBottom: '30px', padding: '20px', background: '#f0f8ff', borderRadius: '10px' }}>
        <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>🔄</span> Sincronizzazione Automatica
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <input type="checkbox" checked={dati.usa_sync_automatica || false} onChange={(e) => setDati({ ...dati, usa_sync_automatica: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span>Attiva sincronizzazione da URL</span>
        </label>
        {dati.usa_sync_automatica && (
          <input type="text" value={dati.url_sync || ''} onChange={(e) => setDati({ ...dati, url_sync: e.target.value })} placeholder="URL sincronizzazione" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <input type="checkbox" checked={dati.punti_pole_attivo || false} onChange={(e) => setDati({ ...dati, punti_pole_attivo: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontWeight: '600' }}>Punti Pole Position</span>
        </label>
        {dati.punti_pole_attivo && (
          <div style={{ marginLeft: '30px' }}>
            <label>Punti per Pole: </label>
            <input type="number" min="1" max="10" value={dati.punti_pole_valore || 3} onChange={(e) => setDati({ ...dati, punti_pole_valore: parseInt(e.target.value) })} style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '2px solid #007AFF', textAlign: 'center' }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <input type="checkbox" checked={dati.giro_veloce_attivo || false} onChange={(e) => setDati({ ...dati, giro_veloce_attivo: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span style={{ fontWeight: '600' }}>Punti Giro Veloce</span>
        </label>
        {dati.giro_veloce_attivo && (
          <div style={{ marginLeft: '30px' }}>
            <label>Punti Giro Veloce: </label>
            <input type="number" min="1" max="10" value={dati.giro_veloce_valore || 1} onChange={(e) => setDati({ ...dati, giro_veloce_valore: parseInt(e.target.value) })} style={{ width: '60px', padding: '8px', borderRadius: '8px', border: '2px solid #007AFF', textAlign: 'center' }} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <input type="checkbox" checked={dati.usa_sistema_fia || false} onChange={(e) => setDati({ ...dati, usa_sistema_fia: e.target.checked, usa_modificatore_libero: e.target.checked ? false : dati.usa_modificatore_libero })} style={{ width: '20px', height: '20px' }} />
          <span>Usa sistema FIA</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <input type="checkbox" checked={dati.usa_sprint || false} onChange={(e) => setDati({ ...dati, usa_sprint: e.target.checked })} style={{ width: '20px', height: '20px' }} />
          <span>Usa sistema Sprint</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" checked={dati.usa_modificatore_libero || false} onChange={(e) => setDati({ ...dati, usa_modificatore_libero: e.target.checked, usa_sistema_fia: e.target.checked ? false : dati.usa_sistema_fia })} style={{ width: '20px', height: '20px' }} />
          <span>Modificatore libero</span>
        </label>
          {dati.usa_modificatore_libero && (
            <div style={{ marginLeft: '30px', marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Numero posizioni a punti</label>
              <input type="number" min="1" max="50" value={dati.modificatore_libero_numero || 10} onChange={(e) => setDati({ ...dati, modificatore_libero_numero: Number(e.target.value) || 0 })} style={{ width: '120px', padding: '8px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }} />

              <label style={{ display: 'block', marginTop: '12px', marginBottom: '8px', fontWeight: '600' }}>Punti per posizione (separatori: , ; spazio o -/–/—)</label>
            <textarea value={modificatoreRaw} onChange={(e) => {
              const text = e.target.value
              setModificatoreRaw(text)
              // accetta separatori: comma, semicolon, space, hyphen, en-dash, em-dash
              const parts = text.split(/[,;\s\-\u2013\u2014]+/).filter(p => p.trim().length > 0)
              const raw = parts.map(s => parseInt(s.trim())).filter(n => !Number.isNaN(n))
              setDati({ ...dati, modificatore_libero_punti: raw })
            }} rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }} />
            </div>
          )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <button onClick={() => setShowCambiaPilota(true)} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #FF9500 0%, #FF6B00 100%)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
          Cambia Pilota
        </button>
        <button onClick={() => setShowModificaFotoPiloti(true)} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #34C759 0%, #28A745 100%)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>
          Modifica foto piloti
        </button>
        <button onClick={cancellaDati} style={{ width: '100%', padding: '15px', background: 'linear-gradient(135deg, #FF3B30 0%, #D70015 100%)', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          Cancella Dati
        </button>
        {/* Modale Modifica Foto Piloti */}
        {showModificaFotoPiloti && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '20px', padding: '30px', minWidth: '350px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
              <button onClick={() => setShowModificaFotoPiloti(false)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Indietro</button>
              <h2 style={{ fontSize: '24px', marginBottom: '25px' }}>Modifica foto piloti</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {dati.piloti.map(p => (
                  <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px' }}>
                    {p.foto ? <img src={p.foto} alt="Foto" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: '1px solid #ccc' }} /> : <span style={{ width: 38, height: 38, display: 'inline-block', background: '#eee', borderRadius: 8, border: '1px solid #ccc', textAlign: 'center', lineHeight: '38px', color: '#bbb' }}>?</span>}
                    <span style={{ fontWeight: 500 }}>{p.nome}</span>
                    <div
                      style={{
                        width: 90,
                        height: 38,
                        border: dragActive[p.id] ? '2.5px solid #34C759' : '2px dashed #007AFF',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: fotoPilotaFiles && fotoPilotaFiles[p.id] ? 'none' : dragActive[p.id] ? '#e6ffe6' : '#f8f9fa',
                        cursor: 'pointer',
                        position: 'relative',
                        marginLeft: 'auto',
                        marginRight: 10,
                        transition: 'border-color 0.2s, background 0.2s',
                        overflow: 'hidden',
                        userSelect: 'none',
                      }}
                      onClick={() => handleFotoPilotaClick(p.id)}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                      onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragActive(prev => ({ ...prev, [p.id]: true })); }}
                      onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragActive(prev => ({ ...prev, [p.id]: false })); }}
                      onDrop={e => { setDragActive(prev => ({ ...prev, [p.id]: false })); handleFotoPilotaDrop(p.id, e); }}
                      draggable={false}
                      title="Clicca o trascina qui la foto"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        ref={el => fileInputRefs.current[p.id] = el}
                        style={{ display: 'none' }}
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) handleFotoPilotaChange(p.id, e.target.files[0]);
                        }}
                      />
                      {fotoPilotaFiles && fotoPilotaFiles[p.id] ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                          <img src={URL.createObjectURL(fotoPilotaFiles[p.id])} alt="Anteprima" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setFotoPilotaFiles(prev => ({ ...prev, [p.id]: undefined })); }}
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              width: 20,
                              height: 20,
                              background: 'rgba(255,255,255,0.85)',
                              border: 'none',
                              borderRadius: '50%',
                              color: '#FF3B30',
                              fontWeight: 'bold',
                              fontSize: 15,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.10)'
                            }}
                            title="Rimuovi foto"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#007AFF', fontWeight: 600, fontSize: '14px', textAlign: 'center', width: '100%' }}>
                          DAD/Clicca foto
                        </span>
                      )}
                    </div>
                    {/* Qui andrà il bottone di salvataggio per ogni pilota, da implementare nella logica upload */}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <button onClick={salva} disabled={salvando} style={{ width: '100%', padding: '15px', background: salvando ? '#98c0ff' : '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: salvando ? 'not-allowed' : 'pointer' }}>
        {salvando ? 'Salvando...' : 'Salva Impostazioni'}
      </button>
    </div>
  )
}

function CambiaPilotaView({ classifica, onClose, onSave }) {
  const [pilota1, setPilota1] = useState('')
  const [pilota2, setPilota2] = useState('')
  const [usaNuovoPilota, setUsaNuovoPilota] = useState(false)
  const [nomePilota, setNomePilota] = useState('')
  const [salvando, setSalvando] = useState(false)

  const conferma = async () => {
    if (!pilota1) {
      alert('Seleziona il primo pilota')
      return
    }
    
    setSalvando(true)
    
    const nuoviPiloti = [...classifica.piloti]
    const idx1 = nuoviPiloti.findIndex(p => String(p.id) === String(pilota1))
    if (idx1 === -1) {
      setSalvando(false)
      return
    }
    
    if (usaNuovoPilota) {
      // CASO 1: NUOVO PILOTA SCRITTO A MANO
      if (!nomePilota) {
        alert('Inserisci il nome del nuovo pilota')
        setSalvando(false)
        return
      }
      
      // Primo pilota → INATTIVO (ma mantiene punti!)
      nuoviPiloti[idx1].attivo = false
      
      // Nuovo pilota → ATTIVO con stesso team/colore
      const nuovoPilotaObj = {
        id: Date.now().toString(),
        nome: nomePilota,
        team: nuoviPiloti[idx1].team,
        colore: nuoviPiloti[idx1].colore,
        punti: 0,
        distacco: 0,
        attivo: true  // ESPLICITAMENTE true
      }
      
      console.log('Creando nuovo pilota:', nuovoPilotaObj)
      console.log('Pilota sostituito:', nuoviPiloti[idx1])
      
      nuoviPiloti.push(nuovoPilotaObj)
      
      console.log('Lista piloti dopo aggiunta:', nuoviPiloti.map(p => ({ nome: p.nome, attivo: p.attivo })))
    } else {
      // CASO 2: PILOTA DALLA TENDINA
      if (!pilota2) {
        alert('Seleziona il secondo pilota')
        setSalvando(false)
        return
      }
      const idx2 = nuoviPiloti.findIndex(p => String(p.id) === String(pilota2))
      if (idx2 === -1) {
        setSalvando(false)
        return
      }
      
      // SCAMBIO TEAM (sempre)
      const tempTeam = nuoviPiloti[idx1].team
      const tempColore = nuoviPiloti[idx1].colore
      nuoviPiloti[idx1].team = nuoviPiloti[idx2].team
      nuoviPiloti[idx1].colore = nuoviPiloti[idx2].colore
      nuoviPiloti[idx2].team = tempTeam
      nuoviPiloti[idx2].colore = tempColore
      
      // LOGICA ATTIVO/INATTIVO
      if (nuoviPiloti[idx2].attivo) {
        // Secondo GIÀ ATTIVO → ENTRAMBI RIMANGONO ATTIVI (scambio semplice)
        // NON toccare .attivo
      } else {
        // Secondo INATTIVO → SOSTITUZIONE
        nuoviPiloti[idx2].attivo = true  // Inattivo diventa attivo
        nuoviPiloti[idx1].attivo = false // Attivo diventa inattivo (ma mantiene punti!)
      }
    }
    
    // Salva direttamente su Supabase
    const { error } = await supabase
      .from('classifiche')
      .update({ piloti: nuoviPiloti })
      .eq('id', classifica.id)
    
    setSalvando(false)
    
    if (error) {
      console.error('Errore salvataggio:', error)
      alert('❌ Errore durante il salvataggio')
      return
    }
    
    console.log('Salvato con successo su Supabase')
    console.log('Piloti salvati:', nuoviPiloti.map(p => ({ nome: p.nome, attivo: p.attivo })))
    
    // Aggiorna lo stato locale
    onSave({ ...classifica, piloti: nuoviPiloti })
    
    alert('✅ Pilota cambiato con successo!')
    onClose()
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', background: 'white', borderRadius: '20px' }}>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>← Indietro</button>
      <h1 style={{ fontSize: '28px', marginBottom: '30px' }}>Cambia Pilota</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Primo pilota (da sostituire):</label>
        <select value={pilota1} onChange={(e) => setPilota1(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <option value="">Seleziona</option>
          {classifica.piloti.filter(p => p.attivo).map(p => <option key={p.id} value={p.id}>{p.nome} ({p.team})</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" checked={usaNuovoPilota} onChange={(e) => setUsaNuovoPilota(e.target.checked)} style={{ width: '20px', height: '20px' }} />
          <span>Usa nuovo pilota</span>
        </label>
      </div>

      {usaNuovoPilota ? (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome nuovo pilota:</label>
          <input type="text" value={nomePilota} onChange={(e) => setNomePilota(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Secondo pilota:</label>
          <select value={pilota2} onChange={(e) => setPilota2(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            <option value="">Seleziona</option>
            {classifica.piloti.map(p => <option key={p.id} value={p.id}>{p.nome} ({p.team}) {p.attivo ? '✅' : '⚠️ INATTIVO'}</option>)}
          </select>
        </div>
      )}

      <button onClick={conferma} disabled={salvando} style={{ width: '100%', padding: '15px', background: salvando ? '#ccc' : '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: salvando ? 'not-allowed' : 'pointer' }}>
        {salvando ? 'Salvando...' : 'Conferma'}
      </button>
    </div>
  )
}

// ===== GRAFICO PRONOSTICO =====
function GraficoPronostico({ classifica, isMobile, onClose }) {
    // Stato per posizione drag del tasto Indietro
    const [backBtnPos, setBackBtnPos] = useState({ x: 0, y: isMobile ? 28 : 34 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [btnStart, setBtnStart] = useState({ x: 0, y: 0 });

    // Gestori drag mouse
    function handleMouseDown(e) {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setBtnStart({ ...backBtnPos });
      e.preventDefault();
    }
    function handleMouseMove(e) {
      if (!dragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setBackBtnPos({ x: btnStart.x + dx, y: btnStart.y + dy });
    }
    function handleMouseUp() {
      setDragging(false);
    }

    // Gestori drag touch
    function handleTouchStart(e) {
      const touch = e.touches[0];
      setDragging(true);
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setBtnStart({ ...backBtnPos });
    }
    function handleTouchMove(e) {
      if (!dragging) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.x;
      const dy = touch.clientY - dragStart.y;
      setBackBtnPos({ x: btnStart.x + dx, y: btnStart.y + dy });
    }
    function handleTouchEnd() {
      setDragging(false);
    }
  const [tab, setTab] = useState(0)
  const [pilotaFissato, setPilotaFissato] = useState(null)
  const [showVersus, setShowVersus] = useState(false)
  
  const pilotiOrdinati = classifica.piloti ? classifica.piloti.filter(p => p.attivo).sort((a, b) => (b.punti || 0) - (a.punti || 0)) : []
  const costruttoriOrdinati = classifica.costruttori ? classifica.costruttori.sort((a, b) => (b.punti || 0) - (a.punti || 0)) : []
  
  const gpRimanenti = classifica.gp ? classifica.gp.filter(g => !g.completato).length : 0
  const sprintRimanenti = classifica.gp ? classifica.gp.filter(g => !g.completato && g.tipo_weekend === 'sprintF1').length : 0
  
  const puntiMassimiRimanenti = gpRimanenti * 25 + sprintRimanenti * 8


  return (
    <div style={{ height: '100vh', overflow: 'auto', background: '#f5f5f7', padding: isMobile ? '10px' : '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '20px' }}>
        {/* HEADER */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '15px', marginBottom: '20px', padding: isMobile ? '15px' : '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', minHeight: isMobile ? '44px' : 'auto', padding: isMobile ? '8px 0' : '0' }}>
            ← Indietro
          </button>
          <h1 style={{ fontSize: isMobile ? '20px' : '34px', fontWeight: 'bold', margin: 0, flex: 1, textAlign: isMobile ? 'left' : 'center', order: isMobile ? -1 : 0 }}>Grafico Pronostico Campionato</h1>
        </div>

        {/* TAB */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
          <button onClick={() => { setTab(0); setPilotaFissato(null) }} style={{ flex: 1, padding: '15px', background: tab === 0 ? '#007AFF' : 'white', color: tab === 0 ? 'white' : '#000', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Piloti</button>
          <button onClick={() => { setTab(1); setPilotaFissato(null) }} style={{ flex: 1, padding: '15px', background: tab === 1 ? '#007AFF' : 'white', color: tab === 1 ? 'white' : '#000', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Costruttori</button>
        </div>

        <div style={{ background: 'white', borderRadius: '15px', padding: '30px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '60px' }}>
            <div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#007AFF' }}>{gpRimanenti}</div>
              <div style={{ fontSize: '16px', color: '#666' }}>GP rimanenti</div>
            </div>
            <div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#FF9500' }}>{sprintRimanenti}</div>
              <div style={{ fontSize: '16px', color: '#666' }}>Sprint rimanenti</div>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>Andamento Punti Stagione</h2>
            <button onClick={() => setShowVersus(true)} style={{ width: 56, height: 56, background: '#007AFF', color: 'white', border: 'none', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
              <img src="/assets/versus.svg" alt="versus" style={{ height: 48, width: 48, display: 'block', filter: 'invert(1) brightness(2)' }} />
            </button>
          </div>
          <VersusModal
            open={showVersus ? { piloti: Array.isArray(classifica?.piloti) ? classifica.piloti.filter(p => p.attivo) : [], gp: Array.isArray(classifica?.gp) ? classifica.gp : [] } : null}
            onClose={() => setShowVersus(false)}
            handleMouseMove={handleMouseMove}
            handleMouseUp={handleMouseUp}
            handleTouchMove={handleTouchMove}
            handleTouchEnd={handleTouchEnd}
            backBtnPos={backBtnPos}
          />
          {classifica.gp && classifica.gp.length > 0 ? (
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <svg width={Math.max(800, classifica.gp.filter(g => g.completato).length * 100)} height="400" style={{ display: 'block' }}>
                {/* Griglia */}
                {[0, 25, 50, 75, 100, 125, 150, 175, 200].map(y => (
                  <g key={y}>
                    <line x1="50" y1={350 - y * 1.5} x2={Math.max(800, classifica.gp.filter(g => g.completato).length * 100)} y2={350 - y * 1.5} stroke="#e0e0e0" strokeWidth="1" />
                    <text x="10" y={355 - y * 1.5} fontSize="12" fill="#999">{y}</text>
                  </g>
                ))}
                
                {/* Linee piloti/costruttori */}
                {(tab === 0 ? pilotiOrdinati : costruttoriOrdinati).map((item, idx) => {
                  const gpCompletati = classifica.gp.filter(g => g.completato)
                  if (gpCompletati.length === 0) return null
                  
                  let puntiAccumulati = 0
                  const punti = [{ x: 50, y: 350, punti: 0 }]
                  
                  gpCompletati.forEach((gp, gpIdx) => {
                    let puntiGP = 0
                    
                    gp.gare?.forEach(gara => {
                      if (!gara.completata || gara.non_disputata) return
                      
                      if (tab === 0) {
                        // PILOTI: calcolo normale
                        const risultato = gara.risultati?.[item.id]
                        if (!risultato) return
                        
                        let puntiGara
                        if (gara.accorciata) {
                          puntiGara = calcolaPuntiAccorciati(risultato, gara.percentuale_accorciata)
                        } else {
                          puntiGara = calcolaPuntiPosizione(risultato, gara.tipo_gara, classifica)
                        }
                        if (classifica.punti_pole_attivo && String(gara.pole_id) === String(item.id)) {
                          puntiGara += classifica.punti_pole_valore || 3
                        }
                        if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(item.id)) {
                          puntiGara += classifica.giro_veloce_valore || 1
                        }
                        puntiGP += puntiGara
                      } else {
                        // COSTRUTTORI: somma punti di tutti i piloti del team
                        Object.entries(gara.risultati || {}).forEach(([pilotaId, pos]) => {
                          const pilota = classifica.piloti.find(p => String(p.id) === String(pilotaId))
                          if (!pilota || pilota.team !== item.nome) return
                          
                          let puntiGara
                          if (gara.accorciata) {
                            puntiGara = calcolaPuntiAccorciati(pos, gara.percentuale_accorciata)
                          } else {
                            puntiGara = calcolaPuntiPosizione(pos, gara.tipo_gara, classifica)
                          }
                          if (classifica.punti_pole_attivo && String(gara.pole_id) === String(pilotaId)) {
                            puntiGara += classifica.punti_pole_valore || 3
                          }
                          if (classifica.giro_veloce_attivo && String(gara.giro_veloce_id) === String(pilotaId)) {
                            puntiGara += classifica.giro_veloce_valore || 1
                          }
                          puntiGP += puntiGara
                        })
                      }
                    })
                    
                    puntiAccumulati += puntiGP
                    const x = 50 + (gpIdx + 1) * 100
                    const y = 350 - puntiAccumulati * 1.5
                    punti.push({ x, y, punti: puntiAccumulati })
                  })
                  
                  // Calcola percentuale per determinare se fuori lotta
                  const lista = tab === 0 ? pilotiOrdinati : costruttoriOrdinati
                  const moltiplicatore = tab === 0 ? 1 : 2
                  const distacco = idx === 0 ? 0 : ((lista[0]?.punti || 0) - (item.punti || 0))
                  const possibile = distacco <= puntiMassimiRimanenti * moltiplicatore
                  const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / (puntiMassimiRimanenti * moltiplicatore)) * 100)) : 0
                  
                  const fuoriLotta = percentuale === 0 && idx > 0
                  const colore = fuoriLotta ? '#cccccc' : (item.colore || '#007AFF')
                  const isFissato = pilotaFissato && String(pilotaFissato) === String(item.id)
                  const opacity = pilotaFissato ? (isFissato ? 1 : 0.2) : (fuoriLotta ? 0.3 : 1)
                  const strokeWidth = isFissato ? 5 : 3
                  
                  return (
                    <g key={item.id}>
                      <polyline
                        points={punti.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={colore}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                      />
                      {punti.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={isFissato ? 7 : 5} fill={colore} opacity={opacity}>
                          <title>{item.nome}: {p.punti} pts</title>
                        </circle>
                      ))}
                    </g>
                  )
                })}
                
                {/* Etichette GP */}
                {classifica.gp.filter(g => g.completato).map((gp, idx) => (
                  <text key={gp.id} x={50 + (idx + 1) * 100} y="380" fontSize="10" fill="#666" textAnchor="middle" transform={`rotate(-45, ${50 + (idx + 1) * 100}, 380)`}>
                    {gp.nome}
                  </text>
                ))}
              </svg>
              
              {/* Legenda */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '20px', padding: '15px', background: '#f9f9f9', borderRadius: '10px' }}>
                {(tab === 0 ? pilotiOrdinati : costruttoriOrdinati).map((item, idx) => {
                  const lista = tab === 0 ? pilotiOrdinati : costruttoriOrdinati
                  const moltiplicatore = tab === 0 ? 1 : 2
                  const distacco = idx === 0 ? 0 : ((lista[0]?.punti || 0) - (item.punti || 0))
                  const possibile = distacco <= puntiMassimiRimanenti * moltiplicatore
                  const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / (puntiMassimiRimanenti * moltiplicatore)) * 100)) : 0
                  const fuoriLotta = percentuale === 0 && idx > 0
                  const isFissato = pilotaFissato && String(pilotaFissato) === String(item.id)
                  return (
                    <div 
                      key={item.id} 
                      onClick={() => setPilotaFissato(isFissato ? null : item.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        opacity: pilotaFissato ? (isFissato ? 1 : 0.4) : (fuoriLotta ? 0.5 : 1),
                        cursor: 'pointer',
                        padding: '8px',
                        background: isFissato ? '#e3f2fd' : 'transparent',
                        borderRadius: '8px',
                        border: isFissato ? '2px solid #007AFF' : '2px solid transparent'
                      }}
                    >
                      <div style={{ width: '20px', height: isFissato ? '6px' : '4px', background: item.colore || '#007AFF', borderRadius: '2px' }}></div>
                      <span style={{ fontSize: '14px', fontWeight: isFissato ? 'bold' : '500' }}>{item.nome}</span>
                      {fuoriLotta && <span style={{ fontSize: '12px', color: '#999' }}>(fuori lotta)</span>}
                      {isFissato && <span style={{ fontSize: '12px', color: '#007AFF' }}>📌</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Nessun GP inserito ancora</div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '15px', padding: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px' }}>Analisi Possibilità di Vittoria</h2>
          {tab === 0 ? (
            pilotiOrdinati.map((p, i) => {
              const puntiRimanenti = puntiMassimiRimanenti
              const distacco = i === 0 ? 0 : (pilotiOrdinati[0]?.punti || 0) - (p.punti || 0)
              const possibile = distacco <= puntiRimanenti
              const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / puntiRimanenti) * 100)) : 0
              const combinazioni = calcolaCombinazioniVittoria(p, classifica, gpRimanenti, sprintRimanenti)
              
              return (
                <div key={p.id} style={{ padding: '20px', borderBottom: i < pilotiOrdinati.length - 1 ? '1px solid #eee' : 'none', opacity: possibile ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{p.nome}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#007AFF' }}>{p.punti || 0} pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Punti rimanenti:</span>
                    <span style={{ fontWeight: 'bold' }}>{puntiRimanenti}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Possibilità di vincere:</span>
                    <span style={{ fontWeight: 'bold', color: possibile ? '#34C759' : '#FF3B30' }}>
                      {possibile ? (i === 0 ? 'Leader' : `${percentuale}%`) : 'Fuori dalla lotta'}
                    </span>
                  </div>
                  {possibile && (
                    <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                      <div style={{ width: `${percentuale}%`, height: '100%', background: '#34C759' }}></div>
                    </div>
                  )}
                  
                  {/* COMBINAZIONI */}
                  {combinazioni.length > 0 && (
                    <div style={{ marginTop: '15px', padding: '15px', background: '#fff8e1', borderRadius: '8px', borderLeft: '4px solid #FF9500' }}>
                      <div style={{ fontWeight: 'bold', color: '#FF9500', marginBottom: '10px' }}>
                      Combinazioni per vincere il campionato:
                      </div>
                      {combinazioni.map((combo, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
                          <span style={{ color: '#FF9500' }}>•</span>
                          <span>{combo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            costruttoriOrdinati.map((c, i) => {
              const puntiRimanenti = puntiMassimiRimanenti * 2
              const distacco = i === 0 ? 0 : (costruttoriOrdinati[0]?.punti || 0) - (c.punti || 0)
              const possibile = distacco <= puntiRimanenti
              const percentuale = possibile ? Math.min(100, Math.round((1 - distacco / puntiRimanenti) * 100)) : 0
              
              // Combinazioni costruttori (simili a piloti ma con 2 piloti per team)
              const combinazioniCostruttori = []
              if (possibile && gpRimanenti > 0) {
                const leader = costruttoriOrdinati[0]
                
                if (i === 0) {
                  // SONO IL LEADER
                  if (costruttoriOrdinati.length > 1) {
                    const secondo = costruttoriOrdinati[1]
                    const vantaggio = (c.punti || 0) - (secondo.punti || 0)
                    
                    if (vantaggio > puntiRimanenti) {
                      combinazioniCostruttori.push('🏆 Già campione matematico!')
                    } else {
                      // Combinazioni per mantenere la leadership
                      combinazioniCostruttori.push(`${c.nome} mantiene vantaggio con doppietta 1-2 in ${Math.ceil((puntiRimanenti - vantaggio) / 43)} gare`)
                      combinazioniCostruttori.push(`${c.nome} 1° + 3° in ${Math.ceil((puntiRimanenti - vantaggio) / 40)} gare garantisce titolo`)
                      combinazioniCostruttori.push(`Se ${secondo.nome} fa meno di ${vantaggio} punti, ${c.nome} è campione`)
                    }
                  } else {
                    combinazioniCostruttori.push('🏆 Unico costruttore in classifica!')
                  }
                } else {
                  // SONO INSEGUITORE
                  const gpRimanentiList = classifica.gp.filter(g => !g.completato)
                  const puntiPerPosizione = (classifica && classifica.usa_modificatore_libero && Array.isArray(classifica.modificatore_libero_punti) && classifica.modificatore_libero_punti.length > 0)
                    ? classifica.modificatore_libero_punti
                    : [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
                  let garaVittoria = null
                  const tuttiGliIncastri = []
                  
                  // Itera su ogni gara rimanente
                  for (let gpIdx = 0; gpIdx < gpRimanentiList.length && !garaVittoria; gpIdx++) {
                    const gp = gpRimanentiList[gpIdx]
                    const gareDopoQuesta = gpRimanentiList.length - gpIdx - 1
                    
                    // Itera su possibili doppiette del costruttore (1-2, 1-3, 2-3, ecc.)
                    for (let pos1 = 1; pos1 <= 2; pos1++) {
                      for (let pos2 = pos1 + 1; pos2 <= 3; pos2++) {
                        const puntiDaQuestaGara = (puntiPerPosizione[pos1 - 1] || 0) + (puntiPerPosizione[pos2 - 1] || 0)
                        const puntiCostruttoreTotale = (c.punti || 0) + puntiDaQuestaGara
                        
                        // Verifica contro tutti i rivali
                        for (let rivaleIdx = 0; rivaleIdx < costruttoriOrdinati.length; rivaleIdx++) {
                          const rivale = costruttoriOrdinati[rivaleIdx]
                          if (rivale.id === c.id) continue
                          
                          // Itera su possibili posizioni del rivale (il massimo che potrebbe fare)
                          for (let posRivale1 = 1; posRivale1 <= 2; posRivale1++) {
                            for (let posRivale2 = posRivale1 + 1; posRivale2 <= 3; posRivale2++) {
                              const puntiRivaleDaQuesta = (puntiPerPosizione[posRivale1 - 1] || 0) + (puntiPerPosizione[posRivale2 - 1] || 0)
                              const puntiRivaleTotale = (rivale.punti || 0) + puntiRivaleDaQuesta
                              const puntiRivaleMassimi = puntiRivaleTotale + (gareDopoQuesta * 50)
                              
                              if (puntiCostruttoreTotale > puntiRivaleMassimi && !garaVittoria) {
                                garaVittoria = gp.nome
                                tuttiGliIncastri.push(`${c.nome} ${pos1}°/${pos2}° + ${rivale.nome} ${posRivale1}°/${posRivale2}°`)
                              } else if (garaVittoria === gp.nome && tuttiGliIncastri.length < 10) {
                                tuttiGliIncastri.push(`${c.nome} ${pos1}°/${pos2}° + ${rivale.nome} ${posRivale1}°/${posRivale2}°`)
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  if (garaVittoria) {
                    combinazioniCostruttori.push(`🏆 Diventa campione a: ${garaVittoria}`)
                    combinazioniCostruttori.push('')
                    const incastriUnique = [...new Set(tuttiGliIncastri)].slice(0, 10)
                    incastriUnique.forEach(incastro => {
                      combinazioniCostruttori.push(`✓ ${incastro}`)
                    })
                  } else {
                    combinazioniCostruttori.push('❌ Matematicamente non può vincere il campionato')
                  }
                }
              }
              
              return (
                <div key={c.id} style={{ padding: '20px', borderBottom: i < costruttoriOrdinati.length - 1 ? '1px solid #eee' : 'none', opacity: possibile ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{c.nome}</span>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#007AFF' }}>{c.punti || 0} pts</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Punti rimanenti:</span>
                    <span style={{ fontWeight: 'bold' }}>{puntiRimanenti}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>Possibilità di vincere:</span>
                    <span style={{ fontWeight: 'bold', color: possibile ? '#34C759' : '#FF3B30' }}>
                      {possibile ? (i === 0 ? 'Leader' : `${percentuale}%`) : 'Fuori dalla lotta'}
                    </span>
                  </div>
                  {possibile && (
                    <div style={{ width: '100%', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden', marginBottom: '15px' }}>
                      <div style={{ width: `${percentuale}%`, height: '100%', background: '#34C759' }}></div>
                    </div>
                  )}
                  
                  {/* COMBINAZIONI COSTRUTTORI */}
                  {combinazioniCostruttori.length > 0 && (
                    <div style={{ marginTop: '15px', padding: '15px', background: '#fff8e1', borderRadius: '8px', borderLeft: '4px solid #FF9500' }}>
                      <div style={{ fontWeight: 'bold', color: '#FF9500', marginBottom: '10px' }}>
                        Combinazioni per vincere il campionato:
                      </div>
                      {combinazioniCostruttori.map((combo, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
                          <span style={{ color: '#FF9500' }}>•</span>
                          <span>{combo}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ===== SETUP INIZIALE CON F2 =====
function SetupIniziale({ classifica, onSave, onBack }) {
  const [step, setStep] = useState(0)
  const [piloti, setPiloti] = useState([])
  const [costruttori, setCostruttori] = useState([])
  const [numeroGP, setNumeroGP] = useState(10)
  const [numeroSprint, setNumeroSprint] = useState(2)
  const [gp, setGp] = useState([])
  const [nomePilota, setNomePilota] = useState('')
  const [teamPilota, setTeamPilota] = useState('')
  const [colorePilota, setColorePilota] = useState('#0066FF')
  const [fotoPilota, setFotoPilota] = useState(null)
  const [nomeGP, setNomeGP] = useState('')
  const [tipoWeekend, setTipoWeekend] = useState('standard')
  const fileInputRef = React.useRef();

  const aggiungiPilota = async () => {
    if (!nomePilota || !teamPilota) return
    let fotoUrl = null;
    if (fotoPilota) {
      // Upload su Supabase Storage (bucket: loghi-piloti)
      const fileName = `piloti/${Date.now()}_${nomePilota.replace(/\s+/g, '_')}`;
      const { data, error } = await supabase.storage.from('loghi-piloti').upload(fileName, fotoPilota, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('loghi-piloti').getPublicUrl(fileName);
        fotoUrl = urlData.publicUrl;
      }
    }
    const nuovoPilota = { id: Date.now(), nome: nomePilota, team: teamPilota, colore: colorePilota, punti: 0, distacco: 0, attivo: true, foto: fotoUrl };
    setPiloti([...piloti, nuovoPilota]);
    if (!costruttori.find(c => c.nome === teamPilota)) {
      setCostruttori([...costruttori, { id: Date.now() + 1, nome: teamPilota, colore: colorePilota, punti: 0, distacco: 0 }]);
    }
    setNomePilota('');
    setTeamPilota('');
    setColorePilota('#0066FF');
    setFotoPilota(null);
  }

  const aggiungiGP = () => {
    if (!nomeGP) return
    const nuovoGP = { id: Date.now(), nome: nomeGP, tipo_weekend: tipoWeekend, completato: false, gare: [] }
    setGp([...gp, nuovoGP])
    setNomeGP('')
  }

  const confermaESalva = async () => {
    // Salva la classifica aggiornata su Supabase (standard o custom)
    const nuovaClassifica = { ...classifica, piloti, costruttori, gp, numero_gp_stagione: numeroGP, numero_sprint_stagione: numeroSprint };
    if (classifica.isCustom) {
      // Aggiorna classifiche_custom
      await supabase.from('classifiche_custom').update(nuovaClassifica).eq('id', classifica.id);
    } else {
      // Aggiorna classifiche standard
      await supabase.from('classifiche').update(nuovaClassifica).eq('id', classifica.id);
    }
    onSave(nuovaClassifica);
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', background: 'white', borderRadius: '20px', maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ marginBottom: '30px' }}>
        <button onClick={step === 0 ? onBack : () => setStep(step - 1)} style={{ background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Indietro
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
          {[0, 1, 2].map(idx => <div key={idx} style={{ width: '12px', height: '12px', borderRadius: '50%', background: step === idx ? '#007AFF' : '#ddd' }} />)}
        </div>
      </div>

    {step === 0 && (
      <>
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '30px', textAlign: 'center' }}>Inserisci i piloti e i team in {classifica.nome}</h1>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome Pilota</label>
            <input type="text" value={nomePilota} onChange={e => setNomePilota(e.target.value)} placeholder="es. Max Verstappen" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Team</label>
            <input type="text" value={teamPilota} onChange={e => setTeamPilota(e.target.value)} placeholder="es. Red Bull Racing" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Colore Team</label>
            <input type="color" value={colorePilota} onChange={e => setColorePilota(e.target.value)} style={{ width: '100%', height: '50px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Foto Pilota (opzionale)</label>
            <div
              style={{
                width: '100%',
                height: '50px',
                border: '2px dashed #007AFF',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: fotoPilota ? 'none' : '#f8f9fa',
                cursor: 'pointer',
                position: 'relative',
                marginBottom: '10px',
                transition: 'border-color 0.2s',
                overflow: 'hidden'
              }}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setFotoPilota(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files && e.target.files[0]) setFotoPilota(e.target.files[0]);
                }}
              />
              {fotoPilota ? (
                <img src={URL.createObjectURL(fotoPilota)} alt="Anteprima" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px', display: 'block' }} />
              ) : (
                <span style={{ color: '#007AFF', fontWeight: 600, fontSize: '18px', textAlign: 'center', width: '100%' }}>
                  Clicca o trascina qui la foto
                </span>
              )}
            </div>
          </div>
          <button onClick={aggiungiPilota} style={{ width: '100%', padding: '15px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '30px' }}>
            Aggiungi Pilota
          </button>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
            {piloti.map((p, idx) => (
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                {p.foto ? <img src={p.foto} alt="Foto" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', border: '1px solid #ccc' }} /> : <span style={{ width: 32, height: 32, display: 'inline-block', background: '#eee', borderRadius: 6, border: '1px solid #ccc', textAlign: 'center', lineHeight: '32px', color: '#bbb' }}>?</span>}
                <span style={{ fontWeight: 500 }}>{p.nome}</span> <span style={{ color: '#888' }}>({p.team})</span>
              </li>
            ))}
          </ul>
        </div>


        {piloti.length > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '18px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px' }}>
              Piloti inseriti: {piloti.length}
            </h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
              {piloti.map((p) => (
                <div key={p.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px', 
                  background: '#f8f9fa', 
                  borderRadius: '12px', 
                  marginBottom: '10px',
                  border: '1px solid #eee'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ 
                      width: '28px', 
                      height: '28px', 
                      borderRadius: '50%', 
                      background: p.colore, 
                      border: '2px solid white', 
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                    }}></div>
                    <div style={{ fontSize: '15px', color: '#333' }}>
                      <strong>{p.nome}</strong> <span style={{ opacity: 0.7, marginLeft: '5px' }}>({p.team})</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setPiloti(piloti.filter(item => item.id !== p.id))}
                    title="Rimuovi pilota"
                    style={{ 
                      background: 'none', 
                      color: 'red', 
                      border: 'none', 
                      borderRadius: '10%', 
                      width: '26px', 
                      height: '26px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '30px', 
                      fontWeight: 'bold',
                      transition: 'transform 0.1s active'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button 
          onClick={() => setStep(1)} 
          disabled={piloti.length === 0} 
          style={{ 
            width: '100%', 
            padding: '15px', 
            background: piloti.length > 0 ? '#34C759' : '#ccc', 
            color: 'white', 
            border: 'none', 
            borderRadius: '15px', 
            fontSize: '18px', 
            fontWeight: 'bold', 
            cursor: piloti.length > 0 ? 'pointer' : 'not-allowed',
            marginTop: '10px'
          }}
        >
          Avanti
        </button>
      </>
    )}
      {step === 1 && (
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '30px', textAlign: 'center' }}>Configurazione Stagione</h1>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', background: '#f0f0f0', padding: '30px', borderRadius: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'center' }}>Numero GP:</label>
              <input type="number" value={numeroGP || ''} onChange={(e) => setNumeroGP(e.target.value ? parseInt(e.target.value) : 0)} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'center' }}>Numero Sprint:</label>
              <input type="number" value={numeroSprint || ''} onChange={(e) => setNumeroSprint(e.target.value ? parseInt(e.target.value) : 0)} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' }} />
            </div>
          </div>
          <button onClick={() => setStep(2)} style={{ width: '100%', padding: '15px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>Avanti</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 style={{ fontSize: '28px', marginBottom: '20px', textAlign: 'center' }}>Inserisci il calendario dei GP</h1>
          <p style={{ textAlign: 'center', color: '#FF9500', marginBottom: '30px', fontWeight: '600' }}>
            GP inseriti: {gp.length} / {numeroGP}
          </p>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Nome GP</label>
            <input 
              type="text" 
              value={nomeGP} 
              onChange={(e) => setNomeGP(e.target.value)} 
              placeholder="es. Bahrain" 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }} 
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Tipo Weekend:</label>
            <div style={{ display: 'grid', gap: '10px' }}>
              <button onClick={() => setTipoWeekend('standard')} style={{ padding: '15px', background: tipoWeekend === 'standard' ? '#007AFF' : 'white', color: tipoWeekend === 'standard' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold' }}>🏆 Weekend Standard</div>
              </button>
              <button onClick={() => setTipoWeekend('sprintF1')} style={{ padding: '15px', background: tipoWeekend === 'sprintF1' ? '#007AFF' : 'white', color: tipoWeekend === 'sprintF1' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold' }}>⚡️ Weekend Sprint F1</div>
              </button>
              <button onClick={() => setTipoWeekend('f2')} style={{ padding: '15px', background: tipoWeekend === 'f2' ? '#007AFF' : 'white', color: tipoWeekend === 'f2' ? 'white' : '#000', border: '2px solid #007AFF', borderRadius: '10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold' }}>🏎️ Weekend Formula 2</div>
              </button>
            </div>
          </div>

          <button 
            onClick={aggiungiGP} 
            disabled={gp.length >= numeroGP || !nomeGP} 
            style={{ 
              width: '100%', 
              padding: '15px', 
              background: gp.length < numeroGP && nomeGP ? '#007AFF' : '#ccc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '15px', 
              fontSize: '18px', 
              fontWeight: 'bold', 
              cursor: gp.length < numeroGP && nomeGP ? 'pointer' : 'not-allowed', 
              marginBottom: '30px' 
            }}
          >
            Aggiungi GP
          </button>

          {gp.length > 0 && (
            <div style={{ marginBottom: '25px' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '16px', color: '#666' }}>Calendario:</h3>
              <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '5px' }}>
                {gp.map((g, idx) => (
                  <div key={g.id} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '12px', 
                    background: '#f8f9fa', 
                    borderRadius: '10px', 
                    marginBottom: '8px',
                    border: '1px solid #eee'
                  }}>
                    <div style={{ fontSize: '15px' }}>
                      <strong style={{ color: '#007AFF', marginRight: '8px' }}>{idx + 1}.</strong> 
                      {g.nome} {g.tipo_weekend === 'sprintF1' ? '⚡️' : g.tipo_weekend === 'f2' ? '🏎️' : '🏆'}
                    </div>

                    <button 
                      onClick={() => setGp(gp.filter(item => item.id !== g.id))}
                      style={{ 
                        background: 'none', color: 'red', border: 'none', borderRadius: '10%', 
                        width: '26px', height: '26px', cursor: 'pointer', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', fontSize: '30px', fontWeight: 'bold'
                      }}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={confermaESalva} 
            disabled={gp.length < numeroGP} 
            style={{ 
              width: '100%', 
              padding: '15px', 
              background: gp.length === numeroGP ? '#34C759' : '#ccc', 
              color: 'white', 
              border: 'none', 
              borderRadius: '15px', 
              fontSize: '18px', 
              fontWeight: 'bold', 
              cursor: gp.length === numeroGP ? 'pointer' : 'not-allowed' 
            }}
          >
            Conferma e continua
          </button>
        </div>
      )}
    </div>
  );
}

// ===== MENU CLASSIFICHE =====
function ClassificheMenuView({ user, isMobile, onBack, onOpenClassifica }) {
    // ...existing code...
  const [classifiche, setClassifiche] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAltreClassifiche, setShowAltreClassifiche] = useState(false)
  const [modalitaElimina, setModalitaElimina] = useState(false)
  const [showNuova, setShowNuova] = useState(false)

  const isAdmin = user.ruolo === 'admin'

  useEffect(() => {
    document.title = "FWM - Classifiche"
  }, [])

  useEffect(() => { caricaClassifiche() }, [])

  const caricaClassifiche = async () => {
    try {
      // Carica sia classifiche standard che custom
      const { data: standard, error: err1 } = await supabase.from('classifiche').select('*').order('nome')
      const { data: custom, error: err2 } = await supabase.from('classifiche_custom').select('*').order('nome')
      let tutte = []
      if (!err1 && Array.isArray(standard)) tutte = tutte.concat(standard)
      if (!err2 && Array.isArray(custom)) tutte = tutte.concat(custom.map(c => ({ ...c, isCustom: true })))
      setClassifiche(tutte)
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const eliminaClassifica = async (id) => {
    if (!confirm('Eliminare questa classifica? Questa azione non può essere annullata.')) return;
    // Recupera la classifica (standard o custom) per trovare le foto dei piloti
    let classifica = classifiche.find(c => c.id === id);
    if (!classifica) {
      // Prova a caricare da Supabase se non trovata localmente
      let { data } = await supabase.from('classifiche').select('*').eq('id', id);
      if (!data || data.length === 0) {
        let res = await supabase.from('classifiche_custom').select('*').eq('id', id);
        data = res.data && res.data.length > 0 ? res.data : null;
      }
      classifica = data && data.length > 0 ? data[0] : null;
    }
    // Cancella tutte le foto dei piloti dal bucket se presenti
    if (classifica && Array.isArray(classifica.piloti)) {
      for (const pilota of classifica.piloti) {
        if (pilota.foto && typeof pilota.foto === 'string') {
          // Estrai il path relativo dal publicUrl
          const match = pilota.foto.match(/loghi-piloti\/(.+)$/);
          if (match && match[1]) {
            await supabase.storage.from('loghi-piloti').remove([`piloti/${match[1]}`]);
          }
        }
      }
    }
    // Prova a eliminare sia da classifiche che da classifiche_custom
    const { error: errorStandard } = await supabase.from('classifiche').delete().eq('id', id);
    const { error: errorCustom } = await supabase.from('classifiche_custom').delete().eq('id', id);
    if (!errorStandard && !errorCustom) {
      setClassifiche(classifiche.filter(c => c.id !== id));
      setModalitaElimina(false);
      alert('✅ Classifica eliminata con successo!');
    } else if (!errorStandard && errorCustom) {
      setClassifiche(classifiche.filter(c => c.id !== id));
      setModalitaElimina(false);
      alert('✅ Classifica standard eliminata! (custom non trovata)');
    } else if (errorStandard && !errorCustom) {
      setClassifiche(classifiche.filter(c => c.id !== id));
      setModalitaElimina(false);
      alert('✅ Classifica custom eliminata! (standard non trovata)');
    } else {
      alert('❌ Errore durante l\'eliminazione');
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Caricamento...</div>

  // ...existing code...
  const formula1 = classifiche.find(c => c.nome === "Formula 1");
  const formulaE = classifiche.find(c => c.nome === "Formula E");

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '20px' : '40px' }}>
      <div style={{ position: 'absolute', top: isMobile ? '85px' : '20px', left: isMobile ? '10px' : '20px', right: isMobile ? '10px' : '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#007AFF', fontSize: isMobile ? '16px' : '18px', fontWeight: 'bold', cursor: 'pointer', minHeight: isMobile ? '44px' : 'auto', padding: isMobile ? '8px 0' : '0' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          Indietro
        </button>
        {isAdmin && (
          <button
            onClick={() => {
              if (modalitaElimina) {
                setModalitaElimina(false);
                setShowAltreClassifiche(false);
              } else {
                setShowAltreClassifiche(true);
                setModalitaElimina(true);
              }
            }}
            style={{
              width: isMobile ? '44px' : '48px',
              height: isMobile ? '44px' : '48px',
              borderRadius: "50%",
              border: "none",
              background: modalitaElimina ? "#34C759" : "#FF3B30",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
            }}
          >
            {modalitaElimina ? (
              <svg viewBox="0 0 24 24" width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} fill="white">
                <path d="M9 16.2l-3.5-3.5 1.4-1.4L9 13.4l8.1-8.1 1.4 1.4z" />
              </svg>
            ) : (
              <img
                src={CestinoSVG}
                alt="Cestino"
                style={{
                  width: isMobile ? "20px" : "24px",
                  height: isMobile ? "20px" : "24px",
                  filter: "brightness(0) invert(1)"
                }}
              />
            )}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '40px' }}>
          {formula1 && <button onClick={() => onOpenClassifica(formula1.id)} style={{ width: '250px', height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>Formula 1</button>}
          {formulaE && <button onClick={() => onOpenClassifica(formulaE.id)} style={{ width: '250px', height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>Formula E</button>}
        </div>
        <button onClick={() => setShowAltreClassifiche(!showAltreClassifiche)} style={{ width: '250px', height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
          {showAltreClassifiche ? 'Chiudi Altre Classifiche' : 'Altre Classifiche'}
        </button>
        {showAltreClassifiche && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '540px' }}>
            {classifiche.filter(c => c.nome !== "Formula 1" && c.nome !== "Formula E").map((c, idx) => (
              <div key={typeof c.id === 'object' ? JSON.stringify(c.id) : c.id || idx} style={{ display: 'flex', gap: '10px' }}>
                {modalitaElimina && <button onClick={() => eliminaClassifica(c.id)} style={{ width: '40px', height: '40px', borderRadius: '50%', border: 'none', background: '#FF3B30', color: 'white', fontSize: '24px', cursor: 'pointer' }}>−</button>}
                <button onClick={() => !modalitaElimina && onOpenClassifica(c.id)} style={{ flex: 1, height: '80px', background: '#007AFF', color: 'white', border: 'none', borderRadius: '25px', fontSize: '24px', fontWeight: 'bold', cursor: modalitaElimina ? 'default' : 'pointer', opacity: modalitaElimina ? 0.6 : 1, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>{c.nome}</button>
              </div>
            ))}
           <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '30px 0' }}>
  {isAdmin && !modalitaElimina && (
    <button
      onClick={() => setShowNuova(true)}
      style={{
        width: '320px',
        height: '90px',
        background: '#34C759',
        color: 'white',
        border: 'none',
        borderRadius: '30px',
        fontSize: '28px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
        textAlign: 'center',
        margin: '0 auto'
      }}
    >
      Nuova Classifica Personalizzata
    </button>
  )}
</div>

          </div>
        )}
      </div>
      {showNuova && <NuovaClassificaModal onClose={() => setShowNuova(false)} onSave={() => { caricaClassifiche(); setShowNuova(false) }} />}
    </div>
  )
}

function NuovaClassificaModal({ onClose, onSave }) {
  const [nome, setNome] = useState('')
  const handleSave = async (e) => {
    e.preventDefault()
    if (!nome.trim()) return
    const { error } = await supabase.from('classifiche_custom').insert([{ nome, piloti: [], gp: [], costruttori: [] }])
    if (!error) onSave()
  }
  return (
    <div className="modal-container">
      <div className="modal-card" style={{ width: '450px' }}>
        <div className="modal-header">
          <h2>Crea nuova classifica</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome classifica</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="form-input" placeholder="Es: Moto GP, Indycar..." required autoFocus />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/// ===== HOME VIEW =====
function HomeView({ user, isMobile, onLogout, onOpenGestione, onOpenClassificheMainMenu, onOpenRitaglio, onOpenCalendario, onOpenDisponibilita, onOpenVidaMenu, onOpenEventiMobile, notificheNonLetteCalendario, notificheNonLetteDisponibilita, onOpenPannelloFonti, onOpenNuovaSchermata }) {
  const [prossimoEvento, setProssimoEvento] = useState(null)
  
  useEffect(() => {
    if (isMobile) {
      caricaProssimoEvento()
    }
  }, [isMobile])
  
  async function caricaProssimoEvento() {
    try {
      const { data: eventi, error } = await supabase
        .from('eventi_calendario')
        .select('*')
        .order('data_inizio')
        .order('orario', { nullsFirst: false })
      
      if (!eventi || eventi.length === 0) {
        setProssimoEvento(null)
        return
      }
      
      const oggi = new Date()
      oggi.setHours(0, 0, 0, 0)
      
      const eventiFuturi = eventi.filter(evento => {
        const dataEvento = new Date(evento.data_inizio)
        return dataEvento >= oggi
      })
      
      if (eventiFuturi.length === 0) {
        setProssimoEvento(null)
        return
      }
      
      // Ordina per data e poi per orario
      const eventiOrdinati = eventiFuturi.sort((a, b) => {
        const dataA = new Date(a.data_inizio)
        const dataB = new Date(b.data_inizio)
        if (dataA.getTime() !== dataB.getTime()) {
          return dataA.getTime() - dataB.getTime()
        }
        // Se stessa data, ordina per orario
        if (!a.orario && !b.orario) return 0
        if (!a.orario) return 1
        if (!b.orario) return -1
        return a.orario.localeCompare(b.orario)
      })
      
      const prossimo = eventiOrdinati[0]
      const dataProssimo = new Date(prossimo.data_inizio)
      oggi.setHours(0, 0, 0, 0)
      dataProssimo.setHours(0, 0, 0, 0)
      const giorniMancanti = Math.floor((dataProssimo.getTime() - oggi.getTime()) / (1000 * 60 * 60 * 24))
      
      setProssimoEvento({
        ...prossimo,
        giorniMancanti
      })
      
    } catch (error) {
      console.error('Errore:', error)
      setProssimoEvento(null)
    }
  }
  
  useEffect(() => {
    document.title = "FWM Software - Home"
  }, [])
  
  return (
    <div className="home-container">
      <div className="home-header">
        <div className="header-left">
          {user.ruolo === 'admin' && (
            <button className="btn-header" onClick={onOpenGestione}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
              </svg>
              Gestione
            </button>
          )}
        </div>
        <div className="header-right">
          <button className="btn-header" onClick={onLogout}>
            {user.nome_completo}
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </button>
          {isMobile && (
            <button className="btn-header" onClick={onOpenEventiMobile}>
              {prossimoEvento ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px' }}>▼</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', opacity: 0.8, whiteSpace: 'nowrap' }}>
                      {prossimoEvento.giorniMancanti === 0 ? 'OGGI!' : 
                       prossimoEvento.giorniMancanti === 1 ? 'DOMANI!' : 
                       `Tra ${prossimoEvento.giorniMancanti} giorni`}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>
                      {prossimoEvento.titolo}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px' }}>▼</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px' }}>▼</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', whiteSpace: 'nowrap' }}>
                    📅 Eventi
                  </div>
                  <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '12px' }}>▼</span>
                  </div>
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="home-title" style={{ marginTop: (isMobile ? '30px' : '0px') }}>
        <h1 className="title-main">FWM Software</h1>
      </div>

      <div className="home-cards-wrapper" style={{ marginTop: isMobile ? '20px' : undefined }}>
        {/* RIGA 1 - Classifiche + Ritaglio */}
        <div className="home-cards-row">
          <div className="home-card card-blue" onClick={onOpenClassificheMainMenu} style={{ cursor: 'pointer' }}>
            <div className="card-icon-wrapper">
              <img
                src={StatistichePNG}
                alt="Statistiche"
                style={{ width: "80px", height: "60px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">CLASSIFICHE E STATISTICHE</h3>
          </div>

          <div className="home-card card-green" onClick={onOpenRitaglio} style={{ cursor: 'pointer' }}>
            <div className="card-icon-wrapper">
              <img
                src={FotoSVG}
                alt="Foto"
                style={{ width: "60px", height: "50px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">EDITOR FOTO</h3>
            <p className="card-subtitle">Editor proprietario FWM<br />per modifica foto</p>
          </div>
        </div>

        {/* RIGA 2 - Disponibilità + Calendario */}
        <div className="home-cards-row">
          <div className="home-card card-purple" onClick={() => onOpenDisponibilita(null)} style={{ cursor: 'pointer', position: 'relative' }}>
            {notificheNonLetteDisponibilita > 0 && (
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#FF3B30',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(255,59,48,0.4)',
                zIndex: 10
              }}>
                {notificheNonLetteDisponibilita}
              </div>
            )}
            <div className="card-icon-wrapper">
              <img
                src={DisponibilitàSVG}
                alt="Disponibilità"
                style={{ width: "70px", height: "60px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">DISPONIBILITÀ WEEKEND</h3>
            <p className="card-subtitle">Segna la tua disponibilità per il weekend</p>
          </div>

          <div className="home-card card-yellow" onClick={onOpenCalendario} style={{ cursor: 'pointer', position: 'relative' }}>
            {notificheNonLetteCalendario > 0 && (
              <div style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: '#FF3B30',
                color: 'white',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(255,59,48,0.4)',
                zIndex: 10
              }}>
                {notificheNonLetteCalendario}
              </div>
            )}
            <div className="card-icon-wrapper">
              <img
                src={PressPNG}
                alt="Press"
                style={{ width: "58px", height: "60px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">CALENDARIO ACCREDITI</h3>
            <p className="card-subtitle">Calendario eventi<br />e richiesta accrediti</p>
          </div>
        </div>

        {/* RIGA 3 - Card Rosse */}
        <div className="home-cards-row">
          <div 
            className="home-card card-red" 
            onClick={() => {
              console.log('Click su VIDA card');
              onOpenVidaMenu();
            }} 
            style={{ cursor: 'pointer' }}
          >
            <div className="card-icon-wrapper">
             <img src={VidaPNG} alt="Vida Logo" style={{ width: "60px", height: "60px", filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            </div>
            <h3 className="card-title">PANNELLI VIDA</h3>
          </div>

          <div 
            className="home-card card-red" 
            onClick={onOpenPannelloFonti} 
            style={{ cursor: 'pointer' }}
          >
            <div className="card-icon-wrapper">
              <img src={VidaPNG} alt="Vida Logo" style={{ width: "60px", height: "60px", filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            </div>
            <h3 className="card-title">PANNELLO FONTI</h3>
          </div>
        </div>
      </div>

      {/* PROSSIMO EVENTO BOX */}
      <div style={{
        position: 'absolute',
        left: '1000px',
        top: '173px',
        zIndex: 10
      }}>
        <ProssimoEvento />
      </div>

      <div className="home-footer">
        <p className="version-text">Versione 2.0</p>
      </div>

      {/* FLOATING ACTION BUTTON in basso a destra */}
      <button
        onClick={onOpenNuovaSchermata}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.25)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
          zIndex: 100,
          transition: 'transform 0.2s, box-shadow 0.2s'
        }}
        title="Apri guida funzioni"
        aria-label="Apri guida funzioni"
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)'
          e.target.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.45)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)'
          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.35)'
        }}
      >
        <img
          src={InformazioniPNG}
          alt="Guida"
          style={{
            width: '100%',
            height: '100%',
            filter: 'brightness(0) saturate(100%) invert(89%) sepia(73%) saturate(1500%) hue-rotate(345deg) brightness(103%) contrast(104%)'
          }}
        />
      </button>
    </div>
  )
}

// ===== LOGIN =====
function LoginView({ username, setUsername, password, setPassword, showPassword, setShowPassword, loginError, loading, handleLogin }) {
  console.log('[DEBUG LOGIN] Render LoginView', { username, password, loginError, loading })
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="f1-icon">🏎️</div>
          <h1 className="login-title">FWM Software</h1>
          <p className="login-subtitle">Accedi al tuo account</p>
        </div>
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label"><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label"><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>Password</label>
            <div className="password-input-wrapper">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" required />
              <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
            </div>
          </div>
          {loginError && <div className="error-message">{loginError}</div>}
          <button type="submit" className="btn-login" disabled={loading}>{loading ? 'Accesso...' : 'Accedi'}</button>
        </form>
      </div>
    </div>
  )
}

function PasswordChangeView({ newPassword, setNewPassword, confirmPassword, setConfirmPassword, showNewPassword, setShowNewPassword, showConfirmPassword, setShowConfirmPassword, passwordError, handlePasswordChange }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="warning-icon">🔑</div>
          <h1 className="login-title">Cambio Password Obbligatorio</h1>
          <p className="login-subtitle">Per sicurezza, devi cambiare la password al primo accesso</p>
        </div>
        <form onSubmit={handlePasswordChange} className="login-form">
          <div className="form-group">
            <label className="form-label">Nuova Password</label>
            <div className="password-input-wrapper">
              <input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input" placeholder="Minimo 8 caratteri" required />
              <button type="button" className="toggle-password" onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? '👁️' : '👁️‍🗨️'}</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Conferma Password</label>
            <div className="password-input-wrapper">
              <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="form-input" placeholder="Ripeti la password" required />
              <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</button>
            </div>
          </div>
          {passwordError && <div className="error-message">{passwordError}</div>}
          <button type="submit" className="btn-login btn-green" disabled={newPassword.length < 8 || newPassword !== confirmPassword}>✅ Cambia e Continua</button>
        </form>
      </div>
    </div>
  )
}

// ==// ===== GESTIONE UTENTI =====
function GestioneUtentiView({ onClose, onOpenDispositiviNotifiche, currentUser }) {
  const [showImpostazioni, setShowImpostazioni] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  React.useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 768);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [utenti, setUtenti] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNuovo, setShowNuovo] = useState(false)
  const [editUtente, setEditUtente] = useState(null)
  const [showCategorie, setShowCategorie] = useState(false)
  const [showTemplateArticoli, setShowTemplateArticoli] = useState(false)
  const [showGestioneRSS, setShowGestioneRSS] = useState(false);
  const [showMonitorUrl, setShowMonitorUrl] = useState(false);
  
  // Determina se l'utente corrente è admin
  const isAdmin = utenti.some(u => u.ruolo === 'admin');

  // Handler per aprire il modal MonitorUrl
  const onOpenMonitorUrl = () => setShowMonitorUrl(true);

  useEffect(() => {
    document.title = "FWM - Gestione Utenti"
  }, [])

  useEffect(() => { caricaUtenti() }, [])

  const caricaUtenti = async () => {
    try {
      const { data, error } = await supabase.from('utenti').select('*').order('username')
      if (!error && data) setUtenti(data)
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  const cambiaRuolo = async (utente) => {
    const nuovoRuolo = utente.ruolo === 'admin' ? 'redattore' : 'admin'
    const { error } = await supabase.from('utenti').update({ ruolo: nuovoRuolo }).eq('id', utente.id)
    if (!error) caricaUtenti()
  }

  const resetPassword = async (utente) => {
    if (!confirm(`Resettare la password di ${utente.username} a quella iniziale?`)) return
    const { error } = await supabase.from('utenti').update({ password: 'FWM2025APP!?!', deve_cambiare_password: true }).eq('id', utente.id)
    if (!error) caricaUtenti()
  }

  if (showNuovo) return <NuovoUtenteView onClose={() => setShowNuovo(false)} onSave={() => { caricaUtenti(); setShowNuovo(false) }} />
  if (editUtente) return <ModificaUtenteView utente={editUtente} onClose={() => setEditUtente(null)} onSave={() => { caricaUtenti(); setEditUtente(null) }} />
  if (showCategorie) return <GestioneCategorie onClose={() => setShowCategorie(false)} />
  if (showTemplateArticoli) return <GestioneTemplateArticoli onClose={() => setShowTemplateArticoli(false)} />

  return (
    <div className="gestione-container" style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)' } : {}}>
      <div className="gestione-header">
        <button className="btn-back" onClick={onClose} style={typeof window !== 'undefined' && window.innerWidth <= 768 ? { marginTop: 40 } : { marginTop: 0 }}><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>Indietro</button>
        <h1 className="gestione-title" style={typeof window !== 'undefined' && window.innerWidth <= 768 ? { marginTop: 40 } : { marginTop: 0 }}>Gestione Utenti</h1>
        <div
          style={
            isMobile
              ? { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', width: '100%', marginTop: 8, marginBottom: 4 }
              : { display: 'flex', gap: '10px', alignItems: 'center' }
          }
        >
          {/* Bottone tondo rosso con ingranaggio */}
          <button
            style={
              isMobile
                ? {
                    width: '100%',
                    height: 44,
                    borderRadius: 8,
                    background: '#e74c3c',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                    marginBottom: 0,
                  }
                : {
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: '#e74c3c',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    cursor: 'pointer',
                  }
            }
            onClick={() => setShowImpostazioni(true)}
            title="Impostazioni"
          >
            <svg viewBox="0 0 24 24" fill="white" width="28" height="28">
              <path d="M19.14,12.94a7.07,7.07,0,0,0,0-1.88l2.11-1.65a.5.5,0,0,0,.12-.63l-2-3.46a.5.5,0,0,0-.61-.22l-2.49,1a6.93,6.93,0,0,0-1.62-.94l-.38-2.65A.5.5,0,0,0,13,2h-4a.5.5,0,0,0-.5.42l-.38,2.65a6.93,6.93,0,0,0-1.62.94l-2.49-1a.5.5,0,0,0-.61.22l-2,3.46a.5.5,0,0,0,.12.63l2.11,1.65a7.07,7.07,0,0,0,0,1.88L2.37,14.59a.5.5,0,0,0-.12.63l2,3.46a.5.5,0,0,0,.61.22l2.49-1a6.93,6.93,0,0,0,1.62.94l.38,2.65A.5.5,0,0,0,9,22h4a.5.5,0,0,0,.5-.42l.38-2.65a6.93,6.93,0,0,0,1.62-.94l2.49,1a.5.5,0,0,0,.61-.22l2-3.46a.5.5,0,0,0-.12-.63ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
            </svg>
          </button>
          {isAdmin && (
            <button className="btn-nuovo" style={{ background: '#8e44ad', marginRight: 0 }} onClick={onOpenMonitorUrl}>
              Link Web
            </button>
          )}
          {isAdmin && (
            <button className="btn-nuovo" style={{ background: '#8e44ad' }} onClick={() => setShowGestioneRSS(true)}>
              <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3A2 2 0 0 1 21 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14zm0 2H5v14h14V5zm-7 2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4zm0 6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h4z"/></svg>
              Gestisci RSS
            </button>
          )}
          {showGestioneRSS && <GestioneRSSModal onClose={() => setShowGestioneRSS(false)} />}
          <button className="btn-nuovo" style={{ background: '#007AFF' }} onClick={() => setShowCategorie(true)}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            Categorie
          </button>
          <button className="btn-nuovo" style={{ background: '#FF9500' }} onClick={() => setShowTemplateArticoli(true)}>
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            Template
          </button>
          <button className="btn-nuovo" onClick={() => setShowNuovo(true)}><svg className="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>Nuovo</button>
        </div>
      </div>
            {showImpostazioni && (
              <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.18)', padding: '32px', minWidth: 320, minHeight: 180, position: 'relative' }}>
                  <h2 style={{ marginBottom: 24 }}>Impostazioni</h2>
                  <button style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setShowImpostazioni(false)} title="Chiudi">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="12" fill="#fff"/>
                      <path d="M7 7l10 10M17 7l-10 10" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <div style={{ marginTop: 16, color: '#888', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
                    {/* Bottone DEBUG Player ID OneSignal */}
                    <button
                      style={{ background: '#FF3B30', color: 'white', border: 'none', borderRadius: 24, padding: '12px 24px', fontWeight: 'bold', fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                      onClick={async () => {
                        try {
                          if (window.OneSignal) {
                            console.log('[DEBUG ONESIGNAL] OneSignal:', window.OneSignal);
                            if (typeof window.OneSignal.getUserId === 'function') {
                              const playerId = await window.OneSignal.getUserId();
                              if (playerId) {
                                alert('Player ID OneSignal: ' + playerId);
                              } else {
                                alert('Player ID non disponibile. Probabile che l\'utente non sia ancora registrato alle notifiche.');
                              }
                            } else {
                              alert('window.OneSignal.getUserId non è una funzione. SDK non caricato correttamente.');
                            }
                          } else {
                            alert('OneSignal non inizializzato (window.OneSignal mancante)');
                          }
                        } catch (err) {
                          alert('Errore OneSignal: ' + err);
                          console.error('[DEBUG ONESIGNAL] Errore:', err);
                        }
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="white" width="24" height="24"><circle cx="12" cy="12" r="10"/><text x="12" y="16" textAnchor="middle" fontSize="10" fill="#fff">DEBUG</text></svg>
                      DEBUG Player ID OneSignal
                    </button>
                  </div>
                </div>
              </div>
            )}
      <div className="divider"></div>
      <div className="gestione-content">
        {loading ? <div className="loading">Caricamento...</div> : (
          <div className="utenti-list">
            {utenti.map(utente => (
              <div key={utente.id} className="utente-row">
                <div className="utente-info">
                  <svg className="utente-icon" viewBox="0 0 24 24" fill="#007AFF"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 3-8 5v1h16v-1c0-2-2-5-8-5z"/></svg>
                  <div>
                    <div className="utente-nome">{utente.nome_completo}</div>
                    <div className="utente-username">@{utente.username}</div>
                  </div>
                </div>
                <div className="utente-ruolo">{utente.ruolo === 'admin' ? '🔑 Admin' : '✏️ Redattore'}</div>
                <div className="utente-password">
                  {utente.deve_cambiare_password ? (
                    <><svg className="status-icon" viewBox="0 0 24 24" fill="#FF9500"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>Password da cambiare</>
                  ) : (
                    <><svg className="status-icon" viewBox="0 0 24 24" fill="#34C759"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Password impostata</>
                  )}
                </div>
                <div className="utente-actions">
                  <button className="btn-action btn-green" onClick={() => setEditUtente(utente)}><svg className="icon-small" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>Modifica</button>
                  <button className="btn-action btn-blue" onClick={() => cambiaRuolo(utente)}><svg className="icon-small" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>Cambia Ruolo</button>
                  <button className="btn-action btn-orange" onClick={() => resetPassword(utente)}><svg className="icon-small" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>Reset Password</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Modal MonitorUrl SOLO qui, non duplicato altrove */}
        {showMonitorUrl && <MonitorUrlModal userId={currentUser?.id} onClose={() => setShowMonitorUrl(false)} />}
      </div>
      
      </div>
    
  )
}

function NuovoUtenteView({ onClose, onSave }) {
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [username, setUsername] = useState('')
  const [ruolo, setRuolo] = useState('redattore')
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!nomeCompleto || !username) {
      setError('Compila tutti i campi')
      return
    }
    try {
      const { error: insertError } = await supabase.from('utenti').insert([{ nome_completo: nomeCompleto, username: username, password: 'FWM2025APP!?!', ruolo: ruolo, deve_cambiare_password: true }])
      if (insertError) {
        setError('Errore: username già esistente')
        return
      }
      onSave()
    } catch (err) {
      setError('Errore durante il salvataggio')
    }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  return (
    <div className="modal-container">
      <div className="modal-card">
        <div className="modal-header" style={isMobile ? { marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' } : { display: 'flex', alignItems: 'center', position: 'relative' }}>
          {isMobile ? (
            <button onClick={onClose} style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'none', border: 'none', color: '#007AFF', fontSize: '22px', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'none', borderRadius: 0, padding: '0 16px', display: 'flex', alignItems: 'center' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px', marginRight: 4 }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              Indietro
            </button>
          ) : null}
          <h2 style={{ flex: 1, textAlign: isMobile ? 'center' : 'left', margin: 0, marginTop: isMobile ? 40 : 0 }}>Nuovo Utente</h2>
          {!isMobile && (
            <button className="btn-close" onClick={onClose} style={{ position: 'absolute', right: '10px', top: 0, height: '100%', background: 'none', border: 'none', color: '#e53935', fontSize: '28px', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'none', borderRadius: 0, padding: '0 16px' }}>✕</button>
          )}
        </div>
        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Ruolo</label>
            <select value={ruolo} onChange={(e) => setRuolo(e.target.value)} className="form-input">
              <option value="redattore">Redattore</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModificaUtenteView({ utente, onClose, onSave }) {
  const [nomeCompleto, setNomeCompleto] = useState(utente.nome_completo)
  const [username, setUsername] = useState(utente.username)
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    if (!nomeCompleto || !username) {
      setError('Compila tutti i campi')
      return
    }
    try {
      const { error: updateError } = await supabase.from('utenti').update({ nome_completo: nomeCompleto, username: username }).eq('id', utente.id)
      if (updateError) {
        setError('Errore durante il salvataggio')
        return
      }
      onSave()
    } catch (err) {
      setError('Errore durante il salvataggio')
    }
  }

  return (
    <div className="modal-container">
      <div className="modal-card">
        <div className="modal-header">
          <h2>Modifica Utente</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSave} className="modal-form">
          <div className="form-group">
            <label className="form-label">Nome Completo</label>
            <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="form-input" required />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="form-input" required />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="btn-save">Salva</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== CLASSIFICHE MAIN MENU =====
function ClassificheMainMenuView({ user, isMobile, onBack, onOpenClassificheMenu, onOpenNuovaPagina, onOpenOrdinaTabellaClassifica }) {
    // ...existing code...
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', minHeight: '100vh' }}>
        <div style={{ position: 'absolute', top: isMobile ? '80px' : '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', zIndex: 100 }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Indietro
          </button>
        </div>
        {/* Cards row */}
        <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
          <div className="home-card card-blue" onClick={onOpenClassificheMenu} style={{ cursor: 'pointer', width: '300px' }}>
            <div className="card-icon-wrapper">
              <img src={CoppaSVG} alt="Classifiche" style={{ width: "80px", height: "60px", filter: "brightness(0) invert(1)" }} />
            </div>
            <h3 className="card-title">CLASSIFICHE</h3>
            <p className="card-subtitle">
              {user.ruolo === 'admin' ? 'Gestisci campionati\ne classifiche' : 'Visualizza\nclassifiche'}
            </p>
          </div>

          {/* DESKTOP VERSION */}
          <div className="home-card card-blue" onClick={onOpenNuovaPagina} style={{ cursor: 'pointer', width: '300px', display: !isMobile ? 'flex' : 'none' }}>
            <div className="card-icon-wrapper">
              <img
                src={PenaltypointSVG}
                alt="Penalty Points"
                style={{ width: "94px", height: "74px", filter: "brightness(0) invert(1)" }}
              />
            </div>
            <h3 className="card-title">PENALTY POINTS</h3>
            <p className="card-subtitle">Gestisci i punti<br />penalità</p>
          </div>

          {/* MOBILE VERSION */}
          <div className="home-card card-blue" onClick={onOpenNuovaPagina} style={{ cursor: 'pointer', width: '300px', display: isMobile ? 'flex' : 'none' }} onMouseEnter={() => console.log('📱 MOBILE CARD VISIBILE, isMobile=', isMobile)}>
            <div className="card-icon-wrapper" style={{ width: "150px", height: "150px" }}>
              <img
                src={PenaltypointSVG}
                alt="Penalty Points"
                style={{ width: "150px", height: "130px", filter: "brightness(0) invert(1)" }}
                onLoad={() => console.log('📱 MOBILE card renderizzata con dimensioni 150x130px, isMobile=', isMobile)}
              />
            </div>
            <h3 className="card-title">PENALTY POINTS</h3>
            <p className="card-subtitle">Gestisci i punti<br />penalità</p>
          </div>
        </div>

        {/* Cards row 2 - Ordina Tabella centrata */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="home-card card-blue" onClick={() => onOpenOrdinaTabellaClassifica()} style={{ cursor: 'pointer', width: isMobile ? '296px' : '300px', minWidth: isMobile ? '296px' : '300px' }}>
            <div className="card-icon-wrapper">
              <span style={{ fontSize: '48px', lineHeight: 1 }}>🏁</span>
            </div>
            <h3 className="card-title">ORDINA TABELLA</h3>
            <p className="card-subtitle">Ordina tabelle<br />classifiche HTML</p>
          </div>
        </div>
      </div>
    )
  console.log('📱 ClassificheMainMenuView - isMobile ricevuto:', isMobile)
  const backBtnTop = isMobile ? 40 : 20;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', minHeight: '100vh' }}>
      {/* Cards row */}
      <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' }}>
        <div className="home-card card-blue" onClick={onOpenClassificheMenu} style={{ cursor: 'pointer', width: '300px' }}>
          <div className="card-icon-wrapper">
            <img src={CoppaSVG} alt="Classifiche" style={{ width: "80px", height: "60px", filter: "brightness(0) invert(1)" }} />
          </div>
          <h3 className="card-title">CLASSIFICHE</h3>
          <p className="card-subtitle">
            {user.ruolo === 'admin' ? 'Gestisci campionati\ne classifiche' : 'Visualizza\nclassifiche'}
          </p>
        </div>

        {/* DESKTOP VERSION */}
        <div className="home-card card-blue" onClick={onOpenNuovaPagina} style={{ cursor: 'pointer', width: '300px', display: !isMobile ? 'flex' : 'none' }}>
          <div className="card-icon-wrapper">
            <img
              src={PenaltypointSVG}
              alt="Penalty Points"
              style={{ width: "94px", height: "74px", filter: "brightness(0) invert(1)" }}
            />
          </div>
          <h3 className="card-title">PENALTY POINTS</h3>
          <p className="card-subtitle">Gestisci i punti<br />penalità</p>
        </div>

        {/* MOBILE VERSION */}
        <div className="home-card card-blue" onClick={onOpenNuovaPagina} style={{ cursor: 'pointer', width: '300px', display: isMobile ? 'flex' : 'none' }} onMouseEnter={() => console.log('📱 MOBILE CARD VISIBILE, isMobile=', isMobile)}>
          <div className="card-icon-wrapper" style={{ width: "150px", height: "150px" }}>
            <img
              src={PenaltypointSVG}
              alt="Penalty Points"
              style={{ width: "150px", height: "130px", filter: "brightness(0) invert(1)" }}
              onLoad={() => console.log('📱 MOBILE card renderizzata con dimensioni 150x130px, isMobile=', isMobile)}
            />
          </div>
          <h3 className="card-title">PENALTY POINTS</h3>
          <p className="card-subtitle">Gestisci i punti<br />penalità</p>
        </div>
      </div>

      {/* Cards row 2 - Ordina Tabella centrata */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="home-card card-blue" onClick={() => onOpenOrdinaTabellaClassifica()} style={{ cursor: 'pointer', width: isMobile ? '296px' : '300px', minWidth: isMobile ? '296px' : '300px' }}>
          <div className="card-icon-wrapper">
            <span style={{ fontSize: '48px', lineHeight: 1 }}>🏁</span>
          </div>
          <h3 className="card-title">ORDINA TABELLA</h3>
          <p className="card-subtitle">Ordina tabelle<br />classifiche HTML</p>
        </div>
      </div>
    </div>
  )
}

// ===== PENALTY POINTS VIEW =====
function NuovaPaginaView({ onClose, user, isMobile }) {
      // Recupera user da sessionStorage se non passato come prop
      let userLocal = user;
      if (!userLocal) {
        try {
          const userStr = sessionStorage.getItem('user');
          if (userStr) userLocal = JSON.parse(userStr);
        } catch (e) { userLocal = null; }
      }
      console.log('[DEBUG PENALTY MAIN VIEW]', { user, userLocal });
    // Funzione per eliminare un'infrazione
    const eliminaInfrazione = async (infrazioneId, pilotaId, campionatoId) => {
      if (!window.confirm('Sei sicuro di voler eliminare questa infrazione?')) return;
      try {
        await supabase.from('infrazioni').delete().eq('id', infrazioneId);
        // Aggiorna lo stato locale
        const key = `${campionatoId}_${pilotaId}`;
        setPenaltyDetails(prev => {
          const updated = { ...prev };
          if (updated[key]) {
            updated[key] = updated[key].filter(i => i.id !== infrazioneId);
          }
          return updated;
        });
      } catch (e) {
        alert('Errore durante la cancellazione!');
      }
    };
  const [campionati, setCampionati] = useState([])
  const [loading, setLoading] = useState(true)
  const [campionatoSelezionato, setCampionatoSelezionato] = useState(null)
  const [pilotaSelezionato, setPilotaSelezionato] = useState(null)
  const [penaltyDetails, setPenaltyDetails] = useState({})
  const [showAggiungiMenu, setShowAggiungiMenu] = useState(false)
  const [showCreaZero, setShowCreaZero] = useState(false)
  const [showImportaClassifica, setShowImportaClassifica] = useState(false)
  const [classificheDisponibili, setClassificheDisponibili] = useState([])
  const [nuovoCampionatoForm, setNuovoCampionatoForm] = useState({ nome: '', piloti: [] })
  const [nuovoPilota, setNuovoPilota] = useState({ nome: '', numero: '' })
  const [showAggiungiInfrazione, setShowAggiungiInfrazione] = useState(false)
  const [nuovaInfrazione, setNuovaInfrazione] = useState({ punti: 1, motivo: '', dataInfrazione: '', pilotaId: null })
  const [pilotaInInserimento, setPilotaInInserimento] = useState(null)

  useEffect(() => {
    caricaCampionati()
  }, [])

  const caricaCampionati = async () => {
    try {
      const { data, error } = await supabase.from('classifiche').select('*')
      if (!error && data) {
        setCampionati(data)
        
        // Carica infrazioni dalla tabella infrazioni
        const { data: infrazioni, error: infError } = await supabase.from('infrazioni').select('*')
        
        if (!infError && infrazioni) {
          const details = {}
          infrazioni.forEach(infrazione => {
            const key = `${infrazione.campionato_id}_${infrazione.pilota_id}`
            if (!details[key]) {
              details[key] = []
            }
            details[key].push({
              id: infrazione.id,
              points: infrazione.punti,
              reason: infrazione.motivo,
              dateAdded: infrazione.data_infrazione,
              expiryDate: infrazione.data_scadenza,
              gpBan: ''
            })
          })
          setPenaltyDetails(details)
        }
      }
      setLoading(false)
    } catch (err) {
      console.error('Errore caricamento campionati:', err)
      setLoading(false)
    }
  }

  const caricaClassificheDisponibili = async () => {
    try {
      const { data, error } = await supabase.from('classifiche').select('*')
      if (!error && data) {
        setClassificheDisponibili(data)
        setShowImportaClassifica(true)
      }
    } catch (err) {
      console.error('Errore caricamento classifiche:', err)
    }
  }

  const importaCampionato = (classifica) => {
    const nuovoCampionato = {
      id: classifica.id,
      nome: classifica.nome,
      piloti: classifica.piloti || [],
      costruttori: classifica.costruttori || [],
      gp: classifica.gp || []
    }
    
    if (campionati.find(c => c.id === classifica.id)) {
      alert('✅ Questo campionato è già presente!')
      setShowImportaClassifica(false)
      setShowAggiungiMenu(false)
      return
    }
    
    setCampionati([...campionati, nuovoCampionato])
    setShowImportaClassifica(false)
    setShowAggiungiMenu(false)
    alert(`✅ Campionato "${nuovoCampionato.nome}" importato con successo!`)
  }

  const aggiungiInfrazione = async () => {
    if (!nuovaInfrazione.motivo.trim()) {
      alert('❌ Inserisci il motivo dell\'infrazione')
      return
    }

    const totalPuntiDopo = getTotalPenaltyPoints(pilotaSelezionato.id) + parseInt(nuovaInfrazione.punti)
    if (totalPuntiDopo > 12 && !nuovaInfrazione.gpBan) {
      alert('❌ Inserisci il GP per cui il pilota è bannato')
      return
    }

    const dataOggi = new Date()
    const dataScadenza = new Date(dataOggi.getFullYear() + 1, dataOggi.getMonth(), dataOggi.getDate())

    // Prepara oggetto per il DB
    const infrazioneDB = {
      campionato_id: campionatoSelezionato.id,
      pilota_id: pilotaSelezionato.id,
      punti: parseInt(nuovaInfrazione.punti),
      motivo: nuovaInfrazione.motivo,
      data_infrazione: dataOggi.toISOString().split('T')[0],
      data_scadenza: dataScadenza.toISOString().split('T')[0]
    }


    // Inserisci su Supabase
    const { data, error } = await supabase.from('infrazioni').insert([infrazioneDB])
    if (error) {
      alert('❌ Errore nel salvataggio su Supabase')
      return
    }

    // Invio notifica push automatica tramite OneSignal
    console.log('[PenaltyPoints] PREPARO invio notifica push penalty:', {
      pilota: pilotaSelezionato?.nome,
      punti: infrazioneDB?.punti,
      motivo: infrazioneDB?.motivo,
      campionato_id: campionatoSelezionato?.id,
      pilota_id: pilotaSelezionato?.id
    });
    import('./src/pushNotifications.js').then(async ({ inviaNotificaPush }) => {
      try {
        console.log('[PenaltyPoints] CHIAMO inviaNotificaPush', {
          titolo: 'Nuova penalità',
          messaggio: `Il pilota ${pilotaSelezionato?.nome} ha ricevuto ${infrazioneDB?.punti} punto/i per: ${infrazioneDB?.motivo}`,
          tipo: 'infrazione',
          url: window.location.origin,
          data: {
            pilota_id: pilotaSelezionato?.id,
            campionato_id: campionatoSelezionato?.id,
            motivo: infrazioneDB?.motivo,
            punti: infrazioneDB?.punti
          }
        });
        const res = await inviaNotificaPush({
          titolo: 'Nuova penalità',
          messaggio: `Il pilota ${pilotaSelezionato?.nome} ha ricevuto ${infrazioneDB?.punti} punto/i per: ${infrazioneDB?.motivo}`,
          tipo: 'infrazione',
          url: window.location.origin,
          data: {
            pilota_id: pilotaSelezionato?.id,
            campionato_id: campionatoSelezionato?.id,
            motivo: infrazioneDB?.motivo,
            punti: infrazioneDB?.punti
          }
        });
        console.log('[PenaltyPoints] RISPOSTA inviaNotificaPush:', res);
        if (res.success) {
          console.log('[PenaltyPoints] Notifica push inviata con successo:', res);
          alert('✅ Notifica penalty points inviata!');
        } else {
          console.error('[PenaltyPoints] Errore invio notifica push:', res.error);
          alert('❌ Errore invio notifica push penalty points: ' + (res.error?.errors?.[0] || res.error));
        }
      } catch (err) {
        console.error('[PenaltyPoints] ERRORE invio notifica push (catch):', err);
        alert('❌ Errore invio notifica push penalty points: ' + err.message);
      }
    });

    // Aggiorna stato locale solo se il DB va a buon fine
    const infrazione = {
      ...infrazioneDB,
      id: `infrazione_${Date.now()}`,
      points: infrazioneDB.punti,
      reason: infrazioneDB.motivo,
      dateAdded: infrazioneDB.data_infrazione,
      expiryDate: infrazioneDB.data_scadenza,
      gpBan: infrazioneDB.gp_ban
    }
    const pilotaId = pilotaSelezionato.id
    const infrazioniPilota = penaltyDetails[`${campionatoSelezionato.id}_${pilotaId}`] || []
    setPenaltyDetails({
      ...penaltyDetails,
      [`${campionatoSelezionato.id}_${pilotaId}`]: [...infrazioniPilota, infrazione]
    })

    setNuovaInfrazione({ punti: 1, motivo: '', gpBan: '' })
    setShowAggiungiInfrazione(false)
  }

  const rimuoviInfrazione = async (infractionId) => {
    try {
      // Cancella da Supabase
      const { error } = await supabase
        .from('infrazioni')
        .delete()
        .eq('id', infractionId)
      
      if (!error) {
        // Aggiorna lo stato locale
        const pilotaId = pilotaSelezionato.id
        setPenaltyDetails({
          ...penaltyDetails,
          [`${campionatoSelezionato.id}_${pilotaId}`]: penaltyDetails[`${campionatoSelezionato.id}_${pilotaId}`].filter(i => i.id !== infractionId)
        })
      } else {
        alert('Errore nella cancellazione')
      }
    } catch (err) {
      console.error('Errore cancellazione infrazione:', err)
      alert('Errore nella cancellazione')
    }
  }

  const salvaInfrazioniDatabase = async () => {
    try {
      const { error } = await supabase
        .from('classifiche')
        .update({ penalty_points: penaltyDetails })
        .eq('id', campionatoSelezionato.id)
      
      if (!error) {
        alert('✅ Infrazioni salvate con successo!')
      } else {
        alert('❌ Errore nel salvataggio')
      }
    } catch (err) {
      console.error('Errore salvataggio infrazioni:', err)
      alert('❌ Errore nel salvataggio')
    }
  }

  const getTotalPenaltyPoints = (pilotaId) => {
    const infrazioni = penaltyDetails[`${campionatoSelezionato.id}_${pilotaId}`] || []
    return infrazioni.reduce((sum, inf) => sum + inf.points, 0)
  }

  const aggiungiPilotaForm = () => {
    if (!nuovoPilota.nome.trim()) {
      alert('❌ Inserisci il nome del pilota')
      return
    }
    
    const pilota = {
      id: `pilota_${Date.now()}`,
      nome: nuovoPilota.nome,
      numero: nuovoPilota.numero || 0,
      punti: 0,
      attivo: true
    }
    
    setNuovoCampionatoForm({
      ...nuovoCampionatoForm,
      piloti: [...nuovoCampionatoForm.piloti, pilota]
    })
    setNuovoPilota({ nome: '', numero: '' })
  }

  const rimuoviPilotaForm = (pilotaId) => {
    setNuovoCampionatoForm({
      ...nuovoCampionatoForm,
      piloti: nuovoCampionatoForm.piloti.filter(p => p.id !== pilotaId)
    })
  }

  const salvaCampionatoNuovo = async () => {
    if (!nuovoCampionatoForm.nome.trim()) {
      alert('❌ Inserisci il nome del campionato')
      return
    }
    // Protezione: vieta nomi "Formula 1" o "Formula E"
    const nomeLower = nuovoCampionatoForm.nome.trim().toLowerCase()
    if (nomeLower === 'formula 1' || nomeLower === 'formula e') {
      alert('❌ Non puoi creare una classifica con nome "Formula 1" o "Formula E". Queste sono riservate!')
      return
    }
    if (nuovoCampionatoForm.piloti.length === 0) {
      alert('❌ Aggiungi almeno un pilota')
      return
    }

    const nuovoCampionato = {
      nome: nuovoCampionatoForm.nome,
      piloti: nuovoCampionatoForm.piloti,
      costruttori: [],
      gp: [],
      is_f1_or_fe: null
    }

    try {
      console.log('[DEBUG] Provo a salvare nuovo campionato su classifiche_custom:', nuovoCampionato)
      const { data, error } = await supabase.from('classifiche_custom').insert([nuovoCampionato])
      if (error) {
        console.error('[DEBUG] Errore salvataggio campionato:', error)
        alert('❌ Errore nel salvataggio su Supabase: ' + (error.message || error.details || error))
        return
      }
      alert(`✅ Campionato "${nuovoCampionato.nome}" creato con successo!`)
      setNuovoCampionatoForm({ nome: '', piloti: [] })
      setShowCreaZero(false)
      setShowAggiungiMenu(false)
      // Ricarica la lista campionati per aggiornare la UI
      caricaCampionati()
    } catch (err) {
      console.error('[DEBUG] Errore imprevisto nel salvataggio:', err)
      alert('❌ Errore imprevisto nel salvataggio: ' + err.message)
    }
  }

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Caricamento campionati...</div>
  }

  // MODALE MENU AGGIUNGI
  if (showAggiungiMenu) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 1000 }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '40px', maxWidth: '500px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
          <button
            onClick={() => setShowAggiungiMenu(false)}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#FF3B30',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            ✕
          </button>
          <h2 style={{ margin: '0 0 30px 0', color: '#333', textAlign: 'center' }}>Aggiungi Campionato</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <button
              onClick={() => { setShowAggiungiMenu(false); setShowCreaZero(true) }}
              style={{
                padding: '20px',
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#0051D5'}
              onMouseOut={(e) => e.target.style.background = '#007AFF'}
            >
              Crea Campionato
            </button>

            <button
              onClick={() => { setShowAggiungiMenu(false); caricaClassificheDisponibili() }}
              style={{
                padding: '20px',
                background: '#34C759',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#30B050'}
              onMouseOut={(e) => e.target.style.background = '#34C759'}
            >
              Importa da Classifica
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MODALE CREA DA ZERO
  if (showCreaZero) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto', zIndex: 999 }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', position: 'relative' }}>
          <button onClick={() => setShowCreaZero(false)} style={{ position: 'absolute', top: window.innerWidth < 768 ? '32px' : '30px', left: '20px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', color: '#007AFF', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Indietro
          </button>
          <button onClick={salvaCampionatoNuovo} style={{ position: 'absolute', top: '20px', right: '20px', background: '#34C759', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
            Salva
          </button>
          <h2 style={{ color: '#333', margin: window.innerWidth < 768 ? '-8px 0 30px 0' : '-5px 0 30px 0', textAlign: 'center', paddingTop: window.innerWidth < 768 ? '0px' : '0px' }}>
            {window.innerWidth < 768 ? (
              <>Crea<br />Campionato</>
            ) : (
              <>Crea Campionato</>
            )}
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '500' }}>Nome Campionato</label>
            <input
              type="text"
              value={nuovoCampionatoForm.nome}
              onChange={(e) => setNuovoCampionatoForm({ ...nuovoCampionatoForm, nome: e.target.value })}
              placeholder="Es. Formula 1 2024"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <h3 style={{ color: '#333', marginTop: '10px', marginBottom: '10px', textAlign: 'center' }}>Piloti</h3>

          <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '10px', marginBottom: '10px' }}>
            <input
              type="text"
              value={nuovoPilota.nome}
              onChange={(e) => setNuovoPilota({ ...nuovoPilota, nome: e.target.value })}
              placeholder="Nome pilota"
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '8px',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={aggiungiPilotaForm}
              style={{
                width: '100%',
                padding: '10px',
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Aggiungi Pilota
            </button>
          </div>

          {nuovoCampionatoForm.piloti.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
              {nuovoCampionatoForm.piloti.map(pilota => (
                <div key={pilota.id} style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{pilota.nome}</div>
                  </div>
                  <button onClick={() => rimuoviPilotaForm(pilota.id)} style={{ background: 'none', border: 'none', color: '#FF3B30', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // MODALE IMPORTA DA CLASSIFICA
  if (showImportaClassifica) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 998 }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
          <button onClick={() => setShowImportaClassifica(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', color: '#007AFF', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Indietro
          </button>

          <h2 style={{ color: '#333', marginBottom: '20px' }}>Seleziona Classifica</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {classificheDisponibili.map(classifica => (
              <button
                key={classifica.id}
                onClick={() => importaCampionato(classifica)}
                style={{
                  padding: '15px',
                  background: '#f0f0f0',
                  border: '2px solid #e0e0e0',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#333',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.target.style.background = '#007AFF'; e.target.style.color = 'white' }}
                onMouseOut={(e) => { e.target.style.background = '#f0f0f0'; e.target.style.color = '#333' }}
              >
                {classifica.nome}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // MODALE AGGIUNGI INFRAZIONE
  if (showAggiungiInfrazione && campionatoSelezionato) {
    // PATCH: usa pilotaSelezionato, nessuna select pilota
    const calculateExpiryDate = (dataInfrazione) => {
      if (!dataInfrazione) return ''
      const date = new Date(dataInfrazione)
      date.setFullYear(date.getFullYear() + 1)
      return date.toISOString().split('T')[0]
    }

    const handleSalvaInfrazione = async () => {
      try {
        if (!nuovaInfrazione.motivo || !nuovaInfrazione.dataInfrazione) {
          alert('Compila tutti i campi');
          return;
        }

        const expiryDate = calculateExpiryDate(nuovaInfrazione.dataInfrazione);
        // Prepara oggetto per il DB
        const infrazioneDB = {
          campionato_id: campionatoSelezionato.id,
          pilota_id: pilotaSelezionato.id,
          punti: parseInt(nuovaInfrazione.punti),
          motivo: nuovaInfrazione.motivo,
          data_infrazione: nuovaInfrazione.dataInfrazione,
          data_scadenza: expiryDate
        };

        // Salva su Supabase
        const { data, error } = await supabase.from('infrazioni').insert([infrazioneDB]);
        if (error) {
          alert('❌ Errore nel salvataggio su Supabase');
          return;
        }

        // Invio notifica push automatica penalty points
        import('./src/pushNotifications.js').then(async ({ inviaNotificaPush }) => {
          try {
            const categoriaNome = campionatoSelezionato?.nome || 'Categoria';
            const piloti = campionatoSelezionato?.piloti || [];
            const notifica = (await import('./notificationTemplates.js')).getPenaltyNotification({
              punti: infrazioneDB.punti,
              pilotaId: pilotaSelezionato.id,
              piloti,
              categoriaNome,
              motivo: infrazioneDB.motivo
            });
            if (notifica) {
              const res = await inviaNotificaPush({
                titolo: notifica.titolo,
                messaggio: notifica.messaggio,
                tipo: notifica.tipo,
                url: window.location.origin,
                data: {
                  pilota_id: pilotaSelezionato.id,
                  campionato_id: campionatoSelezionato.id,
                  motivo: infrazioneDB.motivo,
                  punti: infrazioneDB.punti
                }
              });
              if (res.success) {
                alert('✅ Notifica penalty points inviata!');
              } else {
                alert('❌ Errore invio notifica push penalty points: ' + (res.error?.errors?.[0] || res.error));
              }
            }
          } catch (err) {
            alert('❌ Errore invio notifica push penalty points: ' + err.message);
          }
        });

        // Aggiorna stato locale solo se il DB va a buon fine
        const infrazione = {
          ...infrazioneDB,
          id: data && data[0] && data[0].id ? data[0].id : `infrazione_${Date.now()}`,
          points: infrazioneDB.punti,
          reason: infrazioneDB.motivo,
          dateAdded: infrazioneDB.data_infrazione,
          expiryDate: infrazioneDB.data_scadenza,
          gpBan: ''
        };
        const infrazioniPilota = penaltyDetails[`${campionatoSelezionato.id}_${pilotaSelezionato.id}`] || [];
        const nuoviDettagli = {
          ...penaltyDetails,
          [`${campionatoSelezionato.id}_${pilotaSelezionato.id}`]: [...infrazioniPilota, infrazione]
        };
        setPenaltyDetails(nuoviDettagli);

        setNuovaInfrazione({ punti: 1, motivo: '', dataInfrazione: '', pilotaId: null });
        setShowAggiungiInfrazione(false);
      } catch (err) {
        alert('Errore nel salvataggio');
      }
    };

    return (

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 998, padding: '20px' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.9)', border: '2px solid rgba(255, 255, 255, 0.3)', borderRadius: '15px', padding: '40px', maxWidth: '500px', width: '100%', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', position: 'relative' }}>
          <button
            onClick={() => {
              setNuovaInfrazione({ punti: 1, motivo: '', dataInfrazione: '', pilotaId: null })
              setShowAggiungiInfrazione(false)
            }}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: 'none',
              border: 'none',
              color: '#FF3B30',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.target.style.opacity = '0.7'}
            onMouseOut={(e) => e.target.style.opacity = '1'}
          >
            ✕
          </button>
          <h2 style={{ color: 'white', marginBottom: '30px', fontSize: '24px', fontWeight: '700', textShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>Aggiungi Infrazione a {pilotaSelezionato.nome}</h2>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#00D4FF', fontSize: '14px', fontWeight: '600', marginBottom: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Punti Penalità</label>
            <select
              value={nuovaInfrazione.punti}
              onChange={(e) => setNuovaInfrazione({ ...nuovaInfrazione, punti: parseInt(e.target.value) })}
              style={{ width: '100%', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '8px', fontSize: '14px', fontWeight: '500' }}
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#00D4FF', fontSize: '14px', fontWeight: '600', marginBottom: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Data Infrazione</label>
            <input
              type="date"
              value={nuovaInfrazione.dataInfrazione}
              onChange={(e) => setNuovaInfrazione({ ...nuovaInfrazione, dataInfrazione: e.target.value })}
              style={{ width: '100%', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '8px', fontSize: '14px', fontWeight: '500' }}
            />
          </div>
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: '#00D4FF', fontSize: '14px', fontWeight: '600', marginBottom: '8px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>Motivo</label>
            <textarea
              value={nuovaInfrazione.motivo}
              onChange={(e) => setNuovaInfrazione({ ...nuovaInfrazione, motivo: e.target.value })}
              style={{ width: '100%', padding: '12px', background: 'rgba(255, 255, 255, 0.1)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '8px', fontSize: '14px', fontWeight: '500', fontFamily: 'inherit', minHeight: '80px', resize: 'none' }}
              placeholder="Descrivi il motivo della penalità"
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSalvaInfrazione}
              style={{ flex: 1, padding: '12px', background: '#34C759', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(52, 199, 89, 0.3)' }}
              onMouseOver={(e) => e.target.style.opacity = '0.9'}
              onMouseOut={(e) => e.target.style.opacity = '1'}
            >
              Salva Infrazione
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MODALE SELEZIONE PILOTA
  if (campionatoSelezionato && !pilotaSelezionato) {
        // Pulsante aggiungi penalità in alto a destra
        const topButtonStyle = {
          position: 'absolute',
          top: '30px',
          right: '30px',
          padding: '12px 24px',
          borderRadius: '8px',
          background: '#34C759',
          color: 'white',
          border: 'none',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(52,199,89,0.15)',
          zIndex: 2001
        };
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 20px', overflow: 'hidden', zIndex: 996, paddingTop: window.innerWidth < 768 ? '100px' : '40px' }}>
        {/* Nessun pulsante aggiungi penalità qui */}
        <div style={{ position: 'absolute', top: window.innerWidth < 768 ? '42px' : '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
          <button onClick={() => setCampionatoSelezionato(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Indietro
          </button>
        </div>

        <h2 style={{ color: 'white', marginBottom: '40px', marginTop: '20px', fontSize: '28px', fontWeight: '700', textShadow: '0 2px 5px rgba(0,0,0,0.5)', position: 'relative', zIndex: 10 }}>{campionatoSelezionato.nome}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '25px', maxWidth: '900px', width: '100%', overflowY: 'auto', paddingRight: '15px', maxHeight: 'calc(100vh - 180px)' }}>
          {(campionatoSelezionato.piloti || []).map(pilota => {
            const evidenziata = pilotaInInserimento && pilotaInInserimento.id === pilota.id;
            const totalPuntiPilota = getTotalPenaltyPoints(pilota.id);
            return (
              <button
                key={pilota.id}
                onClick={() => setPilotaSelezionato(pilota)}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: evidenziata ? '3px solid orange' : '2px solid rgba(255, 255, 255, 0.5)',
                  borderRadius: '15px',
                  padding: '25px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s, border 0.2s',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.6)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.4)'
                }}
              >
                <div style={{ color: 'white', fontSize: '18px', fontWeight: '700', textAlign: 'center', textShadow: '0 2px 3px rgba(0, 0, 0, 0.5)' }}>
                  {pilota.nome}
                </div>
                <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100px' }}>
                  {[...Array(12)].map((_, i) => (
                    <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: i < totalPuntiPilota ? '#FF3B30' : 'rgba(255,255,255,0.15)', border: '1px solid ' + (i < totalPuntiPilota ? '#CC0000' : 'rgba(255,255,255,0.25)'), boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                  ))}
                </div>
                {totalPuntiPilota > 12 && (
                  <div style={{ background: '#FF3B30', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.3)', letterSpacing: '0.5px', transform: 'rotate(-15deg)' }}>RACE BAN</div>
                )}
              </button>
            );
          })}
        </div>

        {(campionatoSelezionato.piloti || []).length === 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', padding: '40px 20px', fontSize: '16px', textShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
            Nessun pilota disponibile
          </div>
        )}


      </div>
    )
  }

  // MODALE DETTAGLI PILOTA
  if (pilotaSelezionato) {
    const totalPunti = getTotalPenaltyPoints(pilotaSelezionato.id)
    const isBanned = totalPunti > 12
    const infrazioni = penaltyDetails[`${campionatoSelezionato.id}_${pilotaSelezionato.id}`] || []
    const topOffset = isMobile ? 30 : 0;
    const upOffset = isMobile ? -20 : 0;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: `calc(40px + ${topOffset}px) 20px 40px 20px`, overflow: 'auto', zIndex: 997 }}>
        {/* Pulsante testuale per aggiungere penalità in alto a destra sopra la tabella infrazioni */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={() => {
              setShowAggiungiInfrazione(true);
              setNuovaInfrazione({ punti: 1, motivo: '', dataInfrazione: '', pilotaId: pilotaSelezionato.id });
            }}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              background: '#34C759',
              color: 'white',
              border: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(52,199,89,0.15)',
              zIndex: 2001,
              marginRight: isMobile ? 0 : '25px'
            }}
          >
            Aggiungi penalità
          </button>
        </div>
        {/* Tasto Ban Scontato in alto a destra della pagina */}
        {isBanned && (
          <button
            onClick={async () => {
              if (window.confirm('Sei sicuro di azzerare il ban e tutte le infrazioni di questo pilota?')) {
                try {
                  await supabase
                    .from('infrazioni')
                    .delete()
                    .eq('campionato_id', campionatoSelezionato.id)
                    .eq('pilota_id', pilotaSelezionato.id)
                  setPenaltyDetails({
                    ...penaltyDetails,
                    [`${campionatoSelezionato.id}_${pilotaSelezionato.id}`]: []
                  })
                  alert('Ban azzerato! Tutte le infrazioni del pilota sono state eliminate.')
                } catch (err) {
                  console.error('Errore azzeramento ban:', err)
                  alert('Errore nell\'azzeramento del ban')
                }
              }
            }}
            style={{
              position: 'fixed',
              top: 20 + topOffset,
              right: 20,
              padding: '15px 25px',
              minWidth: '200px',
              minHeight: '56px',
              background: '#FF3B30',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(255, 59, 48, 0.4)',
              transition: 'all 0.2s',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none',
              touchAction: 'manipulation'
            }}
            onMouseOver={e => { e.target.style.opacity = '0.9'; e.target.style.transform = 'scale(1.05)' }}
            onMouseOut={e => { e.target.style.opacity = '1'; e.target.style.transform = 'scale(1)' }}
          >
            Ban Scontato
          </button>
        )}
        <div style={{ position: 'absolute', top: (20 + topOffset + (isMobile ? -4 : 0)), left: '20px', right: '20px', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', zIndex: 100 }}>
          <button onClick={() => setPilotaSelezionato(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: '24px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Indietro
          </button>
        </div>
        <div style={{ marginTop: `${80 + topOffset + upOffset}px`, maxWidth: '600px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ color: 'white', margin: '0', fontSize: '28px', fontWeight: '700', textShadow: '0 2px 5px rgba(0,0,0,0.5)', position: 'relative', top: `${upOffset}px` }}>{pilotaSelezionato.nome}</h2>
          </div>
          <div style={{ background: 'rgba(0, 0, 0, 0.5)', border: '2px solid rgba(255, 255, 255, 0.5)', borderRadius: '15px', padding: '25px', marginBottom: '25px', textAlign: 'center', position: 'relative', boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)', top: `${upOffset}px` }}>
            <div style={{ position: 'relative', width: '100%', minHeight: '70px' }}>
              {totalPunti > 12 && (
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: `${22 + topOffset + upOffset}px`,
                  transform: 'translateX(-50%) rotate(-12deg)',
                  background: '#FF3B30',
                  color: 'white',
                  padding: '4px 32px',
                  borderRadius: '20px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                  letterSpacing: '0.5px',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
                }}>
                  RACE BAN
                </div>
              )}
              <div style={{ fontSize: '56px', fontWeight: 'bold', color: totalPunti > 12 ? '#FF3B30' : '#00D4FF', marginBottom: '15px', marginTop: totalPunti > 12 ? '28px' : '0', textShadow: '0 2px 5px rgba(0,0,0,0.5)', position: 'relative', top: `${upOffset}px` }}>
                {totalPunti}/12
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '10px', fontWeight: '600', textShadow: '0 1px 3px rgba(0,0,0,0.5)', position: 'relative', top: `${upOffset}px` }}>PUNTI PENALITÀ</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', position: 'relative', top: `${upOffset}px` }}>
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: i < totalPunti ? '#FF3B30' : 'rgba(255,255,255,0.2)',
                    border: '2px solid ' + (i < totalPunti ? '#CC0000' : 'rgba(255,255,255,0.4)'),
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }}
                />
              ))}
            </div>
            <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '16px', fontWeight: '700', textShadow: '0 1px 3px rgba(0,0,0,0.5)', position: 'relative', top: `${upOffset}px` }}>Infrazioni ({infrazioni.length})</h3>
            {infrazioni.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 500px)', overflowY: 'auto', paddingRight: '10px', position: 'relative', top: `${upOffset}px` }}>
                {infrazioni.map(infrazione => {
                  const isAdmin = userLocal && userLocal.ruolo === 'admin';
                  const isOwner = infrazione.inseritoDa === userLocal?.id;
                  const handleMouseOver = (e) => e.target.style.opacity = '0.9'
                  const handleMouseOut = (e) => e.target.style.opacity = '1'
                  const puntiLabel = infrazione.points === 1 ? 'punto' : 'punti'
                  // Format date to dd-mm-yyyy
                  let expiryDateFormatted = infrazione.expiryDate
                  if (expiryDateFormatted && expiryDateFormatted.length === 10 && expiryDateFormatted.includes('-')) {
                    const [yyyy, mm, dd] = expiryDateFormatted.split('-')
                    expiryDateFormatted = `${dd}-${mm}-${yyyy}`
                  }
                  return (
                    <div key={infrazione.id} style={{ background: 'rgba(0, 0, 0, 0.9)', border: '2px solid rgba(255, 255, 255, 0.2)', padding: '15px 20px', borderRadius: '10px', display: 'grid', gridTemplateColumns: '0.6fr 1fr 2fr 0.3fr', gap: '30px', alignItems: 'center', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)', transition: 'opacity 0.2s', cursor: 'pointer', opacity: '1', position: 'relative' }} onMouseOver={handleMouseOver} onMouseOut={handleMouseOut}>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                        {infrazione.points} {puntiLabel}
                      </div>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                        {expiryDateFormatted}
                      </div>
                      <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.5)', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                        {infrazione.reason}
                        {infrazione.gpBan && <div style={{ fontSize: '12px', color: '#FF3B30', marginTop: '4px', fontWeight: '600' }}>Ban: {infrazione.gpBan}</div>}
                      </div>
                      {(isAdmin || isOwner) && (
                        <button
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: '#FF3B30',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(255, 59, 48, 0.4)',
                            marginLeft: 'auto',
                            transition: 'all 0.2s',
                            position: 'absolute',
                            top: '50%',
                            right: '18px',
                            zIndex: 9999,
                            transform: 'translateY(-50%)',
                          }}
                          title="Elimina infrazione (DEBUG)"
                          onClick={() => eliminaInfrazione(infrazione.id, pilotaSelezionato.id, campionatoSelezionato.id)}
                        >
                          <img src={CestinoSVG} alt="Cestino" style={{ width: '22px', height: '22px', filter: 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(100vh - 500px)', overflowY: 'auto', paddingRight: '10px', position: 'relative', top: `${upOffset}px` }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.7)', border: '2px solid rgba(255, 255, 255, 0.3)', padding: '15px 20px', borderRadius: '10px', display: 'grid', gridTemplateColumns: '0.6fr 1.2fr 1.2fr', gap: '30px', alignItems: 'center', boxShadow: '0 4px 10px rgba(0, 0, 0, 0.3)' }}>
                  <div style={{ color: '#00D4FF', fontWeight: '700', fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.5)', letterSpacing: '0.5px' }}>PUNTI</div>
                  <div style={{ color: '#00D4FF', fontWeight: '700', fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.5)', letterSpacing: '0.5px' }}>SCADENZA</div>
                  <div style={{ color: '#00D4FF', fontWeight: '700', fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.5)', letterSpacing: '0.5px' }}>MOTIVO</div>
                </div>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '20px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  Nessuna infrazione
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'url(/sfondo-fwm.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <div style={{ position: 'absolute', top: isMobile ? '80px' : '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#007AFF', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '24px', height: isMobile ? '24px' : '24px' }}><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          Indietro
        </button>
        {(userLocal?.ruolo === 'admin') && (
          <button onClick={() => setShowAggiungiMenu(true)} style={{ background: '#34C759', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(52, 199, 89, 0.3)' }}>
            Aggiungi Campionato
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px', justifyContent: 'center', maxWidth: '900px', width: '100%', maxHeight: window.innerWidth < 768 ? 'calc(100vh - 180px)' : 'auto', overflowY: window.innerWidth < 768 ? 'auto' : 'visible', paddingRight: window.innerWidth < 768 ? '15px' : '0', paddingLeft: window.innerWidth < 768 ? '15px' : '0' }}>
        {campionati.length > 0 ? (
          campionati.map(campionato => (
            <button
              key={campionato.id}
              onClick={() => setCampionatoSelezionato(campionato)}
              style={{
                width: '100%',
                minHeight: '100px',
                background: '#007AFF',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                fontSize: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                padding: '20px',
                transition: 'transform 0.2s',
                textAlign: 'center'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              {campionato.nome}
              <div style={{ fontSize: '14px', marginTop: '10px', opacity: 0.8 }}>
                {(campionato.piloti || []).length} piloti
              </div>
            </button>
          ))
        ) : (
          <div style={{ textAlign: 'center', color: '#666', gridColumn: '1 / -1' }}>
            Nessun campionato disponibile
          </div>
        )}
      </div>
    </div>
  )
}

export default App
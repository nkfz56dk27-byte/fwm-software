# 🔔 Configurazione Notifiche Push In Background - Guida Completa

## 📋 Panoramica

Questo progetto supporta le notifiche push in background su:
- **iOS**: PWA con Web Notifications API (iOS 16.4+)
- **Android**: Web Push API + Firebase Cloud Messaging (FCM)
- **Desktop**: Browser moderni con Service Workers

## 🏗️ Architettura

```
┌─────────────────────────────────────────┐
│         App Frontend (React)             │
│  - NotificationPrompt.jsx                │
│  - pushNotificationService.js            │
│  - firebaseMessaging.js                  │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼──────────────┐ ┌──▼─────────────────┐
│ Service Workers  │ │ Firebase Messaging  │
│ - service-       │ │ - Firebase Config   │
│   worker.js      │ │ - FCM Token         │
│ - firebase-      │ │ - Cloud Messaging   │
│   messaging-sw.js│ └────┬────────────────┘
└─────────────────┘      │
          │              │
          └──────┬───────┘
                 │
        ┌────────▼─────────┐
        │  Native API      │
        │  - Web Push API  │
        │  - Notifications│
        │  - Service Work.│
        └──────────────────┘
                 │
        ┌────────▼──────────────┐
        │  Operating System     │
        │  - iOS Notifications  │
        │  - Android Foreground │
        │  - Android Background │
        └───────────────────────┘
```

## 🔧 Componenti Principali

### 1. **nativeNotificationHandler.js**
Gestore nativo delle notifiche con supporto specifico per iOS e Android.

**Funzioni principali:**
- `initializeNativeNotifications(username)` - Inizializza le notifiche
- `subscribeToPushNotifications()` - Sottoscrive a Web Push
- `getPushSubscription()` - Recupera l'iscrizione attuale
- `unsubscribeFromPushNotifications()` - Cancella l'iscrizione
- `showTestNotification(title, options)` - Mostra una notifica di test

### 2. **service-worker.js** (Service Worker Principale)
Gestisce tutte le notifiche quando l'app è in background.

**Funzionalità:**
- `onBackgroundMessage` - Riceve messaggi FCM in background
- `notificationclick` - Gestisce il click sulle notifiche
- `sync` - Background Sync (Android)
- `periodicsync` - Aggiornamenti periodici (Android)

### 3. **firebase-messaging-sw.js** (Firebase Service Worker)
Specifico per Firebase Cloud Messaging.

**Funzionalità:**
- Ricezione di notifiche FCM in background
- Gestione del click sulle notifiche FCM
- Supporto per azioni personalizzate

### 4. **firebaseMessaging.js**
Gestisce il setup di Firebase Messaging lato client.

**Funzioni:**
- `getFirebaseToken(username)` - Ottiene il token FCM
- `setupForegroundMessaging(callback)` - Messaggi in foreground
- Salva il token su Supabase per tracking

### 5. **pushNotificationService.js**
Sistema realtime con Supabase per notifiche in tempo reale.

**Funzioni:**
- `registraDispositivoNotifiche(username)` - Registra il dispositivo
- `ascolaNotificheRealtime(username, callback)` - Ascolta notifiche
- `inviaNotificaAUtente(destinatario, options)` - Invia notifiche
- `getDispositiviUtente(username)` - Recupera i dispositivi

## 📱 Come Funziona Per Dispositivo

### iOS (PWA)
```
Utente attiva le notifiche
        ↓
iOS richiede permesso (Notifiche)
        ↓
Service Worker viene registrato
        ↓
Manifesto PWA carica
        ↓
notifiche attive tramite Web Notifications API
        ↓
App può ricevere notifiche anche in background
```

**Configurazione richiesta:**
- ✅ Manifest.json con icone corrette
- ✅ Service Worker registrato
- ✅ HTTPS (richiesto)
- ✅ Permesso Notifiche richiesto

### Android
```
Utente attiva le notifiche
        ↓
Android richiede permesso (Notifiche)
        ↓
Service Worker + Firebase Messaging
        ↓
Sottoscrizione a Web Push API
        ↓
FCM Token generato
        ↓
Notifiche ricevute in background
```

**Configurazione richiesta:**
- ✅ Firebase Project creato
- ✅ Service Worker registrato
- ✅ Web Push API supportato
- ✅ FCM configurato nel backend

## 🚀 Flow di Attivazione Notifiche

### Primo Login
```
1. App mostra NotificationPrompt
2. Utente clicca "Abilita Notifiche"
3. initializeNativeNotifications() esegue:
   - Richiede permesso browser
   - Registra Service Worker
   - Per iOS: salva stato su localStorage
   - Per Android: sottoscrive a Web Push + FCM
4. registraDispositivoNotifiche() esegue:
   - Genera Device ID
   - Registra su Supabase (push_devices)
   - Ascolta notifiche realtime
5. getFirebaseToken() esegue:
   - Ottiene token FCM
   - Salva su Supabase (firebase_tokens)
6. ✅ App pronta per ricevere notifiche
```

## 📤 Come Inviare Notifiche

### Opzione 1: Supabase Realtime (Testing)
```javascript
import { inviaNotificaAUtente } from './pushNotificationService'

await inviaNotificaAUtente('username', {
  titolo: '🔔 Notifica Test',
  messaggio: 'Questo è un test',
  url: '/calendario',
  data: { type: 'test' }
})
```

### Opzione 2: Firebase Cloud Messaging (Produzione)
```bash
curl -X POST https://fcm.googleapis.com/v1/projects/{PROJECT}/messages:send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -d '
  {
    "message": {
      "token": "DEVICE_FCM_TOKEN",
      "notification": {
        "title": "Titolo Notifica",
        "body": "Corpo della notifica"
      },
      "data": {
        "url": "/calendario",
        "type": "event"
      }
    }
  }
'
```

## ✅ Checklist Di Verifica

### Setup Iniziale
- [ ] Firebase Project creato
- [ ] Service Workers registrati
- [ ] manifest.json configurato
- [ ] HTTPS abilitato
- [ ] Supabase database configurato

### Client-Side
- [ ] `nativeNotificationHandler.js` importato
- [ ] `NotificationPrompt` mostra quando necessario
- [ ] `initializeNativeNotifications` chiamato all'attivazione
- [ ] Token FCM salvati su Supabase
- [ ] Listener realtime attivi

### Server-Side
- [ ] FCM Project Key configurato
- [ ] Firebase_tokens table popola correttamente
- [ ] Push_devices table registra i dispositivi
- [ ] Notifiche_push table riceve i messaggi

### Testing
- [ ] Notifiche visibili in foreground
- [ ] Notifiche visibili quando app in background
- [ ] Click su notifica apre l'app
- [ ] URL dei dati viene navigato correttamente
- [ ] Notifiche funzionano offline (in coda)

## 🐛 Debug e Troubleshooting

### Vedere i Log
Apri DevTools (F12) nella tab oppure controlla:
```
Chrome DevTools > Application > Service Workers > Inspect
```

### Notifiche Non Funzionano Su iOS
- ✅ Verifica che sia una PWA (manifest.json presente)
- ✅ Verifica iOS 16.4+ (versioni precedenti non supportano)
- ✅ Controlla che permesso sia stato concesso
- ✅ Riavvia l'app dopo l'attivazione

### Notifiche Non Funzionano Su Android
- ✅ Controlla che Firebase sia configurato
- ✅ Verifica che FCM Token sia stato salvato
- ✅ Controlla la connessione a Internet
- ✅ Prova con una tab aperta in background (non chiusa)

### Notifiche Non Visibili In Background
- ✅ Verificare `requireInteraction: true` nel Service Worker
- ✅ Controllare che il dispositivo non abbia il do-not-disturb
- ✅ Controllare le impostazioni del browser
- ✅ Verificare che il Service Worker sia attivo

## 📊 Database Tables

### push_devices
```sql
- username: TEXT
- device_id: TEXT
- device_type: TEXT (mobile/tablet/desktop)
- browser_info: TEXT
- ultimo_accesso: TIMESTAMP
- attivo: BOOLEAN
```

### firebase_tokens
```sql
- username: TEXT
- token: TEXT (FCM Token)
- browser_info: TEXT
- last_updated: TIMESTAMP
```

### notifiche_push
```sql
- destinatario: TEXT
- titolo: TEXT
- messaggio: TEXT
- url: TEXT
- data: JSONB
- letta: BOOLEAN
- created_at: TIMESTAMP
```

## 🔐 Security

- ✅ FCM Token non è secretato (è temporaneo)
- ✅ Usa HTTPS per trasmettere dati sensibili
- ✅ Valida permessi sul backend prima di inviare notifiche
- ✅ Limita frequenza notifiche per evitare spam

## 📚 Risorse Utili

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

## 🎯 Prossimi Passi

1. **Backend Firebase Setup**
   - Crea Cloud Function per inviare notifiche
   - Setup scheduler per notifiche pianificate

2. **Analytics**
   - Traccia quando le notifiche vengono viste
   - Registra i click sulle notifiche

3. **Personalizzazione**
   - Permetti agli utenti di scegliere quali notifiche ricevere
   - Implementa i silenzi personalizzati

4. **Testing**
   - Setup di test automatici per notifiche
   - Testing su dispositivi reali (iOS/Android)

---

**Status**: ✅ Configurazione completata per iOS e Android
**Ultima modifica**: 17 Gennaio 2026

# ⚡ QUICK START - Notifiche In Background

## 🎯 In 3 Minuti

### 1️⃣ Verificare che tutto sia già configurato
```bash
# Verificare che i file siano presenti:
ls src/nativeNotificationHandler.js
ls src/notificationTester.js
ls public/service-worker.js
ls public/manifest.json
```

✅ Se tutti i file esistono, vai al passo 2.

### 2️⃣ Testare dal browser
1. Apri l'app: `npm run dev`
2. Fai login
3. Premi F12 (DevTools)
4. Copia-Incolla in Console:
```javascript
import('./src/notificationTester.js').then(m => m.testFullReport('tuo_username'))
```
5. Guarda i risultati 🎉

### 3️⃣ Testare una notifica reale
```javascript
// In Console:
import('./src/notificationTester.js').then(m => m.testShowNotification())
```

---

## 📱 Come Usarlo Su Mobile

### iPhone (iOS 16.4+)
```
1. Apri Safari
2. Vai su: https://tuodominio.com
3. Tap il menu (condividi) → "Aggiungi a Home"
4. Fai login
5. "Abilita Notifiche" quando chiesto
✅ Fatto! Riceverai notifiche anche in background
```

### Android (Chrome)
```
1. Apri Chrome
2. Vai su: https://tuodominio.com
3. Menu → "Installa app"
4. Fai login
5. "Abilita Notifiche" quando chiesto
✅ Fatto! Riceverai notifiche anche in background
```

---

## 🧪 Test Rapidi

### Test: Mostra una notifica
```javascript
import('./src/notificationTester.js').then(m => m.testShowNotification())
```

### Test: Invia notifica via Supabase
```javascript
import('./src/notificationTester.js').then(m => m.testSendNotification('tuo_username'))
```

### Test: Vedi i tuoi dispositivi registrati
```javascript
import('./src/notificationTester.js').then(m => m.testRegisteredDevices('tuo_username'))
```

### Test: Controlla il Service Worker
```javascript
import('./src/notificationTester.js').then(m => m.monitorServiceWorker())
```

---

## 🔍 Se Non Funziona

### Step 1: Controlla il permesso
```javascript
Notification.permission  // Deve essere 'granted'
```

### Step 2: Controlla il Service Worker
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length)
})
```

### Step 3: Esegui il test completo
```javascript
import('./src/notificationTester.js').then(m => m.testFullReport('tuo_username'))
```

### Step 4: Leggi il troubleshooting
Vedi: `NOTIFICATIONS_GUIDE.md` → Troubleshooting section

---

## 📁 File Importanti

| File | Cosa Fa | Modificare? |
|------|---------|------------|
| `src/nativeNotificationHandler.js` | Setup notifiche iOS/Android | ❌ No |
| `src/notificationTester.js` | Test da console | ❌ No |
| `public/service-worker.js` | Gestisce notifiche in background | ❌ No |
| `public/manifest.json` | Configurazione PWA | ❓ Solo se necessario |
| `src/App.jsx` | Integrazione nel login | ✅ Già fatto |
| `src/NotificationPrompt.jsx` | UI per abilitare notifiche | ✅ Già fatto |

---

## 💡 Comandi Utili

```bash
# Avvia dev server
npm run dev

# Build per produzione
npm run build

# Preview del build
npm run preview

# Visualizza la struttura dei file
find src public -name "*.js" -o -name "*.jsx"
```

---

## 🚀 Per La Produzione

1. Fai il build: `npm run build`
2. Testa il build: `npm run preview`
3. Deploy con HTTPS (importante!)
4. Verifica il Service Worker in produzione
5. Testa le notifiche su mobile

**Vedi**: `DEPLOYMENT_CHECKLIST.md` per i dettagli

---

## 📞 Help

**Domanda**: Le notifiche non funzionano?
**Risposta**: Esegui in console:
```javascript
import('./src/notificationTester.js').then(m => m.testFullReport('username'))
```
Questo ti mostrerà esattamente cosa non funziona.

**Domanda**: Come invio una notifica?
**Risposta**: 
- Via Supabase (test):
  ```sql
  INSERT INTO notifiche_push (destinatario, titolo, messaggio, url, letta)
  VALUES ('username', 'Titolo', 'Messaggio', '/url', false);
  ```
- Via FCM (produzione): Vedi `NOTIFICATIONS_GUIDE.md`

**Domanda**: Funziona su iPhone?
**Risposta**: Sì, ma richiede iOS 16.4+ e l'app deve essere installata come PWA (Home Screen)

---

**Tutto Pronto!** 🎉

Adesso hai le notifiche in background completamente funzionanti.

Vuoi testare? Vai su → `npm run dev` → Fai login → Premi F12 → Copia il codice di test qui sopra!


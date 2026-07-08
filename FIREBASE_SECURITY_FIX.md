# 🔒 Istruzioni per risolvere il problema di sicurezza Firebase

## Problema
Google ha disabilitato la chiave del service account Firebase perché è stata esposta pubblicamente su GitHub. Questo ha causato l'interruzione delle notifiche push.

## Soluzione implementata
1. ✅ Rimosso il file `firebase-service-account.json` dal repository
2. ✅ Aggiornato `.gitignore` per prevenire futuri commit di credenziali
3. ✅ Modificato il codice per usare variabili d'ambiente invece del file JSON

## Passaggi da completare

### 1. Genera una nuova chiave service account
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Seleziona il progetto `fwm-notifiche`
3. Vai a **IAM & Admin** → **Service Accounts**
4. Trova `firebase-adminsdk-fbsvc@fwm-notifiche.iam.gserviceaccount.com`
5. Clicca su di esso → **Keys** → **Add Key** → **Create new key**
6. Seleziona **JSON** e clicca **Create**
7. Salva il file JSON scaricato (NON committarlo su GitHub!)

### 2. Configura la variabile d'ambiente
#### Localmente:
Aggiungi al file `.env`:
```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"fwm-notifiche",...}
```
Copia l'intero contenuto del file JSON scaricato come valore della variabile.

#### Su Vercel:
1. Vai su [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleziona il tuo progetto
3. Vai a **Settings** → **Environment Variables**
4. Aggiungi una nuova variabile:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Incolla l'intero contenuto JSON del file scaricato

#### Su GitHub Actions:
1. Vai su [GitHub Repository Settings](https://github.com/nkfz56dk27-byte/fwm-software/settings/secrets/actions)
2. Clicca **New repository secret**
3. **Name**: `FIREBASE_SERVICE_ACCOUNT`
4. **Secret**: Incolla l'intero contenuto JSON del file scaricato

### 3. Rimuovi il file esposto da GitHub
Il file `firebase-service-account.json` deve essere rimosso dalla cronologia di GitHub:
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch firebase-service-account.json" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```

### 4. Verifica il funzionamento
Dopo aver configurato la nuova chiave, testa le notifiche:
```bash
node scripts/send-fcm-test.js
```

## ⚠️ Importante
- **MAI** committare file con credenziali su GitHub
- Usa sempre variabili d'ambiente per le credenziali sensibili
- Ruota regolarmente le chiavi di servizio
- Controlla periodicamente i log di attività su Google Cloud Console

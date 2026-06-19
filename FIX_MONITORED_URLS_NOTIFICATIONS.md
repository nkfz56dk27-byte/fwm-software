# Fix per Notifiche Link Monitorati

## Problema Individuato
Le notifiche per i link monitorati non funzionavano perché:

1. **Tabella mancante**: La tabella `push_notifications_monitored_urls` non era stata creata nel database Supabase
2. **Query errata**: Il file `send-push-monitored-urls.js` cercava di selezionare un campo `username` che non esiste nella tabella

## Soluzione Implementata

### 1. Creata nuova migration: `0031_create_push_notifications_monitored_urls.sql`
Crea la tabella per gestire le notifiche push dei link monitorati con:
- `id`: UUID primario
- `user_id`: Riferimento all'utente (with CASCADE delete)
- `url_id`: Riferimento al link monitorato (with CASCADE delete)
- `title`, `body`: Titolo e corpo della notifica
- `status`: pending/sent/failed
- `error`: Messaggio di errore se fallito
- `onesignal_id`: ID della notifica inviata a OneSignal
- Indici per performance su status, user_id, url_id, created_at

### 2. Corretto `api/send-push-monitored-urls.js`
- Rimosso il campo `username` dalla query (non esiste nella tabella)
- Rimosso il parametro `username` dalla chiamata a `sendOneSignalNotification()` (passa solo `userId`)

## Come Applicare la Migrazione

### Opzione A: Tramite Supabase Dashboard (Consigliato)
1. Accedi a https://app.supabase.com
2. Seleziona il tuo progetto
3. Vai alla sezione "SQL Editor"
4. Clicca su "New Query"
5. Copia il contenuto di `db/0031_create_push_notifications_monitored_urls.sql`
6. Incolla nel SQL Editor
7. Clicca "Run"

### Opzione B: Tramite Node.js
```bash
# Imposta la connection string di Supabase
export SUPABASE_DB_URL="postgresql://[user]:[password]@[host]/[database]"

# Oppure
export DATABASE_URL="postgresql://[user]:[password]@[host]/[database]"

# Esegui la migration
npm install pg
node db/run_migration.js 0031_create_push_notifications_monitored_urls.sql
```

### Opzione C: Tramite psql (se hai PostgreSQL installato localmente)
```bash
psql "[connection_string]" < db/0031_create_push_notifications_monitored_urls.sql
```

## Verifica

Dopo aver applicato la migration, puoi verificare che tutto funzioni:

1. **Nel Supabase Dashboard SQL Editor**, esegui:
```sql
SELECT tablename FROM pg_tables WHERE tablename = 'push_notifications_monitored_urls';
```

2. Aggiungi un link monitorato tramite l'app (MonitorUrlModal)
3. Aspetta il prossimo ciclo del cron (ogni 2 minuti)
4. Verifica nella tabella `push_notifications_monitored_urls` che vengano create notifiche con status 'pending'
5. Poco dopo, dovrebbero diventare 'sent' (significa che OneSignal le ha ricevute)

## Flusso Completo (Dopo la Fix)

```
1. Utente aggiunge link monitorato in MonitorUrlModal
   ↓
2. Viene creato in tabella `monitored_urls`
3. Viene creato subscription in `monitored_urls_subscriptions`
   ↓
4. Cron job (ogni 2 min) controlla il link
   ↓
5. Se cambiato, inserisce in `push_notifications_monitored_urls` (status: pending)
   ↓
6. Cron chiama GET /api/send-push-monitored-urls
   ↓
7. Endpoint legge notifiche pending, le invia via OneSignal
   ↓
8. Aggiorna status a 'sent' se successo, 'failed' se errore
   ↓
9. Notifica arriva al device dell'utente
```

## File Modificati

- `db/0031_create_push_notifications_monitored_urls.sql` (NUOVO)
- `api/send-push-monitored-urls.js` (MODIFICATO - rimosse query a username non disponibile)

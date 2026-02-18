-- Migrazione: notifiche calendario e lette da INTEGER a UUID
-- 1. Crea nuove tabelle temporanee con UUID
CREATE TABLE IF NOT EXISTS notifiche_calendario_uuid (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT,
  messaggio TEXT NOT NULL,
  evento_id INTEGER REFERENCES eventi_calendario(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifiche_lette_uuid (
  id SERIAL PRIMARY KEY,
  username TEXT REFERENCES utenti(username),
  notifica_id UUID REFERENCES notifiche_calendario_uuid(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, notifica_id)
);

-- 2. Copia le notifiche esistenti nella nuova tabella
INSERT INTO notifiche_calendario_uuid (tipo, messaggio, evento_id, created_at)
SELECT tipo, messaggio, evento_id, created_at FROM notifiche_calendario;

-- 3. Mappa le vecchie notifiche_lette su quelle nuove (solo se vuoi mantenere lo storico)
-- ATTENZIONE: questa parte funziona solo se hai una corrispondenza tra vecchi e nuovi ID
-- Altrimenti lascia vuota la nuova tabella notifiche_lette_uuid

-- 4. Rinomina le vecchie tabelle come backup
ALTER TABLE notifiche_calendario RENAME TO notifiche_calendario_old;
ALTER TABLE notifiche_lette RENAME TO notifiche_lette_old;

-- 5. Rinomina le nuove tabelle
ALTER TABLE notifiche_calendario_uuid RENAME TO notifiche_calendario;
ALTER TABLE notifiche_lette_uuid RENAME TO notifiche_lette;

-- 6. (Opzionale) Elimina le vecchie tabelle dopo verifica
-- DROP TABLE notifiche_calendario_old;
-- DROP TABLE notifiche_lette_old;

-- Ora tutte le nuove notifiche avranno ID UUID e le lette saranno collegate tramite UUID.

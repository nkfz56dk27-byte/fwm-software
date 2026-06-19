-- Tabella: campionati
CREATE TABLE IF NOT EXISTS campionati (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  colore TEXT,
  emoji TEXT,
  sigla TEXT,
  attivo BOOLEAN DEFAULT TRUE
);

-- Tabella: utenti
CREATE TABLE IF NOT EXISTS utenti (
  username TEXT PRIMARY KEY,
  nome TEXT,
  cognome TEXT
);

-- Tabella: eventi_calendario
CREATE TABLE IF NOT EXISTS eventi_calendario (
  id SERIAL PRIMARY KEY,
  titolo TEXT NOT NULL,
  campionato_id TEXT REFERENCES campionati(id),
  data_inizio DATE NOT NULL,
  data_fine DATE,
  max_accrediti INTEGER,
  programmazione_weekend TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabella: sessioni_weekend
CREATE TABLE IF NOT EXISTS sessioni_weekend (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER REFERENCES eventi_calendario(id) ON DELETE CASCADE,
  nome_sessione TEXT NOT NULL,
  data_sessione DATE,
  orario_sessione TEXT,
  campionato_id TEXT REFERENCES campionati(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabella: prenotazioni_accrediti
CREATE TABLE IF NOT EXISTS prenotazioni_accrediti (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER REFERENCES eventi_calendario(id) ON DELETE CASCADE,
  username TEXT REFERENCES utenti(username),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabella: notifiche_calendario
CREATE TABLE IF NOT EXISTS notifiche_calendario (
  id SERIAL PRIMARY KEY,
  tipo TEXT,
  messaggio TEXT NOT NULL,
  evento_id INTEGER REFERENCES eventi_calendario(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabella: notifiche_lette
CREATE TABLE IF NOT EXISTS notifiche_lette (
  id SERIAL PRIMARY KEY,
  username TEXT REFERENCES utenti(username),
  notifica_id INTEGER REFERENCES notifiche_calendario(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, notifica_id)
);

CREATE TABLE IF NOT EXISTS campionati (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  colore TEXT,
  emoji TEXT,
  sigla TEXT,
  attivo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS utenti (
  username TEXT PRIMARY KEY,
  nome TEXT,
  cognome TEXT
);

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

CREATE TABLE IF NOT EXISTS sessioni_weekend (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER REFERENCES eventi_calendario(id) ON DELETE CASCADE,
  nome_sessione TEXT NOT NULL,
  data_sessione DATE,
  orario_sessione TEXT,
  campionato_id TEXT REFERENCES campionati(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prenotazioni_accrediti (
  id SERIAL PRIMARY KEY,
  evento_id INTEGER REFERENCES eventi_calendario(id) ON DELETE CASCADE,
  username TEXT REFERENCES utenti(username),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifiche_calendario (
  id SERIAL PRIMARY KEY,
  tipo TEXT,
  messaggio TEXT NOT NULL,
  evento_id INTEGER REFERENCES eventi_calendario(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifiche_lette (
  id SERIAL PRIMARY KEY,
  username TEXT,
  notifica_id INTEGER
);

CREATE TABLE IF NOT EXISTS push_devices (
  username TEXT NOT NULL,
  device_id TEXT NOT NULL,
  browser_info TEXT,
  ultimo_accesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, device_id)
);

CREATE TABLE IF NOT EXISTS notifiche_push (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario TEXT NOT NULL,
  titolo TEXT NOT NULL,
  messaggio TEXT NOT NULL,
  url TEXT DEFAULT '/',
  data JSONB,
  letta BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

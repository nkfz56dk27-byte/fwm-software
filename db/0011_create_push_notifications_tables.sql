-- Crea le tabelle per il sistema di notifiche push multi-device

-- Tabella per memorizzare i dispositivi registrati
CREATE TABLE IF NOT EXISTS push_devices (
  username TEXT NOT NULL,
  device_id TEXT NOT NULL,
  browser_info TEXT,
  ultimo_accesso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  attivo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, device_id)
);

-- Indici per migliorare le query
CREATE INDEX IF NOT EXISTS idx_push_devices_username ON push_devices(username);
CREATE INDEX IF NOT EXISTS idx_push_devices_attivo ON push_devices(attivo);
CREATE INDEX IF NOT EXISTS idx_push_devices_ultimo_accesso ON push_devices(ultimo_accesso);

-- Tabella per le notifiche inviate
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

-- Indici per le notifiche
CREATE INDEX IF NOT EXISTS idx_notifiche_push_destinatario ON notifiche_push(destinatario);
CREATE INDEX IF NOT EXISTS idx_notifiche_push_letta ON notifiche_push(letta);
CREATE INDEX IF NOT EXISTS idx_notifiche_push_created_at ON notifiche_push(created_at);

-- Abilita RLS (Row Level Security) su entrambe le tabelle
ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifiche_push ENABLE ROW LEVEL SECURITY;

-- Policy RLS per push_devices
-- Gli utenti possono vedere solo i loro dispositivi
CREATE POLICY "Utenti vedono solo loro dispositivi"
  ON push_devices
  FOR SELECT
  USING (true);  -- Permesso temporaneo per fare test

CREATE POLICY "Utenti modificano solo loro dispositivi"
  ON push_devices
  FOR UPDATE
  USING (true);  -- Permesso temporaneo per fare test

CREATE POLICY "Utenti eliminano solo loro dispositivi"
  ON push_devices
  FOR DELETE
  USING (true);  -- Permesso temporaneo per fare test

-- Gli utenti possono inserire i loro dispositivi
CREATE POLICY "Utenti inseriscono solo loro dispositivi"
  ON push_devices
  FOR INSERT
  WITH CHECK (true);  -- Permesso temporaneo per fare test

-- Policy RLS per notifiche_push
-- Gli utenti possono vedere solo le loro notifiche
CREATE POLICY "Utenti vedono solo loro notifiche"
  ON notifiche_push
  FOR SELECT
  USING (true);  -- Permesso temporaneo per fare test

-- Chiunque può inserire notifiche
CREATE POLICY "Chiunque può inserire notifiche"
  ON notifiche_push
  FOR INSERT
  WITH CHECK (true);

-- Commenti per documentazione
COMMENT ON TABLE push_devices IS 'Memorizza i dispositivi registrati per ricevere notifiche push';
COMMENT ON TABLE notifiche_push IS 'Log delle notifiche push inviate agli utenti';
COMMENT ON COLUMN push_devices.device_id IS 'ID univoco del dispositivo (combinazione di user agent + timestamp + random)';
COMMENT ON COLUMN push_devices.ultimo_accesso IS 'Ultimo momento in cui il dispositivo è stato attivo';
COMMENT ON COLUMN notifiche_push.data IS 'Dati aggiuntivi della notifica in formato JSON';

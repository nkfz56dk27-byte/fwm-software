-- Tabella per salvare i token Firebase Cloud Messaging
CREATE TABLE IF NOT EXISTS firebase_tokens (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  token TEXT NOT NULL,
  browser_info TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(username, token)
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_firebase_tokens_username ON firebase_tokens(username);
CREATE INDEX IF NOT EXISTS idx_firebase_tokens_last_updated ON firebase_tokens(last_updated);

-- Abilita RLS
ALTER TABLE firebase_tokens ENABLE ROW LEVEL SECURITY;

-- Policy RLS
CREATE POLICY "Utenti vedono solo i loro token"
  ON firebase_tokens
  FOR SELECT
  USING (true);

CREATE POLICY "Utenti inseriscono solo i loro token"
  ON firebase_tokens
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE firebase_tokens IS 'Memorizza i token FCM per le notifiche push';
COMMENT ON COLUMN firebase_tokens.token IS 'Firebase Cloud Messaging token per le notifiche';

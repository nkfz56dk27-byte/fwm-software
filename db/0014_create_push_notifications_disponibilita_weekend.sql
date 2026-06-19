-- Tabella dedicata alle notifiche push per disponibilità weekend (pipeline OneSignal)
CREATE TABLE IF NOT EXISTS push_notifications_disponibilita_weekend (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notification_type TEXT DEFAULT 'disponibilita_weekend',
  target_all BOOLEAN DEFAULT true,
  target_users TEXT[],
  data JSONB,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_push_notifications_dispo_status ON push_notifications_disponibilita_weekend(status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_dispo_created_at ON push_notifications_disponibilita_weekend(created_at);

-- Abilita RLS
ALTER TABLE push_notifications_disponibilita_weekend ENABLE ROW LEVEL SECURITY;

-- Policy RLS: chiunque può inserire
CREATE POLICY "Chiunque può inserire notifiche dispo weekend"
  ON push_notifications_disponibilita_weekend
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE push_notifications_disponibilita_weekend IS 'Notifiche push OneSignal solo per disponibilità weekend';
COMMENT ON COLUMN push_notifications_disponibilita_weekend.data IS 'Dati aggiuntivi della notifica in formato JSON';

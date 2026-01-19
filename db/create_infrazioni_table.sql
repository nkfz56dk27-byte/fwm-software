-- Tabella per le infrazioni/penalità
CREATE TABLE IF NOT EXISTS infrazioni (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  campionato_id UUID NOT NULL REFERENCES classifiche(id) ON DELETE CASCADE,
  pilota_id INT NOT NULL,
  punti INT NOT NULL CHECK (punti >= 1 AND punti <= 12),
  motivo TEXT NOT NULL,
  data_infrazione DATE NOT NULL,
  data_scadenza DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indice per query veloci
CREATE INDEX IF NOT EXISTS idx_infrazioni_campionato_pilota ON infrazioni(campionato_id, pilota_id);
CREATE INDEX IF NOT EXISTS idx_infrazioni_data_scadenza ON infrazioni(data_scadenza);

-- Commenti
COMMENT ON TABLE infrazioni IS 'Tabella per tracciare le infrazioni e i punti penalità dei piloti';
COMMENT ON COLUMN infrazioni.punti IS 'Punti penalità assegnati (1-12)';
COMMENT ON COLUMN infrazioni.data_infrazione IS 'Data in cui l''infrazione è stata commessa';
COMMENT ON COLUMN infrazioni.data_scadenza IS 'Data in cui l''infrazione scade (auto-calcolata: data_infrazione + 12 mesi)';

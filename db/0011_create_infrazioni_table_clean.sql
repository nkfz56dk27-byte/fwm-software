-- SQL per ricreare la tabella infrazioni in Supabase/Postgres
DROP TABLE IF EXISTS infrazioni;

CREATE TABLE infrazioni (
  id BIGSERIAL PRIMARY KEY,
  campionato_id UUID NOT NULL,
  pilota_id BIGINT NOT NULL,
  punti INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  data_infrazione DATE NOT NULL,
  data_scadenza DATE NOT NULL
);

-- Indici utili
CREATE INDEX idx_infrazioni_campionato ON infrazioni(campionato_id);
CREATE INDEX idx_infrazioni_pilota ON infrazioni(pilota_id);

-- Permessi base (da adattare su Supabase se necessario)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON infrazioni TO anon, authenticated;
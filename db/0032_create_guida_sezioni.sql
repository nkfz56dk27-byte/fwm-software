-- Tabella per la guida delle funzioni
-- Permette agli admin di modificare e gestire le sezioni della guida

CREATE TABLE IF NOT EXISTS guida_sezioni (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  features TEXT[] NOT NULL DEFAULT '{}',
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index per ordinamento
CREATE INDEX IF NOT EXISTS idx_guida_sezioni_ordine ON guida_sezioni(ordine);

-- RLS (Row Level Security)
ALTER TABLE guida_sezioni ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono leggere
CREATE POLICY "Tutti possono leggere le sezioni della guida"
  ON guida_sezioni
  FOR SELECT
  USING (true);

-- Policy: utenti autenticati possono inserire/modificare/eliminare
-- (il controllo admin è fatto lato applicazione)
CREATE POLICY "Utenti autenticati possono modificare la guida"
  ON guida_sezioni
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_guida_sezioni_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_guida_sezioni_updated_at
  BEFORE UPDATE ON guida_sezioni
  FOR EACH ROW
  EXECUTE FUNCTION update_guida_sezioni_updated_at();

-- Commenti
COMMENT ON TABLE guida_sezioni IS 'Sezioni della guida funzioni modificabili dagli admin';
COMMENT ON COLUMN guida_sezioni.id IS 'ID univoco della sezione (es: home, classifiche)';
COMMENT ON COLUMN guida_sezioni.icon IS 'Emoji icona della sezione';
COMMENT ON COLUMN guida_sezioni.title IS 'Titolo della sezione';
COMMENT ON COLUMN guida_sezioni.subtitle IS 'Sottotitolo/descrizione breve';
COMMENT ON COLUMN guida_sezioni.features IS 'Array di stringhe con le funzionalità descritte';
COMMENT ON COLUMN guida_sezioni.ordine IS 'Ordine di visualizzazione (0 = primo)';

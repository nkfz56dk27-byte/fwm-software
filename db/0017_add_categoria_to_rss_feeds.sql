-- ============================================
-- MIGRAZIONE: Aggiungere categoria_id a rss_feeds
-- ============================================
-- Questa migrazione permette di filtrare i feed RSS per categoria
-- in base ai gruppi di redattori assegnati

-- Aggiungi colonna categoria_id alla tabella rss_feeds
ALTER TABLE rss_feeds 
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorie_weekend(id) ON DELETE SET NULL;

-- Crea indice per migliorare le performance delle query filtrate per categoria
CREATE INDEX IF NOT EXISTS idx_rss_feeds_categoria_id ON rss_feeds(categoria_id);

-- Commento per documentazione
COMMENT ON COLUMN rss_feeds.categoria_id IS 'Riferimento alla categoria del feed RSS (es. Formula 1, Formula E, ecc). Null = visibile a tutti';

-- ============================================
-- MIGRAZIONE: Aggiungere logo_url a rss_feeds
-- ============================================
-- Questa migrazione permette di associare un logo personalizzato a ciascun feed RSS

-- Aggiungi colonna logo_url alla tabella rss_feeds
ALTER TABLE rss_feeds 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Commento per documentazione
COMMENT ON COLUMN rss_feeds.logo_url IS 'URL del logo da mostrare per gli articoli di questo feed';

-- Aggiunge la colonna card_target per indicare la card di destinazione nel pannello fonti
ALTER TABLE rss_feeds
ADD COLUMN IF NOT EXISTS card_target TEXT;

-- Opzionale: commento per documentazione
COMMENT ON COLUMN rss_feeds.card_target IS 'Card di destinazione per il feed RSS (f1, fe, other)';

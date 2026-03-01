-- Aggiungi colonne mancanti a monitored_urls se non esistono
ALTER TABLE monitored_urls
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorie_weekend(id),
ADD COLUMN IF NOT EXISTS card_target TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

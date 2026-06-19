-- Tabella per URL monitorati dagli utenti
CREATE TABLE IF NOT EXISTS monitored_urls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    url text NOT NULL,
    created_at timestamptz DEFAULT now(),
    last_checked timestamptz,
    last_result jsonb,
    last_hash text,

    logo_url TEXT,
    categoria_id UUID REFERENCES categorie_weekend(id),
    card_target TEXT,
    UNIQUE (user_id, url)
);

-- Indicizzazione per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_monitored_urls_user ON monitored_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_urls_url ON monitored_urls(url);

-- ============================================
-- TABELLA RSS FEEDS
-- ============================================
CREATE TABLE rss_feeds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commenti per documentazione
COMMENT ON TABLE rss_feeds IS 'Tabella per memorizzare i feed RSS da cui estrarre articoli';
COMMENT ON COLUMN rss_feeds.id IS 'ID univoco del feed';
COMMENT ON COLUMN rss_feeds.url IS 'URL del feed RSS';
COMMENT ON COLUMN rss_feeds.created_at IS 'Data di creazione del record';

-- ============================================
-- TABELLA RSS ARTICLES (per salvare articoli)
-- ============================================
CREATE TABLE rss_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    feed_id UUID REFERENCES rss_feeds(id) ON DELETE CASCADE,
    title TEXT,
    link TEXT,
    description TEXT,
    content TEXT,
    pub_date TIMESTAMP WITH TIME ZONE,
    guid TEXT,
    author TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guid, feed_id) -- Evita duplicati dello stesso articolo
);

-- Commenti per documentazione
COMMENT ON TABLE rss_articles IS 'Tabella per memorizzare gli articoli estratti dai feed RSS';
COMMENT ON COLUMN rss_articles.feed_id IS 'Riferimento al feed RSS di origine';
COMMENT ON COLUMN rss_articles.title IS 'Titolo dell articolo';
COMMENT ON COLUMN rss_articles.link IS 'Link all articolo originale';
COMMENT ON COLUMN rss_articles.description IS 'Descrizione/summary dell articolo';
COMMENT ON COLUMN rss_articles.content IS 'Contenuto completo dell articolo';
COMMENT ON COLUMN rss_articles.pub_date IS 'Data di pubblicazione originale';
COMMENT ON COLUMN rss_articles.guid IS 'Identificatore univoco dell articolo';
COMMENT ON COLUMN rss_articles.author IS 'Autore dell articolo';
COMMENT ON COLUMN rss_articles.created_at IS 'Data di inserimento nel database';
COMMENT ON COLUMN rss_articles.updated_at IS 'Data di ultimo aggiornamento';

-- ============================================
-- INDICI PER MIGLIORARE LE PERFORMANCE
-- ============================================
-- Indice per ricerche veloci sugli articoli
CREATE INDEX idx_rss_articles_pub_date ON rss_articles(pub_date DESC);
CREATE INDEX idx_rss_articles_feed_id ON rss_articles(feed_id);
CREATE INDEX idx_rss_articles_created_at ON rss_articles(created_at);
CREATE INDEX idx_rss_articles_title ON rss_articles USING gin(to_tsvector('italian', title));

-- ============================================
-- TABELLA PRENOTAZIONI ARTICOLI
-- ============================================
CREATE TABLE prenotazioni_articoli (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    articolo_id UUID REFERENCES rss_articles(id) ON DELETE CASCADE,
    username TEXT NOT NULL REFERENCES utenti(username),
    data_prenotazione TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stato TEXT DEFAULT 'prenotato' CHECK (stato IN ('prenotato', 'pubblicato', 'annullato')),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commenti per documentazione
COMMENT ON TABLE prenotazioni_articoli IS 'Tabella per gestire prenotazioni articoli';
COMMENT ON COLUMN prenotazioni_articoli.articolo_id IS 'Riferimento all articolo prenotato';
COMMENT ON COLUMN prenotazioni_articoli.username IS 'Utente che ha prenotato';
COMMENT ON COLUMN prenotazioni_articoli.data_prenotazione IS 'Data della prenotazione';
COMMENT ON COLUMN prenotazioni_articoli.stato IS 'Stato: prenotato/pubblicato/annullato';
COMMENT ON COLUMN prenotazioni_articoli.note IS 'Note aggiuntive sulla prenotazione';

-- Indici per performance
CREATE INDEX idx_prenotazioni_articoli_articolo_id ON prenotazioni_articoli(articolo_id);
CREATE INDEX idx_prenotazioni_articoli_username ON prenotazioni_articoli(username);
CREATE INDEX idx_prenotazioni_articoli_stato ON prenotazioni_articoli(stato);
CREATE INDEX idx_prenotazioni_articoli_data ON prenotazioni_articoli(data_prenotazione DESC);

-- ============================================
-- INDICI PER MIGLIORARE LE PERFORMANCE
-- ============================================
-- Indice per ricerche veloci sugli articoli
CREATE INDEX idx_rss_articles_pub_date ON rss_articles(pub_date DESC);
CREATE INDEX idx_rss_articles_feed_id ON rss_articles(feed_id);
CREATE INDEX idx_rss_articles_title ON rss_articles USING gin(to_tsvector('italian', title));

-- ============================================
-- POLICY DI SICUREZZA (Row Level Security)
-- ============================================
-- Abilita RLS
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_articles ENABLE ROW LEVEL SECURITY;

-- Policy per permettere lettura a tutti
CREATE POLICY "Allow read access to rss_feeds" ON rss_feeds FOR SELECT USING (true);
CREATE POLICY "Allow read access to rss_articles" ON rss_articles FOR SELECT USING (true);

-- Policy per permettere inserimento solo agli admin
CREATE POLICY "Allow insert rss_feeds to admin" ON rss_feeds FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM utenti 
        WHERE utenti.username = auth.jwt()->>'username' 
        AND utenti.ruolo = 'admin'
    )
);

CREATE POLICY "Allow insert rss_articles to admin" ON rss_articles FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM utenti 
        WHERE utenti.username = auth.jwt()->>'username' 
        AND utenti.ruolo = 'admin'
    )
);

-- Policy per permettere update/delete solo agli admin
CREATE POLICY "Allow update/delete rss_feeds to admin" ON rss_feeds FOR ALL USING (
    EXISTS (
        SELECT 1 FROM utenti 
        WHERE utenti.username = auth.jwt()->>'username' 
        AND utenti.ruolo = 'admin'
    )
);

CREATE POLICY "Allow update/delete rss_articles to admin" ON rss_articles FOR ALL USING (
    EXISTS (
        SELECT 1 FROM utenti 
        WHERE utenti.username = auth.jwt()->>'username' 
        AND utenti.ruolo = 'admin'
    )
);

-- ============================================
-- TRIGGER PER AGGIORNARE TIMESTAMP
-- ============================================
-- Funzione per aggiornare updated_at (se vuoi aggiungere questo campo)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Se vuoi aggiungere campo updated_at alle tabelle:
-- ALTER TABLE rss_feeds ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- ALTER TABLE rss_articles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- CREATE TRIGGER update_rss_feeds_updated_at BEFORE UPDATE ON rss_feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_rss_articles_updated_at BEFORE UPDATE ON rss_articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

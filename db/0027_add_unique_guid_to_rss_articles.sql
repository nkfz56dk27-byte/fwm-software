-- Migrazione per aggiungere indice UNIQUE su guid in rss_articles
-- Evita errore se l'indice esiste già

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'rss_articles' AND indexname = 'unique_guid'
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX unique_guid ON rss_articles(guid)';
    END IF;
END$$;

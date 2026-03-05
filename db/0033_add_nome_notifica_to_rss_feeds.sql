-- Aggiungi colonna nome_notifica per personalizzare il nome mostrato nelle notifiche RSS
ALTER TABLE rss_feeds 
ADD COLUMN IF NOT EXISTS nome_notifica TEXT;

-- Commento per documentare la colonna
COMMENT ON COLUMN rss_feeds.nome_notifica IS 'Nome personalizzato da mostrare nelle notifiche push RSS. Se NULL, viene usato il campo nome.';

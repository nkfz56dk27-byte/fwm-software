-- Tabella buffer per articoli RSS in attesa di essere mostrati all'utente
CREATE TABLE IF NOT EXISTS rss_articles_buffer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid REFERENCES rss_feeds(id) ON DELETE CASCADE,
  title text NOT NULL,
  link text NOT NULL,
  description text,
  content text,
  pub_date timestamptz NOT NULL,
  guid text NOT NULL,
  author text,
  created_at timestamptz DEFAULT now(),
  -- opzionale: username destinatario, se vuoi buffer per utente
  username text
);

-- Indice per guid+feed_id per evitare duplicati
CREATE UNIQUE INDEX IF NOT EXISTS idx_rss_articles_buffer_guid_feed ON rss_articles_buffer(guid, feed_id);

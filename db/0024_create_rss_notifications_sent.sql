-- Registro invii notifiche RSS per evitare duplicati

CREATE TABLE IF NOT EXISTS rss_notifications_sent (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  article_guid TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_rss_notifications_sent
  ON rss_notifications_sent (username, article_guid);

CREATE INDEX IF NOT EXISTS idx_rss_notifications_sent_username
  ON rss_notifications_sent (username);

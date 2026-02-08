-- Tabelle per filtri notifiche RSS (keyword/feed)

CREATE TABLE IF NOT EXISTS rss_notification_filters (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  filter_type TEXT NOT NULL CHECK (filter_type IN ('keyword','feed')),
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_rss_notification_filters
  ON rss_notification_filters (username, filter_type, value);

CREATE INDEX IF NOT EXISTS idx_rss_notification_filters_username
  ON rss_notification_filters (username);

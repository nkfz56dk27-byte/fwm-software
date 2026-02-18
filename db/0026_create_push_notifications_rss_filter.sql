-- Tabella dedicata alle notifiche push filtrate dal pannello fonti (RSS)
CREATE TABLE IF NOT EXISTS push_notifications_rss_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    notification_type TEXT NOT NULL DEFAULT 'rss_filter',
    target_users TEXT[] NOT NULL,
    data JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Indice per ricerca rapida su status
CREATE INDEX IF NOT EXISTS idx_push_notifications_rss_filter_status ON push_notifications_rss_filter(status);
-- Indice per ricerca su target_users
CREATE INDEX IF NOT EXISTS idx_push_notifications_rss_filter_target_users ON push_notifications_rss_filter USING GIN(target_users);
-- Indice per created_at
CREATE INDEX IF NOT EXISTS idx_push_notifications_rss_filter_created_at ON push_notifications_rss_filter(created_at);
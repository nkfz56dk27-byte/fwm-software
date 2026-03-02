-- Tabella per gestire le notifiche push per i link monitorati
CREATE TABLE IF NOT EXISTS push_notifications_monitored_urls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    url_id uuid REFERENCES monitored_urls(id) ON DELETE CASCADE NOT NULL,
    title text,
    body text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error text,
    onesignal_id text,
    created_at timestamptz DEFAULT now(),
    sent_at timestamptz,
    UNIQUE (user_id, url_id, status)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_push_notif_monitored_status ON push_notifications_monitored_urls(status);
CREATE INDEX IF NOT EXISTS idx_push_notif_monitored_user ON push_notifications_monitored_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notif_monitored_url ON push_notifications_monitored_urls(url_id);
CREATE INDEX IF NOT EXISTS idx_push_notif_monitored_created ON push_notifications_monitored_urls(created_at);

-- Tabella per gestire le subscription alle notifiche dei link monitorati
CREATE TABLE IF NOT EXISTS monitored_urls_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url_id uuid REFERENCES monitored_urls(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE (url_id, user_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_monitored_urls_subs_url ON monitored_urls_subscriptions(url_id);
CREATE INDEX IF NOT EXISTS idx_monitored_urls_subs_user ON monitored_urls_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_urls_subs_active ON monitored_urls_subscriptions(active);

-- RLS policies
ALTER TABLE monitored_urls_subscriptions ENABLE ROW LEVEL SECURITY;

-- Gli utenti possono vedere solo le proprie subscription
CREATE POLICY "Users can view their own subscriptions"
    ON monitored_urls_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Gli utenti possono creare subscription per se stessi
CREATE POLICY "Users can create their own subscriptions"
    ON monitored_urls_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Gli utenti possono aggiornare le proprie subscription
CREATE POLICY "Users can update their own subscriptions"
    ON monitored_urls_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- Gli utenti possono eliminare le proprie subscription
CREATE POLICY "Users can delete their own subscriptions"
    ON monitored_urls_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

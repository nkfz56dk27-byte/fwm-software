-- Tabella notifiche push per calendario accrediti
CREATE TABLE IF NOT EXISTS push_calendario_accrediti (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    target_all BOOLEAN DEFAULT true,
    data JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice per velocizzare le query sulle notifiche non inviate
CREATE INDEX IF NOT EXISTS idx_push_calendario_accrediti_status ON push_calendario_accrediti(status);

-- Esempio di inserimento
-- INSERT INTO push_calendario_accrediti (title, body, notification_type, target_all, data) VALUES ('Titolo', 'Messaggio', 'tipo', true, '{"eventoId":123}');

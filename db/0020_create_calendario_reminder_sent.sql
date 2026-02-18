-- Tabella per tracciare i reminder inviati per gli eventi calendario
-- Previene l'invio di duplicate notifiche dello stesso reminder

CREATE TABLE IF NOT EXISTS calendario_reminder_sent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id UUID NOT NULL REFERENCES eventi_calendario(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL DEFAULT 'due_days', -- tipo di reminder (es. 'due_days')
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    notification_sent_at TIMESTAMP WITH TIME ZONE, -- quando è stata inviata la notifica push
    status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'pending'
    error_message TEXT, -- messaggio d'errore se il send fallisce
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_calendario_reminder_sent_evento_id ON calendario_reminder_sent(evento_id);
CREATE INDEX IF NOT EXISTS idx_calendario_reminder_sent_reminder_type ON calendario_reminder_sent(reminder_type);
CREATE INDEX IF NOT EXISTS idx_calendario_reminder_sent_status ON calendario_reminder_sent(status);

-- Unique constraint: un reminder per tipo per evento
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendario_reminder_unique 
ON calendario_reminder_sent(evento_id, reminder_type) 
WHERE status = 'sent';

COMMENT ON TABLE calendario_reminder_sent IS 'Traccia i reminder inviati per gli eventi del calendario accrediti. Previene duplicati.';
COMMENT ON COLUMN calendario_reminder_sent.evento_id IS 'ID dell''evento calendario (UUID)';
COMMENT ON COLUMN calendario_reminder_sent.reminder_type IS 'Tipo di reminder (es. due_days per 2 giorni prima)';
COMMENT ON COLUMN calendario_reminder_sent.status IS 'Stato del reminder: sent=inviato, failed=fallito, pending=in attesa';
COMMENT ON COLUMN calendario_reminder_sent.notification_sent_at IS 'Timestamp quando la notifica push è stata inviata';

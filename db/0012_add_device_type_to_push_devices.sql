-- Aggiungi colonna device_type a push_devices
ALTER TABLE push_devices ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'desktop';

-- Commento per documentazione
COMMENT ON COLUMN push_devices.device_type IS 'Tipo di dispositivo: desktop, mobile, tablet';

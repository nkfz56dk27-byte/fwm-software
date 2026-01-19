-- Abilita l'estensione pg_cron per i job schedulati
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Crea una funzione per cancellare le infrazioni scadute
CREATE OR REPLACE FUNCTION delete_expired_infrazioni()
RETURNS void AS $$
BEGIN
  DELETE FROM infrazioni
  WHERE data_scadenza < CURRENT_DATE;
  
  -- Log della cancellazione (opzionale)
  RAISE NOTICE 'Infrazioni scadute cancellate';
END;
$$ LANGUAGE plpgsql;

-- Schedula l'esecuzione ogni giorno a mezzanotte (00:00)
SELECT cron.schedule(
  'delete_expired_infrazioni_daily',  -- Nome del job
  '0 0 * * *',                         -- Cron expression: ogni giorno a mezzanotte
  'SELECT delete_expired_infrazioni()' -- Funzione da eseguire
);

-- Per verificare i job schedulati, usa:
-- SELECT * FROM cron.job;

-- Per cancellare il job (se necessario):
-- SELECT cron.unschedule('delete_expired_infrazioni_daily');

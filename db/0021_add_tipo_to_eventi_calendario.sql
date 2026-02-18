-- Migrazione: Aggiungere campo 'tipo' alla tabella eventi_calendario
-- Questo campo distingue tra 'gara' (gare di campionato) e 'evento' (altri eventi)

-- Aggiungi colonna tipo se non esiste
ALTER TABLE eventi_calendario 
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'gara';

-- Imposta i valori esistenti basandosi su campionato_id
-- Se ha campionato_id -> è una gara, altrimenti è un evento
UPDATE eventi_calendario 
SET tipo = CASE 
  WHEN campionato_id IS NOT NULL THEN 'gara'
  ELSE 'evento'
END
WHERE tipo IS NULL OR tipo = 'gara';

-- Commento sulla colonna
COMMENT ON COLUMN eventi_calendario.tipo IS 'Tipo di evento: gara (con campionato) o evento (generico)';

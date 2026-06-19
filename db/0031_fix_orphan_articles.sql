-- Ripulisce articoli orfani (assegnati ma senza nome redattore)
-- Questi articoli erano stati prenotati prima che il mapping fosse corretto

UPDATE articoli 
SET stato = 'libero', assegnato_a = NULL 
WHERE stato = 'assegnato' 
AND (assegnato_a IS NULL OR assegnato_a = '');

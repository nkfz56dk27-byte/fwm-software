-- Script per rimuovere tutti i trigger dalla tabella prenotazioni_accrediti
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'prenotazioni_accrediti') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON prenotazioni_accrediti;';
    END LOOP;
END$$;

-- (Opzionale) Mostra i trigger rimossi
-- SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'prenotazioni_accrediti';

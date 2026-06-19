-- Script per pulire dati vecchi guida_sezioni
-- Questo rimuove tutti i dati con foto base64 che causano timeout

DELETE FROM guida_sezioni;

-- Le sezioni verranno ricreate automaticamente al primo accesso

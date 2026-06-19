-- Aggiunge il campo nome_redattore alla tabella utenti
-- Questo campo permette di specificare il nome breve del redattore
-- senza dover modificare il codice ogni volta

ALTER TABLE utenti ADD COLUMN IF NOT EXISTS nome_redattore TEXT;

-- Popola i dati esistenti con il mapping attuale
UPDATE utenti SET nome_redattore = 'Giuseppe' WHERE username = 'gcianci';
UPDATE utenti SET nome_redattore = 'Daniele' WHERE username = 'dmuscarella';
UPDATE utenti SET nome_redattore = 'Marco' WHERE username = 'msassara';
UPDATE utenti SET nome_redattore = 'Alessio' WHERE username = 'aciancola';
UPDATE utenti SET nome_redattore = 'Prisca' WHERE username = 'pmanzoni';
UPDATE utenti SET nome_redattore = 'Fabrizio' WHERE username = 'fparascandolo';
UPDATE utenti SET nome_redattore = 'Valeria' WHERE username = 'vcaravella';
UPDATE utenti SET nome_redattore = 'Martina' WHERE username = 'mluraghi';
UPDATE utenti SET nome_redattore = 'Flavia' WHERE username = 'fdelfini';
UPDATE utenti SET nome_redattore = 'Nicole' WHERE username = 'nmaruzzo';
UPDATE utenti SET nome_redattore = 'Sofia' WHERE username = 'sderamo';
UPDATE utenti SET nome_redattore = 'Veronica' WHERE username = 'vcancelliere';
UPDATE utenti SET nome_redattore = 'Alessia' WHERE username = 'avalerioti';
UPDATE utenti SET nome_redattore = 'Mattia' WHERE username = 'mdelia';

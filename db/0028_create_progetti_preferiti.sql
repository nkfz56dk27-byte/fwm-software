-- Crea la tabella per i progetti preferiti degli utenti
CREATE TABLE IF NOT EXISTS progetti_preferiti (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    project_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, project_id)
);

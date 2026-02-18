-- Tabella: categorie_weekend
CREATE TABLE IF NOT EXISTS categorie_weekend (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  colore TEXT,
  emoji TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabella: gruppi_redattori
CREATE TABLE IF NOT EXISTS gruppi_redattori (
  id SERIAL PRIMARY KEY,
  categoria_id INTEGER REFERENCES categorie_weekend(id) ON DELETE CASCADE,
  username TEXT REFERENCES utenti(username),
  created_at TIMESTAMP DEFAULT NOW()
);

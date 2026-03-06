-- Tabella per salvare i template dell'ordinatore di tabelle classifiche
CREATE TABLE IF NOT EXISTS ordina_tabella_templates (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL REFERENCES utenti(username) ON DELETE CASCADE,
  nome_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index per ricerca rapida per username
CREATE INDEX IF NOT EXISTS idx_ordina_tabella_templates_username ON ordina_tabella_templates(username);

-- RLS (Row Level Security)
ALTER TABLE ordina_tabella_templates ENABLE ROW LEVEL SECURITY;

-- Policy: gli utenti possono vedere solo i propri template
CREATE POLICY "Users can view own templates" ON ordina_tabella_templates
  FOR SELECT USING (auth.jwt() ->> 'username' = username);

-- Policy: gli utenti possono inserire solo i propri template
CREATE POLICY "Users can insert own templates" ON ordina_tabella_templates
  FOR INSERT WITH CHECK (auth.jwt() ->> 'username' = username);

-- Policy: gli utenti possono modificare solo i propri template
CREATE POLICY "Users can update own templates" ON ordina_tabella_templates
  FOR UPDATE USING (auth.jwt() ->> 'username' = username);

-- Policy: gli utenti possono eliminare solo i propri template
CREATE POLICY "Users can delete own templates" ON ordina_tabella_templates
  FOR DELETE USING (auth.jwt() ->> 'username' = username);

-- Commento sulla tabella
COMMENT ON TABLE ordina_tabella_templates IS 'Template salvati per l''ordinatore di tabelle classifiche HTML';
COMMENT ON COLUMN ordina_tabella_templates.nome_template IS 'Nome del template (es: Formula 2, Formula 3)';
COMMENT ON COLUMN ordina_tabella_templates.html_template IS 'Codice HTML della tabella salvata';

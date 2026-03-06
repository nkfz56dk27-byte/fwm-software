-- Fix RLS policies per ordina_tabella_templates
-- Problema: auth.jwt() ->> 'username' non esiste nel JWT di Supabase
-- Soluzione: Aggiungiamo user_id e usiamo quello per RLS

-- Aggiungi colonna user_id
ALTER TABLE ordina_tabella_templates 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Crea indice su user_id
CREATE INDEX IF NOT EXISTS idx_ordina_tabella_templates_user_id ON ordina_tabella_templates(user_id);

-- Disabilita le vecchie policies (se esistono)
DROP POLICY IF EXISTS "Users can view own templates" ON ordina_tabella_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON ordina_tabella_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON ordina_tabella_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON ordina_tabella_templates;

-- Abilita RLS
ALTER TABLE ordina_tabella_templates ENABLE ROW LEVEL SECURITY;

-- Nuove policies basate su user_id
CREATE POLICY "users_can_select_own_ordina_templates" ON ordina_tabella_templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_can_insert_own_ordina_templates" ON ordina_tabella_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_update_own_ordina_templates" ON ordina_tabella_templates
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_ordina_templates" ON ordina_tabella_templates
  FOR DELETE
  USING (auth.uid() = user_id);

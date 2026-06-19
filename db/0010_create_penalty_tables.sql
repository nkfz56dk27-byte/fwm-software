-- Create campionati_penalty table
CREATE TABLE IF NOT EXISTS campionati_penalty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  colore TEXT DEFAULT '#007AFF',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categorie_penalty table
CREATE TABLE IF NOT EXISTS categorie_penalty (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campionato_id UUID NOT NULL REFERENCES campionati_penalty(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  colore TEXT DEFAULT '#007AFF',
  numero_piloti INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campionato_id, nome)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categorie_penalty_campionato_id ON categorie_penalty(campionato_id);

-- Insert default campionati if none exist
INSERT INTO campionati_penalty (nome, colore) VALUES
  ('Formula 1', '#E10600'),
  ('Formula E', '#0098DB')
ON CONFLICT (nome) DO NOTHING;

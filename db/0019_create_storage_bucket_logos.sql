-- ============================================
-- MIGRAZIONE: Creare bucket Storage per loghi feed
-- ============================================
-- Questo crea un bucket pubblico per salvare i loghi dei feed RSS

-- Inserisci il bucket nella tabella storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('feed-logos', 'feed-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Rimuovi policy esistenti se presenti
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;

-- Policy per permettere a tutti di leggere i file (pubblico)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'feed-logos' );

-- Policy per permettere upload autenticati
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'feed-logos' 
  AND auth.role() = 'authenticated'
);

-- Policy per permettere aggiornamento file
CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'feed-logos'
  AND auth.role() = 'authenticated'
);

-- Policy per permettere cancellazione file
CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'feed-logos'
  AND auth.role() = 'authenticated'
);

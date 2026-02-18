-- Permessi RLS per upload loghi feed anche senza auth Supabase

DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Public users can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Public users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Public users can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Public users can delete logos" ON storage.objects;

-- Upload pubblico limitato al bucket feed-logos
CREATE POLICY "Public users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'feed-logos'
);

-- Select pubblico limitato al bucket feed-logos
CREATE POLICY "Public users can view logos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'feed-logos'
);

-- Update pubblico limitato al bucket feed-logos
CREATE POLICY "Public users can update logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'feed-logos'
);

-- Delete pubblico limitato al bucket feed-logos
CREATE POLICY "Public users can delete logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'feed-logos'
);

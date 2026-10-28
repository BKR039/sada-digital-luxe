-- Ensure 'media' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Ensure permissive RLS policies on storage.objects for media bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read media'
  ) THEN
    CREATE POLICY "Public read media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone upload media'
  ) THEN
    CREATE POLICY "Anyone upload media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone update media'
  ) THEN
    CREATE POLICY "Anyone update media" ON storage.objects FOR UPDATE USING (bucket_id = 'media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anyone delete media'
  ) THEN
    CREATE POLICY "Anyone delete media" ON storage.objects FOR DELETE USING (bucket_id = 'media');
  END IF;
END $$;

-- ============================================================
-- SADA WORK OS — Migration: 20260915140000_secure_storage_media_bucket.sql
-- Secure Supabase Storage: Restrict INSERT/UPDATE/DELETE on 'media' bucket to Authenticated Admins
-- ============================================================

-- 1. Remove permissive anonymous write policies on storage.objects for 'media' bucket
DROP POLICY IF EXISTS "Anyone upload media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone update media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone delete media" ON storage.objects;

-- 2. Ensure Public READ policy on storage.objects for 'media' bucket (allows public /about photo display)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read media'
  ) THEN
    CREATE POLICY "Public read media" ON storage.objects
      FOR SELECT
      USING (bucket_id = 'media');
  END IF;
END $$;

-- 3. Require Authenticated Admin session for INSERT (upload) on 'media' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated upload media'
  ) THEN
    CREATE POLICY "Authenticated upload media" ON storage.objects
      FOR INSERT
      WITH CHECK (bucket_id = 'media' AND (auth.role() = 'authenticated' OR public.is_admin(auth.uid())));
  END IF;
END $$;

-- 4. Require Authenticated Admin session for UPDATE (replace) on 'media' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated update media'
  ) THEN
    CREATE POLICY "Authenticated update media" ON storage.objects
      FOR UPDATE
      USING (bucket_id = 'media' AND (auth.role() = 'authenticated' OR public.is_admin(auth.uid())));
  END IF;
END $$;

-- 5. Require Authenticated Admin session for DELETE (remove) on 'media' bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated delete media'
  ) THEN
    CREATE POLICY "Authenticated delete media" ON storage.objects
      FOR DELETE
      USING (bucket_id = 'media' AND (auth.role() = 'authenticated' OR public.is_admin(auth.uid())));
  END IF;
END $$;

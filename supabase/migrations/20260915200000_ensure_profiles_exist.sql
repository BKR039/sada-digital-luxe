-- ============================================================
-- SADA WORK OS — Migration: 20260915140000_ensure_profiles_exist.sql
-- Safety net: Ensure all auth.users have a corresponding profiles row.
-- This prevents FK violations when project_tasks.assigned_by_id
-- references profiles.id and the user profile was never created
-- (e.g., user created via Supabase dashboard instead of app signup).
-- ============================================================

-- Backfill any auth.users that are missing a profiles row
INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', u.email)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- Also ensure the handle_new_user trigger is robust:
-- Replace with an upsert-safe version that won't fail on duplicate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

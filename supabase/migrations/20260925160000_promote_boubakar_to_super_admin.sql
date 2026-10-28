-- ============================================================
-- SADA WORK OS — Migration: 20260925160000_promote_boubakar_to_super_admin.sql
-- Promote canonical Boubakar Hamed account to Super Admin
-- ============================================================

DO $$
DECLARE
  _boubakar_uid UUID := 'f4184256-97c4-4f81-9346-176ec5dfb43a';
  _boubakar_tm_id UUID := 'b363b2c1-eb6c-4203-9180-ec69ebf41cb7';
BEGIN
  -- 1. Ensure user_roles has 'super_admin' for Boubakar
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _boubakar_uid) THEN
    UPDATE public.user_roles
    SET role = 'super_admin'
    WHERE user_id = _boubakar_uid;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_boubakar_uid, 'super_admin');
  END IF;

  -- 2. Synchronize team_members role to 'super_admin'
  UPDATE public.team_members
  SET role = 'super_admin',
      updated_at = now()
  WHERE id = _boubakar_tm_id OR profile_id = _boubakar_uid OR email = 'boubakar.hamedsghaier@gmail.com';
END $$;

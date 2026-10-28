-- ============================================================
-- SADA WORK OS — Migration: 20261006140000_account_module_permissions.sql
-- Module: Secure Account Member Management & Module/Page Permissions
-- User -> Role -> Effective Permissions Architecture
-- ============================================================

-- 1. Profiles Table Extension: module_permissions column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS module_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Dedicated user_module_permissions table
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  actions JSONB NOT NULL DEFAULT '{"view": true, "create": true, "edit": true, "delete": false, "approve": false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user ON public.user_module_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_module ON public.user_module_permissions(module);

-- 3. Row Level Security for user_module_permissions
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins manage user_module_permissions" ON public.user_module_permissions;
CREATE POLICY "Super Admins manage user_module_permissions"
  ON public.user_module_permissions
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view own module permissions" ON public.user_module_permissions;
CREATE POLICY "Users view own module permissions"
  ON public.user_module_permissions
  FOR SELECT
  USING (user_id = auth.uid());

-- 4. Super Admin RPC: admin_update_account_permissions
CREATE OR REPLACE FUNCTION public.admin_update_account_permissions(
  _target_user_id UUID,
  _permissions JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _target_is_super_admin BOOLEAN;
  _mod_key TEXT;
  _mod_val JSONB;
  _is_enabled BOOLEAN;
BEGIN
  -- 1. Authorization Guard: ONLY Super Admin can manage permissions
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can modify account permissions.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _target_user_id;

  -- 2. Prevent modifying root Super Admin access if target is the last super admin
  SELECT (COALESCE(role::text, '') = 'super_admin') INTO _target_is_super_admin
  FROM public.user_roles WHERE user_id = _target_user_id LIMIT 1;

  -- 3. Update public.profiles
  UPDATE public.profiles
  SET module_permissions = _permissions,
      updated_at = now()
  WHERE id = _target_user_id;

  -- 4. Synchronize user_module_permissions table
  FOR _mod_key, _mod_val IN SELECT * FROM jsonb_each(_permissions) LOOP
    IF jsonb_typeof(_mod_val) = 'boolean' THEN
      _is_enabled := _mod_val::boolean;
      INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
      VALUES (
        _target_user_id,
        _mod_key,
        _is_enabled,
        jsonb_build_object('view', _is_enabled, 'create', _is_enabled, 'edit', _is_enabled, 'delete', false, 'approve', false),
        now()
      )
      ON CONFLICT (user_id, module) DO UPDATE SET
        enabled = _is_enabled,
        actions = jsonb_build_object('view', _is_enabled, 'create', _is_enabled, 'edit', _is_enabled, 'delete', false, 'approve', false),
        updated_at = now();
    ELSIF jsonb_typeof(_mod_val) = 'object' THEN
      _is_enabled := COALESCE((_mod_val->>'enabled')::boolean, true);
      INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
      VALUES (
        _target_user_id,
        _mod_key,
        _is_enabled,
        COALESCE(_mod_val->'actions', '{}'::jsonb),
        now()
      )
      ON CONFLICT (user_id, module) DO UPDATE SET
        enabled = _is_enabled,
        actions = COALESCE(_mod_val->'actions', user_module_permissions.actions),
        updated_at = now();
    END IF;
  END LOOP;

  -- 5. Audit Logging
  INSERT INTO public.account_audit_logs (
    actor_id,
    actor_email,
    target_user_id,
    target_email,
    action,
    metadata
  ) VALUES (
    _actor_id,
    _actor_email,
    _target_user_id,
    _target_email,
    'account_permissions_updated',
    jsonb_build_object(
      'permissions', _permissions,
      'updated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _target_user_id,
    'permissions', _permissions
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account_permissions(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account_permissions(UUID, JSONB) TO authenticated, service_role;

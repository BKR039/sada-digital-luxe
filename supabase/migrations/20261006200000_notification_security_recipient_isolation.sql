-- ============================================================
-- SADA OS — PHASE 8: NOTIFICATION SECURITY & RECIPIENT ISOLATION
-- Migration: 20261006200000_notification_security_recipient_isolation.sql
--
-- 1. Adds rich context and localization columns to public.notifications
-- 2. Priority weight ordering function for indexed priority-first sorting
-- 3. Strict Recipient & Category Isolation RLS:
--    - Worker A cannot see Worker B notifications
--    - Workers cannot see Admin-only or Super-Admin notifications
--    - Finance notifications isolated to users with explicit finance module permission
-- ============================================================

-- 1. Add context and structured localization columns if they don't exist
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS context_title TEXT,
  ADD COLUMN IF NOT EXISTS source_module TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS i18n_key TEXT,
  ADD COLUMN IF NOT EXISTS i18n_params JSONB DEFAULT '{}'::jsonb;

-- 2. Enforce priority values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_notifications_priority'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT check_notifications_priority
      CHECK (priority IN ('urgent', 'high', 'normal', 'low'));
  END IF;
END $$;

-- 3. Priority Weight Ordering Function (Urgent > High > Normal > Low)
CREATE OR REPLACE FUNCTION public.notification_priority_weight(_priority TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE LOWER(_priority)
    WHEN 'urgent' THEN 4
    WHEN 'high' THEN 3
    WHEN 'normal' THEN 2
    WHEN 'low' THEN 1
    ELSE 2
  END;
$$;

-- Create functional index for fast priority-first + recency sorting
CREATE INDEX IF NOT EXISTS idx_notifications_priority_created 
  ON public.notifications (public.notification_priority_weight(priority) DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_priority_created
  ON public.notifications (user_id, public.notification_priority_weight(priority) DESC, created_at DESC);

-- 4. Secure RLS Policies with Strict Recipient and Finance Isolation

DROP POLICY IF EXISTS "Users read relevant notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized users read relevant notifications" ON public.notifications;

CREATE POLICY "Authorized users read relevant notifications"
  ON public.notifications FOR SELECT
  USING (
    -- Super Admin has root access to all notifications
    public.is_super_admin(auth.uid())

    -- Direct personal notification: recipient must match auth.uid()
    OR (
      user_id IS NOT NULL 
      AND user_id = auth.uid()
    )

    -- Broadcast notification (user_id is NULL)
    OR (
      user_id IS NULL AND (
        -- Admin broadcast: role_target in ('admin', 'worker', 'all')
        -- If finance/billing, requires explicit finance module permission
        (
          public.is_admin(auth.uid()) 
          AND role_target IN ('admin', 'worker', 'all')
          AND (
            category NOT IN ('finance', 'billing') 
            OR public.has_module_access(auth.uid(), 'finance')
          )
        )
        -- Worker broadcast: role_target in ('worker', 'all')
        -- Strictly non-finance, non-billing, non-security
        OR (
          NOT public.is_admin(auth.uid())
          AND role_target IN ('worker', 'all')
          AND category NOT IN ('finance', 'billing', 'security')
        )
      )
    )
  );

-- UPDATE policy: Only recipient or authorized broadcast reader can mark as read
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized users update own notifications" ON public.notifications;

CREATE POLICY "Authorized users update own notifications"
  ON public.notifications FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR (user_id IS NOT NULL AND user_id = auth.uid())
    OR (
      user_id IS NULL AND (
        (public.is_admin(auth.uid()) AND role_target IN ('admin', 'worker', 'all') AND (category NOT IN ('finance', 'billing') OR public.has_module_access(auth.uid(), 'finance')))
        OR (NOT public.is_admin(auth.uid()) AND role_target IN ('worker', 'all') AND category NOT IN ('finance', 'billing', 'security'))
      )
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (user_id IS NOT NULL AND user_id = auth.uid())
    OR (
      user_id IS NULL AND (
        (public.is_admin(auth.uid()) AND role_target IN ('admin', 'worker', 'all') AND (category NOT IN ('finance', 'billing') OR public.has_module_access(auth.uid(), 'finance')))
        OR (NOT public.is_admin(auth.uid()) AND role_target IN ('worker', 'all') AND category NOT IN ('finance', 'billing', 'security'))
      )
    )
  );

-- DELETE policy: Super Admin can delete any; users can delete their own personal notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized users delete own notifications" ON public.notifications;

CREATE POLICY "Authorized users delete own notifications"
  ON public.notifications FOR DELETE
  USING (
    public.is_super_admin(auth.uid())
    OR (user_id IS NOT NULL AND user_id = auth.uid())
  );

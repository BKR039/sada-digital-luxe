-- ============================================================
-- SADA OS — PHASE 7 & 8: NOTIFICATIONS, AUDIT & AUTOMATION
-- Event-driven notifications, role-aware delivery, user preferences,
-- unified system audit logs, and audit immutability triggers.
-- ============================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_target TEXT DEFAULT 'all', -- 'all', 'worker', 'admin', 'super_admin'
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'system', -- 'task', 'production', 'billing', 'finance', 'security', 'system'
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  link_url TEXT,
  entity_type TEXT,
  entity_id TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_role_created ON public.notifications(role_target, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON public.notifications(event_type);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read relevant notifications" ON public.notifications;
CREATE POLICY "Users read relevant notifications"
  ON public.notifications FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR (public.is_admin(auth.uid()) AND role_target IN ('admin', 'worker', 'all'))
    OR (role_target = 'worker' AND (user_id IS NULL OR user_id = auth.uid()))
    OR (role_target = 'all' AND (user_id IS NULL OR user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 2. NOTIFICATION PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  task_assigned BOOLEAN NOT NULL DEFAULT true,
  task_due_soon BOOLEAN NOT NULL DEFAULT true,
  task_overdue BOOLEAN NOT NULL DEFAULT true,
  client_approval_required BOOLEAN NOT NULL DEFAULT true,
  invoice_overdue BOOLEAN NOT NULL DEFAULT true,
  payment_received BOOLEAN NOT NULL DEFAULT true,
  commission_eligible BOOLEAN NOT NULL DEFAULT true,
  commission_approved BOOLEAN NOT NULL DEFAULT true,
  salary_paid BOOLEAN NOT NULL DEFAULT true,
  salary_request_pending BOOLEAN NOT NULL DEFAULT true,
  production_tomorrow BOOLEAN NOT NULL DEFAULT true,
  deliverable_behind BOOLEAN NOT NULL DEFAULT true,
  month_end_closing BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences FOR ALL
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

-- 3. UNIFIED SYSTEM AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values JSONB DEFAULT '{}'::jsonb,
  new_values JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_action ON public.system_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_system_audit_entity ON public.system_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_actor ON public.system_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_created ON public.system_audit_logs(created_at DESC);

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "Admins read system_audit_logs"
  ON public.system_audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated insert system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "Authenticated insert system_audit_logs"
  ON public.system_audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Strict RLS: Disallow DELETE for anyone
DROP POLICY IF EXISTS "Disallow DELETE on system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "Disallow DELETE on system_audit_logs"
  ON public.system_audit_logs FOR DELETE
  USING (false);

-- 4. DATABASE IMMUTABILITY TRIGGERS: PREVENT SILENT AUDIT DELETION
CREATE OR REPLACE FUNCTION public.prevent_audit_log_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable and cannot be deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_delete_system_audit
  BEFORE DELETE ON public.system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_deletion();

DROP TRIGGER IF EXISTS trg_prevent_delete_financial_audit ON public.financial_audit_logs;
CREATE TRIGGER trg_prevent_delete_financial_audit
  BEFORE DELETE ON public.financial_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_deletion();

DROP TRIGGER IF EXISTS trg_prevent_delete_account_audit ON public.account_audit_logs;
CREATE TRIGGER trg_prevent_delete_account_audit
  BEFORE DELETE ON public.account_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_deletion();

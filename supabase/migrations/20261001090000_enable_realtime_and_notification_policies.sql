-- ============================================================
-- SADA OS — REALTIME REPLICATION & NOTIFICATION RLS REMEDIATION
-- Enables PostgreSQL real-time streaming publication on core tables
-- and fixes RLS update policy for broadcast notifications.
-- ============================================================

-- 1. Ensure core tables are added to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'income_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.income_transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'expense_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expense_transactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'salary_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'invoices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
  END IF;
END $$;

-- 2. Set REPLICA IDENTITY FULL to guarantee full row context in real-time payloads
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.deals REPLICA IDENTITY FULL;
ALTER TABLE public.project_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.income_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.expense_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.salary_requests REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;

-- 3. Fix UPDATE policy on notifications:
-- Allow Super Admins, target recipients, and users with matching target roles
-- to mark broadcast/role-targeted notifications as read.
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR (public.is_admin(auth.uid()) AND role_target IN ('admin', 'worker', 'all'))
    OR (role_target IN ('worker', 'all'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR user_id = auth.uid()
    OR (public.is_admin(auth.uid()) AND role_target IN ('admin', 'worker', 'all'))
    OR (role_target IN ('worker', 'all'))
  );

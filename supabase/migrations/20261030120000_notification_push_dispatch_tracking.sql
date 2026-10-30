-- Track who created each notification and prevent replaying push sends.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

ALTER TABLE public.notifications
  ALTER COLUMN created_by SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Let a sender receive the inserted row ID for the authenticated push dispatch.
CREATE POLICY "Notification creators read own emitted notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

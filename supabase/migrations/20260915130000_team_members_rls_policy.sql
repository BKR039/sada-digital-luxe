-- Ensure permissive RLS policy for SADA Work OS team_members management
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Anyone manage team_members'
  ) THEN
    CREATE POLICY "Anyone manage team_members" ON public.team_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

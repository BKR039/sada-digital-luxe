-- ============================================================
-- SADA WORK OS — Migration: 20260914190000_unified_team_members.sql
-- Unified Team Member Model & Public/Operational Attributes
-- ============================================================

-- 1. Extend team_members table schema
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'Development',
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS availability_status TEXT NOT NULL DEFAULT 'available'
    CHECK (availability_status IN ('available', 'busy', 'overloaded', 'on_leave')),
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_active ON public.team_members(is_active);
CREATE INDEX IF NOT EXISTS idx_team_members_published ON public.team_members(published);
CREATE INDEX IF NOT EXISTS idx_team_members_sort ON public.team_members(sort_order);
CREATE INDEX IF NOT EXISTS idx_team_members_profile ON public.team_members(profile_id);

-- 2. Update existing seed team members with appropriate divisions & specialties
UPDATE public.team_members
SET division = 'Production', specialties = ARRAY['Brand & Art Direction', 'Creative Direction']
WHERE name = 'Yara El-Sayed';

UPDATE public.team_members
SET division = 'Marketing', specialties = ARRAY['Positioning & Growth', 'Brand Strategy']
WHERE name = 'Omar Khaled';

UPDATE public.team_members
SET division = 'Production', specialties = ARRAY['Cinematic Edits & Reels', 'Motion & Video']
WHERE name = 'Mira Haddad';

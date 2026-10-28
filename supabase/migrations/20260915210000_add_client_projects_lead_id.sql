-- ============================================================================
-- Migration: Add explicit Project Lead (lead_id) to client_projects
-- Table: public.client_projects
-- Foreign Key: public.profiles(id)
-- Constraints: Nullable for backward compatibility, ON DELETE SET NULL
-- Index: idx_client_projects_lead_id
-- ============================================================================

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_projects_lead_id ON public.client_projects(lead_id);

COMMENT ON COLUMN public.client_projects.lead_id IS 'Explicit Project Lead / Owner representing overall project ownership (references public.profiles.id)';

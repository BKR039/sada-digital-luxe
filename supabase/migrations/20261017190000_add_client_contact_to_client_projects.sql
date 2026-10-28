-- ============================================================
-- SADA OS — Phase 3: Structured Client Contact Migration
-- Migration: 20261017190000_add_client_contact_to_client_projects.sql
-- Description: Adds structured client_email and client_phone to client_projects,
-- creates search/filtering indexes, and performs idempotent backfill from
-- canonical clients and contact_submissions records.
-- ============================================================

-- 1. Extend client_projects with structured contact columns
ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- 2. Add search and filter indexes
CREATE INDEX IF NOT EXISTS idx_client_projects_client_email ON public.client_projects(client_email);
CREATE INDEX IF NOT EXISTS idx_client_projects_client_phone ON public.client_projects(client_phone);

-- 3. Idempotent Backfill:
-- Strategy A: Backfill from linked canonical client entity (clients table)
UPDATE public.client_projects cp
SET 
  client_email = COALESCE(cp.client_email, c.email),
  client_phone = COALESCE(cp.client_phone, c.phone)
FROM public.clients c
WHERE cp.client_id = c.id
  AND (cp.client_email IS NULL OR cp.client_phone IS NULL)
  AND (c.email IS NOT NULL OR c.phone IS NOT NULL);

-- Strategy B: Backfill from linked contact_submissions (inquiries table)
UPDATE public.client_projects cp
SET 
  client_email = COALESCE(cp.client_email, cs.email),
  client_phone = COALESCE(cp.client_phone, cs.phone)
FROM public.contact_submissions cs
WHERE cp.contact_submission_id = cs.id
  AND (cp.client_email IS NULL OR cp.client_phone IS NULL)
  AND (cs.email IS NOT NULL OR cs.phone IS NOT NULL);

-- Strategy C: Backfill from legacy description unstructured text if still NULL
UPDATE public.client_projects cp
SET
  client_email = COALESCE(cp.client_email, (regexp_match(cp.description, 'Email:[[:space:]]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})'))[1]),
  client_phone = COALESCE(cp.client_phone, trim((regexp_match(cp.description, 'Phone:[[:space:]]*([+0-9[:space:]-]+)'))[1]))
WHERE cp.description LIKE '%[CLIENT CONTACT:%'
  AND (cp.client_email IS NULL OR cp.client_phone IS NULL);

-- 4. Comment documentation
COMMENT ON COLUMN public.client_projects.client_email IS 'Structured client contact email for this operational project workspace';
COMMENT ON COLUMN public.client_projects.client_phone IS 'Structured client contact phone for this operational project workspace';

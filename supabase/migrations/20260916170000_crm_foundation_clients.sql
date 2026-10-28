-- ============================================================
-- SADA OS — CRM Foundation / Phase 1 Migration
-- Migration: 20260916170000_crm_foundation_clients.sql
-- Description: Dedicated clients table, relationships, RLS & backfill
-- ============================================================

-- 1. Create canonical clients entity table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  preferred_channel TEXT,
  website TEXT,
  industry TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('prospect', 'active', 'inactive', 'archived')),
  relationship_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance & search indexes
CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON public.clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON public.clients(relationship_owner_id);

-- 2. Add client_id relationship to contact_submissions (Inquiries)
ALTER TABLE public.contact_submissions 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_client_id ON public.contact_submissions(client_id);

-- 3. Add client_id relationship to client_projects (Projects)
-- Enforce ON DELETE RESTRICT so deleting a client record cannot delete historical projects
ALTER TABLE public.client_projects 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_client_projects_client_id ON public.client_projects(client_id);

-- 4. Add client_id relationship to client_communication_logs
ALTER TABLE public.client_communication_logs 
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_communication_logs_client_id ON public.client_communication_logs(client_id);

-- 5. Row Level Security for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sada access read clients" ON public.clients;
DROP POLICY IF EXISTS "Admins insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins update clients" ON public.clients;
DROP POLICY IF EXISTS "Super admin delete clients" ON public.clients;

-- Workers, Admins, and Super Admins can view client CRM information
CREATE POLICY "Sada access read clients" ON public.clients
  FOR SELECT
  USING (public.has_sada_access(auth.uid()));

-- Admins and Super Admins can create new client records
CREATE POLICY "Admins insert clients" ON public.clients
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins and Super Admins can update client details
CREATE POLICY "Admins update clients" ON public.clients
  FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Only Super Admin can delete clients (and protected by ON DELETE RESTRICT)
CREATE POLICY "Super admin delete clients" ON public.clients
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 6. Safe & Deterministic Backfill of Existing Records
DO $$
DECLARE
  v_cafe_client_id UUID;
  v_totta_client_id UUID;
  v_audit_client_id UUID;
BEGIN
  -- A. Backfill Client for Café 707
  SELECT id INTO v_cafe_client_id FROM public.clients WHERE lower(name) = 'café 707' OR lower(name) = 'caffe 707' LIMIT 1;
  IF v_cafe_client_id IS NULL THEN
    INSERT INTO public.clients (name, industry, status, notes)
    VALUES ('Café 707', 'Hospitality / Cafe', 'active', 'Initial operational client for Instagram campaign and content creation.')
    RETURNING id INTO v_cafe_client_id;
  END IF;

  UPDATE public.client_projects
  SET client_id = v_cafe_client_id
  WHERE (lower(client_name) LIKE '%caffe%' OR lower(client_name) LIKE '%café%' OR lower(title) LIKE '%caffe%' OR lower(title) LIKE '%café%')
    AND client_id IS NULL;

  -- B. Backfill Client for TOTTA
  SELECT id INTO v_totta_client_id FROM public.clients WHERE lower(name) = 'totta' LIMIT 1;
  IF v_totta_client_id IS NULL THEN
    INSERT INTO public.clients (name, contact_name, email, phone, industry, status, notes)
    VALUES ('TOTTA Restaurant', 'boubakar hamed sghaier', 'boubakar.hamedsghaier@gmail.com', '52278798', 'Restaurant', 'active', 'Client converted from structured discovery inquiry.')
    RETURNING id INTO v_totta_client_id;
  END IF;

  UPDATE public.contact_submissions
  SET client_id = v_totta_client_id
  WHERE (lower(business_name) = 'totta' OR lower(email) = 'boubakar.hamedsghaier@gmail.com')
    AND client_id IS NULL;

  UPDATE public.client_projects
  SET client_id = v_totta_client_id
  WHERE (lower(client_name) = 'totta' OR lower(title) LIKE '%totta%')
    AND client_id IS NULL;

  -- C. Backfill Client for Audit Luxury SARL
  SELECT id INTO v_audit_client_id FROM public.clients WHERE lower(name) = 'audit luxury sarl' LIMIT 1;
  IF v_audit_client_id IS NULL THEN
    INSERT INTO public.clients (name, contact_name, email, phone, industry, status, notes)
    VALUES ('Audit Luxury SARL', 'AUDIT Luxury Brand Client', 'audit_inq_1789566111750@client.com', '+216 99 888 777', 'Luxury / Fashion', 'active', 'Enterprise luxury client with active campaigns.')
    RETURNING id INTO v_audit_client_id;
  END IF;

  UPDATE public.contact_submissions
  SET client_id = v_audit_client_id
  WHERE (lower(business_name) = 'audit luxury sarl' OR lower(email) LIKE '%audit_inq%')
    AND client_id IS NULL;

  UPDATE public.client_projects
  SET client_id = v_audit_client_id
  WHERE (lower(client_name) = 'audit luxury sarl' OR lower(title) LIKE '%audit luxury%')
    AND client_id IS NULL;

  -- D. Catch any remaining projects or inquiries with exact matching names
  UPDATE public.client_projects cp
  SET client_id = c.id
  FROM public.clients c
  WHERE cp.client_id IS NULL AND lower(cp.client_name) = lower(c.name);

  UPDATE public.contact_submissions cs
  SET client_id = c.id
  FROM public.clients c
  WHERE cs.client_id IS NULL AND (lower(cs.email) = lower(c.email) OR lower(cs.business_name) = lower(c.name));

  -- E. Link communication logs to client_id via project_id
  UPDATE public.client_communication_logs ccl
  SET client_id = cp.client_id
  FROM public.client_projects cp
  WHERE ccl.project_id = cp.id AND ccl.client_id IS NULL AND cp.client_id IS NOT NULL;
END $$;

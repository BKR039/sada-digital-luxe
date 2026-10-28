-- ============================================================
-- SADA WORK OS — Migration: 20260928210000_client_workspace_crm_foundation.sql
-- Module: Canonical Client Workspace & CRM Foundation
-- ============================================================

-- 1. Ensure account_manager_id and sales_owner_id exist on public.clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sales_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Synchronize existing relationship_owner_id and commission_recipient_id
UPDATE public.clients
SET account_manager_id = CASE
      WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = relationship_owner_id) THEN relationship_owner_id
      ELSE account_manager_id
    END,
    sales_owner_id = CASE
      WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = commission_recipient_id) THEN commission_recipient_id
      ELSE sales_owner_id
    END;

-- 3. Create indexes for high-performance CRM queries
CREATE INDEX IF NOT EXISTS idx_clients_account_manager ON public.clients(account_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_sales_owner ON public.clients(sales_owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_industry ON public.clients(industry);
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);

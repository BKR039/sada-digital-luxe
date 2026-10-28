-- ============================================================
-- SADA OS — CANONICAL PACKAGE RELATIONSHIP MIGRATION
-- Migrate legacy deals.package_id (and client/task/booking/deliverable FKs)
-- from public.packages to public.package_catalog (Single Source of Truth)
-- ============================================================

DO $$
BEGIN
    -- 1. Pre-validation: Ensure 100% of non-null package_ids exist in package_catalog
    IF EXISTS (SELECT 1 FROM public.deals WHERE package_id IS NOT NULL AND package_id NOT IN (SELECT id FROM public.package_catalog)) THEN
        RAISE EXCEPTION 'Pre-migration check failed: deals contains package_id not present in package_catalog';
    END IF;

    IF EXISTS (SELECT 1 FROM public.clients WHERE package_id IS NOT NULL AND package_id NOT IN (SELECT id FROM public.package_catalog)) THEN
        RAISE EXCEPTION 'Pre-migration check failed: clients contains package_id not present in package_catalog';
    END IF;

    IF EXISTS (SELECT 1 FROM public.client_deliverables WHERE package_id IS NOT NULL AND package_id NOT IN (SELECT id FROM public.package_catalog)) THEN
        RAISE EXCEPTION 'Pre-migration check failed: client_deliverables contains package_id not present in package_catalog';
    END IF;

    IF EXISTS (SELECT 1 FROM public.project_tasks WHERE package_id IS NOT NULL AND package_id NOT IN (SELECT id FROM public.package_catalog)) THEN
        RAISE EXCEPTION 'Pre-migration check failed: project_tasks contains package_id not present in package_catalog';
    END IF;

    IF EXISTS (SELECT 1 FROM public.production_bookings WHERE package_id IS NOT NULL AND package_id NOT IN (SELECT id FROM public.package_catalog)) THEN
        RAISE EXCEPTION 'Pre-migration check failed: production_bookings contains package_id not present in package_catalog';
    END IF;
END $$;

-- 2. MIGRATE DEALS FOREIGN KEY TO CANONICAL package_catalog
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_package_id_fkey;
ALTER TABLE public.deals 
    ADD CONSTRAINT deals_package_id_fkey 
    FOREIGN KEY (package_id) 
    REFERENCES public.package_catalog(id) 
    ON DELETE SET NULL;

-- 3. MIGRATE CLIENTS FOREIGN KEY TO CANONICAL package_catalog
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_package_id_fkey;
ALTER TABLE public.clients 
    ADD CONSTRAINT clients_package_id_fkey 
    FOREIGN KEY (package_id) 
    REFERENCES public.package_catalog(id) 
    ON DELETE SET NULL;

-- 4. MIGRATE CLIENT_DELIVERABLES FOREIGN KEY TO CANONICAL package_catalog
ALTER TABLE public.client_deliverables DROP CONSTRAINT IF EXISTS client_deliverables_package_id_fkey;
ALTER TABLE public.client_deliverables 
    ADD CONSTRAINT client_deliverables_package_id_fkey 
    FOREIGN KEY (package_id) 
    REFERENCES public.package_catalog(id) 
    ON DELETE SET NULL;

-- 5. MIGRATE PROJECT_TASKS FOREIGN KEY TO CANONICAL package_catalog
ALTER TABLE public.project_tasks DROP CONSTRAINT IF EXISTS project_tasks_package_id_fkey;
ALTER TABLE public.project_tasks 
    ADD CONSTRAINT project_tasks_package_id_fkey 
    FOREIGN KEY (package_id) 
    REFERENCES public.package_catalog(id) 
    ON DELETE SET NULL;

-- 6. MIGRATE PRODUCTION_BOOKINGS FOREIGN KEY TO CANONICAL package_catalog
ALTER TABLE public.production_bookings DROP CONSTRAINT IF EXISTS production_bookings_package_id_fkey;
ALTER TABLE public.production_bookings 
    ADD CONSTRAINT production_bookings_package_id_fkey 
    FOREIGN KEY (package_id) 
    REFERENCES public.package_catalog(id) 
    ON DELETE SET NULL;

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_deals_package_id ON public.deals(package_id);
CREATE INDEX IF NOT EXISTS idx_clients_package_id ON public.clients(package_id);

-- 8. MARK LEGACY packages TABLE AS DEPRECATED
COMMENT ON TABLE public.packages IS 'DEPRECATED: Legacy package table superseded by public.package_catalog. Retained for historical schema reference only. Zero production foreign keys or queries remain.';

-- 9. DECOMMISSION DUAL-WRITE SYNC TRIGGER
DROP TRIGGER IF EXISTS trg_sync_package_catalog_to_packages ON public.package_catalog;
DROP FUNCTION IF EXISTS public.sync_package_catalog_to_packages();

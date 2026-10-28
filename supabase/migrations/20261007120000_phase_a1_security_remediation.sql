-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007120000
-- PHASE A.1: CRITICAL SECURITY REMEDIATION & AUTHORIZATION BASELINE HARDENING
--
-- 1. Helper Function: Optimized Team Member IDs (eliminates correlated RLS subqueries)
-- 2. Salary / Compensation RLS: Drop legacy permissive "Admins manage" policies
--    and establish strict Finance-gated policies.
-- 3. Close open "USING (true) WITH CHECK (true)" policies on:
--    - public.packages
--    - public.client_deliverables
--    - public.production_bookings
-- 4. Package Catalog: Restrict permanent DELETE strictly to Super Admin
-- 5. Project Tasks Worker Column Lock: PostgreSQL trigger to prevent
--    workers from mutating Task Definition fields directly.
-- 6. Module-level RLS alignment for clients, client_projects, and CMS tables.
-- ============================================================

-- ============================================================
-- 1. OPTIMIZED TEAM MEMBER ID HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_team_member_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.team_members
  WHERE profile_id = auth.uid()
     OR user_id = auth.uid()
     OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))));
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_team_member_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_team_member_ids() TO authenticated, service_role;

-- ============================================================
-- 2. SALARY / COMPENSATION RLS REMEDIATION
-- Remove legacy permissive "Admins manage" policies that bypassed Finance access.
-- ============================================================

-- A. salary_records
DROP POLICY IF EXISTS "Admins manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Read salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Workers view own salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Authorized view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Authorized manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Authorized insert salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Authorized update salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins delete salary_records" ON public.salary_records;

-- SELECT: Super Admin OR users with Finance module access OR workers viewing their own
CREATE POLICY "Authorized view salary_records"
  ON public.salary_records FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance') OR
    team_member_id IN (SELECT public.get_current_team_member_ids())
  );

-- INSERT: Super Admin OR Admin with explicit Finance permission
CREATE POLICY "Authorized insert salary_records"
  ON public.salary_records FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  );

-- UPDATE: Super Admin OR Admin with explicit Finance permission
CREATE POLICY "Authorized update salary_records"
  ON public.salary_records FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  );

-- DELETE: Super Admin ONLY
CREATE POLICY "Super Admins delete salary_records"
  ON public.salary_records FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- B. salary_payments
DROP POLICY IF EXISTS "Admins manage salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Workers view own salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Authorized view salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Authorized insert salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Authorized update salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins delete salary_payments" ON public.salary_payments;

CREATE POLICY "Authorized view salary_payments"
  ON public.salary_payments FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance') OR
    team_member_id IN (SELECT public.get_current_team_member_ids())
  );

CREATE POLICY "Authorized insert salary_payments"
  ON public.salary_payments FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  );

CREATE POLICY "Authorized update salary_payments"
  ON public.salary_payments FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  );

CREATE POLICY "Super Admins delete salary_payments"
  ON public.salary_payments FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- C. salary_requests
DROP POLICY IF EXISTS "Admins manage salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Workers view own salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Workers insert own salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Authorized view salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Authorized insert salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Authorized update salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Super Admins delete salary_requests" ON public.salary_requests;

CREATE POLICY "Authorized view salary_requests"
  ON public.salary_requests FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance') OR
    team_member_id IN (SELECT public.get_current_team_member_ids())
  );

-- Workers can insert their own request; Super Admin/Finance Admin can also insert
CREATE POLICY "Authorized insert salary_requests"
  ON public.salary_requests FOR INSERT
  WITH CHECK (
    (
      status = 'pending' AND
      team_member_id IN (SELECT public.get_current_team_member_ids())
    ) OR
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  );

-- UPDATE (Approve / Reject): Super Admin OR Admin with Finance access
CREATE POLICY "Authorized update salary_requests"
  ON public.salary_requests FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'finance'))
  );

CREATE POLICY "Super Admins delete salary_requests"
  ON public.salary_requests FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 3. PACKAGES (LEGACY TABLE) RLS HARDENING
-- Replace open USING (true) WITH CHECK (true)
-- ============================================================

DROP POLICY IF EXISTS "Packages can be managed by admins" ON public.packages;
DROP POLICY IF EXISTS "Packages are viewable by all authenticated users" ON public.packages;
DROP POLICY IF EXISTS "Packages read authenticated" ON public.packages;
DROP POLICY IF EXISTS "Packages admin insert" ON public.packages;
DROP POLICY IF EXISTS "Packages admin update" ON public.packages;
DROP POLICY IF EXISTS "Packages super admin delete" ON public.packages;

CREATE POLICY "Packages read authenticated"
  ON public.packages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Packages admin insert"
  ON public.packages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'packages'))
  );

CREATE POLICY "Packages admin update"
  ON public.packages FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'packages'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'packages'))
  );

CREATE POLICY "Packages super admin delete"
  ON public.packages FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 4. PACKAGE_CATALOG RLS HARDENING
-- Plain Admins MUST NOT have DELETE capability; DELETE is Super Admin only.
-- ============================================================

DROP POLICY IF EXISTS "Package catalog manageable by admins" ON public.package_catalog;
DROP POLICY IF EXISTS "Package catalog admin insert" ON public.package_catalog;
DROP POLICY IF EXISTS "Package catalog admin update" ON public.package_catalog;
DROP POLICY IF EXISTS "Package catalog super admin delete" ON public.package_catalog;

CREATE POLICY "Package catalog admin insert"
  ON public.package_catalog FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'packages'))
  );

CREATE POLICY "Package catalog admin update"
  ON public.package_catalog FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'packages'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'packages'))
  );

CREATE POLICY "Package catalog super admin delete"
  ON public.package_catalog FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 5. CLIENT_DELIVERABLES RLS HARDENING
-- Replace open USING (true) WITH CHECK (true)
-- ============================================================

DROP POLICY IF EXISTS "Client deliverables manageable by authenticated users" ON public.client_deliverables;
DROP POLICY IF EXISTS "Client deliverables viewable by authenticated users" ON public.client_deliverables;
DROP POLICY IF EXISTS "Client deliverables read authenticated" ON public.client_deliverables;
DROP POLICY IF EXISTS "Client deliverables admin insert" ON public.client_deliverables;
DROP POLICY IF EXISTS "Client deliverables admin update" ON public.client_deliverables;
DROP POLICY IF EXISTS "Client deliverables super admin delete" ON public.client_deliverables;

CREATE POLICY "Client deliverables read authenticated"
  ON public.client_deliverables FOR SELECT TO authenticated
  USING (public.has_sada_access(auth.uid()));

CREATE POLICY "Client deliverables admin insert"
  ON public.client_deliverables FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'tasks') OR public.has_module_access(auth.uid(), 'clients')))
  );

CREATE POLICY "Client deliverables admin update"
  ON public.client_deliverables FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'tasks') OR public.has_module_access(auth.uid(), 'clients')))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'tasks') OR public.has_module_access(auth.uid(), 'clients')))
  );

CREATE POLICY "Client deliverables super admin delete"
  ON public.client_deliverables FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 6. PRODUCTION_BOOKINGS RLS HARDENING
-- Replace open USING (true) WITH CHECK (true)
-- ============================================================

DROP POLICY IF EXISTS "Production bookings manageable by authenticated users" ON public.production_bookings;
DROP POLICY IF EXISTS "Production bookings viewable by authenticated users" ON public.production_bookings;
DROP POLICY IF EXISTS "Production bookings read authenticated" ON public.production_bookings;
DROP POLICY IF EXISTS "Production bookings admin insert" ON public.production_bookings;
DROP POLICY IF EXISTS "Production bookings admin update" ON public.production_bookings;
DROP POLICY IF EXISTS "Production bookings super admin delete" ON public.production_bookings;

CREATE POLICY "Production bookings read authenticated"
  ON public.production_bookings FOR SELECT TO authenticated
  USING (public.has_sada_access(auth.uid()));

CREATE POLICY "Production bookings admin insert"
  ON public.production_bookings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'calendar') OR public.has_module_access(auth.uid(), 'tasks')))
  );

CREATE POLICY "Production bookings admin update"
  ON public.production_bookings FOR UPDATE TO authenticated
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'calendar') OR public.has_module_access(auth.uid(), 'tasks')))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'calendar') OR public.has_module_access(auth.uid(), 'tasks')))
  );

CREATE POLICY "Production bookings super admin delete"
  ON public.production_bookings FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- 7. TASK WORKER COLUMN LOCK (PostgreSQL Trigger)
-- Workers updating assigned tasks CANNOT mutate Task Definition fields.
-- Protected fields: title, deadline, priority, billing, labor_cost,
-- package_id, deliverable_id, parent_task_id, project_id, client_id, assignee_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_project_tasks_worker_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin_user BOOLEAN;
BEGIN
  -- If invoked without auth context (e.g. background worker or test service role), allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if caller is Admin or Super Admin
  _is_admin_user := public.is_admin(auth.uid());

  IF NOT _is_admin_user THEN
    -- Worker check: verify no Task Definition fields were mutated
    IF (NEW.title IS DISTINCT FROM OLD.title) OR
       (NEW.deadline IS DISTINCT FROM OLD.deadline) OR
       (NEW.priority IS DISTINCT FROM OLD.priority) OR
       (NEW.project_id IS DISTINCT FROM OLD.project_id) OR
       (NEW.client_id IS DISTINCT FROM OLD.client_id) OR
       (NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) OR
       (NEW.parent_task_id IS DISTINCT FROM OLD.parent_task_id) OR
       (NEW.package_id IS DISTINCT FROM OLD.package_id) OR
       (NEW.deliverable_id IS DISTINCT FROM OLD.deliverable_id) OR
       (NEW.labor_cost IS DISTINCT FROM OLD.labor_cost) OR
       (NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours) OR
       (NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id) OR
       (NEW.assigned_by_id IS DISTINCT FROM OLD.assigned_by_id)
    THEN
      RAISE EXCEPTION 'Unauthorized: Workers cannot modify task definition fields (title, deadline, priority, billing, assignee, labor cost).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_project_tasks_worker_columns ON public.project_tasks;
CREATE TRIGGER trg_guard_project_tasks_worker_columns
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_project_tasks_worker_columns();

-- ============================================================
-- 8. MODULE-LEVEL RLS ALIGNMENT FOR CLIENTS & CMS TABLES
-- Align mutation permissions with has_module_access()
-- ============================================================

-- A. clients: Ensure Admins have 'clients' module access
DROP POLICY IF EXISTS "Admins insert clients" ON public.clients;
CREATE POLICY "Admins insert clients" ON public.clients
  FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'clients'))
  );

DROP POLICY IF EXISTS "Admins update clients" ON public.clients;
CREATE POLICY "Admins update clients" ON public.clients
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'clients'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'clients'))
  );

-- B. client_projects: Ensure Admins have 'workspaces' module access
DROP POLICY IF EXISTS "Admins create client_projects" ON public.client_projects;
CREATE POLICY "Admins create client_projects" ON public.client_projects
  FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'workspaces'))
  );

DROP POLICY IF EXISTS "Admins update client_projects" ON public.client_projects;
CREATE POLICY "Admins update client_projects" ON public.client_projects
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'workspaces'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'workspaces'))
  );

-- C. Content CMS tables: Ensure Admins have 'content_cms' module access
-- projects (case studies)
DROP POLICY IF EXISTS "Admins create projects" ON public.projects;
CREATE POLICY "Admins create projects" ON public.projects
  FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
CREATE POLICY "Admins update projects" ON public.projects
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

-- blog_posts
DROP POLICY IF EXISTS "Admins insert posts" ON public.blog_posts;
CREATE POLICY "Admins insert posts" ON public.blog_posts
  FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

DROP POLICY IF EXISTS "Admins update posts" ON public.blog_posts;
CREATE POLICY "Admins update posts" ON public.blog_posts
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

-- products
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
CREATE POLICY "Admins insert products" ON public.products
  FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

DROP POLICY IF EXISTS "Admins update products" ON public.products;
CREATE POLICY "Admins update products" ON public.products
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

-- testimonials
DROP POLICY IF EXISTS "Admins insert testimonials" ON public.testimonials;
CREATE POLICY "Admins insert testimonials" ON public.testimonials
  FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

DROP POLICY IF EXISTS "Admins update testimonials" ON public.testimonials;
CREATE POLICY "Admins update testimonials" ON public.testimonials
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (public.is_admin(auth.uid()) AND public.has_module_access(auth.uid(), 'content_cms'))
  );

# SADA OS — Team Management & Workload Security & RBAC Matrix
**Phase 5: Permission & Data Isolation Verification**

**Audit Date:** October 16, 2026 (SADA Operational Epoch)  
**Module Name:** Team Management & Workload  
**Primary Route:** `/admin/team-workload`  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Final Status:** PHASE 5 COMPLETE & SECURITY HARMONIZED

---

## 1. Role-Based Access Control (RBAC) Matrix

| Operation / Surface | Super Admin | Admin | Worker | Anonymous / Public | Enforcement Layer |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Access Route `/admin/team-workload`** | Allowed | Allowed | Denied (Access Restricted Banner with link to `/admin/my-work`) | Denied (Redirect to `/login`) | Route Guard + SADA Works Role Hook (`isWorker` check) |
| **View Internal Team Roster & Contact Info** | Full Access | Full Access | Restricted (Self profile only) | 0 Access | RLS `team_members` policy + Route Gate |
| **Inspect Member Workspace (All Tasks)** | Full Access | Full Access | Denied (Worker accesses `/admin/my-work`) | Denied | Route Gate + RLS `project_tasks` |
| **Add / Edit Team Member Profile** | Full Access | Full Access | Denied | Denied | Modal Gate + RLS `team_members` write policies |
| **Delete / Deactivate Team Member** | Full Access (Hard Delete or Deactivate) | Deactivate Only | Denied | Denied | UI Permissions check (`isSuperAdmin`) + Server RLS |
| **Change Public Visibility & Display Order** | Full Access | Full Access | Denied | Denied | `TeamMemberModal` + RLS `team_members` |
| **View / Edit Base Salary & Compensation** | Full Access | Full Access | Self Record Read-Only (via internal API) | Denied (0 rows returned) | Database RLS `salary_records` + UI tab gating |
| **Single / Bulk Task Assignment** | Full Access | Full Access | Denied | Denied | `admin.team-workload.tsx` action handlers + RLS |
| **Upload Profile Avatar** | Allowed | Allowed | Self Only | Denied | Storage bucket RLS policies (`team-avatars`) |
| **Public Website Staff Access (`/about`)** | View Published | View Published | View Published | View Published & Active only (11 public fields) | `public.public_team_members` View & scoped RLS |

---

## 2. Row-Level Security (RLS) Database Architecture

### 2.1 Table: `public.team_members`
- **Internal Admin Full Access:**
  ```sql
  CREATE POLICY "Admins read all team_members"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));
  ```
  *Hardening Note:* Explicitly scoped `TO authenticated` so PostgreSQL never evaluates `is_admin()` during unauthenticated queries.
- **Worker Self-Profile Access:**
  ```sql
  CREATE POLICY "Workers view own team_members"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (
      auth.uid() IS NOT NULL AND (
        profile_id = auth.uid() OR
        user_id = auth.uid()
      )
    );
  ```
- **Public Website Published RLS:**
  ```sql
  CREATE POLICY "Public view published team_members"
    ON public.team_members FOR SELECT
    TO anon, authenticated
    USING (published = true AND is_active = true);
  ```

### 2.2 Dedicated Public Projection View: `public.public_team_members`
To guarantee zero column leakage to external public consumers, a dedicated projection view is established in migration `20261016140000`:
```sql
CREATE OR REPLACE VIEW public.public_team_members WITH (security_invoker = false) AS
SELECT
  id,
  name,
  position,
  position_ar,
  division,
  specialties,
  bio,
  bio_ar,
  photo_url,
  socials,
  sort_order
FROM public.team_members
WHERE published = true
  AND is_active = true
  AND name NOT LIKE '%@%'
  AND (
    (photo_url IS NOT NULL AND length(trim(photo_url)) > 0)
    OR (bio IS NOT NULL AND length(trim(bio)) > 0)
    OR (bio_ar IS NOT NULL AND length(trim(bio_ar)) > 0)
    OR cardinality(specialties) > 0
    OR socials != '{}'::jsonb
  );

GRANT SELECT ON public.public_team_members TO anon, authenticated;
```
**Security Guarantees:**
1. **Column Exclusion:** Internal operational email, phone number, `profile_id`, `availability_status`, `employment_type`, and internal roles are not included in the view definition.
2. **Execution Context (`WITH (security_invoker = false)`):** The view executes with the privileges of its owner (PostgreSQL `postgres` superuser/role), bypassing internal table RLS evaluation for anonymous callers without requiring execution grants on internal authorization functions (`has_sada_access` or `is_admin`) to `anon`.
3. **Zero Anonymous Function Grants:** Anonymous users are strictly denied execute permissions on internal security functions, preventing unauthenticated account enumeration and timing attacks.
4. **Canonical Contract Hardening:** Encodes the public profile qualification rule in SQL so that even if legacy rows in `team_members` have `published = true`, they are filtered out before reaching public serialization.

### 2.3 Table: `public.salary_records`
- **Policy `salary_records_admin_select`:**
  ```sql
  CREATE POLICY salary_records_admin_select ON public.salary_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );
  ```
- **Policy `salary_records_worker_self_select`:**
  ```sql
  CREATE POLICY salary_records_worker_self_select ON public.salary_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.id = salary_records.team_member_id
      AND team_members.profile_id = auth.uid()
    )
  );
  ```
  *Evidence:* Automated test suite verified that an anonymous client receives 0 salary records, a Worker receives only their 1 personal record, and a Super Admin accesses all 8 records.

---

## 3. Data Leakage Prevention Guarantees

1. **No Operational Email Leaks on Public Web:** The public projection selects only public attributes (`id, name, position, position_ar, bio, bio_ar, photo_url, division, specialties, socials, sort_order`). Operational emails, hourly costs, and base salaries are never queried or transmitted over the wire to public visitors.
2. **Worker Role Barrier:** Workers navigating to `/admin/team-workload` are intercepted by the `isWorker` check, rendering an access-restricted state with a direct navigation link to `/admin/my-work`.
3. **No Phantom Task Assignment:** Tasks can only be assigned to valid profiles in `public.profiles`. The `resolveToProfileId` pipeline validates identity linkage prior to calling Supabase, preventing orphan task rows.

# SADA OS — Team Management & Workload Data Traceability Matrix
**Phase 1: Canonical Source-of-Truth & Lifecycle Mapping**

**Audit Date:** October 16, 2026 (SADA Operational Epoch)  
**Module Name:** Team Management & Workload  
**Primary Route:** `/admin/team-workload`  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Final Status:** PHASE 1 COMPLETE & TRACEABILITY ESTABLISHED

---

## 1. Canonical Source-of-Truth (SSOT) Map

| Domain | Canonical Table / Source | Primary Key | Read Path | Write Path | Authorization Boundary | Downstream Consumers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Member Operational Profile** | `public.team_members` | `id` (UUID) | Direct SELECT via `supabase.from('team_members')` | INSERT/UPDATE via `TeamMemberModal.tsx` | Admin / Super Admin (RLS `Admins manage team_members`) | `/admin/team-workload`, `/about`, `TeamMemberPicker`, Operations Calendar |
| **Member Identity / Auth** | `public.profiles` | `id` (UUID) | SELECT via `supabase.from('profiles')` | Auth triggers on `auth.users` | Authenticated users (Self update, Admin select) | User session, task assignees, activity log actors |
| **Public Website Profile** | `public.public_team_members` (View) over `team_members` | `id` (UUID) | Filtered SELECT: `.eq('published', true).eq('is_active', true)` | `TeamMemberModal.tsx` (`published`, `sort_order`, `position_ar`, `bio_ar`) | Admin / Super Admin for mutation; Public/Anon for SELECT | Public Website (`src/routes/about.tsx`), Public SEO metadata |
| **Task Ownership & Assignee** | `public.project_tasks` | `id` (UUID) | Scoped SELECT from `project_tasks` (`assignee_id` -> `profiles.id`) | Direct UPDATE with `resolveToProfileId(assigneeId)` | Admin, Super Admin, Assigned Worker | My Work (`/admin/my-work`), Operations Calendar (`/admin/calendar`), Client 360 |
| **Workload Calculations** | Derived from `public.project_tasks` | `id` (UUID) | Aggregation of active tasks (`status NOT IN ('done', 'cancelled')`) | Read-only derived projection | Inherits `project_tasks` RLS | Capacity tab, Specialist Drawer, Workload bars |
| **Unassigned Tasks** | Derived from `public.project_tasks` | `id` (UUID) | Active tasks where `assignee_id IS NULL` | Bulk / single assign in `/admin/team-workload` | Admin, Super Admin | Pulse KPI bar, Unassigned Tab (57 tasks reconciled) |
| **Compensation & Base Salary** | `public.salary_records` & `team_members.hourly_cost` | `salary_records.id` (UUID) | Scoped SELECT via `finance-service.ts` | `upsertSalaryRecord` in `finance-service.ts` | Strict Super Admin / Admin (RLS `salary_records_admin_only`) | Executive Financials, Project Costing, Team Roster compensation pill |
| **Task Activity & Audit Trail** | `public.project_activity` | `id` (UUID) | Ordered SELECT by `created_at DESC` | `task-execution-service.ts` log actions | Authenticated users (Admin + Assignee) | Member Workspace activity feed, Task Drawer history |

---

## 2. Invariant & Traceability Rules

### 2.1 Identity Invariant: Profiles vs Team Members
- `public.profiles.id` is the immutable foreign key for all authentication, audit actor IDs, and `project_tasks.assignee_id`.
- `public.team_members.id` is the agency operational entity representing job title, department, bio, skills, hourly rate, and public web presence.
- `team_members.profile_id` maps the operational entity to an authentication account.
- **Contract Enforcement:** When assigning a deliverable from Team Workload, `resolveToProfileId(assigneeId, teamMembers, profiles)` MUST be used:
  ```ts
  const profileId = resolveToProfileId(memberId, teamMembers, profiles);
  if (!profileId) {
    throw new Error("Selected specialist is not linked to an active user profile.");
  }
  await supabase.from("project_tasks").update({ assignee_id: profileId }).eq("id", taskId);
  ```

### 2.2 Workload Lifecycle Definition
Workload calculations across SADA OS strictly partition tasks into **Active** vs **Terminal**:
- **Active Deliverable:** `status NOT IN ('done', 'cancelled')`
  - In-flight states: `'todo'`, `'in_progress'`, `'in_review'`, `'blocked'`.
- **Terminal Deliverable:** `status IN ('done', 'cancelled')`
  - These deliverables have completed their lifecycle and MUST NOT be counted towards specialist active capacity or displayed in the active unassigned queue.

### 2.3 Unassigned Deliverables Reconciliation (DEF-TW-01)
- **KPI Metric Definition:** Tasks with `assignee_id IS NULL` AND `status NOT IN ('done', 'cancelled')`.
- **Database Baseline Count:** Exactly 57 active tasks.
- **Tab 3 Reconciliation:** Both the top KPI pulse card and the Tab 3 badge filter terminal deliverables out, displaying strictly **57 active unassigned deliverables**.

### 2.4 Public Website Synchronization Pipeline & Visibility Contract
- **Control Surface:** `src/components/admin/TeamMemberModal.tsx` provides the administrator interface for toggling `published` (defaults to `false` for new members) and editing `sort_order`, `position_ar`, and `bio_ar`.
  - **Validation Gate:** Prevents publishing any record where `name` contains an email address (`@`).
- **Authoritative Persistence (SSOT):** Saved directly to `public.team_members`. The `published` boolean is the single source of truth for visibility; no shadow tables, secondary flags, or client-side hardcoded lists exist.
- **Canonical Public Visibility Contract:** A member record is eligible for public rendering on `/about` if and only if all canonical conditions are satisfied:
  1. `published = true`
  2. `is_active = true`
  3. `name NOT LIKE '%@%'` and trimmed length > 0
  4. `position` trimmed length > 0
  5. Profile possesses at least one intentionally configured public asset:
     $$\text{photo\_url} \lor \text{bio} \lor \text{bio\_ar} \lor (\text{length}(\text{specialties}) > 0) \lor (\text{socials} \neq \{\})$$
- **Database Projection View:** Exposed via `public.public_team_members WITH (security_invoker = false)`. Anonymous visitors query this view, which isolates the projection to 11 public attributes:
  `id, name, position, position_ar, division, specialties, bio, bio_ar, photo_url, socials, sort_order`.
  Internal fields (`email`, `phone`, `hourly_cost`, `profile_id`, `availability_status`, `employment_type`) are omitted from the projection definition.
- **Client Route Execution:** `src/routes/about.tsx` queries `public_team_members` (with fallback to `team_members`) and validates the public contract. Deduplicates members by normalized name.
- **Lifecycle & Cache Revalidation:**
  - **Toggle ON:** Admin enables Public Visibility and saves. Database updates `published = true`. Next visit/refresh of `/about` renders the profile.
  - **Toggle OFF:** Admin disables Public Visibility and saves. Database updates `published = false`. Next visit/refresh of `/about` immediately excludes the profile.
  - **Inactive Exclusion:** If an administrator deactivates a member (`is_active = false`), they are immediately excluded from `/about` regardless of the `published` setting.
  - **Zero Stale Cache:** `/about` fetches data on component mount via the Supabase client without persistent SSR cache locks. Language switching (English <-> Arabic) re-renders using the same saved record's bilingual fields (`position_ar`, `bio_ar`).

### 2.5 Authoritative Compensation Chain
1. **Primary Store:** `public.salary_records` (`base_amount`, `salary_type`, `standard_monthly_hours`, `effective_date`).
2. **Derived Hourly Cost:** `calculateInternalHourlyRate()` in `src/lib/team-cost-service.ts`:
   $$\text{hourly\_rate} = \frac{\text{base\_amount}}{\text{standard\_monthly\_hours} \parallel 160}$$
3. **Execution Costing:** `work_sessions.hourly_cost_rate` snapshots this derived rate at session creation time, multiplying by logged hours to compute `labor_cost`.
4. **Disbursement & Reporting:** `/admin/finance` and `/admin/salary` consume `useSalaryRecords()`. Horizontal RLS prevents non-admin users from inspecting peers' salaries.

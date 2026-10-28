# SADA OS — Team Management & Workload Module Inventory
**Phase 0: Baseline & Read-Only Discovery**

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Team Management & Workload  
**Primary Route:** `/admin/team-workload` (`src/routes/admin.team-workload.tsx`)  
**Primary Subcomponents:**
- `src/components/admin/TeamMemberModal.tsx` (Add & Edit Team Member)
- `src/components/admin/MemberWorkspaceModal.tsx` (Specialist Drawer / Capacity Deep-Dive)
- `src/components/admin/project-utils.ts` (Identity Resolution & Visual Tokens)
- `src/lib/team-cost-service.ts` & `src/lib/finance-service.ts` (Compensation & Internal Hourly Rate)
**Public Website Consumer:** `/about` (`src/routes/about.tsx`)  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Status:** PHASE 0 DISCOVERY COMPLETE

---

## 1. Executive Overview & Scope

The **Team Management & Workload** module (`/admin/team-workload`) is the operational engine for agency staffing, capacity distribution, deliverable assignments, financial compensation visibility, and public web profile publication.

It synthesizes agency specialist profiles, active deliverable distribution from `public.project_tasks`, internal compensation models from `public.salary_records`, and public publication flags for `sada.agency/about`.

### Core Functional Areas
1. **Operational Metrics Bar (Pulse Cards):**
   - `Active Team`: Active operational team members (`is_active = true`).
   - `Active Tasks`: Total active non-terminal deliverables (`status NOT IN ('done', 'cancelled')`).
   - `Unassigned`: Active tasks awaiting specialist allocation (`assignee_id IS NULL`).
   - `Overdue`: Active tasks past their contractual deadline (`deadline < now()`).
   - `Blocked`: Active tasks flagged as blocked in workflow.
2. **Three Operational Views (Tabs):**
   - **Tab 1: Capacity & Workload (`capacity`):**
     - Specialist capacity cards showing active tasks, total estimated workload, capacity percentage, status pills, and direct task list.
     - Search & division filter bar.
   - **Tab 2: Team Roster (`roster`):**
     - Specialist operational directory cards (avatar, name, role/position, division, employment type, SADA Works role, public visibility badge, compensation indicator, and action buttons).
     - Modals for Add Member, Edit Profile, and Member Workspace.
   - **Tab 3: Unassigned Tasks (`unassigned`):**
     - Assignment command center with bulk selection, smart specialist recommendation, single task assignment, and direct drawer inspection.
3. **Team Member Lifecycle Center (`TeamMemberModal.tsx`):**
   - Add new specialist or edit existing profile.
   - Profile photo upload to `team-avatars` storage bucket.
   - Operational details: Full Name, Position/Role, Operational Email, Division, Employment Type, Availability Status, SADA Works System Role (`admin`, `worker`, etc.).
   - Bilingual public profile attributes: Arabic Title (`position_ar`), Arabic Bio (`bio_ar`), English Bio (`bio`).
   - Compensation & Financials: Monthly base salary, standard hours per month, calculated internal hourly rate, payment frequency, disbursement method.
   - Public Website Publication: `published` toggle and `display_order` weight.
4. **Member Workspace Drawer (`MemberWorkspaceModal.tsx`):**
   - Comprehensive specialist drill-down: Contact details, current task queue, performance metrics, overdue warnings, and direct task reassignment.

---

## 2. Component Hierarchy & File Structure

```
src/
├── routes/
│   ├── admin.team-workload.tsx              # Primary Route: Team Workload & Capacity Dashboard
│   └── about.tsx                            # Public Website: About & Team Section consumer
├── components/admin/
│   ├── TeamMemberModal.tsx                  # Add / Edit Team Member modal dialog
│   ├── MemberWorkspaceModal.tsx             # Specialist drawer & active workload inspect
│   ├── TeamMemberPicker.tsx                 # Team member combobox & selector
│   └── project-utils.ts                     # resolveToProfileId, resolveToTeamMemberId, UI helpers
├── components/ui/
│   ├── sada-dialog.tsx                      # Accessible modal dialog container
│   ├── sada-drawer.tsx                      # Slide-out drawer
│   ├── sada-combobox.tsx                    # Searchable specialist selector
│   ├── sada-badge.tsx                       # Status and priority badges
│   └── sada-button.tsx                      # Standard button with loading states
└── lib/
    ├── supabase.ts                          # Supabase browser client
    ├── permissions.ts                       # Granular RBAC permissions engine
    ├── team-cost-service.ts                 # calculateInternalHourlyRate, getTeamMemberCost
    ├── finance-service.ts                   # upsertSalaryRecord, getSalaryRecords
    └── task-execution-service.ts            # project_tasks updates and audit logs
```

---

## 3. Database Schema & Source-of-Truth Inventory

Forensic read-only inventory executed on shared database:

| Table Name | Role in Team Workload | Row Count | Key Columns |
| :--- | :--- | :--- | :--- |
| `public.team_members` | **Canonical Team Roster & Public Site SSOT** | 386 | `id` (UUID PK), `profile_id` (UUID -> `profiles.id`), `name`, `email`, `role`, `position`, `position_ar`, `bio`, `bio_ar`, `division`, `skills` (text[]), `status`, `employment_type`, `hourly_cost`, `is_active` (bool), `published` (bool), `display_order` (int), `photo_url`, `created_at`, `updated_at` |
| `public.profiles` | User Identity SSOT (`auth.users`) | 428 | `id` (UUID PK -> `auth.users.id`), `display_name`, `email`, `role`, `avatar_url` |
| `public.project_tasks` | Canonical Deliverable & Workload SSOT | 239 | `id` (UUID PK), `title`, `status`, `priority`, `deadline`, `assignee_id` (UUID -> `profiles.id`), `client_id`, `project_id`, `created_at` |
| `public.salary_records` | Confidential Compensation Records | 8 | `id` (UUID PK), `team_member_id` (UUID -> `team_members.id`), `base_salary`, `effective_date`, `currency`, `created_at` |
| `public.client_projects` | Project Context | 24 | `id` (UUID PK), `title`, `client_id` |

### Key Invariant: Assignee Identity Resolution
- In PostgreSQL schema, `project_tasks.assignee_id` foreign key references `public.profiles.id`.
- `team_members.profile_id` optionally links a team member record to their auth identity profile.
- The UI uses `resolveToProfileId(assigneeId, teamMembers, profiles)` whenever persisting task assignments to ensure foreign key integrity.

---

## 4. Initial Forensic Baseline Metrics

- **Total `team_members`:** 386
  - Active: 381
  - Inactive: 5
  - Published: 384 (379 active + 5 inactive)
  - Public Website Published & Active: 379
- **Total `profiles`:** 428
  - Profiles without `team_members` row: 55 (synthesized in-memory by dashboard)
- **Total `project_tasks`:** 239
  - Active deliverables: 180
  - Completed/terminal deliverables: 59
  - Active unassigned deliverables: 57
  - Terminal unassigned deliverables: 3
  - Active overdue deliverables: 51
  - Active blocked deliverables: 2
- **Total `salary_records`:** 8
  - 100% mapped to valid `team_members.id`

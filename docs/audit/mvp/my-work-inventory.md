# SADA OS — My Work Module Inventory
**Phase 0: Baseline & Read-Only Discovery**

**Audit Date:** 2026-10-14  
**Module Name:** My Work (Task Execution Center & Team Workload)  
**Primary Route:** `/admin/my-work`  
**Secondary Route:** `/admin/team-workload`  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Status:** COMPLETE (Baseline Discovery)

---

## 1. Executive Overview & Scope

The **My Work module** is the primary operational execution workspace in SADA OS. It serves specialists, operations leads, administrators, and super administrators by organizing deliverables into prioritized execution queues, managing stage workflows, tracking blockers and deadlines, and providing real-time visibility into team workload capacity.

### Core Functional Areas
1. **My Execution Queue (`/admin/my-work`):**
   - Personal execution queue filtered by assigned specialist (`me`, `all`, or individual team member).
   - "Next Up" deterministic priority recommendation engine (`computeNextTask`).
   - 9 operational queue tabs (`open`, `today`, `in_progress`, `paused`, `blocked`, `review`, `upcoming`, `done`, `all`).
   - Live multi-field search (task title, client company name, service tag, brief, notes).
   - Priority and Client dropdown filters.
   - Task card execution controls (Start, Pause, Resume, Submit for Review, Approve, Publish, Open Workspace).
2. **Team Workload Matrix (`/admin/my-work` -> Team Execution & `/admin/team-workload`):**
   - 6 Operational KPI counters (Active Deliverables, Due Today, Overdue, In Review, Blocked, Done Today).
   - Capacity breakdown per team member across active, due today, overdue, in review, and blocked deliverables.
   - "Inspect Queue" deep link switching seamlessly to personal execution view scoped to target member.
   - Unassigned tasks queue with bulk assignment controls (`/admin/team-workload`).
3. **Task Workspace & Details Modal (`TaskDetailModal.tsx`):**
   - Comprehensive task workspace containing 5 structured sections:
     - Section 1: Overview & Meta (Status, Priority, Due Date, Assigner, Assignee, Reviewer, Time tracking).
     - Section 2: Assignment Brief & Client Instructions (collapsible accordion with clean user-facing notes).
     - Section 3: Related Files & Deliverables (Google Drive URL, result links, file counts, copy links).
     - Section 4: Subtasks & Multi-Stage Workflow Engine (prerequisite dependency locking, stage actionability, independent subtask assignees).
     - Section 5: Activity & Discussion Timeline (chronological audit logs, task comments, handoff history).
   - Action controls: Start, Pause, Resume, Complete, Mark Blocked, Resolve Blocker, Postpone, Submit for Review, Request Changes, Complete Editing Handoff, Publish Content, Send Alert, Reassign, Delete.

---

## 2. Component Hierarchy & File Structure

```
src/
├── routes/
│   ├── admin.my-work.tsx                    # Primary route: MyWorkExecutionView
│   └── admin.team-workload.tsx              # Standalone team workload view: TeamWorkloadPage
├── components/admin/
│   ├── TaskDetailModal.tsx                  # 2,661-line task workspace dialog & action center
│   ├── TaskModal.tsx                        # Task creation & full definition editing modal
│   ├── TaskCard.tsx                         # Reusable task card renderer
│   ├── TeamMemberPicker.tsx                 # Team member resolution & SubtaskAssigneePopover
│   ├── MemberWorkspaceModal.tsx             # Specialist profile & workload drawer
│   ├── TeamMemberModal.tsx                  # Member creation/edit dialog
│   ├── project-utils.ts                     # Core status configs, deadline helpers, assignee resolution
│   └── tasks/
│       ├── CompleteEditingModal.tsx         # Video editing handoff dialog (Drive URL + duration)
│       ├── PublishContentModal.tsx          # Multi-platform publishing modal (IG, TikTok, FB, YT, X)
│       └── SendTaskAlertModal.tsx           # Contextual alert modal with priority & recipient
├── components/ui/
│   ├── sada-combobox.tsx                    # SADA Design System searchable combobox
│   ├── sada-select.tsx                      # SADA Design System compact select
│   ├── sada-date-picker.tsx                 # Popover date picker with quick presets
│   ├── sada-confirm-dialog.tsx              # Confirmation dialog for destructive actions
│   ├── sada-input.tsx                       # Standard SADA text input & textarea
│   ├── sada-checkbox.tsx                    # Accessible checkbox
│   ├── sada-badge.tsx                       # Standard badge component
│   ├── sada-button.tsx                      # Standard button with loading spinners
│   └── sada-ui.tsx                          # Skeleton loaders (MyWorkSkeleton, TeamWorkloadSkeleton)
└── lib/
    ├── task-execution-service.ts            # 20 lifecycle transitions, prioritization, audit logs
    ├── workflow-service.ts                  # Prerequisite stage locking & workflow progress
    ├── publishing-workflow-service.ts       # Handoff audit trail & publishing automation
    ├── business-rules-service.ts            # Centralized business rules engine
    ├── permissions.ts                       # Granular RBAC permissions engine
    └── security-isolation-service.ts        # Server-side mutation authority validation
```

---

## 3. Database Schema & Relationships

### Primary Tables Involved

| Table Name | Role in My Work | Key Columns & Foreign Keys |
| :--- | :--- | :--- |
| `public.project_tasks` | **Canonical Task Dataset** | `id` (UUID PK), `title`, `status`, `priority`, `deadline` (DATE/TIMESTAMPTZ), `assignee_id` (UUID -> `profiles.id`), `assigned_by_id` (UUID -> `profiles.id`), `reviewer_id` (UUID -> `profiles.id`), `project_id` (UUID -> `client_projects.id`), `parent_task_id` (UUID -> `project_tasks.id`), `sort_order`, `notes`, `description`, `category`, `service`, `waiting_on`, `blocked_reason`, `postpone_reason`, `result_links` (TEXT[]), `revision_count`, `completed_at`, `created_at`, `updated_at` |
| `public.client_projects` | Project Context | `id` (UUID PK), `title`, `client_id` (UUID -> `clients.id`), `client_name`, `status`, `lead_id` |
| `public.clients` | Client Metadata | `id` (UUID PK), `name`, `industry`, `status`, `client_type` |
| `public.profiles` | User Identity SSOT | `id` (UUID PK -> `auth.users.id`), `display_name`, `avatar_url`, `email` |
| `public.team_members` | Agency Directory & Hierarchy | `id` (UUID PK), `profile_id` (UUID -> `profiles.id`), `name`, `email`, `role`, `position`, `division`, `is_active`, `sort_order`, `photo_url` |
| `public.project_activity` | Task Execution Audit Trail | `id` (UUID PK), `task_id` (UUID -> `project_tasks.id`), `actor_id` (UUID -> `auth.users.id`), `actor_name`, `action`, `details` (JSONB), `created_at` |
| `public.task_handoffs` | Staged Workflow Handoffs | `id` (UUID PK), `task_id` (UUID -> `project_tasks.id`), `from_worker_id`, `to_worker_id`, `status`, `notes`, `drive_url` |
| `public.workflow_templates` | Configurable Stage Templates | `id` (UUID PK), `name`, `category`, `stages` (JSONB) |
| `public.notification_preferences` | User Alert Delivery Preferences | `user_id` (UUID PK -> `auth.users.id`), `email_enabled`, `in_app_enabled`, `desktop_push_enabled`, `mobile_push_enabled` |

---

## 4. Initial Query & Realtime Subscription Inventory

### Initial Page Load (`loadMyWorkData`)
When `/admin/my-work` mounts:
1. `supabase.from("project_tasks").select("*").order("deadline", { ascending: true, nullsFirst: false })`
2. `supabase.from("clients").select("id, name, industry, status, client_type")`
3. `supabase.from("client_projects").select("id, title, client_name, client_id")`
4. `supabase.from("profiles").select("id, display_name, avatar_url")`
5. `supabase.from("team_members").select("*").eq("is_active", true).order("sort_order", { ascending: true })`
6. `supabase.from("project_activity").select("task_id").eq("action", "task_paused")`

### Realtime Channel (`my-work-execution-sync`)
- Table: `public.project_tasks`
- Event: `*` (INSERT, UPDATE, DELETE)
- Strategy: **Silent background refresh** (`loadMyWorkData(false)`). Avoids triggering `loading = true`, eliminating global skeleton flashes during active work.

---

## 5. Baseline Test & Build Status (Phase 0)

| Verification Item | Command / Suite | Exit Code | Result | Details |
| :--- | :--- | :---: | :---: | :--- |
| **TypeScript Compilation** | `npx tsc --noEmit` | **0** | **PASS** | 0 errors across 4,492 modules. |
| **Task Execution Suite** | `scripts/test-task-execution-center.ts` | **0** | **PASS** | 36 / 36 tests passed (lifecycle, rollback, prioritization). |
| **Workflow Engine Suite** | `scripts/test-workflow-engine.ts` | **0** | **PASS** | 36 / 36 tests passed (stage locks, templates, progress). |
| **Task Authority Suite** | `scripts/test-phase-e-task-authority.ts` | **0** | **PASS** | 24 / 24 tests passed (resource authority, RLS defense). |
| **Persistence E2E Suite** | `scripts/test-taskmodal-persistence-e2e.ts` | **0 (Tests)** | **PASS** | All 4 functional tests (A, B, C, D) passed 100%. |
| **Dev Server Runtime** | `http://localhost:3000` | **200 OK** | **HEALTHY** | Active background instance responding immediately. |

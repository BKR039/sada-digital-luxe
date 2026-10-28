# SADA OS — Operations Calendar & Scheduling Module Inventory
**Phase 1: Baseline & Read-Only Discovery**

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Operations Calendar & Scheduling  
**Primary Route:** `/admin/calendar` (`src/routes/admin.calendar.tsx`)  
**Primary Subcomponent:** `src/components/admin/CalendarGrid.tsx`  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Status:** COMPLETE (Audited & Remediated)

---

## 1. Executive Overview & Scope

The **Operations Calendar & Scheduling** module (`/admin/calendar`) provides agency-wide operational time visibility, task scheduling, capacity pacing, and real-time execution coordination across all active agency deliverables.

It projects canonical deliverable deadlines and scheduled execution dates from `public.project_tasks` into Month, Week, and Day operational horizons without maintaining a competing or parallel calendar event table.

### Core Functional Areas
1. **Executive Operational Metrics Bar:**
   - 5 Realtime KPI counters:
     - `Today`: Deliverables scheduled for or due today.
     - `Overdue`: Active deliverables with passed deadlines.
     - `Due Soon`: Deliverables due within the next 48 hours.
     - `Completed`: Deliverables marked done/approved/delivered.
     - `Accounts`: Unique client accounts with active scheduled deliverables in scope.
2. **Specialist & Team Scheduling Controls:**
   - "My Calendar" instant toggle (filters exclusively to current user's assigned deliverables).
   - Team Member Combobox (`All Specialists` or specific worker filter).
   - Automatic Role Scoping: Workers default to `"me"` (their personal schedule); Administrators and Super Administrators default to `"all"`.
3. **Multi-Horizon Calendar Views (`CalendarGrid.tsx`):**
   - **Month View:** 7-column calendar matrix displaying date cells, overflow badges (`+N more`), overdue indicators, priority badges, and direct task card inspection.
   - **Week View:** 7-day hourly grid (08:00–21:00) with automatic all-day slotting at 09:00 for tasks with date-only deadlines.
   - **Day View:** High-density agenda view showing hourly scheduled deliverables and full-day deadline deliverables for any selected calendar date.
4. **Selected-Day Operations Agenda & Upcoming Schedule:**
   - Side panel displaying detailed task cards for the clicked date, complete with status pills, priority badges, client tags, and direct workspace openers.
   - Upcoming Schedule drawer tracking deliverables across upcoming days.
   - Mobile smooth-scroll affordance automatically anchoring to `#selected-day-panel` upon day selection on phone/tablet viewports (<1024px).
5. **Integrated Task Creation & Full Lifecycle Workspace:**
   - `TaskModal.tsx`: Comprehensive deliverable definition modal (Title, Description, Client Project, Assignee, Reviewer, Category, Priority, Deadline, Start Time, Target Delivery Time, Subtasks).
   - `TaskDetailModal.tsx`: Deep-linkable execution workspace dialog (`?task=<id>`) supporting 20 lifecycle transitions, stage handoffs, and activity logs.

---

## 2. Component Hierarchy & File Structure

```
src/
├── routes/
│   └── admin.calendar.tsx                   # Primary Route: CalendarDashboard
├── components/admin/
│   ├── CalendarGrid.tsx                     # MonthView, WeekView, DayView, Hourly Agenda
│   ├── TaskModal.tsx                        # Deliverable creation & definition dialog
│   ├── TaskDetailModal.tsx                  # Task workspace dialog & lifecycle action center
│   ├── TeamMemberPicker.tsx                 # Team member combobox & identity resolver
│   ├── project-utils.ts                     # Visual state compute, status styling, overdue math
│   └── tasks/
│       ├── CompleteEditingModal.tsx         # Video editing handoff dialog
│       ├── PublishContentModal.tsx          # Multi-platform social publishing modal
│       └── SendTaskAlertModal.tsx           # Contextual priority alert notification modal
├── components/ui/
│   ├── sada-combobox.tsx                    # SADA Design System searchable combobox
│   ├── sada-select.tsx                      # SADA Design System select
│   ├── sada-date-picker.tsx                 # Popover date picker with quick presets
│   ├── sada-dialog.tsx                      # Accessible modal dialog container
│   ├── sada-badge.tsx                       # Standard status and priority badges
│   ├── sada-button.tsx                      # Standard button with loading states
│   └── sada-filter-bar.tsx                  # Filter container bar
└── lib/
    ├── supabase.ts                          # Supabase browser client with live session
    ├── task-execution-service.ts            # Task status transitions, prioritization, audit log
    ├── workflow-service.ts                  # Prerequisite stage validation
    ├── business-rules-service.ts            # Centralized business rules engine
    ├── permissions.ts                       # Granular RBAC permissions engine
    └── security-isolation-service.ts        # Server-side mutation authority validation
```

---

## 3. Database Schema & Traceability

### Primary Tables Involved

| Table Name | Role in Calendar | Key Columns & Foreign Keys |
| :--- | :--- | :--- |
| `public.project_tasks` | **Canonical Single Source of Truth** | `id` (UUID PK), `title`, `description`, `status`, `priority`, `deadline` (TIMESTAMPTZ/DATE), `start_date`, `target_delivery_time`, `assignee_id` (UUID -> `profiles.id`), `project_id` (UUID -> `client_projects.id`), `client_id` (UUID -> `clients.id`), `category`, `service`, `parent_task_id`, `completed_at`, `created_at`, `updated_at` |
| `public.client_projects` | Project Context & Account Resolution | `id` (UUID PK), `title`, `client_id` (UUID -> `clients.id`), `client_name`, `status`, `lead_id` |
| `public.clients` | Client Accounts | `id` (UUID PK), `name`, `industry`, `status` |
| `public.profiles` | User Identity SSOT | `id` (UUID PK -> `auth.users.id`), `display_name`, `avatar_url`, `email` |
| `public.team_members` | Agency Staff Directory | `id` (UUID PK), `profile_id` (UUID -> `profiles.id`), `name`, `email`, `role`, `position`, `is_active` |
| `public.project_activity` | Audit Trail for Calendar Actions | `id` (UUID PK), `task_id` (UUID -> `project_tasks.id`), `actor_id` (UUID -> `auth.users.id`), `action`, `details` |

---

## 4. Query, Filter, & Realtime Subscription Inventory

### 4.1 Data Fetching Pipeline
- **Initial Load:** Single scoped query against `public.project_tasks` ordered by `deadline ASC`.
- **Project & Account Map:** Concurrently fetches `public.client_projects` (`id, title, client_id, client_name`) and `public.clients` (`id, name`).
- **Team Directory:** Fetches active `public.team_members` (`id, profile_id, name, role, position, photo_url`) to populate `TeamMemberPicker` and provide profile ID resolution.
- **Realtime Channel (`calendar-execution-sync`):**
  - Subscribes to `postgres_changes` on schema `public`, table `project_tasks`.
  - Automatically invalidates and refreshes task state upon `INSERT`, `UPDATE`, or `DELETE` events from other specialists or background jobs.
  - Properly unbinds and cleans up channel upon component unmount.

### 4.2 Mathematical Invariants
- Total Canonical Records in Database: **239 tasks** (`project_tasks`).
- Baseline Metric Counts (Agency-wide / `all`):
  - `Today`: **1** deliverable due today.
  - `Overdue`: **51** deliverables past deadline.
  - `Due Soon`: **5** deliverables due within 48 hours.
  - `Completed`: **59** deliverables finished.
  - `Accounts`: **18** distinct client accounts with active deliverables (verified via direct `client_id` + `project_id.client_id` join reconciliation).

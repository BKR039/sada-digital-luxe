# SADA OS — My Work: Forensic Data Traceability Matrix
## Phase 0 Forensic Audit & Data Source Verification

**Module Scope:** `/admin/my-work` (My Execution & Team Execution views), `/admin/team-workload` (Unified Team Workload & Unassigned Deliverables), `TaskDetailModal`, `TaskCard`, `TaskModal`, `TeamMemberPicker`  
**Audit Standard:** Strict Canonical Database Traceability, Zero Mock Assumptions, 100% Verification  
**Date:** October 2026 (Local SADA Operational Epoch)  
**Auditor:** Senior QA Engineer, Database Auditor & Security Specialist

---

## 1. Executive Summary & Canonical Sources of Truth

| Entity Domain | Canonical Source Table | Foreign Key References | Role / Authority Requirement | RLS Policy Enforced |
| :--- | :--- | :--- | :--- | :--- |
| **Tasks / Deliverables** | `public.project_tasks` | `assignee_id` $\to$ `profiles.id`<br>`assigned_by_id` $\to$ `profiles.id`<br>`client_id` $\to$ `clients.id`<br>`project_id` $\to$ `client_projects.id`<br>`parent_task_id` $\to$ `project_tasks.id` | Read: Authenticated staff<br>Status/Progress: Task assignee, parent authority, or Admin<br>Edit Definition: Admin / Super Admin | `project_tasks_policy`<br>`project_tasks_assignee_update_policy`<br>`project_tasks_admin_all` |
| **Team Directory & Workload** | `public.team_members` | `profile_id` $\to$ `profiles.id` | Read: Authenticated users<br>Write: Admin / Super Admin | `team_members_read_policy`<br>`team_members_admin_write` |
| **User Profiles** | `public.profiles` | `id` $\to$ `auth.users.id` | Read: Authenticated users<br>Write: Own profile or Admin | `profiles_select_policy`<br>`profiles_update_policy` |
| **Clients & Accounts** | `public.clients` | `id` (UUID) | Read: Authenticated staff | `clients_select_policy` |
| **Projects & Followups** | `public.client_projects` | `client_id` $\to$ `clients.id`<br>`followup_owner_id` $\to$ `profiles.id` | Read: Authenticated staff | `client_projects_select_policy` |
| **Activity & Audit Log** | `public.project_activity` | `task_id` $\to$ `project_tasks.id`<br>`project_id` $\to$ `client_projects.id`<br>`actor_id` $\to$ `profiles.id` | Read: Authenticated staff<br>Insert: System service / authenticated actor | `project_activity_select`<br>`project_activity_insert` |
| **Operational Alerts & Notifications** | `public.system_notifications` / `notifications` | `recipient_id` $\to$ `profiles.id`<br>`actor_id` $\to$ `profiles.id` | Read: Recipient only<br>Insert: System / service | `notifications_recipient_isolation` |

---

## 2. Workload KPIs & Metrics Pulse Traceability

### 2.1 Team Execution KPI Bar (Observed vs Recomputed)

In the current live database (221 tasks, 372 team members, 412 profiles), every visible metric has been mathematically recomputed and reconciled against the underlying database query:

```
Total project_tasks: 221
├── Main Tasks (parent_task_id IS NULL): 158
└── Subtasks / Stages (parent_task_id IS NOT NULL): 63
```

| KPI / Card Title | Displayed Value | Canonical DB Source Query | Exact Formula & Status Exclusions | Recomputed Result | Discrepancy & Root Cause Analysis |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **Active Deliverables** | `165` | `project_tasks` | `COUNT(*) WHERE status NOT IN ('done', 'approved', 'delivered', 'cancelled')` | **165** | **0 Discrepancy (Exact Match).** Counts all active main tasks (108) + active subtasks (57). $221 - 56 \text{ (done)} = 165$. |
| **Due Today** | `3` | `project_tasks` | `COUNT(*) WHERE status NOT IN (finished, cancelled) AND DATE(deadline) = CURRENT_DATE` | **3** | **0 Discrepancy (Exact Match).** 1 main task + 2 subtasks due today. |
| **Overdue** | `49` | `project_tasks` | `COUNT(*) WHERE status NOT IN (finished, cancelled) AND deadline < CURRENT_DATE AND NOT DATE(deadline) = CURRENT_DATE` | **49** | **0 Discrepancy (Exact Match).** Matches Executive Command Center operational exceptions 1:1. |
| **Waiting for Review** | `0` | `project_tasks` | `COUNT(*) WHERE status = 'review'` | **0** | **0 Discrepancy (Exact Match).** Currently no tasks in `review` status. |
| **Blocked** | `2` | `project_tasks` | `COUNT(*) WHERE status = 'blocked'` | **2** | **0 Discrepancy (Exact Match).** Exact tasks: Task `9c30c30a` & Task `06cbe164`. Matches ECC blocker count 1:1. |
| **Done Today** | `0` | `project_tasks` | `COUNT(*) WHERE status IN ('done', 'approved', 'delivered') AND DATE(completed_at) = CURRENT_DATE` | **0** | **0 Discrepancy (Exact Match).** No completions recorded today. |
| **Active Team Members** | `367` | `team_members` | `COUNT(*) WHERE is_active = true` | **367** | **0 Discrepancy (Exact Match).** Total records: 372; 5 inactive (`is_active = false`); Active = 367. |

---

## 3. UI Element to Database Field Traceability

### 3.1 Execution Queue Filters & Scopes (`/admin/my-work`)

| UI Element | Component | Filter / Logic | DB Fields Involved | Cache & Invalidation |
| :--- | :--- | :--- | :--- | :--- |
| **Scope Selector** ("My Work" vs "Team Execution") | View Toggle Pills | `activeView === "my" \|\| "team"`. Locked to `"my"` if `!isAdmin && !isSuperAdmin`. | None (client-side route state) | Preserved during navigation; worker forced to `"my"` |
| **Worker Combobox** ("My Assignments" / Member Selector) | `SADACombobox` | Filters tasks by `assignee_id === targetProfileId \|\| assignee_id === targetMemberId`. Only visible/active for Admins in Team view. | `project_tasks.assignee_id`, `team_members.profile_id`, `team_members.id` | Local React state (`selectedWorkerId`), resets to `"me"` on worker session |
| **Status Filter Pills** (`all`, `open`, `today`, `in_progress`, `blocked`, `review`, `upcoming`, `done`) | Filter Button Group | Splits `workerFilteredTasks` into status buckets. `open` excludes `done`, `approved`, `delivered`. | `project_tasks.status`, `project_tasks.deadline` | Dynamic memoization; real-time subscription auto-updates counts |
| **Search Input** | `SADAInput` / Search Box | Case-insensitive multi-field search across title, client name, service, description, and notes. | `project_tasks.title`, `project_tasks.service`, `project_tasks.notes`, `project_tasks.description`, `clients.name` | Local React state (`searchQuery`) |
| **Priority Filter** | `SADASelect` | Exact match against `t.priority` (`all`, `low`, `medium`, `high`, `urgent`) | `project_tasks.priority` | Local React state (`priorityFilter`) |
| **Client Filter** | `SADASelect` | Exact match against `t.client_id` | `project_tasks.client_id`, `clients.id` | Local React state (`clientFilter`) |

---

### 3.2 "Next Priority" Candidate Recommendation Engine

| Recommendation Factor | Component / Logic | Algorithm & Weighting | Canonical DB Source |
| :--- | :--- | :--- | :--- |
| **Actionability Check** | `checkStageActionability` | Subtasks with prerequisites in incomplete state are excluded ($isActionable = false$) | `project_tasks.parent_task_id`, `project_tasks.sort_order`, `project_tasks.status` |
| **Current In-Progress Bias** | `computeNextTask` | Any task already `status === 'in_progress'` is ranked first (Tier 1, Score 1000) | `project_tasks.status` |
| **Overdue Escalation** | `computeNextTask` | `differenceInDays(CURRENT_DATE, deadline) * 100 + PriorityWeight` (Urgent: 400, High: 200, Medium: 100, Low: 50) | `project_tasks.deadline`, `project_tasks.priority` |
| **Due Today / Tomorrow** | `computeNextTask` | Due Today: 500 base score; Due Tomorrow: 300 base score | `project_tasks.deadline` |
| **Blocker Exclusion** | `computeNextTask` | Tasks with `status === 'blocked'` or `status === 'paused'` or finished are excluded from candidacy | `project_tasks.status` |

---

### 3.3 Task Card Fields (`TaskCard.tsx` & `renderExecutionTaskCard`)

| Card UI Element | UI Display Format | Database Column / Resolution | Fallback / Default |
| :--- | :--- | :--- | :--- |
| **Task Title** | Heading (`h3`, font-semibold) | `project_tasks.title` | None (required field) |
| **Client Name** | Badge / sub-header | `clients.name` via `client_id` $\to$ `project_tasks.client_id` | `client_projects.client_name` $\to$ `"SADA Client"` |
| **Status Badge** | Color-coded `SADABadge` | `project_tasks.status` (`STATUS_CONFIG[status]`) | `STATUS_CONFIG.todo` |
| **Priority Badge** | Tier indicator + Priority Pill | `project_tasks.priority` (`PRIORITY_CONFIG[priority]`) | `PRIORITY_CONFIG.medium` |
| **Execution Tier** | `"TIER 1 · CRITICAL"`, `"TIER 2 · HIGH"`, etc. | `computeTaskExecutionTier(task)` | `"TIER 3 · NORMAL"` |
| **Deadline Display** | Formatted date + Relative badge (`Today`, `Overdue by Xd`) | `project_tasks.deadline` via `formatDate()` / `deadlineLabel()` | `"No deadline"` / Dim icon |
| **Assignee Avatar** | Avatar image + initials | `project_tasks.assignee_id` $\to$ `profiles.avatar_url` / `profiles.display_name` | Unassigned placeholder avatar |
| **Assigned By Info** | Assigning Lead label | `project_tasks.assigned_by_id` $\to$ `profiles.display_name` | `"Lead / Operations"` |
| **Deliverable Link** | Google Drive / external asset link | `project_tasks.result_links[0]` or `project_tasks.drive_link` | Hidden if null |
| **Subtask Progress** | `X / Y stages completed` | Count of `project_tasks` where `parent_task_id === task.id` | Hidden if no subtasks |

---

### 3.4 Task Details Workspace Modal (`TaskDetailModal.tsx`)

| Modal Section | Field / Control | Canonical DB Column / Action | Persistence Target | Optimistic Behavior | Cross-Page Invalidation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Header** | Status Popover / Quick Action Buttons | `project_tasks.status`, `project_tasks.completed_at` | Direct DB update + `project_activity` audit insert | Yes (local task state updated immediately) | Realtime channel `my-work-execution-sync`, `calendar`, `team_workload` |
| **Header** | Priority Selector | `project_tasks.priority` | Direct DB update | Yes | Realtime channel, Task cards re-ranked |
| **Header** | Deadline Picker (`SADADatePicker`) | `project_tasks.deadline` | Direct DB update + postponement audit log if postponed | Yes | Calendar projection recalculated |
| **Section 1: Overview** | Task Description & Brief | `project_tasks.description` | `project_tasks` | Local state $\to$ DB | Synced to TaskCard |
| **Section 1: Overview** | Assignment Instructions | `project_tasks.notes` (workflow metadata stripped via `cleanUserFacingNotes`) | `project_tasks` | Local state $\to$ DB | Visible to assigned worker only |
| **Section 2: Team** | Assignee Selection | `project_tasks.assignee_id` | Resolved via `resolveToProfileId(memberId)` to `profiles.id` | Yes | Team Workload table, Calendar assignee |
| **Section 2: Team** | Reviewer Selection | `project_tasks.reviewer_id` | `profiles.id` | Yes | Review notifications routed to reviewer |
| **Section 3: Deliverables** | Google Drive / Final Asset URL | `project_tasks.result_links` (array), `project_tasks.result_title` | `project_tasks` JSONB / text array | Yes | Client 360 Deliverables tab |
| **Section 4: Subtasks** | Stage List & Checkboxes | `project_tasks` where `parent_task_id === task.id` | Child rows in `project_tasks` | Child tasks updated individually | Stage progression updates parent progress % |
| **Section 5: Activity** | Audit Log & Discussion Notes | `project_activity` | Rows with `task_id === task.id` | Appended to activity timeline | Notification dispatched to assignee/reviewer |

---

## 5. Cross-Page Data Synchronization Pipeline

```mermaid
graph TD
    A[Task Mutation in My Work] -->|RPC / Direct Supabase Update| B[(project_tasks Table)]
    B -->|Postgres Trigger / WAL| C[Supabase Realtime Channel: my-work-execution-sync]
    C -->|Broadcast Event| D[/admin/my-work Execution Queue]
    C -->|Broadcast Event| E[/admin/team-workload Matrix]
    C -->|Broadcast Event| F[/admin/calendar Tasks Projection]
    C -->|Broadcast Event| G[/admin/clients/$id Client 360 Workspace]
    A -->|Audit Logger| H[(project_activity Table)]
    A -->|Notification Dispatcher| I[(system_notifications Table)]
    I -->|Realtime Channel: user_notifications| J[Notification Center Bell]
```

### Invalidation & Refresh Guarantees:
1. **Silent Background Invalidation:** Background updates call `loadMyWorkData(false)` without flipping `loading = true`, preventing skeleton flicker during active user interaction.
2. **Deep-Link State Guard:** `closedTaskIdRef` prevents reopening closed tasks when URL search params are asynchronously cleared.
3. **Optimistic Rollback:** On network error, `setTasks(prevTasks)` restores previous state and displays a localized Sonner toast with the server error message.

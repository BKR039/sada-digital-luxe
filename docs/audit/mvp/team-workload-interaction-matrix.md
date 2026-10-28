# SADA OS — Team Management & Workload Interaction Matrix
**Phase 8: Functional & Interaction Verification**

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Team Management & Workload  
**Primary Route:** `/admin/team-workload`  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Status:** COMPLETE

---

## 1. Primary Page Controls & Navigation

| Interaction Element | Expected Behavior | Canonical Read/Write | Permission Boundary | Persistence Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pulse Cards (KPIs)** | Displays Active Team (381), Active Tasks (180), Unassigned (57), Overdue (51), Blocked (2). | Read from `team_members` and `project_tasks`. | Admin / Super Admin | Realtime read | PASS |
| **Tab 1: Capacity & Workload** | Renders capacity cards for all active members. Shows active task count, capacity bar, status pill, and workload breakdown. | Read from `team_members` + derived `project_tasks`. | Admin / Super Admin | Local tab state | PASS |
| **Tab 2: Team Roster** | Shows specialist directory cards, SADA Works roles, public visibility badges, compensation indicator, and actions. | Read from `team_members` + `profiles`. | Admin / Super Admin | Local tab state | PASS |
| **Tab 3: Unassigned Tasks** | Lists active unassigned deliverables (57), bulk select checkboxes, bulk assign bar, smart specialist recommendation, single assign button. | Read from `project_tasks` (`assignee_id IS NULL`). Write to `project_tasks.assignee_id`. | Admin / Super Admin | Persisted to DB | PASS |
| **Search Input** | Filters roster and capacity cards by name, position, or operational email in real time. | In-memory search over loaded records. | Admin / Super Admin | Transient state | PASS |
| **Division Filter Dropdown** | Filters cards by division (Creative, Engineering, Strategy, Marketing, Video, etc.). | In-memory filter over loaded records. | Admin / Super Admin | Transient state | PASS |
| **Add Team Member Button** | Opens `TeamMemberModal` in creation mode with clean default values. | Opens dialog modal. | Admin / Super Admin | Transient state | PASS |

---

## 2. Team Member Lifecycle (`TeamMemberModal.tsx`)

| Field / Action | Expected Behavior | Canonical Read/Write | Permission Boundary | Persistence Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Profile Photo Upload** | Selects image file, validates image MIME type (<5MB), uploads to `team-avatars`, generates public URL. | Storage write to `team-avatars` bucket. | Admin / Super Admin | Persisted storage URL | PASS |
| **Full Name & Position** | Updates specialist name and operational role/title. | Write to `team_members.name` and `team_members.position`. | Admin / Super Admin | Persisted row update | PASS |
| **Bilingual Arabic Fields (`position_ar`, `bio_ar`)** | Allows entering Arabic title and bio for public website rendering on RTL/Arabic view. | Write to `team_members.position_ar` and `team_members.bio_ar`. | Admin / Super Admin | Persisted row update | PASS |
| **Operational Email** | Updates internal email contact. | Write to `team_members.email`. | Admin / Super Admin | Persisted row update | PASS |
| **Division & Skills** | Selects specialist division; adds/removes skill tags. | Write to `team_members.division` and `team_members.skills` (array). | Admin / Super Admin | Persisted row update | PASS |
| **Availability Status** | Toggles available, busy, on_leave, offline. | Write to `team_members.status`. | Admin / Super Admin | Persisted row update | PASS |
| **Employment Type** | Selects full_time, part_time, contractor, intern. | Write to `team_members.employment_type`. | Admin / Super Admin | Persisted row update | PASS |
| **SADA Works System Role** | Sets role (`worker`, `admin`, `super_admin`) in `public.profiles`. | Write to `profiles.role`. | Super Admin only | Persisted row update | PASS |
| **Compensation & Base Salary** | Enters monthly base salary, standard hours (default 160), auto-calculates hourly rate. | Write to `salary_records` + `team_members.hourly_cost`. | Admin / Super Admin | Persisted row update | PASS |
| **Public Visibility Switch** | Toggles public website publication flag. | Write to `team_members.published`. | Admin / Super Admin | Persisted row update | PASS |
| **Display Order Weight** | Enters integer weight for sorting on public team page. | Write to `team_members.display_order`. | Admin / Super Admin | Persisted row update | PASS |
| **Synthesized Member Save** | Editing a profile that lacks a `team_members` row seamlessly creates a new row linked to `profile_id`. | INSERT into `public.team_members`. | Admin / Super Admin | Persisted row insert | PASS |
| **Archive / Deactivate** | Sets `is_active = false` without deleting historical task records. | UPDATE `team_members.is_active = false`. | Admin / Super Admin | Persisted row update | PASS |
| **Delete (Super Admin)** | Safe deletion with cascade check. If historical tasks exist, prompts to deactivate instead. | DELETE from `team_members`. | Super Admin only | Persisted row delete | PASS |

---

## 3. Assignment & Workload Actions

| Action | Expected Behavior | Canonical Read/Write | Permission Boundary | Persistence Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Single Task Assignment** | Selecting a specialist from dropdown assigns task and removes it from Unassigned Tab immediately. | Writes `assignee_id` (`profiles.id`) to `project_tasks`. | Admin / Super Admin | Persisted to DB | PASS |
| **Bulk Task Selection** | Toggling select all or individual checkboxes updates selected task IDs set. | React state. | Admin / Super Admin | Transient state | PASS |
| **Bulk Assignment Execution** | Selects target specialist, clicks Assign, updates all selected tasks in a single batch. | Batch UPDATE to `project_tasks`. | Admin / Super Admin | Persisted to DB | PASS |
| **Smart Specialist Suggestion** | Suggests optimal specialist based on division, available capacity, and current workload. | Heuristic scoring over active capacity. | Admin / Super Admin | Read-only recommendation | PASS |
| **Member Workspace Drawer** | Clicks specialist card or drawer button, slides out drawer with active tasks, overdue warnings, and performance. | Read from `project_tasks` for selected member. | Admin / Super Admin | Transient state | PASS |
| **Task Reassignment in Drawer** | Allows reassigning any active deliverable directly within the specialist drawer. | Writes `assignee_id` to `project_tasks`. | Admin / Super Admin | Persisted to DB | PASS |

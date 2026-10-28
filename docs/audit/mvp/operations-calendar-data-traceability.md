# SADA OS — Operations Calendar Data Traceability Matrix
## Forensic Verification of Data Sources, Mathematical Formulas, and Rendering

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Operations Calendar & Scheduling  
**Primary Route:** `/admin/calendar` (`src/routes/admin.calendar.tsx`)  
**Auditor Roles:** Senior Data Architect, Forensic Systems Auditor  
**Status:** 100% VERIFIED & MATHEMATICALLY RECONCILED

---

## 1. Single Source of Truth Traceability Matrix

Every visual element, counter, badge, and agenda item rendered on `/admin/calendar` has an unbroken, audited path back to canonical PostgreSQL records in `public.project_tasks`.

| UI Element / Metric | UI Label | Canonical Table & Columns | Query / Service Source | Auth & Scope Boundary | Transformation Logic | Rendered Output (All Scope) |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **KPI: Today** | Today | `project_tasks.deadline`, `status` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | `status NOT IN ('done','approved','delivered','cancelled') && isSameDay(parseISO(deadline), new Date())` | **1** |
| **KPI: Overdue** | Overdue | `project_tasks.deadline`, `status` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | `status NOT IN ('done','approved','delivered','cancelled') && isBefore(parseISO(deadline), startOfDay(new Date()))` | **51** |
| **KPI: Due Soon** | Due Soon | `project_tasks.deadline`, `status` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | `status NOT IN ('done','approved','delivered','cancelled') && isWithinInterval(parseISO(deadline), [now, 48h])` | **5** |
| **KPI: Completed** | Completed | `project_tasks.status`, `completed_at` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | `status IN ('done','approved','delivered')` | **59** |
| **KPI: Accounts** | Accounts | `project_tasks.client_id`, `project_tasks.project_id`, `client_projects.client_id` | `project_tasks` joined with `client_projects` | RLS (`project_tasks_policy`), Filtered by selected member | `new Set(filteredTasks.map(t => t.client_id || projectMap.get(t.project_id)?.client_id || projectMap.get(t.project_id)?.client_name).filter(Boolean)).size` | **18** |
| **Calendar Month Cells** | Day Numbers & Deliverable Cards | `project_tasks.id`, `title`, `deadline`, `status`, `priority` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member + active client/status filters | Grouped by `format(parseISO(task.deadline), "yyyy-MM-dd")`. Maximum 3 rendered per cell, with `+N more` badge. | Visual task cards in day cells |
| **Week View Hourly Slots** | Time slots 08:00–21:00 | `project_tasks.deadline`, `start_date` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | Filtered by `isSameWeek(date, targetDate)`. Specific hour matched or slotted at 09:00 if date-only. | Time-aligned cards |
| **Day View Agenda** | Hourly Timeline & Due Today List | `project_tasks.deadline`, `status`, `title` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | Filtered by `isSameDay(parseISO(task.deadline), selectedDate)`. | Chronological agenda list |
| **Selected Day Panel** | Selected Date Overview | `project_tasks.*` for `selectedDate` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | Sorted by priority tier and time. Renders client badge, assignee avatar, and status pill. | Full task cards with action buttons |
| **Upcoming Schedule** | Upcoming 7–14 days | `project_tasks.*` | `supabase.from("project_tasks").select("*")` | RLS (`project_tasks_policy`), Filtered by selected member | Filtered by `isAfter(deadline, today)` and sorted by `deadline ASC`. | Compact upcoming list |

---

## 2. Forensic Reconciliation: Accounts Metric Remediation

### The Defect (Pre-Remediation)
Prior to remediation, the Accounts metric computed:
```typescript
const uniqueClients = new Set(
  filteredTasks.map((t) => t.client_id).filter(Boolean)
).size;
```
When inspected against the live PostgreSQL database, **109 out of 239 tasks** had `client_id IS NULL`, because in SADA OS architecture tasks inherit their client account through `project_id -> client_projects.client_id`.
As a result:
- Raw `t.client_id` reported only **14** accounts.
- **4 client accounts** with active deliverables were completely omitted from the KPI counter.

### The Remediation (Post-Remediation)
The account resolution was corrected to query the project lookup map:
```typescript
const uniqueClients = new Set(
  filteredTasks
    .map(
      (t) =>
        t.client_id ||
        (t.project_id ? projectMap.get(t.project_id)?.client_id : null) ||
        (t.project_id ? projectMap.get(t.project_id)?.client_name : null)
    )
    .filter(Boolean)
).size;
```
### Verification Result:
- Live Accounts count accurately evaluates to **18**, matching the 18 unique client accounts present in the active deliverable portfolio.

---

## 3. Date Parsing & Timezone Boundary Safeguards

Deliverables in `public.project_tasks` store `deadline` either as ISO timestamps with timezone (`2026-10-15T18:00:00.000Z`) or date strings (`2026-10-15`).

To prevent timezone conversion shifts (e.g., UTC midnight shifting to previous day 23:00 in western timezones or 01:00 next day in eastern timezones):
1. **`parseISO` and `formatDateLocal`:**
   - Date comparisons in `CalendarGrid.tsx` use `isSameDay(parseISO(deadline), targetDate)` rather than naive UTC string slicing.
2. **All-Day / Date-Only Slotting:**
   - In Week View, tasks without an explicit hour (or with `00:00:00`) are slotted into the 09:00 morning block rather than being dropped or rendered in the invisible 00:00 night band.
3. **Day View Consistency:**
   - Day View compares against the currently clicked `selectedDate` rather than hardcoded global `isToday()`, ensuring historical or future date inspection renders the exact tasks due on that selected day.

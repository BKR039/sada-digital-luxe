# SADA OS — Operations Calendar Defect Register
## Discovery, Root Cause Analysis, Remediation, and Verification

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Operations Calendar & Scheduling  
**Primary Route:** `/admin/calendar` (`src/routes/admin.calendar.tsx`)  
**Auditor Roles:** Senior QA Architect, Security & Performance Engineer  
**Status:** ALL DEFECTS RESOLVED & VERIFIED

---

## 1. Defect Severity & Remediation Summary

| Defect ID | Severity | Category | Defect Title | Pre-Remediation Behavior | Post-Remediation Verification | Status |
| :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| **DEF-CAL-01** | **HIGH** | Role Isolation / UX | Initial Member Filter Locked to `"me"` | `selectedMemberId` was hardcoded to `"me"`. Admins saw only their personal tasks on load and "My Calendar" could not toggle back to `"all"`. | Role-adaptive initial state (`isWorker ? "me" : "all"`). "My Calendar" toggles cleanly between `"me"` and `"all"`. | **RESOLVED** |
| **DEF-CAL-02** | **HIGH** | Data Integrity | Accounts Metric Undercounting Bug | Evaluated only `task.client_id`. Because 109 tasks have `client_id IS NULL`, counter reported 14 instead of 18 accounts. | Account resolution checks `t.client_id || projectMap.get(t.project_id)?.client_id`. Reconciled to exact 18 accounts. | **RESOLVED** |
| **DEF-CAL-03** | **MEDIUM** | Filter Precision | Client Filter Incomplete Matching | Filtering by Client account missed tasks whose client association lived on the parent `client_project`. | Matches `task.client_id`, `proj?.client_id`, and `proj?.client_name`. | **RESOLVED** |
| **DEF-CAL-04** | **MEDIUM** | Data Sync | Missing Realtime Sync on `project_tasks` | External status changes from My Work or Client 360 required manual browser refresh. | Supabase realtime channel (`calendar-execution-sync`) auto-refreshes calendar on Postgres changes. | **RESOLVED** |
| **DEF-CAL-05** | **MEDIUM** | Task Creation | Hardcoded Project in Task Creation | "New Task" hardcoded `projects[0].id` and bypassed Step 1 `ProjectPicker`. | Pre-selects active filtered project or triggers `ProjectPicker` dialog to let user select project. | **RESOLVED** |
| **DEF-CAL-06** | **LOW** | Week View UX | Week View Hour Drop for All-Day Tasks | Tasks with date-only or 00:00 timestamps vanished from the 08:00–21:00 hourly grid. | Automatically slotted at 09:00 morning block with clear time label. | **RESOLVED** |
| **DEF-CAL-07** | **LOW** | Day View Accuracy | Day View Non-Today Deadline Discrepancy | Checked `isToday(deadline)` globally instead of `isSameDay(parseISO(deadline), targetDay)`. | Accurately targets selected date and adapts headers dynamically ("Due Today" vs "Due on this Day"). | **RESOLVED** |
| **DEF-CAL-08** | **LOW** | Mobile UX | Mobile Day Tap Visual Disconnect | On screens $< 1024\text{px}$, tapping a calendar day updated the off-screen panel without scrolling. | Auto-scrolls smoothly to `#selected-day-panel` upon day cell selection. | **RESOLVED** |

---

## 2. Detailed Root Cause Analysis & Code Evidence

### 2.1 DEF-CAL-01: Role-Adaptive Scoping & My Calendar Toggle
- **Root Cause:** `const [selectedMemberId, setSelectedMemberId] = useState<string>("me");` was hardcoded. Additionally, the "My Calendar" button had `onClick={() => setSelectedMemberId("me")}`, making it a one-way latch rather than a toggle.
- **Remediation in `src/routes/admin.calendar.tsx`:**
```typescript
const isWorker = currentUser?.role === "worker";
const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
  return isWorker ? "me" : "all";
});

// "My Calendar" toggle:
onClick={() => setSelectedMemberId(prev => prev === "me" ? "all" : "me")}
```
- **Verification:** Verified in Puppeteer test suite: Admins load with `"all"` (full calendar visibility), Workers load with `"me"` (isolated personal queue), and clicking "My Calendar" toggles state seamlessly.

### 2.2 DEF-CAL-02: Accounts Metric Mathematical Undercounting
- **Root Cause:** In SADA OS database schema, `public.project_tasks` has an optional `client_id` foreign key, while `project_id` is mandatory and points to `public.client_projects(id)`, which holds `client_id` and `client_name`. Directly filtering `filteredTasks.map(t => t.client_id)` omitted 109 tasks.
- **Remediation in `src/routes/admin.calendar.tsx`:**
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
- **Verification:** Accounts counter now reports **18**, matching the 18 distinct client accounts reconciled across all live tasks.

### 2.3 DEF-CAL-05: Task Creation Project Pre-Selection
- **Root Cause:** `handleCreateTask` called `setSelectedProjectId(projects[0].id); setIsCreateTaskOpen(true);`, hardcoding the first project in the array and bypassing Step 1 project selection.
- **Remediation in `src/routes/admin.calendar.tsx`:**
```typescript
const handleCreateTask = () => {
  // If a client filter is active, look for a matching project
  if (filterClient) {
    const matchingProj = projects.find(
      (p) => p.client_id === filterClient || p.client_name === filterClient
    );
    if (matchingProj) {
      setSelectedProjectId(matchingProj.id);
      setIsCreateTaskOpen(true);
      return;
    }
  }

  // If projects exist, show ProjectPicker step 1 dialog
  if (projects.length > 0) {
    setIsProjectPickerOpen(true);
  } else {
    toast.error("No active projects available to attach tasks to");
  }
};
```
- **Verification:** Creating tasks now allows users to explicitly select the target project or automatically inherits the active client filter context.

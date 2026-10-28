# SADA OS — Operations Calendar Interaction Matrix
## Comprehensive Control Audit, State Transitions, and Event Handlers

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Operations Calendar & Scheduling  
**Primary Route:** `/admin/calendar` (`src/routes/admin.calendar.tsx`)  
**Auditor Roles:** Senior Frontend Quality Engineer, Accessibility Specialist  
**Status:** 100% PASS (All Controls Verified in Browser & Puppeteer Suite)

---

## 1. Reachable Controls & Interaction Inventory

| Control ID | Section / Location | Control Name | Target Action | Authorized Roles | Optimistic / UI Feedback | Test Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **CTL-CAL-01** | Header Controls | "My Calendar" Toggle | Toggles between personal assignments (`"me"`) and agency-wide view (`"all"`) | All authenticated | Instant filter toggle; button background shifts between active primary and secondary | **PASS** |
| **CTL-CAL-02** | Header Controls | Team Member Selector | Selects specific specialist from directory | Admin, Super Admin | Dropdown selection updates calendar cards and counters instantly | **PASS** |
| **CTL-CAL-03** | Header Controls | "New Task" Button | Opens `TaskModal.tsx` deliverable creation dialog | All authenticated | Modal dialog opens with autofocus on task title input | **PASS** |
| **CTL-CAL-04** | Calendar Header | View Selector: Month | Switches calendar to 7x5 month grid | All | Immediate re-render of month grid view | **PASS** |
| **CTL-CAL-05** | Calendar Header | View Selector: Week | Switches calendar to 7-day hourly grid (08:00–21:00) | All | Immediate re-render of week schedule view | **PASS** |
| **CTL-CAL-06** | Calendar Header | View Selector: Day | Switches calendar to high-density single-day agenda | All | Immediate re-render of selected day agenda | **PASS** |
| **CTL-CAL-07** | Calendar Header | Previous Button (`<`) | Moves current viewing window back 1 unit (month/week/day) | All | Instant date arithmetic updates display header and calendar cells | **PASS** |
| **CTL-CAL-08** | Calendar Header | Next Button (`>`) | Moves current viewing window forward 1 unit (month/week/day) | All | Instant date arithmetic updates display header and calendar cells | **PASS** |
| **CTL-CAL-09** | Calendar Header | "Today" Button | Re-centers calendar viewing window to current date | All | Instant view re-centering to today | **PASS** |
| **CTL-CAL-10** | Filter Bar | Client Filter Dropdown | Filters calendar tasks by client account | All | In-memory filtering updates cards, calendar dots, and metrics | **PASS** |
| **CTL-CAL-11** | Filter Bar | Status Filter Dropdown | Filters calendar tasks by status (`todo`, `in_progress`, `review`, `blocked`, `done`) | All | Instantaneous visual queue filtering | **PASS** |
| **CTL-CAL-12** | Filter Bar | Reset Filters Button | Resets client, status, and team member filters to default | All | Restores default view with all active deliverables | **PASS** |
| **CTL-CAL-13** | Calendar Grid | Month Day Cell Click | Selects date and populates Selected Day side panel | All | Highlighting of cell border; triggers mobile auto-scroll to `#selected-day-panel` (<1024px) | **PASS** |
| **CTL-CAL-14** | Calendar Grid | Task Card Click | Opens `TaskDetailModal.tsx` for clicked deliverable | All | Sets `selectedTaskId`, launches workspace dialog with execution controls | **PASS** |
| **CTL-CAL-15** | Calendar Grid | `+N more` Badge | Expands day deliverables or switches to Day View | All | Navigates or exposes full list for high-density dates | **PASS** |
| **CTL-CAL-16** | Selected Day Panel | Task Card Header / Title | Inspects deliverable details | All | Opens `TaskDetailModal` | **PASS** |
| **CTL-CAL-17** | Selected Day Panel | Status Pill Popover | Quick transition of deliverable status | Assignee, Admin | Updates Supabase record + emits `project_activity` entry | **PASS** |
| **CTL-CAL-18** | Upcoming Schedule | Upcoming Task Row | Deep links to deliverable workspace | All | Opens `TaskDetailModal` | **PASS** |
| **CTL-TM-01** | Task Creation Modal | Title & Description Inputs | Form input fields with validation | All authenticated | Real-time form state validation; prevents empty title submission | **PASS** |
| **CTL-TM-02** | Task Creation Modal | Project Selector | Assigns deliverable to specific client project | All authenticated | Populates target project ID and client association | **PASS** |
| **CTL-TM-03** | Task Creation Modal | Assignee Combobox | Designates specialist via `resolveToProfileId` | All authenticated | Maps selected team member to canonical `profiles.id` | **PASS** |
| **CTL-TM-04** | Task Creation Modal | Deadline DatePicker | Assigns execution deadline timestamp | All authenticated | Sets formatted ISO deadline | **PASS** |
| **CTL-TM-05** | Task Creation Modal | Create Task Submit | Saves new deliverable to `public.project_tasks` | All authenticated | Submits to database, closes modal on success, triggers realtime update | **PASS** |
| **CTL-TDM-01** | Task Detail Modal | Modal Close (X / Escape) | Dismisses workspace dialog | All | Clears `selectedTaskId`, unmounts modal cleanly | **PASS** |
| **CTL-TDM-02** | Task Detail Modal | Lifecycle Action: Start | Transitions deliverable from `todo` to `in_progress` | Assignee, Admin | Optimistic status update + database update + toast notification | **PASS** |
| **CTL-TDM-03** | Task Detail Modal | Lifecycle Action: Postpone | Reschedules deliverable with mandatory reason | Assignee, Admin | Requires postpone reason, updates deadline and `postpone_reason` | **PASS** |
| **CTL-TDM-04** | Task Detail Modal | Lifecycle Action: Block | Marks task blocked with mandatory reason | Assignee, Admin | Sets `status = 'blocked'`, records `blocked_reason` | **PASS** |
| **CTL-TDM-05** | Task Detail Modal | Send Alert Button | Broadcasts priority notification | Assignee, Reviewer, Admin | Opens `SendTaskAlertModal`, emits in-app alert | **PASS** |

---

## 2. Dynamic State Management & Filter Composition

The filter engine on `/admin/calendar` evaluates composite predicate logic across all active filter dimensions simultaneously:

```typescript
const filteredTasks = useMemo(() => {
  return tasks.filter((task) => {
    // 1. Team Member / Personal Scope Filter
    if (selectedMemberId === "me") {
      const myId = currentUser?.id;
      if (task.assignee_id !== myId) return false;
    } else if (selectedMemberId && selectedMemberId !== "all") {
      const targetProfileId = resolveToProfileId(selectedMemberId, teamMembers, profiles) || selectedMemberId;
      if (task.assignee_id !== targetProfileId) return false;
    }

    // 2. Client Account Filter (direct client_id OR project_id lookup)
    if (filterClient) {
      const proj = projectMap.get(task.project_id);
      const matchesDirect = task.client_id === filterClient;
      const matchesProjClient = proj?.client_id === filterClient;
      const matchesProjName = proj?.client_name === filterClient;
      if (!matchesDirect && !matchesProjClient && !matchesProjName) return false;
    }

    // 3. Status Filter
    if (filterStatus) {
      if (task.status !== filterStatus) return false;
    }

    return true;
  });
}, [tasks, selectedMemberId, filterClient, filterStatus, currentUser, teamMembers, profiles, projectMap]);
```

### Invariant Verification:
1. Active filters compose via logical `AND`. No filter silently overrides another.
2. Clicking "Reset Filters" clears `filterClient`, `filterStatus`, and resets `selectedMemberId` to the role default (`"all"` for admin, `"me"` for worker).
3. Switching between Month, Week, and Day views preserves all active filter states intact.

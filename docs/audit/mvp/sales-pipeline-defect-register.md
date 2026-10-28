# SADA OS — Sales Pipeline Defect Register & Remediation Log

## 1. Executive Summary

This register catalogs all architectural, UX, data integrity, and calculation defects identified during the Sales Pipeline MVP audit, along with exact reproduction steps, root causes, remediation files, and verification outcomes.

---

## 2. Comprehensive Defect Register

### DEF-SALES-001: Multi-Row Wrapping Kanban Grid Layout
- **Severity:** CRITICAL (Primary UX Requirement)
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Open `/admin/sales` in desktop viewport (1440×900 or 1280×800).
  2. Observe that 8 stages are wrapped into two rows of 4 columns each, violating the single horizontal track UX requirement.
- **Root Cause:** Line 1000 of `SalesWorkspaceView.tsx` utilized Tailwind class `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`.
- **Files Changed:**
  - `src/components/admin/SalesWorkspaceView.tsx`
  - `src/styles.css`
- **Remediation Details:** Replaced `grid` with `flex flex-row items-start gap-4 overflow-x-auto kanban-horizontal-track`. Set columns to `shrink-0 w-[290px] sm:w-[310px] md:w-[320px] max-w-[320px]`.
- **Test Evidence:** Confirmed zero wrapping across desktop, tablet, and mobile; verified in build and responsive test suite.

---

### DEF-SALES-002: Missing Kanban Horizontal Navigation & Quick-Jump Controls
- **Severity:** HIGH
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Shrink viewport or inspect distant stages (`won`, `lost`).
  2. Note lack of left/right scroll buttons and no direct stage targeting mechanism.
- **Root Cause:** No horizontal navigation controls or scroll position state were implemented.
- **Files Changed:** `src/components/admin/SalesWorkspaceView.tsx`
- **Remediation Details:**
  - Implemented `kanbanTrackRef`, `stageColumnRefs`, `canScrollLeft`, `canScrollRight`, and `activeVisibleStage`.
  - Added horizontal stage quick-jump pills with deal counters and active pill synchronization.
  - Added `ChevronLeft` and `ChevronRight` scroll buttons with boundary detection and RTL inversion.
- **Test Evidence:** Verified in `verify-sales-pipeline-remediation.ts` and UI layout inspection.

---

### DEF-SALES-003: Absence of Edge Auto-Scrolling During Card Drag
- **Severity:** MEDIUM
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Drag a card from column 1 (`lead`).
  2. Attempt to move it to column 7 (`won`) on a viewport smaller than total track width.
  3. The board does not scroll horizontally when approaching the right container edge.
- **Root Cause:** `handleDragOver` only executed `e.preventDefault()` without checking cursor proximity to container boundaries.
- **Files Changed:** `src/components/admin/SalesWorkspaceView.tsx`
- **Remediation Details:** Added 65px edge proximity zone in `handleDragOver` that adjusts `kanbanTrackRef.scrollLeft` smoothly (+/- 14px per tick).
- **Test Evidence:** Drag auto-scrolling functions cleanly without triggering vertical page scrolling.

---

### DEF-SALES-004: Edit Deal Modal Missing Stage Selector
- **Severity:** MEDIUM
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Open Deal Details and click "Edit Deal".
  2. Observe that there is no stage field available in the form.
- **Root Cause:** Form only tracked title, company, contact, package, value, sponsoring, and notes. View mode also lacked a direct stage changer.
- **Files Changed:** `src/components/admin/SalesWorkspaceView.tsx`
- **Remediation Details:**
  - Added `editStage` state and `stageEditOptions` in Edit Deal form.
  - Added stage transition check in `handleSaveDealEdit` executing `updateLeadStage` if changed.
  - Added interactive Stage Banner with quick changer dropdown in View Deal details.
- **Test Evidence:** Validated stage update persistence and conversion guard.

---

### DEF-SALES-005: Worker Performance Matrix Active Pipeline Omission
- **Severity:** MEDIUM (Operational / Financial Accuracy)
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Inspect Commercial Team Performance Matrix pipeline values.
  2. Observe that deals in `lead` and `contacted` stages were omitted from active pipeline value.
- **Root Cause:** Filter hardcoded `["qualified", "meeting", "proposal", "negotiation"]`, excluding the first two canonical pipeline stages.
- **Files Changed:** `src/components/admin/SalesWorkspaceView.tsx`
- **Remediation Details:** Replaced hardcoded array with canonical active filter: `!["won", "lost"].includes(d.stage)`.
- **Test Evidence:** Verified in Test 3 of `verify-sales-pipeline-remediation.ts` (sums all 6 active stages = 21,000 TND).

---

### DEF-SALES-006: Worker Performance Matrix Cluttered by 386 Inactive Members
- **Severity:** LOW / USABILITY
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Navigate to "Worker Performance Matrix" tab as an admin.
  2. Table rendered 386 rows unconditionally, creating scrolling fatigue.
- **Root Cause:** Unconditional `teamMembers.map(...)` without search or active sales member filtering.
- **Files Changed:** `src/components/admin/SalesWorkspaceView.tsx`
- **Remediation Details:** Added `filteredPerformanceMembers` memoization with instant debounced search and an "Active Reps Only" toggle, sorted by deal activity.
- **Test Evidence:** Active reps view reduces table rows to active sales reps while keeping all members searchable.

---

### DEF-SALES-007: Absence of Realtime Business Rules Subscription in Sales Workspace
- **Severity:** LOW
- **Status:** **PASS / RESOLVED**
- **Reproduction Steps:**
  1. Update initial commission rate in Business Rules Engine from 15% to 18%.
  2. Return to Sales Workspace; displayed commission rule rate remained at stale value until browser reload.
- **Root Cause:** Component did not subscribe to `subscribeToBusinessRules`.
- **Files Changed:** `src/components/admin/SalesWorkspaceView.tsx`
- **Remediation Details:** Subscribed to `subscribeToBusinessRules` in `useEffect` on mount.
- **Test Evidence:** Realtime subscription confirmed in component lifecycle.

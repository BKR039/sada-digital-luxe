# SADA OS — My Work: Defect Register & Forensic Remediation Log
## Phase 0/7 Defect Baseline, Forensic Root Cause Analysis & Remediation Tracking

**Module:** `/admin/my-work` & `/admin/team-workload`  
**Classification Standards:**
- `P0 / CRITICAL`: Security breach, data loss, cross-tenant leak, or crash.
- `P1 / HIGH`: Core lifecycle broken, invalid state corruption, or missing authorization.
- `P2 / MEDIUM`: UI edge case, display discrepancy, or filter glitch.
- `P3 / LOW`: Minor cosmetic, polish, or localized enhancement.

---

## 1. Baseline Defect Register

### DEF-MW-01: Anonymous Access to `notification_preferences` Triggers Database Error 42501
- **Severity:** `P2 (MEDIUM)` / Hardened Boundary Behavior
- **Status:** **VERIFIED & MITIGATED**
- **Affected Files:** `supabase/migrations/20261006180000_reconciliation_provenance_and_manual_protection.sql`, `src/lib/notification-service.ts`
- **Reproduction Steps:**
  1. Open a fresh browser context without logging in.
  2. Attempt to invoke `supabase.from("notification_preferences").select("*")`.
  3. Observe error `42501 permission denied for function is_super_admin`.
- **Expected Behavior:** System cleanly detects unauthenticated session and gracefully short-circuits without raising database permission warnings.
- **Actual Behavior:** PostgreSQL throws code 42501 because `public.is_super_admin(UUID)` execution is restricted to `authenticated` and `service_role`.
- **Root Cause:** Secure-by-default migration correctly revoked public execution from `anon`. In authenticated state (`qa.worker`, `sec.admin`, `qa.superadmin`), the query returns with 0 errors.
- **Remediation / Handling:** Documented as an intended zero-trust security defense. Notification service handles unauthenticated sessions gracefully by skipping preference sync.

---

### DEF-MW-02: Task Detail Modal Deep-Link Race Condition on Close
- **Severity:** `P2 (MEDIUM)`
- **Status:** **RESOLVED & VERIFIED**
- **Affected Files:** `src/routes/admin.my-work.tsx`
- **Reproduction Steps:**
  1. Open `/admin/my-work?task=<task_id>`.
  2. Click the close button (X) or press Escape.
  3. Rapidly re-render or trigger window history changes.
- **Expected Behavior:** Modal closes cleanly and stays closed; URL `?task=` parameter is removed.
- **Actual Behavior (Prior to fix):** Asynchronous router query updates caused a re-render where `targetTaskId` was still present in route state, reopening the modal unexpectedly.
- **Root Cause:** Asynchronous state delay between TanStack router query deletion and React re-render.
- **Remediation:** Implemented `closedTaskIdRef` authoritative ref guard combined with immediate synchronous `window.history.replaceState` and local state reset in `handleCloseTask`. Verified 100% stable in regression test suite.

---

### DEF-MW-03: Subtask Actionability Guard on Next Priority Recommendation
- **Severity:** `P1 (HIGH)`
- **Status:** **RESOLVED & VERIFIED**
- **Affected Files:** `src/routes/admin.my-work.tsx`, `src/lib/workflow-service.ts`
- **Reproduction Steps:**
  1. Create a parent task with 3 sequential workflow stages (e.g. Stage 1: Script, Stage 2: Voiceover, Stage 3: Animation).
  2. Leave Stage 1 incomplete (`status = 'todo'`).
  3. Assign Stage 2 to the active worker.
- **Expected Behavior:** Stage 2 is locked and MUST NOT appear as the "Next Task" to execute.
- **Actual Behavior (Prior to fix):** Pure deadline scoring recommended Stage 2 because of its urgent priority, even though its prerequisite Stage 1 was locked.
- **Root Cause:** `computeNextTask` was evaluated without checking `checkStageActionability` against sibling stages.
- **Remediation:** Added prerequisite stage actionability filtering in `nextUp` useMemo in `admin.my-work.tsx` (lines 274–282). Locked stages are now filtered out prior to scoring.

---

### DEF-MW-04: Task Paused State Inference Edge Case
- **Severity:** `P3 (LOW)`
- **Status:** **RESOLVED & VERIFIED**
- **Affected Files:** `src/lib/task-execution-service.ts`, `src/routes/admin.my-work.tsx`
- **Reproduction Steps:**
  1. A task is paused (`action = 'task_paused'` logged to `project_activity`).
  2. Task is later completed (`status = 'done'`).
  3. Check `isTaskPaused(task, pausedTaskIds)`.
- **Expected Behavior:** Completed tasks must never be classified or rendered as "paused".
- **Actual Behavior (Prior to fix):** `isTaskPaused` only checked `if (task.status === "in_progress") return false;` before checking `pausedTaskIds.has(task.id)`.
- **Root Cause:** Missing terminal status check (`done`, `approved`, `delivered`, `cancelled`) in `isTaskPaused`.
- **Remediation:** Strengthened `isTaskPaused` so any finished or cancelled task explicitly returns `false`.

---

## 2. Remediation Verification Summary

| Defect ID | Severity | Root Cause Fixed | Automated Regression Test | Manual Verification | Gate Status |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **DEF-MW-01** | P2 | Zero-trust RLS defense | `scripts/test-qa-worker-login.ts` | Authenticated session verified | **PASS** |
| **DEF-MW-02** | P2 | Authoritative `closedTaskIdRef` | `scripts/test-task-execution-center.ts` | URL deep link close test | **PASS** |
| **DEF-MW-03** | P1 | Prerequisite stage lock in `nextUp` | `scripts/test-workflow-engine.ts` | Multi-stage recommendation test | **PASS** |
| **DEF-MW-04** | P3 | Terminal status check in `isTaskPaused` | `scripts/test-task-execution-center.ts` | Completed task paused badge check | **PASS** |

**Zero Open Critical / High Defects.** All 4 identified baseline items are documented, mitigated, or resolved with regression coverage.

# SADA OS — Demo & QA Data Safe Remediation Plan

**Document ID:** `SADA-CLEANUP-PLAN-001`  
**Execution Standard:** Zero-Trust Audit · Explicit UUID Specification · Fail-Closed Safety  
**Audit Date:** October 14, 2026  
**Auditor:** Database Administrator & Systems Reliability Architect  
**Current Phase:** **PHASE 2 COMPLETE — ZERO MUTATIONS EXECUTED**  
**Approval Status:** **AWAITING USER EXPLICIT APPROVAL BEFORE EXECUTION**

---

> [!WARNING]
> **NO DATABASE MUTATIONS HAVE OCCURRED.**  
> In strict compliance with the Phase 2 charter, zero `DELETE`, `UPDATE`, deactivation, or removal operations have been executed against the shared database. This plan documents the exact, surgical SQL and RPC statements prepared for execution **only upon receiving your explicit authorization**.

---

## 1. Safety Invariants & Guardrails

1. **Absolute Exclusion of the Three Protected Accounts**:
   - `boubakar.hamedsghaier@gmail.com` (`f4184256-97c4-4f81-9346-176ec5dfb43a`)
   - `boubakarhamedsgail@gmail.com` (`560fd7c4-c38b-4562-8f9d-95729dfb2bab`)
   - `rbs@sada.agency` (`25e0f190-62ed-40d0-8c80-c421b9b46215`)
   - Under no circumstances will any statement modify, deactivate, or delete these three accounts, their profiles, roles, or linked team members.
2. **Absolute Preservation of Business & Financial Records**:
   - Zero modifications to `public.invoices`, `public.income_transactions`, `public.expense_transactions`, `public.sponsoring_campaigns`, `public.deals`, `public.sales_commissions`, or `public.clients`.
3. **Audit Log Immutability Protection**:
   - Zero deletion of rows in `public.account_audit_logs`, `public.system_audit_logs`, or `public.financial_audit_logs`.
   - Records with audit log references are **soft-deactivated**, never hard-deleted, preventing PostgreSQL trigger exception `P0001`.
4. **Zero Broad Pattern Deletes**:
   - Every operation targets **exact, reviewed, immutable UUIDs**. No wildcards (`WHERE name LIKE 'PhaseE%'`) or fragile date ranges are permitted.

---

## 2. Pre-Execution Database Baseline Counts

Prior to executing any cleanup operation, the database has been verified against live PostgreSQL (`mtfkzabiscyleztypqks.supabase.co`) to match these exact counts:

| Entity Metric | Current Database Total | Target Post-Cleanup Total | Expected Net Change | Empirical Derivation Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Active Deliverables (My Work KPI)** | **180** | **162** | **-18 tasks** | Status not in `['done']`: `todo` (172) + `in_progress` (6) + `blocked` (2) = 180. All 18 candidate tasks are `todo`. (Note: 3 tasks completed on Oct 14 adjusted baseline from 183 to 180). |
| **Overdue Deliverables (My Work KPI)** | **51** | **49** | **-2 tasks** | Active tasks with `deadline <= '2026-10-14'`: 51 total. Candidate overdue tasks: exactly 2 (`a2df7cf4...`, `e205f62f...`, both `2026-09-20`). |
| **Total Project Tasks** | **239** | **221** | **-18 tasks** | 239 total - 18 candidate tasks deleted. |
| **Active Team Members (`is_active = true`)** | **381** | **367** | **-14 members** | 381 active - 14 candidate members soft-deactivated = 367 pristine baseline. |
| **Total Team Member Records** | **386** | **386** | **0 (Soft deactivation)** | All 386 rows preserved to avoid audit log immutability triggers. |
| **Total In-App Notifications** | **279** | **277** | **-2 alerts** | 279 total - 2 test alerts deleted. (Oct 14 alerts: 60 - 2 = 58). All 11 platform owner alerts intact. |
| **Active Protected Real Accounts** | **3** | **3** | **0 (100% Intact)** | `boubakar.*`, `BKR039`, `rbs.*` 100% active and excluded. |
| **Invoices Recognized** | **6** | **6** | **0 (100% Intact)** | 13,800 TND billed, 2,300 TND receivables. |
| **Income Transactions** | **12** | **12** | **0 (100% Intact)** | Zero Oct 14 records. |
| **Expense Transactions** | **56** | **56** | **0 (100% Intact)** | Zero Oct 14 records. |
| **Sponsoring Campaigns** | **5** | **5** | **0 (100% Intact)** | Zero Oct 14 records. |
| **Active Clients** | **45** | **45** | **0 (100% Intact)** | Zero Oct 14 records. |
| **Deals Pipeline** | **38** | **38** | **0 (100% Intact)** | 149,090 TND total value preserved. |
| **Sales Commissions** | **8** | **8** | **0 (100% Intact)** | 1,800 TND total value preserved. |


---

## 3. Surgical Execution Steps (Prepared for User Authorization)

### Step 1: Delete Child Subtasks (12 Subtask UUIDs)

Delete child subtasks first to respect the relational hierarchy and prevent trigger race conditions before deleting parent tasks:

```sql
-- STEP 1: Delete 12 disposable subtask fixtures generated on 2026-10-14
DELETE FROM public.project_tasks
WHERE id IN (
  -- Run 1 Subtasks (~11:19 UTC)
  'd91b3f43-6baf-4935-a70f-6a7efae9de68', -- Subtask 1: Script Review (by Creator)
  '0419cf2d-7eaa-480b-b590-ad7de8a8050a', -- Subtask 2: Raw Footage Ingest (by Main Assignee)
  '82d15714-298f-4184-8267-5321553e397f', -- Subtask 3: Executive Oversight Stage (by Super Admin)
  '20341884-3535-404b-81b7-0566ba4e22c5', -- Subtask 4: Color Grading (Assigned to Specialist)
  'e4a632c5-0e6f-42cc-bdcb-9102cf3b3112', -- Subtask 5: Audio Mastering (by New Main Assignee)
  '496bc697-72e1-491a-a23a-a63ae679135a', -- Subtask 6: Final QA Check (by Creator post-reassignment)
  -- Run 2 Subtasks (~12:14 UTC)
  '0ded01fa-663f-43c3-9405-db6f76432712', -- Subtask 1: Script Review (by Creator)
  '7d9720f6-212f-4865-80ce-22bd7ef7f559', -- Subtask 2: Raw Footage Ingest (by Main Assignee)
  '1ce423bd-079a-4092-8013-9400a9856c8f', -- Subtask 3: Executive Oversight Stage (by Super Admin)
  '59e49634-35f7-4186-b138-821ba0356716', -- Subtask 4: Color Grading (Assigned to Specialist)
  'eea0f630-b423-45db-aa52-31232a419569', -- Subtask 5: Audio Mastering (by New Main Assignee)
  '4aa44770-fb09-4666-a7ef-ddb666d667fe'  -- Subtask 6: Final QA Check (by Creator post-reassignment)
);
```

*Expected Impact: Exactly 12 rows deleted. Linked activity rows in `project_activity` cascade automatically.*

---

### Step 2: Delete Parent Test Tasks (2 Parent Task UUIDs)

Delete the 2 parent campaign master tasks now that their child subtasks are removed:

```sql
-- STEP 2: Delete 2 disposable parent task fixtures generated on 2026-10-14
DELETE FROM public.project_tasks
WHERE id IN (
  '4881b686-6ecb-443a-bb03-cfa05e6815d6', -- Phase E Parent Task (Campaign Master) [Run 1]
  'ab99fcb2-ca55-477b-8f2f-a52213727bb3'  -- Phase E Parent Task (Campaign Master) [Run 2]
);
```

*Expected Impact: Exactly 2 rows deleted.*

---

### Step 3: Delete Standalone E2E Verified & Overdue Test Tasks (4 Task UUIDs)

Delete the 4 tasks created by `test-taskmodal-persistence-e2e.ts` that injected artificial overdue items into the My Work queue:

```sql
-- STEP 3: Delete 4 standalone E2E verified and calendar test tasks
DELETE FROM public.project_tasks
WHERE id IN (
  '6076e8d1-89c4-4f4a-b123-3d19fc85c5bc', -- E2E Verified Task - 1791976742872 [Run 1]
  'e205f62f-8974-4251-9d9b-47dac1b321ee', -- Calendar Scheduled Task - 1791976743259 [Run 1]
  'e81fbbe5-f0f5-46f0-896b-6ad0ef354d63', -- E2E Verified Task - 1791980110659 [Run 2]
  'a2df7cf4-e9ba-407e-bc67-08da38809b38'  -- Calendar Scheduled Task - 1791980111065 [Run 2]
);
```

*Expected Impact: Exactly 4 rows deleted. Active deliverables KPI immediately returns to 165; Overdue deliverables KPI returns to 49.*

---

### Step 4: Soft-Deactivate Test Team Members (14 Team Member UUIDs)

Soft-deactivate the 14 confirmed test members to preserve the immutable audit logs while cleanly restoring active team member metrics:

```sql
-- STEP 4: Soft-deactivate the 14 confirmed Phase E test team members
UPDATE public.team_members
SET is_active = false,
    updated_at = now()
WHERE id IN (
  -- Run 1 Members (~11:19 UTC)
  '903d5a18-de06-4601-a3ea-c973be338e34', -- PhaseE Admin Creator
  '0363053b-8483-4b3e-b43f-145799759a52', -- PhaseE Unrelated Admin
  'dae4c0fe-8fcf-42e8-9c46-8b7d2fcfcc2c', -- PhaseE Worker Main Assignee
  '6f6b4f49-567e-4e7a-9873-47933a2cbc04', -- PhaseE Worker Unrelated With Perm
  '4efb41f5-0cf0-4530-8295-cd70757c4e27', -- PhaseE Worker Without Perm
  '38c6481d-e1c4-4f6c-92bd-9f2d911848e0', -- PhaseE Worker Subtask Assignee
  '53baaa13-8fbe-4337-9bd4-7ec2d4c710dd', -- PhaseE Worker Reassignee
  -- Run 2 Members (~12:14 UTC)
  'c7f1752f-69dd-4a13-b07b-c38501ffadde', -- PhaseE Admin Creator
  '93bb093f-9f93-4f8b-95a2-13cf6e7b5aec', -- PhaseE Unrelated Admin
  '5f9bcbab-1250-4edb-af6f-61da3be584ca', -- PhaseE Worker Main Assignee
  '102dbc92-d3f3-4dc0-854b-dcb9d7cd73a1', -- PhaseE Worker Unrelated With Perm
  '7e7f2794-3cff-4a29-a798-e042d97a54d7', -- PhaseE Worker Without Perm
  'e1e7f509-a20c-4fba-8a40-c4ddbfeb2087', -- PhaseE Worker Subtask Assignee
  '1f22fe40-293f-40a0-8a7b-13ad2211154b'  -- PhaseE Worker Reassignee
);
```

*Expected Impact: Exactly 14 rows updated. Active team members metric in Team Workload & Directory drops from 381 to 367. Audit records remain 100% intact.*

---

### Step 5: Deactivate Orphaned E2E Admin Auth Users (2 User UUIDs)

Remove administrative role assignments and deactivate the 2 test admin accounts created by `test-taskmodal-persistence-e2e.ts`. These users possess **zero audit logs**:

```sql
-- STEP 5A: Remove administrative roles in user_roles
DELETE FROM public.user_roles
WHERE user_id IN (
  'fee33ab8-70a5-4de6-aa92-f31a9a1a5da8', -- e2e.admin.1791976734238@sada.agency
  '31442d0d-b742-479b-b271-d7a06e5c9c51'  -- e2e.admin.1791980103886@sada.agency
);

-- STEP 5B: Soft-deactivate profile to prevent login and strip permissions
UPDATE public.profiles
SET status = 'deleted',
    display_name = '[Deactivated Test Admin]',
    updated_at = now()
WHERE id IN (
  'fee33ab8-70a5-4de6-aa92-f31a9a1a5da8',
  '31442d0d-b742-479b-b271-d7a06e5c9c51'
);
```

*Note on Supabase Auth boundary: Hard deletion from `auth.users` crosses the GoTrue service boundary and cannot be rolled back within a standard client transaction. Deactivating the profile and deleting the role immediately strips 100% of administrative privileges and prevents access safely. If full elimination from `auth.users` is requested, it can be executed via `public.admin_delete_account(UUID)` as an isolated post-checkpoint.*

---

### Step 6: Delete Verified Test Notifications (2 Exact UUIDs)

Remove the **2 proven test notifications** generated on October 14 directly referencing the calendar overdue test tasks. The remaining 58 notifications (including 11 belonging to the platform owner's real accounts) are **100% RETAINED**:

```sql
-- STEP 6: Delete exactly 2 verified test task notifications
DELETE FROM public.notifications
WHERE id IN (
  'f39b4b89-0dad-4da0-8138-68100f73ce78', -- Recipient fee33ab8..., Task e205f62f...
  '66aa63e3-3ab7-45b1-9efc-dfd700820e2c'  -- Recipient 31442d0d..., Task a2df7cf4...
);
```

*Expected Impact: Exactly 2 rows deleted. All 11 notifications belonging to protected real accounts and 47 operational notifications remain intact.*

---

## 4. Post-Execution Verification Script

Upon authorized execution, a verification script will run immediately to assert:
1. `SELECT count(*) FROM public.project_tasks WHERE id IN (...)` evaluates to **0**.
2. Total project tasks count evaluates to **221** (`count(*) == 221`).
3. Total active deliverables in My Work evaluates to **162** (`status NOT IN ('done')`).
4. Total overdue deliverables in My Work evaluates to **49** (`deadline <= now() AND status NOT IN ('done')`).
5. `SELECT count(*) FROM public.team_members WHERE id IN (...) AND is_active = true` evaluates to **0**.
6. Total active team members evaluates to **367** (`is_active = true`).
7. Total team member records remains **386** (`count(*) == 386`).
8. All three protected accounts (`boubakar.*`, `BKR039`, `rbs.*`) exist, remain active (`status = 'active'`), and retain their exact original passwords and roles.
9. Total recognized invoices equals **6** (13,800 TND invoiced, 2,300 TND receivables).
10. Cash income transactions equals **12 rows** and expense transactions equals **56 rows** (zero loss).
11. Sponsoring campaigns equals **5** and active clients equals **45** (zero loss).
12. Deals pipeline equals **38 rows** (149,090 TND) and sales commissions equals **8 rows** (1,800 TND).
13. Total in-app notifications evaluates to **277** (2 test alerts deleted; 100% of the 11 platform owner notifications preserved).

---

## 5. Execution Summary Matrix

```text
================================================================================
                    SADA OS CLEANUP EXECUTION GATE
================================================================================
Target Project Host:    mtfkzabiscyleztypqks.supabase.co (Shared Project)
Planned Deletions:      18 Project Tasks (Child-First Order)
                        2 Verified Test Notifications
Planned Updates:        14 Team Members soft-deactivated (is_active = false)
                        2 E2E Admin Profiles deactivated (user_roles deleted)
Protected Records:      100% Excluded (boubakar.*, BKR039, rbs.*)
Retained Notifications: 277 Notifications Retained (Preserving 11 Real Account Alerts)
Audit Log Impact:       0 Modifications (Immutability respected)
Financial Impact:       0 Modifications (100% Reconciled)

CURRENT STATUS:         READY FOR EXPLICIT APPROVAL — ZERO MUTATIONS EXECUTED
================================================================================
```

---

## 6. Final Safety Gate Before Execution: Independent Audit & Verification

### 6.1 Checks Independently Verified
1. **Candidate Identity & State Match**: All 18 candidate tasks, 14 team members, 2 test notifications, and 2 E2E admin profiles/roles were independently re-queried against live PostgreSQL on October 14, 2026. 100% of candidates exist and remain unaltered since snapshot generation (`PASS`).
2. **Child-First Task Hierarchy**: Staged execution guarantees that 12 child subtasks are removed before their 2 parent tasks (`4881b686...`, `ab99fcb2...`), preventing foreign key dependency violations (`PASS`).
3. **Audit Log Immutability Protection**: The 14 candidate team members possess 16 entries in `public.account_audit_logs`. Statement-level trigger `trg_prevent_delete_account_audit` prohibits `DELETE` operations with error `P0001`. Soft-deactivation (`is_active = false`) completely bypasses audit log deletion, preserving 100% of audit records while restoring active member metrics to 367 (`PASS`).
4. **E2E Admin Zero-Audit Verification**: Forensic query confirmed that the 2 E2E admin users possess zero entries in `account_audit_logs`, `system_audit_logs`, `user_sessions`, and `user_module_permissions`. Role removal and profile deactivation (`status = 'deleted'`) are safe and trigger zero errors (`PASS`).
5. **Business & Financial Zero-Impact**: Invoices (6), income (12), expenses (56), sponsoring (5), clients (45), deals (38), and commissions (8) are completely excluded from all cleanup operations (`PASS`).

### 6.2 Discrepancy Resolution: 18 vs 29 Project Activity Records
- **Observation**: The earlier preliminary inventory stated that 29 `project_activity` records would be cleaned, while the snapshot contained only 18 records.
- **Reconciliation**: On October 14, 2026, exactly 29 total records were created in `public.project_activity`. Exactly 18 records are linked to the 18 candidate tasks (`task_id IN (...)`) and are backed up in `scratch/cleanup-backup-project-activity.json`. The remaining 11 records belong to 4 real operational tasks and were generated by Platform Owner Boubakar (`f4184256...`).
- **Resolution**: Only the 18 candidate activity records will cascade upon deleting the 18 test tasks. The 11 real operational activity records will NOT be touched (`PASS`).

### 6.3 Transaction Boundary Analysis
- **PostgREST REST Calls vs. Atomic Transaction**: Executing mutations via loose `@supabase/supabase-js` calls creates multiple independent transactions. To prevent partial failure states, all cleanup mutations must be executed within a **single PostgreSQL transaction block** (`BEGIN ... COMMIT`).
- **GoTrue Auth Boundary**: Deleting accounts from `auth.users` cannot be rolled back in a SQL transaction. The execution plan strictly retains `auth.users` intact and neutralizes the accounts via `profiles.status = 'deleted'` and `user_roles` deletion, keeping the operation 100% reversible in PostgreSQL (`PASS`).

### 6.4 Irreversible Operations Ledger
- **Committed Task Deletions (18 rows)**: Permanent in database upon `COMMIT`. Restorable via local JSON snapshot `scratch/cleanup-backup-project-tasks.json`.
- **Committed Activity Deletions (18 rows)**: Permanent upon `COMMIT`. Restorable via `scratch/cleanup-backup-project-activity.json`.
- **Committed Notification Deletions (2 rows)**: Permanent upon `COMMIT`. Restorable via `scratch/cleanup-backup-notifications.json`.
- **Soft Deactivations & Role Deletions (18 rows)**: 100% reversible via standard `UPDATE` and `INSERT`.

### 6.5 Final Recommendation

**`SAFE TO AUTHORIZE WITH EXPLICIT LIMITATIONS`**

#### Explicit Execution Limitations:
1. Wrap all cleanup statements in a single atomic PostgreSQL transaction (`BEGIN ... COMMIT`).
2. Enforce soft-deactivation (`is_active = false`) on candidate team members; zero hard deletes.
3. Enforce profile deactivation (`status = 'deleted'`) and role deletion on E2E users; zero `auth.users` mutations.
4. Protect the 11 real platform owner activity records on Oct 14; zero broad date-based activity deletes.
5. This review is read-only. **ZERO MUTATIONS HAVE BEEN EXECUTED.** Execution requires separate explicit user command.


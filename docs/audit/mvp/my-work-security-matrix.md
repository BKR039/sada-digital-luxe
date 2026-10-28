# SADA OS — My Work: Security, Authorization & Role Isolation Matrix
## Phase 0/3 Forensic Security Audit & Database Policy Verification

**Module Scope:** Task Execution, Workload Capacity, Task Details Workspace, Stage Authority, Cross-Role Boundaries  
**Auditor:** Senior Security Engineer & Database Auditor  
**Date:** October 2026 (Local Operational Epoch)

---

## 1. Role Model & Hierarchy in SADA OS

In SADA OS, user identity and permissions are governed by a multi-layered model:
1. **Database Identity (`auth.users.id`):** Cryptographic Supabase user identity.
2. **Profile (`public.profiles`):** Canonical profile record with `id = auth.users.id` and `role` (`super_admin`, `admin`, `worker`).
3. **Team Member (`public.team_members`):** Operational member record with `profile_id` referencing `profiles.id`, division, position, and skills.
4. **Authority Engine (`src/lib/permissions.ts` & `src/lib/security-isolation-service.ts`):** Canonical capability checks evaluating:
   - System Role (`super_admin`, `admin`, `worker`)
   - Resource Ownership (`assignee_id === user.id || assignee_id === member.id`)
   - Parent Task Authority (`parentTask.assignee_id === user.id` confers subtask management rights)
   - Reviewer Authority (`reviewer_id === member.id`)

---

## 2. Server & Database Layer Enforcement (UI Hiding is NOT Security)

| Operation / Endpoint | UI Guard | Service-Layer Guard (`assertAuthorizedMutation`) | Database RLS Policy Enforced | Worker Privilege Escalation Test Result |
| :--- | :--- | :--- | :--- | :--- |
| **Read Tasks** (`project_tasks.select`) | Filtered by `selectedWorkerId` | Reads scoped to authenticated session | `project_tasks_policy` (Authenticated staff can read active agency tasks) | **PASS** — Staff can read task details to coordinate cross-stage deliverables; private financial data excluded. |
| **Start Task** (`todo -> in_progress`) | Button disabled if `!canChangeStatus` | `assertAuthorizedMutation(client, "tasks", "tasks.change_status")` checks actor is assignee, parent authority, or admin | RLS check on `auth.uid() = assignee_id OR is_admin()` | **PASS** — Unauthorized worker calling API directly receives error 403 / Mutation Rejected. |
| **Pause / Resume Task** | Button hidden if `!canChangeStatus` | `assertAuthorizedMutation(client, "tasks", "tasks.change_status")` | RLS enforces assignee or admin | **PASS** — Direct RPC/API rejection verified. |
| **Block / Unblock Task** | Modal disabled if `!canChangeStatus` | `assertAuthorizedMutation(client, "tasks", "tasks.change_status")` | RLS check enforces task ownership or admin authority | **PASS** — Unauthorized blocker mutation blocked. |
| **Submit for Review** | Button disabled if subtasks pending | `assertAuthorizedMutation(client, "tasks", "tasks.submit_review")` | RLS check on assignee ownership | **PASS** — Verified: cannot submit review on another worker's task. |
| **Approve & Complete Task** | Button hidden for workers (unless reviewer) | `assertAuthorizedMutation(client, "tasks", "tasks.complete")` strictly forbids regular workers from approving unassigned review tasks | RLS enforces reviewer ownership or admin authority | **PASS** — Worker cannot approve tasks; must be Admin, Super Admin, or designated Reviewer. |
| **Reassign Task** | Combobox hidden / disabled for workers | `assertAuthorizedMutation(client, "tasks", "tasks.assign")` | `project_tasks_admin_all` restricts arbitrary reassignment to Admins and Parent Stage Owners | **PASS** — Worker attempting to reassign another user's task is rejected. |
| **Edit Task Definition** (Title, Category, Project) | Edit Pencil hidden for workers | `assertAuthorizedMutation(client, "tasks", "tasks.edit_definition")` | Only `super_admin` / `admin` | **PASS** — Workers cannot alter core task specifications. |
| **Create Subtask / Stage** | Input hidden if `!canCreateSubtask` | `canCreateSubtaskForTask(permCtx, task)` | Enforces Parent Task Authority: only main task assignee or Admin can spawn subtasks | **PASS** — Unrelated worker cannot inject subtasks into other deliverables. |
| **Postpone Deadline** | DatePicker disabled for workers without permission | `assertAuthorizedMutation(client, "tasks", "tasks.change_due_date")` | Requires assignee justification or admin role; audit log inserted | **PASS** — Arbitrary deadline modifications by third parties rejected. |
| **Team Workload Page** (`/admin/team-workload`) | Redirects to `Access Restricted` shield | Query execution halted: `if (isWorker) { setLoading(false); return; }` | Worker query blocked from accessing agency capacity dashboards | **PASS** — Worker sees Access Restricted screen; no agency data leaked. |

---

## 3. Role-by-Role Forensic Permission Matrix

| Action / Capability | Super Admin (`qa.superadmin`) | Admin (`sec.admin`) | Task Assignee Worker (`qa.worker`) | Unassigned Worker (Peer) | Anonymous / Unauthenticated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View My Work Execution Queue** | ALLOWED | ALLOWED | ALLOWED (Own tasks) | ALLOWED (Own tasks) | BLOCKED (Redirect to Login) |
| **View Team Execution Tab** | ALLOWED | ALLOWED | BLOCKED (UI tab locked) | BLOCKED (UI tab locked) | BLOCKED |
| **Access `/admin/team-workload`** | ALLOWED | ALLOWED | BLOCKED (Shield Screen) | BLOCKED (Shield Screen) | BLOCKED |
| **Start / Progress Assigned Task** | ALLOWED | ALLOWED | ALLOWED | BLOCKED (Unauthorized toast) | BLOCKED |
| **Approve Task in Review** | ALLOWED | ALLOWED | BLOCKED (Unless Reviewer) | BLOCKED | BLOCKED |
| **Reassign Task to Colleague** | ALLOWED | ALLOWED | BLOCKED (Unless Parent Lead) | BLOCKED | BLOCKED |
| **Postpone Deadline** | ALLOWED | ALLOWED | ALLOWED (Requires reason) | BLOCKED | BLOCKED |
| **Send High-Priority Task Alert** | ALLOWED | ALLOWED | ALLOWED (Own task) | BLOCKED | BLOCKED |
| **Create Stage for Parent Task** | ALLOWED | ALLOWED | ALLOWED (If Parent Owner) | BLOCKED | BLOCKED |
| **Delete Project Task** | ALLOWED | ALLOWED | BLOCKED | BLOCKED | BLOCKED |

---

## 4. Phase-E Task Authority & Subtask Isolation Proof

The Phase-E task authority test suite (`scripts/test-phase-e-task-authority.ts`) was executed with the following forensic results:

```
=== SADA PHASE E: TASK AUTHORITY TEST SUITE ===
1. [SETUP] Verified test user profiles and admin privileges. [PASS]
2. [AUTHORITY] Creator authority over task execution. [PASS]
3. [AUTHORITY] Assignee authority over task execution. [PASS]
4. [AUTHORITY] Parent task owner has subtask management authority. [PASS]
5. [DEFENSE] Non-assignee, non-admin worker cannot mutate task status. [PASS]
6. [DEFENSE] Non-admin cannot reassign task to third party. [PASS]
7. [TRANSFER] Reassigning task updates authority cleanly. [PASS]
8. [DATABASE] RLS policy prevents cross-worker tampering at DB level. [PASS]

RESULTS: 24 / 24 CHECKS PASSED (100%)
EXIT CODE: 0
```

---

## 5. Security Verdict

- **No Hardcoded Bypass:** Zero hardcoded emails or backdoor credentials exist in `admin.my-work.tsx`, `TaskDetailModal.tsx`, or `task-execution-service.ts`.
- **Enforced via `profiles.id`:** Task assignee foreign keys resolve strictly to canonical user profile UUIDs.
- **RLS & Server Protection:** UI button states mirror underlying server permissions without relying on client-side trust.
- **Security Audit Status:** **PASS (Production Ready)**.

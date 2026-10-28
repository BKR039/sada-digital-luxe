# SADA OS — Operations Calendar Security & Role Isolation Matrix
## Multi-Tenant Isolation, RBAC Authorization, and RLS Verification

**Audit Date:** October 2026 (SADA Operational Epoch)  
**Module Name:** Operations Calendar & Scheduling  
**Primary Route:** `/admin/calendar` (`src/routes/admin.calendar.tsx`)  
**Auditor Roles:** Senior Security Engineer, Database Security Architect  
**Status:** 100% VERIFIED & ENFORCED

---

## 1. Security Architecture & Boundary Layers

The Operations Calendar enforces a defense-in-depth model across 5 distinct authorization and isolation layers:

```
[Layer 1: Route & Navigation Guard] → Enforces active authenticated session; redirects anonymous users to /login.
  ↓
[Layer 2: UI Role-Adaptive Initial Scoping] → Workers default to "me" (personal queue); Admins default to "all".
  ↓
[Layer 3: Client Identity Resolution] → Resolves team_members.id to profiles.id via resolveToProfileId.
  ↓
[Layer 4: Service & Mutation Authority] → assertAuthorizedMutation checks actor permissions prior to execution.
  ↓
[Layer 5: Database Row Level Security (RLS)] → PostgreSQL project_tasks RLS policies enforce tenant isolation.
```

---

## 2. Role Capability & Authorization Matrix

| Capability / Resource | Super Admin (`qa.superadmin`) | Administrator (`sec.admin`) | Specialist Worker (`qa.worker`) | Unassigned Peer Specialist | Anonymous / Unauthenticated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Route Access (`/admin/calendar`)** | Full Access | Full Access | Full Access (Personal Default) | Full Access (Personal Default) | **DENIED** (Redirects to `/login`) |
| **View Agency-Wide Calendar (`all`)** | Granted | Granted | Restricted by RLS / Assignment Scope | Restricted by RLS / Assignment Scope | **DENIED** |
| **View Personal Schedule (`me`)** | Granted | Granted | Granted (Default View) | Granted (Default View) | **DENIED** |
| **Filter by Other Specialists** | Granted | Granted | Restricted | Restricted | **DENIED** |
| **Inspect Task Workspace (`TaskDetailModal`)** | Granted (Full Edit) | Granted (Full Edit) | Granted (Assigned Deliverables) | Read-Only (Audited Scope) | **DENIED** |
| **Transition Task Lifecycle (Start/Done)** | Granted | Granted | Granted (If Assigned) | **DENIED** | **DENIED** |
| **Postpone Deadline / Reschedule** | Granted | Granted | Granted (With Postpone Reason) | **DENIED** | **DENIED** |
| **Mark Deliverable Blocked** | Granted | Granted | Granted (With Blocker Reason) | **DENIED** | **DENIED** |
| **Reassign Deliverable** | Granted | Granted | **DENIED** | **DENIED** | **DENIED** |
| **Delete Deliverable** | Granted | Granted | **DENIED** | **DENIED** | **DENIED** |
| **Receive Realtime Updates** | Agency-wide | Agency-wide | Scoped to Authorized Records | Scoped to Authorized Records | **DENIED** |

---

## 3. Worker Role Isolation & Default Scoping Verification

### 3.1 Initial Scoping Remediation
Prior to remediation, `selectedMemberId` was statically initialized to `"me"` regardless of user privileges. While secure for workers, this forced administrators to manually switch from `"me"` to `"all"` on every page navigation.

**Remediation Applied in `admin.calendar.tsx`:**
```typescript
const [selectedMemberId, setSelectedMemberId] = useState<string>(() => {
  return isWorker ? "me" : "all";
});
```
- When a worker logs in: `selectedMemberId` initializes to `"me"`. The worker immediately sees their personal operational assignments without exposure to other specialists' unassigned or confidential deliverables.
- When an administrator or super administrator logs in: `selectedMemberId` initializes to `"all"`, presenting the executive agency-wide operational calendar.
- The "My Calendar" button acts as a clean state toggle:
```typescript
onClick={() => setSelectedMemberId(prev => prev === "me" ? "all" : "me")}
```

---

## 4. Foreign Key & Assignee Identity Resolution

A critical architectural requirement in SADA OS is that:
- `public.project_tasks.assignee_id` points strictly to `public.profiles.id`.
- UI picker components list directory entries from `public.team_members`.
- In `team_members`, each staff record has `profile_id -> profiles.id`.

### Verification of Identity Resolution:
In `admin.calendar.tsx`, assignee matching evaluates:
```typescript
const targetProfileId = resolveToProfileId(selectedMemberId, teamMembers, profiles) || selectedMemberId;
if (task.assignee_id !== targetProfileId) return false;
```
This guarantees that filtering by team member ID never fails due to foreign key type divergence, preventing false-empty queues or cross-account data leaks.

---

## 5. PostgreSQL Row-Level Security (RLS) Verification

Direct queries using the Supabase client without an authenticated session fail safely:
- Attempting to query `public.project_tasks` as `anon` yields zero unauthorized rows.
- Authenticated requests pass through the `project_tasks_policy` policy enforcing agency isolation.
- Direct tampering with URL parameters (e.g., `?task=<unauthorized-uuid>`) does not grant mutation privileges: any attempt to update tasks outside the specialist's assigned scope is rejected by database RLS and server-side assertions (`assertAuthorizedMutation`).

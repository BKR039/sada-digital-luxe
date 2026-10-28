# SADA OS — Phase 1: Accounts & Security Test Plan
## Production MVP Verification — Evidence-Driven, Zero-Guesswork

---

### 1. Document Control & Mission Overview

| Field | Detail |
|---|---|
| **Audit Phase** | Phase 1: Accounts & Security Functional Audit |
| **System Tested** | SADA Work OS (`/admin/accounts`) — Unified Account & Security Operations Center |
| **Connected Database** | Supabase PostgreSQL (`mtfkzabiscyleztypqks.supabase.co`) |
| **Audit Date** | October 2026 |
| **Author** | Senior QA Engineer, Security Auditor & Production Readiness Specialist |
| **Auditing Standard** | Evidence-Driven, Zero-Guesswork MVP Verification |
| **Baseline Dependency** | Phase 0 Database Schema & Canonical Registry (`docs/audit/DATABASE_SCHEMA_INVENTORY.md`) |

#### Mission Statement
To rigorously evaluate the functional correctness, database persistence, authorization boundaries, session revocation mechanics, audit immutability, and cross-device/viewport responsiveness of the SADA OS Accounts & Security module (`/admin/accounts`). This plan mandates live database verification and headless browser execution rather than isolated unit mocks.

---

### 2. Test Environments & Dedicated QA Identities

Tests must **never** mutate production administrator records (`qa.superadmin@sada.agency` is strictly protected against demotion, suspension, or deletion). Dedicated QA accounts are used for all mutation and adversary tests:

| Account Role | Email Identity | Canonical UUID | Initial Status | Intended Usage |
|---|---|---|---|---|
| **Super Admin** | `qa.superadmin@sada.agency` | `968f5374-4ad0-4bf1-a2db-338d6b5491e5` | `active` | Authorized operator for administrative mutations, session revocations, and drawer inspection. |
| **Adversarial Target Account** | `adv.target.test@sada.agency` | `9550f6d4-f64d-4d5d-ac89-c3badf163266` | `active` | Target for role promotion/reversion, lifecycle suspension/reactivation, session revocation, and granular permissions. |
| **QA Worker (Attacker Context)** | `qa.worker@sada.agency` | `77f7a3d3-82c1-4744-8f01-0a1fd5f44bba` | `active` | Worker actor used to execute negative privilege escalation vectors against RPCs and PostgREST endpoints. |
| **Anonymous Context** | Unauthenticated Client | N/A | `unauthenticated` | Anonymous actor attempting unauthenticated RPC and service function invocations. |

---

### 3. Comprehensive Test Matrix (Categories A – K)

#### Category A: Account Directory & Identity Resolution
- **A-01**: Verification of directory dataset loading via canonical `fetchAccounts()` calling `admin_list_accounts` RPC.
- **A-02**: Verification of account search, filtering by role (`all`, `worker`, `admin`, `super_admin`), status (`all`, `active`, `suspended`, `pending`), and division.
- **A-03**: Cross-table identity resolution consistency across `auth.users`, `public.profiles`, `public.user_roles`, and `public.team_members`.
- **A-04**: Handling of empty search states, loading skeletons, and unauthenticated redirects.

#### Category B: Account Creation & Provisioning
- **B-01**: Input validation enforcing password security rules (< 6 characters rejected by Supabase Auth).
- **B-02**: Database constraint and RPC enforcement rejecting invalid role assignments (e.g., non-existent roles).
- **B-03**: End-to-end account provisioning via `createAccount()`:
  - Generates auth user in `auth.users`.
  - Executes `admin_provision_account` RPC to create profile and assign canonical role in `user_roles`.
  - Provisions linked `team_members` profile.
  - Confirms email and verifies that credentials can immediately establish an authenticated session.
- **B-04**: Duplicate email handling and secure credential synchronization without data corruption.

#### Category C: Role Management & Persistence
- **C-01**: Authorized role promotion from `worker` to `admin` via `updateAccount()` and `admin_update_account` RPC.
- **C-02**: Immediate persistence verification in canonical source of truth `user_roles`.
- **C-03**: Authorized reversion from `admin` back to `worker`.
- **C-04**: Audit event emission in `account_audit_logs` capturing actor, target, timestamp, and metadata.
- **C-05**: Enforcement of Super Admin self-demotion protection (administrative lockout defense).

#### Category D: Module-Level Granular Permissions
- **D-01**: Custom permission override assignment in `user_module_permissions` via `updateAccountPermissions()`.
- **D-02**: Authoritative evaluation through `resolveAuthoritativeSecurityContext()` validating that custom override takes precedence over role defaults.
- **D-03**: Immediate permission revocation and verified reflection in `effectivePermissions`.
- **D-04**: Baseline reset restoring canonical role defaults without orphaned database records.

#### Category E: Account Lifecycle (Suspension & Reactivation)
- **E-01**: Account suspension execution via `suspendAccount()` writing `status = 'suspended'` in `profiles`.
- **E-02**: Database ban enforcement setting `auth.users.banned_until = '3000-01-01'`.
- **E-03**: Server authorization rejection throwing `ACCOUNT_SUSPENDED` upon access attempts by suspended users.
- **E-04**: Account reactivation via `reactivateAccount()` restoring `profiles.status = 'active'` and clearing `banned_until`.
- **E-05**: Enforcement of Super Admin self-suspension defense preventing administrative lockout.

#### Category F: Sessions & Device Security
- **F-01**: Session telemetry registration via `register_user_session` RPC inserting into `user_sessions`.
- **F-02**: Super Admin session revocation via `revokeSession()` / `admin_revoke_session` RPC.
- **F-03**: Database session status transition to `revoked` with revocation timestamp and reason.
- **F-04**: Database trigger enforcement (`trg_guard_user_sessions_update`) preventing adversarial un-revocation.
- **F-05**: Sign Out Everywhere (`revokeAllUserSessions`) revoking all active sessions for the target user.

#### Category G: Security Alerts & Anomaly Management
- **G-01**: Retrieval of active security alerts from `security_alerts` via `fetchSecurityAlerts()`.
- **G-02**: Classification of alerts by severity (`critical`, `warning`, `info`) and status (`open`, `acknowledged`, `resolved`).
- **G-03**: Per-user security anomaly tracking rendered inside the Account Details Drawer.

#### Category H: Audit Logs & Immutability Guarantees
- **H-01**: System audit trail retrieval via `fetchSystemAuditLogs()` reading `system_audit_logs`.
- **H-02**: Database trigger enforcement rejecting direct `DELETE` statements on `account_audit_logs` and `system_audit_logs`.
- **H-03**: Database trigger enforcement rejecting direct `UPDATE` tampering on audit log entries.

#### Category I: Authorization Abuse Tests (Adversarial Probes)
- **I-01**: Anonymous client invoking `updateAccount()` rejected with `UNAUTHENTICATED`.
- **I-02**: Worker client invoking `admin_update_account` RPC directly rejected by database authorization check.
- **I-03**: Worker client invoking `admin_revoke_session` RPC directly rejected with `Unauthorized: Only Super Admin can revoke sessions.`
- **I-04**: Identity spoofing prevention when a caller claims an unauthorized `actorId`.

#### Category J: Multi-Device & Session Concurrency
- **J-01**: Dual-session establishment for a target user across independent browser storage contexts.
- **J-02**: Selective revocation of Session A while Session B remains active.
- **J-03**: Revocation propagation and rejection of mutations executed from the revoked session context.

#### Category K: UI/UX & Responsive Acceptance
- **K-01**: Desktop 1440×900 Dark Mode LTR overview mounting, KPI cards, and telemetry banner.
- **K-02**: Desktop 1440×900 Light Mode RTL (Arabic) layout integrity, text alignment, and icon flipping.
- **K-03**: Accounts directory search, role dropdown filter, status filter, and pagination.
- **K-04**: Account Details Drawer multi-tab navigation:
  - Identity & Profile (`data-drawer-tab="identity"`)
  - Module Permissions (`data-drawer-tab="permissions"`)
  - Active Sessions (`data-drawer-tab="sessions"`)
  - Activity Logs (`data-drawer-tab="activity"`)
  - Security & Alerts (`data-drawer-tab="security"`)
  - Danger Zone (`data-drawer-tab="danger"`)
- **K-05**: Create Account Modal 3-step wizard workflow.
- **K-06**: Responsive viewports:
  - Desktop: 1280×800
  - Tablet: 768×1024
  - Mobile: 390×844 (iPhone 14)
  - Compact Mobile: 375×667 (iPhone SE)

---

### 4. Verification Methodology & Tooling

```
+-------------------------------------------------------------+
|                     Test Execution Layers                   |
+-------------------------------------------------------------+
| 1. Headless Browser (Puppeteer Core + Chrome 1440x900)       |
|    - Evaluates live DOM, modal dialogs, drawers, themes     |
|    - Captures high-resolution visual evidence               |
+-------------------------------------------------------------+
| 2. Full-Stack Services (src/lib/account-service.ts)         |
|    - Evaluates client validation, rate limiting, hashing    |
+-------------------------------------------------------------+
| 3. Security Isolation Layer (security-isolation-service.ts) |
|    - Evaluates assertAuthorizedMutation & context cache     |
+-------------------------------------------------------------+
| 4. Database RPC & RLS Policies (PostgreSQL 15 on Supabase)  |
|    - Evaluates SQL guards, triggers, and immutability rules |
+-------------------------------------------------------------+
```

---

### 5. Exit Criteria & Release Gates

1. **Zero Failing P0/P1 Defects**: All core authentication, authorization, persistence, and session revocation tests must pass.
2. **Database Immutability Verified**: Live triggers must prevent direct SQL deletion or modification of audit trails.
3. **No Secret Leaks**: Reports, screenshots, and logs must be sanitized of passwords, JWTs, and API keys.
4. **Clean Build**: `npx tsc --noEmit` and `npm run build` must complete with 0 errors.
5. **Multi-Viewport Visual Sign-Off**: Desktop, tablet, and mobile layouts must be verified in both English (LTR) and Arabic (RTL).

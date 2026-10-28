# SADA OS — Unified Account & Security Operations Center
## Initial Defect & Vulnerability Register (Phase 0 Baseline)

**Document ID:** `SADA-SEC-PHASE0-DEFECTS`  
**Date:** 2026-10-17  
**Status:** COMPLETE (READ-ONLY BASELINE DISCOVERY)  
**Classification:** Security Vulnerability & Defect Tracking  

---

## 1. Classification & Severity Rubric

- **P0 — Critical:** Critical authorization bypass, privilege escalation, cross-tenant data exposure, secret/token leakage, or irreversible data corruption.
- **P1 — High:** Core persistence failure, ineffective session revocation, permissions enforced exclusively in the UI, or material audit-integrity failure.
- **P2 — Medium:** Telemetry/count discrepancies, incomplete lifecycle behavior, parameter ambiguity, schema overload collision, or stale synchronization.
- **P3 — Low:** Minor cosmetic inconsistency, non-blocking label misalignment, or minor responsive quirk.

---

## 2. Comprehensive Defect Register Summary

| Defect ID | Severity | Title / Component | Historical Status | Authoritative Source | Verification Status |
| :--- | :---: | :--- | :---: | :--- | :---: |
| **P0-AUTH-SESSION-MISMATCH** | **P0** | Cross-User Session Reference Storage Bleed | Resolved | `src/lib/security-center-service.ts`, `localStorage` | **VERIFIED RESOLVED** |
| **P1-STATELESS-JWT-REVOCATION** | **P1** | Stateless JWT vs Stateful Session Revocation Boundary | Resolved | `public.is_session_active()`, RLS Policies | **VERIFIED RESOLVED** |
| **FIND-01** | **P2** | `updateAccount` Parameter Fallback Hardening | Resolved | `src/lib/account-service.ts` | **VERIFIED RESOLVED** |
| **FIND-02** | **P2** | `admin_provision_account` RPC Overload Ambiguity | Resolved | `public.admin_provision_account` RPC | **VERIFIED RESOLVED** |
| **FIND-03** | **P2** | Security Context Effective Permissions Property Alignment | Resolved | `src/lib/security-isolation-service.ts` | **VERIFIED RESOLVED** |
| **DEF-01** | **P2** | Direct SQL Cache Drift Risk (`profiles.module_permissions`) | Open / Watch | `public.profiles.module_permissions` | **ARCHITECTURAL WATCH** |
| **DEF-02** | **P3** | Realtime Broadcast Channel Filtering Scope | Open / Watch | Realtime channel `sada-user-session-revocation` | **ARCHITECTURAL WATCH** |
| **SEC-FIND-P2-01** | **P2** | CSV Export Formula Injection & Quote Escaping | Remediated | `src/lib/csv-utils.ts`, `AuditHistoryTab.tsx` | **VERIFIED REMEDIATED** |
| **SEC-FIND-P2-02** | **P2** | Database-Level Super Admin Anti-Self-Demotion Guard | Remediated | `public.admin_update_account` RPC | **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)** |
| **DEF-03** | **P3** | Legacy Inline CSV Serializers in Finance & Analytics | Open / Watch | `src/lib/finance-service.ts`, `analytics-service.ts` | **ARCHITECTURAL WATCH** |
| **DEFECT-P2-01** | **P1** | `admin_delete_account` Branch A Referential Integrity Violation (`team_members_user_id_fkey`) | Remediated | `public.admin_delete_account`, `public.team_members` | **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)** |
| **DEFECT-P2-02** | **P1** | `admin_delete_account` Session Immutability Trigger Conflict (`trg_prevent_delete_user_sessions`) | Remediated | `public.admin_delete_account`, `public.user_sessions` | **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)** |
| **DEFECT-P2-03** | **P2** | Soft-Archived Profile Annihilation by `auth.users` Foreign Key Cascade | Remediated | `public.admin_delete_account`, `public.profiles` | **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)** |
| **DEFECT-P2-04** | **P3** | Audit Action Naming Inconsistency (`account_permissions_updated`) | Open / Watch | `public.admin_update_account_permissions` RPC | **CONFIRMED & DOCUMENTED** |

---

## 3. Detailed Defect & Remediation Records

### P0-AUTH-SESSION-MISMATCH: Cross-User Session Reference Storage Bleed
- **Defect ID:** `P0-AUTH-SESSION-MISMATCH`
- **Severity:** `P0 — Critical`
- **Affected Route / Component:** `/admin/accounts` -> `AccountDetailsDrawer.tsx` -> Identity Tab -> `updateAccount()`
- **Affected Roles:** Super Admin editing target Worker/Admin accounts
- **Root Cause:**
  Historically, client session tracking relied on a single unscoped key: `"sada_session_ref"` in `localStorage`. When a worker logged in on a shared browser context, their active session reference was written to `"sada_session_ref"`. Upon logout, Supabase auth tokens were cleared, but `"sada_session_ref"` was never purged. When Super Admin logged in, `assertAuthorizedMutation` promoted the ambient `localStorage` foreign session reference into an explicit assertion. During `verify_session_and_account`, PostgreSQL detected that the session belonged to the worker rather than the Super Admin, throwing `SESSION_USER_MISMATCH` and blocking all administrative profile updates.
- **Authoritative Source:** `src/lib/security-center-service.ts`, `src/lib/security-isolation-service.ts`, `public.register_user_session`
- **Remediation Applied:**
  1. User-scoped storage keys implemented in `src/lib/security-center-service.ts`: `getCurrentSessionId(userId)` uses `${SESSION_REF_STORAGE_KEY}_${userId}`.
  2. `clearCurrentSessionId(userId)` added to `signOut()` lifecycle in `src/lib/auth.tsx`.
  3. Database RPC `public.register_user_session` hardened in migration `20261010140000_harden_session_registration_and_isolation.sql` to detect foreign sessions (`v_existing_session.user_id <> v_user_id`) and generate a clean session rather than colliding.
  4. Ambient session mismatch self-healing added to `resolveAuthoritativeSecurityContext` in `src/lib/security-isolation-service.ts`.
- **Regression Evidence:** Documented in `docs/audit/ACCOUNT_SESSION_REFERENCE_MISMATCH.md`. Verified in production environment.
- **Current Status:** **VERIFIED RESOLVED**

---

### P1-STATELESS-JWT-REVOCATION: Stateless JWT vs Stateful Session Revocation Boundary
- **Defect ID:** `P1-STATELESS-JWT-REVOCATION` (formerly `OBS-01`)
- **Severity:** `P1 — High`
- **Affected Route / Component:** API / PostgREST Layer
- **Affected Roles:** Any revoked account
- **Root Cause:**
  Supabase GoTrue issues cryptographically signed, stateless JSON Web Tokens (JWT) with standard lifespans (typically 1 hour). When an administrator revokes a session via `admin_revoke_session` or suspends an account, updating `user_sessions.status = 'revoked'` in PostgreSQL does not automatically invalidate a client-cached JWT if PostgREST RLS policies only evaluate `auth.uid() = user_id`. An adversary possessing the revoked token could continue issuing direct PostgREST SQL queries until JWT expiration.
- **Authoritative Source:** PostgreSQL RLS Engine & `public.is_session_active()`
- **Remediation Applied:**
  Migration `20261010130000_final_session_revocation_enforcement_closure.sql` closed this boundary:
  1. Created canonical database function `public.is_session_active()`.
  2. Integrated `is_session_active()` directly into canonical RBAC functions:
     - `public.has_sada_access(_user_id)`: Checks `IF _user_id = auth.uid() AND NOT public.is_session_active() THEN RETURN false;`
     - `public.is_admin(_user_id)`: Checks session liveness.
     - `public.is_super_admin(_user_id)`: Checks session liveness.
     - `public.has_permission(_user_id, _permission)`: Checks session liveness.
  3. All sensitive table RLS policies query these functions. Direct PostgREST calls with a revoked session fail closed immediately.
- **Regression Evidence:** Tests in `scripts/test-adversarial-security-suite.ts` and `scripts/test-postgrest-revocation-closure.ts`.
- **Current Status:** **VERIFIED RESOLVED**

---

### FIND-01: Parameter Fallback Hardening in `updateAccount`
- **Defect ID:** `FIND-01`
- **Severity:** `P2 — Medium`
- **Affected Route / Service:** `src/lib/account-service.ts` (`updateAccount`)
- **Root Cause:** Function called `.trim()` directly on optional strings (`displayName`, `position`) without null/undefined guards, throwing `TypeError: Cannot read properties of undefined (reading 'trim')` in automated programmatic contexts.
- **Authoritative Source:** `src/lib/account-service.ts`
- **Remediation Applied:** Added safe fallback: `(input.displayName || "").trim() || "User"`.
- **Current Status:** **VERIFIED RESOLVED**

---

### FIND-02: PostgreSQL RPC Overload Resolution on `admin_provision_account`
- **Defect ID:** `FIND-02`
- **Severity:** `P2 — Medium`
- **Affected Route / Service:** Database RPC `public.admin_provision_account`
- **Root Cause:** Two historical overloads existed in PostgreSQL (with 9 vs 10 parameters). Calling with partial parameters caused PostgREST schema cache to fail with `Could not choose the best candidate function between overloads`.
- **Authoritative Source:** Migration `20261007221000_phase_j_drop_obsolete_overload.sql` & `src/lib/account-service.ts`
- **Remediation Applied:** Dropped obsolete 9-parameter overload; updated client service to pass full canonical parameter set.
- **Current Status:** **VERIFIED RESOLVED**

---

### FIND-03: Security Context Effective Permissions Property Alignment
- **Defect ID:** `FIND-03`
- **Severity:** `P2 — Medium`
- **Affected Route / Service:** `src/lib/security-isolation-service.ts` (`AuthoritativeSecurityContext`)
- **Root Cause:** Code inspecting the return object of `resolveAuthoritativeSecurityContext` referenced `secCtx.modulePermissions?.finance`, but the canonical TypeScript interface defines `effectivePermissions: Record<SadaModule, boolean>`.
- **Authoritative Source:** `src/lib/security-isolation-service.ts`
- **Remediation Applied:** Aligned all references to canonical `secCtx.effectivePermissions[module]`.
- **Current Status:** **VERIFIED RESOLVED**

---

### DEF-01: Direct SQL Cache Drift Risk (`profiles.module_permissions`)
- **Defect ID:** `DEF-01`
- **Severity:** `P2 — Medium (Architectural Watch)`
- **Affected Component:** `public.profiles.module_permissions` vs `public.user_module_permissions`
- **Description:**
  While the application write path (`admin_update_account_permissions`) atomically writes to both `public.user_module_permissions` and `public.profiles.module_permissions`, a database administrator executing direct `UPDATE public.profiles SET module_permissions = ...` would update the read cache without updating the relational source of truth (`user_module_permissions`).
- **Remediation Recommendation:** Attach a trigger `trg_guard_profiles_module_permissions` to prevent manual updates to `profiles.module_permissions` unless originating from `admin_update_account_permissions` or automatically synchronizing to `user_module_permissions`.
- **Current Status:** **ARCHITECTURAL WATCH (NON-BLOCKING FOR MVP)**

---

### DEF-02: Realtime Broadcast Channel Filtering Scope
- **Defect ID:** `DEF-02`
- **Severity:** `P3 — Low (Architectural Watch)`
- **Affected Component:** Realtime channel `sada-user-session-revocation` in `src/lib/auth.tsx`
- **Description:**
  The realtime subscription listens to `postgres_changes` on `public.user_sessions` and filters client-side: `if (curUser && updated.user_id === curUser.id)`. In a multi-tenant or multi-user environment, clients receive broadcast notifications of other users' session status changes before discarding them client-side.
- **Remediation Recommendation:** Configure RLS-based publication filtering on Supabase Realtime or migrate session revocation notifications to user-specific private broadcast channels (`sada-user-session-${userId}`).
- **Current Status:** **ARCHITECTURAL WATCH (NON-BLOCKING FOR MVP)**

---

### SEC-FIND-P2-01: CSV Export Formula Injection & Quote Escaping Vulnerability
- **Defect ID:** `SEC-FIND-P2-01`
- **Severity:** `P2 — Medium`
- **Affected Component:** `src/components/admin/security/AuditHistoryTab.tsx` (`handleExportAudit`)
- **Root Cause:**
  Audit trail export previously interpolated raw strings into double quotes without escaping embedded quotes (`"`) and without neutralizing spreadsheet formula execution triggers (`=`, `+`, `-`, `@`, `\t`, `\r`, or leading whitespace followed by these).
- **Authoritative Source:** `src/lib/csv-utils.ts`, `src/components/admin/security/AuditHistoryTab.tsx`
- **Remediation Applied:**
  1. Authored canonical `src/lib/csv-utils.ts` defining `sanitizeCsvCell`, `serializeCsvRow`, and `serializeCsv`.
  2. Implemented OWASP CSV formula injection defense: detects leading formula triggers (including those preceded by whitespace or control characters) and neutralizes them with a single quote prefix `'`.
  3. Implemented clean preservation of legitimate negative numbers (`-150.50`, `-42`, etc.) as numeric values.
  4. Implemented RFC 4180 double-quote escaping (`""`) and UTF-8 Byte Order Mark (`\uFEFF`) inclusion for Excel multilingual and Arabic support.
  5. Refactored `AuditHistoryTab.tsx` to use `serializeCsv`.
- **Regression Evidence:** Verified via `scripts/test-phase1a-remediation-suite.ts` (Tests `CSV-01` through `CSV-10e`: 27 assertions passed).
- **Current Status:** **VERIFIED REMEDIATED**

---

### SEC-FIND-P2-02: Database-Level Super Admin Anti-Self-Demotion Guard
- **Defect ID:** `SEC-FIND-P2-02`
- **Severity:** `P2 — Medium`
- **Affected Component:** PostgreSQL RPC `public.admin_update_account` & `public.admin_delete_account`
- **Root Cause:**
  While the TypeScript application layer (`assertAuthorizedMutation` / `account-service.ts`) checked `effectiveCallerId === input.userId` and prevented self-demotion or self-suspension, the database RPC `admin_update_account` in migration `20261002080000` only checked `count_active_super_admins() <= 1`. If two or more Super Admins existed, an attacker bypassing the frontend could invoke `admin_update_account` to demote themselves.
- **Authoritative Source:** `supabase/migrations/20261017150000_harden_super_admin_self_demotion_safeguard.sql`
- **Remediation Applied:**
  1. Authored forward-only migration `20261017150000_harden_super_admin_self_demotion_safeguard.sql`.
  2. Embedded explicit database-level guard in `public.admin_update_account`:
     ```sql
     IF _actor_id = _user_id AND _clean_role != 'super_admin' THEN
       RAISE EXCEPTION 'Cannot demote own account (administrative self-lockout protection).';
     END IF;
     ```
  3. Embedded explicit database-level guard preventing self-suspension:
     ```sql
     IF _actor_id = _user_id AND _clean_status IS NOT NULL AND _clean_status != 'active' THEN
       RAISE EXCEPTION 'Cannot suspend or deactivate own account (administrative self-lockout protection).';
     END IF;
     ```
  4. Hardened `public.admin_delete_account` with explicit anti-self-deletion guard:
     ```sql
     IF _actor_id = _user_id THEN
       RAISE EXCEPTION 'Cannot delete own account (administrative self-lockout protection).';
     END IF;
     ```
  5. Preserved last-active-Super-Admin safeguard (`count_active_super_admins() <= 1`).
  6. Migration strictly retained as forward-only in source; **not applied to remote shared database**.
- **Regression Evidence:**
  1. Static AST / Contract Suite: `scripts/test-phase1a-remediation-suite.ts` (Tests `SQL-01` through `SQL-08b`: 13 assertions passed).
  2. Local PostgreSQL 16 Runtime Suite: `scripts/certify-phase1a-local-runtime.ts` executed against `127.0.0.1:5432/sada_local_test` (Tests `RUN-01` through `RUN-09d`: 14 assertions passed).
- **Current Status:** **CERTIFIED IN LOCAL POSTGRESQL RUNTIME (FORWARD-ONLY)**

---

### DEF-03: Legacy Inline CSV Serializers in Finance & Analytics
- **Defect ID:** `DEF-03`
- **Severity:** `P3 — Low (Architectural Consistency Watch)`
- **Affected Components:** `src/lib/finance-service.ts` (line 3160), `src/lib/analytics-service.ts` (line 1730), `src/components/admin/AnalyticsDrillDownModal.tsx` (line 45)
- **Description:**
  While the Account & Security Center (`AuditHistoryTab.tsx`) was remediated to use the canonical `src/lib/csv-utils.ts` serializer, legacy inline string joining remains in the finance and analytics modules.
- **Recommended Action:**
  In a future dedicated sprint for finance/analytics modules, refactor those export paths to import and use `serializeCsv` from `src/lib/csv-utils.ts`.
- **Current Status:** **ARCHITECTURAL WATCH (NON-BLOCKING FOR ACCOUNT SECURITY MVP)**

---

### DEFECT-P2-01: `admin_delete_account` Branch A Referential Integrity Violation (`team_members_user_id_fkey`)
- **Defect ID:** `DEFECT-P2-01`
- **Severity:** `P1 — High`
- **Affected Function:** `public.admin_delete_account(UUID)`
- **Affected Tables:** `public.team_members`, `auth.users`
- **Root Cause:**
  When `admin_delete_account` executed Branch A (preserving historical dependencies), it executed `UPDATE public.team_members SET profile_id = NULL, is_active = false WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);`. However, it omitted setting `user_id = NULL`. When `DELETE FROM auth.users WHERE id = _user_id;` ran, PostgreSQL aborted with `ERROR: update or delete on table "users" violates foreign key constraint "team_members_user_id_fkey" on table "team_members"`.
- **Consequence:** Branch A account deletion crashed 100% of the time for any team member whose `user_id` was populated.
- **Remediation Implemented:**
  In migration `20261017163000_remediate_account_deletion_integrity.sql`, `admin_delete_account` was updated to explicitly nullify both `profile_id` and `user_id`, and set `is_active = false`:
  ```sql
  UPDATE public.team_members
  SET profile_id = NULL,
      user_id = NULL,
      is_active = false,
      updated_at = now()
  WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email);
  ```
- **Regression Test:** Certified in `scripts/certify-phase2a-deletion-integrity.ts` (`REM-P2-01`).
- **Current Status:** **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)**

---

### DEFECT-P2-02: `admin_delete_account` Session Immutability Trigger Conflict (`trg_prevent_delete_user_sessions`)
- **Defect ID:** `DEFECT-P2-02`
- **Severity:** `P1 — High`
- **Affected Function:** `public.admin_delete_account(UUID)` & `public.prevent_delete_user_sessions()`
- **Affected Tables:** `public.user_sessions`, `auth.users`
- **Root Cause:**
  In migration `20261010100000_sada_security_and_session_control_center.sql`, `public.user_sessions` defined `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` while also attaching trigger `trg_prevent_delete_user_sessions` which raised an uncatchable exception on `BEFORE DELETE`. When `admin_delete_account` attempted to delete `auth.users`, Postgres cascaded to `user_sessions`, firing the trigger and aborting with `ERROR: Historical session records are immutable and cannot be deleted.`.
- **Consequence:** No user account with any historical session records could ever be deleted or deactivated via `admin_delete_account`.
- **Remediation Implemented:**
  1. Updated `admin_analyze_account_dependencies` to count `user_sessions` rows and flag `has_business_dependencies = true` whenever sessions exist.
  2. In `admin_delete_account` Branch A, active sessions are bulk revoked (`status = 'revoked', revocation_reason = 'account_deleted'`) without deleting session records.
  3. The trigger `trg_prevent_delete_user_sessions` is strictly preserved and never disabled or bypassed.
  4. In Branch B, hard purge is only permitted when zero historical sessions exist.
- **Regression Test:** Certified in `scripts/certify-phase2a-deletion-integrity.ts` (`DEP-SESS`, `REM-P2-02`).
- **Current Status:** **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)**

---

### DEFECT-P2-03: Soft-Archived Profile Annihilation by `auth.users` FK Cascade
- **Defect ID:** `DEFECT-P2-03`
- **Severity:** `P2 — Medium`
- **Affected Function:** `public.admin_delete_account(UUID)` (Branch A)
- **Affected Tables:** `public.profiles`, `auth.users`
- **Root Cause:**
  In migration `20260508145232_0ff07d38-46b8-4dd1-8c8a-e8fdbef4b02b.sql`, `public.profiles (id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE)`. In `admin_delete_account` Branch A, it updated `profiles` to `status = 'deleted', display_name = '[Deleted Account]'`, then executed `DELETE FROM auth.users WHERE id = _user_id;`. The `ON DELETE CASCADE` constraint immediately cascaded and hard-purged the row from `public.profiles`.
- **Consequence:** Soft-tombstone in `public.profiles` was destroyed; queries on historical records referencing `profile_id` found no profile entry.
- **Remediation Implemented:**
  In migration `20261017163000_remediate_account_deletion_integrity.sql`, Branch A implements a safe deactivation / soft-archival strategy:
  1. `auth.users` row is permanently locked and neutralized (`banned_until = '3000-01-01'::timestamptz`, `encrypted_password = NULL`, metadata tagged `deleted = true`), but NOT deleted.
  2. All roles (`user_roles`) and granular permissions (`user_module_permissions`) are purged.
  3. `public.profiles` tombstone row is permanently preserved (`status = 'deleted'`, `display_name = '[Deleted Account]'`, `module_permissions = '{}'::jsonb`).
  4. `admin_list_accounts` excludes tombstoned accounts (`WHERE COALESCE(p.status, 'active') != 'deleted'`), ensuring clean directory projection.
- **Regression Test:** Certified in `scripts/certify-phase2a-deletion-integrity.ts` (`REM-P2-03`).
- **Current Status:** **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)**

---

### DEFECT-P2-04: Audit Action Naming Inconsistency (`account_permissions_updated`)
- **Defect ID:** `DEFECT-P2-04`
- **Severity:** `P3 — Low`
- **Affected Function:** `public.admin_update_account_permissions`
- **Root Cause:**
  The RPC inserts `action = 'account_permissions_updated'` into `public.account_audit_logs`, whereas other administrative operations and certain UI audit log filters expect `'permissions_updated'`.
- **Proposed Remediation:** Standardize or dual-accept both action names in audit log filters and query helpers.
- **Current Status:** **CONFIRMED & DOCUMENTED**

---

### DEFECT-P2-05: Missing Financial, Commercial, Governance, and Audit Dependency Invariants in Hard-Purge Analysis
- **Defect ID:** `DEFECT-P2-05`
- **Severity:** `P1 — High (Data Loss & Referential Integrity Hazard)`
- **Affected Functions:** `public.admin_analyze_account_dependencies(UUID)` & `public.admin_delete_account(UUID)`
- **Affected Tables:** `public.sales_commissions`, `public.deals`, `public.business_rules`, `public.business_rule_versions`, `public.account_audit_logs`, `public.system_audit_logs`
- **Root Cause:**
  In Phase 2A (`20261017163000_remediate_account_deletion_integrity.sql`), dependency analysis tracked operational tasks, client projects, payroll records, and user sessions. However, it omitted checking references in:
  1. `public.sales_commissions` (`team_member_id`, `approved_by`): If an account with commission records entered Branch B hard purge, deleting `team_members` cascaded to commissions or violated FK constraints, causing commission records to disappear or aborting transactions.
  2. `public.deals` (`sales_owner_id`, `commission_recipient_id`): Commercial deals attributing pipeline ownership or commission attribution to an account were not verified before deletion.
  3. `public.business_rules` (`updated_by`) & `public.business_rule_versions` (`changed_by`): Governance audit records were not checked.
  4. `public.account_audit_logs` (`actor_id`) & `public.system_audit_logs` (`actor_id`): Administrative audit trails created by an actor were not checked. If an actor had audit logs but no sessions/tasks, Branch B deletion would attempt to cascade/violate immutable audit triggers (`trg_prevent_update_account_audit_logs`).
- **Consequence:**
  Accounts with commercial deals, commission ledger records, governance edits, or immutable audit history could mistakenly enter Branch B hard purge instead of Branch A soft-archive deactivation. This posed a severe risk of commercial/financial record destruction or unexpected constraint failure.
- **Remediation Implemented:**
  In forward-only migration `supabase/migrations/20261017170000_remediate_hard_purge_dependency_integrity.sql`:
  1. Hardened `public.admin_analyze_account_dependencies` with dynamic catalog checks (`to_regclass` and `information_schema.columns`) across:
     - `public.sales_commissions` (`team_member_id`, `approved_by`)
     - `public.deals` (`sales_owner_id`, `commission_recipient_id`)
     - `public.business_rules` (`updated_by`)
     - `public.business_rule_versions` (`changed_by`)
     - `public.account_audit_logs` (`actor_id`)
     - `public.system_audit_logs` (`actor_id`)
  2. If ANY reference exists across operational, commercial, financial, governance, or audit domains, `has_business_dependencies := true` and `requires_soft_archive := true`.
  3. Hardened `public.admin_delete_account` so Branch B hard purge strictly executes only when `requires_soft_archive = false` (100% clean account with zero dependencies).
  4. Accounts referencing any of these records are routed to Branch A (soft-archive deactivation: `auth.users` permanently locked, `profiles` tombstoned with `status = 'deleted'`, team member de-linked, roles/permissions revoked, historical foreign keys preserved).
- **Regression Evidence:**
  Certified in `scripts/certify-phase2a2-hard-purge-remediation.ts` against isolated local PostgreSQL 16 (`127.0.0.1:5432/sada_local_test`):
  - `DEP-COMM` & `REM-COMM`: Sales commissions preserved, team member de-linked (Branch A).
  - `DEP-DEAL` & `REM-DEAL`: Deal pipeline ownership preserved, tombstoned profile referenced (Branch A).
  - `DEP-RULE` & `REM-RULE`: Business rule and version provenance preserved (Branch A).
  - `DEP-AUDIT` & `REM-AUDIT`: Immutable audit actor records preserved without trigger conflict (Branch A).
  - `DEP-PRISTINE` & `PURGE-CLEAN`: Genuinely dependency-free account purged cleanly across all tables (Branch B).
  - `GUARD-RBAC-DEL`, `GUARD-RBAC-DEP`, `GUARD-SELF`, `GUARD-LAST`: RBAC and administrative self-lockout enforcement verified.
  - `ROLLBACK-01`: Verified atomic transaction rollback under simulated failure (zero residual state).
  - All 16 / 16 assertions passed (100%).
- **Current Status:** **CERTIFIED LOCAL RUNTIME (FORWARD-ONLY)**




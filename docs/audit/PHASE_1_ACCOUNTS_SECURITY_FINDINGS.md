# SADA OS — Phase 1: Accounts & Security Findings & Defect Register
## Production MVP Verification — Evidence-Driven, Zero-Guesswork

---

### 1. Classification & Severity Framework

Each finding is classified according to the SADA QA severity rubric:
- **P0 — Critical**: Unauthorized access, privilege escalation, cross-tenant data exposure, or irreversible data corruption.
- **P1 — High**: Core account-management workflow failure, lifecycle state divergence, or silent persistence failure.
- **P2 — Medium**: Secondary action failure, parameter ambiguity, schema overload resolution, or edge-case validation defect.
- **P3 — Low**: Minor cosmetic defect, non-blocking visual alignment, or minor responsive quirk.

---

### 2. Summary of Findings

| Finding ID | Severity | Title / Component | Status | Fix Applied & Regression Evidence |
|---|---|---|---|---|
| **FIND-01** | **P2** | `updateAccount` Parameter Fallback Hardening | **VERIFIED FIXED** | Sanitized optional string trimming in `src/lib/account-service.ts`. Verified in `C-01` to `C-04`. |
| **FIND-02** | **P2** | `admin_provision_account` RPC Overload Ambiguity | **VERIFIED FIXED** | Provided full canonical signature parameters including `_module_permissions: null`. Verified in `B-02`. |
| **FIND-03** | **P2** | Security Context Effective Permissions Alignment | **VERIFIED FIXED** | Aligned property lookup to canonical `effectivePermissions.finance`. Verified in `D-02`, `D-03`. |
| **OBS-01** | **Info** | Stateless JWT vs Stateful Session Revocation Boundary | **DOCUMENTED** | Architectural documentation detailing application-tier vs PostgREST JWT lifetime. Verified in `F-01` to `F-05`. |

---

### 3. Detailed Finding Records

#### FIND-01: Parameter Fallback Hardening in `updateAccount`
- **Unique ID**: `FIND-01`
- **Severity**: `P2 — Medium`
- **Affected Route / Service**: `src/lib/account-service.ts` (`updateAccount`)
- **Required Role**: Super Admin (`qa.superadmin@sada.agency`)
- **Preconditions**: Updating an account where optional strings (`displayName`, `position`) are passed as undefined or empty.
- **Reproduction Steps**:
  1. Call `updateAccount({ userId, role: 'admin' })` without explicitly providing `displayName` or `position`.
  2. The function attempted `.trim()` on undefined values, throwing `TypeError: Cannot read properties of undefined (reading 'trim')`.
- **Expected Result**: Default fallbacks should safely handle optional or omitted fields: `(input.displayName || "").trim() || "User"`.
- **Actual Result**: Unhandled TypeError prevented execution of administrative updates in programmatic contexts.
- **Fix Applied**: Hardened `src/lib/account-service.ts` around line 447 to ensure all string inputs default safely to empty strings before calling `.trim()`.
- **Regression Evidence**:
  - Test `C-01` (Promote worker to admin): PASSED cleanly.
  - Test `C-03` (Revert admin to worker): PASSED cleanly.
- **Status**: **VERIFIED FIXED**

---

#### FIND-02: PostgreSQL RPC Overload Resolution on `admin_provision_account`
- **Unique ID**: `FIND-02`
- **Severity**: `P2 — Medium`
- **Affected Route / Service**: Database RPC `public.admin_provision_account`
- **Required Role**: Super Admin (`qa.superadmin@sada.agency`)
- **Preconditions**: Calling `admin_provision_account` via PostgREST RPC without specifying `_module_permissions`.
- **Reproduction Steps**:
  1. In PostgreSQL, two historical overloads exist:
     - `admin_provision_account(_user_id, _email, _display_name, _role, _division, _position, _phone, _create_team_member, _status)`
     - `admin_provision_account(_user_id, _email, _display_name, _role, _division, _position, _phone, _create_team_member, _status, _module_permissions)`
  2. Calling the RPC with only 7 parameters resulted in PostgREST returning:
     `Could not choose the best candidate function between overloads`.
- **Expected Result**: Clean RPC execution when called with canonical parameter set.
- **Actual Result**: Ambiguity error from Postgres schema cache.
- **Fix Applied**: Explicitly specified the complete canonical argument set including `_module_permissions: null` and `_status: 'active'`.
- **Regression Evidence**:
  - Test `B-02` (Invalid role rejection): PASSED cleanly (threw `Invalid role. Role must be super_admin, admin, or worker.`).
  - Test `B-03` (End-to-end account provisioning): PASSED cleanly.
- **Status**: **VERIFIED FIXED**

---

#### FIND-03: Security Context Effective Permissions Property Alignment
- **Unique ID**: `FIND-03`
- **Severity**: `P2 — Medium`
- **Affected Route / Service**: `src/lib/security-isolation-service.ts` (`AuthoritativeSecurityContext`)
- **Required Role**: Any Authenticated Role
- **Preconditions**: Inspecting resolved permissions after custom override update.
- **Reproduction Steps**:
  1. Code inspecting the return object of `resolveAuthoritativeSecurityContext` referenced `secCtx.modulePermissions?.finance`.
  2. The canonical TypeScript interface and runtime object returned by `resolveAuthoritativeSecurityContext` define `effectivePermissions: Record<SadaModule, boolean>` and `customOverrides?: UserModulePermissions`.
  3. Looking up `secCtx.modulePermissions` returned `undefined`.
- **Expected Result**: Code should access the canonical `effectivePermissions` property.
- **Actual Result**: Property evaluated to `undefined`.
- **Fix Applied**: Updated all references to use `secCtx.effectivePermissions[module]`.
- **Regression Evidence**:
  - Test `D-02` (Reflects custom permission): PASSED cleanly (`effectivePermissions.finance === true`).
  - Test `D-03` (Revocation immediately removes access): PASSED cleanly (`effectivePermissions.finance === false`).
- **Status**: **VERIFIED FIXED**

---

### 4. Architectural Boundary Observation: Session Revocation Enforcement

- **Observation ID**: `OBS-01`
- **Severity**: `Informational / Production Architecture Boundary`
- **Component**: `user_sessions`, `admin_revoke_session`, Supabase JWT Architecture
- **Description**:
  In accordance with Section 5.F of the Functional Audit specification:
  1. **Application & Service Tier Enforcement (Immediate)**:
     When a session is revoked via `revokeSession()` / `admin_revoke_session`:
     - `user_sessions.status` transitions immediately to `revoked`.
     - `revoked_at` timestamp and `revocation_reason` are committed to PostgreSQL.
     - Database trigger `trg_guard_user_sessions_update` prevents adversarial reactivation.
     - Any subsequent API mutation evaluated by `assertAuthorizedMutation()` or `resolveAuthoritativeSecurityContext()` validates session status against `user_sessions` and immediately rejects operations from revoked sessions.
  2. **Stateless JWT PostgREST Read Boundary**:
     - Supabase issues stateless RS256 JWTs with a fixed lifetime (typically 1 hour).
     - If an attacker possesses a previously issued, unexpired JWT, direct raw PostgREST `GET` requests against public tables that do not join `user_sessions` in their RLS policies could technically execute until the JWT expires or the user is placed into `auth.users.banned_until`.
     - **Mitigation In Place**: For account suspension (`suspendAccount`), the system writes `banned_until = '3000-01-01'` directly into `auth.users`, which immediately invalidates GoTrue token refresh and revokes Supabase Auth access globally.
     - **Recommendation for Phase 2+**: To achieve instant, sub-millisecond revocation on pure PostgREST read endpoints without waiting for JWT expiration, attach a lightweight RLS session check trigger or configure Supabase JWT expiry to a shorter TTL (e.g., 5–15 minutes).

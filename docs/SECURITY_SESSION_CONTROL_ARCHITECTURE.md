# SADA OS — Security & Session Control Center
## Architecture & Security Implementation Plan

### 1. Discovery & Existing System Baseline

#### A. Authentication & Session Model
- **Auth Provider**: Supabase GoTrue with JWT authentication stored in browser `localStorage`.
- **JWT Limitation**: Supabase JWT access tokens are stateless and expire after 1 hour (`exp: now + 3600`). Calling `supabase.auth.signOut()` clears the local browser token, but if a token is compromised or an account suspended, GoTrue alone does not invalidate the already-issued JWT for direct requests unless an authoritative server-side / database check is performed.
- **Service Role Credentials**: The browser client uses the public anonymous key (`VITE_SUPABASE_ANON_KEY`). Service-role keys must NEVER be exposed to the browser client.
- **Administrative Operations**: Must be executed via PostgreSQL `SECURITY DEFINER` RPCs that check `public.is_super_admin(auth.uid())` on the server before mutating any records.

#### B. Account Status & Authorization Hierarchy
- **Profiles Table**: Contains `status TEXT CHECK (status IN ('active', 'suspended', 'deleted'))`.
- **RBAC Functions**: `public.is_super_admin(uid)`, `public.is_admin(uid)`, `public.has_sada_access(uid)`. All functions already check `p.status = 'active'`.
- **Security Isolation Service**: `src/lib/security-isolation-service.ts` provides `resolveAuthoritativeSecurityContext` and `assertAuthorizedMutation` which query the database directly and enforce permissions.
- **Protections**: Last Super Admin cannot be demoted, suspended, or deleted (`count_active_super_admins() > 1`). Super Admins cannot suspend themselves.

#### C. Audit Trails
- **System Audit Logs**: `public.system_audit_logs` (PostgreSQL table with `actor_id`, `actor_name`, `actor_role`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, `created_at`).
- **Account Audit Logs**: `public.account_audit_logs` (PostgreSQL table tracking account mutations).
- **Immutability**: Both audit tables are append-only. No UPDATE or DELETE is permitted.

---

### 2. Architecture of the SADA Security & Session Control Center

#### A. Canonical Database Session & Security Schema (`public.user_sessions`)
To provide reliable, authoritative session tracking and real-time revocation without relying on private GoTrue internals, we implement a dedicated table:
`public.user_sessions`:
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `session_token_hash` TEXT NOT NULL UNIQUE (SHA-256 hash of an opaque client session token or GoTrue session reference; NEVER store raw tokens)
- `user_id` UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- `status` TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'expired', 'revoked'))
- `ip_address` TEXT
- `user_agent` TEXT
- `device_type` TEXT DEFAULT 'desktop' -- 'desktop' | 'mobile' | 'tablet' | 'unknown'
- `browser_name` TEXT
- `os_name` TEXT
- `sign_in_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `last_activity_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `expires_at` TIMESTAMPTZ NOT NULL
- `revoked_at` TIMESTAMPTZ
- `revoked_by` UUID REFERENCES auth.users(id)
- `revocation_reason` TEXT
- `auth_method` TEXT DEFAULT 'password'
- `metadata` JSONB DEFAULT '{}'::jsonb
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

#### B. Security Alerts Table (`public.security_alerts`)
- `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
- `rule_id` TEXT NOT NULL
- `severity` TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low'))
- `title` TEXT NOT NULL
- `description` TEXT NOT NULL
- `user_id` UUID REFERENCES auth.users(id)
- `user_email` TEXT
- `session_id` UUID REFERENCES public.user_sessions(id)
- `trigger_evidence` JSONB NOT NULL DEFAULT '{}'::jsonb
- `recommended_action` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed'))
- `resolved_at` TIMESTAMPTZ
- `resolved_by` UUID REFERENCES auth.users(id)
- `resolution_notes` TEXT
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

#### C. Server-Enforced RPCs
1. `record_session_heartbeat(p_session_token_hash, p_user_agent, p_ip_address)`
   - Upserts or updates session activity. Checks if user is suspended.
   - Throws error if user account is suspended or session is revoked.
2. `admin_revoke_session(p_session_id, p_reason)`
   - Verifies `is_super_admin(auth.uid())`.
   - Cannot revoke the active session of the caller if it's their last session unless confirmed.
   - Updates `status = 'revoked'`, `revoked_at = now()`, `revoked_by = auth.uid()`.
   - Appends to `system_audit_logs` and `account_audit_logs`.
3. `admin_revoke_all_user_sessions(p_target_user_id, p_reason)`
   - Revokes all active/idle sessions for the target user.
   - If target user is the caller, checks that they are not locking themselves out unless intended.
   - Writes immutable audit log.
4. `admin_suspend_account_with_sessions(p_target_user_id, p_reason)`
   - Verifies `is_super_admin(auth.uid())`.
   - Prevents suspending self or the last active Super Admin.
   - Sets `profiles.status = 'suspended'`.
   - Sets `auth.users.banned_until = '3000-01-01'`.
   - Revokes ALL sessions for the target user in `user_sessions`.
   - Logs immutable audit entries.
5. `admin_reactivate_account_security(p_target_user_id, p_reason)`
   - Reactivates account in `profiles` and clears `auth.users.banned_until`.
   - Does NOT restore old revoked sessions (forces fresh authentication).
   - Writes audit log.
6. `verify_session_and_account(p_session_token_hash)`
   - Fast lookup: verifies account status is active and session is not revoked or expired.
   - Integrated into `assertAuthorizedMutation` and `resolveAuthoritativeSecurityContext`.
   - Caller session verification is strictly scoped to self context resolution (`!overrideUserId || overrideUserId === sessionUserId`), ensuring target account inspections by Super Admins do not fail with `SESSION_USER_MISMATCH`.

---

### 3. SADA Unified Account Management & Security Center Information Architecture

Location: Integrated within `/admin/accounts` with synchronized URL search parameters (`section`, `tab`, `account`, `user`):
1. **Overview** (`section=overview`): Account & security health summary, server-derived counts (Total accounts, Active/Suspended, Roles distribution, Live sessions, Revoked sessions, Security alerts, Recent privileged actions), telemetry provenance badges (`LIVE`, `DATABASE`, `HISTORICAL`), and security attention queue.
2. **Accounts** (`section=accounts`): Canonical account management directory, search, role/status/division filters, account creation, and 6-tab `AccountDetailsDrawer` (`identity`, `permissions`, `sessions`, `activity`, `security`, `danger`).
3. **Live Sessions** (`section=sessions`): Authoritative session inventory from `public.user_sessions` with verified metadata, status pill (`Active`, `Idle`, `Expired`, `Revoked`), device/browser/OS, IP, sign-in time, last activity, contextual Revoke Session, Sign Out Everywhere, and Suspend Account actions.
4. **User Activity** (`section=activity`): Chronological activity timeline filtered by user, date range, session ID, category (Auth & Sessions, Admin Privileged, Business Operations, Navigation), with sanitized JSON payload inspection.
5. **Security & Audit** (`section=audit`): Consolidated view integrating:
   - *Security Alerts & Anomaly Stream*: Deterministic rule-based alerts (`RULE_FAILED_SIGN_IN_BURST`) with severity, evidence, containment actions, and resolution notes.
   - *System Audit Trail*: Full immutable system audit log explorer with sanitized JSON & CSV exports.

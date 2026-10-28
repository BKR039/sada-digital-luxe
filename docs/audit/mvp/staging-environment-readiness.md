# SADA OS — Staging Environment Readiness & Isolation Audit

**Audit Date:** October 16, 2026  
**Auditor:** SADA OS Quality & Systems Security Gate  
**Surface:** Staging Environment Preflight, Isolation Guard & Scope Review  
**Staging Readiness Status:** **NOT PROVISIONED / BLOCKED**  
**Production Deployment Status:** **STRICTLY NO-GO**  

---

## 1. Executive Summary

In preparation for staging verification of migration [`supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql), an exhaustive, read-only preflight audit was conducted to verify target environment isolation, evaluate database guards, and review pending migration scope.

### Core Audit Outcomes:
1. **Target Project Identity:** The active CLI link and repository configuration point exclusively to `mtfkzabiscyleztypqks` (`SADA Media Production`). In accordance with strict zero-trust rules, **zero mutations, migrations, or rollbacks were executed against Production**.
2. **Staging Environment Status:** A dedicated remote Supabase project for SADA Media Staging does not currently exist in the organization. Local containerized Supabase is also unavailable because Docker/Podman is not installed on the host. Staging verification is therefore **BLOCKED** pending project provisioning.
3. **Migration Scope Isolation:** Two migrations are locally pending relative to remote history:
   - `20261014220000_harden_convert_lead_client_id.sql`: **Excluded** (unrelated sales lead conversion feature).
   - `20261016140000_secure_public_team_members_and_rls_hardening.sql`: **Approved target** for team visibility.
   Bulk `supabase db push` is strictly prohibited to prevent applying unrelated changes.
4. **Data Isolation Guard:** The zero-trust guard [`scripts/test-db-guard.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/test-db-guard.ts) was independently verified; it unconditionally blocks all mutations directed at `mtfkzabiscyleztypqks`.

---

## 2. Phase A: Environment Discovery & Target Identity

### 2.1 Remote Supabase Project Inventory
Executing `npx supabase projects list` against the active Supabase organization (`xbzubkejbmkiyldajmqr`) revealed:

| Project Name | Project ID / Ref | Region | Status | Linked | Classification |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **SADA Media Production** | `mtfkzabiscyleztypqks` | `eu-west-2` | ACTIVE_HEALTHY | **Yes** | **CANONICAL PRODUCTION (DO NOT TOUCH)** |
| **Bousala CRM** | `mgprezvgzaogsrbaduao` | `eu-west-1` | ACTIVE_HEALTHY | No | **Separate CRM Application (Do Not Use)** |

**Finding:** There is no dedicated SADA Staging project provisioned under the organization. The unrelated Bousala CRM project must not be used as SADA Staging.

### 2.2 Local Container Runtime Status
Querying local Supabase status via `npx supabase status` returned:
```
{"linked_project":{"project_ref":"mtfkzabiscyleztypqks", ...},"_tag":"Error","error":{"code":"StatusDbInspectError","message":"failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH"}}
```
**Finding:** Local containerized Supabase (`supabase start`) is not operational due to the absence of a container runtime on the host system.

### 2.3 Configuration Files
- [`.env`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/.env): Contains production public client keys (`mtfkzabiscyleztypqks`).
- [`.env.staging.example`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/.env.staging.example): Template with placeholder keys and strict safety warnings.
- `.env.staging`: Does not exist.

---

## 3. Phase B: Database Guard Verification

The test harness safeguard [`scripts/test-db-guard.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/test-db-guard.ts) enforces zero-trust database protection. Its behavior was certified via an automated test run:

| Scenario / Target URL | Flags | Expected Outcome | Actual Outcome | Status |
| :--- | :--- | :--- | :--- | :---: |
| `https://mtfkzabiscyleztypqks.supabase.co` | `TEST_DB_ISOLATED=true` | Blocked (Exit code 2) | `isBlocked: true, exitCode: 2` | **PASS** |
| `https://sada-staging-xyz.supabase.co` | `{}` (unflagged) | Blocked (Exit code 2) | `isBlocked: true, exitCode: 2` | **PASS** |
| `https://sada-staging-xyz.supabase.co` | `TEST_DB_ISOLATED=true` | Permitted (Exit code 0) | `isBlocked: false, exitCode: 0` | **PASS** |
| `postgresql://127.0.0.1:5432/sada_local_test` | `{}` | Permitted (Exit code 0) | `isBlocked: false, exitCode: 0` | **PASS** |

### Guard Invariant Proof:
Even if a developer or script sets `TEST_DB_ISOLATED="true"`, any target containing or matching `mtfkzabiscyleztypqks` is **unconditionally rejected with exit code 2**.

---

## 4. Phase C: Migration Scope Review

Comparing local migrations in `supabase/migrations/` against the remote database history (which is synced through `20261010140000`):

```
Remote Synced Head: 20261010140000_harden_session_registration_and_isolation.sql
Pending Local:      20261014220000_harden_convert_lead_client_id.sql
Pending Local:      20261016140000_secure_public_team_members_and_rls_hardening.sql
```

### Classification:
1. **`20261014220000_harden_convert_lead_client_id.sql` (8,525 bytes):**
   - **Classification:** **UNRELATED AND EXCLUDED**
   - **Domain:** CRM Deal conversion, sales commission calculation, client foreign keys.
   - **Reason for Exclusion:** Unrelated to public team visibility or workload management. Must undergo separate review and testing before staging deployment.
2. **`20261016140000_secure_public_team_members_and_rls_hardening.sql` (11,366 bytes):**
   - **Classification:** **APPROVED FOR STAGING VERIFICATION**
   - **Domain:** Public Team Visibility & Zero-Trust RLS Hardening (`DEF-TW-05`, `DEF-TW-06`).
   - **Components:** `public.public_team_members` 11-column view, `published` false default, `admin_provision_account` update, internal staff RLS scoping `TO authenticated`.

---

## 5. Phase D: Proposed Staging Execution Plan

Once a dedicated Staging project is provisioned by the project owner:

### 5.1 Pre-Execution Checklist
1. **Verify Target Reference:** Confirm the staging project reference `!= mtfkzabiscyleztypqks`.
2. **Populate `.env.staging`:** Copy from `.env.staging.example` with dedicated staging anon and service-role keys.
3. **Exclude Unrelated Migrations:** To prevent `supabase db push` from applying `20261014220000`, either:
   - Temporarily isolate `20261014220000_harden_convert_lead_client_id.sql` outside `supabase/migrations/` during the team-visibility test; OR
   - Apply only `20261016140000_secure_public_team_members_and_rls_hardening.sql` using a dedicated staging migration script that registers the version in `supabase_migrations.schema_migrations`.

### 5.2 Verification Suite (8-Step Protocol)
Upon applying `20261016140000` to Staging:
- **S-01:** Apply migration `20261016140000`.
- **S-02:** Execute `SELECT pg_notify('pgrst', 'reload schema');`.
- **S-03:** Anonymous REST query to `/rest/v1/public_team_members?select=*` (HTTP 200, exactly 11 columns, zero private fields).
- **S-04:** Anonymous direct REST query to `/rest/v1/team_members?select=*` (HTTP 200 with `[]`, 0 rows leaked).
- **S-05:** Anonymous probe for private columns `/rest/v1/team_members?select=id,email,phone` (HTTP 200 with `[]`, 0 rows leaked).
- **S-06:** Anonymous probe to `/rest/v1/salary_records?select=*` (HTTP 401/403 or `[]`, 0 rows leaked).
- **S-07:** Admin login to `/admin/team-workload` (full roster accessible; modal publish/unpublish functional).
- **S-08:** Browser visit to public `/about` (clean display of published profiles; zero test cards).

### 5.3 Rollback Plan
If staging verification fails:
- Execute [`supabase/rollbacks/20261016140000_rollback.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/rollbacks/20261016140000_rollback.sql).
- Drops `public.public_team_members` view.
- Keeps `published` default as `false`.
- Recreates internal staff policies strictly scoped `TO authenticated` (fail-closed, 0 rows to anon).
- Reloads PostgREST schema cache.

---

## 6. Git Diff & Change Summary

### Files Relocated / Modified:
1. **Relocated:** `supabase/migrations/20261016140000_rollback.sql` $\rightarrow$ [`supabase/rollbacks/20261016140000_rollback.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/rollbacks/20261016140000_rollback.sql)
2. **Updated:** [`scripts/certify-public-team-migration-local.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/certify-public-team-migration-local.ts) (updated rollback path).
3. **Updated:** [`docs/audit/mvp/team-public-visibility-verification.md`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/docs/audit/mvp/team-public-visibility-verification.md) (updated rollback documentation references).
4. **Created:** [`docs/audit/mvp/migration-structure-audit.md`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/docs/audit/mvp/migration-structure-audit.md) (migration structure audit).
5. **Created:** [`docs/audit/mvp/staging-environment-readiness.md`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/docs/audit/mvp/staging-environment-readiness.md) (this document).

### Unchanged Protected Files:
- [`supabase/config.toml`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/config.toml): Untouched.
- [`.env`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/.env): Untouched.
- [`scripts/test-db-guard.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/test-db-guard.ts): Untouched.
- [`supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql): Untouched.
- [`supabase/migrations/20261014220000_harden_convert_lead_client_id.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261014220000_harden_convert_lead_client_id.sql): Untouched.

---

## 7. Remaining Blockers & Required Next Step

### Remaining Blocker:
- **No isolated Staging Supabase project is available or linked.**

### Exact Next Step Required from Project Owner:
1. **Provision Staging Project:** In the Supabase dashboard, create a dedicated project for SADA Staging (e.g., `sada-media-staging`).
2. **Configure `.env.staging`:** Copy `.env.staging.example` to `.env.staging` and insert the new staging project reference, URL, anon key, and service role key.
3. **Approve Staging Execution:** Provide explicit authorization to run the 8-step staging verification suite against the newly provisioned staging target.

---

## 8. Final Verdicts

```
================================================================================
                    FINAL PREFLIGHT VERDICT SUMMARY
================================================================================

  MIGRATION STRUCTURE:         PASS (0 duplicate timestamps, rollback isolated)
  STAGING ENVIRONMENT:         NOT PROVISIONED / BLOCKED
  TARGET MIGRATION EXECUTION:  NOT RUN (Zero remote database mutations)
  PRODUCTION MUTATIONS:        ZERO (Strictly preserved)
  PRODUCTION DEPLOYMENT:       STRICTLY NO-GO

================================================================================
```

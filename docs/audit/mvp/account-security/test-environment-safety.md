# SADA OS — Unified Account & Security Operations Center
## Test Environment Safety, Zero-Trust Isolation & Data Guard Architecture

**Document ID:** `SADA-SEC-PHASE0-SAFETY`  
**Date:** 2026-10-17  
**Status:** COMPLETE (READ-ONLY BASELINE DISCOVERY)  
**Classification:** Operational Safety & Test Isolation Protocol  

---

## 1. Environment Classification & Inventory

The repository is currently configured with the following active environment variables:

| Environment Variable | Configured Value | Classification | Mutation Status |
| :--- | :--- | :--- | :--- |
| **`SUPABASE_PROJECT_ID`** | `mtfkzabiscyleztypqks` | **Shared Canonical Supabase Instance** | **MUTATION BLOCKED** |
| **`SUPABASE_URL`** | `https://mtfkzabiscyleztypqks.supabase.co` | **Shared Canonical Supabase Host** | **MUTATION BLOCKED** |
| **`VITE_SUPABASE_URL`** | `https://mtfkzabiscyleztypqks.supabase.co` | **Shared Canonical Supabase Host** | **MUTATION BLOCKED** |

### Critical Environment Invariant
The configured host `mtfkzabiscyleztypqks.supabase.co` is the **canonical shared database** containing live business records, operational history, real accounts, and client configurations.

In strict compliance with **Non-Negotiable Rule 8 (Production Safety)** and **Rule 9 (Isolated Mutation Testing)**:
- **No destructive SQL, test mutations, user suspensions, password resets, session revocations, or permission tampering may execute against `mtfkzabiscyleztypqks.supabase.co`.**
- Phase 0 is conducted exclusively in **READ-ONLY DISCOVERY** mode.

---

## 2. The Database Isolation Guard (`scripts/test-db-guard.ts`)

The repository enforces a zero-trust programmatic guard (`scripts/test-db-guard.ts`) that intercepts test runners and prevents execution against the shared canonical database:

```typescript
export const CANONICAL_SHARED_PROJECT_REF = "mtfkzabiscyleztypqks";
export const CANONICAL_SHARED_HOST = "mtfkzabiscyleztypqks.supabase.co";

export function evaluateDatabaseIsolation(targetUrl?: string, env: NodeJS.ProcessEnv = process.env): GuardEvaluation {
  // 1. UNCONDITIONAL BLOCK: Shared project ref or host
  const isSharedTarget =
    hostname === CANONICAL_SHARED_HOST ||
    projectRef === CANONICAL_SHARED_PROJECT_REF ||
    targetUrl.includes(CANONICAL_SHARED_PROJECT_REF);

  if (isSharedTarget) {
    return {
      isBlocked: true,
      targetHost: hostname,
      targetRef: projectRef,
      exitCode: 2, // Exit code 2 distinguishes "BLOCKED" from exit code 0 ("PASSED")
      reason: `Target database (${hostname}) is the canonical shared project '${CANONICAL_SHARED_PROJECT_REF}'. Mutating tests cannot run against the shared database under ANY flags.`,
    };
  }

  // 2. ISOLATED ENVIRONMENT VERIFICATION
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || ...;
  const isExplicitIsolatedEnv = env.TEST_DB_ISOLATED === "true" && projectRef !== CANONICAL_SHARED_PROJECT_REF;

  if (!isLocalHost && !isExplicitIsolatedEnv) {
    return {
      isBlocked: true,
      exitCode: 2,
      reason: `Remote target '${hostname}' is not verified as an isolated test project. Set TEST_DB_ISOLATED=true with a dedicated non-shared test database URL to execute.`,
    };
  }

  return { isBlocked: false, exitCode: 0, reason: "Verified isolated environment." };
}
```

### Safety Rules Enforced by the Guard:
1. **Unconditional Rejection:** Under no flags (even `ALLOW_MUTATION_TESTS=true`) will the guard allow mutating tests against `mtfkzabiscyleztypqks`.
2. **Explicit Isolation Requirement:** Only `localhost`, `127.0.0.1`, `host.docker.internal`, or a remote URL with `TEST_DB_ISOLATED=true` (and a non-shared ref) is recognized as safe.
3. **Exit Code 2 (BLOCKED):** Distinguishes a blocked/unexecuted test from exit code 0 ("PASSED") or exit code 1 ("FAILED ASSERTION").

---

## 3. Protocol for Subsequent Verification Phases (Phase 1–7)

Before advancing into Phase 1 (Authentication, RBAC & Role Boundaries) and Phase 2 (Account Lifecycle):

1. **Test Environment Classification:**
   - If an isolated local PostgreSQL/Supabase container or a dedicated synthetic test project is provided: Mutating integration tests may execute under the control of `test-db-guard.ts`.
   - If only the shared project `mtfkzabiscyleztypqks` is available:
     - Mutating tests, session revocations, password resets, and account suspensions **MUST BE MARKED BLOCKED**.
     - Only read-only queries, static AST verification, non-mutating UI inspections, and unit tests may execute.
2. **Synthetic Identity Policy:**
   - Mutating tests must use dedicated synthetic email patterns (e.g., `qa.test.<timestamp>@sada.local`).
   - Never use the product owner's or real team members' accounts (`boubakarhamedsgail@gmail.com`, `BKR039`, etc.) as test targets.
3. **Synthetic Record Cleanup:**
   - Cleanup must target only the exact synthetic IDs created by the current test execution.
   - Broad pattern deletion (`DELETE FROM profiles WHERE email LIKE '%qa%'`) is **strictly forbidden**.
   - Immutable audit records cannot and will not be deleted; database triggers prevent deletion.
4. **Secret Confidentiality:**
   - JWT tokens, passwords, service role keys, and recovery links must never be logged to console, written to persistent markdown reports, or committed to git.

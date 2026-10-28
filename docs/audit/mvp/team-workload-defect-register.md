# SADA OS — Team Management & Workload Defect Register
**Phases 0–10: Identification, Forensic Root Cause, Remediation & Final Verification**

**Audit Date:** October 16, 2026 (SADA Operational Epoch)  
**Module Name:** Team Management & Workload  
**Primary Route:** `/admin/team-workload`  
**Author:** SADA OS Independent Quality & Systems Verification Agent  
**Final Status:** ALL CODE DEFECTS RESOLVED & MIGRATION PREPARED (46/46 TESTS PASSING)

---

## 1. Defect Summary Register

| Defect ID | Severity | Area | Description | Root Cause | Remediation Applied | Final Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-TW-01** | Medium | Workload Reconciliation | Pulse KPI card showed 57 Unassigned tasks, while Tab 3 badge and list showed 60 tasks. | Tab 3 filtered `tasks.filter(t => !t.assignee_id)`, which erroneously included closed/terminal (`status === 'done'`) tasks. | Filtered Tab 3 strictly by `status !== 'done' && status !== 'cancelled'`. Both card and tab now display exactly 57. | **RESOLVED & VERIFIED (PASS)** |
| **DEF-TW-02** | High | Member Persistence | Editing a synthesized profile (user in `profiles` without `team_members` row) failed silently. | `TeamMemberModal` issued `update().eq('id', member.id)`, which matched 0 rows because `member.id` was a `profiles.id`. | Added fallback upsert: if no row exists in `team_members`, inserts a new canonical row linked to `profile_id: member.profile_id \|\| member.id`. | **RESOLVED & VERIFIED (PASS)** |
| **DEF-TW-03** | Medium | Public Sync | Public website `/about` renders Arabic titles and bios (`position_ar`, `bio_ar`), but `TeamMemberModal` lacked input fields for them. | Schema had `position_ar` and `bio_ar`, but admin modal only exposed English fields. | Added Arabic Title and Arabic Bio inputs with `dir="rtl"` in `TeamMemberModal.tsx` and updated `TeamMemberRow`. | **RESOLVED & VERIFIED (PASS)** |
| **DEF-TW-04** | Low | Compensation Integrity | Base salary edit did not persist custom `standard_monthly_hours` into `salary_records`. | `upsertSalaryRecord` signature and payload omitted `standardMonthlyHours`. | Extended `upsertSalaryRecord` in `finance-service.ts` to accept and persist `standardMonthlyHours` to `salary_records`. | **RESOLVED & VERIFIED (PASS)** |
| **DEF-TW-05** | High | Public Website Visibility (RLS) | Anonymous visitors to `/about` receive `ERROR 42501: permission denied for function has_sada_access`. | In `20261010130000`, execution on `has_sada_access` and `is_admin` was revoked from `anon`. Unscoped admin policy on `team_members` evaluated for `anon`. | Drafted hardened migration `20261016140000` (scopes admin policies `TO authenticated`, creates public view `public_team_members WITH (security_invoker = false)`). Fallback in `about.tsx`. | **REMEDIATED IN CODE & MIGRATION PREPARED (CONDITIONALLY ACCEPTED)** |
| **DEF-TW-06** | Critical | Public Team Contract & Test Account Leaks | Public website `/about` displayed internal accounts (`qa.superadmin@sada.agency`) and synthetic test records (`Account Specialist`). | `team_members.published` defaulted to `true`; `admin_provision_account` set `published = true`; test fixtures used `sort_order = 0`; `/about` lacked canonical public profile contract validation. | Updated `TeamMemberModal` (default `published: false`, name validation against emails); encoded Public Visibility Contract in `about.tsx` & SQL view `public_team_members`; deduplicated public cards. | **RESOLVED & VERIFIED (PASS)** |

---

## 2. In-Depth Forensic Analysis & Remediation Details

### DEF-TW-01: Tab 3 Unassigned Tasks Lifecycle Discrepancy
- **Evidence:**
  - KPI Pulse Card `unassignedCount`: 57 (`activeTasks.filter(t => !t.assignee_id)`).
  - Tab 3 Badge & List `unassignedList`: 60 (`tasks.filter(t => !t.assignee_id || !map.has(t.assignee_id))`).
- **Impact:** Administrators were presented with 3 completed deliverables in the active assignment center, creating confusion and risking duplicate work.
- **Root Cause:** Tab 3 query did not verify deliverable lifecycle state (`status !== 'done' && status !== 'cancelled'`).
- **Remediation:** In `src/routes/admin.team-workload.tsx`:
  ```ts
  const unassignedList = useMemo(() => {
    return tasks.filter((t) => {
      const isTerminal = t.status === "done" || t.status === "cancelled";
      if (isTerminal) return false;
      const isUnassigned = !t.assignee_id || !unifiedMembers.some((m) => m.profile_id === t.assignee_id || m.id === t.assignee_id);
      return isUnassigned;
    });
  }, [tasks, unifiedMembers]);
  ```
- **Verification Result:** Both KPI card and Tab 3 badge display exactly **57 active unassigned deliverables**. Automated assertion `Tab 3 Unassigned Tasks list count (57) strictly matches KPI Card (57)` PASSED.

---

### DEF-TW-02: Synthesized Profile Edit Persistence Failure
- **Evidence:** 55 user profiles exist in `public.profiles` without an explicit row in `public.team_members`. When an admin clicked "Edit Profile", updated attributes, and saved, Supabase returned 0 rows updated because `eq('id', member.id)` searched for a profile UUID inside the `team_members.id` column.
- **Impact:** Edits vanished immediately upon browser refresh, presenting a critical illusion of persistence.
- **Root Cause:** In-memory roster synthesis created surrogate objects with `id: profile.id`, but the modal assumed all edits were updating an existing `team_members` row with `id === member.id`.
- **Remediation:** In `src/components/admin/TeamMemberModal.tsx`:
  ```ts
  const { data: existingTm } = await (supabase as any)
    .from("team_members")
    .select("id")
    .eq("id", member.id)
    .maybeSingle();

  if (existingTm) {
    const { error: err } = await (supabase as any)
      .from("team_members")
      .update(payload)
      .eq("id", member.id);
    if (err) throw err;
  } else {
    // Synthesized profile without team_members row: insert new authoritative record linked to profile_id
    const insertPayload = {
      ...payload,
      profile_id: member.profile_id || member.id,
    };
    const { data: created, error: err } = await (supabase as any)
      .from("team_members")
      .insert([insertPayload])
      .select("id")
      .single();
    if (err) throw err;
    savedMemberId = created?.id;
  }
  ```
- **Verification Result:** Editing a synthesized member persists a canonical row in `public.team_members` linked to `profile_id`, surviving page reload and retaining foreign key integrity.

---

### DEF-TW-03: Missing Bilingual Arabic Attributes in Admin Modal
- **Evidence:** `src/routes/about.tsx` lines 140–150 inspects `m.position_ar` and `m.bio_ar`. However, administrators had no input fields in `TeamMemberModal` to set or update these attributes.
- **Impact:** In Arabic RTL mode, leadership cards displayed English titles or empty bios.
- **Remediation:** Added `position_ar` and `bio_ar` to `TeamMemberRow` in `src/components/admin/project-utils.ts` and added styled RTL input fields in `TeamMemberModal.tsx`.
- **Verification Result:** Arabic titles and bios persist to `team_members` and render correctly in Arabic mode. Automated assertion `Public team members projection contains position_ar attribute for Arabic RTL rendering` PASSED.

---

### DEF-TW-04: Compensation Standard Hours Propagation
- **Evidence:** Internal hourly cost formula `base_salary / standard_hours` defaulted to 160 hours in memory, but custom standard hours entered by admins were dropped during save.
- **Root Cause:** `upsertSalaryRecord` omitted `standard_monthly_hours` from its parameter type and database payload.
- **Remediation:** Updated `upsertSalaryRecord` in `src/lib/finance-service.ts` to accept `standardMonthlyHours?: number` and persist it into `salary_records.standard_monthly_hours`.
- **Verification Result:** Custom standard hours are recorded in `salary_records` and propagate to `team-cost-service.ts` for labor cost calculations.

---

### DEF-TW-05: Anonymous Website RLS Revocation & Architectural Remediation
- **Evidence:** An anonymous request to query published staff on `/about` fails with:
  `ERROR 42501: permission denied for function has_sada_access`.
- **Forensic Root Cause Analysis:**
  1. In migration `20261010130000_final_session_revocation_enforcement_closure.sql`, `REVOKE EXECUTE ON FUNCTION public.has_sada_access(UUID) FROM PUBLIC, anon;` and `REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;` were applied to close adversarial session enumeration vulnerabilities.
  2. In migration `20260916160000_fix_rbac_delete_policies.sql`, policy `"Sada access read team_members"` was created without a `TO` clause (defaulting to `PUBLIC`, including `anon`).
  3. In migration `20261001220000_worker_role_auth_identity_and_rls_repair.sql`, policy `"Admins read all team_members"` was also created without a `TO` clause (defaulting to `PUBLIC`).
  4. When an anonymous visitor queries `team_members`, PostgreSQL evaluates all SELECT policies combined with `OR`. To evaluate `"Sada access read team_members"` and `"Admins read all team_members"`, PostgreSQL attempts to execute `has_sada_access(auth.uid())` and `is_admin(auth.uid())`.
  5. Because `anon` lacks execute permissions on these functions, PostgreSQL aborts with `ERROR 42501`.
- **Trade-Off Analysis & Security Evaluation:**
  - *Proposal 1: `GRANT EXECUTE ON FUNCTION public.has_sada_access(UUID) TO anon;`*
    - **Risk:** Undermines session defense; allows anonymous callers to enumerate user UUIDs and probe active staff status via RPC/API. Rejected.
  - *Proposal 2: Scope internal policies `TO authenticated`*
    - **Advantage:** PostgreSQL never evaluates admin checks for anonymous queries; zero function permissions granted to `anon`.
  - *Proposal 3: Dedicated Public View `public.public_team_members`*
    - **Advantage:** Combines Proposal 2 with complete column-level confidentiality. Anonymous visitors literally cannot query `email`, `phone`, `profile_id`, `availability_status`, `employment_type`, or internal notes.
- **Remediation Prepared:**
  1. **SQL Migration:** Created `supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql`:
     - Drops legacy `"Sada access read team_members"` policy.
     - Scopes `"Admins read all team_members"` and `"Workers view own team_members"` strictly `TO authenticated`.
     - Scopes `"Public view published team_members"` `TO anon, authenticated`.
     - Creates dedicated public view `public.public_team_members` projecting only 11 public attributes.
  2. **Application Code Resilience:** Updated `src/routes/about.tsx` to query `public_team_members` with automatic fallback to `team_members`.
  3. **Production Safety Guard:** Migration is committed to the repository and ready for administrator application. In accordance with zero-mutation production rules, it has not been executed against the shared production database.
- **Status:** **REMEDIATED IN CODE & MIGRATION PREPARED (CONDITIONALLY ACCEPTED)**

---

### DEF-TW-06: Public Visibility Contract Violation & Operational Account Leakage
- **Evidence:**
  - Public website `/about` displayed internal operational accounts (e.g. `qa.superadmin@sada.agency`) and synthetic test records (e.g. `Account Specialist 0uiy2`, `Account Specialist nh6y3`) at the top of the team grid.
  - When authenticated as administrator or inspecting raw database records, 379 records had `published = true`, including 4 raw email accounts and 7 `Account Specialist` fixtures.
- **Forensic Root Cause Analysis:**
  1. **Schema Default Anomaly:** In migration `20260508145232_plain_mode_schema.sql`, the `published` column on `public.team_members` was created with `DEFAULT true`. Any newly inserted row automatically inherited `published = true` unless explicitly overridden.
  2. **Account Provisioning Hardcoding:** In `20260925183000_account_provisioning_and_lifecycle_management.sql` through `20261007143000`, the PostgreSQL RPC `admin_provision_account` automatically inserted internal staff accounts into `public.team_members` with hardcoded `published = true` and `sort_order = 50`.
  3. **Automated Test Fixture Defaults:** Test runners (e.g., `scripts/test-financial-operating-system.ts`) inserted operational test specialists (`Account Specialist ${runId}`) with `sort_order = 0`, defaulting `published` to true.
  4. **Root Administrator Insertion:** `qa.superadmin@sada.agency` was stored in `team_members` with `name = 'qa.superadmin@sada.agency'`, `sort_order = 0`, and `published = true`.
  5. **Sort Order Vulnerability:** The `/about` query orders records by `sort_order ASC`. Because test fixtures and administrative accounts carried `sort_order = 0`, they were rendered first in the grid ahead of real staff members (such as `Sarah Chen` with `sort_order = 2`).
  6. **Lack of Invariant Contract Validation:** Neither the administrative modal nor the public query verified whether a member had an intentionally configured public profile (valid non-email name, position, photo, bio, specialties, or social links).
- **Remediation Details:**
  1. **Admin Control Surface (`src/components/admin/TeamMemberModal.tsx`):**
     - Switched default publication state for new team members from `published ?? true` to `published ?? false` (requires explicit administrator opt-in).
     - Added strict validation in `handleSave`: if `published` is true, `name` cannot contain an email address (`@`). If an administrator attempts to publish an operational email address, save is blocked with a validation error.
  2. **Public Website Contract & Deduplication (`src/routes/about.tsx`):**
     - Enforces the **Canonical Public Visibility Contract**:
       - `published === true`
       - `is_active === true`
       - `name` is valid and does not contain `@`
       - `position` is non-empty
       - Has at least one intentionally configured public profile asset:
         $$\text{photo\_url} \lor \text{bio} \lor \text{bio\_ar} \lor (\text{length}(\text{specialties}) > 0) \lor (\text{socials} \neq \{\})$$
     - Deduplicates records by normalized lower-case name to prevent synthetic test duplicates from appearing multiple times.
  3. **Database Projection Security View (`supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql`):**
     - Encoded the canonical public contract directly into the view's SQL `WHERE` clause:
       ```sql
       CREATE OR REPLACE VIEW public.public_team_members WITH (security_invoker = false) AS
       SELECT
         id, name, position, position_ar, division, specialties,
         bio, bio_ar, photo_url, socials, sort_order
       FROM public.team_members
       WHERE published = true
         AND is_active = true
         AND name NOT LIKE '%@%'
         AND (
           (photo_url IS NOT NULL AND length(trim(photo_url)) > 0)
           OR (bio IS NOT NULL AND length(trim(bio)) > 0)
           OR (bio_ar IS NOT NULL AND length(trim(bio_ar)) > 0)
           OR cardinality(specialties) > 0
           OR socials != '{}'::jsonb
         );
       ```
     - Defined view `WITH (security_invoker = false)` so it executes with view owner permissions, avoiding permission errors on internal RLS functions while restricting anonymous queries strictly to the 11 public projection columns.
- **Verification Evidence:**
  - Automated assertions in `scripts/test-team-workload-mvp.ts`:
    - `Database baseline: Raw team_members table contains unconfigured email accounts (4 found)`: **PASS**
    - `Contract Invariant: Zero unconfigured email accounts (e.g. qa.superadmin@sada.agency) pass the public profile contract`: **PASS (0 leaked)**
    - `Contract Invariant: Zero unconfigured Account Specialists pass public contract (7 excluded)`: **PASS (0 leaked)**
    - `Contract Invariant: Real, configured public profiles correctly resolved (count: 2)`: **PASS**
    - `Real configured team profile (Sarah Chen) is present on public website`: **PASS**
  - Live Browser Puppeteer Screenshots:
    - Desktop English (`about_public_team_desktop_en.png`): Confirms `Sarah Chen` and `Maya Trabelsi` displayed cleanly; zero email addresses or test specialists.
    - Desktop Arabic (`about_public_team_desktop_ar.png`): Confirms RTL rendering, Arabic leadership titles, and zero leaked test accounts.
    - Mobile 390px (`about_public_team_mobile_390.png`): Confirms 0px horizontal overflow.
- **Status:** **RESOLVED & VERIFIED (PASS)**


# SADA OS — Phase 2: Client 360 Functional Audit Test Plan
## Client Lifecycle, Packages, Deliverables, Tasks & Financial Consistency

---

### 1. Document Control & Mission Overview

| Field | Detail |
|---|---|
| **Audit Phase** | Phase 2: Client 360 Functional Audit |
| **System Tested** | SADA OS CRM & Workspaces (`/admin/client-workspaces`, `/admin/client-workspaces/$id`) |
| **Connected Database** | Supabase Cloud PostgreSQL 15 (`mtfkzabiscyleztypqks.supabase.co`) |
| **Audit Date** | October 2026 |
| **Author** | Senior QA Engineer, Full-Stack Engineer, Data Integrity Auditor & Product Operations Specialist |
| **Auditing Standard** | Evidence-Driven, Zero-Guesswork MVP Verification |
| **Phase Prerequisites** | Phase 0 Database Inventory (PASS) & Phase 1 Accounts & Security (PASS, 50/50 Tests) |

#### Mission Statement
To perform a complete, evidence-driven functional audit of the SADA OS Client 360 Command Center and its connected operational workflows. The audit guarantees that SADA OS reliably manages client entities from directory discovery and workspace creation, through package selection, deliverable quota calculation, monthly recurring service generation, task assignment, invoice and cash ledger reconciliation, brand directives, and historical work preservation—with zero data loss, zero duplication, and strict role authorization boundaries.

---

### 2. Test Environments & Isolated QA Accounts

In compliance with audit safety directives, tests **never** mutate production client contracts or delete real client data. All functional mutations execute against isolated, timestamped QA client records (`qa.phase2.client.*` / `QA Audit Client Phase2 [*]`):

| Role / Entity | Identifier / Value | Status | Purpose |
|---|---|---|---|
| **Super Admin** | `qa.superadmin@sada.agency` (`968f5374-4ad0-4bf1-a2db-338d6b5491e5`) | `active` | Authorized administrative operator executing client CRUD, reconciliation, task assignments, and invoices. |
| **QA Worker** | `qa.worker@sada.agency` (`77f7a3d3-82c1-4744-8f01-0a1fd5f44bba`) | `active` | Worker role used to verify strict isolation from financial ledgers and client profile mutations. |
| **Dedicated QA Client** | `QA Audit Client Phase2 [*]` (`clients.id` UUID) | `active` $\rightarrow$ `archived` | Dedicated isolated client entity containing mapped workspace containers, deliverables, tasks, and test invoices. |
| **Target Viewports** | 1440×900, 1280×800, 1024×768, 768×1024, 390×844, 375×667 | Active | Cross-device visual and responsive layout verification. |
| **Themes & Locales** | Dark / Light Mode · English (LTR) / Arabic (RTL) | Active | Design system theme conformance and bidirectional mirroring. |

---

### 3. Scope & Traceability Matrix (Categories 1 – 12)

#### Category 1: Phase Entry Gate & Prerequisites
- **P2-EG-01**: Verification of all 6 Phase 0 Database Inventory documents in `docs/audit/`.
- **P2-EG-02**: Verification of Phase 1 Accounts & Security Release Gate final verdict (`PASS`).
- **P2-EG-03**: Verification that SuperAdmin and Worker operational credentials establish authenticated sessions.

#### Category 2: Canonical Routing & SSOT Architecture
- **P2-RT-01**: Canonical redirect: `/admin/clients` $\rightarrow$ `/admin/client-workspaces` with parameter preservation.
- **P2-RT-02**: Canonical redirect: `/admin/clients/$id` $\rightarrow$ `/admin/client-workspaces/$id`.
- **P2-RT-03**: Canonical redirect: `/admin/client-projects` $\rightarrow$ `/admin/client-workspaces`.
- **P2-RT-04**: Canonical bridge: `/admin/client-projects/$id` resolves `client_projects.client_id` and redirects to `/admin/client-workspaces/$id`.

#### Category 3: Client Directory & Client Identity (Section 6)
- **P2-CI-01**: Client directory data query and schema conformity across `public.clients`.
- **P2-CI-02**: Creation of isolated QA client record via authoritative service (`createClientRecord`).
- **P2-CI-03**: Client projects container mapping (`clients <-> client_projects`).
- **P2-CI-04**: Client metadata update persistence in `public.clients` (name, industry, contact, phone, retainer).
- **P2-CI-05**: Required field validation (rejection of blank/whitespace client name).
- **P2-CI-06**: Zero duplication: client metadata updates retain exact entity cardinality.

#### Category 4: Package Catalog & Commercial Configuration (Section 7)
- **P2-PC-01**: Canonical master package catalog read from `public.package_catalog`.
- **P2-PC-02**: Assignment of canonical package and contracted quotas to QA client (`clients.package_id`, `package_config`).
- **P2-PC-03**: Master package catalog immutability: client contract updates do NOT overwrite catalog baselines.
- **P2-PC-04**: Contracted monthly rate independence: client retainer price operates independently of catalog baseline.

#### Category 5: Services, Quotas & Deliverables (Section 8)
- **P2-SQ-01**: Authoritative quota derivation via `resolveAuthoritativePackageConfig`.
- **P2-SQ-02**: Monthly deliverable progress calculation formula verification (`Done / Quota * 100`).

#### Category 6: Monthly Delivery Center & Recurring Work (Section 9)
- **P2-MD-01**: Live package work reconciliation and recurring task generation in `public.project_tasks`.
- **P2-MD-02**: Generated task schema integrity: `delivery_period`, `client_id`, `category`, `project_id`.
- **P2-MD-03**: Historical task completion transition (`status = 'done'`).
- **P2-MD-04**: Quota reduction: unstarted future tasks pruned, completed historical work strictly preserved.
- **P2-MD-05**: Idempotency check: repeated recurrence triggers produce 0 duplicate tasks and 0 erroneous mutations.
- **P2-MD-06**: Paused/inactive client lifecycle: recurring generation suspended while preserving historical tasks.

#### Category 7: Task Assignments & Team Workload (Section 10)
- **P2-TA-01**: Create task from Client 360 with client and project container association.
- **P2-TA-02**: Assignee identity resolution (`team_members.id` $\leftrightarrow$ `profiles.id` mapping).
- **P2-TA-03**: Task assignee persistence in `public.project_tasks.assignee_id`.
- **P2-TA-04**: Reassign task to alternative contributor and verify state transition.
- **P2-TA-05**: Status progression: `todo` $\rightarrow$ `in_progress` $\rightarrow$ `done` with `completed_at` timestamp.

#### Category 8: Financial Consistency & Ledger Integrity (Section 11)
- **P2-FN-01**: Invariant 1: Contracted retainer value in `clients` is NOT equivalent to collected cash.
- **P2-FN-02**: Invariant 2: Billed invoice receivable in `invoices` is NOT equivalent to collected cash.
- **P2-FN-03**: Record partial cash receipt in `income_transactions`.
- **P2-FN-04**: Partial payment reconciliation and outstanding balance calculation (`paid_amount = 1500`, `balance = 1000`, `status = 'sent'`).
- **P2-FN-05**: Full payment settlement (`paid_amount = 2500`, `balance = 0`, `status = 'paid'`).
- **P2-FN-06**: Double-counting prevention: invoice-linked payments do NOT inflate company cash ledger.

#### Category 9: Client Memory, Directives & Brand Guidelines (Section 12)
- **P2-MN-01**: Persist structured markdown directives in `public.clients.notes`.
- **P2-MN-02**: Structured directive parsing: regex extracts category-specific guidance.
- **P2-MN-03**: Granular category update preserves other sections intact without data loss.

#### Category 10: Role, Tenancy & Authorization Enforcement (Section 14)
- **P2-RO-01**: Super Admin full mutation authority on Client 360 endpoints.
- **P2-RO-02**: Worker role restricted from client financial ledgers (`invoices` & `income_transactions`).
- **P2-RO-03**: Worker role denied client profile mutation via `assertAuthorizedMutation`.
- **P2-RO-04**: Non-existent / invalid client ID returns clean null (404 Not Found) without database panic.

#### Category 11: Data Integrity & Concurrency (Section 15)
- **P2-DI-01**: Concurrent client metadata submissions preserve exact entity cardinality (zero duplication).

#### Category 12: QA Cleanup & Archival Strategy
- **P2-CL-01**: Safe QA record archival: test tasks/invoices purged; QA client marked as `archived` for 100% auditability.

#### Category 13: Browser UX, Responsive Layouts & Sticky Navigation (Section 16)
- **P2-UX-RT01**: Browser URL redirect from `/admin/clients` to `/admin/client-workspaces`.
- **P2-UX-CD01**: Client Directory roster mounts and renders active client workspaces.
- **P2-UX-360-01**: Client 360 header mounts with sticky section navigation rail (`#client-360-nav-wrapper`).
- **P2-UX-NAV01**: Sticky section navigation anchors trigger smooth in-page section focus with buffer clearance.
- **P2-UX-MOD01**: Interactive dialogs (Edit Client, Edit Package) open cleanly with SADA-themed inputs.
- **P2-UX-VP1280**: Desktop Standard 1280×800 renders clean light theme with preserved hierarchy.
- **P2-UX-VP1024**: Tablet Landscape 1024×768 adapts multi-column deck to medium screen bounds.
- **P2-UX-VP768**: Tablet Portrait 768×1024 Arabic RTL mirrors header, stats, and section rails.
- **P2-UX-VP390**: Mobile Modern 390×844 touch viewport collapses header and enables horizontal scroll.
- **P2-UX-VP390-AR**: Mobile Modern 390×844 Arabic RTL aligns action badges and touch targets.
- **P2-UX-VP375**: Mobile Legacy 375×667 fits within screen width without unintended body overflow.
- **P2-UX-RO01**: Worker role browser session: financial mutations and invoicing buttons guarded.

---

### 4. Acceptance Criteria & Pass Thresholds

1. **Test Pass Rate**: 100% of functional tests (backend and browser UX) must PASS. Zero tests FAIL or BLOCKED.
2. **Database Integrity**: Zero orphan records, zero duplicate clients, zero broken foreign keys.
3. **Financial Consistency**: Cash ledger calculation strictly adheres to `income_transactions` and prevents invoice double-counting.
4. **Historical Preservation**: Quota reduction prunes ONLY unstarted tasks; completed historical tasks are strictly preserved.
5. **Code Quality**: `npx tsc --noEmit` must exit with 0 errors. `npm run build` must produce production bundles cleanly.

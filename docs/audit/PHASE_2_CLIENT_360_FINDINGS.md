# SADA OS — Phase 2: Client 360 Functional Audit Findings
## Defects Identified, Root Cause Diagnoses, and Engine Hardening

---

### 1. Executive Summary & Defect Log

During Phase 2 execution, five significant technical hurdles and PostgreSQL schema constraints were uncovered and authoritatively remediated in `src/lib/package-reconciliation-service.ts` and the test suites. Every finding was resolved without modifying real production client data and without introducing architectural duplication:

| Finding ID | Severity | Affected Area | Core Issue | Status |
|---|---|---|---|---|
| **F-P2-01** | **P1 (High)** | `public.client_deliverables` | PostgreSQL Generated Stored Column Violation on `remaining_quantity` | **RESOLVED** |
| **F-P2-02** | **P1 (High)** | `public.client_deliverables` | Check Constraint Violation on `deliverable_type` (`client_deliverables_deliverable_type_check`) | **RESOLVED** |
| **F-P2-03** | **P1 (High)** | `public.project_tasks` | Foreign Key and Not-Null Violation on `project_id` during task reconciliation | **RESOLVED** |
| **F-P2-04** | **P2 (Medium)** | `public.income_transactions` | Check Constraint Violation on `category` (`income_transactions_category_check`) | **RESOLVED** |
| **F-P2-05** | **P2 (Medium)** | Lifecycle Engine | Inactive/Paused client recurring generation suspension guard | **RESOLVED** |

---

### 2. Deep-Dive Defect Analysis & Hardening

#### Finding F-P2-01: Generated Stored Column Violation on `client_deliverables.remaining_quantity`
- **Root Cause**: The PostgreSQL table `public.client_deliverables` defines `remaining_quantity` as:
  ```sql
  remaining_quantity INTEGER GENERATED ALWAYS AS (
      GREATEST(0, target_quantity - done_quantity)
  ) STORED
  ```
  In PostgreSQL, attempting to supply any non-default value in an `INSERT` or `UPDATE` statement targeting a `GENERATED ALWAYS AS ... STORED` column triggers database error:
  `cannot insert a non-DEFAULT value into column "remaining_quantity"`
  The legacy reconciliation code included `remaining_quantity: remainingQty` in both its insert and update payloads, causing deliverable creation to fail silently and cascading into task foreign key errors (`project_tasks_deliverable_id_fkey`).
- **Remediation**:
  In `src/lib/package-reconciliation-service.ts`, removed `remaining_quantity` from both `insert()` and `update()` payloads, delegating the calculation entirely to the PostgreSQL storage engine.

#### Finding F-P2-02: Check Constraint Violation on `client_deliverables.deliverable_type`
- **Root Cause**: The migration `20260929120000_sales_pipeline_package_and_production.sql` enforces:
  ```sql
  CHECK (deliverable_type IN ('reel', 'post', 'story', 'ads_campaign', 'video', 'branding', 'other'))
  ```
  The scheduling engine was passing service names like `"reels_shooting"`, `"posts"`, and `"stories"`. When passed to `client_deliverables.insert()`, Postgres rejected the record with error:
  `violates check constraint "client_deliverables_deliverable_type_check"`
- **Remediation**:
  Implemented an authoritative mapping helper in `src/lib/package-reconciliation-service.ts`:
  ```ts
  const mappedDeliverableType = dType.includes("reel")
    ? "reel"
    : dType.includes("post")
    ? "post"
    : dType.includes("stor")
    ? "story"
    : dType.includes("ad")
    ? "ads_campaign"
    : dType.includes("video")
    ? "video"
    : dType.includes("brand")
    ? "branding"
    : "other";
  ```

#### Finding F-P2-03: `project_tasks.project_id` NOT NULL Constraint
- **Root Cause**: `public.project_tasks` requires every operational task to belong to a `client_projects` workspace container (`project_id NOT NULL`). If a client entity was created without an associated workspace container, `reconcileClientPackageWork` attempted to insert tasks with `project_id: null`, causing constraint violation:
  `null value in column "project_id" of relation "project_tasks" violates not-null constraint`
- **Remediation**:
  Hardened `src/lib/package-reconciliation-service.ts` to automatically detect if `operationalProject` is missing for the target client and automatically instantiate a primary workspace container (`client_projects`) before proceeding with deliverable and task generation.

#### Finding F-P2-04: Check Constraint on `income_transactions.category`
- **Root Cause**: `public.income_transactions` defines:
  ```sql
  CHECK (category IN ('Client Payment', 'Project Payment', 'Retainer', 'Product Revenue', 'Other'))
  ```
  Passing lowercase values or unmapped categories (e.g. `'marketing_services'`) triggered:
  `violates check constraint "income_transactions_category_check"`
- **Remediation**:
  Aligned all financial transaction mutations with the canonical enum `'Client Payment'` and payment method `'Bank Transfer'`.

#### Finding F-P2-05: Lifecycle Guard for Inactive / Paused Clients
- **Root Cause**: When a client's status is set to `'inactive'`, `'paused'`, or `'archived'`, recurring monthly service reconciliation must not generate new contractual tasks for future periods, while strictly preserving past completed and in-flight work.
- **Remediation**:
  Added an explicit lifecycle check at the entry of `reconcileClientPackageWork`:
  ```ts
  const clientStatusStr = (client?.status as string) || "";
  const isClientPausedOrInactive = clientStatusStr === "inactive" || clientStatusStr === "paused" || clientStatusStr === "archived";
  if (isClientPausedOrInactive) {
    return {
      ...report,
      success: true,
      total_tasks_created: 0,
      total_tasks_pruned: 0,
      total_history_preserved: 0,
      mutations: [],
    };
  }
  ```

---

### 3. Residual Risk & Architectural Observations

1. **Dual Package Schema Coexistence**:
   - `public.package_catalog` is the canonical master catalog for all active pricing and client packages.
   - `public.packages` is the legacy 37-row catalog.
   - Foreign key `client_deliverables_package_id_fkey` historically pointed to `packages(id)`. By passing `package_id: null` on `client_deliverables` or ensuring catalog migration, foreign key conflicts are completely prevented.
2. **PostgreSQL Check Constraints as Protective Shields**:
   - The strict check constraints on `status` (`invoices_status_check`, `client_projects_status_check`, `income_transactions_category_check`) successfully prevent invalid or rogue data from polluting the database.

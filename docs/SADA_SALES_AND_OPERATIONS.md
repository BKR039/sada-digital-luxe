# SADA OS — Sales Pipeline, Package Engine & Production Operations (Phase 3 & 4)

This document specifies the canonical architecture, database schemas, financial formulas, and execution workflows for SADA OS Phase 3 (Sales Pipeline & Package Engine) and Phase 4 (Delivery, Task & Production Engine).

---

## 1. Phase 3: Sales Pipeline & Deal Lifecycle

### 1.1 Canonical Pipeline Stages
Deals progress strictly through eight stages:
1. `lead`: Newly ingested prospect.
2. `contacted`: Initial outreach completed.
3. `qualified`: Needs, budget, and business suitability verified.
4. `meeting`: Discovery or presentation meeting held.
5. `proposal`: Tailored package proposal delivered.
6. `negotiation`: Agreement terms and scope finalized.
7. `won`: Contract closed; triggers the canonical Deal → Won transition engine.
8. `lost`: Unsuccessful deal (records `lost_reason`).

### 1.2 Interactive UI (`/admin/sales`)
- **Single Canonical Route**: `/admin/sales` is the single canonical home for Sales Pipeline and Commissions. Routes `/admin/deals` and `/admin/commissions` permanently redirect here.
- **SADA Design System Enforcement**: 100% SADA UI components (`SADASelect`, `SADADatePicker`, `SADAButton`, `SADASearch`, `SADACard`, `SADABadge`, `<SADANumber>`). Zero native browser HTML `<select>`, `<input type="date">`, or raw buttons.
- **Unified Tabs**: "My Leads & Pipeline" and "My Commissions" integrated as tabbed sections of the same workspace.
- **Kanban View**: 8-stage drag-and-drop or click-to-advance board with stage counts, total value headers, and SADA badges.
- **Table View**: Sortable list with Deal Title, Company, Stage, Package, Service Revenue, Sponsoring Budget, Total Deal Value, Sales Owner, and Actions.
- **Metrics Strip**: Total Pipeline Value, Active Leads, Won Sales, Pending & Paid Commissions.
- **Create Lead Modal**: Standardized dialog using SADA form controls (packages via `SADASelect`, close date via `SADADatePicker`, amount via `SADAInput`).
- **Convert to Sale Modal**: Converts won lead with automated commission calculation excluding sponsoring budget.

### 1.3 Production Drag & Drop Pipeline Interaction
- **Canonical Architecture**:
  - Dragging a card across Kanban columns triggers an immediate optimistic UI repositioning followed by an authorized database mutation via `updateLeadStage` / `updateDealStage` in `src/lib/sales-service.ts`.
  - Database table `public.deals` column `stage` is the authoritative source of truth.
  - Moving away from stage `won` automatically resets `won_date = null`.
- **Authoritative Authorization & RLS Boundary**:
  - Client-side pre-check via `canPerformModuleAction("sales", "edit", role)` provides immediate UI feedback and fast-fail UX.
  - The authoritative boundary is enforced at the PostgreSQL database level via Row Level Security (RLS) on `public.deals` (`Staff update authorized deals` policy: `public.is_admin(auth.uid()) OR sales_owner_id = auth.uid()`).
  - Client-supplied `actorRole` / `actorCtx` is never trusted by PostgreSQL; PostgreSQL verifies the cryptographic JWT session identity (`auth.uid()`). Real negative database tests verify that unauthorized direct mutations and role spoofing attempts are blocked at the database boundary (0 rows updated).
- **Database-Level Optimistic Concurrency Control (OCC)**:
  - Database mutations in `updateLeadStage` condition SQL updates on the expected prior stage (`WHERE id = $1 AND stage = $2`), preventing concurrent writes from silently overwriting each other with stale state.
  - In a race scenario (e.g., Request A: Lead → Contacted vs. Request B: Lead → Qualified), PostgreSQL row locking ensures exactly one mutation succeeds; the losing transaction matches 0 rows and returns an explicit conflict error (`Conflict: Deal stage was concurrently modified`).
  - Out-of-order mutations with mismatched `fromStage` are rejected, guaranteeing canonical state preservation.
- **Optimistic UI & Resilient Rollback**:
  - On drag release, the deal card moves optimistically into the destination column.
  - If the database mutation fails or is rejected, the deal card immediately rolls back to its exact pre-drag stage, column counts and monetary totals revert, and a user-friendly SADA error toast is displayed.
- **Derived Realtime Kanban Metrics**:
  - Column counts and monetary values (`columnTotals`) are derived deterministically from the canonical deal collection.
  - Updating a deal's stage immediately reflects in both the source and target column counts and financial totals without full page refreshes.
- **Accidental Conversion & Click Protection**:
  - Dragging directly into `won` opens the explicit "Convert to Sale" modal (`setConvertingDeal`) rather than performing a silent background conversion.
  - Drag threshold timer (`dragStartTimestampRef`) and `wasDraggedRef` ensure that releasing a drag never accidentally triggers the deal detail/edit inspection modal.
- **Mobile & Accessible Alternative**:
  - Every deal card features an accessible "Move to Stage" dropdown menu (`DropdownMenu` / `DropdownMenuItem`) that shares the exact same `executeStageTransition` and `updateLeadStage` canonical mutation pipeline.
- **Audit Logging & Telemetry (Best-Effort Invariant)**:
  - Stage transitions are recorded in `public.system_audit_logs` with `entity_type: 'deal'`, previous stage, new stage, and actor metadata.
  - In accordance with SADA OS architecture, audit logging is intentionally designed as non-fatal best-effort telemetry; failures in secondary audit logging do not roll back or corrupt successful primary deal mutations.
  - In-flight mutation locking (`isMutatingStageMap`) and duplicate drop idempotency checks provide defense-in-depth on the client side.

### 1.4 Phase H: Sales Granular Access Control
The Sales domain implements a 6-tier granular action capability model:
1. `sales.view`:
   - Controls real route access to `/admin/sales` and gating on `fetchDeals`.
   - Callers lacking this permission receive `<ModuleAccessShield module="sales" />` and service query denial.
2. `sales.create_lead`:
   - Controls lead and deal creation via `createDeal`.
   - Forces `sales_owner_id` to authoritative caller identity for workers, preventing worker owner spoofing.
3. `sales.edit_lead`:
   - Controls deal title, company, revenue, and definition editing via `updateDeal`.
   - Workers can only edit deals they own; attempting to edit another worker's deal is blocked by worker data scope isolation.
4. `sales.change_stage`:
   - Controls drag-and-drop and dropdown stage transitions via `updateLeadStage`.
   - Preserves atomic database-level Optimistic Concurrency Control (OCC) (`WHERE id = $1 AND stage = $2`) and optimistic rollback on rejection.
5. `sales.convert_lead`:
   - Controls deal-to-won conversion via `convertLeadToSale` and PostgreSQL RPC `convert_lead_to_sale`.
   - Enforces `public.has_permission(v_user_id, 'sales.convert_lead')` and worker ownership checks in database RPC.
   - Generates historical commission snapshot in `commission_rule_snapshot`.
6. `sales.delete_lead`:
   - Permanently deletes deals via `deleteDeal`.
   - Strictly Super Admin exclusive across UI, service layer (`assertAuthorizedMutation`), PostgreSQL RLS, and trigger `trg_guard_deals_action_permissions`.

---

## 2. Canonical Package Catalog & Pricing System (Phase 10)

### 2.1 Single Source of Truth Architecture
The Package Catalog system (`package_catalog`, `package_categories`, `package_addons`) provides a unified, canonical data layer feeding:
1. **Public Pricing Page (`/pricing`)**: 100% database-driven, 4-cards-per-row desktop layout, grouped by category, badges, included/excluded feature lists, add-ons catalog, and bilingual RTL support.
2. **Admin CMS (`/admin/packages`)**: Centralized package management, live public card preview, drag-and-drop feature builder, duplicate package action, and granular lifecycle controls (`draft`, `published`, `hidden`, `archived`).
3. **Deals Pipeline & Client CRM (`/admin/deals`, `/admin/clients`, `/admin/clients/$id`)**: Direct canonical foreign key bindings (`deals.package_id`, `clients.package_id`, `client_deliverables.package_id`, `project_tasks.package_id`, `production_bookings.package_id -> package_catalog.id`).
4. **Financial OS & Profitability Analytics**: Feeds selling prices, direct cost allocations, and margins deterministically without duplicating financial logic.

### 2.2 Canonical Schemas
- `public.package_categories`: `id`, `slug`, `name`, `name_ar`, `description`, `description_ar`, `display_order`, `is_active`.
- `public.package_catalog`: `id`, `code` (e.g. `MG-01`), `name`, `name_ar`, `slug`, `description`, `category_id`, `category_name`, `package_type`, `billing_type`, `price`, `currency`, `is_active`, `is_published`, `is_featured`, `badge`, `priority`, `display_order`, `short_description`, `included_items` (JSONB array with text/icon/order), `excluded_items` (JSONB array with text/icon/order), `monthly_reels`, `monthly_posts`, `monthly_stories`, `production_hours`, `production_sessions`, `platforms`, `employee_cost`, `freelancer_cost`, `transport_cost`, `subscription_allocation`, `commission`, `direct_costs`, `gross_profit`, `gross_margin`.
- `public.package_addons`: `id`, `code`, `name`, `name_ar`, `price`, `unit`, `percentage_modifier`, `category`, `description`, `is_active`, `display_order`.

### 2.3 Master Package Catalog Seed (24 Canonical Packages & 12 Add-ons)
1. **Social Media Management**: MG-01 Starter (699 TND), MG-02 Growth (1,090 TND), MG-03 Growth+ (1,290 TND), MG-04 Scale (1,590 TND).
2. **Content Production & Shooting**: PR-01 Content Session 4h (550 TND), PR-02 Content Session Pro 4h (750 TND), PR-03 Long Production Day 6h (900 TND), PR-04 Full Production Day 8h (1,200 TND).
3. **Story Production**: ST-01 Story Batch (350 TND), ST-02 Story Visits (600 TND/mo), ST-03 Story Plus (800 TND/mo), ST-04 Daily Story (1,000 TND/mo), ST-05 Daily Story Pro (1,300 TND/mo).
4. **Paid Ads Management**: AD-01 Ads Basic (250 TND/mo), AD-02 Ads Pro (400 TND/mo).
5. **Websites & Digital Systems**: WEB-01 Landing Page (700 TND), WEB-02 Business Website (1,500 TND), WEB-03 Business System (2,500 TND+).
6. **Strategy**: STG-01 Content Strategy (300 TND), STG-02 Marketing Strategy (500 TND).
7. **Monthly Combined Packages**: HY-01 Growth Produce (1,490 TND/mo), HY-02 Growth+ Produce (1,790 TND/mo), HY-03 Scale Produce (2,190 TND/mo), HY-04 Premium (2,490 TND/mo), HY-05 Premium Plus (2,890 TND/mo).
8. **Custom Package**: CUS-01 Build Your Package (Custom Pricing).
9. **Add-ons & Extras**: 12 canonical units (Extra Reel Editing 80 TND, Extra Reel Full Production 150 TND, Extra Post 35 TND, Extra Carousel 50 TND, Extra Story Batch 100 TND, Extra Shooting Hour 100 TND, Extra Production Hour 120 TND, Extra Story Visit 80 TND, Extra Photography Session 250 TND, Express 48h +20%, Express 24h +40%, Extra Website Hour 80 TND).

### 2.4 Mathematical Profitability Formulas & Invariants
- **Zero Manual Profit Entry**: Gross Profit and Gross Margin are computed deterministically via canonical formulas:
  $$\text{Direct Costs} = \text{employee\_cost} + \text{freelancer\_cost} + \text{transport\_cost} + \text{subscription\_allocation} + \text{commission}$$
  $$\text{Gross Profit} = \text{price} - \text{direct\_costs}$$
  $$\text{Gross Margin (\%)} = \left(\frac{\text{Gross Profit}}{\text{price}}\right) \times 100$$
- **Historical Price Snapshot Rule**: When a package price is updated in `package_catalog`, historical contracts, client records, and invoices remain 100% immutable at the agreed selling price snapshot.
- **Referenced Package Delete Protection**: PostgreSQL trigger `prevent_referenced_package_deletion()` blocks physical deletion of any package referenced by clients, deals, deliverables, or bookings. Archiving (`is_active = false`) is strictly enforced instead.
- **Sponsoring Budget Separation**: Media spend/ad budget is accounted strictly separately from agency service revenue and excluded from sales commission calculations.

---

## 3. Canonical Deal → Won Transition Engine (`winDeal`)

When a deal transitions to `won`, the system executes an atomic orchestration:
1. **Client Creation / Linking**:
   - Resolves or creates a record in `public.clients`.
   - Links `client.package_id = package.id`.
   - Updates `client.status = 'active'`, `monthly_package_price`, and `package_config`.
   - Sets `deal.client_id = client.id`.
2. **Recurring Agreement Contract**:
   - Compiles terms, billing start date, monthly retainer value, and deliverable commitments in `deals.contract_agreement`.
3. **Financial OS Revenue Configuration**:
   - Creates a pending invoice in `public.invoices`.
   - `total_amount = service_revenue + sponsoring_budget`.
   - Itemizes Service Retainer vs. Ad Sponsoring Budget.
4. **Sales Commission Configuration**:
   - Connects to `public.sales_commissions`.
   - **Rule 1**: Commission applies strictly to eligible **Service Revenue**.
   - **Rule 2**: Sponsoring / ad budget is **strictly excluded** from commission base.
   - **Rule 3**: Unpaid revenue holds commission in `status = 'pending'` (ineligible for payout).
   - **Rule 4**: Invoice settlement transitions commission to `status = 'approved'` (eligible for payout).
   - **Rule 5**: Refunds or cancellations mark commission `status = 'cancelled'` (0 payout).
5. **Operational Deliverables Generation**:
   - Instantiates `client_deliverables` according to package quota.
6. **Delivery Workspace & Task Provisioning**:
   - Creates `client_projects` operational workspace.
   - Generates initial production milestone tasks in `project_tasks`.

---

## 4. Phase 4: Delivery, Task & Production Engine

### 4.1 Client Deliverables Management
Tracked in `public.client_deliverables`:
- `target_quantity`: Deliverable quota (e.g. 8 Reels, 8 Posts, 20 Stories, 4 Ads).
- `done_quantity`: Completed items.
- `remaining_quantity`: Generated column `(target_quantity - done_quantity)`.
- `assigned_team`: Array of responsible team members.
- `deadline`: Period commitment deadline.
- `status`: `planned` | `in_progress` | `completed`.

### 4.2 Single Source of Truth & Package/Work Reconciliation Engine (Phase 4 & 4.1 Hardened)

#### 4.2.1 Canonical Quantity Ownership & SSOT Hierarchy
The package and deliverable system guarantees absolute consistency across catalog definitions, client contracts, active operational quotas, and calendar task projections. Data flows deterministically downward through an explicit ownership hierarchy:

$$\begin{aligned}
\text{Package Catalog } (package\_catalog) &\longrightarrow \text{Default baseline package template definitions} \\
\downarrow & \\
\text{Client Contract Overrides } (clients.package\_config) &\longrightarrow \text{Client-specific overrides for custom retainers} \\
\downarrow & \\
\text{Deliverables Ledger } (client\_deliverables) &\longrightarrow \text{Canonical active-period entitlement / quota targets} \\
\downarrow & \\
\text{Service Commitments } (service\_commitments) &\longrightarrow \text{Operational distribution, recurrence rules, shoot days} \\
\downarrow & \\
\text{Operational Tasks } (project\_tasks) &\longrightarrow \text{Execution items projected onto Calendar \& Execution Center}
\end{aligned}$$

- **Ownership Invariants**:
  1. `client_deliverables.target_quantity` owns the authoritative deliverable entitlement for the active billing cycle.
  2. `service_commitments` operationalizes delivery rules (frequency, weekdays, days of month) and **must never compete with or override deliverable entitlement**.
  3. `project_tasks` are downstream execution instances and **must never be treated as package quota or source of truth for entitlement**.
- **Retirement of Magic Numbers**: Legacy hardcoded defaults (e.g., `|| 5`, `|| 4`, `|| 10`) are completely retired. Missing configurations resolve strictly to `0` unless explicitly defined in `package_catalog` or `clients.package_config`.
- **SSOT Resolution Chain**: `resolveAuthoritativePackageConfig()` evaluates:
  1. `client.package_config` custom overrides (highest priority).
  2. `package_catalog` defaults by `client.package_id`.
  3. Strict `0` fallback for unconfigured deliverables.

#### 4.2.2 Work Provenance & Manual Protection Model (Phase 4.1)
To ensure automated reconciliation never overwrites human decisions or silently destroys manually scheduled work, `public.project_tasks` tracks explicit provenance:

- **Provenance Schema**:
  - `source_type`: `'manual' | 'recurring_schedule' | 'package_reconciliation' | 'workflow'` (defaults to `'manual'`).
  - `is_reconciliation_managed`: `BOOLEAN DEFAULT false` (set to `true` exclusively for system-generated recurring/reconciliation tasks).
  - `manual_override`: `BOOLEAN DEFAULT false` (set to `true` whenever an admin or worker manually edits the schedule date, assignee, or priority of a generated task).
  - `cancelled_reason`: `TEXT` (records the rationale when a task is cancelled during quota reduction).
- **Manual Task Protection Invariant**:
  - Tasks created manually (`source_type === 'manual'` or `is_reconciliation_managed === false`) are strictly immune to automated reconciliation cancellation, pruning, or rescheduling.
  - Tasks with `manual_override === true` are strictly immune to automated reconciliation.
  - Ambiguous provenance (e.g. legacy tasks lacking explicit flags) defaults strictly to **PRESERVED** (`isTaskReconciliationControlled === false`).
- **Mutable vs Immutable Work**:
  A task is eligible for automatic cancellation or rescheduling IF AND ONLY IF:
  $$\text{Eligible} = (\text{is\_reconciliation\_managed} \land \neg\text{manual\_override} \land \text{source\_type} \ne \text{'manual'} \land \text{status} = \text{'todo'})$$

#### 4.2.3 Non-Destructive Reconciliation Engine
When a client's package configuration, deliverable quota, or recurring commitment schedule is modified, the canonical reconciliation engine (`reconcileClientPackageWork()` and `reconcileSingleCommitmentWork()` in `src/lib/package-reconciliation-service.ts`) synchronizes future operational tasks while preserving historical and manual integrity:

1. **Unified Pure Diff Engine (`calculateReconciliationDiff`)**:
   - Both the live UI preview (`previewPackageReconciliation`) and the actual mutation engine (`reconcileClientPackageWork`) share the exact same pure diff calculation, ensuring 100% mathematical parity between what the user previews and what is executed.
2. **Quota Increase ($\text{desired} > \text{existing}$)**:
   - Preserves all existing completed, in-progress, manual, and pending tasks intact.
   - Calculates missing tasks: $\Delta = \text{desired} - \text{existing}$.
   - Deterministically schedules and inserts only the $\Delta$ missing tasks using composite idempotency keys (`commit_${commitment.id}_${targetDate}_seq${seq}`), tagging each with `source_type: 'recurring_schedule'` and `is_reconciliation_managed: true`.
3. **Safe Quota Decrease ($\text{desired} < \text{existing}$)**:
   - **Zero Destructive Deletion of Historical Work**: Tasks marked `done`, `delivered`, or `approved` represent immutable historical business records and are **never deleted or modified**.
   - Tasks marked `in_progress`, `review`, or `blocked` represent active commitments and are **never cancelled**.
   - Calculates allowed future unstarted tasks: $\text{allowed\_future} = \max(0, \text{desired} - \text{completed} - \text{active} - \text{manual\_preserved})$.
   - Cancels only excess unstarted, un-overridden, reconciliation-managed tasks (`status === 'todo'`), stamping `cancelled_reason: 'Quota reduced during package reconciliation'`.
4. **Schedule / Frequency Rule Adjustment** (e.g., recurring days change from $[5, 20]$ to $[10, 25]$):
   - Historical completed tasks remain fixed on their original historical delivery dates.
   - Manually overridden tasks (`manual_override === true`) remain fixed on their custom dates.
   - Only unstarted, untouched, reconciliation-managed tasks are rescheduled to match the newly configured recurring schedule dates without creating duplicates.
5. **Concurrency & Race Safety**:
   - Atomic upsert and idempotency key checks prevent race conditions or duplicate task creation if multiple reconciliations trigger concurrently.
6. **Strict Idempotency Guarantee**:
   - Re-running reconciliation multiple times with identical settings produces zero additional tasks, zero duplicate tasks, and zero extra cancellations.

#### 4.2.4 Audit Logging & System Traceability
Every mutation to package configuration, deliverable target quantities, or recurring commitment rules is durably recorded:
- `public.reconciliation_audit_logs`: Dedicated audit table recording structured mutations (`tasks_created`, `tasks_pruned`, `tasks_rescheduled`, `manual_tasks_preserved`, `historical_tasks_preserved`). Idempotent runs write 0 log entries to prevent log bloat.
- `public.account_audit_logs`: Records client-level administrative events with previous vs. new configuration snapshots.
- `public.system_audit_logs`: Records detailed operational logs with the exact breakdown of created tasks, cancelled tasks, rescheduled tasks, and affected deliverable types.

#### 4.2.5 Calendar & Execution Projection Invariant
- The SADA Calendar and Task Execution surfaces are direct projections of `project_tasks`. There is no secondary events table.
- When `reconcileClientPackageWork()` completes, the Calendar immediately displays the reconciled future tasks, maintaining perfect alignment between client contracts and daily operations.

### 4.3 Comprehensive Task Schema & Workflow
`public.project_tasks` schema:
- `client_id`: Link to `clients`.
- `package_id`: Link to `packages`.
- `deliverable_id`: Link to `client_deliverables`.
- `assignee_id`: Responsible specialist (`profiles.id`).
- `reviewer_id`: Quality reviewer (`team_members.id`).
- `deadline`: Delivery commitment (`date`).
- `priority`: `low` | `medium` | `high` | `urgent`.
- `estimated_hours` & `actual_hours`: Used to calculate actual package profitability.
- `attachments`: Links to brief, assets, or Figma/Drive folders.
- `notes`: Operational guidance.
- `revision_count`: Tracks client and internal review cycles.

#### Canonical Task Workflow
$$\text{TO DO} \longrightarrow \text{IN PROGRESS} \longrightarrow \text{REVIEW} \longrightarrow \text{REVISION} \longrightarrow \text{APPROVED} \longrightarrow \text{DELIVERED}$$

- Database trigger `handle_project_task_completed_at()` automatically records `completed_at = NOW()` when entering terminal statuses (`done`, `delivered`, `approved`), and resets to `NULL` upon regression.

#### Configurable Task Workflow Engine (Phase 1)
Deliverable tasks map to **Task Types** governed by **Workflow Templates** composed of ordered, typed stages:
$$\text{Task Type} \longrightarrow \text{Workflow Template} \longrightarrow \text{Ordered Stages} \longrightarrow \text{Parent Task} \longrightarrow \text{Stage Subtasks}$$

1. **Non-Hardcoded Dynamic Stage Architecture**:
   - Templates define an arbitrary sequence of stages (e.g., Reel Production: 1. Script $\to$ 2. Shooting $\to$ 3. Editing $\to$ 4. Publishing; Graphic Design: 1. Creative Brief $\to$ 2. Design $\to$ 3. Publishing; Paid Ads: 1. Strategy $\to$ 2. Creatives $\to$ 3. Ad Setup $\to$ 4. Optimization).
   - Super Admins can add, edit, remove, reorder, and activate/deactivate templates and stages via `/admin/workflow-templates`.
2. **Prerequisite Dependency Locks**:
   - Stage $N$ is locked from starting (`is_locked = true`) until all prerequisite stages ($< N$) are marked `done`, `approved`, or `delivered`.
   - Locked stages cannot be started in `TaskDetailModal`, cannot be started in `admin.my-work.tsx`, and are filtered out from the "NEXT UP" recommended action scoring engine in `computeNextTask`.
3. **Deterministic Stage Auto-Instantiation & Worker Resolution**:
   - Creating a task with an attached template in `TaskModal.tsx` auto-instantiates individual stage subtask rows in `public.project_tasks` with `parent_task_id = parentTask.id`.
   - Stage deadlines are calculated based on `duration_days` from the start date or clamped to parent deadline.
   - Per-stage worker assignees are either matched to specialist roles (`copywriter`, `videographer`, `editor`, `designer`, `media_buyer`) or configured manually.
4. **Permanent Historical Durability**:
   - Historical stage records embed metadata tags in `notes` (`[WORKFLOW_STAGE:...]`) ensuring that editing or removing templates later never breaks or alters past deliverable records.

### 4.4 Task Experience Redesign & Subtask Assignment Hierarchy
SADA OS provides a unified, 3-second comprehension task management architecture built on SADA UI primitives (`SADAButton`, `SADAInput`, `SADABadge`, `SADACheckbox`, `SADADatePicker`, `SADASelect`, `SADASwitch`, `SADACounter`).

#### 1. Task Preview / Detail Modal (`TaskDetailModal.tsx`)
- **Visual Hierarchy & Header**: Distinct `MAIN TASK` vs `SUBTASK` badges with quick access to parent deliverable context.
- **6-Item KPI Snapshot**: Status, Priority, Deadline, Execution Owner (avatar + name), Progress percentage, and Subtasks count.
- **First-Class Ownership Cards**:
  - *Assigned To (Execution Owner)*: Prominently identifies the team member accountable for task completion.
  - *Assigned By (Delegated By)*: Tracks delegation authority and accountability.
- **Workflow Stepper**: Preserves ordered stage progression for workflow-instantiated deliverables.
- **Subtask Deliverables Table**:
  - Independent status checkbox (`SADACheckbox`) with isolated click event handlers (no event bubbling into row inspection).
  - Title, status pill, deadline, and locked prerequisite badge.
  - 1-Click Inline Reassignment Popover (`SubtaskAssigneePopover`): Authorized admins can reassign any subtask in 1 click without leaving the detail modal.
  - Quick Add Subtask form: Automatically defaults new subtask assignee to the Main Task owner.

#### 2. Task Edit Modal (`TaskModal.tsx`) — 7-Section Structure
Organized into 7 logical operational sections:
1. **Section 1: What is it?**: Title (`SADAInput`), Description (`textarea`).
2. **Section 2: Who owns it?**: Subtask parent banner, `MemberPicker` for Assigned To (propagates default to workflow stages), `MemberPicker` for Assigned By, Handoff Reason, and Reassignment History.
3. **Section 3: When is it due?**: Deadline (`SADADatePicker` with quick pills: Today, Tomorrow, +3d, +1w), Start & End dates (`SADADateDateTimePicker`), and Deadline Alert Configuration (`SADASwitch`, `SADASelect`).
4. **Section 4: Execution & Priority**: Priority segmented selector, Status picker, Phase/Category picker, Service deliverable picker, Blocker/Postpone reasons, "Done Looks Like / Deliverables" card with add/remove links, Effort counters (`SADACounter`), and Internal Notes.
5. **Section 5: Workflow**: Workflow template picker, stage timeline preview with stage-level assignee overrides defaulting to Main Task owner.
6. **Section 6: Relationship & Subtasks**: Subtask count and preview list of subtasks (title, status, assignee avatar/name) for main tasks; Parent deliverable reference card for subtasks.
7. **Section 7: Save & Actions**: Sticky footer with `SADAButton` primary save, `SADAButton` outline cancel, and `SADAButton` destructive delete for Super Admins.

#### 3. Subtask Assignment & Default Inheritance Invariant
- **Independent Database Identity**: Each subtask stores its own canonical `assignee_id` and `previous_assignee_id` in `public.project_tasks`. There is no synthetic inheritance table.
- **Default Initialization, NOT Live Synchronization**:
  - When a subtask is created (manually or via workflow instantiation), its initial `assignee_id` defaults to the Main Task's `assignee_id`.
  - Reassigning a subtask alters only that subtask's `assignee_id`.
  - Reassigning the Main Task later does **NOT** alter existing subtasks.
  - Subsequent newly created subtasks inherit the updated Main Task assignee.
- **Calendar & My Work Routing**: Calendar (`/admin/calendar`) and My Work queue (`/admin/my-work`) query `project_tasks.assignee_id` directly, ensuring deliverables and subtasks route to their specific assigned worker.
- **Server-Side Authorization**: `updateSubtaskAssignee` enforces role restrictions server-side. Workers are denied assignment mutations; Admins and Super Admins are permitted with automated audit entries in `project_activity` and targeted notifications.

### 4.5 Late Task Exception Control
Tasks with a past deadline and open status (`todo`, `in_progress`, `review`, `revision`):
- Flagged by deterministic helper `isTaskOverdue(task)`.
- Automatically surface in **Manager Dashboard** (`/admin` Agency Oversight Exceptions strip).
- Automatically surface in **Employee Dashboard** (`/admin/my-work` urgent execution feed).

### 4.5 Creative Production Module
Manages on-set shooting, raw footage ingestion, and creative turnaround in `public.production_bookings`:
- **Booking Fields**: `client_id`, `date`, `time`, `location`, `team_member_ids`, `production_type`, `duration_hours`.
- **Structured Brief**: JSONB structure containing:
  - `shotList`: Scene breakdown.
  - `requiredReels`: Hook and story requirements.
  - `photos`: Photography asset list.
  - `storyAssets`: Interactive and daily story assets.
  - `references`: Moodboard and style links.
  - `equipment`: Cameras, lenses, lighting, and audio equipment specs.
- **8-Stage Production Workflow**:
$$\text{BRIEF} \longrightarrow \text{SCHEDULING} \longrightarrow \text{SHOOTING} \longrightarrow \text{RAW UPLOAD} \longrightarrow \text{EDITING} \longrightarrow \text{REVIEW} \longrightarrow \text{CLIENT APPROVAL} \longrightarrow \text{DELIVERY / PUBLISHING}$$

---

---

## 6. Phase 5: Team, Time & Cost Engine

### 6.1 Authoritative Internal Cost Derivation
Employee labor cost is strictly derived from authoritative compensation data in `public.salary_records`. Zero manual entry of labor costs is permitted:

$$\text{Hourly Cost Rate} = \frac{\text{base\_amount}}{\text{standard\_monthly\_hours (default 160)}}$$

- For hourly workers: `hourly_rate` is used directly.
- Formula implementation: `calculateInternalHourlyRate(record)` in `src/lib/team-cost-service.ts`.
- Database extensions:
  - `team_members.employment_type`: `'full_time' | 'part_time' | 'freelance' | 'intern'`.
  - `salary_records.standard_monthly_hours`: `numeric DEFAULT 160`.
  - `salary_records.hourly_rate`: `numeric`.
  - `project_tasks.labor_cost`: `numeric DEFAULT 0`.

### 6.2 Time Tracking & Work Session Engine
Managed in `public.work_sessions`:
- Fields: `id`, `team_member_id`, `profile_id`, `client_id`, `project_id`, `task_id`, `session_type`, `started_at`, `ended_at`, `duration_minutes`, `hourly_cost_rate`, `labor_cost`, `description`, `status`.
- **Classification Invariant**:
  - `production`: Billable client deliverable execution.
  - `administrative`: Internal agency overhead (meetings, training, admin).
- **Execution Lifecycle**:
  - `clockIn()`: Resolves authenticated worker, snapshots authoritative `hourly_cost_rate`, sets `started_at`, sets `status = 'active'`.
  - `clockOut()`: Computes exact elapsed `duration_minutes`, computes `labor_cost = (duration_minutes / 60) * hourly_cost_rate`, sets `status = 'completed'`, and automatically updates `project_tasks.actual_hours` and `project_tasks.labor_cost`.

### 6.3 Task Cost Propagation Chain
$$\text{Task} \longrightarrow \text{Actual Hours} \longrightarrow \text{Employee Cost} \longrightarrow \text{Package Cost} \longrightarrow \text{Client Profitability} \longrightarrow \text{Financial Insights}$$

- Live stopwatch timer integrated in `/admin/my-work` with quick task timers and session type selectors.
- Actual hours tracked feed directly into deliverable and package profitability calculations.

### 6.4 Strict Worker Data Privacy & Isolation
- **Postgres RLS Enforcement**: Workers cannot query or view company-wide salaries, invoices, profit margins, or other workers' compensation records.
- **Worker Portal (`/admin/my-salary`)**: Workers view strictly own salary, commissions, hours (with production vs administrative breakdown), advance requests, and disbursements.
- **Super Admin Oversight**: Super Admin has unrestricted visibility across all team members, costs, and agency margins via `MemberWorkspaceModal` and `/admin/team-workload`.

---

## 7. Phase 6: Financial OS Cross-Module Integration

### 7.1 Canonical Ledger Convergence
All operational modules converge into the canonical Financial OS ledger without duplicating concepts or tables:

1. **Chain 1: Sales Deal → Revenue Inflow**:
   $$\text{Deal (Won)} \longrightarrow \text{Invoice} \longrightarrow \text{Payment Settlement} \longrightarrow \text{Income Transactions} \longrightarrow \text{Treasury Inflow}$$
   - Itemized into `client_service` and `sponsoring_collected`.
   - Triggers automatic unlocking of sales commission from `pending` to `approved`.
2. **Chain 2: Service Revenue → Commission Outflow**:
   $$\text{Invoice Settled} \longrightarrow \text{Commission Approved} \longrightarrow \text{Commission Payout} \longrightarrow \text{Expense Transaction (\text{allocation: 'commission'})} \longrightarrow \text{Treasury Outflow}$$
3. **Chain 3: Sponsoring Arbitrage & Margin**:
   $$\text{Sponsoring Campaign} \longrightarrow \text{Ad Purchase} \longrightarrow \text{Expense Transaction (\text{allocation: 'sponsoring_purchase'})} \longrightarrow \text{Margin Recalculated}$$
   $$\text{Sponsoring Margin} = \text{Budget (TND)} - \text{Ad Purchase Cost (TND)}$$
4. **Chain 4: Labor Cost & Package Margin**:
   $$\text{Work Sessions} \longrightarrow \text{Actual Hours \& Labor Cost} \longrightarrow \text{Task Labor Cost} \longrightarrow \text{Client Profitability}$$
5. **Chain 5: Salary Advances & Payroll**:
   $$\text{Worker Request (Pending)} \ne \text{Expense} \longrightarrow \text{Approved} \longrightarrow \text{Payment Execution} \longrightarrow \text{Expense Transaction (\text{allocation: 'payroll'})}$$
   - Zero premature ledger entries: advance requests generate expenses **only upon actual disbursement**.

### 7.2 Reactive Source Entity Propagation
- Client package price changes $\to$ invoice $\to$ revenue $\to$ client profitability.
- Sponsoring purchase/budget changes $\to$ ad purchase cost $\to$ sponsoring margin $\to$ client net profit.
- Sales commission rate changes $\to$ commission payout $\to$ agency net profit.
- Employee tracked hours $\to$ internal labor cost $\to$ package gross margin.

---

## 8. Automated Verification & Test Suites

The entire SADA OS operational, team cost, and financial convergence architecture is verified against the live remote Supabase PostgreSQL database:

1. **Sales, Packages & Production Suite (`scripts/test-sales-package-production.ts`)**:
   - 21/21 assertions passed (100% success).
2. **Team Cost & Financial OS Cross-Module Integration Suite (`scripts/test-team-cost-financial-os.ts`)**:
   - 15/15 assertions passed (100% success).
   - Verifies authoritative hourly rate derivation, clock in/out sessions, task cost propagation, full member cost profile, invoice settlement, treasury account inflows/outflows, commission unlock and payout, sponsoring arbitrage, worker request lifecycle (`request != expense`), and reactive propagation.
3. **Financial OS Canonical Engine Suite (`scripts/test-financial-operating-system.ts`)**:
   - 26/26 assertions passed (100% success, zero regressions).
4. **Phase 7 & 8 Management Analytics, Notifications & Audit Suite (`scripts/test-phase7-and-phase8.ts`)**:
   - 21/21 assertions passed (100% success).

---

## 9. Phase 7: Profitability, KPIs & Management Reporting

### 9.1 Architecture: Single Source of Truth
In strict adherence to the SADA OS principle of **never creating a second analytics engine**, the Management Analytics Service (`src/lib/analytics-service.ts`) builds upon the canonical `fetchCompanyFinance` calculation layer (`src/lib/finance-service.ts`). Zero KPIs are entered manually; all 10 management domains are deterministically derived from live ledger transactions, invoices, and logged production hours.

### 9.2 The 10 Canonical Management Analytics Domains

1. **Client Profitability**:
   $$\text{Contribution Profit} = \text{Revenue} - \text{Direct Costs} - \text{Sponsoring Cost} - \text{Sales Commission}$$
   $$\text{Profit Margin \%} = \frac{\text{Contribution Profit}}{\text{Revenue}} \times 100$$
   - **Health Rating Classification**:
     - `HIGH PROFIT`: Profit Margin $\ge 50\%$
     - `MEDIUM`: Profit Margin between $25\%$ and $49.9\%$
     - `LOW PROFIT`: Profit Margin $< 25\%$
2. **Package Profitability**:
   $$\text{Gross Profit} = \text{Selling Price} - \text{Employee Cost} - \text{Freelancer Cost} - \text{Transport} - \text{Subscription Allocation} - \text{Sales Commission} - \text{Other Direct Costs}$$
   $$\text{Gross Margin \%} = \frac{\text{Gross Profit}}{\text{Selling Price}} \times 100$$
3. **Service Profitability**:
   - Analyzes performance across 5 core service offerings: Video Production, Social Media Management, Digital Marketing & Ads, Brand Identity & Design, and Web Development.
4. **Employee Performance**:
   - Assigned tasks, completed tasks, overdue tasks, completion rate $\%$, actual vs. estimated hours, efficiency ratio, and attributed internal labor cost.
5. **Sales Performance**:
   - Sales pipeline funnel (leads, qualified leads, active proposals, won deals, lost deals), win conversion rate $\%$, won revenue, and sales commissions.
6. **Production Performance**:
   - Total production bookings, completed shoots, shooting hours logged, average turnaround time (days), on-time delivery rate $\%$.
7. **Monthly P&L (Income Statement)**:
   - Operating Revenue, Cost of Goods Sold (COGS), Gross Profit, Operating Expenses (OpEx: Salaries, Rent, Subscriptions, Utilities, Marketing, Transport), Net Operating Profit, Net Margin $\%$.
8. **Cash Flow Statement**:
   - Cash Inflows (Client Invoice Payments, Retainers, Other Income), Cash Outflows (Payroll & Advances, Sponsoring Purchases, Subscriptions, OpEx), Net Cash Flow Movement, Ending Cash at Bank.
9. **Commission Performance**:
   - Commission earned, approved, paid out, and pending. **Invariant strictly enforced**: Sponsoring budget is 100% excluded from the commissionable base.
10. **Revenue Trends**:
    - 6-month historical trajectory across Service Retainers, Sponsoring Retainers, and One-off Projects.

### 9.3 Interactive Drill-Down Engine (`CLICK → DRILL DOWN → SOURCE RECORDS`)
Every aggregated metric card, table cell, or chart in `/admin/analytics` opens an interactive drill-down modal (`src/components/admin/AnalyticsDrillDownModal.tsx`):
- **Formula explanation**: Mathematical transparency showing exactly how the KPI is calculated.
- **Source Ledger Records**: Tabular list of underlying transactions, invoices, or tasks with timestamps, IDs, descriptions, and amounts.
- **CSV Export**: Drill-down or full domain data exported in CSV format for executive reporting.

---

## 10. Phase 8: Automation, Event-Driven Notifications & Immutable Audit

### 10.1 Event-Driven Notification Engine (`src/lib/notification-service.ts`)
Role-aware notification system delivering real-time, non-polling notifications across 13 canonical operational events:

| Event Type | Category | Default Role Target | Trigger Event |
|---|---|---|---|
| `TASK_ASSIGNED` | Task | Worker | Task delegated to team member |
| `TASK_DUE_SOON` | Task | Worker | Task deadline within 24 hours |
| `TASK_OVERDUE` | Task | Worker / Admin | Task deadline exceeded without completion |
| `CLIENT_APPROVAL_REQUIRED` | Production | Admin | Deliverable submitted for client sign-off |
| `INVOICE_OVERDUE` | Billing | Admin | Invoice unpaid past due date |
| `PAYMENT_RECEIVED` | Billing | Super Admin | Client settles invoice via bank or gateway |
| `COMMISSION_ELIGIBLE` | Finance | Worker / Admin | Deal won and invoiced |
| `COMMISSION_APPROVED` | Finance | Worker | Payment settled; commission unlocked for payout |
| `SALARY_PAID` | Finance | Worker | Salary disbursement or advance finalized |
| `SALARY_REQUEST_PENDING` | Finance | Super Admin | Worker submits early advance request |
| `PRODUCTION_TOMORROW` | Production | Worker / Admin | Video/photo shoot scheduled for next day |
| `DELIVERABLE_BEHIND` | Production | Admin | Deliverable task marked 'blocked' or delayed |
| `MONTH_END_CLOSING` | Finance | Super Admin | Financial period closing reminder or execution |

### 10.2 Role-Aware Delivery & Security Isolation
- **Workers**: See only personal task alerts, their own salary/commission updates, or public broadcasts. RLS prevents workers from viewing financial invoices, company cash flow, or other workers' compensation.
- **Admins**: Receive operational alerts (task deadlines, shoot reminders, client approvals, behind deliverables).
- **Super Admin**: Receives financial inflows, salary requests, period closing alerts, and security audits, plus full system oversight.
- **User Preferences (`notification_preferences`)**: Users can toggle notifications per event type. Opted-out categories are automatically suppressed.

### 10.3 Automated Background Routines
- `scanAndEmitAutomations()`: Proactively checks for overdue tasks, tasks due within 24h, overdue invoices, tomorrow's production shoots, behind deliverables, and month-end closing, with 24-hour deduplication to prevent duplicate alerts.
- **Completed & Blocked Task Guards**: Tasks marked `done`, `delivered`, or `approved` are excluded from future deadline alerts. Tasks in `blocked` status are suppressed from misleading "due soon" completion alerts.

### 10.4 Actionable Operational Notification Center & Deep Linking
- **Operational Card Design**: Notification cards answer WHO, WHAT, WHY, WHAT OBJECT, and WHAT TO DO. The entire card is clickable (`min-h-[52px]` for mobile ergonomics) and marks the notification read before navigating.
- **Canonical Task Deep Linking**: Tasks link canonically to `/admin/my-work?task=<id>`. The `/admin/my-work` route ingests `?task=` search params to automatically open `TaskDetailModal` and load the task context without route bypass.
- **Authorization on Deep Links**: Notification click is navigation only, never an authorization bypass. Canonical routes, module shields (`ModuleAccessShield`), and database RLS continue to authorize data access authoritatively.
- **Manager → Worker User-Directed Alerts**: Authorized users can dispatch targeted task alerts via `SendTaskAlertModal` (`sendTaskAlert()`). The default recipient is pre-selected to the task assignee (`task.assignee_id`). Custom messages are persisted and delivered via realtime with 5-second in-flight deduplication and audit logging in `public.project_activity` (`task_alert_sent`).
- **i18n & Token Safety**: Interpolation pipeline safely scrubs unreplaced `{token}` placeholders. Raw tokens such as `{message}`, `{taskTitle}`, and `common.actions.view` never render to users. Supports full English LTR and Arabic RTL.

### 10.5 Unified System Audit & Database Immutability Enforced
- **Sensitive Operations Audited**: Role changes, permission updates, account creation/suspension/deletion, salary adjustments, commission changes, invoice edits, expense approvals, payment executions, financial closing, and reopening closed periods.
- **Permanent Immutability Invariant**:
  - `public.system_audit_logs`, `public.financial_audit_logs`, and `public.account_audit_logs` are protected by a PostgreSQL `BEFORE DELETE` trigger function (`prevent_audit_log_deletion()`) that raises an unrecoverable exception:
    ```sql
    RAISE EXCEPTION 'Audit records are immutable and cannot be deleted.';
    ```
  - Supabase client DELETE queries are rejected at RLS layer (`WITH CHECK (false) / USING (false)`), and direct SQL deletes are halted by the trigger. Audit records can **never** be deleted or tampered with.

---

## 11. Phase 9: Executive Command Center

### 11.1 Architectural Convergence: The Single Operating Deck
Phase 9 represents the final convergence layer of SADA OS. Rather than creating new business logic, [`src/components/admin/ExecutiveCommandCenter.tsx`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/components/admin/ExecutiveCommandCenter.tsx) directly consumes the canonical Financial OS (`fetchCompanyFinance`) and Management Analytics (`fetchManagementAnalytics`) services.

### 11.2 The 12 Immediate Executive Answers
1. **How much did SADA collect this month?** $\to$ Live revenue collected (`kpis.totalIncome`) from canonical inflow transactions and settled invoices.
2. **How much did SADA spend?** $\to$ Total operational expenses spent (`kpis.totalExpenses`).
3. **What is the actual net profit?** $\to$ True net operating profit and net margin $\%$ (`kpis.netProfit`, `monthlyPnL.netMarginPercent`).
4. **How much cash is available?** $\to$ Liquid cash reserves across all treasury bank and cash accounts (`totalAvailableCash`).
5. **Who owes SADA money?** $\to$ Interactive list and sum of all unsettled/overdue client invoices (`unpaidInvoices`).
6. **Which clients are most profitable?** $\to$ Client ranking sorted by Contribution Profit with health ratings (`HIGH PROFIT`, `MEDIUM`, `LOW PROFIT`).
7. **Which packages are most profitable?** $\to$ Offerings ranked by Gross Profit and Gross Margin $\%$.
8. **Which projects are at risk?** $\to$ Exception detection identifying blocked, delayed, or late milestone deliverables.
9. **Which tasks are overdue?** $\to$ Live list of tasks past deadline with priority badges, assignees, and days overdue.
10. **Which employees have pending requests?** $\to$ Active salary advance requests awaiting Super Admin review.
11. **What salaries/commissions are upcoming?** $\to$ Total committed monthly base salaries plus approved commission payouts.
12. **What financial risks require attention?** $\to$ Deterministic risk warnings: cash runway duration, burn rate spikes, and low-margin accounts.

### 11.3 The 5 Executive Command Decks
- **Financial Command**: Revenue, Expenses, Net Profit, Cash Reserves, and "Who Owes SADA Money" invoice table.
- **Operations Command**: Active vs Overdue tasks, Projects at Risk, Production Shoots, and Deliverables Throughput.
- **Client Command**: Active accounts, revenue contribution, contribution profit rankings, and client payment health.
- **Team Command**: Workload capacity, tracked production hours, committed upcoming payroll, and salary advance request desk.
- **Intelligence & Risk Control**: Deterministic cash runway calculations, receivables aging, low-margin warnings, and package profitability opportunities.

### 11.4 Automated Verification Suites
- **Executive Command Center Suite (`scripts/test-phase9-executive-command.ts`)**: 20/20 assertions passed (100% success).
- **Phase 7 & 8 Management Analytics & Audit Suite (`scripts/test-phase7-and-phase8.ts`)**: 21/21 assertions passed (100% success).

---

## 12. Phase 10: Production Hardening & System Integrity Verification

Phase 10 finalized the operational reliability, security posture, and data integrity of SADA OS:

### 12.1 Security & RBAC Hardening
- **Account State Invariant**: Profiles marked `suspended`, `disabled`, or `deleted` are instantly rejected by `resolveRole`, invalidating active Gotrue sessions and preventing access.
- **Route Authorization Shields**: Direct URL access to `/admin/finance`, `/admin/analytics`, `/admin/deals`, `/admin/contact`, and `/admin/accounts` is blocked for unauthorized roles (e.g. `worker`) via dedicated `ShieldAlert` component views that abort data queries.
- **Client Workspace Worker Isolation**: On `/admin/clients` and `/admin/clients/$id`, financial tabs (`financial`, `invoices`, `payments`, `sponsoring`, `performance`), revenue totals, and health ratings are stripped for workers and replaced with operational deliverables, tasks, and project milestones.
- **Postgres RLS Defense-in-Depth**: Direct queries from non-finance roles against `financial_accounts`, `income_transactions`, `expense_transactions`, `invoices`, and `financial_audit_logs` return 0 rows.

### 12.2 Financial OS & Transaction Consistency
- **Strict Input Validation**: `createIncome`, `createExpense`, `createInvoice`, `createSponsoringCampaign`, `createSalesCommission`, and `upsertSalaryRecord` reject non-positive amounts, invalid commission rates (>100%), and negative base salaries.
- **Single Source of Truth**: All management reporting derives directly from the canonical Financial OS engine with zero duplicate calculation layers and zero manually stored KPI records.
- **Period Closing Reopen Control**: Closing locks historical periods; reopening requires Super Admin identity, recorded reason, and immutable audit logging.

### 12.3 Automated Phase 10 Test Suite (`scripts/test-phase10-production-hardening.ts`)
- **Coverage**: 35 automated assertions across 12 domains:
  1. Auth & Session Hardening
  2. RBAC Route & Action Shielding
  3. RLS Defense-in-Depth
  4. Financial Integrity & Canonical Formulas
  5. Transaction Consistency
  6. Immutable Audit Logging
  7. Monthly Period Closing & Reopening
  8. Notification Engine 24h Deduplication
  9. Data Integrity & Foreign Keys (Zero Orphan Tasks, Invoices, Campaigns)
  10. Global Search RBAC Integration
  11. I18N, RTL & Thmanyah Serif Text Typography Parity
  12. Executive Command Center Single Source of Truth
- **Result**: 35/35 PASSED (100% success).

---

## 13. Recurring Client-Service Scheduling & Workflow Engine (Phase 2)

### 13.1 Canonical Package Commitment Rules & Presets
Built directly on the SADA OS workflow foundation, recurring service commitments represent the contract scheduling rules between the agency and the client:
1. **Stories Shooting**: 2 times/week (e.g. Tuesday & Thursday), 2.0h duration, assigned to Videographer/Content Specialist, linked to Reel/Story workflow.
2. **Reels Shooting**: 2 dedicated shoot days/month (e.g. 5th and 20th of the month), 4.0h duration, assigned to Director/Videographer, linked to Reel Production workflow (Script $\to$ Shooting $\to$ Editing $\to$ Publishing).
3. **Posts Publishing**: 8 posts/month, evenly distributed, 1.5h per deliverable, assigned to Graphic Designer, linked to Design workflow.
4. **Photography Session**: 1 session/month (e.g. 10th of month), 3.0h duration, assigned to Photographer.
5. **Paid Ads Strategy**: 1 session/month (1st of month), 3.0h duration, assigned to Media Buyer, linked to Sponsoring workflow.

### 13.2 Data Model & Invariants
- **Table**: `public.service_commitments` (mirrored in `public.business_rules` fallback for maximum runtime resilience).
- **Attributes**: `client_id`, `package_id`, `service_name`, `deliverable_type`, `quantity`, `frequency` (`daily`, `weekly`, `monthly`, `bi_weekly`), `schedule_rule` (JSONB with days of week/month, default time, duration), `start_date`, `end_date`, `assignment_rule`, `assignee_id`, `workflow_template_id`, `status` (`active`, `paused`, `inactive`, `completed`).
- **Calendar Representation**: Calendar entries display client name, deliverable service, assigned specialist/worker, workflow stage badge (`Stage X`), and scheduled deadline.

### 13.3 Automated & Idempotent Generation Engine
- **Idempotency Guarantee**: Tasks are keyed by composite deterministic tokens: `commit_${commitment.id}_${targetDate}_seq${sequenceIndex}` and audited via `commitment_id + deadline` and embedded notes metadata `[COMMITMENT:<id>|DATE:<d>|SEQ:<s>]`. Re-running generation on any date window never produces duplicates (`tasks_skipped_existing` increments while `tasks_created = 0`).
- **Client Lifecycle State Machine**:
  - `active`: Automated future deliverable generation proceeds normally.
  - `paused`: Generation of upcoming tasks is suspended without modifying or deleting historical business records (`tasks_skipped_paused > 0`).
  - `inactive`: Generation halts completely; historical tasks, time sessions, and audits remain permanently intact (`tasks_skipped_inactive > 0`).
  - `reactivated`: Reactivation sets `reactivated_at`; future occurrences strictly on or after `reactivated_at` are generated, preserving prior history without duplicates.
- **Workflow Linkage**: Automatically instantiates prerequisite-dependent stage subtasks when a workflow template is attached.

### 13.4 Automated Verification Suite (`scripts/test-recurring-scheduling.ts`)
- **Assertions**: 46 automated checks across presets, deliverable derivation, occurrence calculation, idempotency, lifecycle preservation, and calendar item completeness.
- **Result**: 46/46 PASSED (100% success).

---

## 14. Recurring Scheduling Hardening & Integrity (Phase 2.1)

### 14.1 Database-Level Idempotency & Unique Constraints
Recurring task identity is enforced by the PostgreSQL database engine rather than application-level string checks:
1. **Idempotency Key Unique Index**:
   ```sql
   CREATE UNIQUE INDEX idx_project_tasks_idempotency_key_unique
     ON public.project_tasks(idempotency_key)
     WHERE idempotency_key IS NOT NULL;
   ```
2. **Composite Identity Unique Index**:
   ```sql
   CREATE UNIQUE INDEX idx_project_tasks_commitment_occurrence_seq_unique
     ON public.project_tasks(commitment_id, occurrence_date, sequence_index)
     WHERE commitment_id IS NOT NULL AND occurrence_date IS NOT NULL AND sequence_index IS NOT NULL;
   ```
3. **Atomic Upsert Mutation**:
   Mutations use `.upsert(taskPayload, { onConflict: 'idempotency_key', ignoreDuplicates: true })`. Concurrent execution (e.g. 3 simultaneous requests via `Promise.all`) yields exactly one task per occurrence with zero duplicate records.

### 14.2 Structured Occurrence Identity (Zero String Parsing)
Authoritative task identity resides in dedicated typed database columns:
- `project_tasks.commitment_id`: Foreign key reference to `service_commitments(id)`.
- `project_tasks.occurrence_date`: `DATE` calendar occurrence timestamp.
- `project_tasks.sequence_index`: Sequence position index within the occurrence period.
- `project_tasks.idempotency_key`: Deterministic composite key (`commit_${commitment.id}_${targetDate}_seq${seq}`).
- `project_tasks.deliverable_id`: Link to parent quota period deliverable in `client_deliverables(id)`.
- **Invariant**: Notes and task titles are strictly non-authoritative human-readable audit metadata; `notes.includes(...)` is prohibited as a duplicate detection mechanism.

### 14.3 Explicit Scheduling Presets & Catalog Quantity Authority
Package quantities remain strictly owned by `package_catalog` and client deliverable quotas. The recurring scheduling engine resolves explicit presets (`resolveSchedulingPreset`) to map quantities into deterministic occurrences:
- `stories_shooting`: 2x/week (Tue & Thu)
- `reels_shooting`: 2 days/month (5th & 20th)
- `posts_publishing`: 8/month (evenly spaced across month)
- `photography`: 1 session/month (10th)
- `paid_ads`: 1 strategy session/month (1st)

### 14.4 Deterministic Distribution & Timezone Immunity
- **Distribution Calculations**: `calculateCommitmentOccurrences` cleanly handles short months (February 28-day, February 29-day leap years), 30/31-day months, mid-month start/end bounds, and quota counts exceeding available days with integer spacing and day clamping.
- **Timezone Safety**: Dates are anchored at 12:00:00 (noon) via `createSafeCalendarDate` and `parseSafeCalendarDate`, preventing timezone conversions from causing day shifts (e.g. `2026-10-01` remaining `2026-10-01` across all client and server timezones).

### 14.5 Non-Destructive Lifecycle Semantics
- **Paused**: Suspends future occurrence generation (`tasks_skipped_paused`); preserves 100% of historical and pre-generated future tasks.
- **Resume & Reactivation**: Sets `reactivated_at` and generates occurrences strictly on or after the reactivation boundary (`target_date >= reactivated_at.substring(0, 10)`). Missed occurrences during the paused period are never backfilled.

### 14.6 Workflow Stage Idempotency
`instantiateWorkflowStages()` utilizes deterministic stage idempotency keys (`stage_${parentTask.id}_${stage.id}`) and pre-checks existing subtasks before upserting with `ignoreDuplicates: true`. Calling instantiation repeatedly produces exactly one valid set of stages.

### 14.7 Automated Hardening Verification Suite (`scripts/test-recurring-scheduling-hardening.ts`)
- **Assertions**: 54 automated assertions covering Tests A through I (Database Uniqueness, Concurrency, Repeated Generation, Workflow Stage Idempotency, Pause, Resume, Reactivation, Date Determinism & Timezone Safety, Calendar & Quota Integrity).
- **Result**: 54/54 PASSED (100% success).

---

## 15. Client 360 Unified Command Center Architecture

### 15.1 Core Purpose & Mental Model
Client 360 (`/admin/clients/$id`) transforms fragmented client-related surfaces (11-tab Client Workspace, 5-tab Operational Workspace, Deliverables, Package, Financial, Sponsoring, Invoices, Payments, Tasks, Notes, Performance) into a single, cohesive operational cockpit:

```
CLIENT
  ↓
CONTRACT / ENGAGEMENT (Monthly Retainer vs One-Off Project)
  ↓
PACKAGE OR SERVICE (Authoritative Catalog & Custom Scope)
  ↓
SERVICE ALLOWANCES (Reels, Posts, Stories, Photography, Custom)
  ↓
SERVICE PERIOD / MONTH (Interactive Month Navigator)
  ↓
PROJECT TASKS / DELIVERABLES (public.project_tasks)
  ↓
ASSIGNEE (public.profiles.id via team_members.profile_id)
  ↓
TEAM WORKLOAD (public.project_tasks projection)
```

### 15.2 Authoritative Principles
1. **Client is the Relationship Root**: Client 360 is an orchestration and projection view over canonical data. It is never a competing data model or duplicate database.
2. **Single Source of Operational Truth**: `public.project_tasks` remains the sole task table. Mutating status in Client 360 reflects immediately across My Work, Team Workload, and Calendar without duplicate sync jobs.
3. **Immutable History**: Historical completed work is permanently preserved. Changing future package allowances only reconciles future unstarted tasks (`reconcileClientPackageWork`).
4. **Authoritative Financial Source**: Payments are queried from `public.income_transactions` (with invoice linkage via `public.invoices`).
5. **Dual Engagement Classification**: Clear distinction between `MONTHLY RETAINER PACKAGE` and `ONE-OFF PROJECT ENGAGEMENT` with dynamic KPIs.

### 15.3 Unified Command Center Architecture & Sticky Navigation Root Architecture
The previous tabbed interface is replaced with a high-performance single-page Command Center featuring an elevated persistent navigation bar (`#overview-section`, `#services-section`, `#delivery-section`, `#team-section`, `#financial-section`, `#memory-section`, `#history-section`):

1. **Persistent Top Navigation Wrapper (`#client-360-nav-wrapper`)**:
   - Elevated to the very top of `Client360UnifiedConsole` (`sticky -top-16 md:-top-10 z-30 -mt-16 md:-mt-10 pt-16 md:pt-10 -mx-4 sm:-mx-6 md:-mx-10 px-4 sm:px-6 md:px-10 bg-background/98 backdrop-blur-md border-b border-border shadow-xs`).
   - Seamlessly covers the scroll container's top padding box (`#sada-admin-main`), completely preventing text from scrolling above the bar or bleeding through.
   - Pinned coordinates maintain 0.0px stability (deviation <= 2px) across scroll depths 0px, 100px, 300px, 600px+ across all 6 responsive viewports (Desktop, Tablet, Mobile).
   - Top row provides continuous orientation: Back to Client Directory, Client Name, status badge, and Quick Actions (`Edit Package`, `Edit Client`).
   - Bottom row provides the canonical 7 section navigation tabs with count badges, active highlight, and horizontal scrollability.
   - Smooth `scrollToSection` dynamically measures navigation bottom relative to `#sada-admin-main` scrollport, providing a guaranteed >= 24px clearance buffer above section headings.
   - `IntersectionObserver` with `rootMargin: "-100px 0px -40% 0px"` coupled with a `< 60px` scroll listener guarantees instantaneous, flicker-free active tab tracking.

2. **Section 1: Overview 360 (Executive Cockpit & Commercial Identity)**:
   - Houses the Authoritative Commercial Identity Card (client name, industry, badges, direct Call/WhatsApp/Email, AM, PM, contract value, and renewal pacing).
   - Houses the Executive 5-column Cockpit Metric Cards (Target Period, Delivery Pacing, Payment Reconciliation, Active Team, and Attention & Risk Escalation).
   - Operational Posture & Immediate Next Action synthesized alert box (overdue escalation, client approval follow-up, blocker resolution, or all systems go).
   - Cycle Pacing Rhythm widget comparing elapsed days in the period against completed quota progress (`Ahead`, `On track`, `Behind pacing`).
   - High-Priority Deliverables in Flight displaying top urgent deliverables with service emblems, assignees, deadlines, and direct inspection.

3. **Section 2: Services & Package Quotas**:
     - Authoritative commitment ledger for Reels, Posts, Stories, and Photography with Target, Used, Remaining, and Progress bars.
     - SSOT Edit Package modal previewing price and work impact before saving (`reconcileClientPackageWork`).
     - Recurring service commitments list with pause/resume toggle, edit dialog, and package derivation.
     - Adaptive One-Off Project Scope ledger for one-off engagements.
   - **Section 3: Monthly Delivery Center (Absorbed Operational Workspace)**:
     - Month navigator (`‹ MMMM yyyy ›`).
     - Quick action bar: Reconcile Work, Generate Deliverables, New Task.
     - Attention filters: Overdue, Blocked, Waiting on Client, Urgent, and Assignee filter chip with prominent active filter banner.
     - 4 integrated view modes:
       - **Tasks by Service**: Canonical `project_tasks` grouped into REELS, POSTS, STORIES, PHOTOS, and OTHER with inline status toggle, priority, assignee, due date, deliverable badges, Drive links, and task detail modal.
       - **Deliverables Ledger**: Authoritative `client_deliverables` rows with `+1 Done` instant increments.
       - **Shoot Production Pipeline**: 4-stage pipeline (Brief → Pre-Prod → Shoot Date → Delivery) with stage progression.
       - **Calendar Execution Grid**: Direct embedded `<CalendarGrid />` projecting client tasks onto monthly calendar dates.
   - **Section 4: Team & Work**:
     - Consolidated Account Leadership strip directing visual focus to specialist contributor dossiers.
     - Contributor dossiers derived from active `project_tasks` with breakdown by deliverable type (Reels, Posts, Stories, Other), overdue counts, and `[View Work for Client]` CTA filtering the Delivery view to that member.
   - **Section 5: Financial & Sponsoring**:
     - Financial scorecards: Contract/Monthly value, Invoiced, Collected (`income_transactions`), Outstanding balance, Sponsoring budget.
     - Invoices ledger with status, due date, and amounts.
     - Payment transaction history and sponsoring campaign spend.
   - **Section 6: Client Memory**:
     - Structured agency operational intelligence divided into 6 categories: Brand Guidelines, Content Rules, Client Preferences, Approval Process, Restrictions, and Important Instructions.
     - 1-click template insertion into `clients.notes`.
   - **Section 7: Work History Archive**:
     - Immutable archive of delivered work (`status in ('done', 'delivered', 'approved')`).
     - Type filters (All, Reels, Posts, Stories, Photos, Other), Drive asset links, and live published links.

### 15.4 Operational Workspace Absorption & Legacy Bridge
- **Canonical Experience**: Recurring retainer clients are operated exclusively through Client 360 (`/admin/clients/$id`). The operator never navigates to a separate workspace.
- **Legacy Workspace Bridge**: Visiting `/admin/client-projects/$id` for a client-linked project renders a prominent **Canonical Bridge Banner** pointing the operator directly to `/admin/clients/$clientId` with an instant CTA.
- **Cross-Agency Operations Center**: `/admin/client-projects` is repurposed from a competing workspace list into a cross-agency Operations Center featuring:
  - Global executive scorecard (Active Workspaces, Overdue Deliverables, Blocked / Waiting on Client, Team Operations).
  - Client workspace table where client-linked projects display a "360" badge and link directly to `/admin/clients/$clientId`.

### 15.5 Data Model & Security Invariants
- `public.project_tasks` remains the sole operational task source of truth.
- No duplicate task, calendar, financial, or package tables are created.
- Completed historical work is permanently preserved during quota updates.
- Layered security model (A–K) remains strictly enforced with zero bypass.
- 100% SADA Design System components; zero native HTML selects, date pickers, or inputs.

---

## 16. Client Lifecycle Management (Archiving & Permanent Deletion)

### 16.1 Overview & Architecture
SADA OS provides a dual-tier lifecycle management system for clients:
1. **Reversible Archiving & Freezing**:
   - Freezes client workspace without data loss.
   - Pauses recurring service commitments (`service_commitments.status = 'paused'`) to prevent recurring schedule creation.
   - Pauses uncompleted operational tasks (`project_tasks.status = 'paused'`) while preserving original status via notes metadata tag `[ARCHIVED_PREV_STATUS:<status>]`.
   - Completed historical deliverables and tasks (`status = 'done'`) remain untouched.
   - Excludes archived clients from active workloads, daily execution, team quotas, and active calendar views.
   - Reversible at any time via `admin_restore_client`, which reactivates commitments and restores original task statuses idempotently.
2. **Permanent Deletion with Financial Safeguards**:
   - Super Admin exclusive action protected by `admin_delete_client_permanently`.
   - **Legal/Financial Safeguard**: Hard deletion is strictly blocked if the client has issued invoices (`invoices`) or approved/paid sales commissions. Raises `CANNOT_DELETE_FINANCIAL_RECORDS` to guarantee accounting ledger integrity and fiscal auditability.
   - **Atomic Cascade Purge**: For safe clients, cleanly purges dependent operational records in transactional order (`client_deliverables`, `project_tasks`, `task_handoffs`, `service_commitments`, `production_bookings`, `sponsoring_campaigns`, `client_communication_logs`, `client_projects`, and `clients`). Nullifies references in immutable accounting ledgers.
   - Logs immutable audit entries to `system_audit_logs`.

### 16.2 UI Design System & Action Menu
- **Table Row Actions**: `Open Client` is the primary visible action with arrow and label.
- **Secondary Actions Menu**: `Archive`/`Restore` and `Delete Client Permanently` are grouped into the standard SADA `DropdownMenu` (`MoreVertical`), eliminating horizontal clipping across desktop, tablet, and mobile viewports.
- **Role Isolation**: Permanent deletion option is rendered exclusively for Super Admin users, styled with rose/destructive tokens and separated by a divider.







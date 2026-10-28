# SADA OS — Phase 2: Client 360 Cross-Page Propagation Matrix
## Multi-Module Synchronization & State Consistency Verification

---

### 1. Cross-Page Architecture & Mutation Flow

A mutation originated inside the Client 360 Command Center (`/admin/client-workspaces/$id`) ripples into multiple operational modules across SADA OS. Because all modules read from canonical database tables rather than disconnected local state, updates propagate seamlessly:

```
                  ┌──────────────────────────────────────────────┐
                  │ Client 360 Command Center                    │
                  │ (/admin/client-workspaces/$id)               │
                  └──────────────────────┬───────────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌─────────────────┐            ┌───────────────────┐            ┌───────────────────┐
│ Task Execution  │            │ Financial Ledger  │            │ Package & Roster  │
│ - /admin/calendar            │ - /admin/finance  │            │ - /admin/client-  │
│ - /admin/tasks  │            │ - Invoices Table  │            │   workspaces      │
│ - /admin/team   │            │ - Cash KPIs       │            │ - /admin/analytics│
└─────────────────┘            └───────────────────┘            └───────────────────┘
```

---

### 2. Cross-Page Propagation Matrix

| Mutation Action in Client 360 | Affected Canonical Table | Downstream Pages & Modules | Observed Propagation Behavior | Cache Invalidation Mechanism | Status |
|---|---|---|---|---|---|
| **1. Update Client Retainer / Name** | `public.clients` | `/admin/client-workspaces`<br>`/admin/analytics`<br>`/admin/deals` | Client Directory immediately reflects new name, industry, and retainer amount | TanStack Query key invalidation (`['clients']`, `['client', id]`) | **VERIFIED CONSISTENT** |
| **2. Reconcile Package Work (Generate Tasks)** | `public.project_tasks`<br>`public.client_deliverables` | `/admin/calendar`<br>`/admin/team`<br>`/admin/client-workspaces` | Generated tasks appear on calendar for target delivery period (`2026-10`); team workload reflects new allocations | Query keys `['tasks']`, `['deliverables']`, and Realtime postgres_changes | **VERIFIED CONSISTENT** |
| **3. Assign / Reassign Task Contributor** | `public.project_tasks.assignee_id` | `/admin/tasks` (My Work)<br>`/admin/team` (Workload)<br>Contributor notifications | Contributor sees task in My Work queue; Team Workload balances active task counts | Query keys `['my-tasks']`, `['team-workload']` | **VERIFIED CONSISTENT** |
| **4. Transition Task Status to 'done'** | `public.project_tasks.status`<br>`project_tasks.completed_at` | Client 360 Pacing KPI<br>`/admin/calendar`<br>Executive Overview | Delivery pacing progresses (e.g. 30% $\rightarrow$ 50%); completed task badge shows green check | Local optimistic update + `refetchDeliverables()` | **VERIFIED CONSISTENT** |
| **5. Create Retainer Invoice** | `public.invoices` | `/admin/finance`<br>Client 360 Invoices Table | New invoice appears in receivables queue; Payment Pacing KPI tracks pending balance | Query keys `['invoices']`, `['finance-overview']` | **VERIFIED CONSISTENT** |
| **6. Record Cash Receipt (Settlement)** | `public.income_transactions`<br>`invoices.paid_amount` | `/admin/finance` (Cash Ledger)<br>Company Treasury KPIs | Collected revenue KPI updates; outstanding invoice balance decreases; zero double-count | Query keys `['income_transactions']`, `['financial-kpis']` | **VERIFIED CONSISTENT** |
| **7. Update Brand Directives / Guidelines** | `public.clients.notes` | Task Details Drawer<br>Client 360 Directives Tab | Guidelines update instantly; production workers viewing task see updated restriction rules | Query key `['client-directives', id]` | **VERIFIED CONSISTENT** |
| **8. Pause / Archive Client** | `public.clients.status` | `/admin/client-workspaces`<br>Recurring Scheduler | Client moves to Inactive/Archived roster; future monthly generation suspended | Query key `['clients']`; scheduling engine early-exit guard | **VERIFIED CONSISTENT** |

---

### 3. Verification of Zero Desynchronization

1. **No Stale In-Memory Drift**:
   Every navigation event between `/admin/client-workspaces` and `/admin/client-workspaces/$id` uses canonical loaders that re-verify database state.
2. **Transactional Soundness**:
   Task creation and deliverable reconciliation operate within idempotent boundaries. Re-triggering reconciliation never duplicates calendar entries or disrupts existing contributor assignments.

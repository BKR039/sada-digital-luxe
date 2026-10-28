# SADA OS — Phase 2: Client 360 Source-of-Truth Trace
## Entity Data Flow, Mutation Paths, and Relational Dependencies

---

### 1. Architectural Principles of SADA OS Client 360

The Client 360 Command Center integrates multiple operational subsystems into a unified interface. To maintain database consistency without data drift or competing states, each entity adheres to a strict Single Source of Truth (SSOT) hierarchy:

```
[public.package_catalog] (Master Catalog SSOT)
       │ (Assigned via package-service)
       ▼
[public.clients] (Client Profile SSOT: Retainer, package_id, package_config JSONB)
       │
       ├──► [public.client_projects] (Workspace Container: client_id, title)
       │          │
       │          ├──► [public.client_deliverables] (Monthly Quotas: reel, post, story)
       │          │          │
       │          │          ▼
       │          └────► [public.project_tasks] (Operational Work: delivery_period, assignee_id)
       │
       ├──► [public.service_commitments] (Recurring Rules SSOT: frequency, quantity)
       │
       ├──► [public.invoices] (Billed Receivables: total_amount, paid_amount, status)
       │          │
       │          ▼ (Unlinked income does NOT inflate invoice totals)
       └──► [public.income_transactions] (Actual Cash Ledger: amount, category, status='received')
```

---

### 2. Comprehensive SSOT Entity Traceability Matrix

| Entity | Canonical Master Table | Primary Key | Authoritative Write Service | Read Model / Projections | Competing Sources / Deprecated Layers | Verification Status |
|---|---|---|---|---|---|---|
| **1. Client Profile & Retainer** | `public.clients` | `id` (UUID) | `client-service.ts` (`updateClientRecord`) | Client 360 Header, Directory table | Denormalized client names in legacy notes | **VERIFIED CANONICAL** |
| **2. Client Workspace Containers** | `public.client_projects` | `id` (UUID) | `client-service.ts` | Client 360 Workspace Deck | `public.projects` (public portfolio CMS) | **VERIFIED CANONICAL** |
| **3. Master Packages & Catalog** | `public.package_catalog` | `id` (UUID) | `package-service.ts` | Edit Package Modal, Pricing Engine | `public.packages` (legacy 37-row catalog) | **VERIFIED CANONICAL** |
| **4. Contracted Service Quotas** | `clients.package_config` + `service_commitments` | `client_id` (UUID) | `package-reconciliation-service.ts` | Services & Quotas Card, Delivery Center | Deliverable notes text parsing (deprecated) | **VERIFIED CANONICAL** |
| **5. Monthly Deliverables** | `public.client_deliverables` | `id` (UUID) | `package-reconciliation-service.ts` | Monthly Delivery Stepper & Progress Bar | Ad-hoc task counts | **VERIFIED CANONICAL** |
| **6. Operational Tasks** | `public.project_tasks` | `id` (UUID) | `task-execution-service.ts` | Team & Work Section, Calendar | External timesheet records | **VERIFIED CANONICAL** |
| **7. Assignee Identity** | `public.team_members` $\leftrightarrow$ `profiles` | `team_members.id` (UUID) | `account-service.ts` | Assignee Combobox, Contributor Badges | Hardcoded string names | **VERIFIED CANONICAL** |
| **8. Billed Invoices** | `public.invoices` | `id` (UUID) | `finance-service.ts` | Invoices Table, Payment Pacing KPI | `income_transactions` (accrual vs cash) | **VERIFIED CANONICAL** |
| **9. Actual Cash Inflows** | `public.income_transactions` | `id` (UUID) | `finance-service.ts` | Cash Received KPI, Treasury Ledger | Unpaid invoices | **VERIFIED CANONICAL** |
| **10. Brand Memory & Directives** | `public.clients.notes` | `client_id` (UUID) | `client-service.ts` | Brand Directives Drawer & Tab | Unstructured external scratchpads | **VERIFIED CANONICAL** |

---

### 3. Critical Invariant Enforcement Guarantees

#### Invariant 1: Cash Reality Separation (Accrual vs Cash)
- `clients.monthly_package_price` represents contracted monthly retainer value.
- `invoices.total_amount` represents billed receivables.
- `income_transactions` (with `status = 'received'`) represents actual collected cash.
- **Rule**: Retainer $\neq$ Invoice $\neq$ Cash. Neither creating a client nor issuing an invoice impacts the cash ledger until an `income_transactions` entry is created with `status = 'received'`.

#### Invariant 2: Double-Counting Prevention
- Invoices track partial collections via `invoices.paid_amount`.
- When an `income_transactions` entry is linked to an `invoice_id`, the financial calculation engine computes:
  $$\text{Total Collected} = \sum \text{invoices.paid\_amount} + \sum_{\text{invoice\_id IS NULL}} \text{income\_transactions.amount}$$
- **Guarantee**: Verified in test `P2-FN-06`—linked payments never inflate the company cash ledger by double-counting.

#### Invariant 3: Historical Work Preservation
- When a client package quota is decreased (e.g. reels reduced from 4 to 2):
  1. Only unstarted future tasks (`status = 'todo'`) are eligible for pruning.
  2. Completed tasks (`status = 'done'`) and tasks with logged hours or attachments are strictly preserved.
- **Guarantee**: Verified in test `P2-MD-04`—completed historical tasks remain intact in the database with their original timestamps and deliverable links.

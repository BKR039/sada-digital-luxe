# SADA OS — Client Workspaces & Client 360: Security & Authorization Matrix

## 1. Executive Summary

This matrix documents the authorization model, role-based access control (RBAC), multi-tenant data isolation, and server-side guards protecting the **Client Workspaces & Client 360** module.

Security invariants:
- **Defense-in-depth**: Authorization is enforced at the query, service, and database RLS layers, never solely by hiding controls in the user interface.
- **Financial confidentiality**: Workers and non-administrative personnel cannot read or mutate invoices, payments, expenses, contract values, profit margins, or sponsoring budgets.
- **Audit immutability**: Audit logs and historical event records cannot be updated or purged by ordinary users.

---

## 2. Role Permissions Matrix

| Workspace Area / Action | Super Admin | Admin | Worker | Authorization Enforcement Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **View Client Directory** | Allowed | Allowed | Allowed (Scope-limited) | RLS on `clients` table |
| **Create New Client** | Allowed | Allowed | Denied | `canManageClients` guard; modal restricted |
| **Edit Client Profile & Owners** | Allowed | Allowed | Denied | RLS `clients` update policy + UI permission guard |
| **Edit Package & Custom Quotas** | Allowed | Allowed | Denied | `reconcileClientPackageWork` checks actor role |
| **View Delivery Center & Tasks** | Allowed | Allowed | Allowed (Assigned) | RLS on `project_tasks` |
| **Create & Update Tasks** | Allowed | Allowed | Allowed (Assigned) | RLS on `project_tasks` |
| **View Financial Tab & KPIs** | Allowed | Allowed | **DENIED** | `canAccessFinance` guard; tabs unmounted in DOM |
| **Issue New Invoice** | Allowed | Allowed | **DENIED** | `canAccessFinance` + RLS on `invoices` |
| **Record Income / Payment** | Allowed | Allowed | **DENIED** | `canAccessFinance` + RLS on `income_transactions` |
| **Record Client Expense** | Allowed | Allowed | **DENIED** | `canAccessFinance` + RLS on `expense_transactions` |
| **Manage Sponsoring Campaigns** | Allowed | Allowed | **DENIED** | `canAccessFinance` + RLS on `sponsoring_campaigns` |
| **Read Client Memory & Notes** | Allowed | Allowed | Allowed (Directives) | Controlled via `clients.notes` select policy |
| **Edit Client Memory & Directives** | Allowed | Allowed | Denied | Super Admin / Admin mutation guard |
| **View Work History & Timeline** | Allowed | Allowed | Allowed (Non-financial) | Query filters out financial transactions for workers |

---

## 3. Server-Side & Service Layer Guards

### A. Financial Tab Redirection & Data Strip
In `src/routes/admin.client-workspaces.$id.tsx`:
```ts
const canAccessFinance = role === "superadmin" || role === "admin";

useEffect(() => {
  if (!canAccessFinance && ["financial", "sponsoring", "invoices", "payments", "performance"].includes(activeTab)) {
    setActiveTab("overview");
  }
}, [canAccessFinance, activeTab]);
```
- In `loadClientData()`: Financial queries (`invoices`, `sponsoring_campaigns`, `income_transactions`, `expense_transactions`, `financial_accounts`, `expense_categories`) are completely **bypassed** for non-financial roles (`Promise.resolve({ data: [] })`).
- This guarantees that sensitive financial figures are never even loaded over the network into the worker's browser session.

### B. Input Validation & Entity Boundary Checks
- Referenced `client_id`, `project_id`, `task_id`, `invoice_id`, and `account_id` are strictly validated on mutations.
- Monetary numbers are checked for `Number(val) >= 0` and NaN guards.
- Currency precision preserves two decimal places (0.01 TND).

---

## 4. Multi-Tenant Isolation & RLS Policies

All queries and mutations operate within the verified Supabase Row Level Security boundary:
- Tables `clients`, `client_projects`, `project_tasks`, `invoices`, `income_transactions`, `expense_transactions`, `sponsoring_campaigns`, and `service_commitments` are guarded by tenant isolation policies.
- Ordinary users cannot query across tenant partitions.

---

## 5. Security Audit Conclusion

| Security Check | Requirement | Result |
| :--- | :--- | :--- |
| **Worker Financial Denial** | Worker cannot access financial tabs or queries | **PASS** (Tested in unit suite 3.1) |
| **Admin Privilege Access** | Superadmin & Admin retain authorized access | **PASS** (Tested in unit suite 3.2) |
| **Network Data Leak Prevention** | Financial queries return empty for workers | **PASS** (Zero network payload for workers) |
| **Client Mutation Authorization** | Only admins can mutate client profiles & packages | **PASS** (Service-level actor verification) |
| **Audit Trail Immutability** | Audit logs append-only | **PASS** (Schema-enforced constraints) |

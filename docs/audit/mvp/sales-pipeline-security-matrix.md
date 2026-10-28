# SADA OS — Sales Pipeline Security & Permission Matrix

## 1. Executive Summary

This security matrix outlines the granular role-based access control (RBAC), Row-Level Security (RLS) enforcement, worker data isolation boundaries, and audit logging for the **SADA OS Sales Pipeline**.

---

## 2. Granular Permissions Definition

| Permission Key | Description | Allowed Roles | Enforced At |
| :--- | :--- | :--- | :--- |
| `sales.view` | Access to the Sales workspace and read pipeline data | `super_admin`, `admin`, `worker` (scoped) | Route guard & UI layer |
| `sales.create_lead` | Ability to submit new deals/opportunities | `super_admin`, `admin`, `worker` | `createDeal` & DB RLS |
| `sales.edit_lead` | Update deal title, contact, package, value, and stage | `super_admin`, `admin`, `worker` (own deals only) | `updateDeal` & DB RLS |
| `sales.change_stage` | Move deals between pipeline stages | `super_admin`, `admin`, `worker` (own deals only) | `updateLeadStage` & DB RLS |
| `sales.convert_lead` | Execute `convert_lead_to_sale` RPC | `super_admin`, `admin`, `worker` (own deals only) | `convertLeadToSale` & DB RPC |
| `sales.delete_lead` | Permanently delete deals from `public.deals` | `super_admin` **STRICTLY EXCLUSIVE** | `deleteDeal` & DB RLS |
| `sales.approve_commission` | Transition commission from pending to approved | `super_admin`, `admin` (Self-approval blocked) | `approveCommission` |
| `sales.payout_commission` | Transition commission from approved to paid | `super_admin`, `admin` | `payoutCommission` |

---

## 3. Worker Data Scope & Isolation Boundary

1. **Row-Level Security (RLS) on `public.deals`:**
   - Super Admin & Admin: Full visibility across all agency deals.
   - Workers: Conditioned on `sales_owner_id = auth.uid()` OR `commission_recipient_id IN (SELECT id FROM team_members WHERE profile_id = auth.uid())`.
   - Direct database queries executed by unauthorized callers return 0 rows.
2. **Assignment Forgery Protection:**
   - In `updateDeal`, if caller role is `worker`, attempts to manipulate `sales_owner_id` are stripped from the update payload.
3. **Self-Commission Approval Protection:**
   - Admins cannot approve their own commissions; the UI displays an "Awaiting Admin" badge, and server mutation validates actor identity against the commission's `team_member_id`.

---

## 4. Multi-Tenant Safety & Guard Protection

- The project targets Supabase instance `mtfkzabiscyleztypqks.supabase.co`.
- `scripts/test-db-guard.ts` verifies that mutation tests fail closed against the shared database.
- Read-only queries executed during discovery and verification do not mutate any live records.
- Zero synthetic deals or test accounts seeded into the shared environment.

---

## 5. Audit Trail & Compliance Logging

All sensitive sales mutations invoke `logSystemAudit` to record events in `public.system_audit_logs`:
- `DEAL_STAGE_CHANGE`: Records `fromStage` and `newStage` with actor ID and role.
- `DEAL_CONVERTED_TO_SALE`: Records sale amount, sponsoring budget, client ID, and actor.
- `DEAL_DELETION`: Records permanent removal with full deal snapshot in metadata.
- Non-blocking telemetry guarantees that audit log storage errors never abort valid primary business transactions.

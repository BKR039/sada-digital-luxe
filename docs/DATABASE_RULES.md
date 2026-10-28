# SADA Database Rules

Rules distilled from the actual migration history in `supabase/migrations/` — follow these for any future schema work. Reference schema itself lives in `docs/SADA_ARCHITECTURE.md` / `docs/SADA_PROJECT_CMS.md`; this file is the *rules*, not the current tables.

## Migrations

- Every schema change is a new, timestamp-prefixed file in `supabase/migrations/` — never hand-edit an existing migration.
- Prefer `ADD COLUMN IF NOT EXISTS` / idempotent statements (the existing history does this consistently) so migrations are safe to re-run.
- Seed data belongs in its own migration, clearly commented as seed data — and must be real, verified content (see `.memory/06_clients.md`; the one existing seed migration violates this and is tracked as a known issue).

## Row Level Security

- **RLS is enabled on every table, no exceptions.**
- Public read policies are scoped to `published = true` (or equivalent) — never expose unpublished/draft rows via a public policy.
- Admin write access is gated through `public.is_admin(auth.uid())` / `public.has_role(user_id, role)`, both `SECURITY DEFINER SQL` functions — reuse these, don't write new ad hoc role checks.
- `SECURITY DEFINER` functions must pin `SET search_path = public` and have `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`, granted only to `service_role` (done in migration `20260712160521` — follow this pattern for any new one).
- Public `INSERT` policies (e.g. `contact_submissions`) must use `WITH CHECK` column-length/shape constraints — never `WITH CHECK (true)`.
- **Legacy permissive RLS policies must be explicitly dropped** when introducing stricter role-based policies because PostgreSQL combines permissive policies with `OR` semantics. A wider legacy policy will silently bypass newer restrictive policies.


## Financial & Compensation Single Source of Truth

- **Authoritative Compensation Record**: `public.salary_payments` is the canonical record for employee salary disbursements and advances.
- **Canonical Outflow Mirroring**: When a salary payment or advance is executed/approved, a corresponding outflow row is created in `public.expense_transactions` referencing `salary_payment_id`. There are never two independent sources of truth; company expenses aggregate directly from `expense_transactions`.
- **Worker Financial Isolation**:
  - `income_transactions`, `expense_transactions`, `subscriptions`, and `financial_audit_logs` are strictly Super Admin only (`is_super_admin(auth.uid())`).
  - Workers can only view their own `salary_records`, `salary_payments`, and `salary_requests` where `team_member_id = public.get_team_member_id(auth.uid())`.
  - Workers can only insert `salary_requests` with `status = 'pending'` and their own `team_member_id`. Workers have no `UPDATE` or `DELETE` permissions on `salary_requests`.
  - Super Admin is the sole role authorized to review, approve, or reject salary advance requests (`is_super_admin(auth.uid())`).

## Storage

- Media goes in the existing public `media` bucket — don't create new buckets without a reason.
- Admin-only `INSERT`/`UPDATE`/`DELETE` via `is_admin(auth.uid())`; public bucket URLs resolve directly, but object *listing* should stay blocked (see migration `20260712160521`).
- Never store media as base64 in a database column — URLs only.

## Access patterns

- Client-side Supabase access uses the publishable key (`src/integrations/supabase/client.ts`) — RLS is the real security boundary, not the client.
- Server-only privileged operations use the service-role client (`src/integrations/supabase/client.server.ts`) — never import this into client-rendered code.
## Audit Records Immutability & Referential Integrity

- **Strict Append-Only Invariant**: Audit records in `system_audit_logs` and `account_audit_logs` are immutable telemetry. Direct `DELETE` and direct manual `UPDATE` are unconditionally rejected by database triggers.
- **Referential Integrity on Account Deletion**: The foreign key constraints on `actor_id` specify `REFERENCES auth.users(id) ON DELETE SET NULL`.
- **Permitted Transition**: `public.prevent_audit_log_update()` is enforced as a `BEFORE UPDATE FOR EACH ROW` trigger. It permits exclusively the PostgreSQL engine referential action where `OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL`, while asserting that all other audit fields (`action`, `created_at`, `entity_type`, `entity_id`, `actor_name`, `actor_email`, `metadata`, `old_values`, `new_values`) remain completely unaltered.
- **Row-Level Trigger Requirement**: Immutability triggers on audit tables must be `FOR EACH ROW` so that row-level column delta checks (`OLD` vs `NEW`) can distinguish referential nullification from unauthorized data mutations.

## Resolved

`projects.results` vs `projects.results_summary` — `results` is the authoritative qualitative-results field; quantitative results live in `projects.metrics` (jsonb array of `{ value, label, source?, period? }`). `results_summary` is confirmed dead (no code reads/writes it) but left in place. See `.memory/11_known_issues.md`.


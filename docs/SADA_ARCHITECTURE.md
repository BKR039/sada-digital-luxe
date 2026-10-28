# SADA Architecture

Repo root: `SADA Website/sada-digital-luxe/` (package name in `package.json`: `tanstack_start_ts`; Wrangler app name: `tanstack-start-app` — cosmetic leftovers from scaffolding, not renamed).

## Stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (`@tanstack/react-start`) + TanStack Router (file-based routes) |
| UI library | React 19 |
| Language | TypeScript |
| Build tool | Vite 7, via `@lovable.dev/vite-tanstack-config` wrapper (bundles TanStack Start, React, Tailwind, tsconfig-paths, Cloudflare, and sandbox-detection plugins — do not add these manually, see comment in `vite.config.ts`) |
| Server runtime | Nitro (via TanStack Start), custom `src/server.ts` SSR entry that wraps the generated server entry to catch and brand 500 errors |
| Styling | Tailwind CSS v4, CSS-first config (`@theme inline` in `src/styles.css`, no `tailwind.config.js`) + `tw-animate-css` |
| UI components | shadcn/ui ("new-york" style) on Radix UI primitives, `lucide-react` icons |
| Animation | `framer-motion` |
| Forms/validation | `react-hook-form` + `zod` + `@hookform/resolvers` |
| Data fetching | `@tanstack/react-query` |
| Database / Auth / Storage | Supabase (Postgres + RLS, Auth, Storage) — provisioned via the Lovable Cloud platform |
| Deployment target | Cloudflare Workers, via `@cloudflare/vite-plugin` + `wrangler.jsonc` (`compatibility_date: 2025-09-24`, `nodejs_compat`, entry `src/server.ts`) |
| Dev platform | Built/maintained through Lovable.dev tooling (`@lovable.dev/vite-tanstack-config` devDependency, `.lovable/project.json`, AI features call `ai.gateway.lovable.dev`) |
| Package manager | `bun` (`bun.lock` present); a `package-lock.json` also exists in the repo — two lockfiles present, confirm which one is authoritative before assuming npm |

## Repository Structure

```
sada-digital-luxe/
  src/
    routes/          file-based routes (public + /admin/* + /auth)
    components/
      ui/             shadcn/ui primitives
      site/           header, footer, hero, and other public page sections
      admin/           CrudPage.tsx (generic admin CRUD)
      media/           SmartMedia, MediaUpload(Multi), MediaGallery
    lib/              auth.tsx, theme.tsx, site-settings.ts, error-capture.ts, error-page.ts, utils.ts
    integrations/supabase/   client.ts, client.server.ts, auth-attacher.ts, auth-middleware.ts, types.ts
    data/             services.ts, team.ts (static content — see SADA_CONTENT.md conflict note)
    styles.css        design tokens (Tailwind v4 @theme + CSS vars)
    router.tsx, server.ts, start.ts
  supabase/
    migrations/       chronological SQL migrations (schema + RLS + seed)
    functions/chat/    Deno edge function — AI Assistant chat proxy
    config.toml
  public/             static assets (currently just favicon.ico)
  wrangler.jsonc, vite.config.ts, components.json, tsconfig.json
```

## Routing

TanStack Router, file-based, root shell in `src/routes/__root.tsx` (global `<head>` meta/fonts, `QueryClientProvider` → `ThemeProvider` → `AuthProvider` → `SiteLayout`, 404 and error-boundary components).

`SiteLayout` (`src/components/site/SiteLayout.tsx`) renders `Header` + page `Outlet` + `Footer` + lazy `AIAssistant` for all public routes, and is bypassed (bare `Outlet`) for `/admin/*`, `/sada-os`, and `/auth`. Public chrome contains zero administrative links or buttons (eradicated from desktop header, mobile menu, footer, and CTAs).

Public routes: `/`, `/services`, `/case-studies`, `/case-studies/$slug`, `/store`, `/store/$id`, `/products` (redirects to `/store`), `/products/$id` (redirects to `/store/$id`), `/pricing`, `/about`, `/contact`, `/blog`, `/blog/$slug` (blog hidden by feature flag, see SADA_CONTENT.md), `/auth`.

Protected Application Entry Point (Defense-in-Depth):
- `/sada-os` (`src/routes/sada-os.tsx`): Obscure canonical entry point and module launchpad for SADA OS operators. Enforces `beforeLoad` authentication check, session resolution, RBAC validation via `ModuleAccessShield`, role badge styling, and module launchpad directing authorized operators to their permitted subsystems. Direct unauthenticated hits to `/admin` redirect silently to `/` (home page) rather than disclosing login endpoints.

Admin routes (all under `/admin`, layout in `admin.tsx`):
- `/admin` (dual-mode operational command center: **MY EXECUTION** for personal task prioritization, today's schedule, and individual workload; **AGENCY OVERSIGHT** for agency-wide exception control surfacing overdue work, blocked tasks, unassigned tasks, client-delayed projects with explicit Project Lead context, and unified team pulse)
- `/admin/clients` (Canonical Client Directory: view mode toggle between Canonical Table View and Cards View; table with exact 10 columns: Name, Industry, Account Manager, Sales Owner, Package, Monthly Revenue, Sponsoring Budget, Payment Status, Client Health, Active/Inactive, plus Actions; 2-step Add Client modal supporting ownership and financial parameters)
- `/admin/clients/$id` (Canonical Client Workspace: complete 11-tab operational architecture: Overview, Financial [dynamic Financial OS integration], Package [quotas & cycle progress], Deliverables [active cycle deliverables], Tasks [status filterable execution queue], Production [creative pipeline stages], Sponsoring [paid campaigns, ad spend, and margins], Invoices [billing statements & settlement], Payments [transaction ledger], Notes [interactive real-time editor], Performance [completion velocity & health ratings])
- `/admin/deals` (Sales Pipeline Command Center: 8 canonical pipeline stages from Lead to Won/Lost, Kanban board and tabular views, stage value summaries, deal creation modal, and Deal → Won transition engine linking clients, packages, recurring agreements, invoices, deliverables, and sales commissions)
- `/admin/client-projects` (client projects list with status filters, progress bars, and new project creation)
- `/admin/client-projects/$id` (project workspace: Kanban board, checklist view, metadata editor, activity timeline, task creation, direct link back to client CRM workspace)
- `/admin/calendar` (agency task calendar with month/week/day views, priority and status color coding)
- `/admin/team-workload` (team workload overview, capacity analysis, and overdue task alerts)
- `/admin/projects` (layout in `admin.projects.tsx`), `/admin/projects/` (Case Studies CMS management list in `admin.projects.index.tsx` with search, status filter pills, instant publish/featured toggles, and Super Admin delete modal), `/admin/projects/$id` (dedicated full-page case study editorial workspace in `admin.projects.$id.tsx` with 8 structured sections: Overview, Story, Services, Results, Media, Team, Testimonial, SEO; draft saving, preview mode, and publish validation checklist)
- `/admin/reels` (Social Reels CMS workspace with single-featured trigger, Instagram URL parser/validator, and draft isolation)
- `/admin/blog` (layout in `admin.blog.tsx`, editorial dashboard in `admin.blog.index.tsx`, full-page editor in `admin.blog.$id.tsx` with scheduled publishing and `ArticleContent` preview)
- `/admin/products` (layout in `admin.products.tsx`, management dashboard in `admin.products.index.tsx`, full-page editor in `admin.products.$id.tsx`)
- `/admin/testimonials` (layout in `admin.testimonials.tsx`, client proof list in `admin.testimonials.index.tsx`, full-page editor in `admin.testimonials.$id.tsx` with canonical links to CRM clients and Case Studies)
- `/admin/accounts` (exclusive Super Admin Account Management Center in `admin.accounts.tsx`: accessible strictly to `super_admin`; zero public self-registration; 4 canonical lifecycle states: `active`, `suspended`, `pending`, `disabled`; ephemeral password reset desk; self-management; Super Admin lockout protection; and immutable `account_audit_logs`)
- `/admin/my-work` (Personal Execution & Live Time Engine in `admin.my-work.tsx`: individual task execution queue, overdue exceptions, and live stopwatch Time & Session Engine tracking Production vs. Administrative hours with cost propagation)
- `/admin/packages` (Canonical Package Catalog & Pricing CMS in `admin.packages.tsx`: single source of truth for all public and internal packages; category management, live preview tab, dynamic feature library & builder, duplicate package modal, 24 canonical master packages, 12 master add-ons, and granular publishing controls)
- `/admin/finance` (Super Admin Financial Command Center in `admin.finance.tsx`: cash flow monitoring, inflow/outflow transactions, 9 canonical expense categories, subscriptions tracker, team salary management, early salary request approval desk, and CSV export)
- `/admin/my-salary` (Worker Compensation Center in `admin.my-salary.tsx`: strictly isolated worker view of personal compensation, hourly cost rate, commission earnings, tracked hours breakdown with production vs. admin separation, upcoming payout date, payment history, and early payment request desk)
- `/admin/analytics` (Management Analytics, KPIs & Reporting Command Center in `admin.analytics.tsx`: 10 core analytics domains derived from canonical Financial OS data, interactive source-record drill-down engine, CSV reporting export, Notification Center popover, user preferences, and immutable system audit log trail)

### Admin Shell Architectural Invariants (`src/routes/admin.tsx`, `src/styles.css`)

The Admin application shell enforces a deterministic, responsive layout with zero content overlap and bidirectional (LTR/RTL) logical symmetry:
1. **Desktop Viewport ($\ge 768\text{px}$):**
   - Persistent sidebar rendered in normal flex document flow (`position: relative !important; width: 280px !important; flex-shrink: 0 !important; transform: none !important; visibility: visible !important;`).
   - Main content viewport rendered beside the sidebar (`flex: 1 1 0% !important; min-width: 0 !important; height: 100dvh; overflow-y: auto; overflow-x: hidden;`). `min-width: 0` is strictly enforced to prevent table, grid, or wide chart blowouts from expanding the container and pushing the sidebar off-screen.
2. **Mobile Viewport ($< 768\text{px}$):**
   - Sidebar transforms into a responsive overlay drawer (`position: fixed !important; top: 0; bottom: 0; inset-inline-start: 0; z-index: 50; box-shadow: var(--shadow-elevated);`).
   - Off-screen state: `transform: translateX(-100%)` (LTR) / `transform: translateX(100%)` (RTL) with `visibility: hidden; pointer-events: none;` to eliminate focus trapping and gesture interception.
   - Open state: `transform: translateX(0) !important; visibility: visible !important; pointer-events: auto !important;`.
   - Drawer dismissal: Toggled via mobile hamburger button (`start-4 top-3.5`), backdrop overlay click (`fixed inset-0 z-40 bg-foreground/30`), dedicated internal close button (`md:hidden` `<X />` in drawer header to prevent collision with Logo link), and route change or nav item click (`onClick={() => setSidebarOpen(false)}`).
3. **Bidirectional Symmetry (LTR / RTL):**
   - Uses logical properties: `border-inline-end: 1px solid var(--border)` for border separation, `inset-inline-start: 0` for drawer anchor, and logical padding (`pe-1`, `pe-2`).
   - When Arabic is active (`dir="rtl"`): Flex direction naturally reverses, placing the sidebar on the right and main content on the left, with mirrored slide animation.
4. **Global Controls & Typography:**
   - Global Theme Switcher (Light / Dark) and Language Switcher (English / Arabic) are powered by the root providers (`ThemeProvider` and `I18nProvider`) and exposed in the sidebar footer.
   - Arabic UI renders with **Thmanyah Serif Text** typography (weights 300, 400, 500, 700, 900). English typography (Sora + Manrope) remains completely unchanged.

## Shared Components

See `docs/SADA_DESIGN_SYSTEM.md` → Components section for the full breakdown of `ui/`, `site/`, `admin/`, `media/`.
Client Project components live in `src/components/admin/client-projects/` (`ProjectProgressBar`, `TaskCard`, `TaskModal`, `ConvertToProjectModal`, `CalendarGrid`, `ActivityTimeline`, `project-utils.ts`).
Content CMS components live in `src/components/admin/content/` (`ContentShell.tsx`, `ContentEditorShell.tsx`, `content-utils.ts`).

## Design Tokens

`src/styles.css` (Tailwind v4 `@theme inline` block + `:root`/`.dark` CSS custom properties). shadcn config: `components.json`.

## Authentication & 3-Tier RBAC

Supabase Auth, email + password. 3-tier role model: `super_admin`, `admin`, `worker`.

- **Client-side & UI:** `src/lib/auth.tsx` tracks session and role; `src/lib/permissions.ts` provides fine-grained capability checks (`canDeleteTask`, `canDeleteProject`, `canDeleteClient`, `canCreateClient`, `canEditClient`, `canViewClient`, etc.).
- **Server-side enforcement:** all sensitive tables have Postgres RLS policies gated on `public.has_sada_access(auth.uid())` (read access for workers, admins, super admins), `public.is_admin(auth.uid())` (write/edit/assign for admins and super admins), and `public.is_super_admin(auth.uid())` (permanent delete for super admins only).
- **Deletion Safety:** `client_projects.client_id` enforces `ON DELETE RESTRICT` to protect historical operational data from accidental cascade deletion.

## Database

Supabase Postgres, RLS enabled on every table. See `docs/SADA_PROJECT_CMS.md` for the full `projects` schema.

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`, auto-created via `handle_new_user` trigger |
| `user_roles` | `(user_id, role)` where role ∈ `super_admin, admin, worker`; backs `is_super_admin()`, `is_admin()`, `has_sada_access()` |
| `clients` | Canonical CRM client identity (name, contact_name, email, phone, preferred_channel, website, industry, notes, status ['prospect','active','inactive','archived'], relationship_owner_id FK to profiles(id), created_at, updated_at). RLS: `has_sada_access` read, `is_admin` insert/update, `is_super_admin` delete |
| `projects` | Case studies / portfolio (public-facing) — see SADA_PROJECT_CMS.md |
| `client_projects` | Internal client project delivery & operations tracking (client_id FK to clients(id) ON DELETE RESTRICT, client name, title, status, description, business_type, goals, problems, requested_services, provided_services, timeline, budget, deadline, start_date, lead_id FK to profiles(id) explicit project lead, followup_status, next_followup_date, followup_owner_id, computed progress percentage, contact_submission_id foreign key) |
| `project_tasks` | Individual project execution tasks & deliverables (project_id FK, title, description, category/phase, service, assignee_id FK, previous_assignee_id FK, handoff_reason, priority, status ['todo','in_progress','review','blocked','done','postponed','cancelled'], waiting_on ['client','team'], blocked_reason, deadline, start_date, end_date, estimated/actual minutes, notes, result_title, result_links, result_notes, completed_at [database trigger-enforced on 'done'], sort_order, commitment_id FK, occurrence_date, sequence_index, idempotency_key, deliverable_id FK, source_type ['manual','recurring_schedule','package_reconciliation','workflow'], is_reconciliation_managed, manual_override, cancelled_reason) |
| `project_activity` | Audit log of project operations (project_id FK, task_id FK, actor_id FK, action ['created','status_changed','completed','postponed','blocked','reassigned','deliverable_added','note_added','services_updated'], details jsonb, created_at) |
| `team_members` | name, position, bio, photo_url, socials (jsonb), role, profile_id FK to profiles(id), featured, published, sort_order |
| `blog_posts` | title, slug, excerpt, content, cover_url, cover_alt, category, tags, author, reading_minutes, seo_title, seo_description, og_image_url, featured, published, published_at |
| `products` | title, slug, description, full_description, price, currency, thumbnail_url, gallery, includes, features, audience, details, preview_url, cta_label, gumroad_url, category, featured, published, sort_order, seo_title, seo_description, og_image_url |
| `testimonials` | client_name, company, role, photo_url, review, short_quote, rating, language, service, featured, client_id FK to clients(id), project_id FK to projects(id), published, sort_order, updated_at |
| `contact_submissions` | client_id FK to clients(id) ON DELETE SET NULL, name, email, phone, business_name, service, budget, message, status, converted_project_id, discovery_data (jsonb structured brief), preferred_contact, path_taken ('guided', 'quick', 'free_text') — public `INSERT` allowed with column constraints; admin-only read/update/delete |
| `client_communication_logs` | client_id FK to clients(id), project_id FK, type, channel, summary, details, logged_by, date |
| `site_settings` | `(key, enabled)` feature flags, e.g. `blog` — publicly readable, admin-writable |
| `account_audit_logs` | Immutable audit log of all account creation, role changes, suspensions, reactivations, password resets, and deletions (actor_id, target_user_id, action, metadata, created_at). Read/Insert restricted to Super Admin |
| `salary_records` | Team member base compensation, payment frequency, currency, effective date. RLS: Super Admin manage, worker view-own |
| `salary_payments` | Authoritative single source of truth for salary and advance disbursements. RLS: Super Admin manage, worker view-own |
| `salary_requests` | Worker early payment advance requests and Super Admin approval/rejection lifecycle. RLS: Worker submit/view-own, Super Admin review/approve |
| `expense_categories` | Canonical agency expense categories (color, icon, sort_order). RLS: Super Admin only |
| `expense_transactions` | Operational outflow transactions mirrored to salary_payments on payroll payouts. RLS: Super Admin only |
| `income_transactions` | Inflow revenue transactions and client payments. RLS: Super Admin only |
| `subscriptions` | Recurring software and SaaS tools subscription tracker. RLS: Super Admin only |
| `notifications` | Role-aware event-driven notification queue (user_id FK to auth.users, role_target, event_type, category, priority, link_url, read, read_at). RLS: Super Admin, Admins (operational), Workers (isolated personal & broadcasts) |
| `notification_preferences` | User-configurable opt-in/out toggles for 13 event types. RLS: User view/edit-own |
| `system_audit_logs` | Unified immutable system audit trail for security-critical operations (actor_id FK to profiles, action, entity_type, entity_id, old_values, new_values, metadata, created_at). Database trigger `prevent_audit_log_deletion()` blocks DELETE permanently |
| `reconciliation_audit_logs` | Dedicated audit log for package and work reconciliation runs (client_id FK, actor_id, run_mode, tasks_created, tasks_pruned, tasks_rescheduled, manual_preserved, details jsonb, created_at). RLS: Super Admin & Admin read/insert |

Migration history lives in `supabase/migrations/` (timestamp-prefixed). Always add new schema changes as a new migration file — never hand-edit an existing one.

## Storage

Single public Supabase Storage bucket: `media`. RLS: public `SELECT` on bucket contents was removed in a later migration (public bucket **URLs** still resolve directly; directory *listing* is blocked). `INSERT`/`UPDATE`/`DELETE` require `is_admin(auth.uid())`. Admin uploads go through `src/components/media/MediaUpload(Multi).tsx`; rendering goes through `src/components/media/SmartMedia.tsx` (handles both images and video).

## Admin (SADA Work OS)

`/admin/*`, gated client-side by `useAuth().isAdmin` with a redirect to `/auth` if signed out and an "Admin access required" panel if signed in but not an admin (real enforcement is DB-side RLS, see Authentication above).
- **Daily Operations Command (`/admin`)**: Command center with Today's strip (due today, overdue, active projects, in progress, review/blocked), "My Work" personalized daily task guide, "Team Today" active workload radar, deterministic Project Health radar, and upcoming milestones.
- **Client Projects Workspace (`/admin/client-projects`)**: "What are we working on right now?" Multi-view (List, Board, Timeline), period toolbar `[ Previous ] [ Current Month Year ] [ Next ]` with relative periods (Today, This Week, This Month, Next Month, This Quarter, Custom Range, All Time), fast debounced search, and deterministic project health (`ON TRACK`, `AT RISK`, `OVERDUE`, `ON HOLD`, `COMPLETED`).
- **Project Command Center (`/admin/client-projects/$id`)**: Complete project command center with 8 unified tabs:
  1. *Overview*: client info, delivery period countdown, and Requested Services vs. Provided Services editor (Marketing, Development, Production).
  2. *Progress*: visual phase completion breakdown with per-phase progress bars and task counts.
  3. *Tasks*: filterable task list (status, priority, phase, search) with inline status toggle and full modal editing.
  4. *Timeline*: sequential task delivery schedule from kickoff to deadline.
  5. *Calendar*: embedded in-project task schedule.
  6. *Deliverables*: aggregated completed deliverables hub displaying result titles, clickable links (`[Open Result ↗]`), and sign-off notes.
  7. *Notes*: internal collaborative remarks and task notes repository.
  8. *Activity*: full audit history from `project_activity` (status changes, handoffs with reasons, postponements, deliverables added).
- **Task Management & Execution (`TaskCard`, `TaskModal`)**: Support for deliverables (`result_title`, `result_links`, `result_notes`), handoff tracking (`previous_assignee_id`, `handoff_reason`), postponement enforcement (new date + reason), and blocked states (`waiting_on: client | team` + `blocked_reason`).
- **Team Workload (`/admin/team-workload`)**: Live task load intensity per member (today, upcoming, overdue, in progress, high/urgent, completed today) with direct task management.
- **Financial Command Center (`/admin/finance`)**: Restricted strictly to Super Admin. Comprehensive company accounting command center:
  - *Summary KPIs*: Total Inflow, Total Outflows, Net Operating Margin, Total Salaries Paid, and Recurring SaaS Burn, calculated dynamically across selectable financial periods (This Month, Last Month, This Quarter, This Year, Custom Range) with previous period deltas.
  - *Cash Flow Velocity Chart & Expense Category Breakdown*: Inflow vs. Outflow monthly distribution with visual categorical allocation.
  - *Deterministic Smart Insights*: 0-fabrication financial intelligence signals evaluating cash flow status, primary expense categories, payroll allocation share, and pending salary requests.
  - *Inflow / Income Management*: Canonical inflow records linked to clients (`client_id`) and client projects (`project_id`).
  - *Outflow / Expense Management*: Categorized expenditures across 9 system categories, payment methods, recurring flags, and receipt attachments.
  - *Salaries Management*: Team member compensation records, contract fees, payment schedules, and 1-click payouts.
  - *Salary Requests Desk*: Approval queue for worker early payout requests with approval/rejection notes.
  - *Recurring Subscriptions*: Active SaaS burn tracker with 1-click expense transaction recording.
  - *Immutable Audit Trail*: Full mutation log capturing actors, actions, and before/after details.
  - *CSV Export*: Period-filtered financial records export for tax and accounting.
- **Worker Salary Center (`/admin/my-salary`)**: Dedicated, strictly isolated compensation center for workers:
  - *Personal Compensation Summary*: Base salary, salary type, and scheduled next payout date.
  - *Payout History*: Personal salary payments and advances with payment methods and reference IDs.
  - *Early Advance Requests*: Worker self-service form to request early compensation with requested date, reason, and notes.
  - *Strict Role Isolation*: Workers are prevented by Postgres RLS from accessing company income, company expenses, company profits, subscriptions, audit logs, or other workers' compensation records.
- **Content CMS**: CRUD screens (`admin.projects.tsx`, `admin.blog.tsx`, `admin.products.tsx`, `admin.testimonials.tsx`) wrapping `src/components/admin/CrudPage.tsx`.

## Public Website

Main public routes listed under Routing above. Homepage (`routes/index.tsx`) lazy-loads all below-the-fold sections (`Stats`, `TrustedBy`, `Services`, `FeaturedProjects`, `About`, `Testimonials`, `CTA`) behind `Suspense`, only `Hero` renders eagerly.

## SEO

Per-route `head()` returning TanStack Router meta (title, description, `og:*`, `twitter:*`, canonical `<link>`). `/case-studies/$slug` builds its meta dynamically from loader data (client name, description, cover image) — use this as the template for any new dynamic detail route.

## Environment Variables (names only)

From `.env` (present in the repo and **not** listed in `.gitignore` — flag this; typically fine for `VITE_`-prefixed public values but risky if a real secret is ever added to this file):

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

Referenced in code but not present in the local `.env` sample (must be set as deployment/runtime secrets, not local dev vars):

- `SUPABASE_SERVICE_ROLE_KEY` — used only in `src/integrations/supabase/client.server.ts`, server-only, bypasses RLS. Never expose to client code.
- `LOVABLE_API_KEY` — used only in `supabase/functions/chat/index.ts` (Supabase Edge Function secret, not a site build var).

No values are recorded anywhere in this documentation.

## Phase 10: Production Hardening, System Integrity & UX Standards

Phase 10 hardens the entire application across security, financial integrity, UX, and operational reliability:

1. **Authentication & Session Hardening (`src/lib/auth.tsx`)**:
   - `resolveRole` performs instantaneous session validation.
   - Any profile with status `suspended`, `disabled`, or `deleted` is immediately expelled from the session, signout is triggered, and clear feedback is rendered.
   - Public self-registration is permanently disabled; account lifecycle is strictly controlled by Super Admin via `/admin/accounts`.

2. **Route Authorization Shields & Defense-in-Depth (`src/lib/permissions.ts`, `src/routes/admin.*.tsx`)**:
   - UI Route Shields: Directly navigating to restricted URLs (`/admin/finance`, `/admin/analytics`, `/admin/deals`, `/admin/contact`, `/admin/accounts`) as an unauthorized role (e.g. `worker`) renders an explicit `ShieldAlert` Restricted Access view and completely suppresses underlying data fetch queries.
   - Client CRM Isolation: On `/admin/clients` and `/admin/clients/$id`, financial tabs (`financial`, `invoices`, `payments`, `sponsoring`, `performance`), revenue totals, and health ratings are stripped for workers and replaced with operational deliverables, tasks, and project milestones.
   - Postgres RLS: Even if frontend guards are bypassed, database RLS ensures zero rows are returned from `financial_accounts`, `income_transactions`, `expense_transactions`, `invoices`, and `financial_audit_logs`.

3. **Financial Integrity & Validation Engine (`src/lib/finance-service.ts`)**:
   - Canonical calculations strictly enforced: Contribution Profit, Gross Profit, Net Profit, and Cash Flow. Profit is rigorously separated from Cash (`Profit != Cash`).
   - Mutation guards: Reject amounts $\le 0$, negative invoice totals, impossible sponsoring budgets, and out-of-range commissions ($0\% \le \text{rate} \le 100\%$).
   - Period Closing & Reopening: Monthly closing locks historical records; reopening requires Super Admin identity, mandatory business justification, and immutable audit logging.

4. **Event Deduplication & Notification Engine (`src/lib/notification-service.ts`)**:
   - 24-hour rolling deduplication window prevents duplicate alert spam for the same event and entity.
   - Role-targeted event delivery across all 13 Phase 8 events.

5. **RBAC-Aware Lightweight Global Search (`src/components/admin/GlobalSearchModal.tsx`)**:
   - Universal search triggered via `Ctrl+K` / `Cmd+K` and sidebar/header action buttons.
   - Indexes Clients, Workspaces, Tasks, and Team Members.
   - Invoices and Financial Transactions are dynamically pruned from search results for workers and non-finance roles.

6. **Bilingual Thmanyah Serif Text Typography & Theme Parity**:
   - Global Arabic typography powered by canonical Thmanyah Serif Text `@font-face` definitions (300, 400, 500, 700, 900) with dynamic preloading on `lang="ar"` / `dir="rtl"`.
   - Complete dictionary parity across English and Arabic (`deals`, `analytics`, `operations`, etc.).
   - Full theme token coverage across light and dark modes.

## Phase 12: Centralized Configurable Business Rules Engine & Governance

Phase 12 centralizes all agency business rules, thresholds, commission models, and operational parameters into an authoritative, database-backed governance engine:

1. **Authoritative Source of Truth (`public.business_rules`)**:
   - Stores all configurable policy rules with typed values (`numeric_value`, `boolean_value`, `text_value`, `json_value`), operator (`<`, `>`, `<=`, `>=`, `=`, `between`), severity (`info`, `warning`, `critical`), and factory defaults.
   - 21 canonical seeded rules across 8 operational domains: Sales & Commissions, Sponsoring FX, Profitability, Cash & Treasury, Fixed Burn, Smart Insights, Alerts & Deduplication, and Operations.

2. **Automated Immutable Versioning (`public.business_rule_versions`)**:
   - PostgreSQL trigger `archive_business_rule_version()` automatically records `NEW.version`, `previous_value`, `new_value`, `change_reason`, and `changed_by` on every update.
   - Database-level immutability enforced by trigger `prevent_rule_version_deletion()` rejecting any DELETE statements on historical records.
   - Canonical RPC `reset_business_rule_to_default()` restores factory values while incrementing the version and preserving full audit lineage.

3. **Database-Level Role Security (PostgreSQL RLS)**:
   - SELECT is accessible to authenticated users for rule consumption.
   - INSERT, UPDATE, and DELETE are strictly restricted to Super Admin via `is_super_admin(auth.uid())`.
   - Direct database / PostgREST mutations by Admins or Workers are blocked at the PostgreSQL engine level.

4. **Realtime WebSocket Cache Invalidation & Event Bus**:
   - `src/lib/business-rules-service.ts` maintains an in-memory cache with instantaneous invalidation via Supabase Realtime `postgres_changes` on `public.business_rules`.
   - Client event bus `window.dispatchEvent(new CustomEvent("sada:business-rule-updated"))` triggers reactive updates across all mounted components without requiring browser reloads or code deployments.
   - Robust clock-skew tolerance in `isRuleCurrentlyEffective()` accommodates sub-second server-client time variations.

5. **Universal Rule Consumption**:
   - **Sales Commission Engine**: Dynamic initial acquisition rate (`initial_sales_commission_rate`), duration stepping (`initial_commission_duration_months`), renewal rate (`renewal_sales_commission_rate`), and upsell rate (`upsell_sales_commission_rate`). Sponsoring/ad spend is 100% excluded from the commission base.
   - **Financial Sponsoring Engine**: Dynamic purchase FX rate (`sponsoring_purchase_rate`) and client FX rate (`sponsoring_client_rate`).
   - **Risk & Alert Engine**: Dynamic runway thresholds (`critical_runway_months`, `warning_runway_months`), receivables aging (`receivables_critical_days`), and salary advance limits (`max_salary_advance_percent`).
   - **Smart Insights Engine**: Dynamic margin checks (`low_profit_client_margin_percent`, `high_fixed_burn_revenue_percent`, etc.) with interpolated live threshold values in generated insight texts.
   - **Notification Engine**: Dynamic rolling deduplication window (`notification_deduplication_hours`).

## Phase 9 & 9.1: Mobile Web App, PWA Architecture & Production Closure

SADA OS provides a first-class, installable Progressive Web App (PWA) across Android, iOS Safari, and Chromium desktop as a single, unified codebase (zero separate mobile applications):

1. **Web App Manifest (`public/manifest.webmanifest`)**:
   - Authoritative identity: `"SADA OS — Travel & Creative Operating System"` (short: `"SADA OS"`).
   - Entry point: `start_url: "/sada-os"`.
   - Scope: `scope: "/"`. Scope `/` is intentionally required because the single-origin TanStack Router application encompasses the launcher gate (`/sada-os`), authentication (`/auth`), and operational workspaces (`/admin/*`). Restricting manifest scope to `/sada-os/` would force operator navigations to break out of standalone mode.
   - PWA scope is explicitly documented as **NOT** an authorization boundary.
   - SADA Dark Luxury design tokens: `background_color: "#07090E"`, `theme_color: "#07090E"`, `orientation: "portrait-primary"`.
   - 1-tap app shortcuts: `/admin/my-work` ("My Work Queue"), `/admin/calendar` ("Production Calendar"), and `/admin` ("Executive Overview").

2. **Production Service Worker (`public/sw.js`)**:
   - Explicit versioned cache identifier: `sada-os-pwa-v1`.
   - Pre-caches core app shell: `/`, `/manifest.webmanifest`, `/offline.html`, `/favicon.svg`, and vector icons.
   - **Data & Mutation Security**: All Supabase requests (`*.supabase.co`, `/rest/v1/`, `/auth/v1/`, `/storage/v1/`), cross-origin APIs, and non-GET mutations strictly bypass the service worker and execute directly against the network. Zero private user data or dynamic JSON responses are ever cached in static storage.
   - **Navigation Strategy**: Network-first with automatic fallback to `public/offline.html`.
   - **Static Assets**: Cache-first with network fallback for fonts, icons, and SVG assets.
   - Automatic stale cache eviction on `activate`.

3. **Offline Fallback Screen (`public/offline.html`)**:
   - Informational, generic static HTML fallback screen.
   - Full bilingual support with English and Arabic (RTL) status and interactive retry button (`window.location.reload()`).
   - Zero private data (contains no user names, tasks, clients, finances, or tokens).

4. **Web Push Classification & Boundaries**:
   - **Implemented Layers**:
     - Layer A: Service Worker push event receiver with haptic vibration patterns (`[200, 100, 200, 100, 300]` for urgent, `[100, 50, 100]` for normal) and `notificationclick` handler with window deduplication/focusing on `/admin` and `/sada-os`.
     - Layer B: Client subscription helper in `src/lib/pwa-service.ts` (`isWebPushSupported`, `requestPushPermission`, `subscribeToWebPush`).
   - **Layers Not Implemented**: Layer C (database push subscription persistence table) and Layer D (backend VAPID push delivery server).
   - Notification clicks are navigation, NOT authorization: any protected deep link continues to enforce SADA OS Route Shields, API guards, and PostgreSQL RLS.

5. **Mobile Ergonomics & Design System Compliance**:
   - Safe-area bottom navigation dock (`src/components/admin/SADAMobileBottomNav.tsx`) visible only on mobile (`md:hidden`) with `env(safe-area-inset-bottom)` home-bar padding.
   - Minimum 48px touch targets surpassing the 44px accessibility threshold.
   - Next Task 1-tap trigger targeting `#sada-next-task-card` in `src/routes/admin.my-work.tsx` with smooth scrolling.
   - PWA Install Banner (`src/components/admin/PWAInstallBanner.tsx`) with native prompt on Chromium, accessible 2-step `SADADialog` guide for iOS Safari, and `try/catch`-safe 7-day `localStorage` dismissal cooldown.
   - Zero native browser `<select>` or unstyled form controls sitewide.

## Development Rules

- Prefer existing architecture (TanStack Start conventions, generic `CrudPage`, existing Supabase clients) over introducing new patterns.
- Schema changes go through a new file in `supabase/migrations/`.
- Backend authorization is enforced via Postgres RLS (`is_admin()`/`has_role()`), not just UI conditionals — any new admin feature must ship with an RLS policy, not rely on `isAdmin` client state alone.
- Public users must never receive admin capabilities.

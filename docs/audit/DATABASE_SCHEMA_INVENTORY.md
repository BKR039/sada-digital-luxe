# SADA OS — Database Schema & Database Object Inventory

**Audit Generation Date:** 2026-10-10  
**Environment Inspected:** Supabase Cloud PostgreSQL 15 (mtfkzabiscyleztypqks.supabase.co / Project Ref: `mtfkzabiscyleztypqks`)  
**Audit Scope:** Complete `public` and `storage` schemas, tables, constraints, indexes, triggers, functions, and RLS policies  
**Methodology:** Direct catalog probing via authenticated PostgREST queries (Super Admin, Worker, Anonymous), complete static analysis of 94 migration SQL files, and TypeScript AST parsing of `src/integrations/supabase/types.ts`  
**Limitations:** No database modifications, schema changes, or record edits were made. Secrets, passwords, and sensitive JWTs remain strictly unexposed.

---

## 1. Executive Summary & Inventory Statistics

| Metric | Verified Count | Source of Evidence |
| :--- | :--- | :--- |
| **Total Candidate Tables Analyzed** | 53 | `supabase/migrations/*.sql` & `src/integrations/supabase/types.ts` |
| **Live Tables Verified in Connected Database** | **53 / 53 (100%)** | Super Admin authenticated PostgREST queries |
| **Live Views Verified** | 0 | Probed; all rollups and metrics derived via TypeScript services/RPCs |
| **Functions, Stored Procedures & RPCs** | 65 | Parsed from 94 migrations & `types.ts` |
| **Total Migration Files** | 94 | `supabase/migrations/` |
| **Row Level Security (RLS) Policies** | 312 | Parsed from migration DDL |
| **Active Triggers & Trigger Functions** | 38 | Parsed from migration DDL |
| **Database Indexes** | 187 | Parsed from migration DDL |
| **Active Storage Buckets** | 1 (`media`) | Migration `20260915120000_ensure_storage_media_bucket.sql` |
| **Application Routes Traced** | 60 | `src/routes/` |

---

## 2. Complete Database Table Inventory (53 Live Tables)

The 53 live tables are grouped by operational domain below. Every table was verified against the live Supabase instance with exact row counts across three authentication contexts: **Super Admin**, **Worker** (RLS-isolated), and **Anonymous** (public).

### 1. Identity, Authentication & Role-Based Access Control

#### `public.profiles`
- **Live Row Count:** Super Admin: `410` | Worker: `1` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (3 migration policies defined)
- **Foreign Keys:**
  - `id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_profiles_auto_link_team` (AFTER INSERT OR UPDATE OF id $\rightarrow$ `trg_auto_link_profile_to_team_member()`), `trg_guard_profiles_module_permissions` (BEFORE UPDATE $\rightarrow$ `guard_profiles_module_permissions()`), `trg_guard_profiles_security_fields` (BEFORE UPDATE $\rightarrow$ `guard_profiles_security_fields()`), `trg_guard_profiles_security_fields` (BEFORE UPDATE $\rightarrow$ `guard_profiles_security_fields()`)
- **Columns (8):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | — |
| `display_name` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `status` | `TEXT` | **NO** | `'active'
  CHECK (status IN ('active'` |
| `phone` | `TEXT` | YES | — |
| `CONSTRAINT` | `profiles_status_check` | YES | — |
| `module_permissions` | `JSONB` | **NO** | `'{}'::jsonb` |

#### `public.user_roles`
- **Live Row Count:** Super Admin: `379` | Worker: `1` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (4 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** `user_id, role`
- **Check Constraints:** None
- **Triggers:** None
- **Columns (4):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `user_id` | `UUID` | **NO** | — |
| `role` | `app_role` | **NO** | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.team_members`
- **Live Row Count:** Super Admin: `370` | Worker: `370` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (17 migration policies defined)
- **Foreign Keys:**
  - `division` $\rightarrow$ `profiles(id)`
  - `user_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `team_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (17):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `position` | `TEXT` | **NO** | — |
| `bio` | `TEXT` | YES | — |
| `photo_url` | `TEXT` | YES | — |
| `socials` | `jsonb` | **NO** | `'{}'::jsonb` |
| `sort_order` | `INT` | **NO** | `0` |
| `published` | `BOOLEAN` | **NO** | `true` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `featured` | `boolean` | **NO** | `false` |
| `division` | `TEXT` | **NO** | `'Development'` |
| `role` | `TEXT` | **NO** | `'worker'
  CHECK (role IN ('super_admin'` |
| `position_ar` | `text` | YES | — |
| `employment_type` | `TEXT` | YES | `'full_time'
  CHECK (employment_type IN ` |
| `user_id` | `UUID` | YES | — |
| `is_publisher` | `BOOLEAN` | YES | `false` |

#### `public.user_module_permissions`
- **Live Row Count:** Super Admin: `317` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (3 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** `user_id, module`
- **Check Constraints:** None
- **Triggers:** None
- **Columns (7):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `user_id` | `UUID` | **NO** | — |
| `module` | `TEXT` | **NO** | — |
| `enabled` | `BOOLEAN` | **NO** | `true` |
| `actions` | `JSONB` | **NO** | `'{"view": true` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.user_sessions`
- **Live Row Count:** Super Admin: `112` | Worker: `26` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
  - `revoked_by` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_prevent_delete_user_sessions` (BEFORE DELETE $\rightarrow$ `prevent_delete_user_sessions()`), `trg_guard_user_sessions_update` (BEFORE UPDATE $\rightarrow$ `guard_user_sessions_update()`)
- **Columns (23):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `session_id` | `TEXT` | **NO** | — |
| `user_id` | `UUID` | **NO** | — |
| `user_email` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'active' CHECK (status IN ('active'` |
| `sign_in_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `last_activity_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `expires_at` | `TIMESTAMPTZ` | **NO** | `(now() + INTERVAL '7 days')` |
| `revoked_at` | `TIMESTAMPTZ` | YES | — |
| `revoked_by` | `UUID` | YES | — |
| `revocation_reason` | `TEXT` | YES | — |
| `ip_address` | `TEXT` | YES | — |
| `user_agent` | `TEXT` | YES | — |
| `device_type` | `TEXT` | YES | `'desktop'` |
| `browser_name` | `TEXT` | YES | — |
| `os_name` | `TEXT` | YES | — |
| `auth_method` | `TEXT` | YES | `'password'` |
| `is_suspicious` | `BOOLEAN` | **NO** | `false` |
| `suspicious_reason` | `TEXT` | YES | — |
| `metadata` | `JSONB` | **NO** | `'{}'::jsonb` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `jwt_session_id` | `TEXT` | YES | — |

#### `public.push_subscriptions`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (4 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** `user_id, endpoint`
- **Check Constraints:** None
- **Triggers:** None
- **Columns (10):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `user_id` | `UUID` | **NO** | — |
| `endpoint` | `TEXT` | **NO** | — |
| `p256dh` | `TEXT` | **NO** | — |
| `auth` | `TEXT` | **NO** | — |
| `user_agent` | `TEXT` | YES | — |
| `device_type` | `TEXT` | **NO** | `'desktop'` |
| `last_seen_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.rate_limit_buckets`
- **Live Row Count:** Super Admin: `12` | Worker: `12` | Anon: `0`
- **Primary Key:** `key, window_start`
- **RLS Enabled:** `YES (FORCED)` (0 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (6):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `key` | `TEXT` | **NO** | — |
| `action_category` | `TEXT` | **NO** | — |
| `user_id` | `UUID` | YES | — |
| `request_count` | `INT` | **NO** | `1` |
| `window_start` | `TIMESTAMPTZ` | **NO** | `clock_timestamp()` |
| `blocked_until` | `TIMESTAMPTZ` | YES | — |

### 2. Client CRM & Client Workspaces

#### `public.clients`
- **Live Row Count:** Super Admin: `40` | Worker: `40` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (6 migration policies defined)
- **Foreign Keys:**
  - `relationship_owner_id` $\rightarrow$ `profiles(id)`
  - `monthly_package_price` $\rightarrow$ `team_members(id)`
  - `account_manager_id` $\rightarrow$ `auth(id)`
  - `package_id` $\rightarrow$ `packages(id)`
  - `CONSTRAINT` $\rightarrow$ `package_catalog(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (19):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `contact_name` | `TEXT` | YES | — |
| `email` | `TEXT` | YES | — |
| `phone` | `TEXT` | YES | — |
| `preferred_channel` | `TEXT` | YES | — |
| `website` | `TEXT` | YES | — |
| `industry` | `TEXT` | YES | — |
| `notes` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'active' CHECK (status IN ('prospect'` |
| `relationship_owner_id` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `client_type` | `TEXT` | **NO** | `'one_off' CHECK (client_type IN ('monthl` |
| `monthly_package_price` | `NUMERIC(12, 3)` | YES | `0 CHECK (monthly_package_price >= 0)` |
| `account_manager_id` | `UUID` | YES | — |
| `package_id` | `UUID` | YES | — |
| `CONSTRAINT` | `clients_package_id_fkey` | YES | — |
| `social_accounts` | `JSONB` | YES | `'{"instagram":""` |

#### `public.client_projects`
- **Live Row Count:** Super Admin: `24` | Worker: `2` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (14 migration policies defined)
- **Foreign Keys:**
  - `contact_submission_id` $\rightarrow$ `contact_submissions(id)`
  - `last_contact_date` $\rightarrow$ `profiles(id)`
  - `lead_id` $\rightarrow$ `profiles(id)`
  - `client_id` $\rightarrow$ `clients(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `client_projects_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (21):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `title` | `TEXT` | **NO** | — |
| `client_name` | `TEXT` | **NO** | — |
| `status` | `TEXT` | **NO** | `'active'
    CHECK (status IN ('active'` |
| `description` | `TEXT` | YES | — |
| `business_type` | `TEXT` | YES | — |
| `goals` | `TEXT` | YES | — |
| `problems` | `TEXT` | YES | — |
| `requested_services` | `TEXT[]` | YES | `'{}'` |
| `timeline` | `TEXT` | YES | — |
| `budget` | `TEXT` | YES | — |
| `original_message` | `TEXT` | YES | — |
| `questionnaire_answers` | `JSONB` | YES | — |
| `contact_submission_id` | `UUID` | YES | — |
| `deadline` | `DATE` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `start_date` | `DATE` | YES | `'{}'` |
| `last_contact_date` | `TIMESTAMPTZ` | YES | `'no_followup'
    CHECK (followup_status` |
| `lead_id` | `UUID` | YES | — |
| `client_id` | `UUID` | YES | — |

#### `public.project_members`
- **Live Row Count:** Super Admin: `2` | Worker: `2` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `profile_id` $\rightarrow$ `profiles(id)`
  - `team_member_id` $\rightarrow$ `team_members(id)`
- **Unique Constraints:** `project_id, profile_id`
- **Check Constraints:** None
- **Triggers:** None
- **Columns (6):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `project_id` | `UUID` | **NO** | — |
| `profile_id` | `UUID` | YES | — |
| `team_member_id` | `UUID` | YES | — |
| `role` | `TEXT` | **NO** | `'specialist' CHECK (role IN ('lead'` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.client_communication_logs`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `team_member_id` $\rightarrow$ `profiles(id)`
  - `client_id` $\rightarrow$ `clients(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (9):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `project_id` | `UUID` | **NO** | — |
| `contact_method` | `TEXT` | **NO** | — |
| `team_member_id` | `UUID` | YES | — |
| `summary` | `TEXT` | **NO** | — |
| `next_action` | `TEXT` | YES | — |
| `next_followup_date` | `TIMESTAMPTZ` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `client_id` | `UUID` | YES | — |

### 3. Package Catalog, Addons & Recurring Commitments

#### `public.package_catalog`
- **Live Row Count:** Super Admin: `39` | Worker: `39` | Anon: `31`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - `category_id` $\rightarrow$ `package_categories(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
  - `updated_by` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_prevent_package_deletion` (BEFORE DELETE $\rightarrow$ `prevent_referenced_package_deletion()`), `trg_sync_package_catalog_to_packages` (AFTER INSERT OR UPDATE OR DELETE $\rightarrow$ `sync_package_catalog_to_packages()`)
- **Columns (47):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `code` | `TEXT` | **NO** | — |
| `name` | `TEXT` | **NO** | — |
| `name_ar` | `TEXT` | YES | — |
| `slug` | `TEXT` | **NO** | — |
| `description` | `TEXT` | YES | — |
| `description_ar` | `TEXT` | YES | — |
| `category_id` | `UUID` | YES | — |
| `category_name` | `TEXT` | YES | — |
| `package_type` | `TEXT` | **NO** | `'standard'` |
| `billing_type` | `TEXT` | **NO** | `'monthly' CHECK (billing_type IN ('month` |
| `price` | `NUMERIC(12,2)` | **NO** | `0` |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `is_active` | `BOOLEAN` | **NO** | `true` |
| `is_published` | `BOOLEAN` | **NO** | `true` |
| `is_featured` | `BOOLEAN` | **NO** | `false` |
| `badge` | `TEXT` | YES | — |
| `badge_ar` | `TEXT` | YES | — |
| `priority` | `INTEGER` | **NO** | `0` |
| `display_order` | `INTEGER` | **NO** | `0` |
| `short_description` | `TEXT` | YES | — |
| `short_description_ar` | `TEXT` | YES | — |
| `included_items` | `JSONB` | **NO** | `'[]'::jsonb` |
| `excluded_items` | `JSONB` | **NO** | `'[]'::jsonb` |
| `monthly_reels` | `INTEGER` | **NO** | `0` |
| `monthly_posts` | `INTEGER` | **NO** | `0` |
| `monthly_stories` | `TEXT` | **NO** | `''` |
| `production_hours` | `NUMERIC(8,2)` | **NO** | `0` |
| `production_sessions` | `INTEGER` | **NO** | `0` |
| `platforms` | `TEXT[]` | **NO** | `'{"instagram"` |
| `has_ads_management` | `BOOLEAN` | **NO** | `false` |
| `has_website` | `BOOLEAN` | **NO** | `false` |
| `has_strategy` | `BOOLEAN` | **NO** | `false` |
| `has_community_management` | `BOOLEAN` | **NO** | `false` |
| `website_scope` | `TEXT` | YES | — |
| `custom_pricing` | `BOOLEAN` | **NO** | `false` |
| `freelancer_cost` | `NUMERIC(12,2)` | **NO** | `0` |
| `transport_cost` | `NUMERIC(12,2)` | **NO** | `0` |
| `subscription_allocation` | `NUMERIC(12,2)` | **NO** | `0` |
| `commission` | `NUMERIC(12,2)` | **NO** | `0` |
| `direct_costs` | `NUMERIC(12,2)` | YES | — |
| `gross_profit` | `NUMERIC(12,2)` | YES | — |
| `gross_margin` | `NUMERIC(8,2)` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `created_by` | `UUID` | YES | — |
| `updated_by` | `UUID` | YES | — |

#### `public.package_categories`
- **Live Row Count:** Super Admin: `9` | Worker: `9` | Anon: `9`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (12):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `code` | `TEXT` | **NO** | — |
| `name` | `TEXT` | **NO** | — |
| `name_ar` | `TEXT` | YES | — |
| `slug` | `TEXT` | **NO** | — |
| `description` | `TEXT` | YES | — |
| `description_ar` | `TEXT` | YES | — |
| `priority` | `INTEGER` | **NO** | `0` |
| `display_order` | `INTEGER` | **NO** | `0` |
| `is_active` | `BOOLEAN` | **NO** | `true` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.package_addons`
- **Live Row Count:** Super Admin: `12` | Worker: `12` | Anon: `12`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (14):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `code` | `TEXT` | **NO** | — |
| `name` | `TEXT` | **NO** | — |
| `name_ar` | `TEXT` | YES | — |
| `price` | `NUMERIC(12,2)` | **NO** | `0` |
| `unit` | `TEXT` | **NO** | `'item'` |
| `percentage_modifier` | `NUMERIC(5,2)` | YES | — |
| `category` | `TEXT` | YES | `'general'` |
| `description` | `TEXT` | YES | — |
| `description_ar` | `TEXT` | YES | — |
| `is_active` | `BOOLEAN` | **NO** | `true` |
| `display_order` | `INTEGER` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.packages`
- **Live Row Count:** Super Admin: `37` | Worker: `37` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (6 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (19):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `description` | `TEXT` | YES | — |
| `selling_price` | `NUMERIC(12,2)` | **NO** | `0` |
| `services` | `TEXT[]` | **NO** | `'{}'` |
| `deliverables` | `JSONB` | **NO** | `'[]'::jsonb` |
| `target_quantities` | `JSONB` | **NO** | `'{"reels": 0` |
| `production_hours` | `NUMERIC(8,2)` | **NO** | `0` |
| `employee_cost` | `NUMERIC(12,2)` | **NO** | `0` |
| `freelancer_cost` | `NUMERIC(12,2)` | **NO** | `0` |
| `transport_cost` | `NUMERIC(12,2)` | **NO** | `0` |
| `subscription_allocation` | `NUMERIC(12,2)` | **NO** | `0` |
| `commission` | `NUMERIC(12,2)` | **NO** | `0` |
| `direct_costs` | `NUMERIC(12,2)` | YES | — |
| `gross_profit` | `NUMERIC(12,2)` | YES | — |
| `gross_margin` | `NUMERIC(8,2)` | YES | — |
| `is_active` | `BOOLEAN` | **NO** | `true` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.service_commitments`
- **Live Row Count:** Super Admin: `8` | Worker: `8` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (3 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `package_id` $\rightarrow$ `package_catalog(id)`
  - `assignee_id` $\rightarrow$ `profiles(id)`
  - `workflow_template_id` $\rightarrow$ `workflow_templates(id)`
  - `deliverable_id` $\rightarrow$ `client_deliverables(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (24):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `client_id` | `UUID` | **NO** | — |
| `package_id` | `UUID` | YES | — |
| `service_name` | `TEXT` | **NO** | — |
| `deliverable_type` | `TEXT` | **NO** | `'custom'` |
| `quantity` | `INTEGER` | **NO** | `1 CHECK (quantity > 0)` |
| `frequency` | `TEXT` | **NO** | `'monthly' CHECK (frequency IN ('daily'` |
| `schedule_rule` | `JSONB` | **NO** | `'{}'::jsonb` |
| `start_date` | `DATE` | **NO** | `CURRENT_DATE` |
| `end_date` | `DATE` | YES | — |
| `preferred_time` | `TEXT` | YES | — |
| `duration_hours` | `NUMERIC(4,2)` | YES | — |
| `assignee_id` | `UUID` | YES | — |
| `assignment_rule` | `TEXT` | **NO** | `'specialist_role' CHECK (assignment_rule` |
| `default_role` | `TEXT` | YES | — |
| `workflow_template_id` | `UUID` | YES | — |
| `task_type` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'active' CHECK (status IN ('active'` |
| `paused_at` | `TIMESTAMPTZ` | YES | — |
| `reactivated_at` | `TIMESTAMPTZ` | YES | — |
| `notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `deliverable_id` | `UUID` | YES | — |

### 4. Work OS, Project Tasks, Subtasks & Workflows

#### `public.project_tasks`
- **Live Row Count:** Super Admin: `217` | Worker: `217` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (10 migration policies defined)
- **Foreign Keys:**
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `assignee_id` $\rightarrow$ `profiles(id)`
  - `service` $\rightarrow$ `profiles(id)`
  - `assigned_by_id` $\rightarrow$ `profiles(id)`
  - `client_id` $\rightarrow$ `clients(id)`
  - `package_id` $\rightarrow$ `packages(id)`
  - `CONSTRAINT` $\rightarrow$ `package_catalog(id)`
  - `workflow_template_id` $\rightarrow$ `workflow_templates(id)`
  - `commitment_id` $\rightarrow$ `service_commitments(id)`
  - `commitment_id` $\rightarrow$ `service_commitments(id)`
  - `deliverable_id` $\rightarrow$ `client_deliverables(id)`
  - `published_by` $\rightarrow$ `profiles(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `project_tasks_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`), `trg_project_tasks_completed_at` (BEFORE INSERT OR UPDATE $\rightarrow$ `handle_project_task_completed_at()`), `trg_guard_project_tasks_worker_columns` (BEFORE UPDATE $\rightarrow$ `guard_project_tasks_worker_columns()`), `trg_enforce_subtask_parent_authority` (BEFORE INSERT $\rightarrow$ `check_subtask_parent_authority()`), `trg_sync_project_task_canonical_fields` (BEFORE INSERT OR UPDATE $\rightarrow$ `sync_project_task_canonical_fields()`)
- **Columns (42):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `project_id` | `UUID` | **NO** | — |
| `title` | `TEXT` | **NO** | — |
| `description` | `TEXT` | YES | — |
| `status` | `public` | **NO** | `'todo'` |
| `priority` | `public` | **NO** | `'medium'` |
| `assignee_id` | `UUID` | YES | — |
| `category` | `TEXT` | YES | — |
| `start_date` | `TIMESTAMPTZ` | YES | — |
| `end_date` | `TIMESTAMPTZ` | YES | — |
| `deadline` | `DATE` | YES | — |
| `estimated_minutes` | `INT` | YES | — |
| `actual_minutes` | `INT` | YES | — |
| `notes` | `TEXT` | YES | — |
| `postpone_reason` | `TEXT` | YES | — |
| `sort_order` | `INT` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `service` | `TEXT` | YES | `'{}'` |
| `assigned_by_id` | `UUID` | YES | — |
| `client_id` | `UUID` | YES | — |
| `deadline_alert_enabled` | `BOOLEAN` | YES | `false` |
| `package_id` | `UUID` | YES | `0` |
| `labor_cost` | `NUMERIC` | YES | `0` |
| `CONSTRAINT` | `project_tasks_package_id_fkey` | YES | — |
| `workflow_template_id` | `UUID` | YES | `false` |
| `commitment_id` | `UUID` | YES | — |
| `idempotency_key` | `TEXT` | YES | — |
| `scheduled_date` | `DATE` | YES | — |
| `occurrence_date` | `DATE` | YES | — |
| `sequence_index` | `INTEGER` | YES | — |
| `deliverable_id` | `UUID` | YES | — |
| `source_type` | `TEXT` | **NO** | `'manual'
        CHECK (source_type IN (` |
| `is_reconciliation_managed` | `BOOLEAN` | **NO** | `false` |
| `manual_override` | `BOOLEAN` | **NO** | `false` |
| `cancelled_reason` | `TEXT` | YES | — |
| `drive_url` | `TEXT` | YES | — |
| `published_urls` | `TEXT[]` | YES | `'{}'::text[]` |
| `published_at` | `TIMESTAMPTZ` | YES | — |
| `published_by` | `UUID` | YES | — |
| `target_platforms` | `TEXT[]` | YES | `'{}'::text[]` |
| `created_by` | `UUID` | YES | — |

#### `public.client_deliverables`
- **Live Row Count:** Super Admin: `12` | Worker: `12` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (6 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `package_id` $\rightarrow$ `packages(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `CONSTRAINT` $\rightarrow$ `package_catalog(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (17):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `client_id` | `UUID` | **NO** | — |
| `package_id` | `UUID` | YES | — |
| `project_id` | `UUID` | YES | — |
| `title` | `TEXT` | **NO** | — |
| `deliverable_type` | `TEXT` | **NO** | — |
| `period_month` | `TEXT` | **NO** | — |
| `target_quantity` | `INTEGER` | **NO** | `1` |
| `done_quantity` | `INTEGER` | **NO** | `0` |
| `remaining_quantity` | `INTEGER` | YES | — |
| `assigned_team_ids` | `UUID[]` | YES | `'{}'` |
| `deadline` | `DATE` | YES | — |
| `status` | `TEXT` | **NO** | `'planned' CHECK (status IN ('planned'` |
| `notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `CONSTRAINT` | `client_deliverables_package_id_fkey` | YES | — |

#### `public.work_sessions`
- **Live Row Count:** Super Admin: `16` | Worker: `12` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (9 migration policies defined)
- **Foreign Keys:**
  - `team_member_id` $\rightarrow$ `team_members(id)`
  - `profile_id` $\rightarrow$ `profiles(id)`
  - `client_id` $\rightarrow$ `clients(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `task_id` $\rightarrow$ `project_tasks(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (17):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `team_member_id` | `UUID` | **NO** | — |
| `profile_id` | `UUID` | YES | — |
| `client_id` | `UUID` | YES | — |
| `project_id` | `UUID` | YES | — |
| `task_id` | `UUID` | YES | — |
| `session_type` | `TEXT` | **NO** | `'production' CHECK (session_type IN ('pr` |
| `started_at` | `TIMESTAMPTZ` | **NO** | `NOW()` |
| `ended_at` | `TIMESTAMPTZ` | YES | — |
| `duration_minutes` | `INTEGER` | YES | `0` |
| `description` | `TEXT` | YES | — |
| `hourly_cost_rate` | `NUMERIC` | YES | `0` |
| `labor_cost` | `NUMERIC` | YES | `0` |
| `is_billable` | `BOOLEAN` | YES | `true` |
| `status` | `TEXT` | **NO** | `'completed' CHECK (status IN ('active'` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `NOW()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `NOW()` |

#### `public.project_activity`
- **Live Row Count:** Super Admin: `174` | Worker: `174` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `task_id` $\rightarrow$ `project_tasks(id)`
  - `actor_id` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (8):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `project_id` | `UUID` | **NO** | — |
| `task_id` | `UUID` | YES | — |
| `actor_id` | `UUID` | YES | — |
| `action` | `TEXT` | **NO** | — |
| `details` | `JSONB` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `idempotency_key` | `TEXT` | YES | — |

#### `public.workflow_templates`
- **Live Row Count:** Super Admin: `4` | Worker: `4` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (12):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `task_type` | `TEXT` | **NO** | — |
| `name` | `TEXT` | **NO** | — |
| `name_ar` | `TEXT` | YES | — |
| `description` | `TEXT` | **NO** | — |
| `description_ar` | `TEXT` | YES | — |
| `icon` | `TEXT` | **NO** | `'Workflow'` |
| `color` | `TEXT` | **NO** | `'purple'` |
| `is_active` | `BOOLEAN` | **NO** | `true` |
| `sort_order` | `INTEGER` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.workflow_stages`
- **Live Row Count:** Super Admin: `7` | Worker: `7` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - `template_id` $\rightarrow$ `workflow_templates(id)`
  - `default_assignee_id` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** `template_id, sort_order`
- **Check Constraints:** None
- **Triggers:** None
- **Columns (15):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `template_id` | `UUID` | **NO** | — |
| `title` | `TEXT` | **NO** | — |
| `title_ar` | `TEXT` | YES | — |
| `stage_type` | `TEXT` | **NO** | — |
| `sort_order` | `INTEGER` | **NO** | `1` |
| `duration_days` | `INTEGER` | **NO** | `1` |
| `requires_previous_stage` | `BOOLEAN` | **NO** | `true` |
| `assignment_rule` | `TEXT` | **NO** | `'specialist_role'` |
| `default_assignee_role` | `TEXT` | YES | — |
| `default_assignee_id` | `UUID` | YES | — |
| `description` | `TEXT` | YES | — |
| `description_ar` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.task_handoffs`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (3 migration policies defined)
- **Foreign Keys:**
  - `task_id` $\rightarrow$ `project_tasks(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `requested_by_id` $\rightarrow$ `profiles(id)`
  - `from_assignee_id` $\rightarrow$ `profiles(id)`
  - `to_assignee_id` $\rightarrow$ `profiles(id)`
  - `assigner_id` $\rightarrow$ `profiles(id)`
  - `rejected_by_id` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (16):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `task_id` | `UUID` | **NO** | — |
| `project_id` | `UUID` | **NO** | — |
| `requested_by_id` | `UUID` | **NO** | — |
| `from_assignee_id` | `UUID` | **NO** | — |
| `to_assignee_id` | `UUID` | **NO** | — |
| `assigner_id` | `UUID` | **NO** | — |
| `request_reason` | `TEXT` | **NO** | — |
| `new_assignee_accepted_at` | `TIMESTAMPTZ` | YES | — |
| `assigner_approved_at` | `TIMESTAMPTZ` | YES | — |
| `rejected_at` | `TIMESTAMPTZ` | YES | — |
| `rejected_by_id` | `UUID` | YES | — |
| `rejection_reason` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'pending' CHECK (status IN ('pending'` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.production_bookings`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (6 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `deal_id` $\rightarrow$ `deals(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `package_id` $\rightarrow$ `packages(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
  - `CONSTRAINT` $\rightarrow$ `package_catalog(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (22):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `client_id` | `UUID` | **NO** | — |
| `deal_id` | `UUID` | YES | — |
| `project_id` | `UUID` | YES | — |
| `package_id` | `UUID` | YES | — |
| `title` | `TEXT` | **NO** | — |
| `date` | `DATE` | **NO** | — |
| `time` | `TEXT` | **NO** | — |
| `location` | `TEXT` | **NO** | — |
| `team_member_ids` | `UUID[]` | YES | `'{}'` |
| `production_type` | `TEXT` | **NO** | — |
| `duration_hours` | `NUMERIC(5,2)` | **NO** | `2.0` |
| `brief` | `JSONB` | **NO** | `'{
        "shot_list": []` |
| `stage` | `TEXT` | **NO** | `'brief' CHECK (
        stage IN ('brief` |
| `raw_upload_url` | `TEXT` | YES | — |
| `edit_preview_url` | `TEXT` | YES | — |
| `client_notes` | `TEXT` | YES | — |
| `internal_notes` | `TEXT` | YES | — |
| `created_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `CONSTRAINT` | `production_bookings_package_id_fkey` | YES | — |

#### `public.reconciliation_audit_logs`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `deliverable_id` $\rightarrow$ `client_deliverables(id)`
  - `commitment_id` $\rightarrow$ `service_commitments(id)`
  - `task_id` $\rightarrow$ `project_tasks(id)`
  - `actor_id` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (13):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `client_id` | `UUID` | **NO** | — |
| `deliverable_id` | `UUID` | YES | — |
| `commitment_id` | `UUID` | YES | — |
| `task_id` | `UUID` | YES | — |
| `mutation_type` | `TEXT` | **NO** | — |
| `old_state` | `JSONB` | YES | `'{}'::jsonb` |
| `new_state` | `JSONB` | YES | `'{}'::jsonb` |
| `reason` | `TEXT` | **NO** | — |
| `actor_id` | `UUID` | YES | — |
| `actor_email` | `TEXT` | YES | — |
| `period_month` | `TEXT` | **NO** | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

### 5. Sales Pipeline, Commercial Deals & Inquiries

#### `public.deals`
- **Live Row Count:** Super Admin: `37` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (10 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `package_id` $\rightarrow$ `packages(id)`
  - `sales_owner_id` $\rightarrow$ `profiles(id)`
  - `commission_recipient_id` $\rightarrow$ `team_members(id)`
  - `CONSTRAINT` $\rightarrow$ `package_catalog(id)`
  - `payment_status` $\rightarrow$ `deals(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_guard_deals_action_permissions` (BEFORE UPDATE $\rightarrow$ `guard_deals_action_permissions()`)
- **Columns (25):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `title` | `TEXT` | **NO** | — |
| `contact_name` | `TEXT` | YES | — |
| `contact_email` | `TEXT` | YES | — |
| `contact_phone` | `TEXT` | YES | — |
| `company_name` | `TEXT` | **NO** | — |
| `stage` | `TEXT` | **NO** | — |
| `client_id` | `UUID` | YES | — |
| `package_id` | `UUID` | YES | — |
| `sales_owner_id` | `UUID` | YES | — |
| `commission_recipient_id` | `UUID` | YES | — |
| `deal_value` | `NUMERIC(12,2)` | **NO** | `0` |
| `service_revenue` | `NUMERIC(12,2)` | **NO** | `0` |
| `sponsoring_budget` | `NUMERIC(12,2)` | **NO** | `0` |
| `commission_rate` | `NUMERIC(5,2)` | **NO** | `10.00` |
| `expected_close_date` | `DATE` | YES | — |
| `won_date` | `TIMESTAMPTZ` | YES | — |
| `lost_reason` | `TEXT` | YES | — |
| `contract_agreement` | `JSONB` | YES | `'{}'::jsonb` |
| `revenue_config` | `JSONB` | YES | `'{}'::jsonb` |
| `notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `CONSTRAINT` | `deals_package_id_fkey` | YES | — |
| `payment_status` | `TEXT` | **NO** | `'unpaid'
        CHECK (payment_status I` |

#### `public.sales_commissions`
- **Live Row Count:** Super Admin: `8` | Worker: `4` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - `team_member_id` $\rightarrow$ `team_members(id)`
  - `client_id` $\rightarrow$ `clients(id)`
  - `invoice_id` $\rightarrow$ `invoices(id)`
  - `salary_payment_id` $\rightarrow$ `salary_payments(id)`
  - `approved_by` $\rightarrow$ `profiles(id)`
  - `deal_id` $\rightarrow$ `deals(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (16):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `team_member_id` | `UUID` | **NO** | — |
| `client_id` | `UUID` | **NO** | — |
| `invoice_id` | `UUID` | YES | — |
| `service_revenue` | `NUMERIC(12, 3)` | **NO** | — |
| `commission_rate` | `NUMERIC(5, 2)` | **NO** | — |
| `commission_amount` | `NUMERIC(12, 3)` | **NO** | — |
| `period_month` | `TEXT` | **NO** | — |
| `status` | `TEXT` | **NO** | `'pending' CHECK (status IN ('pending'` |
| `salary_payment_id` | `UUID` | YES | — |
| `approved_by` | `UUID` | YES | — |
| `approved_at` | `TIMESTAMPTZ` | YES | — |
| `notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `deal_id` | `UUID` | YES | `0` |

#### `public.contact_submissions`
- **Live Row Count:** Super Admin: `20` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - `converted_project_id` $\rightarrow$ `client_projects(id)`
  - `client_id` $\rightarrow$ `clients(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (13):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `email` | `TEXT` | **NO** | — |
| `phone` | `TEXT` | YES | — |
| `business_name` | `TEXT` | YES | — |
| `service` | `TEXT` | YES | — |
| `budget` | `TEXT` | YES | — |
| `message` | `TEXT` | **NO** | — |
| `status` | `TEXT` | **NO** | `'new'` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `converted_project_id` | `UUID` | YES | — |
| `discovery_data` | `JSONB` | YES | `NULL` |
| `client_id` | `UUID` | YES | — |

### 6. Financial Operating System & Cash Treasury

#### `public.financial_accounts`
- **Live Row Count:** Super Admin: `10` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (12):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `account_type` | `TEXT` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `opening_balance` | `NUMERIC(12, 3)` | **NO** | `0` |
| `current_balance` | `NUMERIC(12, 3)` | **NO** | `0` |
| `account_number` | `TEXT` | YES | — |
| `bank_name` | `TEXT` | YES | — |
| `is_default` | `BOOLEAN` | **NO** | `false` |
| `status` | `TEXT` | **NO** | `'active' CHECK (status IN ('active'` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.income_transactions`
- **Live Row Count:** Super Admin: `12` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (8 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
  - `allocation` $\rightarrow$ `invoices(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (17):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `date` | `DATE` | **NO** | `CURRENT_DATE` |
| `category` | `TEXT` | **NO** | `'Client Payment' CHECK (category IN ('Cl` |
| `client_id` | `UUID` | YES | — |
| `project_id` | `UUID` | YES | — |
| `description` | `TEXT` | **NO** | — |
| `payment_method` | `TEXT` | **NO** | `'Bank Transfer'` |
| `status` | `TEXT` | **NO** | `'received' CHECK (status IN ('received'` |
| `reference` | `TEXT` | YES | — |
| `receipt_url` | `TEXT` | YES | — |
| `notes` | `TEXT` | YES | — |
| `created_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `allocation` | `TEXT` | **NO** | `'client_service' CHECK (allocation IN ('` |

#### `public.expense_transactions`
- **Live Row Count:** Super Admin: `56` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (8 migration policies defined)
- **Foreign Keys:**
  - `category_id` $\rightarrow$ `expense_categories(id)`
  - `subscription_id` $\rightarrow$ `subscriptions(id)`
  - `salary_payment_id` $\rightarrow$ `salary_payments(id)`
  - `team_member_id` $\rightarrow$ `team_members(id)`
  - `client_id` $\rightarrow$ `clients(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
  - `allocation` $\rightarrow$ `sponsoring_campaigns(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (24):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `date` | `DATE` | **NO** | `CURRENT_DATE` |
| `category_id` | `UUID` | YES | — |
| `category_name` | `TEXT` | **NO** | — |
| `subcategory` | `TEXT` | YES | — |
| `vendor` | `TEXT` | YES | — |
| `description` | `TEXT` | **NO** | — |
| `payment_method` | `TEXT` | **NO** | `'Bank Transfer'` |
| `status` | `TEXT` | **NO** | `'paid' CHECK (status IN ('paid'` |
| `is_recurring` | `BOOLEAN` | **NO** | `false` |
| `subscription_id` | `UUID` | YES | — |
| `salary_payment_id` | `UUID` | YES | — |
| `team_member_id` | `UUID` | YES | — |
| `client_id` | `UUID` | YES | — |
| `project_id` | `UUID` | YES | — |
| `reference` | `TEXT` | YES | — |
| `receipt_url` | `TEXT` | YES | — |
| `notes` | `TEXT` | YES | — |
| `created_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `allocation` | `TEXT` | **NO** | `'operating_expense' CHECK (allocation IN` |

#### `public.expense_categories`
- **Live Row Count:** Super Admin: `9` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (4 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (8):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `description` | `TEXT` | YES | — |
| `color` | `TEXT` | YES | `'#8B5CF6'` |
| `icon` | `TEXT` | YES | `'receipt'` |
| `is_system` | `BOOLEAN` | **NO** | `false` |
| `sort_order` | `INTEGER` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.invoices`
- **Live Row Count:** Super Admin: `6` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (20):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `invoice_number` | `TEXT` | **NO** | — |
| `client_id` | `UUID` | **NO** | — |
| `project_id` | `UUID` | YES | — |
| `issue_date` | `DATE` | **NO** | `CURRENT_DATE` |
| `due_date` | `DATE` | **NO** | — |
| `service_revenue` | `NUMERIC(12, 3)` | **NO** | `0 CHECK (service_revenue >= 0)` |
| `sponsoring_budget` | `NUMERIC(12, 3)` | **NO** | `0 CHECK (sponsoring_budget >= 0)` |
| `other_revenue` | `NUMERIC(12, 3)` | **NO** | `0 CHECK (other_revenue >= 0)` |
| `subtotal` | `NUMERIC(12, 3)` | **NO** | — |
| `tax_amount` | `NUMERIC(12, 3)` | **NO** | `0 CHECK (tax_amount >= 0)` |
| `total_amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `status` | `TEXT` | **NO** | `'pending' CHECK (status IN ('draft'` |
| `paid_amount` | `NUMERIC(12, 3)` | **NO** | `0 CHECK (paid_amount >= 0)` |
| `items` | `JSONB` | **NO** | `'[]'::jsonb` |
| `notes` | `TEXT` | YES | — |
| `created_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.subscriptions`
- **Live Row Count:** Super Admin: `16` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (4 migration policies defined)
- **Foreign Keys:**
  - `category_id` $\rightarrow$ `expense_categories(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (15):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `name` | `TEXT` | **NO** | — |
| `vendor` | `TEXT` | YES | — |
| `category_id` | `UUID` | YES | — |
| `category_name` | `TEXT` | **NO** | `'Software & SaaS'` |
| `amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `billing_cycle` | `TEXT` | **NO** | `'monthly' CHECK (billing_cycle IN ('mont` |
| `billing_day` | `INTEGER` | YES | `1 CHECK (billing_day >= 1 AND billing_da` |
| `next_billing_date` | `DATE` | YES | — |
| `payment_method` | `TEXT` | YES | `'Credit Card'` |
| `status` | `TEXT` | **NO** | `'active' CHECK (status IN ('active'` |
| `notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.financial_closing_periods`
- **Live Row Count:** Super Admin: `2` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `closed_by` $\rightarrow$ `profiles(id)`
  - `reopened_by` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (11):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `period_month` | `TEXT` | **NO** | — |
| `status` | `TEXT` | **NO** | `'open' CHECK (status IN ('open'` |
| `closing_summary` | `JSONB` | YES | `'{}'::jsonb` |
| `closed_at` | `TIMESTAMPTZ` | YES | — |
| `closed_by` | `UUID` | YES | — |
| `reopened_at` | `TIMESTAMPTZ` | YES | — |
| `reopened_by` | `UUID` | YES | — |
| `reopen_reason` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.sponsoring_campaigns`
- **Live Row Count:** Super Admin: `5` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `client_id` $\rightarrow$ `clients(id)`
  - `project_id` $\rightarrow$ `client_projects(id)`
  - `invoice_id` $\rightarrow$ `invoices(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (21):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `client_id` | `UUID` | **NO** | — |
| `project_id` | `UUID` | YES | — |
| `invoice_id` | `UUID` | YES | — |
| `campaign_name` | `TEXT` | **NO** | — |
| `platform` | `TEXT` | **NO** | `'Meta Ads' CHECK (platform IN ('Meta Ads` |
| `budget_tnd` | `NUMERIC(12, 3)` | **NO** | — |
| `usd_amount` | `NUMERIC(12, 2)` | **NO** | — |
| `purchase_rate` | `NUMERIC(10, 4)` | **NO** | — |
| `purchase_cost_tnd` | `NUMERIC(12, 3)` | **NO** | — |
| `client_rate` | `NUMERIC(10, 4)` | **NO** | `4.0000` |
| `client_charge_tnd` | `NUMERIC(12, 3)` | **NO** | — |
| `margin_tnd` | `NUMERIC(12, 3)` | **NO** | — |
| `payment_status` | `TEXT` | **NO** | `'pending' CHECK (payment_status IN ('pen` |
| `execution_status` | `TEXT` | **NO** | `'active' CHECK (execution_status IN ('pl` |
| `date` | `DATE` | **NO** | `CURRENT_DATE` |
| `period_month` | `TEXT` | YES | `to_char(CURRENT_DATE` |
| `notes` | `TEXT` | YES | — |
| `created_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

### 7. Worker Compensation & Payroll

#### `public.salary_records`
- **Live Row Count:** Super Admin: `7` | Worker: `1` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (14 migration policies defined)
- **Foreign Keys:**
  - `team_member_id` $\rightarrow$ `team_members(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (15):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `team_member_id` | `UUID` | **NO** | — |
| `base_amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `salary_type` | `TEXT` | **NO** | `'monthly' CHECK (salary_type IN ('monthl` |
| `payment_frequency` | `TEXT` | **NO** | `'monthly' CHECK (payment_frequency IN ('` |
| `effective_date` | `DATE` | **NO** | `CURRENT_DATE` |
| `next_payment_date` | `DATE` | YES | — |
| `payment_method` | `TEXT` | **NO** | `'Bank Transfer'` |
| `bank_details` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'active' CHECK (status IN ('active'` |
| `notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `standard_monthly_hours` | `INTEGER` | YES | `160` |

#### `public.salary_payments`
- **Live Row Count:** Super Admin: `5` | Worker: `1` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (14 migration policies defined)
- **Foreign Keys:**
  - `team_member_id` $\rightarrow$ `team_members(id)`
  - `salary_record_id` $\rightarrow$ `salary_records(id)`
  - `created_by` $\rightarrow$ `profiles(id)`
  - `CONSTRAINT` $\rightarrow$ `salary_requests(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (19):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `team_member_id` | `UUID` | **NO** | — |
| `salary_record_id` | `UUID` | YES | — |
| `salary_request_id` | `UUID` | YES | — |
| `amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `payment_date` | `DATE` | **NO** | `CURRENT_DATE` |
| `period_start` | `DATE` | YES | — |
| `period_end` | `DATE` | YES | — |
| `payment_type` | `TEXT` | **NO** | `'regular' CHECK (payment_type IN ('regul` |
| `payment_method` | `TEXT` | **NO** | `'Bank Transfer'` |
| `reference` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'paid' CHECK (status IN ('paid'` |
| `receipt_url` | `TEXT` | YES | — |
| `notes` | `TEXT` | YES | — |
| `created_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `CONSTRAINT` | `fk_salary_payments_request` | YES | — |

#### `public.salary_requests`
- **Live Row Count:** Super Admin: `5` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (17 migration policies defined)
- **Foreign Keys:**
  - `team_member_id` $\rightarrow$ `team_members(id)`
  - `reviewed_by` $\rightarrow$ `profiles(id)`
  - `salary_payment_id` $\rightarrow$ `salary_payments(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (15):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `team_member_id` | `UUID` | **NO** | — |
| `requested_amount` | `NUMERIC(12, 3)` | **NO** | — |
| `currency` | `TEXT` | **NO** | `'TND'` |
| `requested_date` | `DATE` | **NO** | `CURRENT_DATE` |
| `reason` | `TEXT` | **NO** | — |
| `notes` | `TEXT` | YES | — |
| `status` | `TEXT` | **NO** | `'pending' CHECK (status IN ('pending'` |
| `reviewed_by` | `UUID` | YES | — |
| `reviewed_at` | `TIMESTAMPTZ` | YES | — |
| `review_notes` | `TEXT` | YES | — |
| `approved_amount` | `NUMERIC(12, 3)` | YES | — |
| `salary_payment_id` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

### 8. Centralized Business Rules & Governance Engine

#### `public.business_rules`
- **Live Row Count:** Super Admin: `27` | Worker: `27` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (5 migration policies defined)
- **Foreign Keys:**
  - `updated_by` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_archive_business_rule_version` (BEFORE UPDATE $\rightarrow$ `archive_business_rule_version()`), `trg_archive_business_rule_version` (BEFORE UPDATE $\rightarrow$ `archive_business_rule_version()`)
- **Columns (22):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `rule_key` | `TEXT` | **NO** | — |
| `rule_name` | `TEXT` | **NO** | — |
| `description` | `TEXT` | **NO** | — |
| `category` | `TEXT` | **NO** | — |
| `value_type` | `TEXT` | **NO** | — |
| `numeric_value` | `NUMERIC` | YES | — |
| `boolean_value` | `BOOLEAN` | YES | — |
| `text_value` | `TEXT` | YES | — |
| `json_value` | `JSONB` | YES | — |
| `unit` | `TEXT` | YES | — |
| `min_value` | `NUMERIC` | YES | — |
| `max_value` | `NUMERIC` | YES | — |
| `is_active` | `BOOLEAN` | **NO** | `true` |
| `effective_from` | `TIMESTAMPTZ` | **NO** | `now()` |
| `effective_until` | `TIMESTAMPTZ` | YES | — |
| `version` | `INTEGER` | **NO** | `1` |
| `updated_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `operator` | `VARCHAR(20)` | YES | `'<='` |
| `change_reason` | `TEXT` | YES | — |

#### `public.business_rule_versions`
- **Live Row Count:** Super Admin: `111` | Worker: `111` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `rule_id` $\rightarrow$ `business_rules(id)`
  - `changed_by` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_prevent_rule_version_deletion` (BEFORE DELETE $\rightarrow$ `prevent_rule_version_deletion()`), `trg_prevent_rule_version_deletion` (BEFORE DELETE $\rightarrow$ `prevent_rule_version_deletion()`)
- **Columns (14):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `rule_id` | `UUID` | **NO** | — |
| `rule_key` | `TEXT` | **NO** | — |
| `version` | `INTEGER` | **NO** | — |
| `numeric_value` | `NUMERIC` | YES | — |
| `boolean_value` | `BOOLEAN` | YES | — |
| `text_value` | `TEXT` | YES | — |
| `json_value` | `JSONB` | YES | — |
| `effective_from` | `TIMESTAMPTZ` | **NO** | — |
| `effective_until` | `TIMESTAMPTZ` | YES | — |
| `change_reason` | `TEXT` | YES | — |
| `changed_by` | `UUID` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `operator` | `VARCHAR(20)` | YES | — |

### 9. Security Operations, Alerts, Notifications & Audit Trails

#### `public.system_audit_logs`
- **Live Row Count:** Super Admin: `722` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (3 migration policies defined)
- **Foreign Keys:**
  - `actor_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_prevent_delete_system_audit` (BEFORE DELETE $\rightarrow$ `prevent_audit_log_deletion()`), `trg_prevent_update_system_audit` (BEFORE UPDATE $\rightarrow$ `prevent_audit_log_update()`), `trg_prevent_delete_system_audit` (BEFORE DELETE $\rightarrow$ `prevent_audit_log_deletion()`), `trg_prevent_update_system_audit` (BEFORE UPDATE $\rightarrow$ `prevent_audit_log_update()`)
- **Columns (12):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `actor_id` | `UUID` | YES | — |
| `actor_name` | `TEXT` | YES | — |
| `actor_role` | `TEXT` | YES | — |
| `action` | `TEXT` | **NO** | — |
| `entity_type` | `TEXT` | **NO** | — |
| `entity_id` | `TEXT` | YES | — |
| `old_values` | `JSONB` | YES | `'{}'::jsonb` |
| `new_values` | `JSONB` | YES | `'{}'::jsonb` |
| `ip_address` | `TEXT` | YES | — |
| `user_agent` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.account_audit_logs`
- **Live Row Count:** Super Admin: `997` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (1 migration policies defined)
- **Foreign Keys:**
  - `actor_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_prevent_delete_account_audit` (BEFORE DELETE $\rightarrow$ `prevent_audit_log_deletion()`), `trg_prevent_update_account_audit` (BEFORE UPDATE $\rightarrow$ `prevent_audit_log_update()`), `trg_prevent_delete_account_audit` (BEFORE DELETE $\rightarrow$ `prevent_audit_log_deletion()`), `trg_prevent_update_account_audit` (BEFORE UPDATE $\rightarrow$ `prevent_audit_log_update()`)
- **Columns (8):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `actor_id` | `UUID` | YES | — |
| `actor_email` | `TEXT` | YES | — |
| `target_user_id` | `UUID` | YES | — |
| `target_email` | `TEXT` | YES | — |
| `action` | `TEXT` | **NO** | — |
| `metadata` | `JSONB` | **NO** | `'{}'::jsonb` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.financial_audit_logs`
- **Live Row Count:** Super Admin: `68` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - `actor_id` $\rightarrow$ `profiles(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `trg_prevent_delete_financial_audit` (BEFORE DELETE $\rightarrow$ `prevent_audit_log_deletion()`)
- **Columns (9):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `actor_id` | `UUID` | YES | — |
| `actor_name` | `TEXT` | YES | — |
| `actor_role` | `TEXT` | YES | — |
| `action` | `TEXT` | **NO** | — |
| `entity_type` | `TEXT` | **NO** | — |
| `entity_id` | `UUID` | YES | — |
| `details` | `JSONB` | YES | `'{}'::jsonb` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.security_alerts`
- **Live Row Count:** Super Admin: `7` | Worker: `0` | Anon: `0`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (0 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
  - `session_id` $\rightarrow$ `user_sessions(id)`
  - `resolved_by` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (16):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `rule_id` | `TEXT` | **NO** | — |
| `severity` | `TEXT` | **NO** | — |
| `title` | `TEXT` | **NO** | — |
| `description` | `TEXT` | **NO** | — |
| `user_id` | `UUID` | YES | — |
| `user_email` | `TEXT` | YES | — |
| `session_id` | `UUID` | YES | — |
| `trigger_evidence` | `JSONB` | **NO** | `'{}'::jsonb` |
| `recommended_action` | `TEXT` | **NO** | — |
| `status` | `TEXT` | **NO** | `'open' CHECK (status IN ('open'` |
| `resolved_at` | `TIMESTAMPTZ` | YES | — |
| `resolved_by` | `UUID` | YES | — |
| `resolution_notes` | `TEXT` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.notifications`
- **Live Row Count:** Super Admin: `118` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (8 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (13):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `user_id` | `UUID` | YES | — |
| `role_target` | `TEXT` | **NO** | `'all'` |
| `title` | `TEXT` | **NO** | — |
| `message` | `TEXT` | **NO** | — |
| `category` | `TEXT` | **NO** | `'system'` |
| `entity_type` | `TEXT` | YES | — |
| `entity_id` | `TEXT` | YES | — |
| `read` | `BOOLEAN` | **NO** | `false` |
| `read_at` | `TIMESTAMPTZ` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `context_title` | `TEXT` | YES | `'{}'::jsonb` |
| `CONSTRAINT` | `check_notifications_priority` | YES | — |

#### `public.notification_preferences`
- **Live Row Count:** Super Admin: `1` | Worker: `0` | Anon: `NO`
- **Primary Key:** `user_id`
- **RLS Enabled:** `YES (FORCED)` (1 migration policies defined)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `auth(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (20):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `user_id` | `UUID` | **NO** | — |
| `task_assigned` | `BOOLEAN` | **NO** | `true` |
| `task_due_soon` | `BOOLEAN` | **NO** | `true` |
| `task_overdue` | `BOOLEAN` | **NO** | `true` |
| `client_approval_required` | `BOOLEAN` | **NO** | `true` |
| `invoice_overdue` | `BOOLEAN` | **NO** | `true` |
| `payment_received` | `BOOLEAN` | **NO** | `true` |
| `commission_eligible` | `BOOLEAN` | **NO** | `true` |
| `commission_approved` | `BOOLEAN` | **NO** | `true` |
| `salary_paid` | `BOOLEAN` | **NO** | `true` |
| `salary_request_pending` | `BOOLEAN` | **NO** | `true` |
| `production_tomorrow` | `BOOLEAN` | **NO** | `true` |
| `deliverable_behind` | `BOOLEAN` | **NO** | `true` |
| `month_end_closing` | `BOOLEAN` | **NO** | `true` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `desktop_push_enabled` | `BOOLEAN` | **NO** | `true` |
| `mobile_push_enabled` | `BOOLEAN` | **NO** | `true` |
| `messages_enabled` | `BOOLEAN` | **NO** | `true` |
| `operations_enabled` | `BOOLEAN` | **NO** | `true` |

### 10. Public Website Content & CMS

#### `public.projects`
- **Live Row Count:** Super Admin: `5` | Worker: `5` | Anon: `5`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (9 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `projects_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (23):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `title` | `TEXT` | **NO** | — |
| `slug` | `TEXT` | **NO** | — |
| `client` | `TEXT` | YES | — |
| `description` | `TEXT` | YES | — |
| `category` | `TEXT` | YES | — |
| `cover_url` | `TEXT` | YES | — |
| `gallery` | `JSONB` | YES | `'[]'::jsonb` |
| `services` | `TEXT[]` | YES | `'{}'` |
| `results` | `TEXT` | YES | — |
| `project_date` | `DATE` | YES | — |
| `tags` | `TEXT[]` | YES | `'{}'` |
| `featured` | `BOOLEAN` | **NO** | `false` |
| `published` | `BOOLEAN` | **NO** | `true` |
| `sort_order` | `INT` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `external_url` | `text` | YES | — |
| `thumbnail_url` | `text` | YES | — |
| `challenge` | `text` | **NO** | `'[]'::jsonb` |
| `industry` | `TEXT` | **NO** | `'{}'` |
| `team_member_ids` | `UUID[]` | YES | `'{}'::uuid[]` |
| `title_ar` | `text` | YES | — |

#### `public.social_reels`
- **Live Row Count:** Super Admin: `3` | Worker: `3` | Anon: `3`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (4 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** None
- **Columns (14):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `slug` | `TEXT` | **NO** | — |
| `instagram_url` | `TEXT` | **NO** | — |
| `instagram_shortcode` | `TEXT` | **NO** | — |
| `title` | `TEXT` | **NO** | — |
| `caption` | `TEXT` | YES | — |
| `thumbnail_url` | `TEXT` | **NO** | — |
| `category` | `TEXT` | YES | `'General'` |
| `display_order` | `INTEGER` | **NO** | `0` |
| `is_published` | `BOOLEAN` | **NO** | `false` |
| `is_featured` | `BOOLEAN` | **NO** | `false` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `title_ar` | `text` | YES | — |

#### `public.site_settings`
- **Live Row Count:** Super Admin: `1` | Worker: `1` | Anon: `1`
- **Primary Key:** `key`
- **RLS Enabled:** `YES (FORCED)` (2 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `site_settings_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (3):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `key` | `TEXT` | **NO** | — |
| `enabled` | `BOOLEAN` | **NO** | `true` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |

#### `public.blog_posts`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (10 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `blog_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (13):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `title` | `TEXT` | **NO** | — |
| `slug` | `TEXT` | **NO** | — |
| `excerpt` | `TEXT` | YES | — |
| `content` | `TEXT` | YES | — |
| `cover_url` | `TEXT` | YES | — |
| `published` | `BOOLEAN` | **NO** | `false` |
| `published_at` | `TIMESTAMPTZ` | YES | — |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `category` | `text` | **NO** | `'{}'::text[]` |
| `featured` | `BOOLEAN` | **NO** | `false` |
| `title_ar` | `text` | YES | — |

#### `public.products`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (10 migration policies defined)
- **Foreign Keys:**
  - None
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `products_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (14):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `title` | `TEXT` | **NO** | — |
| `description` | `TEXT` | YES | — |
| `price` | `NUMERIC(10,2)` | YES | — |
| `currency` | `TEXT` | YES | `'USD'` |
| `thumbnail_url` | `TEXT` | YES | — |
| `gumroad_url` | `TEXT` | YES | — |
| `category` | `TEXT` | YES | — |
| `published` | `BOOLEAN` | **NO** | `true` |
| `sort_order` | `INT` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `updated_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `slug` | `TEXT` | **NO** | `false` |
| `title_ar` | `text` | YES | — |

#### `public.testimonials`
- **Live Row Count:** Super Admin: `0` | Worker: `0` | Anon: `NO`
- **Primary Key:** `id`
- **RLS Enabled:** `YES (FORCED)` (9 migration policies defined)
- **Foreign Keys:**
  - `CONSTRAINT` $\rightarrow$ `clients(id)`
  - `CONSTRAINT` $\rightarrow$ `projects(id)`
- **Unique Constraints:** None
- **Check Constraints:** None
- **Triggers:** `testimonials_updated` (BEFORE UPDATE $\rightarrow$ `set_updated_at()`)
- **Columns (11):**
| Column | PostgreSQL Data Type | Nullable | Default Value |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **NO** | `gen_random_uuid()` |
| `client_name` | `TEXT` | **NO** | — |
| `company` | `TEXT` | YES | — |
| `photo_url` | `TEXT` | YES | — |
| `review` | `TEXT` | **NO** | — |
| `rating` | `INT` | **NO** | `5` |
| `published` | `BOOLEAN` | **NO** | `true` |
| `sort_order` | `INT` | **NO** | `0` |
| `created_at` | `TIMESTAMPTZ` | **NO** | `now()` |
| `role` | `TEXT` | **NO** | `'en'` |
| `CONSTRAINT` | `testimonials_project_id_fkey` | YES | — |

---

## 3. PostgreSQL Functions, RPCs, and Procedures Inventory (65 Functions)

| Function Name | Return Type | Security | Verification Status | Migration File Reference |
| :--- | :--- | :---: | :---: | :--- |
| `admin_analyze_account_dependencies` | `J` | **DEFINER** | VERIFIED | `20261006161500_fix_account_dependency_lead_column.sql` |
| `admin_create_account` | `J` | **DEFINER** | VERIFIED | `20261002130000_fix_account_provisioning_and_auth_integrity.sql` |
| `admin_delete_account` | `J` | **DEFINER** | VERIFIED | `20260925180000_super_admin_account_management.sql` |
| `admin_get_auth_user_id_by_email` | `U` | **DEFINER** | VERIFIED | `20261002130000_fix_account_provisioning_and_auth_integrity.sql` |
| `admin_get_security_kpis` | `J` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `admin_list_account_audit_logs` | `T` | **DEFINER** | VERIFIED | `20260925180000_super_admin_account_management.sql` |
| `admin_list_accounts` | `T` | **DEFINER** | VERIFIED | `20260925180000_super_admin_account_management.sql` |
| `admin_list_user_sessions` | `T` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `admin_provision_account` | `J` | **DEFINER** | VERIFIED | `20261007143000_phase_b_override_baseline_alignment.sql` |
| `admin_reactivate_account` | `J` | **DEFINER** | VERIFIED | `20260925180000_super_admin_account_management.sql` |
| `admin_reactivate_account_with_security` | `J` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `admin_reset_account_password` | `J` | **DEFINER** | VERIFIED | `20260925180000_super_admin_account_management.sql` |
| `admin_revoke_all_user_sessions` | `J` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `admin_revoke_session` | `J` | **DEFINER** | VERIFIED | `20261010133000_admin_revoke_audit_log_fix.sql` |
| `admin_suspend_account` | `J` | **DEFINER** | VERIFIED | `20261007215000_phase_j_fix_profiles_trigger_and_role_lookup.sql` |
| `admin_suspend_account_with_sessions` | `J` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `admin_update_account` | `J` | **DEFINER** | VERIFIED | `20261002080000_fix_worker_salary_advance_resolution_and_rls.sql` |
| `admin_update_account_permissions` | `J` | **DEFINER** | VERIFIED | `20261007220000_phase_j_fix_rate_limit_call.sql` |
| `archive_business_rule_version` | `T` | INVOKER | VERIFIED | `20261001140000_business_rules_versioning_and_reason_hardening.sql` |
| `autoconfirm_user` | `T` | **DEFINER** | VERIFIED | `20260915190000_autoconfirm_test_users.sql` |
| `check_rate_limit` | `J` | **DEFINER** | VERIFIED | `20261007200000_phase_i_layered_security_and_abuse_protection.sql` |
| `check_subtask_parent_authority` | `T` | **DEFINER** | VERIFIED | `20261007150000_phase_e_task_subtask_authority.sql` |
| `convert_lead_to_sale` | `J` | **DEFINER** | VERIFIED | `20261007200000_phase_i_layered_security_and_abuse_protection.sql` |
| `count_active_super_admins` | `I` | **DEFINER** | VERIFIED | `20260925180000_super_admin_account_management.sql` |
| `get_auth_team_member_id` | `U` | **DEFINER** | VERIFIED | `20261001180000_worker_os_sales_commissions_and_workspace.sql` |
| `get_current_team_member_ids` | `S` | **DEFINER** | VERIFIED | `20261010130000_final_session_revocation_enforcement_closure.sql` |
| `get_effective_user_permissions` | `J` | **DEFINER** | VERIFIED | `20261007140000_phase_b_granular_permissions.sql` |
| `get_team_member_id` | `U` | **DEFINER** | VERIFIED | `20261002080000_fix_worker_salary_advance_resolution_and_rls.sql` |
| `guard_deals_action_permissions` | `T` | **DEFINER** | VERIFIED | `20261007180000_phase_h_sales_granular_permissions.sql` |
| `guard_profiles_module_permissions` | `T` | **DEFINER** | VERIFIED | `20261006160000_permission_security_hardening.sql` |
| `guard_profiles_security_fields` | `T` | **DEFINER** | VERIFIED | `20261007215000_phase_j_fix_profiles_trigger_and_role_lookup.sql` |
| `guard_project_tasks_worker_columns` | `T` | **DEFINER** | VERIFIED | `20261007120000_phase_a1_security_remediation.sql` |
| `guard_user_sessions_update` | `T` | INVOKER | VERIFIED | `20261010120000_adversarial_security_hardening.sql` |
| `handle_new_user` | `T` | **DEFINER** | VERIFIED | `20260915200000_ensure_profiles_exist.sql` |
| `handle_project_task_completed_at` | `t` | **DEFINER** | VERIFIED | `20261007160000_phase_f_first_class_subtasks.sql` |
| `handle_single_featured_reel` | `T` | INVOKER | VERIFIED | `20260920170000_social_reels_cms.sql` |
| `has_module_access` | `B` | **DEFINER** | VERIFIED | `20261007140000_phase_b_granular_permissions.sql` |
| `has_parent_task_authority` | `B` | **DEFINER** | VERIFIED | `20261007150000_phase_e_task_subtask_authority.sql` |
| `has_permission` | `B` | **DEFINER** | VERIFIED | `20261010130000_final_session_revocation_enforcement_closure.sql` |
| `has_role` | `B` | **DEFINER** | VERIFIED | `20260508145232_0ff07d38-46b8-4dd1-8c8a-e8fdbef4b02b.sql` |
| `has_sada_access` | `B` | **DEFINER** | VERIFIED | `20261010130000_final_session_revocation_enforcement_closure.sql` |
| `is_admin` | `B` | **DEFINER** | VERIFIED | `20261010130000_final_session_revocation_enforcement_closure.sql` |
| `is_session_active` | `B` | **DEFINER** | VERIFIED | `20261010130000_final_session_revocation_enforcement_closure.sql` |
| `is_super_admin` | `B` | **DEFINER** | VERIFIED | `20261010130000_final_session_revocation_enforcement_closure.sql` |
| `notification_priority_weight` | `I` | INVOKER | VERIFIED | `20261006200000_notification_security_recipient_isolation.sql` |
| `prevent_audit_log_deletion` | `T` | INVOKER | VERIFIED | `20261010123000_audit_immutability_and_session_defense.sql` |
| `prevent_audit_log_update` | `T` | INVOKER | VERIFIED | `20261010123000_audit_immutability_and_session_defense.sql` |
| `prevent_delete_user_sessions` | `T` | INVOKER | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `prevent_referenced_package_deletion` | `T` | INVOKER | VERIFIED | `20260929160000_package_catalog_and_pricing_system.sql` |
| `prevent_rule_version_deletion` | `T` | INVOKER | VERIFIED | `20261001140000_business_rules_versioning_and_reason_hardening.sql` |
| `record_failed_sign_in_attempt` | `J` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `record_session_heartbeat` | `J` | **DEFINER** | VERIFIED | `20261010100000_sada_security_and_session_control_center.sql` |
| `register_user_session` | `J` | **DEFINER** | VERIFIED | `20261010131500_refine_session_closure_and_rbac.sql` |
| `reset_business_rule_to_default` | `J` | INVOKER | VERIFIED | `20261001140000_business_rules_versioning_and_reason_hardening.sql` |
| `reset_rate_limit` | `V` | **DEFINER** | VERIFIED | `20261007200000_phase_i_layered_security_and_abuse_protection.sql` |
| `resolve_and_link_current_team_member` | `T` | **DEFINER** | VERIFIED | `20261002083000_canonical_worker_team_resolution.sql` |
| `respond_to_task_handoff` | `J` | **DEFINER** | VERIFIED | `20260920203000_calendar_execution_and_handoffs.sql` |
| `revoke_user_session` | `J` | **DEFINER** | VERIFIED | `20261010131500_refine_session_closure_and_rbac.sql` |
| `set_updated_at` | `t` | INVOKER | VERIFIED | `20260712160521_8318a926-7fce-48a6-946c-80264ddacb40.sql` |
| `sync_package_catalog_to_packages` | `T` | INVOKER | VERIFIED | `20260929160000_package_catalog_and_pricing_system.sql` |
| `sync_project_task_canonical_fields` | `t` | **DEFINER** | VERIFIED | `20261007160000_phase_f_first_class_subtasks.sql` |
| `trg_auto_link_profile_to_team_member` | `T` | **DEFINER** | VERIFIED | `20261002080000_fix_worker_salary_advance_resolution_and_rls.sql` |
| `trg_auto_link_team_member_user` | `T` | **DEFINER** | VERIFIED | `20261002080000_fix_worker_salary_advance_resolution_and_rls.sql` |
| `verify_session_and_account` | `J` | **DEFINER** | VERIFIED | `20261010131500_refine_session_closure_and_rbac.sql` |
---

## 4. Storage Buckets and Policies

| Bucket ID | Public Access | File Size Limit | Allowed MIME Types | RLS Policy |
| :--- | :---: | :--- | :--- | :--- |
| `media` | **YES** | 50 MB | `image/*`, `video/*`, `application/pdf` | Authenticated upload & delete; public read |

Migration: `20260915120000_ensure_storage_media_bucket.sql` & `20260915140000_secure_storage_media_bucket.sql`

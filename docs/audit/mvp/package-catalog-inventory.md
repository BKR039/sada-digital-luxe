# SADA OS — Package Catalog & Pricing CMS Module Inventory
**Phase A: Architecture Discovery & Technical Inventory**

**Audit Date:** October 16, 2026 (SADA Operational Epoch)  
**Module Name:** Package Catalog & Pricing CMS  
**Primary Admin Route:** `/admin/packages` ([`src/routes/admin.packages.tsx`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/routes/admin.packages.tsx))  
**Public Website Surfaces:** 
- `/pricing` ([`src/routes/pricing.tsx`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/routes/pricing.tsx))
- `/contact` ([`src/routes/contact.tsx`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/routes/contact.tsx)) (Smart Package Matcher & Direct Package Selection)
**Author:** SADA OS Quality & Systems Security Gate  
**Status:** PHASE A ARCHITECTURE DISCOVERY COMPLETE  

---

## 1. Executive Overview & Scope

The **Package Catalog & Pricing CMS** is the commercial and operational engine of SADA OS. It defines the standardized service retainers, video production units, advertising scopes, digital platforms, deliverable quotas, and financial cost models for the entire agency.

It serves as the single source of truth across four major business ecosystems:
1. **Public Marketing & Sales Intake:** Governs transparent pricing on `/pricing`, direct package booking, and algorithmic recommendation on `/contact` (Smart Package Matcher).
2. **Administrative Catalog CMS:** Provides full lifecycle governance (create, edit, duplicate, archive, publish, hide, reorder) over packages, add-ons, and categories.
3. **Client Operations & Work Reconciliation:** Feeds contracted deliverable quotas (reels, posts, stories, shoot hours, shoot sessions) into Client 360, recurring task generation (`project_tasks`), and Operations Calendar.
4. **Financial OS Cost Engine:** Stores planned unit economics (employee costs, freelancer costs, transport, subscription allocations, sales commissions), auto-calculating direct costs, gross profit, and gross margin percentage.

---

## 2. Component Hierarchy & File Inventory

```
src/
├── routes/
│   ├── admin.packages.tsx                   # Admin CMS: Catalog table/cards, search, filter, status toggles
│   ├── pricing.tsx                          # Public Website: Package Catalog showcase with category grouping
│   └── contact.tsx                          # Public Website: Smart Matcher intake, Quick Match & Direct Selection
├── components/
│   ├── admin/packages/
│   │   └── PackageEditorDrawer.tsx          # Comprehensive 7-section package editor + live preview
│   ├── packages/
│   │   ├── PublicPackageCard.tsx            # Canonical pricing card component (used on /pricing & CMS preview)
│   │   ├── PricingCardHeader.tsx            # Badge, title, category & localized name
│   │   ├── PricingCardPrice.tsx             # Pricing block, currency, billing model
│   │   ├── PricingCardDeliverables.tsx      # Reels, posts, stories, shooting counters
│   │   ├── PricingCardFeatures.tsx          # Grouped features & view details trigger
│   │   ├── PricingCardCTA.tsx               # Action buttons linked to /contact?package=CODE
│   │   ├── PackageDetailsModal.tsx          # Full-scope inspection modal
│   │   ├── package-utils.ts                 # Formats, badges, official feature & exclusion libraries
│   │   └── pricing-card-types.ts            # Visual tier configurations (recommended, featured, premium)
│   ├── contact/
│   │   ├── SmartMatcherShell.tsx            # Master coordinator for 3-path intake
│   │   ├── SmartMatchLongForm.tsx           # Adaptive 7-question qualification flow
│   │   ├── QuickMatchForm.tsx               # Express 3-question intake
│   │   ├── DirectPackageSelector.tsx        # Direct public catalog search & selection
│   │   ├── RecommendationView.tsx           # Recommendation display with score & strategic gaps
│   │   ├── ContactDetailsForm.tsx           # Lead contact capture
│   │   └── SmartMatchSuccessView.tsx        # Submission confirmation & scheduling prompt
│   └── site/
│       └── PackageConversionFlow.tsx        # Inline conversion drawer / package switcher
├── lib/
│   ├── package-service.ts                   # Canonical package, category & add-on CRUD & query service
│   ├── smart-match-service.ts               # Deterministic V2 recommendation & scoring engine
│   └── package-reconciliation-service.ts    # Propagates package quotas to client deliverables & tasks
└── types/
    ├── package-catalog.ts                   # TypeScript interfaces for packages, add-ons & categories
    └── smart-match.ts                       # TypeScript interfaces for qualification & recommendation
```

---

## 3. Database Entity Inventory

The canonical data layer is defined in [`supabase/migrations/20260929160000_package_catalog_and_pricing_system.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20260929160000_package_catalog_and_pricing_system.sql) and [`supabase/migrations/20261001103000_migrate_packages_foreign_keys_to_package_catalog.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261001103000_migrate_packages_foreign_keys_to_package_catalog.sql):

### 3.1 `public.package_catalog` (Authoritative SSOT)
- **Primary Key:** `id UUID DEFAULT gen_random_uuid()`
- **Natural Key:** `code TEXT NOT NULL UNIQUE` (e.g. `MG-01`, `HY-03`, `WEB-02`)
- **Web Slug:** `slug TEXT NOT NULL UNIQUE`
- **Identity & Copy:** `name`, `name_ar`, `description`, `description_ar`, `short_description`, `short_description_ar`
- **Taxonomy:** `category_id REFERENCES public.package_categories(id)`, `category_name TEXT`
- **Commercial:** `price NUMERIC(12,2)`, `currency TEXT DEFAULT 'TND'`, `billing_type TEXT CHECK (billing_type IN ('monthly', 'one_time', 'starting_from', 'custom'))`, `custom_pricing BOOLEAN DEFAULT false`
- **Publication & Visibility:** `is_active BOOLEAN DEFAULT true`, `is_published BOOLEAN DEFAULT true`, `is_featured BOOLEAN DEFAULT false`, `badge TEXT`, `badge_ar TEXT`, `priority INT`, `display_order INT`
- **Deliverables & Quotas:** `monthly_reels INT`, `monthly_posts INT`, `monthly_stories TEXT`, `production_hours NUMERIC(8,2)`, `production_sessions INT`, `platforms TEXT[]`
- **Service Inclusions/Exclusions:** `included_items JSONB`, `excluded_items JSONB`, `has_ads_management BOOLEAN`, `has_website BOOLEAN`, `has_strategy BOOLEAN`, `has_community_management BOOLEAN`, `website_scope TEXT`
- **Financial OS Generated Columns:**
  - `employee_cost NUMERIC(12,2) DEFAULT 0`
  - `freelancer_cost NUMERIC(12,2) DEFAULT 0`
  - `transport_cost NUMERIC(12,2) DEFAULT 0`
  - `subscription_allocation NUMERIC(12,2) DEFAULT 0`
  - `commission NUMERIC(12,2) DEFAULT 0`
  - `direct_costs NUMERIC(12,2) GENERATED ALWAYS AS (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission) STORED`
  - `gross_profit NUMERIC(12,2) GENERATED ALWAYS AS (price - direct_costs) STORED`
  - `gross_margin NUMERIC(8,2) GENERATED ALWAYS AS (CASE WHEN price > 0 THEN ((price - direct_costs) / price) * 100.0 ELSE 0.0 END) STORED`
- **Integrity Trigger:** `prevent_referenced_package_deletion()` raises an exception if a package referenced by `clients`, `deals`, `client_deliverables`, `production_bookings`, or `project_tasks` is deleted. Archive (`is_active = false`) is required.

### 3.2 `public.package_categories`
- **Fields:** `id`, `code`, `name`, `name_ar`, `slug`, `description`, `description_ar`, `display_order`, `priority`, `is_active`.
- **Seeded Master Categories (9):** `SMM`, `PRODUCTION`, `STORY`, `ADS`, `WEB`, `STRATEGY`, `COMBINED`, `CUSTOM`, `ADDONS`.

### 3.3 `public.package_addons`
- **Fields:** `id`, `code`, `name`, `name_ar`, `price`, `unit`, `percentage_modifier`, `category`, `description`, `is_active`, `display_order`.

### 3.4 Legacy `public.packages` (DEPRECATED)
- Retained for historical schema compatibility only.
- In migration `20261001103000`, all foreign keys (`deals`, `clients`, `client_deliverables`, `project_tasks`, `production_bookings`) were migrated to `public.package_catalog`. Dual-write trigger was dropped.

---

## 4. Administrative Control Surface (`/admin/packages`)

### 4.1 Header & Metrics Pulse Bar
- Total Packages Count
- Published Packages Count
- Draft / Inactive Packages Count
- Average Gross Margin Percentage

### 4.2 Views & Tabs
- **Packages Tab:**
  - Table View & Cards Grid View
  - Search input (matches name, name_ar, code, short_description)
  - Category filter dropdown & Status filter dropdown (`all`, `published`, `draft`, `archived`)
  - Direct Actions: Edit, Duplicate, Publish / Hide toggle, Archive, Delete
  - Reordering mode (Display order up/down arrows)
- **Add-ons Tab:**
  - Create / edit add-on dialog (code, name, price, unit, percentage modifier, category)
  - Active/inactive toggle & archive
- **Categories Tab:**
  - Category display order & active status management

### 4.3 Package Editor Drawer (`PackageEditorDrawer.tsx`)
Multi-section drawer supporting both **Config Mode** and **Live Public Preview Mode**:
1. **Identity:** Code, Title (EN/AR), Slug, Category, Package Type, Badge (EN/AR), Priority, Display Order, Short Description (EN/AR), Full Description (EN/AR).
2. **Pricing & Costs:** Selling price, Currency, Billing Type, Custom pricing flag, Cost engine inputs (employee, freelancer, transport, subscription, commission), Live margin KPI card with warning badges.
3. **Deliverables:** Monthly reels count, monthly posts count, stories description, shooting hours, shooting sessions, supported platforms.
4. **Services (Inclusions):** Structured JSON array of included features with quick-insert from Official SADA Library.
5. **Exclusions:** Structured JSON array of out-of-scope boundaries (e.g. ad spend separation).
6. **Operations:** High-impact capability toggles (Meta Ads, Website, Marketing Strategy, Community Moderation).
7. **Smart Matching:** Target business sectors, strategic goals, growth stage, comfortable budget band, consultant positioning statement.

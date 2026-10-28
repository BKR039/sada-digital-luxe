# SADA Project / Case Study CMS

This is the target architecture for the case-study system, documented against what's actually implemented in `sada-digital-luxe` today. This feature area is actively being built/refined — read this before touching `projects`, `admin.projects.tsx`, `case-studies.tsx`, or `case-studies.$slug.tsx`.

> [!NOTE]
> **Projects vs. Client Projects:**
> - `projects` is the **public portfolio & case studies CMS** (marketing showcase for finished work, slug-based public URLs, testimonials, metrics).
> - `client_projects` (with `project_tasks`, `project_activity`) is the **internal operational delivery CRM** in `/admin/client-projects`, tracking active client engagements, checklists, deadlines, assignees, progress calculation, calendar events, and team workload.

## CURRENT: `projects` table (Supabase Postgres, RLS enabled)

Assembled from the base table (migration `20260508145232`), subsequent migrations, and the Case Studies CMS upgrade (`20260917120000_case_studies_cms_upgrade.sql`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `title` | text, required | Prominently displayed in hero and cards |
| `slug` | text, unique, required | Auto-generated from title, manually editable, unique |
| `client` | text | Client / brand name |
| `industry` | text | Descriptive eyebrow label (e.g. Travel & Tourism) |
| `category` | text | Drives filter categorization |
| `description` | text | Executive overview / narrative summary |
| `challenge` / `objective` / `strategy` / `process` | text | Strategic case-study narrative sections |
| `services` | text[] | Canonical SADA services (Marketing, Development, Production) |
| `deliverables` | text[] | Tangible outputs delivered |
| `metrics` | jsonb, default `[]` | Array of verified `{ value, label, period?, source? }` |
| `results` | text | Qualitative results summary |
| `testimonial` | jsonb, nullable | `{ quote, name, role? }` — imported from DB or custom |
| `team_member_ids` | uuid[], default `{}` | References `team_members.id` (public-safe profiles) |
| `cover_url`, `thumbnail_url` | text | Detail page hero cover vs. portfolio grid card thumbnail |
| `gallery` | jsonb, default `[]` | Array of image/video URLs rendered via `MediaGallery` |
| `before_url` / `after_url` | text | Optional before/after visual comparison block |
| `seo_title` | text, nullable | Custom page title override for search engines |
| `seo_description` | text, nullable | Custom meta description override for search engines |
| `tags` | text[] | |
| `external_url` | text | Public live proof link |
| `project_date` | date | Used for year display |
| `featured` | boolean | Controls appearance on Homepage "Featured Work" section |
| `published` | boolean, default false | Gates public visibility (draft vs published) |
| `sort_order` | int | Admin list ordering and "Next Project" sequencing |
| `created_at` / `updated_at` | timestamptz | |

RLS:
- Public: `SELECT` only where `published = true`.
- Admins: `SELECT`, `INSERT`, and `UPDATE` on all records (`is_admin(auth.uid())`).
- Super Admins: Permanent `DELETE` strictly restricted to `is_super_admin(auth.uid())`.

## CURRENT: Full-Page Admin CMS Workspace

- **Routes:**
  - Layout: `src/routes/admin.projects.tsx` (`<Outlet />`)
  - CMS Registry: `src/routes/admin.projects.index.tsx` (`/admin/projects/`)
  - Full-Page Editor: `src/routes/admin.projects.$id.tsx` (`/admin/projects/$id` and `/admin/projects/new`)
- **CMS List Workspace (`/admin/projects`):**
  - Metric summary pills: Total Projects, Published, Drafts.
  - Search input (title, client, industry, slug) + Status tabs (All, Published, Drafts) + Category filter.
  - Case study cards with thumbnail preview, title, client, slug, services tags, published/draft badge, featured toggle, and quick actions.
  - Actions: Edit, Preview (`/case-studies/${slug}?preview=true`), 1-click Publish/Unpublish toggle, and Super Admin Delete via `AlertDialog`.
- **Full-Page Editor Workspace (`/admin/projects/$id`):**
  - Replaces the small modal form completely.
  - Top command bar with sticky back navigation, live status pill, `Save Draft`, `Preview`, `Publish` (with validation checklist), and `Unpublish`.
  - 8 Structured Editorial Sections:
    1. Overview & Basics (Title, auto-slug, client, industry, category, date, description, featured)
    2. Project Story (Challenge, Objective, Strategy, Process)
    3. Services & Deliverables (Canonical SADA taxonomy from `DIVISIONS`, custom services, deliverables tags)
    4. Results & Proof (Qualitative results, verified metrics builder, live website link)
    5. Media & Gallery (`MediaUpload` for thumbnail and hero cover, `MediaUploadMulti` for gallery, before/after)
    6. Team Members (Interactive multi-select from active `team_members`)
    7. Client Testimonial (Import 1-click from `testimonials` DB or enter custom verified quote)
    8. SEO & Social (Custom meta title, description, and live Google SERP preview)
  - Publish Validation Checklist:
    Evaluates required minimum fields (title, slug, client/overview, description, thumbnail/cover, story/services) before publishing to prevent incomplete public pages. Shows an actionable checklist modal if missing.

## CURRENT: Public Portfolio & Dynamic Detail Page

- **Portfolio Grid (`/case-studies`):**
  - Responsive grid (1 col mobile, 2 col tablet, 2-3 col desktop).
  - Project cards with 16:10 thumbnail, industry eyebrow, client & project title, short narrative description, service tags, and "View Case Study →" CTA.
  - Directly links to `/case-studies/$slug`.
  - Empty state ("Selected work is coming soon.") renders only when zero published projects exist.
- **Dynamic Case Study Page (`/case-studies/$slug`):**
  - Dynamic route loading project by slug from `public.projects`.
  - Dedicated sections: Hero cover, Overview, Challenge, Objective, Strategy, What SADA Did, Media Gallery, Before/After, Deliverables, Animated Metrics, Client Testimonial, Team Showcase, Next Project, CTA.
  - Team Behind The Work: queries public-safe attributes (`name`, `position`, `division`, `photo_url`, `socials`) from `team_members` based on `team_member_ids`.
  - Preview Mode: supports `?preview=true` for authenticated admins with top banner and direct edit link.
  - SEO: Dynamic `<head>` metadata with title, description, OG tags, and canonical links.
  - Single Source of Truth: Homepage `FeaturedProjects` queries the same `projects` table where `published = true AND featured = true`.

## TARGET: Project basic data

Title, Client, Slug, Short Description, Industry, Year, Cover, Thumbnail, Services, Categories, Featured, Status, SEO.

Gap vs CURRENT:
- "Categories" (plural) is target; CURRENT `category` is a single free-text string, not a multi-select/array.
- "Status" as a first-class field is target; CURRENT only has the `published` boolean (no draft/archived states to store).
- Dedicated per-project SEO fields (title/description/OG image) are target; CURRENT derives these automatically from existing content fields with no override.
- Year: CURRENT derives year from `project_date` rather than storing it directly — equivalent in practice, no action needed unless a project needs a year with no exact date.

## TARGET: Multiple media

Images, Gallery, Video, Alt text, Captions, Ordering.

CURRENT: `gallery` (jsonb array of URLs) + `cover_url`/`thumbnail_url`/`before_url`/`after_url` exist and support images and video (`SmartMedia` auto-detects type). **Gap:** no alt text or caption fields anywhere in the schema — gallery items are bare URLs, and ordering within the gallery array is whatever order they were uploaded in (no explicit per-item `order` field or drag-reorder UI confirmed in `MediaGallery`/`MediaUpload`).

## TARGET: Custom page sections (ordered, per-project)

Projects are not fixed templates — target is an ordered list of sections, each with `type`, `content`, `settings`, `order`, `visible`, independently addable/editable/removable/hideable/reorderable by the admin. Example: description can be hidden while photos stay visible.

**This is the single biggest gap.** CURRENT `case-studies.$slug.tsx` renders a **fixed sequence** of sections (Hero → Overview → Challenge → Objective → Strategy → What SADA Did → Gallery → Before/After → Deliverables → Results → Testimonial → Next Project → CTA), each conditionally rendered only if its backing column has content. This already gets you "hide a section by leaving it empty" for free, but it does **not** give you: arbitrary section ordering per project, multiple sections of the same type, custom/one-off section types, or hiding a section that *does* have content (no independent `visible` flag — content presence is the only toggle).

Building the TARGET dynamic-sections model would mean introducing a new `project_sections` table (or a `sections` jsonb column on `projects`) keyed to `order`/`visible`/`type`/`content`/`settings`, plus a section-type renderer registry on the public detail page and a section builder/reorder UI in the admin. Initial section types per target: Text, Image, Gallery, Image Grid, Full-width Media, Text + Image, Metrics, Process, Services, Video, Testimonial, Before/After, CTA, Custom Section. Treat this as a distinct, larger feature — do not attempt to bolt it onto the current fixed-column model piecemeal.

## TARGET: Process

Process steps customizable per project, not one hardcoded process for every case study.

CURRENT: `process` is a single free-text field (an optional narrative paragraph shown above the services list) — not a structured, repeatable step list. The site-wide `PROCESS` constant (Discover/Strategize/Create/Launch/Improve, `src/data/services.ts`) is a separate, general marketing-page concept and is not tied to individual projects. Gap: no structured per-project process-steps data model exists yet.

## CURRENT: Public behavior

- Published projects appear at `/case-studies` (grid, with category filter tabs shown only when there are >4 items and >1 distinct category) and have a detail page at `/case-studies/$slug`.
- `featured` boolean exists on the schema; confirm `FeaturedProjects.tsx` (homepage) actually filters on it before assuming it's wired end-to-end — not deep-inspected in this pass.
- Drafts (`published = false`) are excluded from both the index query and the detail-page loader (`.eq("published", true)`), so they're correctly private — not just UI-hidden. This matches the target security requirement below.
- "Next Project" on the detail page is derived live via `sort_order` (next published project after the current one) — no manual "related project" field.

## Security

CURRENT already matches target intent: RLS enforces `published = true` for anonymous reads at the database level (see migration `20260508145232`), not just client-side filtering — public users cannot fetch draft projects even by guessing an ID/slug. Only `is_admin(auth.uid())` can mutate. Keep this invariant when building the sections feature: any new `project_sections` table must carry the same RLS pattern (`visible`/parent-published gating), never rely on UI hiding alone.

## Media

Use the existing `media` Storage bucket and `SmartMedia`/`MediaUpload` components (see SADA_ARCHITECTURE.md → Storage) for any new media-bearing fields. Never store large media as base64 in the database — CURRENT already follows this (URLs only).

## Performance

Responsive images, lazy loading below the fold, hero media prioritized, avoid layout shift. CURRENT: hero cover uses `loading="eager"`; other `SmartMedia` usages default to lazy; homepage below-the-fold sections are code-split via `React.lazy`/`Suspense`. No explicit responsive `srcset`/`sizes` handling was confirmed in `SmartMedia.tsx` in this pass — verify before assuming it's automatic.

## SEO

Project-specific title, description, OG image, canonical URL — CURRENT already derives all of these automatically per-project in `case-studies.$slug.tsx`'s `head()`. Target adds admin-editable overrides (see Basic Data gap above).

## Content Integrity

No fake results, no fake testimonials, no fake client information. **See `docs/SADA_CONTENT.md` for the current conflict:** the live `projects` table is currently seeded with fabricated case studies (fake clients, fake metrics, stock photography) via migration `20260512231409`. This must be resolved (replaced with real data, or clearly marked as non-production placeholder) before any of this is treated as real published content.

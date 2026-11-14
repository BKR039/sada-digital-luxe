# SADA Portfolio & Case Studies CMS — Durable Memory

## Core Principles
1. **Public Portfolio, Not Internal CRM:** Case studies showcase completed SADA work to public prospects. Operational core (`client_projects`, `project_tasks`, `project_activity`, `clients`) remains isolated and untouched.
2. **Single Source of Truth:** Homepage featured projects and `/case-studies` index query `public.projects`. No duplicate hardcoded lists.
3. **No Hardcoded Project Pages:** All published case studies render dynamically via `/case-studies/$slug`.
4. **Editorial CMS Workspace:** Admin management via `/admin/projects` list and `/admin/projects/$id` full-page editor (no small modal).

## Architecture & Schema
- Table: `public.projects`
  - Columns: `id`, `title`, `slug`, `client`, `industry`, `category`, `description`, `challenge`, `objective`, `strategy`, `process`, `services`, `deliverables`, `metrics`, `results`, `testimonial`, `team_member_ids`, `cover_url`, `thumbnail_url`, `gallery`, `before_url`, `after_url`, `seo_title`, `seo_description`, `featured`, `published`, `sort_order`, `created_at`, `updated_at`.
- RLS Policies:
  - Public SELECT: `published = true`.
  - Admin SELECT, INSERT, UPDATE: `public.is_admin(auth.uid())`.
  - Super Admin DELETE: `public.is_super_admin(auth.uid())`.
- Storage:
  - Bucket: `media`
  - Subfolder: `projects`
  - Components: `MediaUpload` (single image/video), `MediaUploadMulti` (reorderable gallery).

## Editorial Workflow
1. **Create:** Navigate to `/admin/projects/new`.
2. **Save Draft:** Saves progress with `published = false` at any point.
3. **Preview Mode:** Accessible at `/case-studies/$slug?preview=true` (guarded by RLS so anonymous users cannot read drafts).
4. **Publish Validation:** Validates required fields (`title`, `slug`, `client/overview`, `description`, `thumbnail/cover`, `story/services`). Displays checklist modal if missing.
5. **Publish:** Sets `published = true`. Card immediately appears on `/case-studies` and dynamic page is live.
6. **Unpublish / Archive:** Reverts `published = false`.
7. **Permanent Deletion:** Restricted to Super Admin role with `AlertDialog` confirmation.

## Testing & Verification
- Test script: `scripts/test-case-studies.ts` (30/30 tests passing).
- Validated:
  - Draft isolation from public queries.
  - Slug uniqueness enforcement.
  - Publish validation checklist.
  - Dynamic page rendering & public card presentation.
  - Team member relationship via `team_member_ids`.
  - Media upload & gallery structure.
  - RBAC permission enforcement (Worker restricted, Admin can edit, Super Admin can delete).
  - TypeScript compilation (0 errors) & production build.

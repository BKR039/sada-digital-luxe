# SADA Instagram Reels Showcase & Admin CMS

## Overview

The SADA Reels system provides a media preview experience on the SADA homepage, showcasing SADA's real Instagram Reels directly within a custom digital media player frame.

- **Content Source:** Instagram / Meta. SADA does **not** store or host video files (`.mp4`, `.mov`, etc.).
- **Frame & Experience:** SADA. The outer Reel frame is part of SADA's brand identity, utilizing SADA design tokens, liquid glass, and ambient cyan/blue glows.
- **Playback:** Interactive Lightbox Modal utilizing the official Meta Instagram embed iframe (`https://www.instagram.com/reel/{shortcode}/embed/`).
- **Management:** Internal Admin CMS at `/admin/reels` with real-time URL validation, thumbnail uploads, drag/button reordering, and atomic single-featured reel assignment.

---

## 1. Database Schema (`public.social_reels`)

Managed via migration `supabase/migrations/20260920170000_social_reels_cms.sql`:

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier |
| `slug` | TEXT | NOT NULL, UNIQUE | URL-safe slug |
| `instagram_url` | TEXT | NOT NULL | Canonical Instagram URL |
| `instagram_shortcode` | TEXT | NOT NULL | Extracted shortcode (e.g. `C7-X5zTsp9Q`) |
| `title` | TEXT | NOT NULL | Reel display title |
| `caption` | TEXT | NULLABLE | Optional summary or narrative note |
| `thumbnail_url` | TEXT | NOT NULL | High-resolution 9:16 thumbnail image |
| `category` | TEXT | DEFAULT 'General' | e.g. Creative Strategy, Production |
| `display_order` | INTEGER | NOT NULL, DEFAULT 0 | Deterministic carousel sequence |
| `is_published` | BOOLEAN | NOT NULL, DEFAULT false | Public homepage visibility gate |
| `is_featured` | BOOLEAN | NOT NULL, DEFAULT false | Primary leading Reel on Homepage |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Last update timestamp |

### Single-Featured Integrity Constraint & Trigger
At most **one Reel** can be featured at any time:
1. **Partial Unique Index:**
   ```sql
   CREATE UNIQUE INDEX idx_social_reels_single_featured
     ON public.social_reels (is_featured)
     WHERE is_featured = true;
   ```
2. **PostgreSQL Trigger:**
   `trigger_single_featured_reel` automatically executes `public.handle_single_featured_reel()` before INSERT or UPDATE. If a reel is marked `is_featured = true`, any other reel's `is_featured` is atomically set to `false`.

---

## 2. Security & Role-Based Access Control (RLS)

Granular security policies strictly adhering to SADA RBAC:

- **Anonymous / Public:**
  - `SELECT` allowed ONLY for published reels (`is_published = true`).
  - Draft reels are strictly invisible.
- **Worker:**
  - Read-only on published content. Prohibited from INSERT, UPDATE, or DELETE on `social_reels`.
- **Admin:**
  - `SELECT`, `INSERT`, and `UPDATE` permitted (`public.is_admin(auth.uid())`).
  - Can draft, publish, unpublish, reorder, and set featured reels.
- **Super Admin:**
  - Full permissions, including permanent record deletion (`public.is_super_admin(auth.uid())`).

---

## 3. Storage Architecture

- **Bucket:** Supabase Storage `media` bucket.
- **Folder:** `reels/` (e.g., `media/reels/reel-idea-to-sales.webp`).
- **Policy:** Read is public (so thumbnails render to all visitors). Upload, update, and delete require authenticated admin session.
- **Rule:** Only image thumbnails are accepted. Video files are prohibited from upload.

---

## 4. Homepage Component Architecture

### Insertion Point
Located in `src/routes/index.tsx`:
```
HERO (Approved, 100% untouched)
↓
TrustedBy
↓
Stats
↓
Services ("Everything your brand needs to grow.")
↓
ReelsShowcase ("Real content. Real results.") ← INSERTION POINT
↓
FeaturedProjects ("Projects we're proud of.")
↓
...
```

### Components
1. `src/components/home/ReelsShowcase.tsx`:
   - Queries `social_reels` ordered by `is_featured DESC, display_order ASC`.
   - Handles zero/low-content states (0 = hidden, 1 = centered dominant card, 2 = 2-column, 3+ = full carousel).
   - Embla-powered 3D carousel with center card dominance (scale 1.05, cyan ambient glow).
   - Autoplay (4.5s) with pause on hover, focus, drag, and modal open. Honors `prefers-reduced-motion`.
   - Accessible circular Prev/Next controls and pagination dots (`● ○ ○ ○`).
   - SADA Instagram CTA linking to official profile `@sada.media.production`.
2. `src/components/home/ReelFrame.tsx`:
   - Digital media player frame (no phone mockups or fake bezels).
   - Dark SADA surface (`#0B1120`), 28-34px rounded corners, ambient glow (`#18C7F7` / `#1B6DFF`).
   - Strict 9:16 vertical ratio with object-cover thumbnail.
   - Whole-frame hover lift (`translateY(-4px)`).
   - Subtle hover micro-overlay with `▶ Watch Reel`.
3. `src/components/home/InstagramReelModal.tsx`:
   - Lightbox modal rendered in-place over homepage.
   - Body scroll locked while open; Escape key and backdrop click close.
   - Embeds official Meta iframe: `https://www.instagram.com/reel/${shortcode}/embed/`.
   - Secondary link: "Open on Instagram →" to view on the native app/web.

---

## 5. Admin CMS (`/admin/reels`)

Located in `src/routes/admin.reels.tsx` and registered in `src/routes/admin.tsx`:
- List view of all reels with 9:16 thumbnail previews, category, shortcode, and badges.
- Move Up / Move Down buttons for immediate persistence of display order.
- One-click Publish / Unpublish toggle.
- One-click Featured toggle with automatic mutual exclusivity.
- Edit modal with real-time Instagram URL regex validation and thumbnail manager.
- Super Admin delete confirmation modal using Radix `AlertDialog`.

---

## 6. Automatic Instagram Sync Status

- **Status:** Architecture-Ready (Manual CMS mode currently active).
- **Explanation:** Meta Graph API / Instagram Basic Display API credentials are not configured in the project environment. Scrapers and unofficial endpoints are strictly prohibited. The database schema stores `instagram_shortcode` and standard timestamps so official Meta webhooks or scheduled token sync can be integrated seamlessly in the future without altering public frontend components.

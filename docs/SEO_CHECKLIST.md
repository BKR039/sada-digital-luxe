# SADA SEO Checklist

Pattern extracted from the actual implementation (`src/routes/__root.tsx`, `src/routes/case-studies.$slug.tsx`). Use this checklist for every new public route.

## Every public route must set, via TanStack Router's `head()`

- [ ] `<title>` — specific to the page, not just "SADA"
- [ ] `meta name="description"`
- [ ] `og:title`, `og:description`, `og:type`
- [ ] `twitter:card` (`summary_large_image`), `twitter:title`, `twitter:description`
- [ ] canonical `<link rel="canonical">`

## Dynamic detail routes (pattern: `case-studies.$slug.tsx`)

- [ ] Build `head()` from **loader data**, not static strings, so title/description/OG reflect the actual record.
- [ ] Include `og:image` only when a real cover image exists — don't fall back to a generic placeholder silently (current pattern conditionally spreads it in).
- [ ] Handle the not-found case with its own minimal `head()` (see `case-studies.$slug.tsx`'s `"Case study not found — SADA"` fallback).

## Sitewide (set once, in `__root.tsx`)

- [x] Global fallback meta (title/description/OG/Twitter) — already present.
- [x] `viewport` and `charSet` meta — already present.
- [ ] `sitemap.xml` — confirmed **not** to exist (2026-07-31 audit). Deliberately deferred: no production domain is bound yet (`wrangler.jsonc` has no custom route), and a sitemap needs absolute URLs — a placeholder domain would itself be fake content. Generate once the real domain is known; prefer a dynamic route over a static file so it tracks published `blog_posts`/`projects`/`products`.
- [x] `robots.txt` — added `public/robots.txt` (2026-07-31): allows all crawling, disallows `/admin` and `/auth`. Add the `Sitemap:` directive once `sitemap.xml` exists.

## Per-entity gaps (Projects CMS)

- No admin-editable SEO override fields exist on `projects` yet (title/description/OG image are always auto-derived). See `.memory/10_todo.md`.

## Don't

- Don't hardcode a page title without also setting `description` and the `og:*`/`twitter:*` equivalents — the existing pattern always sets them together.
- Don't add a new dynamic route without wiring its `head()` from loader data if it has per-record content (follow the case-study pattern).

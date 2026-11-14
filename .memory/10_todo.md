# SADA TODO

Unfinished, actionable work. Remove an item once it ships (record it in `.memory/08_decisions.md` instead).

| Feature | Priority | Dependencies | Estimated Complexity | Status |
|---|---|---|---|---|
| Super Admin review & approval of 9 Proposed Public Packages (`PUB-MS-01..03`, `PUB-OD-01..03`, `PUB-IS-01..03`) before publishing to live website | High | Business review by Boubakar | Low (Admin UI approval) | Open — 9 draft packages seeded in DB, strictly unpublished per governance |
| Replace seeded fake clients/team/testimonials with real content | Critical | Real client assets from the business | Low (content, no code) | Open — note: the live DB is currently empty (new Supabase project as of 2026-07-31), so this fake seed data is not actually visible on the live site; it only exists in a historical migration file. Still don't copy its pattern for real content. |
| Real Privacy Policy / Terms of Service pages (footer currently links both to `/`) | Medium | Legal copy | Low–Medium | Open |
| Dynamic ordered project sections (Text/Image/Gallery/Metrics/etc., admin-reorderable) | High | New `project_sections` table or `sections` jsonb column, renderer registry, admin builder UI | High | Open (see `.memory/09_future.md`) |
| Categories as multi-select on projects | Low–Medium | Schema change (`category` → `text[]`), update filter-tab logic in `case-studies.tsx` | Low–Medium | Open |
| Gallery alt text + captions + explicit per-item ordering | Medium | Schema addition (structured gallery items instead of bare URL array), `MediaGallery`/`MediaUpload` updates | Medium | Open |
| Structured per-project process steps (vs. one free-text field) | Low | Schema addition | Medium | Open |
| Generate a real `sitemap.xml` (ideally dynamic, from published slugs) once the production domain is confirmed | Medium | Known production domain | Low–Medium | Open — `robots.txt` added 2026-07-31, sitemap deliberately deferred |
| "Watch Showreel" hero CTA + reel lightbox | Medium | A real showreel video URL | Low–Medium | Open — hero currently ships "View Our Work" -> `/case-studies` instead |
| Reconcile hero stats with `Stats.tsx` (and confirm both are real) | High | Real numbers from the business | Low | Open — see `.memory/11_known_issues.md` |
| Decide whether to keep or delete the 1.6 MB hero PNG masters in `src/assets` before first commit | Low | — | Low | Open — they are untracked and unreferenced (WebP is what ships) |
| SADA OS Phase 9: Client Portal external guest authentication & review workflow | Low–Medium | SADA OS Phases 1–8 (Complete) | High | Target |


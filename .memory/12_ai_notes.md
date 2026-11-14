# SADA — Permanent AI Rules

Standing rules for any AI agent (or human) working on this repo. These don't expire with a feature or a sprint — treat them as load-bearing.

## Content integrity
- Never create fake metrics.
- Never invent testimonials.
- Never generate fake client names, logos, or results.
- Never invent employee counts, revenue, or years of experience.
- If real data isn't available, omit the section or ask for it — don't fill the gap with something plausible-sounding.
- The current `projects`/`team_members`/`testimonials` tables already contain fake seeded data (see `.memory/06_clients.md`) — this is a known, tracked violation of this rule, not a precedent to follow. Do not add more on top of it.

## Design / brand
- Preserve the SADA Gradient (blue → cyan, atmospheric use — not flat blocks everywhere).
- Preserve Liquid Glass (`.glass`/`.glass-strong` — solid card in light mode, real blur in dark mode; don't make every surface glass).
- Echo Stack, echo lines, frequency graphics, and signal motifs are deprecated forever — never reintroduce them.
- Use the fonts actually implemented (Sora display, Manrope body — see `docs/SADA_BRAND_GUIDELINES.md`). The brand brief calls for "uploaded/custom fonts"; until real font files are added to the repo, Sora/Manrope via Google Fonts is the current reality — don't claim custom fonts exist when they don't.

## Engineering
- Reuse existing components before creating new ones — check `src/components/ui`, `src/components/site`, `src/components/admin`, `src/components/media` first.
- Prefer editing over rewriting. Don't redesign unrelated pages while working on one feature.
- Schema changes always go through a new file in `supabase/migrations/` — never hand-edit an existing migration.
- Every table needs RLS; admin-only access is enforced via `is_admin(auth.uid())`/`has_role()`, not client-side `isAdmin` state alone.
- New admin CRUD sections extend `src/components/admin/CrudPage.tsx` with a `FieldDef[]` schema — don't hand-roll a new CRUD screen.
- Run `npm run lint` and `npm run build` after implementation changes.

## Documentation
- Documentation is part of the product — keep `CLAUDE.md`, `docs/*`, and `.memory/*` in sync with the actual implementation after every completed feature.
- Never invent progress percentages, features, or history — see `.memory/13_project_health.md` and `.memory/08_decisions.md` for how those are estimated/recorded.
- Distinguish CURRENT vs TARGET explicitly whenever documenting something that isn't finished yet.

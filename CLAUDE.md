# SADA Development Instructions

SADA is a creative and digital company combining:
Marketing × Development × Production

Repo: `sada-digital-luxe` (TanStack Start + Supabase, deployed on Cloudflare Workers).

## Documentation

Read ONLY documentation relevant to the current task.

Brand identity:
→ docs/SADA_BRAND_GUIDELINES.md

UI/UX:
→ docs/SADA_DESIGN_SYSTEM.md

Website copy/content:
→ docs/SADA_CONTENT.md

Technical architecture:
→ docs/SADA_ARCHITECTURE.md

Projects / Case Studies CMS:
→ docs/SADA_PROJECT_CMS.md

Database rules:
→ docs/DATABASE_RULES.md

SEO checklist:
→ docs/SEO_CHECKLIST.md

Performance patterns:
→ docs/PERFORMANCE.md

## Project Memory (`.memory/`)

This repo's documentation is a permanent, self-maintaining system — after every completed feature, sync the relevant docs above AND the relevant `.memory/` file(s) below. Never let either go stale.

| File | Purpose |
|---|---|
| `.memory/06_clients.md` | Real clients on file |
| `.memory/08_decisions.md` | Dated technical/product decision log |
| `.memory/09_future.md` | Postponed ideas (not scheduled) |
| `.memory/10_todo.md` | Unfinished, actionable work |
| `.memory/11_known_issues.md` | Known problems — never hidden |
| `.memory/12_ai_notes.md` | Permanent rules for anyone working on this repo |
| `.memory/13_project_health.md` | Realistic, evidence-based completion estimates |

Update only the `.memory/` file(s) a given change actually affects — see `.memory/README.md`.

## Core Development Rules

- Inspect before modifying.
- Reuse existing components before creating new ones (check `src/components/ui`, `src/components/site`, `src/components/admin`, `src/components/media` first).
- Do not redesign unrelated pages.
- Do not explore the entire repository for localized tasks.
- Avoid spawning subagents unless genuinely necessary.
- Prefer direct targeted file inspection.
- Preserve existing architecture unless a change is justified.
- Never create fake business information.
- Never invent clients, metrics, testimonials, awards or results.
- **Known issue:** the `projects`, `team_members`, and `testimonials` tables currently contain seeded placeholder/demo data (fake clients, metrics, team bios, quotes) inserted by migration `20260512231409_...sql`. Do not treat this seed data as real SADA content, do not copy its pattern when adding new "real" records, and do not add more invented data on top of it. See docs/SADA_CONTENT.md.
- Preserve responsive behavior.
- Preserve accessibility.
- Preserve Light and Dark modes.
- Use existing dependencies before adding new ones.
- Do not duplicate data sources.
- Do not leave dead code.
- Run appropriate tests/build after implementation (`npm run lint`, `npm run build`).
- Stop after completing the requested scope.

## SADA Visual Rules

SADA fingerprint:
Gradient + Liquid Glass + Typography

Never introduce:
- Echo Stack
- Echo lines
- frequency graphics
- signal motifs

Fonts currently implemented: Sora (display/headings), Manrope (body), Orbitron (uppercase accent labels) — loaded via Google Fonts CDN in `src/routes/__root.tsx`, not self-hosted files. See docs/SADA_BRAND_GUIDELINES.md for the CURRENT vs TARGET note on this.

## Workflow

For every task:
1. Read CLAUDE.md.
2. Read ONLY docs relevant to the requested feature.
3. Inspect ONLY the relevant implementation.
4. Implement the requested feature.
5. Run appropriate tests/build (`npm run lint`, `npm run build`).
6. Synchronize documentation (only the files actually affected).
7. Update project memory (`.memory/` — decisions, TODOs, known issues, project health, as applicable).
8. Report (see `.memory/12_ai_notes.md` for the standing rules this report should honor — e.g. never invent progress or fake history).
9. Stop. Never continue to another feature automatically.

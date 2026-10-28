# SADA — sada-digital-luxe

SADA is a creative and digital company combining Marketing × Development × Production. This repo is the SADA marketing website, admin CMS, and supporting backend.

## Stack

TanStack Start (React 19) + Vite 7 + Tailwind CSS v4 + shadcn/ui, backed by Supabase (Postgres/Auth/Storage), deployed to Cloudflare Workers. Full breakdown: `docs/SADA_ARCHITECTURE.md`.

## Getting started

```bash
bun install       # or npm install — see .memory/10_todo.md re: dual lockfiles
bun run dev        # start the dev server (vite dev)
bun run build       # production build
bun run lint        # eslint
bun run format       # prettier --write .
```

Requires Supabase environment variables — see `docs/SADA_ARCHITECTURE.md` → Environment Variables (names only; ask a team member for real values, never commit them).

## Documentation

This repo maintains its own documentation as the source of truth — read `CLAUDE.md` first, it routes you to everything else (brand, design system, content, architecture, CMS, database rules, SEO, performance, and `.memory/` for project history/status).

## Working on this repo

Read `CLAUDE.md` and only the docs relevant to your task before making changes. Documentation must stay synchronized with the actual implementation after every completed feature — see `.memory/12_ai_notes.md`.

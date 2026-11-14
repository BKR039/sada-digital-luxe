# SADA Clients (CRM Registry)

**Status as of 2026-09-16: CRM Foundation / Phase 1 Complete.**

Canonical CRM identity is established via `public.clients` with deterministic foreign keys:
- `contact_submissions.client_id -> public.clients.id` (ON DELETE SET NULL)
- `client_projects.client_id -> public.clients.id` (ON DELETE RESTRICT)

## Verified Operational CRM Clients (Live Database)

| Client | Industry | Status | Relationship Owner | Projects Count | Linked Inquiries | Notes |
|---|---|---|---|---|---|---|
| **Café 707** | Hospitality / Cafe | active | — | 1 (`caffe 707 instagram campaign`) | 0 | Initial operational client with production task "Edit first Café 707 Reel" |
| **TOTTA Restaurant** | Restaurant | active | — | 1 (`totta — Video Production`) | 1 (`c6afd19d...`) | Converted from structured inquiry brief |
| **Audit Luxury SARL** | Luxury / Fashion | active | — | 1 (`Audit Luxury Video Campaign`) | 2 (`15322582...`, `6f718c02...`) | Demonstrates repeat inquiry continuity under a single client identity |

## Canonical Schema (`public.clients`)
- `id` (UUID PK)
- `name` (TEXT NOT NULL)
- `contact_name` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `preferred_channel` (TEXT)
- `website` (TEXT)
- `industry` (TEXT)
- `notes` (TEXT)
- `status` (`'prospect' | 'active' | 'inactive' | 'archived'`)
- `relationship_owner_id` (UUID FK -> `public.profiles(id)`)
- `created_at`, `updated_at` (TIMESTAMPTZ)

## Non-real rows currently in the database (do not treat as clients)

Migration `supabase/migrations/20260512231409_...sql` (2026-05-12) seeded fabricated demo rows. Listed here only so nobody mistakes them for real clients later:

| Seeded name | What's fake |
|---|---|
| Nova Coffee Co. | Client, results, cover photo (Unsplash stock) |
| Aurora Group | Client, results, cover photo (Unsplash stock) |
| Maison Lina | Client, results, cover photo (Unsplash stock) |
| Olive & Stone | Client, results, cover photo (Unsplash stock) |
| Helio Skin | Client, results, cover photo (Unsplash stock) |
| Vertex Studio | Client, results, cover photo (Unsplash stock) |
| Yara El-Sayed / Omar Khaled / Mira Haddad | Team members — invented bios, stock headshots (also duplicated in `src/data/team.ts`) |
| Layla M. / Hassan A. / Sara K. | Testimonials — invented quotes |

## Rule

Never invent clients. When a real client is confirmed, add a row to the table above with real Industry/Services/Status/Case Study/Available & Missing Assets, and either replace or explicitly delete the corresponding fake seeded row so the two don't coexist — log the swap in `.memory/08_decisions.md`.

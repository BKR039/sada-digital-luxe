# SADA Content

## Company

SADA

## Positioning

Marketing × Development × Production

## Core description

SADA is a creative and digital company combining marketing, development and production to help businesses build stronger brands, digital experiences and content.

## Core Divisions

Confirmed against `src/data/services.ts` (`DIVISIONS`), which is the live source the `/services` page and homepage `Services` section render from.

### Marketing
Brand Strategy, Branding, Visual Identity, Marketing Strategy, Content Strategy, Social Media Management, Advertising, Growth Strategy.

### Development
Web Design, Web Development, UI/UX, Landing Pages, Web Applications, Digital Products, Automation, AI Integration.

### Production
Creative Direction, Video Production, Commercial Videos, Reels, Photography, Motion, Campaign Production.

`src/data/services.ts` also defines `SCENARIOS` (four "which situation are you in" prompts used for cross-sell) and `PROCESS` (Discover → Strategize → Create → Launch → Improve) — reuse these instead of redefining a new process elsewhere.

## Main CTA

Start a Project

## Secondary CTAs

View Our Work, Explore Services, Contact SADA, Get a Proposal (site currently implements "Start a Project" and "Explore Services" as the two CTA slots in `components/site/CTA.tsx` usage; confirm exact label before adding new CTA copy).

## About concept

Businesses should not need to coordinate separately between marketers, designers, developers and production teams to build a coherent presence. SADA connects these disciplines under one vision.

## Content Integrity Rule

Never invent: Clients, Metrics, Testimonials, Awards, Partners, Project results, Employee numbers, Revenue, Years of experience.

If information is unknown, omit it or request real data.

### ⚠️ CONFLICT — current database violates this rule

Migration `supabase/migrations/20260512231409_d4005355-5976-4103-83da-2d7fa09cd478.sql` seeds the live `projects`, `team_members`, `products`, and `testimonials` tables with **fabricated demo content**:

- Fake client case studies (e.g. "Nova Coffee Co.", "Aurora Group", "Maison Lina", "Olive & Stone", "Helio Skin", "Vertex Studio") with invented metrics ("+340% Instagram engagement", "128 qualified leads in 21 days", etc.) and Unsplash stock photography as cover images.
- Fake team members ("Yara El-Sayed", "Omar Khaled", "Mira Haddad") with invented bios ("Ex-McKinsey design strategist"), stock headshots, and placeholder social links, duplicated between `src/data/team.ts` (static, marked "Replace profileUrl... when available") and the `team_members` table (seeded, richer bios) — two separate sources describing what looks like the same fictional roster.
- Fake client testimonials ("Layla M., Founder, Northstar Café", etc.).
- Product pricing (`$1490`, `$890`, etc.) that has not been confirmed as real SADA pricing.

**This is documentation only — no data was deleted or modified.** Flag this to the user/business owner: either (a) this seed data must be replaced with real SADA clients, team, and testimonials before the site is treated as production-ready public content, or (b) if it's intentionally placeholder content for a pre-launch demo, it must not be presented as real anywhere public-facing. Do not use this seeded data as a copy/tone reference, and do not add more invented records on top of it.

## Current Website Information Architecture

Confirmed from `src/components/site/Header.tsx` / `Footer.tsx` (both build nav from the same list):

**CURRENT (public nav):** Home, Services, Case Studies, Products (route `/store`), Pricing, About, Contact.

Blog exists in code (`/blog`, `/blog/$slug` routes, full blog listing/detail implementation) but is **feature-flagged off** via the `site_settings` table (`key = 'blog'`, `enabled = false`, migration `20260726120000`). It's hidden from Header/Footer nav automatically when disabled, and can be re-enabled from the DB without a redeploy. Admin still has a `/admin/blog` CRUD.

**TARGET (intended launch architecture):**
Home, Services, Case Studies, Products, Pricing, About, Contact, Start a Project.

Resources / Blog / Insights / Guides are explicitly not part of the intended launch architecture — this matches CURRENT (blog present in code, disabled by default), so no action needed unless the business wants blog permanently removed rather than toggled.

**Auth/admin routes** (`/auth`, `/admin/*`) are utility routes, not part of the public IA — correctly excluded from Header/Footer nav (`SiteLayout.tsx` bypasses Header/Footer entirely on `/admin` and `/auth`).

## Site Content & Metrics CMS (`/admin/site-content`)

Admin-controlled dynamic CMS backed by Supabase tables (`site_kpis`, `trusted_partners`, `site_content_sections`):
- **Hero Proof Highlights**: 3 proof metrics displayed under the main headline (`50+ Happy Clients`, `120+ Projects Delivered`, `3x Average Client Growth`). Fully editable values, suffixes, English/Arabic copy, and Lucide icons.
- **Trusted Partners & Brands**: Section header title and subtitle ("TRUSTED BY FORWARD-THINKING COMPANIES"), partner brand names (`Noor Coffee`, `Maven Studio`, `Atlas Realty`, `Olive House`, `Lumen`, `Verde & Co.`, `Northbeam`, `Field Notes`), logo upload to Supabase storage, click/hover external links, and hover tooltips.
- **Company Performance Stats Bar**: 4 metrics displayed between sections (`120+ Projects shipped`, `38M Views generated`, `96% Client retention`, `24h Avg. response time`), with animated counter, customizable icons, and bilingual labels.
- **Interactive Live Preview**: Built-in 2x2 preview switch (English/Arabic and Dark/Light canvas) allowing real-time preview of changes before public visitors see them.

Footer also links to "Privacy Policy" and "Terms of Service" — both currently point to `/` (home) as placeholders, not real legal pages. Flag before launch.

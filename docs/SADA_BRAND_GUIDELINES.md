# SADA Brand Guidelines

## Brand Definition

SADA is a creative and digital company combining:
Marketing, Development, Production.

SADA is NOT only a social media agency.

Core idea: instead of businesses coordinating separately with marketers, designers, developers and production teams, SADA brings these capabilities together under one strategic and creative direction.

## Positioning

Marketing × Development × Production

## Mission

Help businesses build, develop and market stronger brands and digital experiences.

## Long-Term Direction

SADA can evolve from:
Creative Services Company → Creative & Technology Company → Scalable Creative Ecosystem.

Do not overstate this publicly as current capability.

## Personality

Premium, Strategic, Modern, Creative, Human, Confident, Precise, Technology-aware, Business-oriented.

## Avoid

Cheap agency aesthetic, generic SaaS aesthetic, cyberpunk, gaming, overdecorated layouts, AI-looking design, generic marketing clichés.

## Visual Fingerprint

**Gradient + Liquid Glass + Typography.**

Echo Stack has been deprecated and must never be reintroduced. No Echo Stack, echo lines, frequency graphics, or signal motifs were found anywhere in the current codebase (`src/styles.css`, `src/components/**`) — this is confirmed clean, keep it that way.

## Core Colors

Brand reference tokens (canonical):

| Token | Hex |
|---|---|
| SADA Ink | `#0F172A` |
| SADA Cyan | `#18C7F7` |
| SADA Blue | `#1B6DFF` |

Primary gradient foundation: `#18C7F7 → #1B6DFF`.

**CURRENT implementation** (`src/styles.css`) defines the working palette in `oklch()` color space rather than the hex tokens above:

| CSS var | Light mode | Dark mode | Role |
|---|---|---|---|
| `--background` | `oklch(0.99 0.005 250)` | `oklch(0.13 0.04 260)` (≈ Ink) | page background |
| `--primary` | `oklch(0.62 0.22 252)` | `oklch(0.66 0.22 250)` | electric blue |
| `--accent` / `--cyan` | `oklch(0.7 0.16 230)` | `oklch(0.78 0.18 220)` | cyan |
| `--foreground` | `oklch(0.18 0.04 260)` | `oklch(0.98 0.005 260)` | text |

**CURRENT vs TARGET:** the oklch values sit in the same blue/cyan hue family as the hex tokens but have not been formally verified as exact conversions of `#18C7F7`/`#1B6DFF`/`#0F172A`. If pixel-exact brand hex matching matters for a task, convert and diff before assuming they match — do not assume equivalence.

The gradient is implemented atmospherically, not as flat linear blocks:
- `--gradient-primary`: 135° blue → cyan, used sparingly on buttons/badges/CTAs.
- `--gradient-hero`: large soft radial glows pinned to the page background (`body::before`), used for hero/page atmosphere.
- `--gradient-text`: used via `.text-gradient` utility for headline emphasis only.

## Typography

**CURRENT implementation** (`src/styles.css` + `src/routes/__root.tsx`):

| Role | CSS var | Font stack | Loaded? |
|---|---|---|---|
| Display / headings / buttons | `--font-display` | Sora, Space Grotesk, system-ui | Only **Sora** (weights 500/700) is actually loaded via Google Fonts `<link>` in `__root.tsx`. Space Grotesk is a CSS fallback only — not fetched. |
| Body | `--font-sans` | Manrope, Inter, system-ui | Only **Manrope** (weights 400/500/600) is loaded. Inter is a CSS fallback only. |
| Accent (uppercase labels, `.font-accent`) | `--font-accent` | Orbitron, Sora, system-ui | Not loaded via `<link>` at all — currently falls back to Sora/system-ui in practice. |

**CURRENT vs TARGET / conflict:** the project's own instructions call for "uploaded/custom SADA fonts already implemented in the project." No custom/self-hosted font files were found anywhere in the repo (`public/` contains only `favicon.ico`). Fonts are Google Fonts loaded by CDN link, and one of the three declared families (Orbitron) isn't fetched at all. Treat Sora + Manrope as the real current typography system; if custom SADA font files exist outside this repo, they need to be added and wired up — don't assume they're already there.

- Arabic typography: no Arabic font stack or RTL handling found in `styles.css` or `components.json` (`"rtl": false`). Document as not yet implemented if an Arabic UI is requested.
- Display/body usage in code: `h1–h4` use `--font-display` with tight letter-spacing; body copy uses `--font-sans`; `.font-accent` applies uppercase + wide tracking for eyebrow labels (e.g. "SELECTED WORK").

## Voice

Clear, Human, Confident, Simple.

Arabic marketing communication may use accessible Tunisian Arabic (Darija). Product/UI Arabic should prioritize clarity. Avoid robotic or excessively formal writing.

No Arabic or Darija copy currently exists in the inspected routes/components — current site copy is English only.

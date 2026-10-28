# SADA Performance

Current, real performance-relevant patterns in `sada-digital-luxe` — extend these rather than introducing new ad hoc approaches.

## CURRENT

- **Code-splitting:** homepage below-the-fold sections (`Stats`, `TrustedBy`, `Services`, `FeaturedProjects`, `About`, `Testimonials`, `CTA`) are `React.lazy` + `Suspense`; only `Hero` renders eagerly (`src/routes/index.tsx`). The `AIAssistant` chat widget is also lazy-loaded globally (`SiteLayout.tsx`).
- **Render deferral:** `main > section { content-visibility: auto; contain-intrinsic-size: 1px 600px; }` in `src/styles.css` keeps offscreen sections cheap.
- **Reduced motion:** global `@media (prefers-reduced-motion: reduce)` collapses all animation/transition durations — always preserve this when adding new animated components.
- **Hero image:** loaded `loading="eager"` on the case-study cover (`case-studies.$slug.tsx`); other `SmartMedia` usages are not marked eager, implying lazy-by-default elsewhere.
- **Hero assets:** the homepage hero ships no images — its four cards are CSS gradients, so the hero costs no image requests. The four hero photographs in `src/assets/` (WebP, plus PNG masters) are currently unreferenced and therefore not bundled; if they are reintroduced, use the 1400px WebP files, never the ~1.6 MB PNGs.
- **Edge deployment:** Cloudflare Workers via `@cloudflare/vite-plugin` + `wrangler.jsonc` — SSR runs at the edge, not a single origin server.
- **Scroll-triggered animation cost control:** `framer-motion`'s `whileInView` usage consistently sets `viewport={{ once: true }}`, so reveal animations don't re-fire on scroll-back.

## TARGET / TODO

- Verify `SmartMedia.tsx` implements responsive `srcset`/`sizes` — not confirmed in this pass.
- No measured Lighthouse/Core Web Vitals numbers on file — `.memory/13_project_health.md`'s 78% performance estimate is inspection-based, not measured. Run a real audit and record results here + update the health file.
- No image CDN/transform pipeline confirmed for Supabase Storage-hosted media (beyond whatever Supabase does natively) — check before assuming automatic resizing.

## Rule

When adding a new homepage or long-page section, follow the existing lazy + `content-visibility` pattern rather than rendering everything eagerly. When adding new scroll animations, default to `viewport={{ once: true }}` and respect `prefers-reduced-motion` (already global — don't override it locally without a reason).

# SADA Future (Intentionally Postponed)

Ideas that are out of scope for now — not committed, not scheduled, not in progress. Never document anything here as completed; move an item to `.memory/10_todo.md` once it's actually being scheduled, and to `.memory/08_decisions.md` once shipped.

## Identified from current gaps (real, evidenced by the codebase)

- **Dynamic ordered project sections** — replace the fixed case-study section sequence with admin-configurable, reorderable, independently-hideable sections. Large enough to be a standalone future project, not a quick TODO. See `docs/SADA_PROJECT_CMS.md`.
- **Multi-language CMS / Arabic content** — no Arabic font stack, no RTL (`components.json`: `"rtl": false`), no Arabic copy anywhere in the inspected routes. Real future scope if SADA wants Arabic/Darija content, not just an English site.
- **Draft / Preview / Archive workflow for projects** — beyond the current single `published` boolean.

## Illustrative categories (not yet proposed or confirmed for SADA)

The documentation workflow spec that introduced this file gave example future-idea categories: Client Portal, Analytics Dashboard, Advanced AI Assistant, CRM Integration. None of these have been requested or scoped for SADA as of 2026-07-28 — they are not recorded here as real plans. If one is genuinely proposed later, add it with the same rigor as the items above (what exists today that motivates it, what it would take).

Note: an "Advanced AI Assistant" already has a v1 in production — see `supabase/functions/chat/` and `src/components/site/AIAssistant.tsx` (Gemini via the Lovable AI Gateway, service-focused Q&A + lead qualification). A future iteration of that is a reasonable idea, not a from-scratch feature.


-- Case Studies / Real Proof architecture: extend projects with fields the
-- detail page already expected (challenge, strategy, process, metrics,
-- before/after) but that were never added to the schema, plus new fields
-- for objective, industry, deliverables and an optional real testimonial.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS challenge TEXT,
  ADD COLUMN IF NOT EXISTS strategy TEXT,
  ADD COLUMN IF NOT EXISTS process TEXT,
  ADD COLUMN IF NOT EXISTS deliverables TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS before_url TEXT,
  ADD COLUMN IF NOT EXISTS after_url TEXT,
  ADD COLUMN IF NOT EXISTS testimonial JSONB;

COMMENT ON COLUMN public.projects.metrics IS 'Array of { value, label, source?, period? } — quantitative case-study results. source/period document provenance but need not be shown prominently in the UI.';
COMMENT ON COLUMN public.projects.testimonial IS 'Nullable { quote, name, role } — only rendered when a real client quote exists for this project.';

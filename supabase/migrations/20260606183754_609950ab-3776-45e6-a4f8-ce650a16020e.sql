
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS challenge text,
  ADD COLUMN IF NOT EXISTS strategy text,
  ADD COLUMN IF NOT EXISTS process text,
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS before_url text,
  ADD COLUMN IF NOT EXISTS after_url text,
  ADD COLUMN IF NOT EXISTS results_summary text;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS reading_minutes integer,
  ADD COLUMN IF NOT EXISTS seo_description text;

CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON public.blog_posts (published, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON public.blog_posts (category);
CREATE INDEX IF NOT EXISTS projects_featured_idx ON public.projects (featured, sort_order);

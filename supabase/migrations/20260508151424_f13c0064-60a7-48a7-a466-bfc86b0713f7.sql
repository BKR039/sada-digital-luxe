
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS socials jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS external_url text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS thumbnail_url text;

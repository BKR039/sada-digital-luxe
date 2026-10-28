import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { enforceDatabaseIsolation } from "./test-db-guard";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

const PSQL_BIN = path.join(
  process.env.LOCALAPPDATA || "",
  "Programs",
  "PostgreSQL16",
  "pgsql",
  "bin",
  "psql.exe"
);

function assertSafeTarget(): void {
  enforceDatabaseIsolation(LOCAL_DB_URL);
  if (!fs.existsSync(PSQL_BIN)) {
    throw new Error(`psql binary not found at ${PSQL_BIN}`);
  }
}

function getSanitizedEnv(): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = { ...process.env };
  safeEnv.PGHOST = TARGET_HOST;
  safeEnv.PGPORT = TARGET_PORT;
  safeEnv.PGDATABASE = TARGET_DB;
  safeEnv.PGUSER = "postgres";
  return safeEnv;
}

function runSql(sql: string): string {
  assertSafeTarget();
  return execFileSync(
    PSQL_BIN,
    ["-X", "-A", "-t", "-d", TARGET_DB, "-c", sql],
    {
      env: getSanitizedEnv(),
      encoding: "utf-8",
    }
  ).trim();
}

async function setup() {
  console.log("Setting up Blog CMS schema on sada_local_test...");

  const migrationSql = `
    -- 0. Function set_updated_at
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- 1. Create public.blog_posts table if not exists
    CREATE TABLE IF NOT EXISTS public.blog_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      title_ar TEXT,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      excerpt_ar TEXT,
      content TEXT,
      content_ar TEXT,
      cover_url TEXT,
      cover_alt TEXT,
      category TEXT,
      category_ar TEXT,
      author TEXT,
      tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
      reading_minutes INTEGER,
      featured BOOLEAN NOT NULL DEFAULT false,
      seo_title TEXT,
      seo_description TEXT,
      og_image_url TEXT,
      published BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Ensure missing columns if table already existed
    ALTER TABLE public.blog_posts
      ADD COLUMN IF NOT EXISTS title_ar TEXT,
      ADD COLUMN IF NOT EXISTS excerpt_ar TEXT,
      ADD COLUMN IF NOT EXISTS content_ar TEXT,
      ADD COLUMN IF NOT EXISTS category_ar TEXT,
      ADD COLUMN IF NOT EXISTS cover_alt TEXT,
      ADD COLUMN IF NOT EXISTS reading_minutes INTEGER,
      ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS seo_title TEXT,
      ADD COLUMN IF NOT EXISTS seo_description TEXT,
      ADD COLUMN IF NOT EXISTS og_image_url TEXT;

    -- Ensure unique constraint on slug
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'blog_posts_slug_key'
      ) THEN
        ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);
      END IF;
    END $$;

    -- Indexes
    CREATE INDEX IF NOT EXISTS blog_posts_featured_idx ON public.blog_posts (featured) WHERE featured = true;
    CREATE INDEX IF NOT EXISTS blog_posts_schedule_idx ON public.blog_posts (published, published_at DESC);
    CREATE INDEX IF NOT EXISTS blog_posts_category_idx ON public.blog_posts (category);

    -- Updated_at trigger
    DROP TRIGGER IF EXISTS blog_updated ON public.blog_posts;
    CREATE TRIGGER blog_updated
      BEFORE UPDATE ON public.blog_posts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    -- 2. Create public.site_settings table if not exists
    CREATE TABLE IF NOT EXISTS public.site_settings (
      key TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    DROP TRIGGER IF EXISTS site_settings_updated ON public.site_settings;
    CREATE TRIGGER site_settings_updated
      BEFORE UPDATE ON public.site_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

    -- Ensure seed row for 'blog'
    INSERT INTO public.site_settings (key, enabled)
    VALUES ('blog', true)
    ON CONFLICT (key) DO NOTHING;

    -- 3. RLS on blog_posts
    ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public reads published posts" ON public.blog_posts;
    CREATE POLICY "Public reads published posts"
      ON public.blog_posts FOR SELECT
      USING (
        published = true
        AND (published_at IS NULL OR published_at <= now())
      );

    DROP POLICY IF EXISTS "Admins read all posts" ON public.blog_posts;
    CREATE POLICY "Admins read all posts"
      ON public.blog_posts FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins insert posts" ON public.blog_posts;
    CREATE POLICY "Admins insert posts"
      ON public.blog_posts FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins update posts" ON public.blog_posts;
    CREATE POLICY "Admins update posts"
      ON public.blog_posts FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Super admins delete posts" ON public.blog_posts;
    CREATE POLICY "Super admins delete posts"
      ON public.blog_posts FOR DELETE
      TO authenticated
      USING (public.is_super_admin(auth.uid()));

    -- 4. RLS on site_settings
    ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public reads site settings" ON public.site_settings;
    CREATE POLICY "Public reads site settings"
      ON public.site_settings FOR SELECT
      USING (true);

    DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
    CREATE POLICY "Admins manage site settings"
      ON public.site_settings FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  `;

  runSql(migrationSql);
  console.log("Blog CMS schema successfully configured on sada_local_test.");

  const cols = runSql(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'blog_posts'
    ORDER BY ordinal_position;
  `);
  console.log("Current blog_posts columns:\n" + cols);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});

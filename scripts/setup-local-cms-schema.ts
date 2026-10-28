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
  console.log("Setting up CMS schema (projects, testimonials, social_reels) on sada_local_test...");

  const migrationSql = `
    -- 1. Create public.projects table
    CREATE TABLE IF NOT EXISTS public.projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      client TEXT,
      description TEXT,
      category TEXT,
      cover_url TEXT,
      thumbnail_url TEXT,
      external_url TEXT,
      gallery JSONB DEFAULT '[]'::jsonb,
      services TEXT[] DEFAULT '{}',
      deliverables TEXT[] DEFAULT '{}',
      results TEXT,
      challenge TEXT,
      strategy TEXT,
      process TEXT,
      metrics JSONB DEFAULT '[]'::jsonb,
      before_url TEXT,
      after_url TEXT,
      results_summary TEXT,
      project_date DATE,
      tags TEXT[] DEFAULT '{}',
      featured BOOLEAN NOT NULL DEFAULT false,
      published BOOLEAN NOT NULL DEFAULT false,
      sort_order INT NOT NULL DEFAULT 0,
      industry TEXT,
      objective TEXT,
      testimonial JSONB,
      team_member_ids TEXT[] DEFAULT '{}'::text[],
      seo_title TEXT,
      seo_description TEXT,
      title_ar TEXT,
      description_ar TEXT,
      challenge_ar TEXT,
      solution_ar TEXT,
      outcome_ar TEXT,
      client_ar TEXT,
      industry_ar TEXT,
      category_ar TEXT,
      objective_ar TEXT,
      strategy_ar TEXT,
      process_ar TEXT,
      results_ar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_projects_published_sort ON public.projects (published, sort_order ASC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_featured ON public.projects (featured, sort_order ASC) WHERE featured = true;
    CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects (slug);

    -- 2. Create public.testimonials table
    CREATE TABLE IF NOT EXISTS public.testimonials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL,
      company TEXT,
      role TEXT,
      review TEXT NOT NULL,
      short_quote TEXT,
      service TEXT,
      rating INTEGER DEFAULT 5,
      photo_url TEXT,
      published BOOLEAN NOT NULL DEFAULT true,
      featured BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      language TEXT NOT NULL DEFAULT 'en',
      project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_testimonials_project_id ON public.testimonials (project_id);
    CREATE INDEX IF NOT EXISTS idx_testimonials_published ON public.testimonials (published, sort_order ASC);

    -- 3. Create public.social_reels table
    CREATE TABLE IF NOT EXISTS public.social_reels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      instagram_url TEXT NOT NULL,
      instagram_shortcode TEXT NOT NULL,
      title TEXT NOT NULL,
      title_ar TEXT,
      caption TEXT,
      description_ar TEXT,
      thumbnail_url TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      display_order INTEGER NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT false,
      is_featured BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_social_reels_homepage
      ON public.social_reels (is_published, is_featured DESC, display_order ASC);
    CREATE INDEX IF NOT EXISTS idx_social_reels_slug
      ON public.social_reels (slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_social_reels_single_featured
      ON public.social_reels (is_featured)
      WHERE is_featured = true;

    CREATE OR REPLACE FUNCTION public.handle_single_featured_reel()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.is_featured = true THEN
        UPDATE public.social_reels
        SET is_featured = false
        WHERE id <> NEW.id AND is_featured = true;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_single_featured_reel ON public.social_reels;
    CREATE TRIGGER trigger_single_featured_reel
    BEFORE INSERT OR UPDATE OF is_featured ON public.social_reels
    FOR EACH ROW
    WHEN (NEW.is_featured = true)
    EXECUTE FUNCTION public.handle_single_featured_reel();

    -- 4. Enable RLS and setup policies
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.social_reels ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

    -- Projects RLS
    DROP POLICY IF EXISTS "Public reads published projects" ON public.projects;
    CREATE POLICY "Public reads published projects"
      ON public.projects FOR SELECT
      TO anon, authenticated
      USING (published = true);

    DROP POLICY IF EXISTS "Admins read all projects" ON public.projects;
    CREATE POLICY "Admins read all projects"
      ON public.projects FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins create projects" ON public.projects;
    CREATE POLICY "Admins create projects"
      ON public.projects FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
    CREATE POLICY "Admins update projects"
      ON public.projects FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Super Admins delete projects" ON public.projects;
    CREATE POLICY "Super Admins delete projects"
      ON public.projects FOR DELETE
      TO authenticated
      USING (public.is_super_admin(auth.uid()));

    -- Social Reels RLS
    DROP POLICY IF EXISTS "Public reads published reels" ON public.social_reels;
    CREATE POLICY "Public reads published reels"
      ON public.social_reels FOR SELECT
      TO anon, authenticated
      USING (is_published = true);

    DROP POLICY IF EXISTS "Admins read all reels" ON public.social_reels;
    CREATE POLICY "Admins read all reels"
      ON public.social_reels FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins create reels" ON public.social_reels;
    CREATE POLICY "Admins create reels"
      ON public.social_reels FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins update reels" ON public.social_reels;
    CREATE POLICY "Admins update reels"
      ON public.social_reels FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Super Admins delete reels" ON public.social_reels;
    CREATE POLICY "Super Admins delete reels"
      ON public.social_reels FOR DELETE
      TO authenticated
      USING (public.is_super_admin(auth.uid()));

    -- Testimonials RLS
    DROP POLICY IF EXISTS "Public reads published testimonials" ON public.testimonials;
    CREATE POLICY "Public reads published testimonials"
      ON public.testimonials FOR SELECT
      TO anon, authenticated
      USING (published = true);

    DROP POLICY IF EXISTS "Admins read all testimonials" ON public.testimonials;
    CREATE POLICY "Admins read all testimonials"
      ON public.testimonials FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins insert testimonials" ON public.testimonials;
    CREATE POLICY "Admins insert testimonials"
      ON public.testimonials FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins update testimonials" ON public.testimonials;
    CREATE POLICY "Admins update testimonials"
      ON public.testimonials FOR UPDATE
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Super admins delete testimonials" ON public.testimonials;
    CREATE POLICY "Super admins delete testimonials"
      ON public.testimonials FOR DELETE
      TO authenticated
      USING (public.is_super_admin(auth.uid()));
  `;

  runSql(migrationSql);
  console.log("✓ Local CMS schema successfully applied to sada_local_test!");
}

setup().catch(console.error);

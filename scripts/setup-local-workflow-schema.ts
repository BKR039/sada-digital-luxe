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
  console.log("Setting up Workflow Engine schema and tables on sada_local_test...");

  // 1. Create tables and columns
  const migrationSql = `
    -- 1. Create public.workflow_templates table
    CREATE TABLE IF NOT EXISTS public.workflow_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_type TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        name_ar TEXT,
        description TEXT NOT NULL,
        description_ar TEXT,
        icon TEXT NOT NULL DEFAULT 'Workflow',
        color TEXT NOT NULL DEFAULT 'purple',
        is_active BOOLEAN NOT NULL DEFAULT true,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 2. Create public.workflow_stages table
    CREATE TABLE IF NOT EXISTS public.workflow_stages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        title_ar TEXT,
        stage_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 1,
        duration_days INTEGER NOT NULL DEFAULT 1,
        requires_previous_stage BOOLEAN NOT NULL DEFAULT true,
        assignment_rule TEXT NOT NULL DEFAULT 'specialist_role',
        default_assignee_role TEXT,
        default_assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        description TEXT,
        description_ar TEXT,
        checklist_items JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_workflow_stage_template_order UNIQUE (template_id, sort_order)
    );

    -- 2b. Create public.service_commitments if not exists
    CREATE TABLE IF NOT EXISTS public.service_commitments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID,
        package_id UUID,
        service_name TEXT NOT NULL DEFAULT 'General Service',
        deliverable_type TEXT NOT NULL DEFAULT 'custom',
        quantity INTEGER NOT NULL DEFAULT 1,
        frequency TEXT NOT NULL DEFAULT 'monthly',
        schedule_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        end_date DATE,
        preferred_time TEXT,
        duration_hours NUMERIC(4,2),
        assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
        assignment_rule TEXT NOT NULL DEFAULT 'specialist_role',
        default_role TEXT,
        workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
        task_type TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        paused_at TIMESTAMPTZ,
        reactivated_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 3. Enhance public.project_tasks with workflow tracking attributes and task lifecycle columns
    ALTER TABLE public.project_tasks
        ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS stage_key TEXT,
        ADD COLUMN IF NOT EXISTS stage_order INTEGER,
        ADD COLUMN IF NOT EXISTS is_stage_locked BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS depends_on_stage_order INTEGER,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS notes TEXT,
        ADD COLUMN IF NOT EXISTS category TEXT,
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS service TEXT,
        ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
        ADD COLUMN IF NOT EXISTS sequence_index INTEGER,
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS completed_by UUID,
        ADD COLUMN IF NOT EXISTS result_links JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS result_notes TEXT,
        ADD COLUMN IF NOT EXISTS drive_url TEXT,
        ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS scheduled_date TEXT,
        ADD COLUMN IF NOT EXISTS commitment_id UUID,
        ADD COLUMN IF NOT EXISTS occurrence_date TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

    -- 4. Enable RLS
    ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

    -- 5. RLS Policies for workflow_templates
    DROP POLICY IF EXISTS "Authenticated users can read workflow templates" ON public.workflow_templates;
    CREATE POLICY "Authenticated users can read workflow templates"
        ON public.workflow_templates FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS "Admins can insert workflow templates" ON public.workflow_templates;
    CREATE POLICY "Admins can insert workflow templates"
        ON public.workflow_templates FOR INSERT
        TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('super_admin', 'admin')
            )
        );

    DROP POLICY IF EXISTS "Admins can update workflow templates" ON public.workflow_templates;
    CREATE POLICY "Admins can update workflow templates"
        ON public.workflow_templates FOR UPDATE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('super_admin', 'admin')
            )
        );

    DROP POLICY IF EXISTS "Super Admins can delete workflow templates" ON public.workflow_templates;
    CREATE POLICY "Super Admins can delete workflow templates"
        ON public.workflow_templates FOR DELETE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role = 'super_admin'
            )
        );

    -- 6. RLS Policies for workflow_stages
    DROP POLICY IF EXISTS "Authenticated users can read workflow stages" ON public.workflow_stages;
    CREATE POLICY "Authenticated users can read workflow stages"
        ON public.workflow_stages FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS "Admins can insert workflow stages" ON public.workflow_stages;
    CREATE POLICY "Admins can insert workflow stages"
        ON public.workflow_stages FOR INSERT
        TO authenticated
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('super_admin', 'admin')
            )
        );

    DROP POLICY IF EXISTS "Admins can update workflow stages" ON public.workflow_stages;
    CREATE POLICY "Admins can update workflow stages"
        ON public.workflow_stages FOR UPDATE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('super_admin', 'admin')
            )
        );

    DROP POLICY IF EXISTS "Admins can delete workflow stages" ON public.workflow_stages;
    CREATE POLICY "Admins can delete workflow stages"
        ON public.workflow_stages FOR DELETE
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.user_roles ur
                WHERE ur.user_id = auth.uid()
                AND ur.role IN ('super_admin', 'admin')
            )
        );

    -- 7. Seed Initial Canonical Workflow Templates
    INSERT INTO public.workflow_templates (id, task_type, name, name_ar, description, description_ar, icon, color, sort_order)
    VALUES 
        (
            '10000000-0000-0000-0000-000000000001',
            'reel',
            'Reel Production Workflow',
            'مسار إنتاج فيديو ريل',
            'Standard 4-stage pipeline for commercial & social media video reels.',
            'مسار إنتاج متكامل من 4 مراحل لفيديوهات الريلز الإعلانية والتسويقية.',
            'Film',
            'purple',
            1
        ),
        (
            '10000000-0000-0000-0000-000000000002',
            'design',
            'Creative Design Workflow',
            'مسار التصميم الإبداعي',
            'Structured 3-stage pipeline for branding, graphic design, and social media posts.',
            'مسار من 3 مراحل للهويات البصرية وتصميمات السوشيال ميديا.',
            'Palette',
            'rose',
            2
        ),
        (
            '10000000-0000-0000-0000-000000000003',
            'web_development',
            'Web & Platform Development',
            'مسار تطوير المواقع والمنصات',
            'Full software delivery lifecycle from architecture to production launch.',
            'دورة حياة هندسة البرمجيات وتطوير المنصات حتى الإطلاق النهائي.',
            'Globe',
            'blue',
            3
        ),
        (
            '10000000-0000-0000-0000-000000000004',
            'sponsoring',
            'Paid Ads Campaign Workflow',
            'مسار الحملات الإعلانية الممولة',
            'Performance marketing workflow covering strategy, ad creative, setup, and optimization.',
            'مسار الحملات الممولة يشمل الاستراتيجية، التصميمات، الإطلاق، والتحسين.',
            'Zap',
            'amber',
            4
        )
    ON CONFLICT (task_type) DO UPDATE SET
        name = EXCLUDED.name,
        name_ar = EXCLUDED.name_ar,
        description = EXCLUDED.description,
        description_ar = EXCLUDED.description_ar,
        icon = EXCLUDED.icon,
        color = EXCLUDED.color,
        sort_order = EXCLUDED.sort_order;

    -- 8. Seed Stages for Reel Workflow (4 stages)
    INSERT INTO public.workflow_stages (template_id, title, title_ar, stage_type, sort_order, duration_days, requires_previous_stage, assignment_rule, default_assignee_role, description)
    VALUES
        ('10000000-0000-0000-0000-000000000001', 'Scenario / Script', 'السيناريو والنص الإبداعي', 'script', 1, 2, false, 'specialist_role', 'copywriter', 'Write hook, core dialogue, shot descriptions, and call-to-action.'),
        ('10000000-0000-0000-0000-000000000001', 'Shooting', 'التصوير الميداني', 'shooting', 2, 1, true, 'specialist_role', 'videographer', 'On-location filming, lighting setup, audio capture, and raw footage review.'),
        ('10000000-0000-0000-0000-000000000001', 'Editing', 'المونتاج والمؤثرات', 'editing', 3, 3, true, 'specialist_role', 'editor', 'Video cuts, dynamic sound effects, color grading, and subtitle synchronization.'),
        ('10000000-0000-0000-0000-000000000001', 'Publishing', 'النشر والجدولة', 'publishing', 4, 1, true, 'specialist_role', 'publisher', 'Export in target aspect ratio, schedule on client social channels with optimized copy.')
    ON CONFLICT (template_id, sort_order) DO UPDATE SET
        title = EXCLUDED.title,
        title_ar = EXCLUDED.title_ar,
        stage_type = EXCLUDED.stage_type,
        duration_days = EXCLUDED.duration_days,
        requires_previous_stage = EXCLUDED.requires_previous_stage,
        default_assignee_role = EXCLUDED.default_assignee_role,
        description = EXCLUDED.description;

    -- 9. Seed Stages for Design Workflow (3 stages)
    INSERT INTO public.workflow_stages (template_id, title, title_ar, stage_type, sort_order, duration_days, requires_previous_stage, assignment_rule, default_assignee_role, description)
    VALUES
        ('10000000-0000-0000-0000-000000000002', 'Creative Brief', 'الموجز الإبداعي', 'brief', 1, 1, false, 'project_lead', 'account_manager', 'Review client objectives, branding guidelines, target audience, and key messaging.'),
        ('10000000-0000-0000-0000-000000000002', 'Design', 'التصميم والتنفيذ', 'design', 2, 3, true, 'specialist_role', 'designer', 'Produce visual mockups, typography layout, export high-res deliverables.'),
        ('10000000-0000-0000-0000-000000000002', 'Publishing', 'الاعتماد والنشر', 'publishing', 3, 1, true, 'specialist_role', 'publisher', 'Deliver approved final assets to client or schedule directly to content grid.')
    ON CONFLICT (template_id, sort_order) DO UPDATE SET
        title = EXCLUDED.title,
        title_ar = EXCLUDED.title_ar,
        stage_type = EXCLUDED.stage_type,
        duration_days = EXCLUDED.duration_days,
        requires_previous_stage = EXCLUDED.requires_previous_stage,
        default_assignee_role = EXCLUDED.default_assignee_role,
        description = EXCLUDED.description;

    -- 10. Seed Stages for Web Development (4 stages)
    INSERT INTO public.workflow_stages (template_id, title, title_ar, stage_type, sort_order, duration_days, requires_previous_stage, assignment_rule, default_assignee_role, description)
    VALUES
        ('10000000-0000-0000-0000-000000000003', 'Architecture & Specs', 'الهيكلة والمواصفات', 'brief', 1, 2, false, 'project_lead', 'developer', 'Map user stories, define database schema, and integration specs.'),
        ('10000000-0000-0000-0000-000000000003', 'UI/UX & Wireframing', 'واجهات المستخدم', 'design', 2, 4, true, 'specialist_role', 'designer', 'Interactive Figma components and responsive layouts.'),
        ('10000000-0000-0000-0000-000000000003', 'Frontend & Backend Development', 'البرمجة والتطوير', 'development', 3, 7, true, 'specialist_role', 'developer', 'Implement frontend, APIs, database RLS, and business logic.'),
        ('10000000-0000-0000-0000-000000000003', 'QA & Deployment', 'الفحص والإطلاق', 'qa', 4, 2, true, 'project_lead', 'developer', 'Cross-browser audit, SEO validation, and production deployment.')
    ON CONFLICT (template_id, sort_order) DO UPDATE SET
        title = EXCLUDED.title,
        title_ar = EXCLUDED.title_ar,
        stage_type = EXCLUDED.stage_type,
        duration_days = EXCLUDED.duration_days,
        requires_previous_stage = EXCLUDED.requires_previous_stage,
        default_assignee_role = EXCLUDED.default_assignee_role,
        description = EXCLUDED.description;

    -- 11. Seed Stages for Sponsoring / Paid Ads (4 stages)
    INSERT INTO public.workflow_stages (template_id, title, title_ar, stage_type, sort_order, duration_days, requires_previous_stage, assignment_rule, default_assignee_role, description)
    VALUES
        ('10000000-0000-0000-0000-000000000004', 'Audience & Strategy', 'الجمهور والاستراتيجية', 'brief', 1, 1, false, 'project_lead', 'media_buyer', 'Define target audience personas, ad angles, and budget allocation.'),
        ('10000000-0000-0000-0000-000000000004', 'Ad Creatives & Copy', 'التصميمات والنصوص الإعلانية', 'design', 2, 2, true, 'specialist_role', 'designer', 'High-converting ad visuals, hooks, and copywriting.'),
        ('10000000-0000-0000-0000-000000000004', 'Campaign Setup & Launch', 'إعداد الحملة وإطلاقها', 'media_buying', 3, 1, true, 'specialist_role', 'media_buyer', 'Ad Manager configuration, pixel events, and campaign live launch.'),
        ('10000000-0000-0000-0000-000000000004', 'Optimization & Reporting', 'التحسين والتقارير', 'optimization', 4, 7, true, 'specialist_role', 'media_buyer', 'Monitor CTR, CPA, ROAS, scale winning creatives, and report.')
    ON CONFLICT (template_id, sort_order) DO UPDATE SET
        title = EXCLUDED.title,
        title_ar = EXCLUDED.title_ar,
        stage_type = EXCLUDED.stage_type,
        duration_days = EXCLUDED.duration_days,
        requires_previous_stage = EXCLUDED.requires_previous_stage,
        default_assignee_role = EXCLUDED.default_assignee_role,
        description = EXCLUDED.description;
  `;

  runSql(migrationSql);
  console.log("Schema and seeds successfully applied!");

  const tplCount = runSql("SELECT count(*) FROM public.workflow_templates;");
  const stgCount = runSql("SELECT count(*) FROM public.workflow_stages;");
  console.log(`Verified counts -> workflow_templates: ${tplCount}, workflow_stages: ${stgCount}`);
}

setup().catch(console.error);

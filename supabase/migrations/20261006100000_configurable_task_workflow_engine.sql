-- ============================================================
-- SADA OS — CONFIGURABLE TASK WORKFLOW ENGINE MIGRATION
-- Phase 1: Task Type -> Workflow Template -> Stages -> Task Instances
-- ============================================================

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

-- 3. Enhance public.project_tasks with optional workflow tracking attributes
ALTER TABLE public.project_tasks
    ADD COLUMN IF NOT EXISTS workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS stage_key TEXT,
    ADD COLUMN IF NOT EXISTS stage_order INTEGER,
    ADD COLUMN IF NOT EXISTS is_stage_locked BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS depends_on_stage_order INTEGER;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_stages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Viewable by all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read workflow templates" ON public.workflow_templates;
CREATE POLICY "Authenticated users can read workflow templates"
    ON public.workflow_templates FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can read workflow stages" ON public.workflow_stages;
CREATE POLICY "Authenticated users can read workflow stages"
    ON public.workflow_stages FOR SELECT
    TO authenticated
    USING (true);

-- 6. RLS Policies: Managed by Super Admins and Admins
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
ON CONFLICT (task_type) DO NOTHING;

-- 8. Seed Initial Stages for Reel Workflow
INSERT INTO public.workflow_stages (template_id, title, title_ar, stage_type, sort_order, duration_days, requires_previous_stage, assignment_rule, default_assignee_role, description)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Scenario / Script', 'السيناريو والنص الإبداعي', 'script', 1, 2, false, 'specialist_role', 'copywriter', 'Write hook, core dialogue, shot descriptions, and call-to-action.'),
    ('10000000-0000-0000-0000-000000000001', 'Shooting', 'التصوير الميداني', 'shooting', 2, 1, true, 'specialist_role', 'videographer', 'On-location filming, lighting setup, audio capture, and raw footage review.'),
    ('10000000-0000-0000-0000-000000000001', 'Editing', 'المونتاج والمؤثرات', 'editing', 3, 3, true, 'specialist_role', 'editor', 'Video cuts, dynamic sound effects, color grading, and subtitle synchronization.'),
    ('10000000-0000-0000-0000-000000000001', 'Publishing', 'النشر والجدولة', 'publishing', 4, 1, true, 'specialist_role', 'publisher', 'Export in target aspect ratio, schedule on client social channels with optimized copy.')
ON CONFLICT (template_id, sort_order) DO NOTHING;

-- 9. Seed Initial Stages for Design Workflow
INSERT INTO public.workflow_stages (template_id, title, title_ar, stage_type, sort_order, duration_days, requires_previous_stage, assignment_rule, default_assignee_role, description)
VALUES
    ('10000000-0000-0000-0000-000000000002', 'Creative Brief', 'الموجز الإبداعي', 'brief', 1, 1, false, 'project_lead', 'account_manager', 'Review client objectives, branding guidelines, target audience, and key messaging.'),
    ('10000000-0000-0000-0000-000000000002', 'Design', 'التصميم والتنفيذ', 'design', 2, 3, true, 'specialist_role', 'designer', 'Produce visual mockups, typography layout, export high-res deliverables.'),
    ('10000000-0000-0000-0000-000000000002', 'Publishing', 'الاعتماد والنشر', 'publishing', 3, 1, true, 'specialist_role', 'publisher', 'Deliver approved final assets to client or schedule directly to content grid.')
ON CONFLICT (template_id, sort_order) DO NOTHING;

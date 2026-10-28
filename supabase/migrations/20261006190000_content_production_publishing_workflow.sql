-- ============================================================
-- SADA OS — CONTENT PRODUCTION -> PUBLISHING WORKFLOW MIGRATION
-- Phase 7: Editing Handoff, Drive Link, Publisher Capability & Audit
-- ============================================================

-- 1. ENHANCE PROJECT_TASKS WITH PUBLISHING & ASSET HANDOFF COLUMNS
DO $$
BEGIN
    -- A. drive_url: Final cloud asset / Drive link provided by Editor
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'drive_url'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN drive_url TEXT;
    END IF;

    -- B. published_urls: Live URLs after publishing (Instagram, Facebook, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'published_urls'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN published_urls TEXT[] DEFAULT '{}'::text[];
    END IF;

    -- C. published_at: Timestamp when content was published to live channels
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'published_at'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN published_at TIMESTAMPTZ;
    END IF;

    -- D. published_by: User profile ID of the publisher
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'published_by'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- E. target_platforms: Platforms selected for publishing (instagram, facebook, tiktok, etc.)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'target_platforms'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN target_platforms TEXT[] DEFAULT '{}'::text[];
    END IF;
END $$;

-- 2. ENHANCE CLIENTS TABLE WITH SOCIAL_ACCOUNTS CONFIGURATION
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'social_accounts'
    ) THEN
        ALTER TABLE public.clients
        ADD COLUMN social_accounts JSONB DEFAULT '{"instagram":"","facebook":"","tiktok":"","linkedin":"","youtube":""}'::jsonb;
    END IF;
END $$;

-- 3. ENHANCE TEAM_MEMBERS WITH IS_PUBLISHER CAPABILITY FLAG
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'is_publisher'
    ) THEN
        ALTER TABLE public.team_members
        ADD COLUMN is_publisher BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. PERFORMANCE INDEXES FOR PUBLISHING QUERIES
CREATE INDEX IF NOT EXISTS idx_project_tasks_published_by ON public.project_tasks(published_by);
CREATE INDEX IF NOT EXISTS idx_project_tasks_published_at ON public.project_tasks(published_at);
CREATE INDEX IF NOT EXISTS idx_project_tasks_category_status ON public.project_tasks(category, status);

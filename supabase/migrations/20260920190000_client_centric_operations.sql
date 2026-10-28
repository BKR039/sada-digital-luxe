-- ============================================================
-- SADA OS — Client-Centric Operations Migration
-- Migration: 20260920190000_client_centric_operations.sql
-- Description: Schema extensions for Monthly vs One-Off clients,
-- subtasks, delivery periods, direct client_id on tasks, and seed data.
-- ============================================================

-- 1. Extend clients table with client_type, package config, and delivery cycle
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'one_off' CHECK (client_type IN ('monthly', 'one_off')),
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS package_config JSONB DEFAULT '{"reels_quota": 0, "posts_quota": 0, "stories_quota": 0, "other_services": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_start_date DATE,
  ADD COLUMN IF NOT EXISTS current_period_month TEXT DEFAULT to_char(now(), 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_clients_client_type ON public.clients(client_type);

-- 2. Extend project_tasks table with client_id, parent_task_id (for subtasks), and delivery_period
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS delivery_period TEXT;

CREATE INDEX IF NOT EXISTS idx_project_tasks_client_id ON public.project_tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id ON public.project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_delivery_period ON public.project_tasks(delivery_period);

-- 3. Backfill client_id on existing tasks from parent client_projects
UPDATE public.project_tasks pt
SET client_id = cp.client_id
FROM public.client_projects cp
WHERE pt.project_id = cp.id
  AND pt.client_id IS NULL
  AND cp.client_id IS NOT NULL;

-- 4. Seed and configure Flagship Clients & Operations
DO $$
DECLARE
  v_boubakar_profile_id UUID;
  v_sarah_profile_id UUID;
  v_jannat_client_id UUID;
  v_jannat_project_id UUID;
  v_cafe_client_id UUID;
  v_cafe_project_id UUID;
  v_reel3_id UUID;
  v_cafe_reel_id UUID;
BEGIN
  -- Resolve profile IDs for Boubakar (lead/admin) and Sarah (specialist/worker)
  SELECT profile_id INTO v_boubakar_profile_id FROM public.team_members WHERE lower(name) LIKE '%boubakar%' LIMIT 1;
  SELECT profile_id INTO v_sarah_profile_id FROM public.team_members WHERE lower(name) LIKE '%sarah%' LIMIT 1;

  -- -------------------------------------------------------------
  -- A. CONFIGURE FLAGSHIP MONTHLY CLIENT: Jannat Sahara
  -- -------------------------------------------------------------
  SELECT id INTO v_jannat_client_id FROM public.clients WHERE lower(name) = 'jannat sahara' LIMIT 1;
  IF v_jannat_client_id IS NULL THEN
    INSERT INTO public.clients (
      name, industry, contact_name, email, phone, status,
      client_type, package_name, package_config, current_period_month, billing_start_date, notes
    ) VALUES (
      'Jannat Sahara',
      'Hospitality / Luxury Desert Resort',
      'Mansour Al-Sahara',
      'contact@jannatsahara.tn',
      '+21698765432',
      'active',
      'monthly',
      'Growth — Custom',
      '{"reels_quota": 5, "posts_quota": 4, "stories_quota": 10, "other_services": ["Meta Ads", "Brand Strategy"]}'::jsonb,
      '2026-09',
      '2026-07-01',
      'Premium desert luxury camp & resort. Monthly content retainer.'
    ) RETURNING id INTO v_jannat_client_id;
  ELSE
    UPDATE public.clients SET
      client_type = 'monthly',
      package_name = 'Growth — Custom',
      package_config = '{"reels_quota": 5, "posts_quota": 4, "stories_quota": 10, "other_services": ["Meta Ads", "Brand Strategy"]}'::jsonb,
      current_period_month = '2026-09'
    WHERE id = v_jannat_client_id;
  END IF;

  -- Ensure operational project container for Jannat Sahara
  SELECT id INTO v_jannat_project_id FROM public.client_projects WHERE client_id = v_jannat_client_id LIMIT 1;
  IF v_jannat_project_id IS NULL THEN
    INSERT INTO public.client_projects (
      client_id, client_name, title, status, lead_id, start_date, description
    ) VALUES (
      v_jannat_client_id, 'Jannat Sahara', 'Jannat Sahara — Monthly Retainer Operations', 'active',
      v_boubakar_profile_id, '2026-07-01', 'Monthly continuous content package and digital branding.'
    ) RETURNING id INTO v_jannat_project_id;
  END IF;

  -- Seed September 2026 Deliverables for Jannat Sahara if not existing
  IF NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE client_id = v_jannat_client_id AND delivery_period = '2026-09') THEN
    -- Reels (3 of 5 completed, 1 in editing, 1 todo)
    INSERT INTO public.project_tasks (
      project_id, client_id, title, category, service, status, priority, deadline, completed_at,
      assigned_by_id, assignee_id, delivery_period, result_title, result_links, sort_order
    ) VALUES
      (v_jannat_project_id, v_jannat_client_id, 'Reel 01 — Desert Sunrise Experience', 'Reel', 'Reel Production', 'done', 'high', (now() - interval '14 days')::date, now() - interval '13 days', v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 'Published Reel', ARRAY['https://www.instagram.com/reel/C_Sunrise01/'], 1),
      (v_jannat_project_id, v_jannat_client_id, 'Reel 02 — Luxury Tent Tour', 'Reel', 'Reel Production', 'done', 'high', (now() - interval '7 days')::date, now() - interval '6 days', v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 'Published Reel', ARRAY['https://www.instagram.com/reel/C_TentTour02/'], 2);

    INSERT INTO public.project_tasks (
      project_id, client_id, title, category, service, status, priority, deadline,
      assigned_by_id, assignee_id, delivery_period, sort_order, notes
    ) VALUES
      (v_jannat_project_id, v_jannat_client_id, 'Reel 03 — Bedouin Dinner Night', 'Reel', 'Reel Production', 'in_progress', 'urgent', (now() + interval '2 days')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 3, 'Focus on acoustic music & desert atmosphere.')
    RETURNING id INTO v_reel3_id;

    -- Subtasks for Reel 03
    IF v_reel3_id IS NOT NULL THEN
      INSERT INTO public.project_tasks (project_id, client_id, parent_task_id, title, status, priority, deadline, assigned_by_id, assignee_id, delivery_period, sort_order) VALUES
        (v_jannat_project_id, v_jannat_client_id, v_reel3_id, 'Concept & Storyboard Script', 'done', 'high', (now() - interval '3 days')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 1),
        (v_jannat_project_id, v_jannat_client_id, v_reel3_id, 'Shooting at Tozeur Camp', 'done', 'urgent', (now() - interval '1 day')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 2),
        (v_jannat_project_id, v_jannat_client_id, v_reel3_id, 'Video & Color Grading Editing', 'in_progress', 'urgent', (now() + interval '1 day')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 3),
        (v_jannat_project_id, v_jannat_client_id, v_reel3_id, 'Internal Review & Client Approval', 'todo', 'medium', (now() + interval '2 days')::date, v_boubakar_profile_id, v_boubakar_profile_id, '2026-09', 4),
        (v_jannat_project_id, v_jannat_client_id, v_reel3_id, 'Final Delivery & Instagram Publish', 'todo', 'medium', (now() + interval '3 days')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 5);
    END IF;

    INSERT INTO public.project_tasks (
      project_id, client_id, title, category, service, status, priority, deadline,
      assigned_by_id, assignee_id, delivery_period, sort_order
    ) VALUES
      (v_jannat_project_id, v_jannat_client_id, 'Reel 04 — Quad Biking Dunes', 'Reel', 'Reel Production', 'todo', 'medium', (now() + interval '7 days')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 4),
      (v_jannat_project_id, v_jannat_client_id, 'Reel 05 — Star Gazing Experience', 'Reel', 'Reel Production', 'todo', 'low', (now() + interval '10 days')::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 5);

    -- Posts (2 done, 2 todo)
    INSERT INTO public.project_tasks (
      project_id, client_id, title, category, service, status, priority, deadline, completed_at,
      assigned_by_id, assignee_id, delivery_period, result_title, result_links, sort_order
    ) VALUES
      (v_jannat_project_id, v_jannat_client_id, 'Post 01 — Autumn Desert Season Promo', 'Post', 'Social Media', 'done', 'medium', (now() - interval '10 days')::date, now() - interval '9 days', v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 'Feed Post Live', ARRAY['https://www.instagram.com/p/C_Promo01/'], 6),
      (v_jannat_project_id, v_jannat_client_id, 'Post 02 — Chef Gourmet Menu Carousel', 'Post', 'Social Media', 'done', 'medium', (now() - interval '4 days')::date, now() - interval '3 days', v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 'Carousel Live', ARRAY['https://www.instagram.com/p/C_ChefMenu02/'], 7),
      (v_jannat_project_id, v_jannat_client_id, 'Post 03 — Customer Testimonial Graphic', 'Post', 'Social Media', 'todo', 'medium', (now() + interval '4 days')::date, NULL, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', NULL, '{}', 8),
      (v_jannat_project_id, v_jannat_client_id, 'Post 04 — Weekend Getaway Special Offer', 'Post', 'Social Media', 'todo', 'high', (now() + interval '8 days')::date, NULL, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', NULL, '{}', 9);

    -- Stories (7 done, 3 todo)
    FOR i IN 1..7 LOOP
      INSERT INTO public.project_tasks (
        project_id, client_id, title, category, service, status, priority, deadline, completed_at,
        assigned_by_id, assignee_id, delivery_period, sort_order
      ) VALUES
        (v_jannat_project_id, v_jannat_client_id, 'Story 0' || i || ' — Daily Desert Pulse', 'Story', 'Social Media', 'done', 'low', (now() - (interval '1 day' * (15 - i)))::date, now() - (interval '1 day' * (15 - i)), v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 10 + i);
    END LOOP;

    FOR i IN 8..10 LOOP
      INSERT INTO public.project_tasks (
        project_id, client_id, title, category, service, status, priority, deadline,
        assigned_by_id, assignee_id, delivery_period, sort_order
      ) VALUES
        (v_jannat_project_id, v_jannat_client_id, 'Story ' || CASE WHEN i < 10 THEN '0' || i ELSE '' || i END || ' — Interactive Poll', 'Story', 'Social Media', 'todo', 'low', (now() + (interval '1 day' * (i - 7)))::date, v_boubakar_profile_id, v_sarah_profile_id, '2026-09', 10 + i);
    END LOOP;
  END IF;

  -- Seed August 2026 Historical Month for Jannat Sahara (19/19 Completed)
  IF NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE client_id = v_jannat_client_id AND delivery_period = '2026-08') THEN
    FOR i IN 1..19 LOOP
      INSERT INTO public.project_tasks (
        project_id, client_id, title, category, service, status, priority, deadline, completed_at,
        assigned_by_id, assignee_id, delivery_period, result_title, result_links, sort_order
      ) VALUES (
        v_jannat_project_id, v_jannat_client_id,
        CASE
          WHEN i <= 5 THEN 'Reel 0' || i || ' — August Summer Campaign'
          WHEN i <= 9 THEN 'Post 0' || (i - 5) || ' — Oasis Activities'
          ELSE 'Story ' || CASE WHEN (i - 9) < 10 THEN '0' || (i - 9) ELSE '' || (i - 9) END || ' — August Daily'
        END,
        CASE WHEN i <= 5 THEN 'Reel' WHEN i <= 9 THEN 'Post' ELSE 'Story' END,
        'Social Media Retainer', 'done', 'medium',
        '2026-08-15'::date + (i * interval '1 day'),
        '2026-08-15'::date + (i * interval '1 day'),
        v_boubakar_profile_id, v_sarah_profile_id, '2026-08',
        'Delivered & Archived', ARRAY['https://drive.google.com/drive/folders/august-deliverables'], i
      );
    END LOOP;
  END IF;

  -- -------------------------------------------------------------
  -- B. CONFIGURE FLAGSHIP ONE-OFF CLIENT: Café 707
  -- -------------------------------------------------------------
  SELECT id INTO v_cafe_client_id FROM public.clients WHERE lower(name) = 'café 707' OR lower(name) = 'caffe 707' LIMIT 1;
  IF v_cafe_client_id IS NOT NULL THEN
    UPDATE public.clients SET
      client_type = 'one_off',
      package_name = NULL,
      package_config = NULL
    WHERE id = v_cafe_client_id;

    SELECT id INTO v_cafe_project_id FROM public.client_projects WHERE client_id = v_cafe_client_id LIMIT 1;

    -- Look up or update existing Café 707 task
    SELECT id INTO v_cafe_reel_id FROM public.project_tasks WHERE client_id = v_cafe_client_id AND parent_task_id IS NULL LIMIT 1;
    IF v_cafe_reel_id IS NULL AND v_cafe_project_id IS NOT NULL THEN
      SELECT id INTO v_cafe_reel_id FROM public.project_tasks WHERE project_id = v_cafe_project_id AND parent_task_id IS NULL LIMIT 1;
    END IF;

    IF v_cafe_reel_id IS NOT NULL THEN
      UPDATE public.project_tasks SET
        client_id = v_cafe_client_id,
        title = 'Reel Production — Café 707 Signature Blend',
        service = 'Reel Production',
        category = 'Reel',
        status = 'in_progress',
        priority = 'urgent',
        deadline = '2026-09-23'::date,
        assigned_by_id = v_boubakar_profile_id,
        assignee_id = v_sarah_profile_id,
        delivery_period = 'one_off'
      WHERE id = v_cafe_reel_id;

      -- Ensure subtasks exist for Café 707 Reel Production
      IF NOT EXISTS (SELECT 1 FROM public.project_tasks WHERE parent_task_id = v_cafe_reel_id) THEN
        INSERT INTO public.project_tasks (project_id, client_id, parent_task_id, title, status, priority, deadline, assigned_by_id, assignee_id, delivery_period, sort_order) VALUES
          (v_cafe_project_id, v_cafe_client_id, v_cafe_reel_id, 'Shooting at Café 707 (Espresso & Ambiance)', 'done', 'high', (now() - interval '2 days')::date, v_boubakar_profile_id, v_sarah_profile_id, 'one_off', 1),
          (v_cafe_project_id, v_cafe_client_id, v_cafe_reel_id, 'Editing & Sound Design (Upbeat Lofi)', 'in_progress', 'urgent', '2026-09-22'::date, v_boubakar_profile_id, v_sarah_profile_id, 'one_off', 2),
          (v_cafe_project_id, v_cafe_client_id, v_cafe_reel_id, 'Review & Color Correction', 'todo', 'medium', '2026-09-23'::date, v_boubakar_profile_id, v_boubakar_profile_id, 'one_off', 3),
          (v_cafe_project_id, v_cafe_client_id, v_cafe_reel_id, 'Final Delivery to Client', 'todo', 'high', '2026-09-23'::date, v_boubakar_profile_id, v_sarah_profile_id, 'one_off', 4);
      END IF;
    END IF;
  END IF;

END $$;

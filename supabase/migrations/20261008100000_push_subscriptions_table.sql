-- ============================================================
-- SADA OS — NOTIFICATION EXPERIENCE 2.0
-- Migration: Push Subscriptions & Enhanced Preferences
-- ============================================================

-- 1. Create push_subscriptions table for Web Push / Mobile Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  device_type TEXT DEFAULT 'desktop', -- 'desktop' | 'mobile' | 'tablet'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

-- Indexes for performance & lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: User ownership isolation
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

-- 2. Add delivery channel columns to notification_preferences if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notification_preferences' 
      AND column_name = 'desktop_push_enabled'
  ) THEN
    ALTER TABLE public.notification_preferences ADD COLUMN desktop_push_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notification_preferences' 
      AND column_name = 'mobile_push_enabled'
  ) THEN
    ALTER TABLE public.notification_preferences ADD COLUMN mobile_push_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notification_preferences' 
      AND column_name = 'messages_enabled'
  ) THEN
    ALTER TABLE public.notification_preferences ADD COLUMN messages_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'notification_preferences' 
      AND column_name = 'operations_enabled'
  ) THEN
    ALTER TABLE public.notification_preferences ADD COLUMN operations_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

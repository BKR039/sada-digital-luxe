-- Migration: 20260914160000_smart_discovery_submissions.sql
-- Description: Extend contact_submissions for Smart Project Discovery workflow

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS discovery_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS questionnaire_answers JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS path_taken TEXT DEFAULT 'guided';

-- Update RLS policy to accommodate discovery extensions with strict boundary validation
DROP POLICY IF EXISTS "Anyone submits contact" ON public.contact_submissions;

CREATE POLICY "Anyone submits contact"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND char_length(name) BETWEEN 2 AND 100
  AND char_length(email) BETWEEN 3 AND 255
  AND char_length(message) BETWEEN 10 AND 2000
  AND (phone IS NULL OR char_length(phone) <= 40)
  AND (business_name IS NULL OR char_length(business_name) <= 120)
  AND (service IS NULL OR char_length(service) <= 80)
  AND (budget IS NULL OR char_length(budget) <= 40)
  AND (preferred_contact IS NULL OR char_length(preferred_contact) <= 40)
  AND (path_taken IS NULL OR path_taken IN ('guided', 'quick', 'free_text'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_path_taken ON public.contact_submissions(path_taken);

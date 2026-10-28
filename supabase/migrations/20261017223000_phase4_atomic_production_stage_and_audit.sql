-- ============================================================
-- SADA OS — MIGRATION: 20261017223000
-- Phase 4: Atomic Production Booking Stage Advancement & Audit
-- Guarantees atomic sequential stage validation, row locking,
-- and project_activity audit logging in a single transaction.
-- ============================================================

CREATE OR REPLACE FUNCTION public.advance_production_booking_stage(
  _booking_id UUID,
  _new_stage TEXT,
  _media_urls JSONB DEFAULT '{}'::jsonb,
  _actor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_stages TEXT[] := ARRAY['brief', 'scheduling', 'shooting', 'raw_upload', 'editing', 'review', 'client_approval', 'delivery_publishing'];
  v_curr_idx INT;
  v_next_idx INT;
  v_activity_id UUID;
  v_effective_actor UUID;
  v_is_authorized BOOLEAN;
  v_is_service_role BOOLEAN;
BEGIN
  -- 1. Trust Boundary & Actor Identity Verification
  IF auth.uid() IS NOT NULL THEN
    -- Authenticated user context: Actor identity is IMMUTABLY derived from trusted session JWT
    IF _actor_id IS NOT NULL AND _actor_id != auth.uid() THEN
      RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected. Authenticated caller % cannot specify or impersonate actor %.', auth.uid(), _actor_id;
    END IF;
    v_effective_actor := auth.uid();
  ELSIF current_setting('request.jwt.claim.role', true) = 'service_role' OR
        (session_user = 'postgres' AND COALESCE(current_setting('request.jwt.claim.role', true), '') NOT IN ('anon', 'authenticated')) THEN
    -- Trusted service-role / database maintenance context
    v_is_service_role := true;
    v_effective_actor := _actor_id;
  ELSE
    -- Unauthenticated / anonymous caller
    RAISE EXCEPTION 'UNAUTHORIZED: Anonymous callers cannot advance production bookings.';
  END IF;

  -- 2. Authorization Verification
  IF v_effective_actor IS NOT NULL THEN
    v_is_authorized := public.is_super_admin(v_effective_actor) OR (
      public.is_admin(v_effective_actor) AND (
        public.has_module_access(v_effective_actor, 'calendar') OR
        public.has_module_access(v_effective_actor, 'tasks')
      )
    );

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'UNAUTHORIZED: User % lacks permission to advance production bookings.', v_effective_actor;
    END IF;
  ELSIF NOT v_is_service_role THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Effective actor could not be verified.';
  END IF;

  -- 2. Concurrency Safety: Acquire Row Lock FOR UPDATE
  SELECT id, client_id, project_id, stage
  INTO v_booking
  FROM public.production_bookings
  WHERE id = _booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Production booking % does not exist.', _booking_id;
  END IF;

  -- 3. Resolve sequential stage indexes
  v_curr_idx := array_position(v_stages, v_booking.stage);
  v_next_idx := array_position(v_stages, _new_stage);

  IF v_curr_idx IS NULL THEN
    RAISE EXCEPTION 'INVALID_CURRENT_STAGE: Booking current stage % is unknown.', v_booking.stage;
  END IF;

  IF v_next_idx IS NULL THEN
    RAISE EXCEPTION 'INVALID_TARGET_STAGE: Target stage % is unknown.', _new_stage;
  END IF;

  -- 4. Strictly enforce adjacent forward progression (step N -> step N + 1)
  IF v_next_idx != v_curr_idx + 1 THEN
    RAISE EXCEPTION 'INVALID_STAGE_TRANSITION: Cannot transition booking from % (step %) to % (step %). Must advance sequentially.',
      v_booking.stage, v_curr_idx, _new_stage, v_next_idx;
  END IF;

  -- 5. Atomically update production booking
  UPDATE public.production_bookings
  SET stage = _new_stage,
      raw_upload_url = COALESCE(_media_urls->>'raw_upload_url', raw_upload_url),
      edit_preview_url = COALESCE(_media_urls->>'edit_preview_url', edit_preview_url),
      client_notes = COALESCE(_media_urls->>'client_notes', client_notes),
      updated_at = now()
  WHERE id = _booking_id;

  -- 6. Atomically insert audit record in project_activity
  INSERT INTO public.project_activity (
    project_id,
    actor_id,
    activity_type,
    old_state,
    new_state,
    metadata,
    created_at
  )
  VALUES (
    v_booking.project_id,
    v_effective_actor,
    'production_stage_advanced',
    jsonb_build_object('stage', v_booking.stage),
    jsonb_build_object('stage', _new_stage),
    jsonb_build_object(
      'booking_id', _booking_id,
      'media_urls', _media_urls,
      'transition', format('%s -> %s', v_booking.stage, _new_stage),
      'actor_source', CASE WHEN auth.uid() IS NOT NULL THEN 'session' ELSE 'service_role' END
    ),
    now()
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', _booking_id,
    'previous_stage', v_booking.stage,
    'new_stage', _new_stage,
    'activity_id', v_activity_id,
    'actor_id', v_effective_actor
  );
END;
$$;

-- Strip excessive execution privileges from public pseudo-role and anonymous callers
REVOKE EXECUTE ON FUNCTION public.advance_production_booking_stage(UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon;

-- Ensure explicit execute grants for authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.advance_production_booking_stage(UUID, TEXT, JSONB, UUID) TO authenticated, service_role;

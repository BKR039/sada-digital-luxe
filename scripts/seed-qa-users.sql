DO $$
DECLARE
  _sa_id UUID;
  _w_id UUID;
BEGIN
  -- 1. Create or update qa.superadmin@sada.agency
  SELECT id INTO _sa_id FROM auth.users WHERE email = 'qa.superadmin@sada.agency';
  IF _sa_id IS NULL THEN
    _sa_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _sa_id, 'authenticated', 'authenticated',
      'qa.superadmin@sada.agency', crypt('SuperAdminPassword123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"display_name":"QA Super Admin"}',
      now(), now(), ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('SuperAdminPassword123!', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = _sa_id;
  END IF;

  DELETE FROM auth.identities WHERE user_id = _sa_id;
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _sa_id,
    jsonb_build_object('sub', _sa_id::text, 'email', 'qa.superadmin@sada.agency', 'email_verified', true),
    'email', _sa_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (_sa_id, 'QA Super Admin')
  ON CONFLICT (id) DO UPDATE SET display_name = 'QA Super Admin';

  DELETE FROM public.user_roles WHERE user_id = _sa_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_sa_id, 'super_admin');

  -- 2. Create or update qa.worker.mohamed@sada.agency
  SELECT id INTO _w_id FROM auth.users WHERE email = 'qa.worker.mohamed@sada.agency';
  IF _w_id IS NULL THEN
    _w_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _w_id, 'authenticated', 'authenticated',
      'qa.worker.mohamed@sada.agency', crypt('WorkerPassword123!', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Mohamed Worker QA"}',
      now(), now(), ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('WorkerPassword123!', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = _w_id;
  END IF;

  DELETE FROM auth.identities WHERE user_id = _w_id;
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _w_id,
    jsonb_build_object('sub', _w_id::text, 'email', 'qa.worker.mohamed@sada.agency', 'email_verified', true),
    'email', _w_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (id, display_name)
  VALUES (_w_id, 'Mohamed Worker QA')
  ON CONFLICT (id) DO UPDATE SET display_name = 'Mohamed Worker QA';

  DELETE FROM public.user_roles WHERE user_id = _w_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_w_id, 'worker');

END $$;

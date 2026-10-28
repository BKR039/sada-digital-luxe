-- Create an auto-confirmed authenticated admin test user with GoTrue identity
DO $$
DECLARE
  _user_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      _user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'sec.admin@sada.agency',
      extensions.crypt('AdminPassword123!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Security Admin"}'::jsonb,
      now(),
      now()
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
    ) VALUES (
      _user_id,
      _user_id,
      format('{"sub":"%s","email":"sec.admin@sada.agency"}', _user_id)::jsonb,
      'email',
      now(),
      now(),
      now(),
      'sec.admin@sada.agency'
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

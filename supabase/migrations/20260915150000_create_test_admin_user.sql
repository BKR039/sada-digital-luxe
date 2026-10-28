CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create an auto-confirmed test admin user for automated security testing
DO $$
DECLARE
  _user_id UUID := '00000000-0000-0000-0000-000000000001';
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
      'admin.security.test@sada.agency',
      extensions.crypt('AdminTestPassword123!', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Security Test Admin"}'::jsonb,
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET email_confirmed_at = now(),
        encrypted_password = extensions.crypt('AdminTestPassword123!', extensions.gen_salt('bf'))
    WHERE id = _user_id;
  END IF;

  -- Ensure admin role in user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

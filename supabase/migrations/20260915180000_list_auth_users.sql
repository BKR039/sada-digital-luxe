-- List existing auth users for test script reference
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, email, email_confirmed_at FROM auth.users LOOP
    RAISE NOTICE 'User: id=%, email=%, confirmed=%', r.id, r.email, r.email_confirmed_at;
  END LOOP;
END $$;

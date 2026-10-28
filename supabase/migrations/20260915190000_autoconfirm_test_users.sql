-- Auto confirm signed-up users to enable instant sign in for automated testing
CREATE OR REPLACE FUNCTION public.autoconfirm_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email_confirmed_at = COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_autoconfirm ON auth.users;
CREATE TRIGGER on_auth_user_autoconfirm
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.autoconfirm_user();

-- Update any existing unconfirmed users
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

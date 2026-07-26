
-- Site-wide feature toggles (e.g. hide/restore the Blog section without a redeploy)
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER site_settings_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Blog is being relaunched later; hidden from the public site until an admin re-enables it.
INSERT INTO public.site_settings (key, enabled) VALUES ('blog', false);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage site settings" ON public.site_settings FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Mail, MessageCircle } from "lucide-react";
import { Logo } from "./Logo";
import { useSiteSetting } from "@/lib/site-settings";
import { useTranslation } from "@/i18n";

export function Footer() {
  const { enabled: blogEnabled } = useSiteSetting("blog", false);
  const { t } = useTranslation();

  const companyLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/services", label: t("nav.services") },
    { to: "/case-studies", label: t("nav.caseStudies") },
    { to: "/store", label: t("nav.products") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/about", label: t("nav.about") },
    ...(blogEnabled ? [{ to: "/blog", label: t("nav.blog") }] : []),
    { to: "/contact", label: t("nav.contact") },
  ];

  const legalLinks = [
    { to: "/", label: t("common.privacyPolicy") },
    { to: "/", label: t("common.termsOfService") },
  ];

  const columns = [
    { heading: t("footer.companyTitle"), links: companyLinks },
    { heading: t("footer.legalTitle"), links: legalLinks },
  ];

  return (
    <footer className="relative mt-12 sm:mt-20 md:mt-24 border-t border-border bg-gradient-soft">
      <div className="mx-auto max-w-7xl px-3.5 sm:px-4 py-8 sm:py-12 md:py-14 grid gap-8 sm:gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 sm:mt-4 text-muted-foreground max-w-md text-xs sm:text-sm leading-relaxed">
            {t("footer.tagline")}
          </p>
          <div className="mt-5 flex gap-2">
            {[Instagram, Linkedin, Mail, MessageCircle].map((Icon, i) => (
              <a key={i} href="#" aria-label="Social link" className="size-9 sm:size-10 rounded-xl border border-border bg-card grid place-items-center hover:bg-muted transition-colors">
                <Icon className="size-4" />
              </a>
            ))}
          </div>
          <div className="mt-5 text-xs sm:text-sm text-muted-foreground space-y-1">
            <div dir="ltr" className="inline-block">hello@sada.media</div>
            <div dir="ltr">@sada.media.production</div>
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.heading}>
            <h4 className="text-[11px] sm:text-xs font-bold mb-3 sm:mb-4 tracking-widest text-muted-foreground uppercase">{col.heading}</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              {col.links.map((l, i) => (
                <li key={`${l.to}-${l.label}-${i}`}>
                  <Link to={l.to} className="text-muted-foreground hover:text-foreground transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-4 sm:py-5 px-3.5 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 text-xs text-muted-foreground max-w-7xl mx-auto text-center sm:text-start">
        <div>© {new Date().getFullYear()} SADA Media Production. {t("footer.rightsReserved")}</div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("sada:open-cookie-preferences"));
            }
          }}
          className="hover:text-foreground transition-colors underline-offset-4 hover:underline cursor-pointer"
        >
          {t("footer.cookiePreferences", "Cookie & UX Preferences • تفضيلات الخصوصية")}
        </button>
      </div>
    </footer>
  );
}

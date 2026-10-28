import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { PrimaryCTA } from "./PrimaryCTA";
import { useSiteSetting } from "@/lib/site-settings";
import { useTheme } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { useTranslation } from "@/i18n";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { enabled: blogEnabled } = useSiteSetting("blog", false);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";

  const navItems = [
    { to: "/", label: t("nav.home") },
    { to: "/services", label: t("nav.services") },
    { to: "/case-studies", label: t("nav.caseStudies") },
    { to: "/store", label: t("nav.products") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/about", label: t("nav.about") },
    ...(blogEnabled ? [{ to: "/blog", label: t("nav.blog") }] : []),
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  const isHome = path === "/";

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "py-1.5 sm:py-2" : "py-2 sm:py-3"}`}>
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div
          className={`rounded-2xl px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between transition-all duration-300 border ${
            isDark
              ? scrolled
                ? "bg-slate-950/85 backdrop-blur-xl border-white/10 shadow-2xl shadow-black/40"
                : isHome
                  ? "bg-white/[0.04] backdrop-blur-md border-white/[0.08]"
                  : "bg-slate-950/40 backdrop-blur-md border-transparent"
              : scrolled
                ? "bg-white/80 backdrop-blur-xl border-white/70 shadow-lg shadow-slate-900/[0.04]"
                : isHome
                  ? "bg-white/75 backdrop-blur-xl border-white/70 shadow-sm shadow-slate-900/[0.03]"
                  : "bg-white/70 backdrop-blur-xl border-white/60 shadow-sm shadow-slate-900/[0.03]"
          }`}
        >
          <Link to="/" className="shrink-0"><Logo forceDark={isDark} /></Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((n) => (
              <Link key={n.to} to={n.to}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? path === n.to
                      ? "text-cyan-400 bg-white/10 font-semibold"
                      : "text-slate-200 hover:text-white hover:bg-white/10"
                    : path === n.to
                      ? "text-primary bg-primary/10 font-semibold"
                      : "text-slate-700 hover:text-foreground hover:bg-black/5"
                }`}>
                {n.label}
              </Link>
            ))}

            <Link to="/contact"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? path === "/contact"
                    ? "text-cyan-400 bg-white/10 font-semibold"
                    : "text-slate-200 hover:text-white hover:bg-white/10"
                  : path === "/contact"
                    ? "text-primary bg-primary/10 font-semibold"
                    : "text-slate-700 hover:text-foreground hover:bg-black/5"
              }`}>
              {t("nav.contact")}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <PrimaryCTA to="/contact" size="sm" showArrow={false} className="hidden sm:inline-flex">
              {t("nav.startProject")}
            </PrimaryCTA>
            <button
              onClick={() => setOpen(!open)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${
                isDark ? "text-white hover:bg-white/10" : "text-foreground hover:bg-black/5"
              }`}
              aria-label="Toggle menu"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div
            className={`lg:hidden mt-2.5 border rounded-2xl p-3 sm:p-4 space-y-1.5 shadow-2xl animate-in fade-in slide-in-from-top-2 ${
              isDark
                ? "bg-slate-950/98 border-white/15 text-white backdrop-blur-2xl shadow-black/60"
                : "bg-white/98 border-slate-200/90 text-foreground backdrop-blur-2xl shadow-slate-900/15"
            }`}
          >
            {navItems.map((n) => {
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  preload="render"
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm sm:text-base font-semibold transition-all ${
                    active
                      ? isDark
                        ? "bg-white/10 text-cyan-400"
                        : "bg-primary/10 text-primary"
                      : isDark
                        ? "text-slate-200 hover:text-white hover:bg-white/5"
                        : "text-slate-800 hover:text-foreground hover:bg-slate-100/80"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}

            {(() => {
              const active = path === "/contact";
              return (
                <Link
                  to="/contact"
                  preload="render"
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm sm:text-base font-semibold transition-all ${
                    active
                      ? isDark
                        ? "bg-white/10 text-cyan-400"
                        : "bg-primary/10 text-primary"
                      : isDark
                        ? "text-slate-200 hover:text-white hover:bg-white/5"
                        : "text-slate-800 hover:text-foreground hover:bg-slate-100/80"
                  }`}
                >
                  {t("nav.contact")}
                </Link>
              );
            })()}

            <div className="pt-2">
              <PrimaryCTA
                to="/contact"
                size="md"
                showArrow={false}
                className="w-full py-3 justify-center text-center font-semibold rounded-xl"
              >
                {t("nav.startProject")}
              </PrimaryCTA>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

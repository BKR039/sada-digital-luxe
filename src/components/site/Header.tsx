import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, BookOpen, Users, Building2, Sparkles, FileText } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Case Studies" },
  { to: "/store", label: "Products" },
  { to: "/pricing", label: "Pricing" },
] as const;

const RESOURCES = [
  { to: "/blog", label: "Blog", desc: "Strategy, branding & growth insights", icon: BookOpen },
  { to: "/about", label: "About SADA", desc: "Our story, mission and values", icon: Building2 },
  { to: "/team", label: "Team", desc: "Meet the people behind the work", icon: Users },
  { to: "/blog", label: "Insights", desc: "Trends, research and field notes", icon: Sparkles },
  { to: "/blog", label: "Guides", desc: "Long-form playbooks and tutorials", icon: FileText },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [mobileResOpen, setMobileResOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin } = useAuth();
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setResOpen(false);
    setMobileResOpen(false);
  }, [path]);

  const openRes = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setResOpen(true);
  };
  const scheduleCloseRes = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setResOpen(false), 140);
  };

  const isResourceRoute = ["/blog", "/about", "/team"].some((p) => path === p || path.startsWith(`${p}/`));

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "py-2" : "py-3"}`}>
      <div className="mx-auto max-w-7xl px-4">
        <div
          className={`rounded-2xl px-4 sm:px-5 py-2.5 flex items-center justify-between transition-all duration-300 border ${
            scrolled
              ? "bg-background/80 backdrop-blur-xl border-border soft-shadow"
              : "bg-background/40 backdrop-blur-md border-transparent"
          }`}
        >
          <Link to="/" className="shrink-0"><Logo /></Link>

          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  path === n.to
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}>
                {n.label}
              </Link>
            ))}

            {/* Resources dropdown */}
            <div className="relative" onMouseEnter={openRes} onMouseLeave={scheduleCloseRes}>
              <button
                onClick={() => setResOpen((v) => !v)}
                aria-expanded={resOpen}
                aria-haspopup="true"
                className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isResourceRoute
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                Resources
                <ChevronDown className={`size-3.5 transition-transform duration-200 ${resOpen ? "rotate-180" : ""}`} />
              </button>

              <div
                className={`absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[420px] transition-all duration-200 ${
                  resOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
                <div className="rounded-2xl border border-border bg-background/95 backdrop-blur-xl elevated-shadow p-2">
                  {RESOURCES.map((r) => {
                    const Icon = r.icon;
                    return (
                      <Link
                        key={`${r.to}-${r.label}`}
                        to={r.to}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted transition-colors group"
                      >
                        <div className="size-9 shrink-0 rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary group-hover:scale-105 transition-transform">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">{r.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <Link to="/contact"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                path === "/contact"
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}>
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && isAdmin && (
              <Link to="/admin" className="hidden sm:inline-flex text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
                Admin
              </Link>
            )}
            <Link to="/contact"
              className="hidden sm:inline-flex text-sm font-semibold px-4 py-2 rounded-xl bg-gradient-primary text-white neon-glow hover:scale-[1.03] transition-transform">
              Start a Project
            </Link>
            <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded-lg hover:bg-muted" aria-label="Toggle menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden mt-2 bg-background border border-border rounded-2xl p-3 space-y-1 soft-shadow animate-in fade-in slide-in-from-top-2">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to}
                className={`block px-4 py-3 rounded-lg text-sm font-medium ${path === n.to ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}>
                {n.label}
              </Link>
            ))}

            {/* Mobile Resources accordion */}
            <button
              onClick={() => setMobileResOpen((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium ${
                isResourceRoute ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
              }`}
              aria-expanded={mobileResOpen}
            >
              <span>Resources</span>
              <ChevronDown className={`size-4 transition-transform duration-200 ${mobileResOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              className={`grid transition-all duration-200 ${
                mobileResOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="pl-3 ml-3 border-l border-border space-y-1 py-1">
                  {RESOURCES.map((r) => (
                    <Link
                      key={`m-${r.to}-${r.label}`}
                      to={r.to}
                      className="block px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      {r.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <Link to="/contact"
              className={`block px-4 py-3 rounded-lg text-sm font-medium ${path === "/contact" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}>
              Contact
            </Link>

            {user && isAdmin && <Link to="/admin" className="block px-4 py-3 rounded-lg text-sm text-primary">Admin Dashboard</Link>}
            <Link to="/contact" className="block mt-2 text-center bg-gradient-primary text-white py-3 rounded-xl font-semibold">Start a Project</Link>
          </div>
        )}
      </div>
    </header>
  );
}

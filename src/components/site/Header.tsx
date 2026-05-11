import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/store", label: "Products" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

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
            {user && isAdmin && <Link to="/admin" className="block px-4 py-3 rounded-lg text-sm text-primary">Admin Dashboard</Link>}
            <Link to="/contact" className="block mt-2 text-center bg-gradient-primary text-white py-3 rounded-xl font-semibold">Start a Project</Link>
          </div>
        )}
      </div>
    </header>
  );
}

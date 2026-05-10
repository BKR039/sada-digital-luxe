import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Our Work" },
  { to: "/store", label: "Packages" },
  { to: "/team", label: "Team" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [path]);

  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "py-2" : "py-4"}`}>
      <div className="mx-auto max-w-7xl px-4">
        <div
          className={`rounded-2xl px-5 py-3 flex items-center justify-between transition-all duration-500 ${
            scrolled
              ? "glass-strong shadow-[0_10px_40px_-10px_oklch(0_0_0/0.6)] border border-primary/20"
              : "bg-background/10 backdrop-blur-md border border-white/5"
          }`}
          style={scrolled ? { boxShadow: "0 0 0 1px oklch(0.66 0.22 250 / 0.15), 0 20px 60px -20px oklch(0 0 0 / 0.7)" } : undefined}
        >
          <Link to="/"><Logo /></Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:text-white hover:bg-white/5 ${path === n.to ? "text-white bg-white/10" : "text-muted-foreground"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            {user && isAdmin && (
              <Link to="/admin" className="text-sm px-4 py-2 rounded-lg glass-strong hover:cyan-glow transition-all">Admin</Link>
            )}
            <Link to="/contact"
              className="group text-sm font-semibold inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white hover:scale-105 transition-transform neon-glow">
              Let's Talk
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-white" aria-label="Toggle menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden mt-2 glass-strong rounded-2xl p-4 space-y-1 animate-in fade-in slide-in-from-top-2">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className={`block px-4 py-3 rounded-lg ${path === n.to ? "bg-white/10 text-white" : "text-muted-foreground"}`}>
                {n.label}
              </Link>
            ))}
            {user && isAdmin && <Link to="/admin" className="block px-4 py-3 rounded-lg text-accent">Admin Dashboard</Link>}
            <Link to="/contact" className="block mt-2 text-center bg-gradient-primary py-3 rounded-xl font-semibold">Start a Project</Link>
          </div>
        )}
      </div>
    </header>
  );
}

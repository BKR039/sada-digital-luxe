import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { LayoutDashboard, FolderKanban, FileText, ShoppingBag, MessageSquare, Star, LogOut, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV: { to: string; label: string; Icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { to: "/admin/projects", label: "Projects", Icon: FolderKanban },
  { to: "/admin/blog", label: "Blog", Icon: FileText },
  { to: "/admin/products", label: "Products", Icon: ShoppingBag },
  { to: "/admin/testimonials", label: "Testimonials", Icon: Star },
  { to: "/admin/contact", label: "Inquiries", Icon: MessageSquare },
];

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading...</div>;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="glass-strong rounded-3xl p-10 max-w-md text-center">
          <h1 className="font-display text-2xl font-bold">Admin access required</h1>
          <p className="mt-3 text-muted-foreground text-sm">Your account doesn't have the admin role yet. Grant it from the Cloud dashboard (user_roles table).</p>
          <button onClick={() => signOut()} className="mt-6 glass px-5 py-2.5 rounded-xl">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-soft">
      <aside className="w-64 shrink-0 border-r border-border p-5 bg-card sticky top-0 h-screen flex flex-col">
        <Link to="/" className="block"><Logo /></Link>
        <nav className="mt-8 space-y-1 flex-1">
          {NAV.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to as any}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-primary text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <n.Icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 pt-4 border-t border-border">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowLeft className="size-3.5" /> Back to site
          </Link>
          <button onClick={() => signOut()} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

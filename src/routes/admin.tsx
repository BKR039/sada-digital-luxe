import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";
import { LayoutDashboard, FolderKanban, Users, FileText, ShoppingBag, MessageSquare, Star, LogOut, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV: { to: string; label: string; Icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Overview", Icon: LayoutDashboard, exact: true },
  { to: "/admin/projects", label: "Projects", Icon: FolderKanban },
  { to: "/admin/team", label: "Team", Icon: Users },
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
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-border/50 p-5 glass-strong sticky top-0 h-screen">
        <Link to="/"><Logo /></Link>
        <nav className="mt-8 space-y-1">
          {NAV.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to as any} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${active ? "bg-gradient-primary text-white" : "text-muted-foreground hover:bg-white/5 hover:text-white"}`}>
                <n.Icon className="size-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 space-y-2">
          <Link to="/" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-accent"><ArrowLeft className="size-3" /> Back to site</Link>
          <button onClick={() => signOut()} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl glass text-sm hover:bg-destructive/20"><LogOut className="size-4" /> Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

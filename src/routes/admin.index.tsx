import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, Users, FileText, ShoppingBag, MessageSquare, Star } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: Overview });

const CARDS = [
  { table: "projects", label: "Projects", Icon: FolderKanban },
  { table: "team_members", label: "Team", Icon: Users },
  { table: "blog_posts", label: "Posts", Icon: FileText },
  { table: "products", label: "Products", Icon: ShoppingBag },
  { table: "testimonials", label: "Testimonials", Icon: Star },
  { table: "contact_submissions", label: "Inquiries", Icon: MessageSquare },
];

function Overview() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    Promise.all(CARDS.map(c => (supabase as any).from(c.table).select("*", { count: "exact", head: true })))
      .then(rs => setCounts(Object.fromEntries(CARDS.map((c, i) => [c.table, rs[i].count || 0]))));
  }, []);
  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-2 mb-10">Manage everything that powers SADA from here.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(c => (
          <div key={c.table} className="group rounded-2xl border border-border bg-card p-6 soft-shadow hover:elevated-shadow hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center neon-glow">
                <c.Icon className="size-5 text-white" />
              </div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-3xl font-display font-bold text-gradient">{counts[c.table] ?? "—"}</div>
            <div className="text-sm text-muted-foreground mt-1">Total records</div>
          </div>
        ))}
      </div>
    </div>
  );
}

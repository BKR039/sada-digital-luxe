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
      <h1 className="font-display text-3xl font-bold mb-2">Welcome back</h1>
      <p className="text-muted-foreground mb-10">Manage everything that powers SADA from here.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(c => (
          <div key={c.table} className="glass glow-border rounded-3xl p-6 hover:cyan-glow transition-all">
            <c.Icon className="size-7 text-accent mb-3" />
            <div className="text-3xl font-display font-bold text-gradient">{counts[c.table] ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

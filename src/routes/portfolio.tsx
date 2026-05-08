import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ArrowUpRight } from "lucide-react";

interface Project {
  id: string; title: string; slug: string; client: string | null; description: string | null;
  category: string | null; cover_url: string | null; thumbnail_url: string | null;
  services: string[] | null; project_date: string | null; tags: string[] | null;
}

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [
    { title: "Portfolio — SADA" },
    { name: "description", content: "Selected projects — branding, content, social, and digital work by SADA." },
    { property: "og:title", content: "Portfolio — SADA" },
    { property: "og:description", content: "Work that moved metrics. See projects shipped by SADA." },
  ] }),
  component: Portfolio,
});

function Portfolio() {
  const [items, setItems] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("projects").select("id,title,slug,client,description,category,cover_url,thumbnail_url,services,project_date,tags")
      .eq("published", true).order("sort_order").order("created_at", { ascending: false })
      .then(({ data }) => { setItems((data as any) || []); setLoading(false); });
  }, []);

  const cats = useMemo(() => ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[]))], [items]);
  const filtered = filter === "All" ? items : items.filter(i => i.category === filter);

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">PORTFOLIO</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.95]">Work that <span className="text-gradient">moved metrics</span>.</h1>
        <div className="mt-10 flex flex-wrap gap-2">
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${filter === c ? "bg-gradient-primary text-white neon-glow" : "glass hover:bg-white/10"}`}>
              {c}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-3xl glass animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center text-muted-foreground">
            No projects published yet. Add your first project from the admin dashboard.
          </div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p, i) => (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.5 }}>
                <Link to="/portfolio/$slug" params={{ slug: p.slug }}
                  className="group block glass glow-border rounded-3xl overflow-hidden hover:cyan-glow hover:-translate-y-1 transition-all">
                  <div className="aspect-[4/3] overflow-hidden">
                    {p.thumbnail_url || p.cover_url ? (
                      <SmartMedia src={p.thumbnail_url || p.cover_url} className="w-full h-full transition-transform duration-700 group-hover:scale-110" autoplay={false} />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-7xl font-display font-bold text-gradient bg-gradient-to-br from-primary/20 to-accent/20">{p.title.charAt(0)}</div>
                    )}
                  </div>
                  <div className="p-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {p.category && <div className="text-[10px] uppercase tracking-widest text-accent mb-1">{p.category}</div>}
                      <h3 className="font-display text-lg font-bold truncate">{p.title}</h3>
                      {p.client && <div className="text-sm text-muted-foreground mt-0.5 truncate">{p.client}</div>}
                    </div>
                    <ArrowUpRight className="size-5 text-accent shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

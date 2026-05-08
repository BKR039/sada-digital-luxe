import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Project {
  id: string; title: string; slug: string; client: string | null; description: string | null;
  category: string | null; cover_url: string | null; gallery: any; services: string[] | null;
  results: string | null; project_date: string | null; tags: string[] | null;
}

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — SADA" }, { name: "description", content: "Selected projects — branding, content, social, and digital work by SADA." }] }),
  component: Portfolio,
});

function Portfolio() {
  const [items, setItems] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [active, setActive] = useState<Project | null>(null);

  useEffect(() => {
    supabase.from("projects").select("*").eq("published", true).order("sort_order").order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as any) || []));
  }, []);

  const cats = useMemo(() => ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[]))], [items]);
  const filtered = filter === "All" ? items : items.filter(i => i.category === filter);

  return (
    <>
      <section className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">PORTFOLIO</p>
          <h1 className="font-display text-5xl md:text-7xl font-bold">Work that <span className="text-gradient">moved metrics</span>.</h1>
          <div className="mt-10 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c} onClick={() => setFilter(c)}
                className={`px-4 py-2 rounded-full text-sm transition-all ${filter === c ? "bg-gradient-primary text-white neon-glow" : "glass hover:bg-white/10"}`}>
                {c}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div className="mt-16 glass rounded-3xl p-16 text-center text-muted-foreground">
              No projects published yet. Add your first project from the admin dashboard.
            </div>
          ) : (
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((p, i) => (
                <motion.button key={p.id}
                  initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                  onClick={() => setActive(p)}
                  className="group text-left glass glow-border rounded-3xl overflow-hidden hover:cyan-glow hover:-translate-y-1 transition-all">
                  <div className="aspect-[4/3] bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
                    {p.cover_url
                      ? <img src={p.cover_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      : <div className="w-full h-full grid place-items-center text-6xl font-display font-bold text-gradient">{p.title.charAt(0)}</div>}
                  </div>
                  <div className="p-5">
                    {p.category && <div className="text-[10px] uppercase tracking-widest text-accent mb-1">{p.category}</div>}
                    <h3 className="font-display text-lg font-bold">{p.title}</h3>
                    {p.client && <div className="text-sm text-muted-foreground mt-0.5">{p.client}</div>}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl glass-strong border-border/50">
          {active && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-3xl font-display">{active.title}</DialogTitle>
                {active.client && <p className="text-muted-foreground text-sm">{active.client}</p>}
              </DialogHeader>
              {active.cover_url && <img src={active.cover_url} alt={active.title} className="mt-4 rounded-2xl w-full" />}
              {active.description && <p className="mt-4 text-foreground/90 leading-relaxed">{active.description}</p>}
              {active.results && (
                <div className="mt-4 glass rounded-2xl p-5">
                  <div className="text-xs font-bold text-accent tracking-widest mb-1">RESULTS</div>
                  <p>{active.results}</p>
                </div>
              )}
              {active.services && active.services.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {active.services.map(s => <span key={s} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10">{s}</span>)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

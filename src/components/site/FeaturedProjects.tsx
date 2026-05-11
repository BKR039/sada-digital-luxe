import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ArrowUpRight, ArrowRight } from "lucide-react";

interface P { id: string; title: string; slug: string; client: string | null; category: string | null; thumbnail_url: string | null; cover_url: string | null }

export function FeaturedProjects() {
  const [items, setItems] = useState<P[]>([]);
  useEffect(() => {
    supabase.from("projects").select("id,title,slug,client,category,thumbnail_url,cover_url")
      .eq("published", true).eq("featured", true).order("sort_order").limit(6)
      .then(({ data }) => setItems((data as any) || []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="px-4 py-24 relative">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">FEATURED WORK</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05]">Projects we're <span className="text-gradient">proud of</span>.</h2>
          </div>
          <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all">
            View all <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p, i) => (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: Math.min(i, 5) * 0.05, duration: 0.45 }}>
              <Link to="/portfolio/$slug" params={{ slug: p.slug }}
                className="group block rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {(p.thumbnail_url || p.cover_url) ? (
                    <SmartMedia src={p.thumbnail_url || p.cover_url} className="w-full h-full transition-transform duration-700 group-hover:scale-105" autoplay={false} />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-7xl font-display font-bold text-gradient">{p.title.charAt(0)}</div>
                  )}
                </div>
                <div className="p-5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {p.category && <div className="text-[10px] uppercase tracking-widest text-primary mb-1">{p.category}</div>}
                    <h3 className="text-lg font-bold truncate">{p.title}</h3>
                    {p.client && <div className="text-sm text-muted-foreground mt-0.5 truncate">{p.client}</div>}
                  </div>
                  <ArrowUpRight className="size-5 text-primary shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

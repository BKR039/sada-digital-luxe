import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ShoppingBag, ArrowUpRight, Sparkles } from "lucide-react";

interface Product { id: string; title: string; description: string | null; price: number | null; currency: string | null; thumbnail_url: string | null; gumroad_url: string | null; category: string | null }

export const Route = createFileRoute("/store")({
  head: () => ({ meta: [
    { title: "Store — SADA" },
    { name: "description", content: "Digital products, brand kits, templates and presets by SADA." },
    { property: "og:title", content: "Store — SADA" },
    { property: "og:description", content: "Tools to level up your brand. Built by working pros." },
  ] }),
  component: Store,
});

function Store() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from("products").select("*").eq("published", true).order("sort_order")
      .then(({ data }) => { setItems((data as any) || []); setLoading(false); });
  }, []);

  return (
    <section className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3 inline-flex items-center gap-2"><Sparkles className="size-3" />DIGITAL STORE</p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[0.95]">Tools to <span className="text-gradient">level up</span>.</h1>
        <p className="mt-4 text-muted-foreground max-w-xl text-lg">Brand kits, templates, presets and guides — built by working pros, ready to ship.</p>
        {loading ? (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[4/5] rounded-3xl glass animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center text-muted-foreground">Products coming soon. Add them from the admin dashboard.</div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: Math.min(i, 6) * 0.06, duration: 0.5 }}
                className="group relative glass glow-border rounded-3xl overflow-hidden hover:cyan-glow hover:-translate-y-1 transition-all flex flex-col">
                <div className="aspect-video overflow-hidden">
                  {p.thumbnail_url ? (
                    <SmartMedia src={p.thumbnail_url} className="w-full h-full transition-transform duration-700 group-hover:scale-110" autoplay={false} />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/30 to-accent/30"><ShoppingBag className="size-12 text-accent/60" /></div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  {p.category && <div className="text-[10px] uppercase tracking-widest text-accent mb-1">{p.category}</div>}
                  <h3 className="font-display text-lg font-bold">{p.title}</h3>
                  {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                    <div className="font-display text-xl font-bold text-gradient">
                      {p.price ? `${p.currency || "USD"} ${Number(p.price).toFixed(0)}` : "Free"}
                    </div>
                    <a href={p.gumroad_url || "#"} target="_blank" rel="noreferrer"
                      aria-label={`Buy ${p.title} on Gumroad`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-primary font-semibold text-sm neon-glow hover:scale-105 transition-transform">
                      Buy Now <ArrowUpRight className="size-4" />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

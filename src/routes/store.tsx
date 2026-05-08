import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag } from "lucide-react";

interface Product { id: string; title: string; description: string | null; price: number | null; currency: string | null; thumbnail_url: string | null; gumroad_url: string | null; category: string | null }

export const Route = createFileRoute("/store")({
  head: () => ({ meta: [{ title: "Store — SADA" }, { name: "description", content: "Digital products, brand kits, templates and presets by SADA." }] }),
  component: Store,
});

function Store() {
  const [items, setItems] = useState<Product[]>([]);
  useEffect(() => {
    supabase.from("products").select("*").eq("published", true).order("sort_order").then(({ data }) => setItems((data as any) || []));
  }, []);
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">DIGITAL STORE</p>
        <h1 className="font-display text-5xl md:text-7xl font-bold">Tools to <span className="text-gradient">level up</span>.</h1>
        <p className="mt-4 text-muted-foreground max-w-xl">Brand kits, templates, presets and guides — built by working pros, ready to ship.</p>
        {items.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center text-muted-foreground">Products coming soon. Add them from the admin dashboard.</div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                className="group glass glow-border rounded-3xl overflow-hidden hover:cyan-glow hover:-translate-y-1 transition-all">
                <div className="aspect-video bg-gradient-to-br from-primary/30 to-accent/30 overflow-hidden">
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    : <div className="w-full h-full grid place-items-center"><ShoppingBag className="size-12 text-accent/60" /></div>}
                </div>
                <div className="p-5">
                  {p.category && <div className="text-[10px] uppercase tracking-widest text-accent mb-1">{p.category}</div>}
                  <h3 className="font-display text-lg font-bold">{p.title}</h3>
                  {p.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="font-display text-xl font-bold text-gradient">
                      {p.price ? `${p.currency || "USD"} ${Number(p.price).toFixed(0)}` : "Free"}
                    </div>
                    <a href={p.gumroad_url || "#"} target="_blank" rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-gradient-primary font-semibold text-sm neon-glow hover:scale-105 transition-transform">
                      Buy Now
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

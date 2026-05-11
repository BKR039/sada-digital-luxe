import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ShoppingBag, ArrowUpRight, Sparkles, Search, Check } from "lucide-react";

interface Product { id: string; title: string; description: string | null; price: number | null; currency: string | null; thumbnail_url: string | null; gumroad_url: string | null; category: string | null }

export const Route = createFileRoute("/store")({
  head: () => ({ meta: [
    { title: "Products — SADA" },
    { name: "description", content: "Premium digital products, brand kits, templates and presets by SADA." },
    { property: "og:title", content: "Products — SADA" },
    { property: "og:description", content: "Tools to level up your brand. Built by working pros." },
  ] }),
  component: Store,
});

function Store() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("All");

  useEffect(() => {
    supabase.from("products").select("*").eq("published", true).order("sort_order")
      .then(({ data }) => { setItems((data as any) || []); setLoading(false); });
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.category && set.add(i.category));
    return ["All", ...Array.from(set)];
  }, [items]);

  const filtered = items.filter((p) =>
    (active === "All" || p.category === active) &&
    (query === "" || p.title.toLowerCase().includes(query.toLowerCase()) || (p.description ?? "").toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <section className="px-4 py-12 md:py-16">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 inline-flex items-center gap-2"><Sparkles className="size-3.5" />PRODUCTS</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.02]">
            Premium tools to <span className="text-gradient">scale your brand.</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            Brand kits, templates, presets and guides — built by working pros, ready to ship today.
          </p>
        </div>

        {/* Filters */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-10 pr-4 py-3 rounded-2xl border border-border bg-card soft-shadow outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                  active === c
                    ? "bg-gradient-primary text-white border-transparent neon-glow"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-[4/5] rounded-3xl border border-border bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-border bg-card p-16 text-center text-muted-foreground soft-shadow">
            No products match your search.
          </div>
        ) : (
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.45 }}
                className="group relative rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {p.thumbnail_url ? (
                    <SmartMedia src={p.thumbnail_url} className="w-full h-full transition-transform duration-700 group-hover:scale-105" autoplay={false} />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
                      <ShoppingBag className="size-12 text-primary/60" />
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  {p.category && <div className="text-[10px] uppercase tracking-widest text-primary mb-1.5">{p.category}</div>}
                  <h3 className="text-lg font-bold">{p.title}</h3>
                  {p.description && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{p.description}</p>}

                  <ul className="mt-4 space-y-1.5">
                    {["Instant download", "Lifetime updates"].map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="size-3.5 text-primary" /> {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 pt-5 border-t border-border flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Price</div>
                      <div className="text-xl font-display font-bold text-foreground">
                        {p.price ? `${p.currency || "USD"} ${Number(p.price).toFixed(0)}` : "Free"}
                      </div>
                    </div>
                    <a
                      href={p.gumroad_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Buy ${p.title}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-primary text-white font-semibold text-sm neon-glow hover:scale-[1.04] transition-transform"
                    >
                      Get it <ArrowUpRight className="size-4" />
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

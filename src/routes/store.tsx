import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ShoppingBag, Sparkles, Search, Check, ArrowRight } from "lucide-react";
import { SADAInput } from "@/components/ui/sada-ui";
import { useI18n } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

interface Product {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  thumbnail_url: string | null;
  gumroad_url: string | null;
  category: string | null;
  featured: boolean;
  sort_order: number;
  includes?: string[] | null;
  features?: string[] | null;
  title_ar?: string | null;
  description_ar?: string | null;
  category_ar?: string | null;
}

export const Route = createFileRoute("/store")({
  loader: async () => {
    try {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true });
      return { initialProducts: (data as any) || [] };
    } catch {
      return { initialProducts: [] };
    }
  },
  head: () => ({ meta: [
    { title: "Products — SADA" },
    { name: "description", content: "Premium digital products, brand kits, templates and presets by SADA." },
    { property: "og:title", content: "Products — SADA" },
    { property: "og:description", content: "Tools to level up your brand. Built by working pros." },
  ] }),
  component: Store,
});

function Store() {
  const { initialProducts } = Route.useLoaderData();
  const { language } = useI18n();
  const isAr = language === "ar";
  const [items, setItems] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>("All");

  useEffect(() => {
    if (!initialProducts || initialProducts.length === 0) {
      supabase
        .from("products")
        .select("*")
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .then(({ data }) => { setItems((data as any) || []); setLoading(false); });
    }
  }, [initialProducts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      const cat = getLocalizedContent(i, "category", language);
      if (cat) set.add(cat);
    });
    return ["All", ...Array.from(set)];
  }, [items, language]);

  const filtered = items.filter((p) => {
    const title = getLocalizedContent(p, "title", language);
    const desc = getLocalizedContent(p, "description", language) ?? "";
    const cat = getLocalizedContent(p, "category", language);
    const matchesCat = active === "All" || cat === active || p.category === active;
    const matchesQuery = query === "" || 
      title.toLowerCase().includes(query.toLowerCase()) || 
      desc.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <section className="px-3.5 sm:px-4 py-10 sm:py-14 md:py-16">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="max-w-3xl">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2.5 sm:mb-3 inline-flex items-center gap-2">
            <Sparkles className="size-3.5" />
            {isAr ? "المنتجات والأدوات الرقمية" : "PRODUCTS"}
          </p>
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold leading-[1.08] font-display tracking-tight text-balance">
            {isAr ? (
              <>أدوات متقدمة <span className="text-gradient">لتسريع نمو علامتك.</span></>
            ) : (
              <>Premium tools to <span className="text-gradient">scale your brand.</span></>
            )}
          </h1>
          <p className="mt-3 sm:mt-4 text-xs sm:text-base md:text-lg text-muted-foreground leading-relaxed">
            {isAr
              ? "حزم الهويات التجارية، القوالب الرقمية، الفلاتر والكتيبات الاستراتيجية — مصممة باحترافية وجاهزة للعمل الفوري."
              : "Brand kits, templates, presets and guides — built by working pros, ready to ship today."}
          </p>
        </div>

        {/* Filters */}
        <div className="mt-6 sm:mt-10 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md w-full">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10 pointer-events-none" />
            <SADAInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? "البحث في المنتجات..." : "Search products…"}
              className="w-full ps-10 pe-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-border bg-card soft-shadow text-start text-xs sm:text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border ${
                  active === c
                    ? "bg-gradient-primary text-white border-transparent neon-glow"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c === "All" && isAr ? "الكل" : c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl sm:rounded-3xl border border-border bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 sm:mt-16 rounded-2xl sm:rounded-3xl border border-border bg-card p-8 sm:p-16 text-center text-muted-foreground soft-shadow font-medium text-sm sm:text-base">
            {isAr ? "لا توجد منتجات تطابق معايير بحثك." : "No products match your search."}
          </div>
        ) : (
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {filtered.map((p, i) => {
              const title = getLocalizedContent(p, "title", language);
              const desc = getLocalizedContent(p, "description", language);
              const cat = getLocalizedContent(p, "category", language);

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.4 }}
                  className="group relative rounded-2xl sm:rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all flex flex-col justify-between"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {p.thumbnail_url ? (
                      <SmartMedia src={p.thumbnail_url} className="w-full h-full transition-transform duration-700 group-hover:scale-105" autoplay={false} />
                    ) : (
                      <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <ShoppingBag className="size-10 sm:size-12 text-primary/60" />
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-6 flex flex-col flex-1">
                    {cat && (
                      <div className="text-[10px] uppercase tracking-widest text-primary mb-1 sm:mb-1.5 font-bold">
                        {cat}
                      </div>
                    )}
                    <h3 className="text-base sm:text-lg font-bold font-display tracking-tight">{title}</h3>
                    {desc && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{desc}</p>}

                    {((p.includes && p.includes.length > 0) || (p.features && p.features.length > 0)) && (
                      <ul className="mt-4 space-y-1.5">
                        {(p.includes && p.includes.length > 0 ? p.includes : p.features || []).slice(0, 2).map((item) => (
                          <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                            <Check className="size-3.5 text-primary shrink-0" /> <span className="truncate">{item}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-5 pt-5 border-t border-border flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          {isAr ? "السعر" : "Price"}
                        </div>
                        <div className="text-xl font-display font-bold text-foreground">
                          {p.price ? (
                            <span dir="ltr">{`${p.currency || "USD"} ${Number(p.price).toFixed(0)}`}</span>
                          ) : (
                            isAr ? "مجاني" : "Free"
                          )}
                        </div>
                      </div>
                      <Link
                        to="/store/$id"
                        params={{ id: p.slug || p.id }}
                        aria-label={`Learn more about ${title}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-primary text-white font-semibold text-sm neon-glow hover:scale-[1.04] transition-transform"
                      >
                        <span>{isAr ? "تفاصيل المنتج" : "Learn more"}</span>
                        <ArrowRight className="size-4 rtl-flip" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

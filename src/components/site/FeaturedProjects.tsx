import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

interface P {
  id: string;
  title: string;
  title_ar?: string | null;
  slug: string;
  client: string | null;
  category: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
}

export function FeaturedProjects() {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("projects")
      .select("id,title,title_ar,slug,client,category,thumbnail_url,cover_url")
      .eq("published", true)
      .eq("featured", true)
      .order("sort_order")
      .limit(6)
      .then(
        ({ data, error }) => {
          if (!active) return;
          setLoading(false);
          if (!error && data && data.length > 0) {
            setItems(data as any);
          }
        },
        () => {
          if (active) setLoading(false);
        }
      );

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="px-4 py-16 md:py-20 relative">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 uppercase">
                {isAr ? "أعمال مختارة" : "FEATURED WORK"}
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.05]">
                {isAr ? (
                  <>أعمال نفخر <span className="text-gradient">بإنجازها</span>.</>
                ) : (
                  <>Projects we're <span className="text-gradient">proud of</span>.</>
                )}
              </h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-3xl border border-border/40 bg-card/40 overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-muted/40" />
                <div className="p-5">
                  <div className="h-3 bg-muted/30 rounded w-1/3 mb-2" />
                  <div className="h-5 bg-muted/40 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 relative">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-6 sm:mb-10">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
              {isAr ? "أعمال مختارة" : "FEATURED WORK"}
            </p>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold leading-[1.08] tracking-tight">
              {isAr ? (
                <>أعمال نفخر <span className="text-gradient">بإنجازها</span>.</>
              ) : (
                <>Projects we're <span className="text-gradient">proud of</span>.</>
              )}
            </h2>
          </div>
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary hover:gap-2.5 transition-all"
          >
            {isAr ? "عرض جميع المشاريع" : "View all"}{" "}
            <ArrowRight className="size-3.5 sm:size-4 rtl-flip" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {items.map((p, i) => {
            const localizedTitle = getLocalizedContent(p, "title", language);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: Math.min(i, 5) * 0.04, duration: 0.4 }}
              >
                <Link
                  to="/case-studies/$slug"
                  params={{ slug: p.slug }}
                  className="group block rounded-2xl sm:rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {p.thumbnail_url || p.cover_url ? (
                      <SmartMedia
                        src={p.thumbnail_url || p.cover_url}
                        className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                        autoplay={false}
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-5xl sm:text-7xl font-display font-bold text-gradient">
                        {localizedTitle.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 sm:p-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {p.category && (
                        <div className="text-[10px] uppercase tracking-widest text-primary mb-1 font-bold">
                          {p.category}
                        </div>
                      )}
                      <h3 className="text-base sm:text-lg font-bold truncate tracking-tight">{localizedTitle}</h3>
                      {p.client && (
                        <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                          {p.client}
                        </div>
                      )}
                    </div>
                    <ArrowUpRight className="size-4 sm:size-5 text-primary shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl-flip transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

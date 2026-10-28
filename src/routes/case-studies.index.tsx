import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

async function fetchPublishedProjects(): Promise<Project[]> {
  const { data, error } = await (supabase as any)
    .from("projects")
    .select("id,title,slug,client,industry,category,description,cover_url,thumbnail_url,services,project_date,title_ar,description_ar,client_ar,industry_ar,category_ar")
    .eq("published", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) {
    // Graceful backward-compatible fallback for schemas prior to migration 20261018200000
    const { data: fallbackData } = await (supabase as any)
      .from("projects")
      .select("id,title,slug,client,industry,category,description,cover_url,thumbnail_url,services,project_date,title_ar,description_ar")
      .eq("published", true)
      .order("sort_order")
      .order("created_at", { ascending: false });
    return (fallbackData as Project[]) || [];
  }
  return (data as Project[]) || [];
}

export const Route = createFileRoute("/case-studies/")({
  loader: async () => {
    const projects = await fetchPublishedProjects();
    return { projects };
  },
  head: () => ({
    meta: [
      { title: "Case Studies — Selected Work | SADA" },
      {
        name: "description",
        content:
          "Explore selected SADA projects across marketing, branding, development and creative production.",
      },
      { property: "og:title", content: "Case Studies — Selected Work | SADA" },
      {
        property: "og:description",
        content:
          "Explore selected SADA projects across marketing, branding, development and creative production.",
      },
      { property: "og:url", content: "/case-studies" },
    ],
    links: [{ rel: "canonical", href: "/case-studies" }],
  }),
  component: CaseStudiesIndex,
});

interface Project {
  id: string;
  title: string;
  slug: string;
  client: string | null;
  industry: string | null;
  category: string | null;
  description: string | null;
  cover_url: string | null;
  thumbnail_url: string | null;
  services: string[] | null;
  project_date: string | null;
  title_ar?: string | null;
  description_ar?: string | null;
  client_ar?: string | null;
  industry_ar?: string | null;
  category_ar?: string | null;
}

function CaseStudiesIndex() {
  const loaderData = Route.useLoaderData();
  const { language } = useI18n();
  const isAr = language === "ar";
  const [items, setItems] = useState<Project[]>(loaderData?.projects || []);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(!loaderData?.projects || loaderData.projects.length === 0);

  useEffect(() => {
    let active = true;
    fetchPublishedProjects().then((data) => {
      if (!active) return;
      if (data) {
        setItems(data);
      }
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const cats = useMemo(
    () => Array.from(new Set(items.map((i) => getLocalizedContent(i, "category", language)).filter(Boolean) as string[])),
    [items, language],
  );
  const showFilters = items.length > 4 && cats.length > 1;
  const filtered = !showFilters || filter === "All" 
    ? items 
    : items.filter((i) => getLocalizedContent(i, "category", language) === filter || i.category === filter);

  return (
    <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl">
        <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3">
          {isAr ? "سابقة الأعمال المختارة" : "SELECTED WORK"}
        </p>
        <h1 className="font-display text-2xl sm:text-4xl md:text-6xl font-bold leading-[1.08] tracking-tight max-w-3xl">
          {isAr ? "مشاريع صُممت لحل تحديات تجارية حقيقية." : "Work built around real business problems."}
        </h1>
        <p className="mt-3 sm:mt-4 text-xs sm:text-base text-muted-foreground max-w-xl">
          {isAr
            ? "تشكيلة منتقاة من العلامات التجارية، الحملات الإعلانية، التجارب الرقمية والمشاريع الإبداعية التي صاغتها صدى."
            : "A selection of brands, campaigns, digital experiences and creative projects shaped by SADA."}
        </p>

        {showFilters && (
          <div className="mt-6 sm:mt-10 flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilter("All")}
              className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border ${
                filter === "All"
                  ? "bg-gradient-primary text-white border-transparent neon-glow"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {isAr ? "الكل" : "All"}
            </button>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border ${
                  filter === c
                    ? "bg-gradient-primary text-white border-transparent neon-glow"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-2xl sm:rounded-3xl border border-border bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 sm:mt-16 rounded-2xl sm:rounded-3xl border border-border bg-card p-6 sm:p-12 text-center soft-shadow max-w-2xl mx-auto">
            <p className="text-lg sm:text-xl font-bold font-display">
              {isAr ? "سابقة الأعمال المختارة ستتاح قريباً." : "Selected work is coming soon."}
            </p>
            <p className="mt-2 text-xs sm:text-base text-muted-foreground leading-relaxed">
              {isAr
                ? "نقوم حالياً بإعداد دراسات حالة واقعية للمشاريع التي قمنا بتسليمها. في هذه الأثناء، شاركنا أهدافك وتطلعاتك."
                : "We're preparing real case studies from projects we've shipped. In the meantime, tell us about your goals."}
            </p>
            <Link
              to="/contact"
              className="mt-6 inline-flex items-center gap-2 bg-gradient-primary text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold neon-glow hover:scale-[1.02] transition-transform text-xs sm:text-sm"
            >
              <span>{isAr ? "ابدأ مشروعك" : "Start a Project"}</span>
              <ArrowRight className="size-4 rtl-flip" />
            </Link>
          </div>
        ) : (
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
            {filtered.map((p, i) => {
              const year = p.project_date ? new Date(p.project_date).getFullYear() : null;
              const title = getLocalizedContent(p, "title", language);
              const client = getLocalizedContent(p, "client", language);
              const description = getLocalizedContent(p, "description", language);
              const industry = getLocalizedContent(p, "industry", language);
              const displayName = client || title;
              const subTitle = client ? title : null;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.4 }}
                  className="h-full flex"
                >
                  <Link
                    to="/case-studies/$slug"
                    params={{ slug: p.slug }}
                    className="group flex flex-col w-full rounded-2xl sm:rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all cursor-pointer"
                  >
                    {/* Project Thumbnail / Cover */}
                    <div className="aspect-[16/10] overflow-hidden bg-muted relative">
                      {p.thumbnail_url || p.cover_url ? (
                        <SmartMedia
                          src={p.thumbnail_url || p.cover_url}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          autoplay={false}
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-5xl sm:text-6xl font-display font-bold text-gradient bg-gradient-to-br from-primary/15 to-accent/15">
                          {displayName.charAt(0)}
                        </div>
                      )}

                      {year && (
                        <span dir="ltr" className="absolute top-2.5 end-2.5 sm:top-3 sm:end-3 text-[10px] sm:text-[11px] font-mono px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-background/80 backdrop-blur-md text-foreground border border-border/50">
                          {year}
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="p-4 sm:p-6 flex flex-col flex-1">
                      {/* Industry Eyebrow */}
                      {industry && (
                        <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary mb-1.5 sm:mb-2">
                          {industry}
                        </div>
                      )}

                      {/* Client & Title */}
                      <h2 className="font-display text-base sm:text-xl font-bold leading-snug group-hover:text-primary transition-colors tracking-tight">
                        {displayName}
                      </h2>
                      {subTitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium line-clamp-1">
                          {subTitle}
                        </p>
                      )}

                      {/* Short Description */}
                      {description && (
                        <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                          {description}
                        </p>
                      )}

                      {/* Service / Category Tags */}
                      <div className="mt-auto pt-4">
                        {p.services && p.services.length > 0 && (
                          <div className="text-xs text-muted-foreground font-medium flex flex-wrap items-center gap-1.5 mb-3">
                            {p.services.slice(0, 3).map((s, sIdx) => (
                              <span key={s} className="inline-flex items-center">
                                {sIdx > 0 && <span className="mx-1 text-muted-foreground/40">·</span>}
                                {s}
                              </span>
                            ))}
                            {p.services.length > 3 && (
                              <span className="text-[11px] text-muted-foreground/70">
                                +{p.services.length - 3} {isAr ? "إضافية" : "more"}
                              </span>
                            )}
                          </div>
                        )}

                        {/* CTA Link */}
                        <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                          <span>{isAr ? "استعراض دراسة الحالة" : "View Case Study"}</span>
                          <ArrowRight className="size-4 rtl-flip" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SmartMedia } from "@/components/media/SmartMedia";
import { CTA } from "@/components/site/CTA";
import { supabase } from "@/integrations/supabase/client";
import {
  DIVISIONS,
  SCENARIOS,
  PROCESS,
  getLocalizedDivisions,
  getLocalizedScenarios,
  getLocalizedProcess,
} from "@/data/services";
import { ArrowRight, ArrowUpRight, Sparkles, Plus } from "lucide-react";
import { useTranslation } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

interface WorkItem {
  id: string;
  title: string;
  title_ar?: string | null;
  slug: string;
  client: string | null;
  category: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  services: string[] | null;
}

export const Route = createFileRoute("/services")({
  loader: async () => {
    try {
      const { data } = await (supabase as any)
        .from("projects")
        .select("id,title,title_ar,slug,client,category,thumbnail_url,cover_url,services")
        .eq("published", true)
        .eq("featured", true)
        .order("sort_order")
        .limit(3);
      return { featuredProjects: (data as WorkItem[]) || [] };
    } catch {
      return { featuredProjects: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Services — Marketing, Development & Production | SADA" },
      {
        name: "description",
        content:
          "Explore SADA services across marketing, branding, web development and creative production — connected under one strategy to help businesses build and grow.",
      },
      { property: "og:title", content: "Services — Marketing, Development & Production | SADA" },
      {
        property: "og:description",
        content:
          "Explore SADA services across marketing, branding, web development and creative production — connected under one strategy to help businesses build and grow.",
      },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const divisions = getLocalizedDivisions(language);
  const scenarios = getLocalizedScenarios(language);
  const process = getLocalizedProcess(language);

  return (
    <>
      {/* HERO */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] sm:text-xs font-bold text-primary tracking-[0.3em] mb-2.5 sm:mb-3 inline-flex items-center gap-2 justify-center uppercase">
            <Sparkles className="size-3.5" /> {isAr ? "ما نقوم به" : "WHAT WE DO"}
          </p>
          <h1 className="font-display text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight text-balance">
            {isAr ? (
              <>كل ما تحتاجه علامتك. <span className="text-gradient">تحت رؤية استراتيجية واحدة.</span></>
            ) : (
              <>Everything your brand needs. <span className="text-gradient">Under one vision.</span></>
            )}
          </h1>
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {isAr
              ? "استراتيجية، تقنية وإنتاج سينمائي تعمل بتناغم لصناعة علامات تجارية أقوى وتجارب رقمية استثنائية."
              : "Strategy, technology and production working together to build stronger brands and digital experiences."}
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center items-stretch sm:items-center">
            <Link
              to="/contact"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-primary text-white px-6 py-3 rounded-xl sm:rounded-2xl font-semibold neon-glow hover:scale-[1.02] transition-transform text-sm sm:text-base"
            >
              {isAr ? "ابدأ مشروعك" : "Start a Project"}
              <ArrowRight className="size-4 group-hover:translate-x-1 rtl-flip group-hover:rtl:-translate-x-1 transition-transform" />
            </Link>
            <a
              href="#divisions"
              className="inline-flex items-center justify-center gap-2 bg-card border border-border text-foreground px-6 py-3 rounded-xl sm:rounded-2xl font-semibold hover:bg-muted transition-colors soft-shadow text-sm sm:text-base"
            >
              {isAr ? "استكشف الخدمات" : "Explore Services"}
            </a>
          </div>
        </div>
      </section>

      {/* THREE DIVISIONS — editorial, not cards */}
      <section id="divisions" className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 scroll-mt-24">
        <div className="mx-auto max-w-5xl divide-y divide-border border-t border-b border-border">
          {divisions.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="py-8 sm:py-10 md:py-12 grid md:grid-cols-[auto_1fr] gap-4 sm:gap-6 md:gap-10 items-start"
            >
              <div className="flex items-center gap-3 sm:gap-4 md:flex-col md:items-start">
                <span className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-muted-foreground/30">{d.number}</span>
                <div className="size-10 sm:size-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary">
                  <d.icon className="size-5" />
                </div>
              </div>
              <div>
                <h2 className="font-display text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">{d.name.toUpperCase()}</h2>
                <p className="mt-2 sm:mt-3 text-sm sm:text-lg text-muted-foreground max-w-xl leading-relaxed">{d.oneLiner}</p>
                <p className="mt-3.5 sm:mt-5 text-xs sm:text-sm text-foreground/80 leading-relaxed sm:leading-loose">
                  {d.services.join(" · ")}
                </p>
                <a
                  href={`#${d.id}`}
                  className="mt-4 sm:mt-6 inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-primary hover:gap-3 transition-all"
                >
                  {d.exploreCta} <ArrowRight className="size-3.5 sm:size-4 rtl-flip" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CLIENT PROBLEM / SCENARIOS */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
              {isAr ? "أين أنت اليوم" : "WHERE ARE YOU TODAY"}
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">
              {isAr ? "ما الذي تحتاجه أعمالك في هذه المرحلة؟" : "What does your business need right now?"}
            </h2>
          </div>
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 gap-3.5 sm:gap-5">
            {scenarios.map((s, i) => (
              <motion.div
                key={s.number}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                className="rounded-2xl border border-border bg-card p-4 sm:p-6 md:p-7 soft-shadow hover:elevated-shadow transition-shadow flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] sm:text-xs font-bold tracking-widest text-primary">{s.number}</span>
                  <h3 className="mt-1.5 sm:mt-2 text-base sm:text-lg font-bold leading-snug">{s.question}</h3>
                  <p className="mt-2.5 sm:mt-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.combination.join(" · ")}</p>
                </div>
                <Link
                  to="/contact"
                  className="mt-4 sm:mt-6 inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-primary hover:gap-3 transition-all"
                >
                  {s.cta} <ArrowRight className="size-3.5 sm:size-4 rtl-flip" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY SADA — INTEGRATED SYSTEM */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20">
        <div className="mx-auto max-w-6xl rounded-2xl sm:rounded-3xl glass-strong p-5 sm:p-10 md:p-14">
          <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
            {isAr ? "لماذا صدى" : "WHY SADA"}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold max-w-2xl tracking-tight">
            {isAr ? "تخصصات متعددة. اتجاه استراتيجي واحد." : "Different disciplines. One direction."}
          </h2>
          <div className="mt-4 sm:mt-6 max-w-2xl space-y-2.5 sm:space-y-3 text-xs sm:text-base text-muted-foreground leading-relaxed">
            <p>
              {isAr
                ? "العلامات التجارية الراسخة لا تُبنى بتخصص واحد بمعزل عن الآخر."
                : "Strong brands are rarely built by one discipline alone."}
            </p>
            <p>
              {isAr
                ? "استراتيجيتك تحدد هويتك، وهويتك توجه محتواك، ومحتواك يقود تسويقك، وتجربتك الرقمية تحسم معدل التحويل."
                : "Your strategy affects your identity. Your identity affects your content. Your content affects your marketing. Your digital experience affects conversion."}
            </p>
            <p>
              {isAr
                ? "في صدى، نربط بين هذه القرارات الحيوية بدلاً من التعامل معها كمشاريع منفصلة ومجزأة."
                : "SADA connects these decisions instead of treating them as separate projects."}
            </p>
          </div>
          <div className="mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-border flex flex-wrap items-center gap-2 sm:gap-3 md:gap-5">
            {divisions.map((d, i) => (
              <span key={d.id} className="inline-flex items-center gap-2 sm:gap-3 md:gap-5">
                <span className="font-display text-base sm:text-xl md:text-2xl font-bold text-gradient">{d.name.toUpperCase()}</span>
                {i < divisions.length - 1 && <span className="text-muted-foreground text-sm sm:text-lg">×</span>}
              </span>
            ))}
            <ArrowRight className="size-4 sm:size-5 text-primary mx-0.5 sm:mx-1 rtl-flip" />
            <span className="font-display text-base sm:text-xl md:text-2xl font-bold">
              {isAr ? "منظومة متكاملة واحدة" : "ONE CONNECTED SYSTEM"}
            </span>
          </div>
        </div>
      </section>

      {/* DIVISION DETAIL SECTIONS */}
      {divisions.map((d, i) => (
        <section
          key={d.id}
          id={d.id}
          className={`px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 scroll-mt-24 ${i % 2 === 1 ? "bg-gradient-soft" : ""}`}
        >
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-3">
              <div className="size-9 sm:size-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary">
                <d.icon className="size-4 sm:size-5" />
              </div>
              <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary uppercase">{d.number} · {d.name.toUpperCase()}</p>
            </div>
            <h2 className="mt-4 sm:mt-5 text-2xl sm:text-3xl md:text-4xl font-bold max-w-2xl tracking-tight">{d.detail.heading}</h2>
            <p className="mt-3 sm:mt-4 text-xs sm:text-base text-muted-foreground max-w-2xl leading-relaxed">{d.detail.problem}</p>

            <div className="mt-6 sm:mt-10 grid md:grid-cols-2 gap-6 sm:gap-8">
              <div>
                <h3 className="text-[11px] sm:text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  {isAr ? "ما تقدمه صدى" : "WHAT SADA PROVIDES"}
                </h3>
                <ul className="mt-3 sm:mt-4 space-y-2 sm:space-y-2.5">
                  {d.detail.provides.map((item) => (
                    <li key={item} className="text-xs sm:text-sm text-foreground/90 border-b border-border/60 pb-2 sm:pb-2.5">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[11px] sm:text-xs font-bold tracking-widest text-muted-foreground uppercase">
                  {isAr ? "المخرجات المتوقعة" : "POSSIBLE DELIVERABLES"}
                </h3>
                <ul className="mt-3 sm:mt-4 space-y-2 sm:space-y-2.5">
                  {d.detail.deliverables.map((item) => (
                    <li key={item} className="text-xs sm:text-sm text-muted-foreground border-b border-border/60 pb-2 sm:pb-2.5">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Link
              to="/contact"
              className="mt-6 sm:mt-10 inline-flex items-center justify-center gap-2 bg-gradient-primary text-white px-6 py-3 rounded-xl sm:rounded-2xl font-semibold neon-glow hover:scale-[1.02] transition-transform text-xs sm:text-sm w-full sm:w-auto"
            >
              {d.detail.cta} <ArrowRight className="size-4 rtl-flip" />
            </Link>
          </div>
        </section>
      ))}

      {/* HOW WE WORK */}
      <section className="px-3.5 sm:px-4 py-12 sm:py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-primary mb-2 sm:mb-3 uppercase">
              {isAr ? "كيف نعمل" : "HOW WE WORK"}
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">
              {isAr ? "منهجية واضحة في خمس خطوات مدروسة." : "A simple, five-step process."}
            </h2>
          </div>
          <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-5">
            {process.map((s) => (
              <div key={s.number} className="rounded-2xl border border-border bg-card p-4 sm:p-6 soft-shadow flex flex-col justify-between">
                <div>
                  <div className="text-[11px] sm:text-xs font-bold tracking-widest text-primary">{s.number}</div>
                  <div className="mt-1.5 sm:mt-2 text-base sm:text-lg font-bold">{s.name}</div>
                  <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CROSS-SERVICE PROJECTS */}
      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 uppercase">
            {isAr ? "مشاريع متكاملة التخصصات" : "CROSS-SERVICE PROJECTS"}
          </p>
          <h2 className="text-3xl md:text-5xl font-bold max-w-2xl">
            {isAr ? "المشروع الواحد قد يتطلب تضافر أكثر من تخصص." : "One project can need more than one discipline."}
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl">
            {isAr ? "إطلاق علامة تجارية متكاملة يشمل عادة:" : "A brand launch could involve:"}
          </p>

          <div className="mt-10 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {[
              { d: divisions[0], contribution: isAr ? "التموضع + الاستراتيجية" : "Positioning + Strategy" },
              { d: divisions[1], contribution: isAr ? "الموقع الإلكتروني" : "Website" },
              { d: divisions[2], contribution: isAr ? "حملة الإطلاق" : "Launch Campaign" },
            ].map(({ d, contribution }, i, arr) => (
              <div key={d.id} className="flex items-center gap-4 md:contents">
                <div className="flex-1 rounded-2xl border border-border bg-card p-6 soft-shadow">
                  <div className="flex items-center gap-2.5 text-primary">
                    <d.icon className="size-4" />
                    <span className="text-xs font-bold tracking-widest">{d.name.toUpperCase()}</span>
                  </div>
                  <div className="mt-2 font-semibold">{contribution}</div>
                </div>
                {i < arr.length - 1 && (
                  <Plus className="size-5 text-muted-foreground shrink-0 hidden md:block" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SelectedWork />

      {/* FINAL CTA */}
      <CTA
        title={isAr ? "لست متأكداً أي خدمة تناسبك؟" : "Not sure which service you need?"}
        subtitle={
          isAr
            ? "أخبرنا أين تقف أعمالك اليوم وإلى أين تطمح للوصول. سنرسم معك الاتجاه الصحيح ونقترح الخطة الأنسب."
            : "Tell us where your business is today and where you want to take it. We'll help define the right direction."
        }
        primaryLabel={isAr ? "ابدأ مشروعك" : "Start a Project"}
        primaryTo="/contact"
        secondaryLabel={isAr ? "تواصل مع صدى" : "Contact SADA"}
        secondaryTo="/contact"
      />
    </>
  );
}

function SelectedWork() {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const loaderData = Route.useLoaderData() as { featuredProjects?: WorkItem[] } | undefined;
  const initialItems = loaderData?.featuredProjects || [];
  const [items, setItems] = useState<WorkItem[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);

  useEffect(() => {
    if (initialItems.length > 0) {
      setItems(initialItems);
      setLoading(false);
      return;
    }
    let active = true;
    (supabase as any)
      .from("projects")
      .select("id,title,title_ar,slug,client,category,thumbnail_url,cover_url,services")
      .eq("published", true)
      .eq("featured", true)
      .order("sort_order")
      .limit(3)
      .then(
        ({ data, error }: { data: WorkItem[] | null; error: any }) => {
          if (!active) return;
          setLoading(false);
          if (!error && data && data.length > 0) {
            setItems(data);
          }
        },
        () => {
          if (active) setLoading(false);
        }
      );

    return () => {
      active = false;
    };
  }, [initialItems]);

  if (loading) {
    return (
      <section className="px-4 py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 uppercase">
                {isAr ? "أعمال مختارة" : "SELECTED WORK"}
              </p>
              <h2 className="text-3xl md:text-5xl font-bold">
                {isAr ? "شاهد التجربة على أرض الواقع." : "See it in practice."}
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
    <section className="px-4 py-16 md:py-20 bg-gradient-soft">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 uppercase">
              {isAr ? "أعمال مختارة" : "SELECTED WORK"}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold">
              {isAr ? "شاهد التجربة على أرض الواقع." : "See it in practice."}
            </h2>
          </div>
          <Link
            to="/case-studies"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all"
          >
            {isAr ? "عرض جميع الأعمال" : "View all work"}{" "}
            <ArrowRight className="size-4 rtl-flip" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p: WorkItem, i: number) => {
            const localizedTitle = getLocalizedContent(p, "title", language);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
              >
                <Link
                  to="/case-studies/$slug"
                  params={{ slug: p.slug }}
                  className="group block rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {p.thumbnail_url || p.cover_url ? (
                      <SmartMedia
                        src={p.thumbnail_url || p.cover_url}
                        className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                        autoplay={false}
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-6xl font-display font-bold text-gradient bg-gradient-to-br from-primary/15 to-accent/15">
                        {localizedTitle.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {p.client && <div className="text-sm text-muted-foreground">{p.client}</div>}
                    <h3 className="mt-1 font-bold group-hover:text-primary transition-colors">{localizedTitle}</h3>
                    {p.services && p.services.length > 0 && (
                      <p className="mt-2 text-xs text-primary font-medium">{p.services.slice(0, 3).join(" · ")}</p>
                    )}
                    <div className="mt-4 text-sm font-semibold text-primary inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                      {isAr ? "عرض دراسة الحالة" : "View Case Study"}{" "}
                      <ArrowUpRight className="size-3.5 rtl-flip" />
                    </div>
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

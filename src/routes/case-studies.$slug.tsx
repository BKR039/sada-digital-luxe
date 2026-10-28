import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { MediaGallery } from "@/components/media/MediaGallery";
import { CTA } from "@/components/site/CTA";
import { ArrowLeft, ExternalLink, Calendar, ArrowRight, Target, Flag, Lightbulb, Layers, Quote, Users, Eye } from "lucide-react";
import { useI18n } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";
import { useAuth } from "@/lib/auth";
import { BlogReadingEnhancer } from "@/components/site/BlogReadingEnhancer";

interface Metric {
  value: string;
  label: string;
  source?: string;
  period?: string;
}

interface Testimonial {
  quote: string;
  name: string;
  role?: string;
}

interface TeamMemberPublic {
  id: string;
  name: string;
  position: string | null;
  division: string | null;
  photo_url: string | null;
  socials: Record<string, string> | null;
  position_ar?: string | null;
  bio_ar?: string | null;
}

interface ProjectRow {
  id: string;
  slug: string;
  title: string;
  client: string | null;
  industry: string | null;
  category: string | null;
  description: string | null;
  cover_url: string | null;
  thumbnail_url: string | null;
  gallery: string[] | null;
  services: string[] | null;
  project_date: string | null;
  external_url: string | null;
  challenge: string | null;
  objective: string | null;
  strategy: string | null;
  process: string | null;
  deliverables: string[] | null;
  results: string | null;
  metrics: Metric[] | null;
  before_url: string | null;
  after_url: string | null;
  testimonial: Testimonial | null;
  team_member_ids: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number;
  published: boolean;
  title_ar?: string | null;
  description_ar?: string | null;
  client_ar?: string | null;
  industry_ar?: string | null;
  category_ar?: string | null;
  challenge_ar?: string | null;
  objective_ar?: string | null;
  strategy_ar?: string | null;
  process_ar?: string | null;
  results_ar?: string | null;
  seo_title_ar?: string | null;
  seo_description_ar?: string | null;
}

interface CaseStudySearchParams {
  preview?: boolean;
}

async function fetchProject(slug: string, isPreview = false): Promise<ProjectRow | null> {
  let query = (supabase as any)
    .from("projects")
    .select("*")
    .eq("slug", slug);

  if (!isPreview) {
    query = query.eq("published", true);
  }

  const { data } = await query.maybeSingle();
  return data || null;
}

async function fetchTeamMembers(ids: string[]): Promise<TeamMemberPublic[]> {
  if (!ids || ids.length === 0) return [];
  const { data, error } = await (supabase as any)
    .from("public_team_members")
    .select("id, name, position, division, photo_url, socials, position_ar, bio_ar")
    .in("id", ids);

  if (error) {
    console.error("[CaseStudy] Failed to fetch team members from public_team_members view:", error);
    return [];
  }
  return (data as TeamMemberPublic[]) || [];
}

/**
 * CASE STUDY -> TESTIMONIAL is a reference, not a copy.
 * `testimonials` is the canonical home of a client quote; a case study links to
 * it via testimonials.project_id. The legacy `projects.testimonial` jsonb is kept
 * only as a fallback for records created before that relationship existed.
 */
async function fetchLinkedTestimonial(projectId: string): Promise<Testimonial | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("testimonials")
      .select("client_name, company, role, review, short_quote")
      .eq("project_id", projectId)
      .eq("published", true)
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      quote: data.short_quote || data.review,
      name: data.client_name,
      role: [data.role, data.company].filter(Boolean).join(", ") || undefined,
    };
  } catch {
    return null;
  }
}

interface NextProject {
  slug: string;
  title: string;
  client: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  title_ar?: string | null;
  client_ar?: string | null;
}

async function fetchNextProject(afterSortOrder: number): Promise<NextProject | null> {
  const { data } = await (supabase as any)
    .from("projects")
    .select("slug,title,client,thumbnail_url,cover_url,title_ar,client_ar")
    .eq("published", true)
    .gt("sort_order", afterSortOrder)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  return data || null;
}

export const Route = createFileRoute("/case-studies/$slug")({
  validateSearch: (search: Record<string, unknown>): CaseStudySearchParams => ({
    preview: search.preview === "true" || search.preview === true || undefined,
  }),
  loader: async ({ params }) => {
    // In TanStack Start loader, search params can be read via URL or window in client
    const isPreview = typeof window !== "undefined" && window.location.search.includes("preview=true");
    const project = await fetchProject(params.slug, isPreview);
    const [next, teamMembers, linkedTestimonial] = await Promise.all([
      project ? fetchNextProject(project.sort_order) : null,
      project?.team_member_ids?.length ? fetchTeamMembers(project.team_member_ids) : Promise.resolve([]),
      project ? fetchLinkedTestimonial(project.id) : Promise.resolve(null),
    ]);
    return { project, next, teamMembers, linkedTestimonial };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.project;
    if (!p) {
      return { meta: [{ title: "Case study not found — SADA" }] };
    }
    const title = p.seo_title || (p.client ? `${p.title} — ${p.client} | SADA` : `${p.title} | SADA`);
    const description = p.seo_description || p.description || `A case study by SADA${p.industry ? ` in ${p.industry}` : ""}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(p.cover_url ? [{ property: "og:image", content: p.cover_url }] : []),
        { property: "og:url", content: `/case-studies/${p.slug}` },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: `/case-studies/${p.slug}` }],
    };
  },
  component: CaseStudyDetail,
});

function AnimatedNumber({ value }: { value: string }) {
  const match = value.match(/^([+-]?)(\d+(?:\.\d+)?)(.*)$/);
  const [display, setDisplay] = useState(match ? "0" : value);
  useEffect(() => {
    if (!match) return;
    const target = parseFloat(match[2]);
    const suffix = match[3];
    const prefix = match[1];
    const duration = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = (target * eased).toFixed(target % 1 === 0 ? 0 : 1);
      setDisplay(`${prefix}${cur}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{display}</span>;
}

function CaseStudyDetail() {
  const loaderData = Route.useLoaderData();
  const params = Route.useParams();
  const search = Route.useSearch();
  const isPreview = search.preview;
  const { language } = useI18n();
  const isAr = language === "ar";
  const { user, isAdmin } = useAuth();

  const [p, setP] = useState<ProjectRow | null>(loaderData?.project || null);
  const [loading, setLoading] = useState(!loaderData?.project);

  useEffect(() => {
    let active = true;
    if (!loaderData?.project) {
      setLoading(true);
      fetchProject(params.slug, isPreview)
        .then((data) => {
          if (!active) return;
          setP(data);
          setLoading(false);
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    } else {
      setP(loaderData.project);
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [loaderData?.project, params.slug, isPreview]);

  const next = loaderData?.next;
  const teamMembers = loaderData?.teamMembers || [];
  const linkedTestimonial = loaderData?.linkedTestimonial;

  // Canonical record wins; the embedded copy is only a fallback.
  const testimonial = linkedTestimonial || p?.testimonial || null;

  if (loading) {
    return (
      <div className="px-4 py-16 md:py-24 max-w-5xl mx-auto animate-pulse">
        <div className="h-4 w-32 bg-muted/40 rounded mb-4" />
        <div className="h-10 w-3/4 bg-muted/50 rounded mb-6" />
        <div className="h-5 w-1/2 bg-muted/30 rounded mb-10" />
        <div className="aspect-[16/9] w-full rounded-3xl bg-muted/40" />
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold font-display">
            {isAr ? "دراسة الحالة غير موجودة" : "Case study not found"}
          </h1>
          <Link to="/case-studies" className="mt-6 inline-flex items-center gap-2 text-primary font-medium">
            <ArrowLeft className="size-4 rtl-flip" />
            <span>{isAr ? "الرجوع إلى سابقة الأعمال" : "Back to case studies"}</span>
          </Link>
        </div>
      </div>
    );
  }

  const gallery = Array.isArray(p.gallery) ? p.gallery : [];
  const metrics = Array.isArray(p.metrics) ? p.metrics : [];
  const deliverables = Array.isArray(p.deliverables) ? p.deliverables : [];
  const services = Array.isArray(p.services) ? p.services : [];
  const year = p.project_date ? new Date(p.project_date).getFullYear() : null;

  const title = getLocalizedContent(p, "title", language);
  const client = getLocalizedContent(p, "client", language);
  const description = getLocalizedContent(p, "description", language);
  const industry = getLocalizedContent(p, "industry", language);
  const challenge = getLocalizedContent(p, "challenge", language);
  const objective = getLocalizedContent(p, "objective", language);
  const strategy = getLocalizedContent(p, "strategy", language);
  const process = getLocalizedContent(p, "process", language);
  const results = getLocalizedContent(p, "results", language);
  const hasResults = metrics.length > 0 || !!results;

  return (
    <article className="px-3.5 sm:px-4 py-8 sm:py-12 md:py-20">
      <BlogReadingEnhancer slug={`case-${p.slug}`} title={title} />
      <div className="mx-auto max-w-6xl">
        {isPreview && (
          <div className="mb-6 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
              <Eye className="size-4 text-amber-500 shrink-0" />
              <span>
                <strong>{isAr ? "وضع المعاينة" : "Preview Mode"}</strong> —{" "}
                {p.published
                  ? isAr
                    ? "معاينة دراسة الحالة المنشورة مباشرة"
                    : "Viewing live published case study"
                  : isAr
                  ? "معاينة مسودة غير منشورة"
                  : "Viewing unpublished draft"}
              </span>
            </div>
            {user && isAdmin && (
              <Link
                to="/admin"
                className="text-xs font-semibold px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 transition-colors inline-flex items-center gap-1.5 self-end sm:self-auto"
              >
                <span>{isAr ? "العودة إلى مساحة العمل" : "Back to Work OS"}</span>
                <ArrowRight className="size-3.5 rtl-flip" />
              </Link>
            )}
          </div>
        )}

        <Link to="/case-studies" className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-primary mb-6 sm:mb-8 font-medium">
          <ArrowLeft className="size-4 rtl-flip" />
          <span>{isAr ? "الرجوع إلى سابقة الأعمال" : "Back to case studies"}</span>
        </Link>

        {/* 01 — HERO */}
        {industry && (
          <p className="text-[11px] sm:text-xs font-bold text-primary tracking-[0.3em] mb-2 sm:mb-3">
            {industry.toUpperCase()}
          </p>
        )}
        {client && <h1 className="font-display text-2xl sm:text-3xl md:text-5xl font-bold leading-[1.08] tracking-tight">{client}</h1>}
        <p className={client ? "mt-1.5 sm:mt-2 text-base sm:text-xl md:text-2xl text-muted-foreground font-medium" : "font-display text-2xl sm:text-3xl md:text-5xl font-bold leading-[1.08] tracking-tight"}>
          {title}
        </p>

        <div className="mt-4 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          {year && (
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Calendar className="size-3.5" /> <span dir="ltr">{year}</span>
            </span>
          )}
          {p.external_url && (
            <a href={p.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium">
              <span>{isAr ? "زيارة الموقع الحي" : "Visit live"}</span>
              <ExternalLink className="size-3.5 rtl-flip" />
            </a>
          )}
        </div>

        {services.length > 0 && (
          <div className="mt-4 sm:mt-5 flex flex-wrap gap-1.5 sm:gap-2">
            {services.map((s) => (
              <span key={s} className="text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-primary/10 text-primary font-medium">
                {s}
              </span>
            ))}
          </div>
        )}

        {(p.cover_url || p.thumbnail_url) && (
          <div className="mt-6 sm:mt-10 rounded-2xl sm:rounded-3xl overflow-hidden elevated-shadow">
            <SmartMedia src={p.cover_url || p.thumbnail_url} fit="cover" className="w-full max-h-[70vh] aspect-video" loading="eager" autoplay={false} />
          </div>
        )}

        <div className="mt-10 sm:mt-16 max-w-3xl space-y-8 sm:space-y-12">
          {/* 02 — OVERVIEW */}
          {description && (
            <section>
              <p className="text-sm sm:text-lg leading-relaxed text-foreground/90 whitespace-pre-line">{description}</p>
            </section>
          )}

          {/* 03 — CHALLENGE */}
          {challenge && <CaseSection icon={<Target className="size-4" />} title={isAr ? "التحدي" : "The Challenge"} body={challenge} />}

          {/* 04 — OBJECTIVE */}
          {objective && <CaseSection icon={<Flag className="size-4" />} title={isAr ? "الهدف المنشود" : "The Objective"} body={objective} />}

          {/* 05 — STRATEGY */}
          {strategy && <CaseSection icon={<Lightbulb className="size-4" />} title={isAr ? "الاستراتيجية" : "The Strategy"} body={strategy} />}

          {/* 06 — WHAT SADA DID */}
          {services.length > 0 && (
            <section>
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase mb-3">
                <span className="size-6 rounded-lg bg-primary/10 grid place-items-center">
                  <Layers className="size-4" />
                </span>
                {isAr ? "ما أنجزته صدى" : "What SADA Did"}
              </div>
              {process && <p className="text-foreground/90 leading-relaxed whitespace-pre-line mb-4">{process}</p>}
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {services.map((s) => (
                  <li key={s} className="text-sm text-foreground/90 border-b border-border/60 pb-2.5">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* 07/10 — EXECUTION / GALLERY */}
        {gallery.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-6">
              {isAr ? "معرض الأعمال" : "Gallery"}
            </h2>
            <MediaGallery items={gallery} />
          </div>
        )}

        {(p.before_url || p.after_url) && (
          <div className="mt-16 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold font-display mb-6">
              {isAr ? "قبل / بعد" : "Before / After"}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {p.before_url && (
                <div className="rounded-2xl overflow-hidden border border-border">
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted">
                    {isAr ? "قبل" : "BEFORE"}
                  </div>
                  <SmartMedia src={p.before_url} fit="cover" className="w-full aspect-[4/3]" autoplay={false} />
                </div>
              )}
              {p.after_url && (
                <div className="rounded-2xl overflow-hidden border border-primary/30">
                  <div className="px-4 py-2 text-xs font-semibold text-primary bg-primary/10">
                    {isAr ? "بعد" : "AFTER"}
                  </div>
                  <SmartMedia src={p.after_url} fit="cover" className="w-full aspect-[4/3]" autoplay={false} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-16 max-w-3xl space-y-12">
          {/* 08 — DELIVERABLES */}
          {deliverables.length > 0 && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">
                {isAr ? "المخرجات والتسليمات" : "Deliverables"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {deliverables.map((d) => (
                  <span key={d} className="text-sm px-3.5 py-2 rounded-xl bg-muted text-foreground/90">
                    {d}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 09 — RESULTS */}
          {hasResults && (
            <section>
              <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-5">
                {isAr ? "النتائج والإنجازات" : "Results"}
              </h2>
              {metrics.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {metrics.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-2xl glass p-6 text-center"
                    >
                      <div className="text-3xl md:text-4xl font-bold text-gradient" dir="ltr">
                        <AnimatedNumber value={m.value} />
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{m.label}</div>
                    </motion.div>
                  ))}
                </div>
              )}
              {results && (
                <div className="rounded-2xl glass-strong p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 border-primary max-w-3xl">
                  <p className="text-foreground/90 whitespace-pre-line">{results}</p>
                </div>
              )}
            </section>
          )}

          {/* 11 — TESTIMONIAL */}
          {testimonial?.quote && (
            <section className="rounded-3xl border border-border bg-card p-8 md:p-10">
              <Quote className="size-7 text-primary/70 mb-4 rtl-flip" aria-hidden="true" />
              <p className="text-lg md:text-xl leading-relaxed text-foreground/90">"{testimonial.quote}"</p>
              <div className="mt-5 font-semibold">{testimonial.name}</div>
              {testimonial.role && <div className="text-sm text-muted-foreground">{testimonial.role}</div>}
            </section>
          )}

          {/* 12 — TEAM BEHIND THE WORK */}
          {teamMembers && teamMembers.length > 0 && (
            <section className="pt-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase mb-6">
                <span className="size-6 rounded-lg bg-primary/10 grid place-items-center">
                  <Users className="size-4" />
                </span>
                {isAr ? "فريق العمل خلف المشروع" : "The Team Behind The Work"}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {teamMembers.map((m) => {
                  const position = getLocalizedContent(m, "position", language);
                  return (
                    <div key={m.id} className="rounded-2xl border border-border/80 bg-card/60 p-4 flex items-center gap-3.5 hover:border-primary/40 transition-colors">
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.name} className="size-12 rounded-full object-cover shrink-0 border border-border" />
                      ) : (
                        <div className="size-12 rounded-full bg-primary/10 text-primary font-bold grid place-items-center shrink-0 text-base">
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate">{m.name}</div>
                        {position && <div className="text-xs text-muted-foreground truncate">{position}</div>}
                        {m.division && (
                          <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-primary/80 mt-0.5">
                            {m.division}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* 13 — NEXT PROJECT */}
        {next && (
          <Link
            to="/case-studies/$slug"
            params={{ slug: next.slug }}
            className="group mt-20 flex items-center justify-between gap-6 rounded-3xl border border-border bg-card p-6 md:p-8 soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
          >
            <div>
              <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                {isAr ? "المشروع التالي" : "Next Project"}
              </div>
              <div className="mt-2 text-xl md:text-2xl font-bold group-hover:text-primary transition-colors">
                {getLocalizedContent(next, "client", language) || getLocalizedContent(next, "title", language)}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {(next.thumbnail_url || next.cover_url) && (
                <div className="hidden sm:block size-16 rounded-xl overflow-hidden bg-muted">
                  <SmartMedia src={next.thumbnail_url || next.cover_url} className="w-full h-full" autoplay={false} />
                </div>
              )}
              <ArrowRight className="size-5 text-primary group-hover:translate-x-1 group-hover:rtl:-translate-x-1 rtl-flip transition-transform" />
            </div>
          </Link>
        )}

        {/* Back to Case Studies bottom link */}
        <div className="mt-12 pt-8 border-t border-border/40 flex items-center justify-between">
          <Link to="/case-studies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
            <ArrowLeft className="size-4 rtl-flip" />
            <span>{isAr ? "الرجوع إلى سابقة الأعمال" : "Back to all Case Studies"}</span>
          </Link>
        </div>
      </div>

      {/* 13 — FINAL CTA */}
      <CTA
        title={isAr ? "هل لديك مشروع ترغب في العمل عليه معنا؟" : "Have a project we should work on?"}
        subtitle={isAr ? "شاركنا ما تقوم ببنائه وإلى أين تريد الوصول بعلامتك." : "Tell us what you're building and where you want to take it."}
        primaryLabel={isAr ? "ابدأ مشروعك" : "Start a Project"}
        primaryTo="/contact"
        secondaryLabel={isAr ? "استكشف الخدمات" : "Explore Services"}
        secondaryTo="/services"
      />
    </article>
  );
}

function CaseSection({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}>
      <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase mb-3">
        <span className="size-6 rounded-lg bg-primary/10 grid place-items-center">{icon}</span>
        {title}
      </div>
      <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{body}</p>
    </motion.section>
  );
}

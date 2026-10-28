import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, ArrowUpRight, ArrowRight, Sparkles, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSetting } from "@/lib/site-settings";
import { useI18n } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

export const Route = createFileRoute("/blog")({
  loader: async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id,title,slug,excerpt,cover_url,cover_alt,published_at,category,tags,author,reading_minutes,featured,title_ar,excerpt_ar,category_ar")
        .eq("published", true)
        .order("published_at", { ascending: false });

      if (error && error.message?.includes("category_ar")) {
        const { data: fbData } = await supabase
          .from("blog_posts")
          .select("id,title,slug,excerpt,cover_url,cover_alt,published_at,category,tags,author,reading_minutes,featured,title_ar,excerpt_ar")
          .eq("published", true)
          .order("published_at", { ascending: false });
        return { initialPosts: (fbData as Post[]) || [] };
      }
      return { initialPosts: (data as Post[]) || [] };
    } catch {
      return { initialPosts: [] };
    }
  },
  head: () => ({
    meta: [
      { title: "Insights, Strategies & Digital Growth — SADA Blog" },
      {
        name: "description",
        content:
          "The SADA blog — sharp, practical thinking on branding, AI, content, social, and business growth from a modern creative agency.",
      },
      { property: "og:title", content: "SADA Blog — Insights, Strategies & Digital Growth" },
      {
        property: "og:description",
        content:
          "Marketing, branding, AI, and growth insights from the SADA team. A modern digital publication for ambitious brands.",
      },
      { property: "og:url", content: "/blog" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  component: BlogPage,
});

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  published_at: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  reading_minutes: number | null;
  featured: boolean;
  title_ar?: string | null;
  excerpt_ar?: string | null;
  category_ar?: string | null;
}

function BlogPage() {
  const { initialPosts } = Route.useLoaderData();
  const navigate = useNavigate();
  const { language } = useI18n();
  const isAr = language === "ar";
  const { enabled: blogEnabled, loaded: blogSettingLoaded } = useSiteSetting("blog", false);
  const [posts, setPosts] = useState<Post[]>(initialPosts || []);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");

  useEffect(() => {
    if (blogSettingLoaded && !blogEnabled) navigate({ to: "/" });
  }, [blogSettingLoaded, blogEnabled, navigate]);

  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) return;
    let active = true;
    async function loadPosts() {
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id,title,slug,excerpt,cover_url,cover_alt,published_at,category,tags,author,reading_minutes,featured,title_ar,excerpt_ar,category_ar")
          .eq("published", true)
          .order("published_at", { ascending: false });

        if (!active) return;
        if (error && error.message?.includes("category_ar")) {
          // Fallback if category_ar does not exist yet
          const { data: fbData } = await supabase
            .from("blog_posts")
            .select("id,title,slug,excerpt,cover_url,cover_alt,published_at,category,tags,author,reading_minutes,featured,title_ar,excerpt_ar")
            .eq("published", true)
            .order("published_at", { ascending: false });
          if (active) {
            setPosts((fbData as Post[]) || []);
            setLoading(false);
          }
          return;
        }

        setPosts((data as Post[]) || []);
        setLoading(false);
      } catch {
        if (active) setLoading(false);
      }
    }
    loadPosts();
    return () => {
      active = false;
    };
  }, [initialPosts]);

  // Categories come from what is actually published, never a hardcoded taxonomy.
  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      const c = getLocalizedContent(p, "category", language);
      if (c) set.add(c);
    });
    return ["All", ...Array.from(set).sort()];
  }, [posts, language]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return posts.filter((p) => {
      // Invariant: Never expose future-scheduled posts on the public blog
      if (p.published_at && new Date(p.published_at).getTime() > now) return false;

      const catVal = getLocalizedContent(p, "category", language);
      if (cat !== "All" && catVal !== cat && p.category !== cat) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      const title = getLocalizedContent(p, "title", language).toLowerCase();
      const excerpt = (getLocalizedContent(p, "excerpt", language) ?? "").toLowerCase();
      return (
        title.includes(needle) ||
        excerpt.includes(needle) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [posts, q, cat, language]);

  // The editor's Featured flag decides the lead article; otherwise the newest wins.
  const featured = filtered.find((p) => p.featured) || filtered[0];
  const rest = filtered.filter((p) => p.id !== featured?.id);

  if (!blogSettingLoaded || !blogEnabled) return null;

  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-soft" />
        <div
          className="absolute -top-32 -right-32 -z-10 size-[520px] rounded-full blur-3xl opacity-40"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="mx-auto max-w-7xl px-3.5 sm:px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 md:pt-28 md:pb-24 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold tracking-wide"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>{isAr ? "مدونة صدى" : "SADA Journal"}</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-4 sm:mt-5 text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tight font-display text-balance"
            >
              {isAr ? (
                <>أفكار، استراتيجيات <span className="text-gradient">ونمو رقمي متسارع.</span></>
              ) : (
                <>Insights, Strategies & <span className="text-gradient">Digital Growth</span>.</>
              )}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
            >
              {isAr
                ? "التسويق، الهوية المؤسسية، الذكاء الاصطناعي، وتوسيع الأعمال — أفكار وتجارب عملية موثقة من واقع مشاريع صدى اليومية."
                : "Marketing, branding, AI, business growth, and content creation — distilled into practical playbooks from the team building it at SADA every day."}
            </motion.p>
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5 sm:size-4" />
                <span>{isAr ? "مقالات جديدة أسبوعياً" : "New articles weekly"}</span>
              </span>
              <span className="size-1 rounded-full bg-muted-foreground/40" />
              <span>
                {isAr ? `${posts.length} مقالاً منشوراً` : `${posts.length} articles published`}
              </span>
            </div>
          </div>

          {/* Hero featured card */}
          <div className="lg:col-span-5">
            {loading ? (
              <div className="aspect-[4/5] rounded-2xl sm:rounded-3xl bg-muted animate-pulse" />
            ) : featured ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <Link
                  to="/blog/$slug"
                  params={{ slug: featured.slug }}
                  className="group block rounded-2xl sm:rounded-3xl overflow-hidden border border-border bg-card elevated-shadow hover:-translate-y-1 transition-transform"
                >
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {featured.cover_url && (
                      <img
                        src={featured.cover_url}
                        alt={featured.cover_alt || getLocalizedContent(featured, "title", language)}
                        loading="eager"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center gap-2 text-xs">
                      {featured.category && (
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold tracking-wide text-[11px] sm:text-xs">
                          {getLocalizedContent(featured, "category", language)}
                        </span>
                      )}
                      <span className="text-muted-foreground font-medium text-[11px] sm:text-xs">
                        {isAr ? "الأحدث" : "Latest"}
                      </span>
                    </div>
                    <h2 className="mt-2.5 sm:mt-3 text-lg sm:text-xl md:text-2xl font-bold font-display leading-snug group-hover:text-primary transition-colors tracking-tight">
                      {getLocalizedContent(featured, "title", language)}
                    </h2>
                    <PostMeta post={featured} language={language} className="mt-4" />
                  </div>
                </Link>
              </motion.div>
            ) : null}
          </div>
        </div>
      </section>

      {/* FILTERS + GRID */}
      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute start-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={isAr ? "البحث في المقالات والمواضيع..." : "Search articles..."}
                className="w-full ps-11 pe-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all text-start"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    cat === c
                      ? "bg-gradient-primary text-white shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.6)]"
                      : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {c === "All" && isAr ? "الكل" : c}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border bg-card">
                  <div className="aspect-[16/10] bg-muted animate-pulse" />
                  <div className="p-6 space-y-3">
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-full bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-20 text-center text-muted-foreground font-medium">
              {isAr ? "لا توجد مقالات تطابق بحثك." : "No articles match your search."}
            </div>
          ) : (
            <>
              {/* Featured editorial card (full-width) */}
              {featured && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="mt-12"
                >
                  <Link
                    to="/blog/$slug"
                    params={{ slug: featured.slug }}
                    className="group block rounded-3xl overflow-hidden border border-border bg-card elevated-shadow hover:-translate-y-1 transition-transform"
                  >
                    <div className="grid md:grid-cols-2">
                      <div className="aspect-[4/3] md:aspect-auto bg-muted overflow-hidden">
                        {featured.cover_url && (
                          <img
                            src={featured.cover_url}
                            alt={featured.cover_alt || getLocalizedContent(featured, "title", language)}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="p-5 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center">
                        <div className="flex items-center gap-2.5 sm:gap-3 text-xs">
                          {featured.category && (
                            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold tracking-wide text-[11px] sm:text-xs">
                              {getLocalizedContent(featured, "category", language)}
                            </span>
                          )}
                          <span className="text-muted-foreground font-medium text-[11px] sm:text-xs">
                            {isAr ? "اختيار المحرر" : "Editor's pick"}
                          </span>
                        </div>
                        <h2 className="mt-3 sm:mt-4 text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold font-display leading-tight group-hover:text-primary transition-colors tracking-tight">
                          {getLocalizedContent(featured, "title", language)}
                        </h2>
                        {featured.excerpt && (
                          <p className="mt-2.5 sm:mt-4 text-xs sm:text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {getLocalizedContent(featured, "excerpt", language)}
                          </p>
                        )}
                        <PostMeta post={featured} language={language} className="mt-4 sm:mt-6" />
                        <span className="mt-4 sm:mt-6 inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                          <span>{isAr ? "قراءة المقال" : "Read article"}</span>
                          <ArrowUpRight className="size-4 rtl-flip" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}

              {/* Articles grid */}
              {rest.length > 0 && (
                <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6">
                  {rest.map((p, i) => {
                    const title = getLocalizedContent(p, "title", language);
                    const excerpt = getLocalizedContent(p, "excerpt", language);
                    const cat = getLocalizedContent(p, "category", language);

                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-60px" }}
                        transition={{ delay: Math.min(i, 5) * 0.04, duration: 0.4 }}
                      >
                        <Link
                          to="/blog/$slug"
                          params={{ slug: p.slug }}
                          className="group block rounded-2xl overflow-hidden border border-border bg-card soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all h-full flex flex-col justify-between"
                        >
                          <div className="aspect-[16/10] bg-muted overflow-hidden">
                            {p.cover_url && (
                              <img
                                src={p.cover_url}
                                alt={p.cover_alt || title}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            )}
                          </div>
                          <div className="p-4 sm:p-6 flex flex-col flex-1">
                            {cat && (
                              <span className="self-start text-[10px] font-bold tracking-widest text-primary uppercase mb-1.5 sm:mb-2">
                                {cat}
                              </span>
                            )}
                            <h3 className="text-base sm:text-lg font-bold font-display leading-snug group-hover:text-primary transition-colors tracking-tight">
                              {title}
                            </h3>
                            {excerpt && (
                              <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                {excerpt}
                              </p>
                            )}
                            <div className="mt-auto pt-3.5 sm:pt-4 flex items-center justify-between">
                              <PostMeta post={p} language={language} />
                              <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                                <span>{isAr ? "قراءة" : "Read"}</span>
                                <ArrowRight className="size-3.5 rtl-flip" />
                              </span>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="px-3.5 sm:px-4 pb-12 sm:pb-16">
        <div className="mx-auto max-w-5xl rounded-2xl sm:rounded-3xl overflow-hidden relative border border-border bg-gradient-soft">
          <div
            className="absolute -top-24 -left-24 size-[400px] rounded-full blur-3xl opacity-30"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="relative p-5 sm:p-10 md:p-14 grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Mail className="size-3.5" />
                <span>{isAr ? "النشرة البريدية" : "Newsletter"}</span>
              </div>
              <h3 className="mt-3 sm:mt-4 text-2xl sm:text-3xl md:text-4xl font-bold font-display leading-tight tracking-tight">
                {isAr ? (
                  <>ابقَ في صدارة <span className="text-gradient">المنافسة والابتكار.</span></>
                ) : (
                  <>Stay ahead of the <span className="text-gradient">competition</span>.</>
                )}
              </h3>
              <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {isAr
                  ? "رسالة أسبوعية مكثفة. استراتيجيات نمو، دراسات حالة عملية، وأحدث تطبيقات الذكاء الاصطناعي من فريق صدى."
                  : "One sharp email a week. New playbooks, case studies, and AI workflows from the SADA team."}
              </p>
            </div>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                required
                dir="ltr"
                placeholder="you@brand.com"
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary text-start"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform whitespace-nowrap"
              >
                {isAr ? "اشترك الآن" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="mx-auto max-w-6xl rounded-3xl bg-foreground text-background dark:bg-card dark:text-foreground p-10 md:p-16 text-center elevated-shadow">
          <h3 className="text-3xl md:text-5xl font-bold font-display leading-tight">
            {isAr ? "جاهز لتسريع نمو علامتك التجارية؟" : "Ready to grow your business?"}
          </h3>
          <p className="mt-4 text-base md:text-lg opacity-80 max-w-2xl mx-auto leading-relaxed">
            {isAr
              ? "نحول الرؤى والاستراتيجيات التي تقرؤها هنا إلى أنظمة رقمية، حملات إعلانية، وعوائد ملموسة لمشروعك."
              : "We turn the strategies you read about here into systems, campaigns, and revenue for your brand."}
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
          >
            <span>{isAr ? "ابدأ العمل مع صدى" : "Work with SADA"}</span>
            <ArrowRight className="size-4 rtl-flip" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function PostMeta({ post, language = "en", className = "" }: { post: Post; language?: string; className?: string }) {
  const isAr = language === "ar";
  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      {post.author && <span className="font-medium text-foreground/80">{post.author}</span>}
      {post.published_at && (
        <>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>
            {new Date(post.published_at).toLocaleDateString(isAr ? "ar-TN" : "en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </>
      )}
      {post.reading_minutes && (
        <>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {isAr ? `${post.reading_minutes} د` : `${post.reading_minutes}m`}
          </span>
        </>
      )}
    </div>
  );
}

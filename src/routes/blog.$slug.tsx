import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Calendar, ArrowRight, Twitter, Linkedin, Facebook, Link2, Check, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSetting } from "@/lib/site-settings";
import { ArticleContent } from "@/components/site/ArticleContent";
import { BlogReadingEnhancer } from "@/components/site/BlogReadingEnhancer";
import { useI18n } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

interface Post {
  id: string;
  title: string;
  title_ar?: string | null;
  slug: string;
  excerpt: string | null;
  excerpt_ar?: string | null;
  content: string | null;
  content_ar?: string | null;
  cover_url: string | null;
  cover_alt: string | null;
  published_at: string | null;
  category: string | null;
  category_ar?: string | null;
  tags: string[];
  author: string | null;
  reading_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  published: boolean;
}

interface BlogSearchParams {
  preview?: boolean;
}

/**
 * Drafts and scheduled articles are blocked by RLS for anonymous readers, so an
 * admin preview simply drops the published filter — the database decides whether
 * the row comes back, not this query.
 */
async function fetchPost(slug: string, isPreview = false): Promise<Post | null> {
  let query = (supabase as any).from("blog_posts").select("*").eq("slug", slug);
  if (!isPreview) query = query.eq("published", true);
  const { data } = await query.maybeSingle();
  if (!data) return null;
  const post = data as Post;

  // Strict public privacy: drafts and future-scheduled articles return null unless preview=true
  if (!isPreview) {
    if (!post.published) return null;
    if (post.published_at && new Date(post.published_at).getTime() > Date.now()) {
      return null;
    }
  }
  return post;
}

async function fetchRelated(slug: string, category: string | null): Promise<Post[]> {
  try {
    let query = (supabase as any)
      .from("blog_posts")
      .select("id,title,title_ar,slug,excerpt,excerpt_ar,cover_url,published_at,category,category_ar")
      .eq("published", true)
      .lte("published_at", new Date().toISOString())
      .neq("slug", slug);
    if (category) query = query.eq("category", category);
    const { data, error } = await query.order("published_at", { ascending: false }).limit(3);
    if (error && error.message?.includes("category_ar")) {
      const { data: fbData } = await (supabase as any)
        .from("blog_posts")
        .select("id,title,title_ar,slug,excerpt,excerpt_ar,cover_url,published_at,category")
        .eq("published", true)
        .lte("published_at", new Date().toISOString())
        .neq("slug", slug)
        .order("published_at", { ascending: false })
        .limit(3);
      return (fbData as Post[]) || [];
    }
    const found = (data as Post[]) || [];
    if (found.length > 0 || !category) return found;

    // Not enough same-category articles — fall back to the most recent ones.
    const { data: recent } = await (supabase as any)
      .from("blog_posts")
      .select("id,title,title_ar,slug,excerpt,excerpt_ar,cover_url,published_at,category,category_ar")
      .eq("published", true)
      .lte("published_at", new Date().toISOString())
      .neq("slug", slug)
      .order("published_at", { ascending: false })
      .limit(3);
    return (recent as Post[]) || [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/blog/$slug")({
  validateSearch: (search: Record<string, unknown>): BlogSearchParams => ({
    preview: search.preview === "true" || search.preview === true || undefined,
  }),
  loader: async ({ params }) => {
    const isPreview = typeof window !== "undefined" && window.location.search.includes("preview=true");
    const post = await fetchPost(params.slug, isPreview);
    const related = post ? await fetchRelated(params.slug, post.category) : [];
    return { post, related };
  },
  head: ({ loaderData }) => {
    const p = loaderData?.post;
    if (!p) return { meta: [{ title: "Article not found — SADA" }] };

    const title = p.seo_title || `${p.title} — SADA`;
    const description =
      p.seo_description || p.excerpt || "Insights on branding, content and growth from SADA.";
    const image = p.og_image_url || p.cover_url;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { property: "og:url", content: `/blog/${p.slug}` },
        { property: "og:type", content: "article" },
        ...(p.published_at ? [{ property: "article:published_time", content: p.published_at }] : []),
        ...(p.author ? [{ name: "author", content: p.author }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ],
      links: [{ rel: "canonical", href: `/blog/${p.slug}` }],
    };
  },
  component: PostPage,
});

function PostPage() {
  const { post, related } = Route.useLoaderData();
  const search = Route.useSearch();
  const isPreview = !!search.preview;
  const navigate = useNavigate();
  const { enabled: blogEnabled, loaded: blogSettingLoaded } = useSiteSetting("blog", false);
  const { language, isRTL, t } = useI18n();
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  // An admin previewing a draft keeps access even while the section is switched off.
  useEffect(() => {
    if (blogSettingLoaded && !blogEnabled && !isPreview) navigate({ to: "/" });
  }, [blogSettingLoaded, blogEnabled, isPreview, navigate]);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setProgress(total > 0 ? Math.min(100, (h.scrollTop / total) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const localizedTitle = post ? getLocalizedContent(post, "title", language) : "";
  const localizedExcerpt = post ? getLocalizedContent(post, "excerpt", language) : "";
  const localizedContent = post ? getLocalizedContent(post, "content", language) : "";
  const localizedCategory = post ? getLocalizedContent(post, "category", language) : "";

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = localizedTitle || post?.title || "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!blogSettingLoaded || (!blogEnabled && !isPreview)) return null;

  if (!post) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "المقال غير موجود" : "Article not found"}
          </h1>
          <Link to="/blog" className="mt-4 inline-flex items-center gap-2 text-primary">
            <ArrowLeft className="size-4 rtl-flip" /> {t("blog.backToBlog")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="relative">
      {isPreview && !post.published && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2.5 text-center text-xs font-bold">
          <span className="inline-flex items-center gap-2">
            <Eye className="size-3.5" />{" "}
            {language === "ar"
              ? "معاينة مسودة — هذا المقال غير متاح للجمهور."
              : "Draft preview — this article is not visible to the public."}
          </span>
        </div>
      )}

      {/* Reading Progress & UX Enhancer (Cookie-powered scroll memory & font controls) */}
      <BlogReadingEnhancer
        slug={post.slug}
        title={localizedTitle || post.title}
        readingMinutes={post.reading_minutes}
      />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: localizedTitle,
            description: post.seo_description || localizedExcerpt,
            image: post.cover_url,
            author: post.author ? { "@type": "Person", name: post.author } : undefined,
            datePublished: post.published_at,
            publisher: { "@type": "Organization", name: "SADA" },
          }),
        }}
      />

      {/* HERO */}
      <header className="relative border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-soft" />
        <div className="mx-auto max-w-3xl px-3.5 sm:px-4 pt-8 sm:pt-16 md:pt-24 pb-8 sm:pb-12">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted-foreground hover:text-primary mb-5 sm:mb-8"
          >
            <ArrowLeft className="size-4 rtl-flip" /> {t("blog.backToBlog")}
          </Link>

          {localizedCategory && (
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] sm:text-xs font-bold tracking-wide">
              {localizedCategory}
            </span>
          )}
          <h1 className="mt-3.5 sm:mt-5 text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.12] sm:leading-[1.15] tracking-tight text-balance">
            {localizedTitle}
          </h1>
          {localizedExcerpt && (
            <p className="mt-3 sm:mt-6 text-sm sm:text-lg md:text-xl text-muted-foreground leading-relaxed">{localizedExcerpt}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.author && (
              <span className="inline-flex items-center gap-2">
                <span className="size-8 rounded-full bg-gradient-primary text-white grid place-items-center text-xs font-bold">
                  {post.author.slice(0, 1)}
                </span>
                <span className="font-semibold text-foreground">{post.author}</span>
              </span>
            )}
            {post.published_at && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {new Date(post.published_at).toLocaleDateString(
                  language === "ar" ? "ar-TN" : "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
              </span>
            )}
            {post.reading_minutes && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> {post.reading_minutes} {t("blog.readingTime")}
              </span>
            )}
          </div>
        </div>

        {post.cover_url && (
          <div className="mx-auto max-w-5xl px-4 pb-12">
            <div className="rounded-3xl overflow-hidden elevated-shadow">
              <img
                src={post.cover_url}
                alt={post.cover_alt || localizedTitle}
                className="w-full aspect-[16/9] object-cover"
                loading="eager"
              />
            </div>
          </div>
        )}
      </header>

      {/* CONTENT + STICKY SHARE */}
      <div className="relative">
        <div className="mx-auto max-w-6xl px-4 py-16 grid lg:grid-cols-[64px_1fr] gap-10">
          {/* Sticky share */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 flex flex-col gap-3">
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground text-center">
                {language === "ar" ? "مشاركة" : "SHARE"}
              </span>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on X"
                className="size-11 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted hover:text-primary transition-colors"
              >
                <Twitter className="size-4" />
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on LinkedIn"
                className="size-11 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted hover:text-primary transition-colors"
              >
                <Linkedin className="size-4" />
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Share on Facebook"
                className="size-11 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted hover:text-primary transition-colors"
              >
                <Facebook className="size-4" />
              </a>
              <button
                onClick={copyLink}
                aria-label={language === "ar" ? "نسخ الرابط" : "Copy link"}
                title={language === "ar" ? (copied ? "تم النسخ" : "نسخ الرابط") : (copied ? "Copied" : "Copy link")}
                className="size-11 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted hover:text-primary transition-colors"
              >
                {copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}
              </button>
            </div>
          </aside>

          {/* Article body */}
          <div className="max-w-3xl mx-auto w-full">
            <ArticleContent content={localizedContent || post.content || ""} />

            {post.tags?.length > 0 && (
              <div className="mt-12 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* Mobile share */}
            <div className="mt-10 lg:hidden flex items-center gap-3">
              <span className="text-xs font-bold tracking-widest text-muted-foreground">
                {language === "ar" ? "مشاركة" : "SHARE"}
              </span>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="size-10 grid place-items-center rounded-xl border border-border bg-card"><Twitter className="size-4" /></a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="size-10 grid place-items-center rounded-xl border border-border bg-card"><Linkedin className="size-4" /></a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="size-10 grid place-items-center rounded-xl border border-border bg-card"><Facebook className="size-4" /></a>
              <button onClick={copyLink} className="size-10 grid place-items-center rounded-xl border border-border bg-card">{copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}</button>
            </div>

            {/* Final CTA */}
            <div className="mt-16 rounded-3xl glass-strong p-8 md:p-10 text-center">
              <h3 className="text-2xl md:text-3xl font-bold">
                {language === "ar"
                  ? "هل تحتاج لمساعدة في تطبيق هذه الاستراتيجيات؟"
                  : "Need help implementing these strategies?"}
              </h3>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                {language === "ar"
                  ? "تساعد صدى العلامات التجارية على تحويل هذه الأفكار إلى أنظمة وحملات ونمو قابل للقياس."
                  : "SADA helps brands turn ideas like these into systems, campaigns, and measurable growth."}
              </p>
              <Link
                to="/contact"
                className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
              >
                {language === "ar" ? "تواصل مع صدى" : "Contact SADA"}{" "}
                <ArrowRight className="size-4 rtl-flip" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="px-4 pb-24">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-end justify-between mb-8">
              <h3 className="text-2xl md:text-3xl font-bold">
                {language === "ar" ? "واصل القراءة" : "Keep reading"}
              </h3>
              <Link to="/blog" className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
                {language === "ar" ? "جميع المقالات" : "All articles"}{" "}
                <ArrowRight className="size-4 rtl-flip" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((r) => {
                const rTitle = getLocalizedContent(r, "title", language);
                const rCat = getLocalizedContent(r, "category", language);
                return (
                  <Link
                    key={r.id}
                    to="/blog/$slug"
                    params={{ slug: r.slug }}
                    className="group block rounded-2xl overflow-hidden border border-border bg-card soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
                  >
                    <div className="aspect-[16/10] bg-muted overflow-hidden">
                      {r.cover_url && (
                        <img
                          src={r.cover_url}
                          alt={rTitle}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="p-5">
                      {rCat && (
                        <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
                          {rCat}
                        </span>
                      )}
                      <h4 className="mt-2 font-bold leading-snug group-hover:text-primary transition-colors">
                        {rTitle}
                      </h4>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

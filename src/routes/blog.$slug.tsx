import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Calendar, ArrowRight, Twitter, Linkedin, Facebook, Link2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSetting } from "@/lib/site-settings";

export const Route = createFileRoute("/blog/$slug")({
  component: PostPage,
});

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_url: string | null;
  published_at: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  reading_minutes: number | null;
  seo_description: string | null;
}

function PostPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { enabled: blogEnabled, loaded: blogSettingLoaded } = useSiteSetting("blog", false);
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (blogSettingLoaded && !blogEnabled) navigate({ to: "/" });
  }, [blogSettingLoaded, blogEnabled, navigate]);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        setPost((data as Post) || null);
        setLoading(false);
        if (data) {
          supabase
            .from("blog_posts")
            .select(
              "id,title,slug,excerpt,cover_url,published_at,category,tags,author,reading_minutes,content,seo_description"
            )
            .eq("published", true)
            .neq("slug", slug)
            .order("published_at", { ascending: false })
            .limit(3)
            .then(({ data: rel }) => setRelated((rel as Post[]) || []));
        }
      });
  }, [slug]);

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

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = post?.title ?? "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (!blogSettingLoaded || !blogEnabled) return null;

  if (loading) {
    return <div className="min-h-[60vh] grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!post) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-bold">Article not found</h1>
          <Link to="/blog" className="mt-4 inline-flex items-center gap-2 text-primary">
            ← Back to blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="relative">
      {/* Reading progress */}
      <div className="fixed top-0 left-0 right-0 z-40 h-1 bg-transparent pointer-events-none">
        <div
          className="h-full bg-gradient-primary transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.seo_description || post.excerpt,
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
        <div className="mx-auto max-w-3xl px-4 pt-16 md:pt-24 pb-12">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8"
          >
            <ArrowLeft className="size-4" /> Back to blog
          </Link>

          {post.category && (
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-wide">
              {post.category}
            </span>
          )}
          <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-6 text-xl text-muted-foreground leading-relaxed">{post.excerpt}</p>
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
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            {post.reading_minutes && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" /> {post.reading_minutes} min read
              </span>
            )}
          </div>
        </div>

        {post.cover_url && (
          <div className="mx-auto max-w-5xl px-4 pb-12">
            <div className="rounded-3xl overflow-hidden elevated-shadow">
              <img
                src={post.cover_url}
                alt={post.title}
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
              <span className="text-[10px] font-bold tracking-widest text-muted-foreground text-center">SHARE</span>
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
                aria-label="Copy link"
                className="size-11 grid place-items-center rounded-xl border border-border bg-card hover:bg-muted hover:text-primary transition-colors"
              >
                {copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}
              </button>
            </div>
          </aside>

          {/* Article body */}
          <div className="max-w-3xl mx-auto w-full">
            <ArticleBody content={post.content ?? ""} />

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
              <span className="text-xs font-bold tracking-widest text-muted-foreground">SHARE</span>
              <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer" className="size-10 grid place-items-center rounded-xl border border-border bg-card"><Twitter className="size-4" /></a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="size-10 grid place-items-center rounded-xl border border-border bg-card"><Linkedin className="size-4" /></a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noreferrer" className="size-10 grid place-items-center rounded-xl border border-border bg-card"><Facebook className="size-4" /></a>
              <button onClick={copyLink} className="size-10 grid place-items-center rounded-xl border border-border bg-card">{copied ? <Check className="size-4 text-primary" /> : <Link2 className="size-4" />}</button>
            </div>

            {/* Final CTA */}
            <div className="mt-16 rounded-3xl glass-strong p-8 md:p-10 text-center">
              <h3 className="text-2xl md:text-3xl font-bold">
                Need help implementing these strategies?
              </h3>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                SADA helps brands turn ideas like these into systems, campaigns, and measurable growth.
              </p>
              <Link
                to="/contact"
                className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
              >
                Contact SADA <ArrowRight className="size-4" />
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
              <h3 className="text-2xl md:text-3xl font-bold">Keep reading</h3>
              <Link to="/blog" className="text-sm font-semibold text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
                All articles <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((r) => (
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
                        alt={r.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    {r.category && (
                      <span className="text-[10px] font-bold tracking-widest text-primary uppercase">
                        {r.category}
                      </span>
                    )}
                    <h4 className="mt-2 font-bold leading-snug group-hover:text-primary transition-colors">
                      {r.title}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

function ArticleBody({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();

    if (!t) {
      i++;
      continue;
    }

    if (t.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="text-3xl md:text-4xl font-bold mt-14 mb-5 tracking-tight">
          {t.slice(3)}
        </h2>
      );
      i++;
      continue;
    }
    if (t.startsWith("### ")) {
      blocks.push(
        <h3 key={key++} className="text-xl md:text-2xl font-bold mt-10 mb-3 tracking-tight">
          {t.slice(4)}
        </h3>
      );
      i++;
      continue;
    }
    if (t.startsWith("> ")) {
      blocks.push(
        <blockquote
          key={key++}
          className="my-10 pl-6 border-l-4 border-primary text-xl md:text-2xl font-medium leading-snug text-foreground/90 italic"
        >
          {t.slice(2).replace(/^"|"$/g, "")}
        </blockquote>
      );
      i++;
      continue;
    }
    // Numbered / bulleted list grouping
    if (/^(\d+\.\s|[-*]\s)/.test(t)) {
      const items: string[] = [];
      const ordered = /^\d+\./.test(t);
      while (i < lines.length && /^(\d+\.\s|[-*]\s)/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^(\d+\.\s|[-*]\s)/, ""));
        i++;
      }
      blocks.push(
        ordered ? (
          <ol key={key++} className="my-6 space-y-2 list-decimal pl-6 marker:text-primary marker:font-bold text-lg leading-[1.8]">
            {items.map((it, idx) => <li key={idx}>{it}</li>)}
          </ol>
        ) : (
          <ul key={key++} className="my-6 space-y-2 list-disc pl-6 marker:text-primary text-lg leading-[1.8]">
            {items.map((it, idx) => <li key={idx}>{it}</li>)}
          </ul>
        )
      );
      continue;
    }
    blocks.push(
      <p key={key++} className="my-5 text-lg leading-[1.85] text-foreground/90">
        {t}
      </p>
    );
    i++;
  }

  return <div className="prose-content">{blocks}</div>;
}

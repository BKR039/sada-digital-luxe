import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
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
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

      {/* JSON-LD article schema */}
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

      <div className="px-4 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8"
          >
            <ArrowLeft className="size-4" /> Back to blog
          </Link>

          {post.category && (
            <span className="text-xs font-bold tracking-[0.25em] text-primary uppercase">
              {post.category}
            </span>
          )}
          <h1 className="mt-4 text-4xl md:text-5xl font-bold leading-[1.1]">{post.title}</h1>
          {post.excerpt && (
            <p className="mt-5 text-xl text-muted-foreground leading-relaxed">{post.excerpt}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {post.author && <span className="font-medium text-foreground">{post.author}</span>}
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
          <div className="mx-auto max-w-5xl mt-12 rounded-3xl overflow-hidden elevated-shadow">
            <img
              src={post.cover_url}
              alt={post.title}
              className="w-full aspect-[16/9] object-cover"
              loading="eager"
            />
          </div>
        )}

        <div className="mx-auto max-w-3xl mt-12 prose-content text-lg leading-[1.85] text-foreground/90">
          {(post.content || "").split("\n").map((line, i) => {
            const t = line.trim();
            if (!t) return <div key={i} className="h-3" />;
            if (t.startsWith("## ")) {
              return (
                <h2 key={i} className="text-2xl md:text-3xl font-bold mt-10 mb-4">
                  {t.slice(3)}
                </h2>
              );
            }
            if (t.startsWith("### ")) {
              return (
                <h3 key={i} className="text-xl md:text-2xl font-bold mt-8 mb-3">
                  {t.slice(4)}
                </h3>
              );
            }
            return (
              <p key={i} className="my-4">
                {t}
              </p>
            );
          })}
        </div>

        {post.tags?.length > 0 && (
          <div className="mx-auto max-w-3xl mt-12 flex flex-wrap gap-2">
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

        <div className="mx-auto max-w-3xl mt-16 rounded-3xl glass-strong p-8 text-center">
          <h3 className="text-2xl font-bold">Ready to put this into action?</h3>
          <p className="mt-2 text-muted-foreground">
            We help brands like yours ship the work, not just plan it.
          </p>
          <Link
            to="/contact"
            className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
          >
            Talk to SADA <ArrowRight className="size-4" />
          </Link>
        </div>

        {related.length > 0 && (
          <div className="mx-auto max-w-6xl mt-20">
            <h3 className="text-2xl md:text-3xl font-bold mb-6">Keep reading</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
        )}
      </div>
    </article>
  );
}

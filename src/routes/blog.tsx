import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, ArrowUpRight, ArrowRight, Sparkles, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog")({
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
  published_at: string | null;
  category: string | null;
  tags: string[];
  author: string | null;
  reading_minutes: number | null;
}

const CATEGORIES = [
  "All",
  "Branding",
  "Digital Marketing",
  "Content Creation",
  "AI & Automation",
  "Business Growth",
  "Social Media",
  "Web Design",
] as const;

function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");

  useEffect(() => {
    supabase
      .from("blog_posts")
      .select("id,title,slug,excerpt,cover_url,published_at,category,tags,author,reading_minutes")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data as Post[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      return (
        p.title.toLowerCase().includes(needle) ||
        (p.excerpt ?? "").toLowerCase().includes(needle) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [posts, q, cat]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-soft" />
        <div
          className="absolute -top-32 -right-32 -z-10 size-[520px] rounded-full blur-3xl opacity-40"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 md:pt-28 md:pb-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-semibold tracking-wide"
            >
              <Sparkles className="size-3.5 text-primary" />
              SADA Journal
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-5 text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.04] tracking-tight"
            >
              Insights, Strategies & <span className="text-gradient">Digital Growth</span>.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
            >
              Marketing, branding, AI, business growth, and content creation — distilled into practical
              playbooks from the team building it at SADA every day.
            </motion.p>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" /> New articles weekly
              </span>
              <span className="size-1 rounded-full bg-muted-foreground/40" />
              <span>{posts.length} articles published</span>
            </div>
          </div>

          {/* Hero featured card */}
          <div className="lg:col-span-5">
            {loading ? (
              <div className="aspect-[4/5] rounded-3xl bg-muted animate-pulse" />
            ) : featured ? (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <Link
                  to="/blog/$slug"
                  params={{ slug: featured.slug }}
                  className="group block rounded-3xl overflow-hidden border border-border bg-card elevated-shadow hover:-translate-y-1 transition-transform"
                >
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {featured.cover_url && (
                      <img
                        src={featured.cover_url}
                        alt={featured.title}
                        loading="eager"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-2 text-xs">
                      {featured.category && (
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold tracking-wide">
                          {featured.category}
                        </span>
                      )}
                      <span className="text-muted-foreground">Latest</span>
                    </div>
                    <h2 className="mt-3 text-xl md:text-2xl font-bold leading-snug group-hover:text-primary transition-colors">
                      {featured.title}
                    </h2>
                    <PostMeta post={featured} className="mt-4" />
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
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    cat === c
                      ? "bg-gradient-primary text-white shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.6)]"
                      : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {c}
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
            <div className="mt-20 text-center text-muted-foreground">
              No articles match your search.
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
                            alt={featured.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center">
                        <div className="flex items-center gap-3 text-xs">
                          {featured.category && (
                            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold tracking-wide">
                              {featured.category}
                            </span>
                          )}
                          <span className="text-muted-foreground font-medium">Editor's pick</span>
                        </div>
                        <h2 className="mt-4 text-2xl md:text-3xl lg:text-4xl font-bold leading-tight group-hover:text-primary transition-colors">
                          {featured.title}
                        </h2>
                        {featured.excerpt && (
                          <p className="mt-4 text-muted-foreground line-clamp-3 leading-relaxed">
                            {featured.excerpt}
                          </p>
                        )}
                        <PostMeta post={featured} className="mt-6" />
                        <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                          Read article <ArrowUpRight className="size-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )}

              {/* Articles grid */}
              {rest.length > 0 && (
                <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ delay: Math.min(i, 5) * 0.05, duration: 0.4 }}
                    >
                      <Link
                        to="/blog/$slug"
                        params={{ slug: p.slug }}
                        className="group block rounded-2xl overflow-hidden border border-border bg-card soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all h-full flex flex-col"
                      >
                        <div className="aspect-[16/10] bg-muted overflow-hidden">
                          {p.cover_url && (
                            <img
                              src={p.cover_url}
                              alt={p.title}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          )}
                        </div>
                        <div className="p-6 flex flex-col flex-1">
                          {p.category && (
                            <span className="self-start text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
                              {p.category}
                            </span>
                          )}
                          <h3 className="text-lg font-bold leading-snug group-hover:text-primary transition-colors">
                            {p.title}
                          </h3>
                          {p.excerpt && (
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {p.excerpt}
                            </p>
                          )}
                          <div className="mt-auto pt-4 flex items-center justify-between">
                            <PostMeta post={p} />
                            <span className="text-xs font-semibold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                              Read <ArrowRight className="size-3.5" />
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-5xl rounded-3xl overflow-hidden relative border border-border bg-gradient-soft">
          <div
            className="absolute -top-24 -left-24 size-[400px] rounded-full blur-3xl opacity-30"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="relative p-10 md:p-14 grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                <Mail className="size-3.5" /> Newsletter
              </div>
              <h3 className="mt-4 text-3xl md:text-4xl font-bold leading-tight">
                Stay ahead of the <span className="text-gradient">competition</span>.
              </h3>
              <p className="mt-3 text-muted-foreground">
                One sharp email a week. New playbooks, case studies, and AI workflows from the SADA team.
              </p>
            </div>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex flex-col sm:flex-row gap-3"
            >
              <input
                type="email"
                required
                placeholder="you@brand.com"
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="mx-auto max-w-6xl rounded-3xl bg-foreground text-background dark:bg-card dark:text-foreground p-10 md:p-16 text-center elevated-shadow">
          <h3 className="text-3xl md:text-5xl font-bold leading-tight">
            Ready to grow your business?
          </h3>
          <p className="mt-4 text-base md:text-lg opacity-80 max-w-2xl mx-auto">
            We turn the strategies you read about here into systems, campaigns, and revenue for your brand.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
          >
            Work with SADA <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function PostMeta({ post, className = "" }: { post: Post; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      {post.author && <span className="font-medium text-foreground/80">{post.author}</span>}
      {post.published_at && (
        <>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>
            {new Date(post.published_at).toLocaleDateString("en-US", {
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
            <Clock className="size-3" /> {post.reading_minutes}m
          </span>
        </>
      )}
    </div>
  );
}

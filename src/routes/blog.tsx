import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Clock, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — SADA Creative Agency" },
      {
        name: "description",
        content:
          "Strategy, branding, social, paid ads, and content insights from the team at SADA. Practical playbooks for brands that want to grow.",
      },
      { property: "og:title", content: "SADA Blog — Strategy & Creative Insights" },
      {
        property: "og:description",
        content: "Playbooks and field notes on branding, content, social, and growth.",
      },
      { property: "og:url", content: "/blog" },
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.category && set.add(p.category));
    return ["All", ...Array.from(set)];
  }, [posts]);

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
    <div className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">JOURNAL</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05]">
            Field notes from the <span className="text-gradient">SADA studio</span>.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Practical playbooks on branding, content, social, paid ads, and the work that actually
            moves the needle.
          </p>
        </div>

        <div className="mt-12 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
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
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  cat === c
                    ? "bg-gradient-primary text-white"
                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-16 text-center text-muted-foreground">Loading articles…</div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">No articles match your search.</div>
        ) : (
          <>
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
                          loading="eager"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <div className="p-8 md:p-10 flex flex-col justify-center">
                      <div className="flex items-center gap-3 text-xs">
                        {featured.category && (
                          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold tracking-wide">
                            {featured.category}
                          </span>
                        )}
                        <span className="text-muted-foreground">Featured</span>
                      </div>
                      <h2 className="mt-4 text-2xl md:text-3xl font-bold leading-tight group-hover:text-primary transition-colors">
                        {featured.title}
                      </h2>
                      {featured.excerpt && (
                        <p className="mt-3 text-muted-foreground line-clamp-3">{featured.excerpt}</p>
                      )}
                      <PostMeta post={featured} className="mt-5" />
                      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                        Read article <ArrowUpRight className="size-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )}

            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.excerpt}</p>
                      )}
                      <PostMeta post={p} className="mt-4" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PostMeta({ post, className = "" }: { post: Post; className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-xs text-muted-foreground ${className}`}>
      {post.author && <span>{post.author}</span>}
      {post.published_at && (
        <>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>
            {new Date(post.published_at).toLocaleDateString("en-US", {
              year: "numeric",
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
            <Clock className="size-3" /> {post.reading_minutes} min
          </span>
        </>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { MediaGallery } from "@/components/media/MediaGallery";
import { ArrowLeft, ExternalLink, Calendar, Tag } from "lucide-react";

export const Route = createFileRoute("/portfolio/$slug")({
  component: ProjectDetail,
});

function ProjectDetail() {
  const { slug } = Route.useParams();
  const [p, setP] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("projects").select("*").eq("slug", slug).eq("published", true).maybeSingle()
      .then(({ data }) => { setP(data); setLoading(false); });
  }, [slug]);

  if (loading) return <div className="min-h-[60vh] grid place-items-center text-muted-foreground">Loading…</div>;
  if (!p) return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold">Project not found</h1>
        <Link to="/portfolio" className="mt-6 inline-flex items-center gap-2 text-accent">← Back to portfolio</Link>
      </div>
    </div>
  );

  const gallery: string[] = Array.isArray(p.gallery) ? p.gallery : [];

  return (
    <article className="px-4 py-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent mb-8">
          <ArrowLeft className="size-4" /> Back to portfolio
        </Link>

        {p.category && <p className="text-xs font-bold text-accent tracking-[0.3em] mb-3">{p.category.toUpperCase()}</p>}
        <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05]">{p.title}</h1>
        {p.client && <p className="mt-3 text-xl text-muted-foreground">{p.client}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {p.project_date && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" />{new Date(p.project_date).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</span>}
          {p.external_url && (
            <a href={p.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">
              Visit live <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {(p.cover_url || p.thumbnail_url) && (
          <div className="mt-10 rounded-3xl overflow-hidden glass">
            <SmartMedia src={p.cover_url || p.thumbnail_url} fit="cover" className="w-full max-h-[70vh] aspect-video" loading="eager" />
          </div>
        )}

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            {p.description && <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-line">{p.description}</p>}
            {p.results && (
              <div className="glass-strong rounded-2xl p-6 glow-border">
                <div className="text-xs font-bold text-accent tracking-widest mb-2">RESULTS</div>
                <p className="text-foreground/90 whitespace-pre-line">{p.results}</p>
              </div>
            )}
          </div>
          <aside className="space-y-6">
            {p.services && p.services.length > 0 && (
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-widest mb-3">SERVICES</div>
                <div className="flex flex-wrap gap-2">{p.services.map((s: string) => <span key={s} className="text-xs px-3 py-1.5 rounded-full glass">{s}</span>)}</div>
              </div>
            )}
            {p.tags && p.tags.length > 0 && (
              <div>
                <div className="text-xs font-bold text-muted-foreground tracking-widest mb-3 inline-flex items-center gap-1.5"><Tag className="size-3" />TAGS</div>
                <div className="flex flex-wrap gap-2">{p.tags.map((t: string) => <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-muted-foreground">#{t}</span>)}</div>
              </div>
            )}
          </aside>
        </div>

        {gallery.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-2xl md:text-3xl font-bold mb-6">Gallery</h2>
            <MediaGallery items={gallery} />
          </div>
        )}

        <div className="mt-20 glass-strong rounded-3xl p-10 text-center glow-border">
          <h3 className="font-display text-2xl md:text-3xl font-bold">Have a project like this in mind?</h3>
          <Link to="/contact" className="mt-6 inline-flex items-center gap-2 bg-gradient-primary px-7 py-3.5 rounded-2xl font-semibold neon-glow">Start a Project</Link>
        </div>
      </div>
    </article>
  );
}

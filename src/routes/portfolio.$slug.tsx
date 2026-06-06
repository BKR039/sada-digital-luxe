import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { MediaGallery } from "@/components/media/MediaGallery";
import { ArrowLeft, ExternalLink, Calendar, Tag, ArrowRight, Target, Lightbulb, Workflow } from "lucide-react";

export const Route = createFileRoute("/portfolio/$slug")({
  component: ProjectDetail,
});

interface Metric { label: string; value: string }

function AnimatedNumber({ value }: { value: string }) {
  // Animate numeric portion if present
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
        <h1 className="text-4xl font-bold">Project not found</h1>
        <Link to="/portfolio" className="mt-6 inline-flex items-center gap-2 text-primary">← Back to case studies</Link>
      </div>
    </div>
  );

  const gallery: string[] = Array.isArray(p.gallery) ? p.gallery : [];
  const metrics: Metric[] = Array.isArray(p.metrics) ? p.metrics : [];

  return (
    <article className="px-4 py-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="size-4" /> Back to case studies
        </Link>

        {p.category && <p className="text-xs font-bold text-primary tracking-[0.3em] mb-3">{p.category.toUpperCase()}</p>}
        <h1 className="text-4xl md:text-6xl font-bold leading-[1.05]">{p.title}</h1>
        {p.client && <p className="mt-3 text-xl text-muted-foreground">{p.client}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {p.project_date && <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5" />{new Date(p.project_date).toLocaleDateString("en-US", { year: "numeric", month: "long" })}</span>}
          {p.external_url && (
            <a href={p.external_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
              Visit live <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {(p.cover_url || p.thumbnail_url) && (
          <div className="mt-10 rounded-3xl overflow-hidden elevated-shadow">
            <SmartMedia src={p.cover_url || p.thumbnail_url} fit="cover" className="w-full max-h-[70vh] aspect-video" loading="eager" />
          </div>
        )}

        {/* Animated metrics */}
        {metrics.length > 0 && (
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl glass p-6 text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-gradient">
                  <AnimatedNumber value={m.value} />
                </div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{m.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Case study story */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            {p.description && (
              <section>
                <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-line">{p.description}</p>
              </section>
            )}

            {p.challenge && (
              <CaseSection icon={<Target className="size-4" />} title="The Challenge" body={p.challenge} />
            )}
            {p.strategy && (
              <CaseSection icon={<Lightbulb className="size-4" />} title="The Strategy" body={p.strategy} />
            )}
            {p.process && (
              <CaseSection icon={<Workflow className="size-4" />} title="The Process" body={p.process} />
            )}

            {(p.results_summary || p.results) && (
              <div className="rounded-2xl glass-strong p-6 border-l-4 border-primary">
                <div className="text-xs font-bold text-primary tracking-widest mb-2">RESULTS</div>
                <p className="text-foreground/90 whitespace-pre-line">{p.results_summary || p.results}</p>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            {p.services && p.services.length > 0 && (
              <div className="rounded-2xl border border-border p-5">
                <div className="text-xs font-bold text-muted-foreground tracking-widest mb-3">SERVICES</div>
                <div className="flex flex-wrap gap-2">{p.services.map((s: string) => <span key={s} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">{s}</span>)}</div>
              </div>
            )}
            {p.tags && p.tags.length > 0 && (
              <div className="rounded-2xl border border-border p-5">
                <div className="text-xs font-bold text-muted-foreground tracking-widest mb-3 inline-flex items-center gap-1.5"><Tag className="size-3" />TAGS</div>
                <div className="flex flex-wrap gap-2">{p.tags.map((t: string) => <span key={t} className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground">#{t}</span>)}</div>
              </div>
            )}
          </aside>
        </div>

        {/* Before / After */}
        {(p.before_url || p.after_url) && (
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Before / After</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {p.before_url && (
                <div className="rounded-2xl overflow-hidden border border-border">
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted">BEFORE</div>
                  <SmartMedia src={p.before_url} fit="cover" className="w-full aspect-[4/3]" />
                </div>
              )}
              {p.after_url && (
                <div className="rounded-2xl overflow-hidden border border-primary/30">
                  <div className="px-4 py-2 text-xs font-semibold text-primary bg-primary/10">AFTER</div>
                  <SmartMedia src={p.after_url} fit="cover" className="w-full aspect-[4/3]" />
                </div>
              )}
            </div>
          </div>
        )}

        {gallery.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Gallery</h2>
            <MediaGallery items={gallery} />
          </div>
        )}

        <div className="mt-20 rounded-3xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 p-10 text-center elevated-shadow">
          <h3 className="text-2xl md:text-3xl font-bold">Want results like these?</h3>
          <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Tell us about your brand and we'll send a tailored plan within 48 hours.</p>
          <Link to="/contact" className="mt-6 inline-flex items-center gap-2 bg-gradient-primary text-white px-7 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.02] transition-transform">
            Start a project <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function CaseSection({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
    >
      <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest text-primary uppercase mb-3">
        <span className="size-6 rounded-lg bg-primary/10 grid place-items-center">{icon}</span>
        {title}
      </div>
      <p className="text-foreground/90 leading-relaxed whitespace-pre-line">{body}</p>
    </motion.section>
  );
}

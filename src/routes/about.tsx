import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { About as AboutSection } from "@/components/site/About";
import { CTA } from "@/components/site/CTA";
import {
  Sparkles, Target, Eye, Heart, Compass, ShieldCheck, Rocket, Users,
  ArrowRight, BookOpen, Briefcase, Package,
} from "lucide-react";

interface Member { id: string; name: string; position: string; bio: string | null; photo_url: string | null; }

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SADA — Our Story, Team & Values" },
      { name: "description", content: "SADA is a creative digital agency built for brands that refuse to be ignored. Meet our team, mission, values and process." },
      { property: "og:title", content: "About SADA — Our Story, Team & Values" },
      { property: "og:description", content: "Meet the people, mission, and process behind SADA." },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

const VALUES = [
  { icon: ShieldCheck, t: "Craft over hype", d: "We obsess over the details. Every pixel, line and frame is on purpose." },
  { icon: Compass, t: "Strategy first", d: "Beautiful work without a goal is decoration. We start with the why." },
  { icon: Heart, t: "Long-term partners", d: "We don't ship and disappear. We stay invested in your growth." },
  { icon: Rocket, t: "Bias for shipping", d: "Real progress beats perfect plans. We move, learn and refine." },
];

const PROCESS = [
  { k: "01", t: "Discover", d: "We learn your brand, audience and goals — deeply, not superficially." },
  { k: "02", t: "Strategize", d: "Positioning, narrative and a content engine designed to move the needle." },
  { k: "03", t: "Create", d: "Identity, content and campaigns crafted with senior creative direction." },
  { k: "04", t: "Launch & grow", d: "Ship, measure, iterate — and compound wins month over month." },
];

const TIMELINE = [
  { y: "2019", t: "SADA founded", d: "Started as a small studio focused on identity work for ambitious founders." },
  { y: "2021", t: "Content arm launched", d: "Expanded into full-service content production for regional brands." },
  { y: "2023", t: "Growth practice", d: "Added paid media and performance strategy to close the loop on creative." },
  { y: "2025", t: "Premium products", d: "Launched a library of premium tools and templates for modern brands." },
];

function AboutPage() {
  const [team, setTeam] = useState<Member[]>([]);
  useEffect(() => {
    supabase
      .from("team_members")
      .select("id,name,position,bio,photo_url")
      .eq("published", true)
      .order("sort_order")
      .limit(8)
      .then(({ data }) => setTeam((data as Member[]) || []));
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold text-primary tracking-[0.3em] mb-3 inline-flex items-center gap-2 justify-center">
            <Sparkles className="size-3.5" /> ABOUT SADA
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[1.05]">
            A studio for <span className="text-gradient">brands that matter</span>.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
            We are a creative digital agency where real identity begins. Strategy, content and growth — built for ambitious brands across the region and beyond.
          </p>
        </div>
      </section>

      {/* Company story */}
      <AboutSection />

      {/* Mission / Vision */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-6">
          {[
            { icon: Target, t: "Our Mission", d: "Make every brand we touch unforgettable — through content that resonates, identity that endures, and growth that compounds." },
            { icon: Eye, t: "Our Vision", d: "Set a new bar for creative work coming out of the region — premium, intentional, and built for the modern internet." },
          ].map(({ icon: Icon, t, d }) => (
            <motion.div
              key={t}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="rounded-3xl border border-border bg-card p-8 elevated-shadow"
            >
              <div className="size-12 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary mb-5">
                <Icon className="size-5" />
              </div>
              <h2 className="text-2xl font-bold">{t}</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">{d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="px-4 py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">OUR VALUES</p>
            <h2 className="text-3xl md:text-5xl font-bold">The principles behind every project.</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {VALUES.map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-border bg-card p-6 soft-shadow hover:elevated-shadow transition-shadow">
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4">
                  <Icon className="size-4" />
                </div>
                <div className="font-bold">{t}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">OUR PROCESS</p>
            <h2 className="text-3xl md:text-5xl font-bold">How we work with brands.</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PROCESS.map((s) => (
              <div key={s.k} className="relative rounded-2xl border border-border bg-card p-6 soft-shadow">
                <div className="text-xs font-bold tracking-widest text-primary">{s.k}</div>
                <div className="mt-2 text-lg font-bold">{s.t}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="px-4 py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 inline-flex items-center gap-2">
                <Users className="size-3.5" /> THE TEAM
              </p>
              <h2 className="text-3xl md:text-5xl font-bold">The minds behind the work.</h2>
              <p className="mt-3 text-muted-foreground">A senior team of strategists, art directors, editors and growth specialists.</p>
            </div>
            <Link to="/team" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all">
              View full team <ArrowRight className="size-4" />
            </Link>
          </div>
          {team.length > 0 && (
            <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {team.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow transition-shadow">
                  <div className="aspect-square bg-muted overflow-hidden">
                    {m.photo_url ? (
                      <SmartMedia src={m.photo_url} className="w-full h-full" autoplay={false} />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-5xl font-display font-bold text-gradient bg-gradient-to-br from-primary/15 to-accent/15">
                        {m.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="font-bold">{m.name}</div>
                    <div className="text-sm text-primary">{m.position}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why SADA */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl rounded-3xl glass-strong p-10 md:p-14">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">WHY SADA</p>
          <h2 className="text-3xl md:text-5xl font-bold max-w-3xl">Senior craft, real strategy, measurable growth.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              { t: "Senior-only team", d: "Your project is led by partners, not juniors." },
              { t: "Strategy + execution", d: "We don't hand you a deck and walk away — we ship the work." },
              { t: "Built to scale", d: "Systems and assets you can keep using long after we launch." },
            ].map((w) => (
              <div key={w.t} className="rounded-2xl border border-border bg-card p-6">
                <div className="font-bold">{w.t}</div>
                <p className="mt-2 text-sm text-muted-foreground">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-4 py-20 bg-gradient-soft">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">AGENCY TIMELINE</p>
          <h2 className="text-3xl md:text-5xl font-bold">Our journey so far.</h2>
          <div className="mt-12 relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" aria-hidden />
            <div className="space-y-8">
              {TIMELINE.map((e) => (
                <div key={e.y} className="relative pl-12">
                  <div className="absolute left-2 top-1.5 size-4 rounded-full bg-gradient-primary ring-4 ring-background" />
                  <div className="text-sm font-bold text-primary">{e.y}</div>
                  <div className="text-lg font-bold mt-1">{e.t}</div>
                  <p className="text-muted-foreground mt-1">{e.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Internal linking */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">EXPLORE MORE</p>
          <h2 className="text-3xl md:text-4xl font-bold">Keep exploring SADA.</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            {[
              { to: "/blog", icon: BookOpen, t: "Read the blog", d: "Strategy, branding and growth essays from our team." },
              { to: "/portfolio", icon: Briefcase, t: "See case studies", d: "Real client work, real outcomes — start to ship." },
              { to: "/store", icon: Package, t: "Browse products", d: "Templates, kits and playbooks built by our studio." },
            ].map(({ to, icon: Icon, t, d }) => (
              <Link
                key={to + t}
                to={to}
                className="group rounded-2xl border border-border bg-card p-6 soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
              >
                <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4">
                  <Icon className="size-4" />
                </div>
                <div className="font-bold group-hover:text-primary transition-colors">{t}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{d}</p>
                <div className="mt-4 text-sm font-semibold text-primary inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                  Explore <ArrowRight className="size-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}

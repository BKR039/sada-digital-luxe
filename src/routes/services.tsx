import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { SmartMedia } from "@/components/media/SmartMedia";
import { CTA } from "@/components/site/CTA";
import { DIVISIONS, SCENARIOS, PROCESS } from "@/data/services";
import { ArrowRight, ArrowUpRight, Sparkles, Plus } from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Marketing, Development & Production | SADA" },
      {
        name: "description",
        content:
          "Explore SADA services across marketing, branding, web development and creative production — connected under one strategy to help businesses build and grow.",
      },
      { property: "og:title", content: "Services — Marketing, Development & Production | SADA" },
      {
        property: "og:description",
        content:
          "Explore SADA services across marketing, branding, web development and creative production — connected under one strategy to help businesses build and grow.",
      },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <>
      {/* HERO */}
      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold text-primary tracking-[0.3em] mb-3 inline-flex items-center gap-2 justify-center">
            <Sparkles className="size-3.5" /> WHAT WE DO
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.05]">
            Everything your brand needs. <span className="text-gradient">Under one vision.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Strategy, technology and production working together to build stronger brands and digital experiences.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link
              to="/contact"
              className="group inline-flex items-center gap-2 bg-gradient-primary text-white px-6 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform"
            >
              Start a Project
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#divisions"
              className="inline-flex items-center gap-2 bg-card border border-border text-foreground px-6 py-3.5 rounded-2xl font-semibold hover:bg-muted transition-colors soft-shadow"
            >
              Explore Services
            </a>
          </div>
        </div>
      </section>

      {/* THREE DIVISIONS — editorial, not cards */}
      <section id="divisions" className="px-4 py-16 md:py-20 scroll-mt-24">
        <div className="mx-auto max-w-5xl divide-y divide-border border-t border-b border-border">
          {DIVISIONS.map((d, i) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="py-10 md:py-12 grid md:grid-cols-[auto_1fr] gap-6 md:gap-10 items-start"
            >
              <div className="flex items-center gap-4 md:flex-col md:items-start">
                <span className="font-display text-4xl md:text-5xl font-bold text-muted-foreground/30">{d.number}</span>
                <div className="size-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary">
                  <d.icon className="size-5" />
                </div>
              </div>
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{d.name.toUpperCase()}</h2>
                <p className="mt-3 text-lg text-muted-foreground max-w-xl leading-relaxed">{d.oneLiner}</p>
                <p className="mt-5 text-sm text-foreground/80 leading-loose">
                  {d.services.join(" · ")}
                </p>
                <a
                  href={`#${d.id}`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all"
                >
                  {d.exploreCta} <ArrowRight className="size-4" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CLIENT PROBLEM / SCENARIOS */}
      <section className="px-4 py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">WHERE ARE YOU TODAY</p>
            <h2 className="text-3xl md:text-5xl font-bold">What does your business need right now?</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 gap-5">
            {SCENARIOS.map((s, i) => (
              <motion.div
                key={s.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-7 soft-shadow hover:elevated-shadow transition-shadow flex flex-col"
              >
                <span className="text-xs font-bold tracking-widest text-primary">{s.number}</span>
                <h3 className="mt-2 text-lg font-bold leading-snug">{s.question}</h3>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{s.combination.join(" · ")}</p>
                <Link
                  to="/contact"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all"
                >
                  {s.cta} <ArrowRight className="size-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY SADA — INTEGRATED SYSTEM */}
      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-6xl rounded-3xl glass-strong p-10 md:p-14">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">WHY SADA</p>
          <h2 className="text-3xl md:text-5xl font-bold max-w-2xl">Different disciplines. One direction.</h2>
          <div className="mt-6 max-w-2xl space-y-3 text-muted-foreground leading-relaxed">
            <p>Strong brands are rarely built by one discipline alone.</p>
            <p>
              Your strategy affects your identity. Your identity affects your content. Your content affects your
              marketing. Your digital experience affects conversion.
            </p>
            <p>SADA connects these decisions instead of treating them as separate projects.</p>
          </div>
          <div className="mt-10 pt-8 border-t border-border flex flex-wrap items-center gap-3 md:gap-5">
            {DIVISIONS.map((d, i) => (
              <span key={d.id} className="inline-flex items-center gap-3 md:gap-5">
                <span className="font-display text-lg md:text-2xl font-bold text-gradient">{d.name.toUpperCase()}</span>
                {i < DIVISIONS.length - 1 && <span className="text-muted-foreground text-lg">×</span>}
              </span>
            ))}
            <ArrowRight className="size-5 text-primary mx-1" />
            <span className="font-display text-lg md:text-2xl font-bold">ONE CONNECTED SYSTEM</span>
          </div>
        </div>
      </section>

      {/* DIVISION DETAIL SECTIONS */}
      {DIVISIONS.map((d, i) => (
        <section
          key={d.id}
          id={d.id}
          className={`px-4 py-16 md:py-20 scroll-mt-24 ${i % 2 === 1 ? "bg-gradient-soft" : ""}`}
        >
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary">
                <d.icon className="size-5" />
              </div>
              <p className="text-xs font-semibold tracking-[0.25em] text-primary">{d.number} · {d.name.toUpperCase()}</p>
            </div>
            <h2 className="mt-5 text-3xl md:text-4xl font-bold max-w-2xl">{d.detail.heading}</h2>
            <p className="mt-4 text-muted-foreground max-w-2xl leading-relaxed">{d.detail.problem}</p>

            <div className="mt-10 grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xs font-bold tracking-widest text-muted-foreground">WHAT SADA PROVIDES</h3>
                <ul className="mt-4 space-y-2.5">
                  {d.detail.provides.map((item) => (
                    <li key={item} className="text-sm text-foreground/90 border-b border-border/60 pb-2.5">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-widest text-muted-foreground">POSSIBLE DELIVERABLES</h3>
                <ul className="mt-4 space-y-2.5">
                  {d.detail.deliverables.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground border-b border-border/60 pb-2.5">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Link
              to="/contact"
              className="mt-10 inline-flex items-center gap-2 bg-gradient-primary text-white px-6 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform"
            >
              {d.detail.cta} <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ))}

      {/* HOW WE WORK */}
      <section className="px-4 py-16 md:py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">HOW WE WORK</p>
            <h2 className="text-3xl md:text-5xl font-bold">A simple, five-step process.</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {PROCESS.map((s) => (
              <div key={s.number} className="rounded-2xl border border-border bg-card p-6 soft-shadow">
                <div className="text-xs font-bold tracking-widest text-primary">{s.number}</div>
                <div className="mt-2 text-lg font-bold">{s.name}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CROSS-SERVICE PROJECTS */}
      <section className="px-4 py-16 md:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">CROSS-SERVICE PROJECTS</p>
          <h2 className="text-3xl md:text-5xl font-bold max-w-2xl">One project can need more than one discipline.</h2>
          <p className="mt-4 text-muted-foreground max-w-xl">A brand launch could involve:</p>

          <div className="mt-10 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {[
              { d: DIVISIONS[0], contribution: "Positioning + Strategy" },
              { d: DIVISIONS[1], contribution: "Website" },
              { d: DIVISIONS[2], contribution: "Launch Campaign" },
            ].map(({ d, contribution }, i, arr) => (
              <div key={d.id} className="flex items-center gap-4 md:contents">
                <div className="flex-1 rounded-2xl border border-border bg-card p-6 soft-shadow">
                  <div className="flex items-center gap-2.5 text-primary">
                    <d.icon className="size-4" />
                    <span className="text-xs font-bold tracking-widest">{d.name.toUpperCase()}</span>
                  </div>
                  <div className="mt-2 font-semibold">{contribution}</div>
                </div>
                {i < arr.length - 1 && (
                  <Plus className="size-5 text-muted-foreground shrink-0 hidden md:block" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <SelectedWork />

      {/* FINAL CTA */}
      <CTA
        title="Not sure which service you need?"
        subtitle="Tell us where your business is today and where you want to take it. We'll help define the right direction."
        primaryLabel="Start a Project"
        primaryTo="/contact"
        secondaryLabel="Contact SADA"
        secondaryTo="/contact"
      />
    </>
  );
}

interface WorkItem {
  id: string;
  title: string;
  slug: string;
  client: string | null;
  category: string | null;
  thumbnail_url: string | null;
  cover_url: string | null;
  services: string[] | null;
}

function SelectedWork() {
  const [items, setItems] = useState<WorkItem[]>([]);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id,title,slug,client,category,thumbnail_url,cover_url,services")
      .eq("published", true)
      .eq("featured", true)
      .order("sort_order")
      .limit(3)
      .then(({ data }) => setItems((data as WorkItem[]) || []));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="px-4 py-16 md:py-20 bg-gradient-soft">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between gap-6 flex-wrap mb-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">SELECTED WORK</p>
            <h2 className="text-3xl md:text-5xl font-bold">See it in practice.</h2>
          </div>
          <Link to="/portfolio" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all">
            View all work <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
            >
              <Link
                to="/portfolio/$slug"
                params={{ slug: p.slug }}
                className="group block rounded-3xl border border-border bg-card overflow-hidden soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {p.thumbnail_url || p.cover_url ? (
                    <SmartMedia src={p.thumbnail_url || p.cover_url} className="w-full h-full transition-transform duration-700 group-hover:scale-105" autoplay={false} />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-6xl font-display font-bold text-gradient bg-gradient-to-br from-primary/15 to-accent/15">
                      {p.title.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  {p.client && <div className="text-sm text-muted-foreground">{p.client}</div>}
                  <h3 className="mt-1 font-bold group-hover:text-primary transition-colors">{p.title}</h3>
                  {p.services && p.services.length > 0 && (
                    <p className="mt-2 text-xs text-primary font-medium">{p.services.slice(0, 3).join(" · ")}</p>
                  )}
                  <div className="mt-4 text-sm font-semibold text-primary inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                    View Case Study <ArrowUpRight className="size-3.5" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

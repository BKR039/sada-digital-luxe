import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CTA } from "@/components/site/CTA";
import { teamMembers } from "@/data/team";
import { Sparkles, Megaphone, Code2, Clapperboard, Users, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SADA — Marketing, Development & Production" },
      {
        name: "description",
        content:
          "Meet SADA, a creative company combining marketing, development and production to build brands, digital experiences and content that move businesses forward.",
      },
      { property: "og:title", content: "About SADA — Marketing, Development & Production" },
      {
        property: "og:description",
        content:
          "Meet SADA, a creative company combining marketing, development and production to build brands, digital experiences and content that move businesses forward.",
      },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

const DIVISIONS = [
  {
    name: "Marketing",
    icon: Megaphone,
    items: ["Branding", "Marketing Strategy", "Content Strategy", "Social Media", "Advertising", "Growth"],
  },
  {
    name: "Development",
    icon: Code2,
    items: ["Web Design", "Web Development", "UI/UX", "Digital Products", "Automation", "AI Integration"],
  },
  {
    name: "Production",
    icon: Clapperboard,
    items: ["Creative Direction", "Video Production", "Reels", "Photography", "Motion", "Campaign Production"],
  },
];

function AboutPage() {
  return (
    <>
      {/* SECTION 01 — HERO */}
      <section className="px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold text-primary tracking-[0.3em] mb-3 inline-flex items-center gap-2 justify-center">
            <Sparkles className="size-3.5" /> ABOUT SADA
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.05]">
            We build brands, digital experiences and <span className="text-gradient">content that move businesses forward</span>.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
            SADA is a creative company combining marketing, development and production to help ambitious
            businesses build stronger brands and digital experiences.
          </p>
        </div>
      </section>

      {/* SECTION 02 — WHAT SADA DOES */}
      <section className="px-4 py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">WHAT SADA DOES</p>
            <h2 className="text-3xl md:text-5xl font-bold">Three divisions, one studio.</h2>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-5">
            {DIVISIONS.map(({ name, icon: Icon, items }) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5 }}
                className="rounded-3xl border border-border bg-card p-8 soft-shadow hover:elevated-shadow transition-shadow"
              >
                <div className="size-12 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary mb-5">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-xl font-bold">{name}</h3>
                <ul className="mt-4 space-y-2">
                  {items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 03 — OUR VISION */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl rounded-3xl glass-strong p-10 md:p-14">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">OUR VISION</p>
          <h2 className="text-3xl md:text-5xl font-bold max-w-3xl">More than an agency.</h2>
          <div className="mt-6 max-w-2xl space-y-4 text-muted-foreground leading-relaxed">
            <p>
              SADA was built around a simple idea: businesses shouldn't have to coordinate between separate
              marketers, designers, developers and production teams to build a strong presence.
            </p>
            <p>We bring strategy, creativity, technology and production together under one vision.</p>
          </div>
          <div className="mt-10 pt-8 border-t border-border">
            <p className="font-display text-xl md:text-2xl font-bold text-gradient">
              Marketing × Development × Production
            </p>
            <p className="mt-2 text-muted-foreground">→ One creative ecosystem.</p>
          </div>
        </div>
      </section>

      {/* TEAM */}
      <section className="px-4 py-20 bg-gradient-soft">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3 inline-flex items-center gap-2">
              <Users className="size-3.5" /> THE TEAM
            </p>
            <h2 className="text-3xl md:text-5xl font-bold">Meet the team.</h2>
            <p className="mt-3 text-muted-foreground">The people building SADA.</p>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {teamMembers.map((m) => {
              const platformLabel = m.profileType === "linkedin" ? "LinkedIn" : "Behance";
              return (
                <a
                  key={m.name}
                  href={m.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${m.name} on ${platformLabel}`}
                  className="group relative flex flex-col rounded-2xl border border-border bg-card p-6 soft-shadow hover:elevated-shadow hover:-translate-y-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className="size-14 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 grid place-items-center text-primary group-hover:scale-105 transition-transform duration-200">
                    <m.icon className="size-6" aria-hidden="true" />
                  </div>
                  <div className="mt-5">
                    <div className="font-display text-lg font-bold">{m.name}</div>
                    <div className="text-sm text-primary font-medium mt-0.5">{m.role}</div>
                    <div className="text-xs text-muted-foreground mt-1.5">{m.specialty}</div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors duration-200">
                    <span>{platformLabel}</span>
                    <ArrowUpRight className="size-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" aria-hidden="true" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}

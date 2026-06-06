import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, ArrowRight, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — SADA Creative Agency" },
      {
        name: "description",
        content:
          "Transparent pricing for branding, content, social media, paid ads, and video production. Built for brands that want measurable growth.",
      },
      { property: "og:title", content: "Pricing — SADA Creative Agency" },
      {
        property: "og:description",
        content:
          "Premium creative services with honest pricing — branding, content, social, paid ads, and video.",
      },
      { property: "og:url", content: "/pricing" },
    ],
    links: [{ rel: "canonical", href: "/pricing" }],
  }),
  component: PricingPage,
});

type Plan = {
  name: string;
  tagline: string;
  monthly: number | null;
  project: number | null;
  unit: string;
  features: string[];
  popular?: boolean;
  cta: string;
};

const PLANS: Plan[] = [
  {
    name: "Branding",
    tagline: "Identity systems people remember.",
    monthly: null,
    project: 2500,
    unit: "project",
    features: [
      "Brand strategy & positioning",
      "Logo system + typography",
      "Color & visual language",
      "Brand guidelines (PDF)",
      "Social media templates",
    ],
    cta: "Start branding",
  },
  {
    name: "Content Creation",
    tagline: "Monthly photo + video shoot days.",
    monthly: 1800,
    project: null,
    unit: "month",
    features: [
      "1 production day / month",
      "30+ social-ready assets",
      "Editing & color grading",
      "Format library setup",
      "Content calendar",
    ],
    cta: "Plan a shoot",
  },
  {
    name: "Social Management",
    tagline: "We run the channels. You run the business.",
    monthly: 1200,
    project: null,
    unit: "month",
    features: [
      "Strategy + monthly calendar",
      "4 posts / week",
      "Stories + reels editing",
      "Community management",
      "Monthly performance report",
    ],
    popular: true,
    cta: "Grow with SADA",
  },
  {
    name: "Paid Ads",
    tagline: "Performance creative + media buying.",
    monthly: 1500,
    project: null,
    unit: "month",
    features: [
      "Meta + TikTok + Google",
      "8–12 creatives / month",
      "Creative testing matrix",
      "Pixel + conversion setup",
      "Weekly optimization",
    ],
    cta: "Scale with ads",
  },
  {
    name: "Video Production",
    tagline: "Cinematic brand films & ads.",
    monthly: null,
    project: 3500,
    unit: "project",
    features: [
      "Concept + script + storyboard",
      "Half-day shoot",
      "Edit, color, sound design",
      "Up to 3 deliverables",
      "Social cutdowns included",
    ],
    cta: "Brief a video",
  },
];

const FAQ = [
  {
    q: "How fast can we start?",
    a: "Most engagements kick off within 5–7 business days of contract signature. Branding projects begin with a 1-hour discovery call within 48 hours.",
  },
  {
    q: "Do you offer custom packages?",
    a: "Yes. Roughly half our clients run a custom blend of services. Tell us about your goals and we'll send a tailored scope and quote.",
  },
  {
    q: "What's the typical engagement length?",
    a: "Branding and video are project-based. Content, social, and paid ads run on rolling monthly retainers with a 3-month minimum.",
  },
  {
    q: "Do prices include ad spend?",
    a: "No — ad spend is paid directly to the platform. Our paid-ads retainer covers strategy, creative, media buying, and reporting.",
  },
  {
    q: "Can you work with our in-house team?",
    a: "Absolutely. We often plug into existing marketing teams as the creative or growth engine.",
  },
];

function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "project">("monthly");
  const visible = PLANS.filter((p) => (billing === "monthly" ? p.monthly !== null : p.project !== null));

  return (
    <div className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">PRICING</p>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.05]">
            Honest pricing for <span className="text-gradient">premium work</span>.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Pick a starting point or talk to us about a custom blend. Every plan is built around
            measurable outcomes — not deliverables-for-deliverables-sake.
          </p>

          <div className="mt-8 inline-flex items-center p-1 rounded-full border border-border bg-card soft-shadow">
            {(["monthly", "project"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setBilling(mode)}
                className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                  billing === mode
                    ? "bg-gradient-primary text-white shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode === "monthly" ? "Monthly retainers" : "One-off projects"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((plan, i) => {
            const price = billing === "monthly" ? plan.monthly : plan.project;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className={`relative rounded-3xl p-7 flex flex-col ${
                  plan.popular
                    ? "bg-gradient-to-br from-primary/10 via-card to-card border-2 border-primary/30 elevated-shadow"
                    : "glass"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-primary text-white text-xs font-semibold">
                    <Sparkles className="size-3" /> Most popular
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.tagline}</p>
                </div>
                <div className="my-6">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold">${price?.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/ {plan.unit}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-7 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 size-5 rounded-full bg-primary/10 grid place-items-center shrink-0">
                        <Check className="size-3 text-primary" />
                      </span>
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contact"
                  className={`mt-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? "bg-gradient-primary text-white neon-glow hover:scale-[1.02]"
                      : "border border-border hover:bg-muted"
                  }`}
                >
                  {plan.cta} <ArrowRight className="size-4" />
                </Link>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-14 rounded-3xl glass-strong p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold">Need a custom quote?</h3>
            <p className="mt-2 text-muted-foreground max-w-xl">
              Multi-service engagements, in-house teams, or ambitious campaigns — tell us the goal
              and we'll send a tailored scope within 48 hours.
            </p>
          </div>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-primary text-white font-semibold neon-glow hover:scale-[1.02] transition-transform"
          >
            Request custom quote <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-20 max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold">Questions, answered.</h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <FaqRow key={item.q} item={item} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqRow({ item, index }: { item: { q: string; a: string }; index: number }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="font-semibold">{item.q}</span>
        <ChevronDown
          className={`size-5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-muted-foreground leading-relaxed">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

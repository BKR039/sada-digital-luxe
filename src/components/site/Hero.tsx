import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, TrendingUp, Eye, Heart, Play, Instagram, Youtube } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-8 sm:pt-12 pb-20 sm:pb-28">
      {/* Soft ambient background */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div className="pointer-events-none absolute -top-32 -right-24 size-[520px] rounded-full bg-primary/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-40 -left-32 size-[420px] rounded-full bg-accent/10 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* LEFT */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium soft-shadow">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-muted-foreground">Creative · Branding · Growth Studio</span>
          </div>

          <h1 className="mt-6 text-[2.6rem] sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.02] font-bold">
            Build your brand <br className="hidden sm:block" />
            <span className="text-gradient">faster.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl">
            Content, branding and paid growth — engineered to convert.
            We turn ambitious brands into the ones people remember.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="group inline-flex items-center gap-2 bg-gradient-primary text-white px-6 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform"
            >
              Start a Project
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 bg-card border border-border text-foreground px-6 py-3.5 rounded-2xl font-semibold hover:bg-muted transition-colors soft-shadow"
            >
              View Our Work
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            {[
              { k: "120+", v: "Projects shipped" },
              { k: "40M+", v: "Impressions generated" },
              { k: "95%", v: "Retention rate" },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-2xl font-display font-bold text-foreground">{s.k}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* RIGHT — Dashboard mockup */}
        <HeroMockup />
      </div>
    </section>
  );
}

function HeroMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[560px]"
    >
      {/* Glow halo */}
      <div className="absolute -inset-6 bg-gradient-primary opacity-20 blur-3xl rounded-[3rem]" />

      {/* Main dashboard card */}
      <div className="relative rounded-3xl border border-border bg-card p-5 sm:p-6 elevated-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-yellow-400/80" />
            <span className="size-2.5 rounded-full bg-green-400/80" />
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">SADA · Analytics</div>
        </div>

        <div className="mt-5 flex items-baseline justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total reach this month</div>
            <div className="mt-1 text-3xl sm:text-4xl font-display font-bold text-foreground">8.4M</div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold">
            <TrendingUp className="size-3.5" /> +312%
          </div>
        </div>

        {/* Sparkline-ish bars */}
        <div className="mt-6 grid grid-cols-12 gap-1.5 items-end h-24">
          {[30, 45, 38, 60, 52, 70, 65, 82, 76, 88, 95, 100].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.6, ease: "easeOut" }}
              className="rounded-md bg-gradient-to-t from-primary to-accent"
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { Icon: Eye, label: "Views", value: "2.1M" },
            { Icon: Heart, label: "Engagement", value: "184k" },
            { Icon: Play, label: "Watch time", value: "92h" },
          ].map(({ Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-muted/40 p-3">
              <Icon className="size-3.5 text-primary" />
              <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-4 -left-4 sm:-left-8 rounded-2xl border border-border bg-card p-3 soft-shadow flex items-center gap-2.5"
      >
        <div className="size-9 rounded-xl bg-gradient-primary grid place-items-center">
          <Instagram className="size-4 text-white" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">New reel</div>
          <div className="text-sm font-semibold">+12.4k views</div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -bottom-5 -right-3 sm:-right-6 rounded-2xl border border-border bg-card p-3 soft-shadow flex items-center gap-2.5"
      >
        <div className="size-9 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 grid place-items-center">
          <Youtube className="size-4 text-white" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign live</div>
          <div className="text-sm font-semibold">CTR 6.8%</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

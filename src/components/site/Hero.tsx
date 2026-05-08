import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Camera, Globe, Megaphone, Heart, TrendingUp } from "lucide-react";
import logo from "@/assets/sada-mark.png";

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute -top-32 -right-20 size-[600px] rounded-full bg-primary/20 blur-[120px] animate-pulse-glow" />
      <div className="absolute -bottom-20 -left-20 size-[500px] rounded-full bg-accent/15 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-12 items-center py-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium mb-6">
            <Sparkles className="size-3.5 text-accent" />
            <span className="text-muted-foreground">Creative · Branding · Growth Studio</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight">
            We build brands<br />
            that get <span className="text-gradient">noticed.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            We help businesses grow through powerful content, smart strategy, and creative storytelling — content that doesn't just get watched, it convinces.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/services" className="group inline-flex items-center gap-2 bg-gradient-primary text-white px-7 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform">
              Explore Services
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/portfolio" className="inline-flex items-center gap-2 glass-strong px-7 py-3.5 rounded-2xl font-semibold hover:cyan-glow transition-all">
              View Our Work
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-8 text-sm">
            {[
              { k: "120+", v: "Projects shipped" },
              { k: "40M+", v: "Impressions generated" },
              { k: "95%", v: "Retention rate" },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-2xl font-display font-bold text-gradient">{s.k}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }}
          className="relative flex justify-center items-center h-[500px]">
          {/* Orbital rings */}
          <div className="absolute inset-0 grid place-items-center">
            <div className="size-[420px] rounded-full border border-primary/30 animate-[spin_30s_linear_infinite]" />
          </div>
          <div className="absolute inset-0 grid place-items-center">
            <div className="size-[300px] rounded-full border border-accent/30 animate-[spin_20s_linear_infinite_reverse]" />
          </div>
          {/* Floating icons */}
          {[
            { Icon: Camera, x: -180, y: -120, d: 0 },
            { Icon: Globe, x: 170, y: -140, d: 0.3 },
            { Icon: Megaphone, x: -200, y: 100, d: 0.6 },
            { Icon: Heart, x: 190, y: 120, d: 0.9 },
            { Icon: TrendingUp, x: 0, y: -200, d: 1.2 },
          ].map(({ Icon, x, y, d }, i) => (
            <motion.div key={i}
              animate={{ y: [y, y - 15, y], }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: d }}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              className="absolute glass rounded-2xl p-4 cyan-glow">
              <Icon className="size-6 text-accent" />
            </motion.div>
          ))}
          {/* Center logo */}
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 glass-strong rounded-3xl p-10 cyan-glow">
            <img src={logo} alt="SADA" className="size-32 object-contain animate-float" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

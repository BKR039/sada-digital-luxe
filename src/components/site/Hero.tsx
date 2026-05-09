import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, Instagram, Youtube, Facebook, Globe, Camera, Palette } from "lucide-react";
import logo from "@/assets/sada-mark.png";

const TikTok = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.69a8.16 8.16 0 0 0 4.77 1.52V7.83a4.85 4.85 0 0 1-1.84-1.14z"/>
  </svg>
);

const ALL_ICONS = [
  { Icon: Instagram, color: "text-pink-300" },
  { Icon: TikTok, color: "text-white" },
  { Icon: Youtube, color: "text-red-400" },
  { Icon: Facebook, color: "text-blue-300" },
  { Icon: Globe, color: "text-accent" },
  { Icon: Camera, color: "text-cyan-300" },
  { Icon: Palette, color: "text-primary-foreground" },
];

export function Hero() {
  const reduce = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const [showOrbit, setShowOrbit] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    // Defer heavy orbit/glow until after first paint
    const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 200));
    const id = idle(() => setShowOrbit(true));
    return () => {
      mq.removeEventListener("change", upd);
      if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(id);
    };
  }, []);

  const icons = isMobile ? ALL_ICONS.slice(0, 4) : ALL_ICONS;

  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden -mt-24 pt-24">
      {/* Continuous ambient background — extends behind navbar */}
      <div className="absolute inset-0 grid-bg opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      {showOrbit && !isMobile && (
        <>
          <div className="absolute -top-40 -right-32 size-[520px] rounded-full bg-primary/15 blur-[90px] animate-pulse-glow" />
          <div className="absolute -bottom-32 -left-32 size-[420px] rounded-full bg-accent/10 blur-[90px] animate-pulse-glow" style={{ animationDelay: "1.8s" }} />
        </>
      )}
      {showOrbit && isMobile && (
        <div className="absolute -top-32 -right-20 size-[380px] rounded-full bg-primary/12 blur-[60px]" />
      )}
      {/* Soft top vignette so navbar floats */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 via-background/30 to-transparent pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 grid lg:grid-cols-2 gap-12 items-center py-16 lg:py-20">
        <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-[11px] font-accent mb-6">
            <Sparkles className="size-3.5 text-accent" />
            <span className="text-muted-foreground">Creative · Branding · Growth Studio</span>
          </div>
          <h1 className="text-5xl md:text-7xl leading-[0.92]">
            We build brands<br />
            that get <span className="text-gradient">noticed.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            We help businesses grow through powerful content, smart strategy, and creative storytelling — content that doesn't just get watched, it convinces.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/services" className="btn group inline-flex items-center gap-2 bg-gradient-primary text-white px-7 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform">
              Explore Services
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/portfolio" className="btn inline-flex items-center gap-2 glass-strong px-7 py-3.5 rounded-2xl font-semibold hover:cyan-glow transition-all">
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
                <div className="text-[10px] text-muted-foreground font-accent">{s.v}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <SingleOrbit icons={icons} reduce={!!reduce} isMobile={isMobile} ready={showOrbit} />
      </div>
    </section>
  );
}

function SingleOrbit({
  icons,
  reduce,
  isMobile,
  ready,
}: {
  icons: { Icon: React.ComponentType<{ className?: string }>; color: string }[];
  reduce: boolean;
  isMobile: boolean;
  ready: boolean;
}) {
  const duration = isMobile ? 40 : 30;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex justify-center items-center h-[340px] w-[320px] sm:h-[480px] sm:w-[480px] lg:h-[560px] lg:w-[560px]"
    >
      {/* Aura — soft breathing glow */}
      {ready && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="size-[55%] rounded-full bg-primary/25"
            style={{ animation: reduce ? undefined : "aura-breathe 6s ease-in-out infinite", filter: isMobile ? "blur(28px)" : "blur(45px)" }}
          />
        </div>
      )}
      {ready && !isMobile && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="size-[35%] rounded-full bg-accent/20"
            style={{ animation: reduce ? undefined : "aura-breathe 7.5s ease-in-out infinite", animationDelay: "1.2s", filter: "blur(50px)" }}
          />
        </div>
      )}

      {/* Single thin orbit line */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div
          className="rounded-full border"
          style={{
            width: "82%",
            height: "82%",
            borderColor: "oklch(0.66 0.22 250 / 0.25)",
            boxShadow:
              "inset 0 0 30px oklch(0.66 0.22 250 / 0.12), 0 0 24px oklch(0.82 0.18 220 / 0.15)",
          }}
        />
      </div>

      {/* Orbiting icons */}
      {ready && !reduce && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="relative"
            style={{
              width: "82%",
              height: "82%",
              animation: `orbit-spin ${duration}s linear infinite`,
              willChange: "transform",
            }}
          >
            {icons.map(({ Icon, color }, i) => {
              const angle = (360 / icons.length) * i;
              return (
                <div key={i} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                  <div
                    className="absolute"
                    style={{ top: 0, left: "50%", transform: "translate(-50%, -50%)" }}
                  >
                    <div
                      className="pointer-events-auto"
                      style={{
                        animation: `orbit-counter ${duration}s linear infinite`,
                        willChange: "transform",
                      }}
                    >
                      <div className="glass rounded-2xl p-2.5 sm:p-3">
                        <Icon className={`size-4 sm:size-5 ${color}`} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Static fallback icons for reduced motion */}
      {reduce && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="relative" style={{ width: "82%", height: "82%" }}>
            {icons.map(({ Icon, color }, i) => {
              const angle = (360 / icons.length) * i;
              return (
                <div key={i} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                  <div className="absolute" style={{ top: 0, left: "50%", transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}>
                    <div className="glass rounded-2xl p-2.5 sm:p-3">
                      <Icon className={`size-4 sm:size-5 ${color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Center logo */}
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 glass-strong rounded-3xl p-6 sm:p-8 lg:p-10"
        style={{ boxShadow: "0 0 80px -10px oklch(0.66 0.22 250 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.1)" }}
      >
        <img src={logo} alt="SADA" className="size-20 sm:size-28 lg:size-32 object-contain" />
      </motion.div>
    </motion.div>
  );
}

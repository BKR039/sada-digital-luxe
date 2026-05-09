import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  Instagram,
  Youtube,
  Facebook,
  Globe,
  Palette,
  Video,
  BarChart3,
  Megaphone,
  Layout,
} from "lucide-react";
import logo from "@/assets/sada-mark.png";

const TikTok = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.69a8.16 8.16 0 0 0 4.77 1.52V7.83a4.85 4.85 0 0 1-1.84-1.14z" />
  </svg>
);

const FADE_UP = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export function Hero() {
  const reduce = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const [showFx, setShowFx] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const upd = () => setIsMobile(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    const idle =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 180));
    const id = idle(() => setShowFx(true));
    return () => {
      mq.removeEventListener("change", upd);
      if ((window as any).cancelIdleCallback)
        (window as any).cancelIdleCallback(id);
    };
  }, []);

  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden -mt-24 pt-24">
      {/* Background system */}
      <BackgroundFX show={showFx} reduce={!!reduce} isMobile={isMobile} />

      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center py-14 lg:py-20">
        {/* LEFT — content */}
        <div>
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-[11px] font-accent mb-6"
          >
            <Sparkles className="size-3.5 text-accent" />
            <span className="text-muted-foreground tracking-[0.2em]">
              Content · Branding · Growth
            </span>
          </motion.div>

          <motion.h1
            {...FADE_UP}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-[4.5rem] leading-[0.95] font-display font-bold"
          >
            We Create Brands<br />
            That <span className="text-gradient">Dominate</span>{" "}
            <span className="text-gradient">Attention.</span>
          </motion.h1>

          <motion.p
            {...FADE_UP}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
          >
            SADA helps businesses grow through cinematic content, strategic
            branding, and digital experiences designed to convert.
          </motion.p>

          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="mt-9 flex flex-wrap gap-3 sm:gap-4"
          >
            <Link
              to="/contact"
              className="group relative inline-flex items-center gap-2 bg-gradient-primary text-white px-6 sm:px-7 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform overflow-hidden"
            >
              <span className="relative z-10">Start Your Project</span>
              <ArrowRight className="relative z-10 size-4 group-hover:translate-x-1 transition-transform" />
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </Link>
            <Link
              to="/portfolio"
              className="group inline-flex items-center gap-2 glass-strong px-6 sm:px-7 py-3.5 rounded-2xl font-semibold hover:cyan-glow transition-all"
            >
              View Portfolio
              <ArrowRight className="size-4 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>

          {/* Stat cards */}
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-10 grid grid-cols-3 gap-3 sm:gap-4 max-w-xl"
          >
            {[
              { k: "+120", v: "Projects Delivered" },
              { k: "+40M", v: "Views Generated" },
              { k: "95%", v: "Client Satisfaction" },
            ].map((s) => (
              <div
                key={s.v}
                className="group glass rounded-2xl px-3 py-3 sm:px-4 sm:py-4 transition-all hover:-translate-y-0.5 hover:cyan-glow"
              >
                <div className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-gradient">
                  {s.k}
                </div>
                <div className="text-[9px] sm:text-[10px] text-muted-foreground font-accent mt-1 leading-tight">
                  {s.v}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT — Creative Core */}
        <CreativeCore reduce={!!reduce} isMobile={isMobile} ready={showFx} />
      </div>
    </section>
  );
}

/* ---------------- Background ---------------- */

function BackgroundFX({
  show,
  reduce,
  isMobile,
}: {
  show: boolean;
  reduce: boolean;
  isMobile: boolean;
}) {
  return (
    <>
      {/* Deep gradient base */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, oklch(0.28 0.18 250 / 0.35), transparent 60%), radial-gradient(900px 600px at 90% 90%, oklch(0.4 0.2 220 / 0.22), transparent 55%), linear-gradient(180deg, oklch(0.13 0.04 260) 0%, oklch(0.09 0.03 260) 100%)",
        }}
      />
      {/* Animated grid */}
      <div className="absolute inset-0 grid-bg opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />

      {/* Glow blobs */}
      {show && !isMobile && (
        <>
          <div className="absolute -top-40 -right-32 size-[520px] rounded-full bg-primary/20 blur-[100px] animate-pulse-glow" />
          <div
            className="absolute -bottom-40 -left-32 size-[460px] rounded-full bg-accent/15 blur-[110px] animate-pulse-glow"
            style={{ animationDelay: "1.6s" }}
          />
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 size-[300px] rounded-full bg-primary/10 blur-[120px]"
          />
        </>
      )}
      {show && isMobile && (
        <div className="absolute -top-32 right-0 size-[360px] rounded-full bg-primary/15 blur-[70px]" />
      )}

      {/* Light streaks */}
      {show && !reduce && !isMobile && (
        <>
          <div
            className="absolute left-[12%] top-0 w-px h-[55%] opacity-50"
            style={{
              background:
                "linear-gradient(to bottom, transparent, oklch(0.82 0.18 220 / 0.7), transparent)",
              animation: "streak 7s ease-in-out infinite",
            }}
          />
          <div
            className="absolute right-[18%] top-[10%] w-px h-[40%] opacity-40"
            style={{
              background:
                "linear-gradient(to bottom, transparent, oklch(0.66 0.22 250 / 0.7), transparent)",
              animation: "streak 9s ease-in-out infinite",
              animationDelay: "2s",
            }}
          />
        </>
      )}

      {/* Noise overlay */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Top vignette so navbar floats */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 via-background/30 to-transparent pointer-events-none" />
    </>
  );
}

/* ---------------- Creative Core ---------------- */

const FLOATING_CARDS = [
  { Icon: Video, label: "Video", color: "text-cyan-300", x: "-78%", y: "-42%", delay: 0 },
  { Icon: Palette, label: "Branding", color: "text-primary-foreground", x: "78%", y: "-46%", delay: 0.6 },
  { Icon: TikTok, label: "TikTok", color: "text-white", x: "-86%", y: "10%", delay: 1.2 },
  { Icon: Instagram, label: "Instagram", color: "text-pink-300", x: "82%", y: "14%", delay: 0.9 },
  { Icon: Megaphone, label: "Meta Ads", color: "text-blue-300", x: "-58%", y: "62%", delay: 1.6 },
  { Icon: Layout, label: "Web Design", color: "text-accent", x: "62%", y: "60%", delay: 0.3 },
  { Icon: BarChart3, label: "Analytics", color: "text-cyan-300", x: "0%", y: "-78%", delay: 1.9 },
  { Icon: Youtube, label: "YouTube", color: "text-red-400", x: "0%", y: "78%", delay: 2.2 },
  { Icon: Facebook, label: "Facebook", color: "text-blue-300", x: "-100%", y: "-8%", delay: 2.5 },
  { Icon: Globe, label: "Web", color: "text-accent", x: "100%", y: "38%", delay: 1.4 },
];

function CreativeCore({
  reduce,
  isMobile,
  ready,
}: {
  reduce: boolean;
  isMobile: boolean;
  ready: boolean;
}) {
  // Mobile shows fewer cards for performance
  const cards = isMobile ? FLOATING_CARDS.slice(0, 5) : FLOATING_CARDS;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex justify-center items-center h-[360px] w-[320px] sm:h-[480px] sm:w-[480px] lg:h-[580px] lg:w-[580px]"
    >
      {/* Outer ambient aura */}
      {ready && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="size-[70%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, oklch(0.66 0.22 250 / 0.45), transparent 65%)",
              filter: isMobile ? "blur(30px)" : "blur(50px)",
              animation: reduce ? undefined : "aura-breathe 7s ease-in-out infinite",
            }}
          />
        </div>
      )}
      {ready && !isMobile && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="size-[45%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, oklch(0.82 0.18 220 / 0.4), transparent 70%)",
              filter: "blur(55px)",
              animation: reduce ? undefined : "aura-breathe 9s ease-in-out infinite",
              animationDelay: "1.4s",
            }}
          />
        </div>
      )}

      {/* Glass sphere */}
      <div
        className="relative z-10 rounded-full grid place-items-center"
        style={{
          width: "min(86%, 360px)",
          aspectRatio: "1 / 1",
          background:
            "radial-gradient(circle at 30% 25%, oklch(1 0 0 / 0.18), transparent 45%), radial-gradient(circle at 70% 80%, oklch(0.66 0.22 250 / 0.35), transparent 55%), oklch(0.18 0.05 260 / 0.5)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid oklch(0.7 0.18 240 / 0.35)",
          boxShadow:
            "0 0 80px -10px oklch(0.66 0.22 250 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.18), inset 0 -40px 80px -20px oklch(0.66 0.22 250 / 0.25)",
        }}
      >
        {/* Inner highlight ring */}
        <div
          aria-hidden
          className="absolute inset-3 rounded-full pointer-events-none"
          style={{
            border: "1px solid oklch(1 0 0 / 0.08)",
          }}
        />
        {/* Pulsing logo */}
        <motion.div
          animate={reduce ? undefined : { scale: [1, 1.04, 1], y: [0, -4, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
        >
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full"
            style={{
              boxShadow:
                "0 0 60px 10px oklch(0.66 0.22 250 / 0.6), 0 0 100px 20px oklch(0.82 0.18 220 / 0.35)",
              animation: reduce ? undefined : "aura-breathe 4s ease-in-out infinite",
            }}
          />
          <img
            src={logo}
            alt="SADA"
            className="size-20 sm:size-28 lg:size-32 object-contain drop-shadow-[0_0_24px_oklch(0.66_0.22_250/0.8)]"
          />
        </motion.div>

        {/* Orbital subtle rings inside sphere */}
        {ready && !isMobile && !reduce && (
          <>
            <div
              className="absolute inset-[14%] rounded-full pointer-events-none"
              style={{
                border: "1px dashed oklch(0.82 0.18 220 / 0.25)",
                animation: "orbit-spin 40s linear infinite",
              }}
            />
            <div
              className="absolute inset-[28%] rounded-full pointer-events-none"
              style={{
                border: "1px solid oklch(0.66 0.22 250 / 0.18)",
                animation: "orbit-spin 60s linear infinite reverse",
              }}
            />
          </>
        )}
      </div>

      {/* Floating cards */}
      {ready &&
        cards.map(({ Icon, label, color, x, y, delay }, i) => (
          <FloatingCard
            key={i}
            Icon={Icon}
            label={label}
            color={color}
            x={x}
            y={y}
            delay={delay}
            reduce={reduce}
            isMobile={isMobile}
          />
        ))}

      {/* Particles */}
      {ready && !reduce && !isMobile && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 10 }).map((_, i) => {
            const left = (i * 97) % 100;
            const top = (i * 53) % 100;
            const dur = 6 + (i % 4);
            return (
              <span
                key={i}
                className="absolute size-1 rounded-full bg-accent/70"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  boxShadow: "0 0 8px oklch(0.82 0.18 220 / 0.9)",
                  animation: `particle-float ${dur}s ease-in-out ${i * 0.3}s infinite`,
                }}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function FloatingCard({
  Icon,
  label,
  color,
  x,
  y,
  delay,
  reduce,
  isMobile,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  x: string;
  y: string;
  delay: number;
  reduce: boolean;
  isMobile: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.3 + delay * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-1/2 top-1/2 pointer-events-auto"
      style={{
        transform: `translate(calc(-50% + ${x}), calc(-50% + ${y}))`,
      }}
    >
      <div
        className="group glass-strong rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 flex items-center gap-2 transition-all hover:-translate-y-1 hover:cyan-glow"
        style={{
          animation: reduce
            ? undefined
            : `card-float ${5 + (delay % 3)}s ease-in-out ${delay}s infinite`,
          willChange: "transform",
        }}
      >
        <Icon className={`size-3.5 sm:size-4 ${color}`} />
        {!isMobile && (
          <span className="text-[10px] sm:text-[11px] font-accent text-foreground/85 tracking-wider">
            {label}
          </span>
        )}
      </div>
    </motion.div>
  );
}

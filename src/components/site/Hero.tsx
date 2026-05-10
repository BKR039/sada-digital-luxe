import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Play,
  Sparkles,
  Instagram,
  Youtube,
  Facebook,
  Camera,
  Palette,
  Share2,
  Globe2,
  Megaphone,
  TrendingUp,
} from "lucide-react";

const TikTok = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V9.69a8.16 8.16 0 0 0 4.77 1.52V7.83a4.85 4.85 0 0 1-1.84-1.14z" />
  </svg>
);

const FADE_UP = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

const SERVICES = [
  { Icon: Camera, label: "Content Creation", desc: "Cinematic video & photo" },
  { Icon: Palette, label: "Branding", desc: "Identities that resonate" },
  { Icon: Share2, label: "Social Media", desc: "Strategy & management" },
  { Icon: Globe2, label: "Web Design", desc: "Modern conversion sites" },
  { Icon: Megaphone, label: "Paid Ads", desc: "Meta · TikTok · Google" },
  { Icon: TrendingUp, label: "Brand Growth", desc: "Scale with data" },
];

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
    <section className="relative min-h-[100vh] flex flex-col overflow-hidden -mt-24 pt-24">
      <BackgroundFX show={showFx} reduce={!!reduce} isMobile={isMobile} />

      <div className="relative z-10 mx-auto max-w-7xl w-full px-4 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center flex-1 py-10 lg:py-16">
        {/* LEFT */}
        <div>
          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-[11px] font-accent mb-6"
          >
            <Sparkles className="size-3.5 text-accent" />
            <span className="text-muted-foreground tracking-[0.22em]">
              Content · Branding · Growth
            </span>
          </motion.div>

          <motion.h1
            {...FADE_UP}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-[4.6rem] leading-[0.95] font-display font-bold"
          >
            We Build Brands<br />
            That <span className="text-gradient">Get Noticed.</span>
          </motion.h1>

          <motion.p
            {...FADE_UP}
            transition={{ duration: 0.7, delay: 0.18 }}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
          >
            We help businesses grow through powerful content, smart strategy,
            and creative storytelling.
          </motion.p>

          <motion.div
            {...FADE_UP}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="mt-9 flex flex-wrap gap-3 sm:gap-4"
          >
            <Link
              to="/services"
              className="group relative inline-flex items-center gap-2 bg-gradient-primary text-white px-6 sm:px-7 py-3.5 rounded-2xl font-semibold neon-glow hover:scale-[1.03] transition-transform overflow-hidden"
            >
              <span className="relative z-10">Explore Services</span>
              <ArrowRight className="relative z-10 size-4 group-hover:translate-x-1 transition-transform" />
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </Link>
            <Link
              to="/portfolio"
              className="group inline-flex items-center gap-2 glass-strong px-6 sm:px-7 py-3.5 rounded-2xl font-semibold hover:cyan-glow transition-all"
            >
              <span className="grid place-items-center size-6 rounded-full bg-gradient-primary">
                <Play className="size-3 fill-white text-white" />
              </span>
              Play Showreel
            </Link>
          </motion.div>
        </div>

        {/* RIGHT — Cinematic Lens */}
        <CinematicLens reduce={!!reduce} isMobile={isMobile} ready={showFx} />
      </div>

      {/* Floating services bar */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-7xl w-full px-4 pb-8 lg:pb-12"
      >
        <div className="glass-strong rounded-3xl p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {SERVICES.map(({ Icon, label, desc }) => (
            <div
              key={label}
              className="group relative rounded-2xl px-3 py-3 sm:px-4 sm:py-4 transition-all hover:bg-white/5 hover:-translate-y-0.5 cursor-default"
            >
              <div className="flex items-center gap-3">
                <span className="grid place-items-center size-9 sm:size-10 rounded-xl bg-gradient-primary/20 border border-primary/30 group-hover:cyan-glow transition-all shrink-0">
                  <Icon className="size-4 sm:size-[18px] text-accent" />
                </span>
                <div className="min-w-0">
                  <div className="text-[12px] sm:text-[13px] font-display font-semibold text-foreground truncate">
                    {label}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                    {desc}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
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
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1200px 600px at 20% 10%, oklch(0.28 0.18 250 / 0.35), transparent 60%), radial-gradient(900px 600px at 90% 90%, oklch(0.4 0.2 220 / 0.22), transparent 55%), linear-gradient(180deg, oklch(0.13 0.04 260) 0%, oklch(0.08 0.03 260) 100%)",
        }}
      />
      <div className="absolute inset-0 grid-bg opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_75%)]" />

      {show && !isMobile && (
        <>
          <div className="absolute -top-40 -right-32 size-[520px] rounded-full bg-primary/20 blur-[100px] animate-pulse-glow" />
          <div
            className="absolute -bottom-40 -left-32 size-[460px] rounded-full bg-accent/15 blur-[110px] animate-pulse-glow"
            style={{ animationDelay: "1.6s" }}
          />
        </>
      )}
      {show && isMobile && (
        <div className="absolute -top-32 right-0 size-[360px] rounded-full bg-primary/15 blur-[70px]" />
      )}

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

      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/80 via-background/30 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
    </>
  );
}

/* ---------------- Cinematic Camera Lens ---------------- */

const ORBIT_ICONS = [
  { Icon: Instagram, color: "text-pink-300", angle: 0 },
  { Icon: TikTok, color: "text-white", angle: 72 },
  { Icon: Facebook, color: "text-blue-300", angle: 144 },
  { Icon: Youtube, color: "text-red-400", angle: 216 },
  { Icon: Camera, color: "text-accent", angle: 288 },
];

function CinematicLens({
  reduce,
  isMobile,
  ready,
}: {
  reduce: boolean;
  isMobile: boolean;
  ready: boolean;
}) {
  const orbitR = isMobile ? 140 : 230;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto flex justify-center items-center h-[360px] w-[320px] sm:h-[480px] sm:w-[480px] lg:h-[600px] lg:w-[600px]"
    >
      {/* Outer aura */}
      {ready && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div
            className="size-[80%] rounded-full"
            style={{
              background:
                "radial-gradient(circle, oklch(0.66 0.22 250 / 0.5), transparent 65%)",
              filter: isMobile ? "blur(40px)" : "blur(60px)",
              animation: reduce ? undefined : "aura-breathe 7s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {/* Orbit ring (rotates with icons) */}
      {ready && (
        <div
          className="absolute inset-0 grid place-items-center pointer-events-none"
          style={{
            animation: reduce ? undefined : "orbit-spin 36s linear infinite",
            willChange: "transform",
          }}
        >
          <div
            className="relative rounded-full"
            style={{
              width: orbitR * 2,
              height: orbitR * 2,
              border: "1px solid oklch(0.66 0.22 250 / 0.35)",
              boxShadow:
                "0 0 40px oklch(0.66 0.22 250 / 0.35), inset 0 0 30px oklch(0.82 0.18 220 / 0.18)",
            }}
          >
            {/* dashed inner ring */}
            <div
              className="absolute inset-4 rounded-full"
              style={{
                border: "1px dashed oklch(0.82 0.18 220 / 0.3)",
              }}
            />
            {ORBIT_ICONS.map(({ Icon, color, angle }, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * orbitR;
              const y = Math.sin(rad) * orbitR;
              return (
                <div
                  key={i}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                >
                  {/* counter-rotate icon to keep upright */}
                  <div
                    style={{
                      animation: reduce
                        ? undefined
                        : "orbit-counter 36s linear infinite",
                      willChange: "transform",
                    }}
                    className="glass-strong rounded-2xl p-2.5 sm:p-3 hover:cyan-glow transition-all pointer-events-auto"
                  >
                    <Icon className={`size-4 sm:size-5 ${color}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Camera Lens */}
      <motion.div
        animate={reduce ? undefined : { rotate: [0, 360] }}
        transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        className="relative z-10"
        style={{ width: "min(72%, 300px)", aspectRatio: "1 / 1" }}
      >
        <Lens reduce={reduce} />
      </motion.div>

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

function Lens({ reduce }: { reduce: boolean }) {
  return (
    <div className="relative size-full rounded-full">
      {/* Outer barrel */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 90deg, oklch(0.18 0.02 260), oklch(0.28 0.04 260), oklch(0.14 0.02 260), oklch(0.32 0.05 260), oklch(0.18 0.02 260))",
          boxShadow:
            "0 0 60px -10px oklch(0.66 0.22 250 / 0.7), inset 0 0 40px oklch(0 0 0 / 0.6), inset 0 2px 0 oklch(1 0 0 / 0.1)",
          border: "1px solid oklch(0.4 0.05 260 / 0.6)",
        }}
      />
      {/* Ridges */}
      <div
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            "repeating-conic-gradient(oklch(0.22 0.03 260) 0deg 4deg, oklch(0.14 0.02 260) 4deg 8deg)",
          boxShadow: "inset 0 0 30px oklch(0 0 0 / 0.7)",
        }}
      />
      {/* Mid ring */}
      <div
        className="absolute inset-[14%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, oklch(0.4 0.06 260), oklch(0.12 0.02 260) 70%)",
          boxShadow:
            "inset 0 0 30px oklch(0 0 0 / 0.8), 0 0 0 1px oklch(0.5 0.1 240 / 0.4)",
        }}
      />
      {/* Glass element */}
      <div
        className="absolute inset-[24%] rounded-full overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, oklch(0.7 0.18 240 / 0.95), oklch(0.35 0.18 250 / 0.85) 45%, oklch(0.1 0.04 260) 90%)",
          boxShadow:
            "inset 0 0 40px oklch(0.66 0.22 250 / 0.6), inset 0 4px 14px oklch(1 0 0 / 0.15), 0 0 50px oklch(0.66 0.22 250 / 0.5)",
        }}
      >
        {/* Iris blades hint */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.66 0.22 250 / 0.25) 0deg 30deg, transparent 30deg 60deg, oklch(0.82 0.18 220 / 0.2) 60deg 90deg, transparent 90deg 120deg, oklch(0.66 0.22 250 / 0.25) 120deg 150deg, transparent 150deg 180deg, oklch(0.82 0.18 220 / 0.2) 180deg 210deg, transparent 210deg 240deg, oklch(0.66 0.22 250 / 0.25) 240deg 270deg, transparent 270deg 300deg, oklch(0.82 0.18 220 / 0.2) 300deg 330deg, transparent 330deg 360deg)",
            mixBlendMode: "screen",
          }}
        />
        {/* Reflections */}
        <div
          className="absolute top-[12%] left-[18%] size-[28%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(1 0 0 / 0.8), transparent 70%)",
            filter: "blur(2px)",
          }}
        />
        <div
          className="absolute bottom-[18%] right-[22%] size-[14%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.82 0.18 220 / 0.9), transparent 70%)",
            filter: "blur(1px)",
          }}
        />
        {/* Pupil */}
        <div
          className="absolute inset-[34%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.05 0.01 260), oklch(0.02 0 0) 80%)",
            boxShadow:
              "inset 0 0 20px oklch(0 0 0), 0 0 30px oklch(0.66 0.22 250 / 0.7)",
          }}
        />
      </div>

      {/* Pulse glow ring */}
      <div
        className="absolute inset-[20%] rounded-full pointer-events-none"
        style={{
          boxShadow:
            "0 0 40px 4px oklch(0.66 0.22 250 / 0.5), 0 0 80px 10px oklch(0.82 0.18 220 / 0.25)",
          animation: reduce ? undefined : "pulse-glow 4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

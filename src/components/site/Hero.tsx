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

      {/* 3D SADA Logo */}
      <div
        className="relative z-10"
        style={{ width: "min(72%, 320px)", aspectRatio: "1 / 1", perspective: "1200px" }}
      >
        <Logo3D reduce={reduce} />
      </div>

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

function Logo3D({ reduce }: { reduce: boolean }) {
  return (
    <motion.div
      animate={
        reduce
          ? undefined
          : { rotateY: [-12, 12, -12], rotateX: [6, -4, 6], y: [0, -8, 0] }
      }
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      className="relative size-full"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Back glow disc */}
      <div
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.66 0.22 250 / 0.7), oklch(0.35 0.2 250 / 0.4) 55%, transparent 75%)",
          filter: "blur(30px)",
          transform: "translateZ(-80px)",
          animation: reduce ? undefined : "pulse-glow 5s ease-in-out infinite",
        }}
      />

      {/* Glass disc base */}
      <div
        className="absolute inset-[8%] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 25%, oklch(1 0 0 / 0.18), transparent 48%), radial-gradient(circle at 70% 80%, oklch(0.66 0.22 250 / 0.45), transparent 60%), oklch(0.16 0.05 260 / 0.7)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid oklch(0.7 0.18 240 / 0.45)",
          boxShadow:
            "0 0 80px -10px oklch(0.66 0.22 250 / 0.8), inset 0 1px 0 oklch(1 0 0 / 0.2), inset 0 -50px 90px -20px oklch(0.66 0.22 250 / 0.35)",
          transform: "translateZ(0)",
        }}
      />

      {/* Inner highlight ring */}
      <div
        className="absolute inset-[14%] rounded-full pointer-events-none"
        style={{
          border: "1px solid oklch(1 0 0 / 0.1)",
          boxShadow: "inset 0 0 40px oklch(0.82 0.18 220 / 0.2)",
          transform: "translateZ(20px)",
        }}
      />

      {/* SADA mark — 3D extrusion via stacked layers */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ transform: "translateZ(60px)" }}
      >
        <div className="relative" style={{ transformStyle: "preserve-3d" }}>
          {/* Depth stack */}
          {Array.from({ length: 8 }).map((_, i) => (
            <img
              key={i}
              src={logo}
              alt=""
              aria-hidden
              className="absolute inset-0 size-32 sm:size-40 lg:size-48 object-contain"
              style={{
                transform: `translateZ(${-i * 2}px)`,
                filter: `brightness(${0.35 + i * 0.04}) saturate(0.6)`,
                opacity: 0.9,
              }}
            />
          ))}
          {/* Front face */}
          <img
            src={logo}
            alt="SADA"
            className="relative size-32 sm:size-40 lg:size-48 object-contain"
            style={{
              filter:
                "drop-shadow(0 0 24px oklch(0.66 0.22 250 / 0.85)) drop-shadow(0 0 48px oklch(0.82 0.18 220 / 0.6))",
            }}
          />
          {/* Specular highlight overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none mix-blend-screen"
            style={{
              background:
                "linear-gradient(135deg, oklch(1 0 0 / 0.35) 0%, transparent 45%)",
              maskImage: `url(${logo})`,
              WebkitMaskImage: `url(${logo})`,
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
              maskSize: "contain",
              WebkitMaskSize: "contain",
            }}
          />
        </div>
      </div>

      {/* Foreground reflection sweep */}
      <div
        className="absolute inset-[8%] rounded-full pointer-events-none overflow-hidden"
        style={{ transform: "translateZ(80px)" }}
      >
        <div
          className="absolute -inset-1/4"
          style={{
            background:
              "linear-gradient(115deg, transparent 40%, oklch(1 0 0 / 0.22) 50%, transparent 60%)",
            animation: reduce ? undefined : "shimmer 6s linear infinite",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
    </motion.div>
  );
}


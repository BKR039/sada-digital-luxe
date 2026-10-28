import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Instagram, ArrowUpRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { supabase } from "@/integrations/supabase/client";
import { ReelFrame } from "./ReelFrame";
import { InstagramReelModal } from "./InstagramReelModal";
import type { Tables } from "@/integrations/supabase/types";
import { useTranslation } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

type SocialReel = Tables<"social_reels">;

const SADA_INSTAGRAM_URL = "https://www.instagram.com/sada.media.production/";
const SADA_INSTAGRAM_HANDLE = "@sada.media.production";
const AUTOPLAY_INTERVAL = 4500;

export function ReelsShowcase() {
  const { language, isRTL } = useTranslation();
  const isAr = language === "ar";
  const [reels, setReels] = useState<SocialReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModalReel, setActiveModalReel] = useState<SocialReel | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Embla Carousel setup with RTL support
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
    direction: isRTL ? "rtl" : "ltr",
  });

  // Fetch published reels ordered by: 1. Featured first, 2. display_order ASC
  useEffect(() => {
    let active = true;
    supabase
      .from("social_reels")
      .select("*")
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("display_order", { ascending: true })
      .then(
        ({ data, error }) => {
          if (!active) return;
          setLoading(false);
          if (!error && data && data.length > 0) {
            setReels(data);

            // Check if URL has deep-link ?reel=<shortcode> (guarded for SSR)
            if (typeof window !== "undefined") {
              const urlParams = new URLSearchParams(window.location.search);
              const deepLinkShortcode = urlParams.get("reel");
              if (deepLinkShortcode) {
                const matched = data.find((r) => r.instagram_shortcode === deepLinkShortcode);
                if (matched) setActiveModalReel(matched);
              }
            }
          }
        },
        () => {
          if (active) setLoading(false);
        }
      );

    return () => {
      active = false;
    };
  }, []);

  // Update selected index on carousel scroll
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay functionality with pause on hover / focus / modal open
  useEffect(() => {
    if (!emblaApi || reels.length < 3 || isPaused || activeModalReel) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const timer = setInterval(() => {
      emblaApi.scrollNext();
    }, AUTOPLAY_INTERVAL);

    return () => clearInterval(timer);
  }, [emblaApi, reels.length, isPaused, activeModalReel]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi],
  );

  // Pointer gesture tracker for swipe vs tap differentiation (8px threshold)
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 8 || dy > 8) {
      isDraggingRef.current = true;
    }
  };

  // Canonical handler to open a Reel modal: guards against carousel drag/swipe
  const handleOpenReel = useCallback(
    (reel: SocialReel) => {
      // If the user was dragging or swiping the carousel, do NOT open the modal
      if (isDraggingRef.current) {
        return;
      }
      setActiveModalReel(reel);
    },
    [],
  );

  // Modal previous / next navigation handlers without closing/reopening or navigating
  const activeModalIndex = activeModalReel
    ? reels.findIndex((r) => r.id === activeModalReel.id)
    : -1;
  const hasPrev = activeModalIndex > 0;
  const hasNext = activeModalIndex >= 0 && activeModalIndex < reels.length - 1;

  const handlePrevReel = useCallback(() => {
    if (activeModalIndex > 0) {
      setActiveModalReel(reels[activeModalIndex - 1]);
    }
  }, [activeModalIndex, reels]);

  const handleNextReel = useCallback(() => {
    if (activeModalIndex >= 0 && activeModalIndex < reels.length - 1) {
      setActiveModalReel(reels[activeModalIndex + 1]);
    }
  }, [activeModalIndex, reels]);

  // Loading state with skeleton cards to prevent layout collapse
  if (loading) {
    return (
      <section
        className="relative py-16 sm:py-20 px-4 overflow-hidden select-none"
        aria-labelledby="sada-reels-headline"
      >
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-2.5 uppercase">
                {isAr ? "ريلز صدى" : "SADA REELS"}
              </p>
              <h2 id="sada-reels-headline" className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.08] tracking-tight">
                {isAr ? (
                  <>أحدث أعمالنا <span className="text-gradient">المرئية</span>.</>
                ) : (
                  <>Real content. <span className="text-gradient">Real results</span>.</>
                )}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="aspect-[9/16] rounded-3xl border border-border/40 bg-card/40 animate-pulse flex flex-col justify-end p-6"
              >
                <div className="h-4 bg-muted/40 rounded-md w-3/4 mb-3" />
                <div className="h-3 bg-muted/30 rounded-md w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // If 0 published reels: hide the entire section gracefully
  if (reels.length === 0) return null;

  return (
    <section
      className="relative py-16 sm:py-20 px-4 overflow-hidden select-none"
      aria-labelledby="sada-reels-headline"
    >
      {/* Ambient background atmosphere */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[900px] h-[450px] bg-gradient-to-br from-cyan-500/10 via-blue-600/10 to-transparent blur-3xl opacity-70 dark:opacity-40"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="max-w-xl"
          >
            <p className="text-xs font-semibold tracking-[0.25em] text-primary mb-2.5 uppercase">
              {isAr ? "ريلز صدى" : "SADA REELS"}
            </p>
            <h2 id="sada-reels-headline" className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.1]">
              {isAr ? (
                <>محتوى حقيقي. <span className="text-gradient">نتائج حقيقية.</span></>
              ) : (
                <>Real content. <span className="text-gradient">Real results.</span></>
              )}
            </h2>
            <p className="mt-3 text-muted-foreground text-sm sm:text-base leading-relaxed">
              {isAr
                ? "كواليس الإنتاج، أفكارنا الإبداعية وأحدث أعمالنا — مباشرة من حسابنا على إنستغرام."
                : "Behind the scenes, ideas and creative work — straight from our Instagram."}
            </p>
          </motion.div>

          {/* SADA Instagram CTA */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <a
              href={SADA_INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow SADA on Instagram @sada.media.production"
              className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-border bg-card/80 hover:bg-card text-foreground font-semibold text-xs sm:text-sm soft-shadow hover:elevated-shadow transition-all group"
            >
              <div className="size-6 rounded-lg bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600 grid place-items-center text-white">
                <Instagram className="size-3.5" />
              </div>
              <span>{isAr ? "تابعنا على إنستغرام" : "Follow us on Instagram"}</span>
              <span className="text-primary font-mono text-xs" dir="ltr">{SADA_INSTAGRAM_HANDLE}</span>
              <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl-flip transition-transform" />
            </a>
          </motion.div>
        </div>

        {/* LOW CONTENT STATES (1 or 2 reels) */}
        {reels.length === 1 && (
          <div className="max-w-[280px] sm:max-w-[310px] mx-auto">
            <ReelFrame
              reel={reels[0]}
              isActive={true}
              onClick={handleOpenReel}
              priority={true}
            />
          </div>
        )}

        {reels.length === 2 && (
          <div className="grid sm:grid-cols-2 max-w-xl sm:max-w-2xl mx-auto gap-5 sm:gap-8">
            {reels.map((reel, idx) => (
              <div key={reel.id} className="max-w-[280px] sm:max-w-[310px] mx-auto w-full">
                <ReelFrame
                  reel={reel}
                  isActive={idx === 0}
                  onClick={handleOpenReel}
                  priority={true}
                />
              </div>
            ))}
          </div>
        )}

        {/* REELS CAROUSEL (3+ reels) - centered within section */}
        {reels.length >= 3 && (
          <div
            className="relative max-w-6xl mx-auto"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
          >
            {/* Carousel Viewport */}
            <div
              ref={emblaRef}
              className="overflow-hidden py-3 -my-3"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
            >
              <div className="flex -ml-4 sm:-ml-5 md:-ml-6 items-center touch-pan-y">
                {reels.map((reel, index) => {
                  const isActive = index === selectedIndex;
                  return (
                    <div
                      key={reel.id}
                      className="pl-4 sm:pl-5 md:pl-6 flex-[0_0_80%] sm:flex-[0_0_46%] lg:flex-[0_0_31.5%] max-w-[320px] min-w-0 transition-opacity duration-300 mx-auto"
                    >
                      <ReelFrame
                        reel={reel}
                        isActive={isActive}
                        onClick={handleOpenReel}
                        priority={index < 3}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desktop Navigation Arrows */}
            <div className="hidden md:flex items-center justify-between pointer-events-none absolute inset-y-0 -left-4 -right-4 z-30">
              <button
                type="button"
                onClick={scrollPrev}
                aria-label="Previous Reel"
                className="pointer-events-auto size-10 rounded-full border border-border bg-card/90 hover:bg-primary hover:text-white backdrop-blur-md shadow-lg grid place-items-center text-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft className="size-4" />
              </button>

              <button
                type="button"
                onClick={scrollNext}
                aria-label="Next Reel"
                className="pointer-events-auto size-10 rounded-full border border-border bg-card/90 hover:bg-primary hover:text-white backdrop-blur-md shadow-lg grid place-items-center text-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>

            {/* SADA Minimal Indicator Dots */}
            <div
              className="mt-8 flex items-center justify-center gap-2"
              role="tablist"
              aria-label="Reels carousel pagination"
            >
              {reels.map((reel, index) => {
                const isActive = index === selectedIndex;
                return (
                  <button
                    key={reel.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Go to Reel ${index + 1}: ${reel.title}`}
                    onClick={() => scrollTo(index)}
                    className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? "w-7 bg-gradient-to-r from-cyan-400 to-blue-600 shadow-[0_0_10px_rgba(24,199,247,0.5)]"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal with official Instagram embed */}
      <InstagramReelModal
        reel={activeModalReel}
        onClose={() => setActiveModalReel(null)}
        onPrev={handlePrevReel}
        onNext={handleNextReel}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </section>
  );
}

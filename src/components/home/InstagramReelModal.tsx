import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Instagram,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useTranslation } from "@/i18n";
import { getLocalizedContent } from "@/i18n/cms";

type SocialReel = Tables<"social_reels">;

interface InstagramReelModalProps {
  reel: SocialReel | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const LOAD_TIMEOUT_MS = 10000;

export function InstagramReelModal({
  reel,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: InstagramReelModalProps) {
  const { language } = useTranslation();
  const isAr = language === "ar";
  const localizedTitle = reel ? getLocalizedContent(reel, "title", language) : "";
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Client-side hydration check for Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track trigger element once when modal opens (null -> reel)
  useEffect(() => {
    if (reel && !isOpenRef.current) {
      isOpenRef.current = true;
      triggerRef.current = document.activeElement as HTMLElement;
    } else if (!reel) {
      isOpenRef.current = false;
    }
  }, [reel]);

  const isOpenRef = useRef(false);

  // Content loading state per reel
  useEffect(() => {
    if (!reel) return;

    setLoading(true);
    setHasError(false);

    const timeout = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          setHasError(true);
          return false;
        }
        return false;
      });
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [reel?.id]);

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync browser fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleBrowserFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Silently keep SADA fullscreen viewer if browser fullscreen is unavailable
    }
  };

  // Robust, jump-free scroll locking with exact scroll restoration
  // Only runs when modal opens/closes, NOT when switching reels
  const isModalOpen = Boolean(reel);
  useEffect(() => {
    if (!isModalOpen) return;

    // Capture the exact vertical scroll position before locking
    const previousScrollY = window.scrollY;
    const originalOverflow = document.body.style.overflow;

    // Lock page scroll cleanly without shifting layout
    document.body.style.overflow = "hidden";

    // Focus modal container safely without scrolling
    modalRef.current?.focus({ preventScroll: true });

    return () => {
      // Restore original scroll behavior and exact scroll position
      document.body.style.overflow = originalOverflow;

      // Exit browser fullscreen if active
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      // Restore focus to the trigger element without page jumping
      if (triggerRef.current) {
        triggerRef.current.focus({ preventScroll: true });
        triggerRef.current = null;
      }

      // Ensure scroll position is 100% preserved
      if (window.scrollY !== previousScrollY) {
        window.scrollTo({ top: previousScrollY, behavior: "instant" as any });
      }
    };
  }, [isModalOpen]);

  // Keep latest callbacks in refs for keyboard event listener
  const onCloseRef = useRef(onClose);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  const hasPrevRef = useRef(hasPrev);
  const hasNextRef = useRef(hasNext);

  useEffect(() => {
    onCloseRef.current = onClose;
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
    hasPrevRef.current = hasPrev;
    hasNextRef.current = hasNext;
  });

  // Global keydown handler (Escape to close, Arrow keys to navigate)
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "ArrowLeft" && onPrevRef.current && hasPrevRef.current) {
        e.preventDefault();
        onPrevRef.current();
      } else if (e.key === "ArrowRight" && onNextRef.current && hasNextRef.current) {
        e.preventDefault();
        onNextRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  if (!mounted || !reel) return null;

  const shortcode =
    reel.instagram_shortcode ||
    reel.instagram_url.split("/reel/")[1]?.split("/")[0] ||
    "";
  const embedUrl = `https://www.instagram.com/reel/${shortcode}/embed/`;

  const modalJSX = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reel-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/92 backdrop-blur-md transition-opacity duration-200 animate-in fade-in select-none overflow-hidden"
      onClick={onClose}
    >
      {/* Top-Left Floating Branding & Title Overlay */}
      <div className="absolute top-[max(16px,env(safe-area-inset-top))] left-[max(16px,env(safe-area-inset-left))] z-50 flex items-center gap-2 max-w-[calc(100vw-220px)] sm:max-w-md pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-lg">
          <span className="text-[10px] font-black tracking-[0.2em] text-cyan-400 uppercase">
            SADA
          </span>
          {reel.category && (
            <span className="text-[10px] text-cyan-300/90 font-bold uppercase tracking-wider">
              {reel.category}
            </span>
          )}
          <span
            id="reel-modal-title"
            className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[240px]"
          >
            {reel.title}
          </span>
        </div>
      </div>

      {/* Top-Right Floating Controls (Instagram Link, Fullscreen Toggle, Close X) */}
      <div className="absolute top-[max(16px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] z-50 flex items-center gap-2 sm:gap-2.5">
        <a
          href={reel.instagram_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on Instagram"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-md shadow-lg transition-all"
        >
          <Instagram className="size-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Instagram</span>
          <ExternalLink className="size-3 opacity-70" />
        </a>

        <button
          type="button"
          onClick={toggleBrowserFullscreen}
          aria-label={isFullscreen ? "Exit browser fullscreen" : "Enter browser fullscreen"}
          className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center border border-white/15 backdrop-blur-md shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close Reel"
          className="size-9 rounded-full bg-white/10 hover:bg-red-500/85 text-white grid place-items-center border border-white/15 backdrop-blur-md shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <X className="size-4.5" />
        </button>
      </div>

      {/* Maximized 9:16 Fullscreen Reel Stage */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-[min(100vw,calc(100dvh*9/16))] h-[min(100dvh,calc(100vw*16/9))] aspect-[9/16] rounded-none sm:rounded-[24px] md:rounded-[28px] overflow-hidden bg-black shadow-[0_0_80px_rgba(0,0,0,0.95)] z-20 flex items-center justify-center outline-none animate-in zoom-in-[0.98] duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Ambient Glow Aura behind stage */}
        <div
          className="absolute -inset-2 rounded-[36px] bg-gradient-to-tr from-cyan-500/10 via-blue-600/5 to-transparent blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Centered SADA Loading State */}
        {loading && !hasError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-black text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="text-[10px] font-black tracking-[0.25em] text-cyan-400 uppercase">
                SADA
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                REELS
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Loader2 className="size-4 text-cyan-400 animate-spin" />
              <span>{isAr ? "جاري تحميل الريل..." : "Loading Reel..."}</span>
            </div>
          </div>
        )}

        {/* Graceful Fallback / Error State */}
        {hasError ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center gap-4 bg-[#0B1120] text-slate-300">
            <div className="size-12 rounded-2xl bg-white/5 border border-white/10 grid place-items-center text-cyan-400">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm sm:text-base font-bold text-white">
                {isAr ? "تعذر تشغيل هذا الريل هنا" : "Couldn't load this Reel here"}
              </h4>
              <p className="text-xs text-muted-foreground max-w-xs">
                {isAr ? "يمكنك مشاهدة هذا الريل مباشرة على إنستغرام." : "This Reel can be viewed directly on Instagram."}
              </p>
            </div>
            <a
              href={reel.instagram_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-primary text-white text-xs font-semibold shadow-md hover:scale-105 transition-all"
            >
              <Instagram className="size-4" />
              <span>{isAr ? "فتح على إنستغرام" : "Open on Instagram"}</span>
              <ExternalLink className="size-3.5 rtl-flip" />
            </a>
          </div>
        ) : (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={localizedTitle || reel.title}
            className="w-full h-full border-0 bg-black"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            loading="eager"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
            }}
          />
        )}

        {/* Mobile Inside Prev/Next Buttons */}
        {hasPrev && onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous Reel"
            className="sm:hidden absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 size-8 place-items-center rounded-full bg-black/60 hover:bg-cyan-500 text-white border border-white/20 backdrop-blur-md shadow-lg z-30"
          >
            <ChevronLeft className="size-4 rtl-flip" />
          </button>
        )}

        {hasNext && onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next Reel"
            className="sm:hidden absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 size-8 place-items-center rounded-full bg-black/60 hover:bg-cyan-500 text-white border border-white/20 backdrop-blur-md shadow-lg z-30"
          >
            <ChevronRight className="size-4 rtl-flip" />
          </button>
        )}
      </div>

      {/* Desktop Outside Prev/Next Buttons (Vertically Centered Against Reel) */}
      {hasPrev && onPrev && (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous Reel"
          className="hidden sm:grid absolute left-4 md:left-6 lg:left-10 rtl:left-auto rtl:right-4 rtl:md:right-6 rtl:lg:right-10 top-1/2 -translate-y-1/2 size-11 lg:size-12 place-items-center rounded-full bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white border border-white/15 backdrop-blur-md shadow-2xl z-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-all"
        >
          <ChevronLeft className="size-5 rtl-flip" />
        </button>
      )}

      {hasNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next Reel"
          className="hidden sm:grid absolute right-4 md:right-6 lg:right-10 rtl:right-auto rtl:left-4 rtl:md:left-6 rtl:lg:left-10 top-1/2 -translate-y-1/2 size-11 lg:size-12 place-items-center rounded-full bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white border border-white/15 backdrop-blur-md shadow-2xl z-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 transition-all"
        >
          <ChevronRight className="size-5 rtl-flip" />
        </button>
      )}
    </div>
  );

  // Mount directly into document.body to break free from any parent stacking context
  return createPortal(modalJSX, document.body);
}

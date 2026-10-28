import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, ArrowDown, RotateCcw, Type, Share2, Check, X } from "lucide-react";
import {
  saveReadingProgress,
  getReadingProgress,
  getReadingFontSize,
  setReadingFontSize,
  ReadingProgressData,
} from "@/lib/cookie-service";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";

interface BlogReadingEnhancerProps {
  slug: string;
  title: string;
  readingMinutes?: number | null;
}

export function BlogReadingEnhancer({ slug, title, readingMinutes }: BlogReadingEnhancerProps) {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";

  const [progress, setProgress] = useState(0);
  const [previousProgress, setPreviousProgress] = useState<ReadingProgressData | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [fontSize, setFontSizeState] = useState<"normal" | "relaxed" | "large">("normal");

  // Load existing saved progress on mount and listen to consent changes
  useEffect(() => {
    const saved = getReadingProgress(slug);
    if (saved && saved.progressPercent >= 15 && saved.progressPercent <= 92) {
      setPreviousProgress(saved);
      setShowResumePrompt(true);
    }
    setFontSizeState(getReadingFontSize());

    const handleConsentChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const consent = customEvent?.detail;
      if (consent && !consent.preferences.readingExperience) {
        setShowResumePrompt(false);
        setPreviousProgress(null);
      }
    };

    window.addEventListener("sada:cookie-consent-updated", handleConsentChange);
    return () => {
      window.removeEventListener("sada:cookie-consent-updated", handleConsentChange);
    };
  }, [slug]);

  // Track scroll and update progress
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const docEl = document.documentElement;
          const scrollTop = window.scrollY || docEl.scrollTop;
          const scrollHeight = docEl.scrollHeight - docEl.clientHeight;
          if (scrollHeight > 0) {
            const pct = Math.min(100, Math.max(0, Math.round((scrollTop / scrollHeight) * 100)));
            setProgress(pct);

            // Save progress periodically when scroll is stable
            if (pct > 5 && pct < 98) {
              saveReadingProgress({
                slug,
                title,
                progressPercent: pct,
                scrollY: Math.round(scrollTop),
              });
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [slug, title]);

  // Apply font size class to the article body
  useEffect(() => {
    const article = document.querySelector(".article-body, .blog-prose, article");
    if (!article) return;

    article.classList.remove("text-base", "text-lg", "text-xl", "leading-relaxed", "leading-loose");
    if (fontSize === "relaxed") {
      article.classList.add("text-lg", "leading-relaxed");
    } else if (fontSize === "large") {
      article.classList.add("text-xl", "leading-loose");
    } else {
      article.classList.add("text-base", "leading-normal");
    }
  }, [fontSize]);

  const handleResume = () => {
    if (previousProgress && previousProgress.scrollY) {
      window.scrollTo({
        top: previousProgress.scrollY,
        behavior: "smooth",
      });
      setShowResumePrompt(false);
      toast.success(isAr ? `تمت العودة إلى موضع القراءة السابق (${previousProgress.progressPercent}%)` : `Resumed reading at ${previousProgress.progressPercent}%`);
    }
  };

  const cycleFontSize = () => {
    const nextSize = fontSize === "normal" ? "relaxed" : fontSize === "relaxed" ? "large" : "normal";
    setFontSizeState(nextSize);
    setReadingFontSize(nextSize);
    toast.info(
      isAr
        ? `حجم خط القراءة: ${nextSize === "normal" ? "افتراضي" : nextSize === "relaxed" ? "مريح" : "كبير"}`
        : `Reading font size: ${nextSize}`
    );
  };

  return (
    <>
      {/* 1. Slim Top Reading Progress Bar */}
      <div className="fixed top-0 inset-x-0 h-1 z-50 bg-border/40 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-primary via-cyan-400 to-emerald-400 transition-all duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 2. Resume Reading Floating Pill (if previous progress exists) */}
      <AnimatePresence>
        {showResumePrompt && previousProgress && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 inset-x-4 sm:inset-x-auto sm:end-6 z-40 flex items-center gap-2 p-2.5 ps-3.5 rounded-2xl bg-card/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-primary/30 shadow-xl text-xs font-medium"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="size-2 rounded-full bg-primary animate-ping" />
            <span className="text-foreground">
              {isAr
                ? `متابعة القراءة من حيث توقفت (${previousProgress.progressPercent}%)؟`
                : `Resume reading at ${previousProgress.progressPercent}%?`}
            </span>
            <button
              type="button"
              onClick={handleResume}
              className="px-2.5 py-1 rounded-xl bg-primary text-primary-foreground font-semibold shadow-2xs hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer ms-1"
            >
              {isAr ? "استئناف" : "Resume"}
            </button>
            <button
              type="button"
              onClick={() => setShowResumePrompt(false)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Floating Bottom Reading Control Bar */}
      <aside
        aria-label="Reading Controls"
        className="fixed bottom-4 inset-x-0 max-w-xs mx-auto z-30 pointer-events-auto flex items-center justify-between px-3.5 py-2 rounded-2xl bg-card/85 dark:bg-zinc-950/85 backdrop-blur-xl border border-border/80 shadow-[0_8px_24px_rgba(0,0,0,0.12)] text-xs text-muted-foreground"
      >
        {/* Progress percent */}
        <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
          <span className="text-primary">{progress}%</span>
          <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline">
            {readingMinutes ? `${Math.max(1, Math.round(readingMinutes * (1 - progress / 100)))}m left` : "read"}
          </span>
        </div>

        {/* Font size toggle */}
        <button
          type="button"
          onClick={cycleFontSize}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-muted text-foreground transition-colors cursor-pointer"
          title={isAr ? "تغيير حجم خط القراءة" : "Adjust reading font size"}
        >
          <Type className="size-3.5 text-primary" />
          <span className="font-mono text-[11px] font-bold uppercase">{fontSize[0]}</span>
        </button>

        {/* Scroll to top */}
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="p-1.5 rounded-xl hover:bg-muted text-foreground transition-colors cursor-pointer"
          title={isAr ? "العودة للأعلى" : "Scroll to top"}
        >
          <ArrowDown className="size-3.5 rotate-180 text-muted-foreground hover:text-primary transition-colors" />
        </button>
      </aside>
    </>
  );
}

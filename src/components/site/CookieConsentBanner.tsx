import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouterState } from "@tanstack/react-router";
import {
  Cookie,
  ShieldCheck,
  BookOpen,
  Sparkles,
  SlidersHorizontal,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import {
  getCookieConsent,
  saveCookieConsent,
  CookiePreferences,
} from "@/lib/cookie-service";

export function CookieConsentBanner() {
  const { isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminOrAuth = pathname.startsWith("/admin") || pathname.startsWith("/sada-os") || pathname.startsWith("/auth");

  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [customPrefs, setCustomPrefs] = useState<CookiePreferences>({
    necessary: true,
    readingExperience: true,
    analytics: true,
  });

  useEffect(() => {
    // Check if consent has already been recorded
    const existing = getCookieConsent();
    if (existing) {
      setCustomPrefs(existing.preferences);
    } else if (!isAdminOrAuth) {
      // Auto-open only on public website pages after smooth initial entrance delay
      const timer = setTimeout(() => {
        setVisible(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    const handleOpen = () => {
      const current = getCookieConsent();
      if (current) {
        setCustomPrefs(current.preferences);
      }
      setShowDetails(true);
      setVisible(true);
    };

    window.addEventListener("sada:open-cookie-preferences", handleOpen);
    return () => {
      window.removeEventListener("sada:open-cookie-preferences", handleOpen);
    };
  }, [isAdminOrAuth]);

  const handleAcceptAll = () => {
    saveCookieConsent("accepted_all");
    setVisible(false);
  };

  const handleNecessaryOnly = () => {
    saveCookieConsent("necessary_only");
    setVisible(false);
  };

  const handleSaveCustom = () => {
    saveCookieConsent("custom", customPrefs);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.aside
        aria-label={isAr ? "إشعار وتفضيلات الخصوصية وتجربة القراءة" : "Cookie and UX Preferences"}
        initial={{ opacity: 0, y: 35, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 25, scale: 0.96 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:end-6 sm:max-w-[480px] z-[9999] rounded-3xl bg-card/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.28)] ring-1 ring-cyan-500/20 overflow-hidden text-start font-sans"
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Top Luxe Accent Gradient Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-primary to-blue-600" />

        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {/* SADA Luxe Tile */}
            <div className="size-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-primary/10 to-transparent border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_15px_rgba(56,189,248,0.2)] mt-0.5">
              <Cookie className="size-5 text-cyan-400" />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold font-display text-foreground tracking-tight">
                    {isAr ? "تجربة تصفح وقراءة ذكية" : "Enhanced Reading & UX Experience"}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:text-cyan-400 border border-primary/20">
                    SADA UX
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleNecessaryOnly}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
                  aria-label={isAr ? "إغلاق" : "Close"}
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {isAr
                  ? "تستخدم صدى ملفات تعريف الارتباط الأساسية لحفظ اللغة والأمان، إلى جانب ذاكرة قراءة ذكية تمكنك من استئناف مقالات المدونة ودراسات الحالة من حيث توقفت."
                  : "SADA uses necessary cookies for language, theme, and security, plus reading memory so you can resume blog articles and case studies right where you left off."}
              </p>

              {/* Collapsible Granular Controls */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="pt-3 space-y-2 border-t border-border/60 my-2 overflow-hidden"
                  >
                    {/* 1. Necessary */}
                    <div className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/30 border border-border/40 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-7 rounded-xl bg-emerald-500/10 text-emerald-500 grid place-items-center shrink-0">
                          <ShieldCheck className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">
                            {isAr ? "الملفات الضرورية والأمان" : "Strictly Necessary & Security"}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {isAr ? "اللغة، المظهر الداكن/الفاتح، وحماية الجلسة" : "Language, dark/light theme, and session protection"}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                        {isAr ? "مفعلة دائماً" : "Always Active"}
                      </span>
                    </div>

                    {/* 2. Reading Experience */}
                    <div
                      onClick={() => setCustomPrefs((p) => ({ ...p, readingExperience: !p.readingExperience }))}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/30 border border-border/40 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-7 rounded-xl bg-primary/10 text-primary dark:text-cyan-400 grid place-items-center shrink-0">
                          <BookOpen className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">
                            {isAr ? "ذاكرة القراءة والمدونة" : "Reading Memory & Preferences"}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {isAr ? "استئناف موضع التمرير، حجم الخط، والمقالات المحفوظة" : "Remembers scroll depth, typography size, and bookmarks"}
                          </p>
                        </div>
                      </div>

                      {/* Custom Luxury Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={customPrefs.readingExperience}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          customPrefs.readingExperience ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            customPrefs.readingExperience ? (isAr ? "-translate-x-4" : "translate-x-4") : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* 3. Performance & Telemetry */}
                    <div
                      onClick={() => setCustomPrefs((p) => ({ ...p, analytics: !p.analytics }))}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/30 border border-border/40 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-7 rounded-xl bg-blue-500/10 text-blue-500 grid place-items-center shrink-0">
                          <Sparkles className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">
                            {isAr ? "أداء وسرعة التصفح" : "Performance & Optimization"}
                          </div>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {isAr ? "قياس زمن التحميل المجهول دون أي تتبع إعلاني" : "Anonymous load latency metrics with zero cross-site tracking"}
                          </p>
                        </div>
                      </div>

                      {/* Custom Luxury Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={customPrefs.analytics}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          customPrefs.analytics ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            customPrefs.analytics ? (isAr ? "-translate-x-4" : "translate-x-4") : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Buttons */}
              <div className="pt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={showDetails ? handleSaveCustom : handleAcceptAll}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-primary hover:opacity-95 text-white text-xs font-semibold shadow-[0_4px_16px_rgba(37,99,235,0.3)] transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="size-3.5" />
                  <span>
                    {showDetails
                      ? (isAr ? "حفظ التفضيلات" : "Save Preferences")
                      : (isAr ? "قبول الكل وتفعيل الذاكرة" : "Accept All & Enable Memory")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleNecessaryOnly}
                  className="px-3.5 py-2 rounded-xl border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer active:scale-95"
                >
                  {isAr ? "الضرورية فقط" : "Necessary Only"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="px-2.5 py-2 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ms-auto"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>{showDetails ? (isAr ? "إخفاء التفاصيل" : "Less") : (isAr ? "تخصيص" : "Customize")}</span>
                  <ChevronDown className={`size-3 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}


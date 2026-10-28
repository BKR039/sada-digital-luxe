// ============================================================
// SADA OS — PWA INSTALLATION BANNER & GUIDANCE DIALOG
// Phase 9: Mobile Web App / PWA Experience
//
// Features:
// - Android / Chrome: Native 1-tap install prompt trigger
// - iOS Safari: Elegant 2-step "Add to Home Screen" instructions
// - Dismissible with 7-day cooldown in localStorage
// - Zero UI display when already running in standalone mode
// - Full SADA UI styling & bilingual Arabic/English
// ============================================================

import React, { useState, useEffect } from "react";
import {
  isStandaloneApp,
  isIosSafari,
  onPwaInstallChange,
  promptPwaInstall,
} from "@/lib/pwa-service";
import { SADABadge } from "@/components/ui/sada-badge";
import { SADAButton } from "@/components/ui/sada-button";
import { SADADialog } from "@/components/ui/sada-dialog";
import { Download, Share2, PlusSquare, X, Smartphone, Check } from "lucide-react";
import { useTranslation } from "@/i18n";

export function PWAInstallBanner() {
  const { isRTL } = useTranslation();
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [iosModalOpen, setIosModalOpen] = useState(false);

  useEffect(() => {
    // 1. If already installed/standalone, never display
    if (isStandaloneApp()) {
      setDismissed(true);
      return;
    }

    // 2. Check dismissal persistence safely
    try {
      const dismissedUntil = localStorage.getItem("sada-pwa-dismissed");
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setDismissed(true);
        return;
      }
    } catch (_) {
      // Storage access may fail in private mode; fail gracefully
    }

    setDismissed(false);
    setIsIos(isIosSafari());

    // 3. Listen to native installability changes
    const unsubscribe = onPwaInstallChange((installable) => {
      setCanInstall(installable);
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = () => {
    // Dismiss for 7 days
    try {
      const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem("sada-pwa-dismissed", String(nextWeek));
    } catch (_) {
      // Storage access may fail in private mode; fail gracefully
    }
    setDismissed(true);
  };

  const handleInstallClick = async () => {
    if (isIos) {
      setIosModalOpen(true);
      return;
    }

    const res = await promptPwaInstall();
    if (res.outcome === "accepted") {
      setDismissed(true);
    }
  };

  // Only render if not standalone, not dismissed, and either installable or on iOS Safari
  if (dismissed || (!canInstall && !isIos)) {
    return null;
  }

  return (
    <>
      {/* Floating or Docked Install Prompt Banner */}
      <aside
        id="sada-pwa-install-banner"
        aria-label={isRTL ? "تثبيت تطبيق صدى" : "Install SADA OS App"}
        className="fixed bottom-16 md:bottom-6 start-4 end-4 md:start-auto md:end-6 md:max-w-md z-45 bg-card/95 dark:bg-card/90 backdrop-blur-md border border-primary/20 dark:border-primary/30 p-3.5 rounded-2xl shadow-xl transition-all animate-in fade-in slide-in-from-bottom-3"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-gradient-primary text-white flex items-center justify-center shrink-0 shadow-xs">
            <Smartphone className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground font-display">
                SADA OS
              </span>
              <SADABadge variant="outline" size="sm" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                PWA
              </SADABadge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              {isRTL
                ? "ثبّت التطبيق على شاشتك الرئيسية للوصول السريع بدون متصفح."
                : "Install on your home screen for quick 1-tap offline-ready workspace access."}
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <SADAButton
                variant="primary"
                size="sm"
                onClick={handleInstallClick}
                className="text-xs h-7 px-3 gap-1.5"
              >
                <Download className="size-3.5" />
                <span>{isRTL ? "تثبيت التطبيق" : "Install App"}</span>
              </SADAButton>

              <SADAButton
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <span>{isRTL ? "لاحقاً" : "Maybe Later"}</span>
              </SADAButton>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors -me-1 -mt-1"
            aria-label="Dismiss banner"
          >
            <X className="size-4" />
          </button>
        </div>
      </aside>

      {/* iOS Safari Custom Installation Guide Dialog */}
      <SADADialog
        open={iosModalOpen}
        onOpenChange={setIosModalOpen}
        size="compact"
        title={isRTL ? "تثبيت تطبيق صدى على iPhone" : "Install SADA OS on iOS"}
        description={
          isRTL
            ? "اتبع الخطوتين التاليتين لتثبيت التطبيق على الشاشة الرئيسية:"
            : "Follow these 2 simple steps to add SADA OS to your home screen:"
        }
        footer={
          <SADAButton
            variant="primary"
            size="sm"
            onClick={() => {
              setIosModalOpen(false);
              handleDismiss();
            }}
            className="gap-1.5 ms-auto"
          >
            <Check className="size-3.5" />
            <span>{isRTL ? "فهمت ذلك" : "Got It"}</span>
          </SADAButton>
        }
      >
        <div className="space-y-3.5 py-2">
          {/* Step 1 */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
              1
            </div>
            <div className="text-xs text-foreground flex-1">
              {isRTL ? (
                <span>
                  اضغط على أيقونة <strong>المشاركة (Share)</strong> في شريط متصفح Safari السفلي.
                </span>
              ) : (
                <span>
                  Tap the <strong>Share</strong> button <Share2 className="inline size-3.5 mx-1" /> in Safari's bottom toolbar.
                </span>
              )}
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs">
              2
            </div>
            <div className="text-xs text-foreground flex-1">
              {isRTL ? (
                <span>
                  قم بالتمرير للأسفل واختر <strong>"إضافة إلى الصفحة الرئيسية"</strong> (Add to Home Screen).
                </span>
              ) : (
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="inline size-3.5 mx-1" />.
                </span>
              )}
            </div>
          </div>
        </div>
      </SADADialog>
    </>
  );
}

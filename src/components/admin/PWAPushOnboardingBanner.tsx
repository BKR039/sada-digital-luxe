// ============================================================
// SADA OS — PWA & DESKTOP PUSH NOTIFICATION ONBOARDING BANNER
// Luxury Contextual Banner Prompt for Web Push Activation
// ============================================================

import React, { useState, useEffect } from "react";
import { Bell, Sparkles, X, Check, Smartphone, ArrowRight } from "lucide-react";
import { SADAButton, SADABadge } from "@/components/ui/sada-ui";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  registerPushDeviceSubscription,
} from "@/lib/browser-push-service";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";

interface PWAPushOnboardingBannerProps {
  userId?: string;
  className?: string;
}

const DISMISS_STORAGE_KEY = "sada_push_onboarding_dismissed_at";
const DISMISS_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days cooldown

export function PWAPushOnboardingBanner({ userId, className = "" }: PWAPushOnboardingBannerProps) {
  const { t, isRTL } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if permission already granted or denied
    const perm = getBrowserNotificationPermission();
    if (perm === "granted" || perm === "denied" || perm === "unsupported") {
      setVisible(false);
      return;
    }

    // Check if dismissed recently
    try {
      const dismissedAt = localStorage.getItem(DISMISS_STORAGE_KEY);
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        if (timePassed < DISMISS_COOLDOWN_MS) {
          setVisible(false);
          return;
        }
      }
    } catch (_) {}

    // Show after a brief delay so page loads smoothly
    const timer = setTimeout(() => {
      setVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
    } catch (_) {}
    setVisible(false);
  };

  const handleEnablePush = async () => {
    setLoading(true);
    try {
      const permission = await requestBrowserNotificationPermission();
      if (permission === "granted") {
        if (userId) {
          const regRes = await registerPushDeviceSubscription(userId);
          if (regRes.success) {
            toast.success(
              isRTL
                ? "تم تفعيل التنبيهات الفورية بنجاح!"
                : "Realtime push alerts enabled successfully!"
            );
          }
        } else {
          toast.success(
            isRTL
              ? "تم تفعيل إشعارات المتصفح بنجاح!"
              : "Browser notifications enabled!"
          );
        }
        setVisible(false);
      } else if (permission === "denied") {
        toast.info(
          isRTL
            ? "تم رفض الإذن. يمكنك تفعيله لاحقاً من إعدادات المتصفح."
            : "Notifications were blocked. You can enable them anytime in site settings."
        );
        handleDismiss();
      }
    } catch (err) {
      toast.error(isRTL ? "حدث خطأ أثناء التفعيل" : "Failed to enable notifications");
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={isRTL ? "تفعيل إشعارات SADA OS" : "SADA OS Push Notifications Setup"}
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-[#0c1017] border border-[#BFDBFE] dark:border-primary/40 p-3.5 sm:p-4 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 ${className}`}
    >
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 size-36 bg-primary/[0.05] dark:bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4 relative z-10">
        {/* Left / Info Section */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="size-10 rounded-full bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/25 grid place-items-center text-[#0878E8] dark:text-blue-400 shrink-0 shadow-xs">
            <Bell className="size-5 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-[13px] font-bold text-[#111827] dark:text-foreground font-heading tracking-wide">
                {isRTL
                  ? "تفعيل تنبيهات SADA OS الفورية"
                  : "Stay Informed With Realtime OS Push Alerts"}
              </h4>
              <span className="text-[9px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#0878E8] dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 shrink-0">
                {isRTL ? "توصية PWA" : "Recommended"}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {isRTL
                ? "احصل على تنبيهات فورية عند تعيين المهام، وطلبات المراجعة، وملاحظات العملاء حتى لو كان التطبيق مغلقاً."
                : "Receive instant updates for task assignments, client approvals, and team handoffs even when SADA OS is closed."}
            </p>
          </div>
        </div>

        {/* Right / CTA Section */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <SADAButton
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-[#64748B] dark:text-muted-foreground text-xs hover:text-[#111827] dark:hover:text-foreground h-8 px-2.5"
          >
            {isRTL ? "لاحقاً" : "Maybe Later"}
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleEnablePush}
            isLoading={loading}
            leftIcon={<Sparkles className="size-3.5" />}
            className="h-8 text-xs font-semibold px-3.5 bg-[#0878E8] hover:bg-[#0764C4] text-white shadow-xs"
          >
            {isRTL ? "تفعيل الإشعارات الآن" : "Enable Push Alerts"}
          </SADAButton>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#111827] dark:hover:text-foreground hover:bg-muted/40 transition-colors ml-0.5 cursor-pointer"
            aria-label={isRTL ? "إغلاق التنبيه" : "Dismiss banner"}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

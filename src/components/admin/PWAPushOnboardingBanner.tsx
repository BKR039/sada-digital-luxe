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
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-card via-card/95 to-primary/[0.04] border border-primary/30 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 ${className}`}
    >
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 size-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left / Info Section */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center text-primary shrink-0 shadow-inner">
            <Bell className="size-5 animate-pulse" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-foreground font-heading tracking-wide">
                {isRTL
                  ? "تفعيل تنبيهات SADA OS الفورية"
                  : "Stay Informed With Realtime OS Push Alerts"}
              </h4>
              <SADABadge variant="primary" size="xs">
                {isRTL ? "توصية PWA" : "Recommended"}
              </SADABadge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {isRTL
                ? "احصل على تنبيهات فورية عند تعيين المهام، وطلبات المراجعة، وملاحظات العملاء حتى لو كان التطبيق مغلقاً."
                : "Receive instant updates for task assignments, client approvals, and team handoffs even when SADA OS is closed."}
            </p>
          </div>
        </div>

        {/* Right / CTA Section */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <SADAButton
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-muted-foreground text-xs hover:text-foreground"
          >
            {isRTL ? "لاحقاً" : "Maybe Later"}
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleEnablePush}
            isLoading={loading}
            leftIcon={<Sparkles className="size-3.5" />}
          >
            {isRTL ? "تفعيل الإشعارات الآن" : "Enable Push Alerts"}
          </SADAButton>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted/30 transition-colors ml-1"
            aria-label={isRTL ? "إغلاق التنبيه" : "Dismiss banner"}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

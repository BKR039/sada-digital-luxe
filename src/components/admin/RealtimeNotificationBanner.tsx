// ============================================================
// SADA OS — REALTIME OPERATIONAL NOTIFICATION BANNER
// Canonical Reference Banner for In-App Operational Alerts
// Renders active urgent tasks, overdue alerts, and critical actions
// ============================================================

import React, { useState, useEffect, useMemo } from "react";
import { useNotifications } from "@/lib/notification-context";
import { resolveNotification } from "@/lib/notification-service";
import { getNotificationVisualTokens } from "@/lib/notification-ui-tokens";
import { useTranslation } from "@/i18n";
import { SADAButton, SADABadge } from "@/components/ui/sada-ui";
import { X, ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface RealtimeNotificationBannerProps {
  className?: string;
}

const DISMISSED_BANNER_KEY = "sada_dismissed_realtime_banner_ids";

export function RealtimeNotificationBanner({ className = "" }: RealtimeNotificationBannerProps) {
  const { t, isRTL, language } = useTranslation();
  const isAr = isRTL || language === "ar";
  const { notifications, unreadCount } = useNotifications();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  let nav: any;
  try {
    nav = useNavigate();
  } catch (_) {}

  // Load dismissed banner IDs from session storage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DISMISSED_BANNER_KEY);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  // Find the top urgent / priority actionable notification
  const activeAlert = useMemo(() => {
    const unreadList = notifications.filter(
      (n) => !n.read && !dismissedIds.includes(n.id) && Boolean(n.link_url)
    );

    // 1. Highest priority: Overdue or Urgent
    const urgent = unreadList.find(
      (n) =>
        n.priority === "urgent" ||
        n.event_type === "TASK_OVERDUE" ||
        n.event_type === "DELIVERABLE_BEHIND" ||
        n.event_type === "SECURITY_AUDIT"
    );
    if (urgent) return urgent;

    // 2. High priority: Due soon or Revisions
    const high = unreadList.find(
      (n) =>
        n.priority === "high" ||
        n.event_type === "TASK_DUE_SOON" ||
        n.event_type === "TASK_REVISION_REQUESTED"
    );
    if (high) return high;

    return null;
  }, [notifications, dismissedIds]);

  if (!activeAlert) return null;

  const tokens = getNotificationVisualTokens(activeAlert, { isRTL: isAr, isRead: false });
  const resolved = resolveNotification(activeAlert, t);
  const IconComp = tokens.IconComponent;

  const clientName = activeAlert.metadata?.clientName || activeAlert.metadata?.client_name;
  const contextTitle =
    activeAlert.context_title ||
    activeAlert.metadata?.taskTitle ||
    activeAlert.metadata?.projectName;
  const displayContext = clientName || contextTitle;

  const handleDismiss = () => {
    const next = [...dismissedIds, activeAlert.id];
    setDismissedIds(next);
    try {
      sessionStorage.setItem(DISMISSED_BANNER_KEY, JSON.stringify(next));
    } catch (_) {}
  };

  const handleAction = () => {
    if (activeAlert.link_url) {
      if (nav) {
        nav({ to: activeAlert.link_url as any });
      } else {
        window.location.href = activeAlert.link_url;
      }
    }
  };

  return (
    <div
      role="region"
      aria-label={resolved.title}
      className={cn(
        "relative overflow-hidden rounded-2xl p-3.5 sm:p-4 shadow-md transition-all duration-300 select-none animate-in fade-in slide-in-from-top-2",
        "bg-white dark:bg-[#0c1017] border",
        tokens.cardBorderClasses,
        className
      )}
    >
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 size-36 bg-primary/[0.05] dark:bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 relative z-10">
        {/* Left & Center: Circular Pastel Icon + Notification Text */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={cn(
              "size-10 rounded-full flex items-center justify-center shrink-0 shadow-xs",
              tokens.iconContainerClasses
            )}
          >
            <IconComp className={cn("size-5 shrink-0", tokens.isUrgent && "animate-pulse")} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-[13px] font-bold text-[#111827] dark:text-foreground font-heading tracking-wide">
                {resolved.title}
              </h4>
              <span
                className={cn(
                  "text-[9px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-full shrink-0",
                  tokens.badgeClasses
                )}
              >
                {tokens.isUrgent ? (isAr ? "عاجل" : "Urgent Action") : isAr ? "تنبيه" : "Action Needed"}
              </span>
            </div>

            {resolved.message && (
              <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                {resolved.message}
              </p>
            )}

            {displayContext && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#94A3B8] dark:text-muted-foreground/80 mt-1">
                <span className="font-semibold text-[#64748B] dark:text-muted-foreground truncate max-w-[200px]">
                  {displayContext}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions Section */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <SADAButton
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-[#64748B] dark:text-muted-foreground text-xs hover:text-[#111827] dark:hover:text-foreground h-8 px-2.5"
          >
            {tokens.secondaryText}
          </SADAButton>

          <SADAButton
            variant="primary"
            size="sm"
            onClick={handleAction}
            className="h-8 text-xs font-semibold px-3.5 bg-[#0878E8] hover:bg-[#0764C4] text-white shadow-xs"
            rightIcon={
              isAr ? <ArrowLeft className="size-3.5" /> : <ArrowRight className="size-3.5" />
            }
          >
            {tokens.actionText}
          </SADAButton>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#111827] dark:hover:text-foreground hover:bg-muted/40 transition-colors ml-0.5"
            aria-label={isAr ? "إغلاق التنبيه" : "Dismiss alert"}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

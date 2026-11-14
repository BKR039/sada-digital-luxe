// ============================================================
// SADA OS — UNIFIED PREMIUM NOTIFICATION TOAST CARD
// Canonical Design System: White card, subtle border (#BFDBFE),
// soft shadow, rounded-2xl, circular pastel icon container,
// compact horizontal layout, and high-contrast SADA Blue CTA.
// ============================================================

import React from "react";
import type { NotificationItem } from "@/types/notifications-and-audit";
import { resolveNotification } from "@/lib/notification-service";
import { getNotificationVisualTokens } from "@/lib/notification-ui-tokens";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import { SADAButton, SADABadge } from "@/components/ui/sada-ui";
import { X, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationToastCardProps {
  item: NotificationItem;
  toastId: string | number;
  onNavigate?: (url: string) => void;
  onDismiss?: () => void;
}

export function NotificationToastCard({
  item,
  toastId,
  onNavigate,
  onDismiss,
}: NotificationToastCardProps) {
  const { t, isRTL, language } = useTranslation();
  const isAr =
    isRTL ||
    language === "ar" ||
    (typeof document !== "undefined" &&
      (document.documentElement.getAttribute("dir") === "rtl" ||
        document.documentElement.getAttribute("data-lang") === "ar" ||
        document.documentElement.lang === "ar"));

  const tokens = getNotificationVisualTokens(item, { isRTL: isAr, isRead: false });
  const resolved = resolveNotification(item, t);

  const clientName = item.metadata?.clientName || item.metadata?.client_name;
  const contextTitle =
    item.context_title ||
    item.metadata?.taskTitle ||
    item.metadata?.taskName ||
    item.metadata?.projectName;
  const displayContext = clientName || contextTitle;

  // Relative time string
  const formatTime = () => {
    try {
      const now = Date.now();
      const created = new Date(item.created_at || now).getTime();
      const diffSec = Math.max(0, Math.floor((now - created) / 1000));
      if (diffSec < 60) return isAr ? "الآن" : "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return isAr ? `${diffMin} د` : `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return isAr ? `${diffHr} س` : `${diffHr}h ago`;
      const diffDay = Math.floor(diffHr / 24);
      return isAr ? `${diffDay} ي` : `${diffDay}d ago`;
    } catch {
      return isAr ? "الآن" : "Just now";
    }
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.dismiss(toastId);
    if (item.link_url) {
      if (onNavigate) {
        onNavigate(item.link_url);
      } else {
        window.location.href = item.link_url;
      }
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.dismiss(toastId);
    onDismiss?.();
  };

  const IconComp = tokens.IconComponent;

  return (
    <div
      role="region"
      aria-label={resolved.title}
      aria-live={tokens.isUrgent ? "assertive" : "polite"}
      onClick={() => {
        if (item.link_url) {
          toast.dismiss(toastId);
          if (onNavigate) onNavigate(item.link_url);
          else window.location.href = item.link_url;
        }
      }}
      className={cn(
        "group/toast relative overflow-hidden rounded-2xl transition-all duration-200 select-none text-start",
        "bg-white dark:bg-[#0c1017] border shadow-xl dark:shadow-2xl",
        "p-3.5 sm:p-4 w-full max-w-[560px] cursor-pointer",
        tokens.cardBorderClasses
      )}
    >
      {/* Decorative Ambient Radial Glow */}
      <div className="absolute -top-10 -right-10 size-32 bg-primary/[0.04] dark:bg-primary/[0.08] rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 relative z-10">
        {/* Left & Center: Leading Circular Icon + Content */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Small contextual icon inside circular pastel container */}
          <div
            className={cn(
              "size-10 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover/toast:scale-105",
              tokens.iconContainerClasses
            )}
          >
            <IconComp className={cn("size-5 shrink-0", tokens.isUrgent && "animate-pulse")} />
          </div>

          {/* Text Content */}
          <div className="min-w-0 flex-1">
            {/* Title Row + Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-[13px] font-bold text-[#111827] dark:text-foreground font-heading tracking-wide line-clamp-1">
                {resolved.title}
              </h4>
              {tokens.isUrgent && (
                <span className="text-[9px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400 shrink-0">
                  {isAr ? "عاجل" : "URGENT"}
                </span>
              )}
            </div>

            {/* Concise Description */}
            {resolved.message && (
              <p className="text-[11px] sm:text-xs text-[#64748B] dark:text-muted-foreground mt-0.5 leading-relaxed line-clamp-2 break-words">
                {resolved.message}
              </p>
            )}

            {/* Subtle Metadata Row: Context + Relative Time */}
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#94A3B8] dark:text-muted-foreground/80 mt-1">
              {displayContext && (
                <span className="truncate max-w-[180px] font-semibold text-[#64748B] dark:text-muted-foreground">
                  {displayContext}
                </span>
              )}
              {displayContext && <span className="opacity-50">·</span>}
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="size-2.5 opacity-70" />
                {formatTime()}
              </span>
            </div>
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

          {item.link_url && (
            <SADAButton
              variant="primary"
              size="sm"
              onClick={handleAction}
              className="h-8 text-xs font-semibold px-3 bg-[#0878E8] hover:bg-[#0764C4] text-white shadow-xs"
              rightIcon={
                isAr ? (
                  <ArrowLeft className="size-3" />
                ) : (
                  <ArrowRight className="size-3" />
                )
              }
            >
              {tokens.actionText}
            </SADAButton>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#111827] dark:hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer shrink-0 ml-0.5"
            aria-label={isAr ? "إغلاق الإشعار" : "Dismiss notification"}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

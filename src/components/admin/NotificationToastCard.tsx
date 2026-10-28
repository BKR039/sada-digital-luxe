// ============================================================
// SADA OS — PREMIUM NOTIFICATION TOAST CARD
// Phase 8: Refined Luxury Toast Card & Adaptive Stacking
// Three-zone architecture: Leading Icon, Rich Content, Target Action
// ============================================================

import React from "react";
import type { NotificationItem } from "@/types/notifications-and-audit";
import { getSemanticSeverity } from "@/lib/notification-service";
import { useTranslation } from "@/i18n";
import { toast } from "sonner";
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  CheckCircle2,
  MessageSquare,
  Bell,
  ArrowRight,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
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
  const { isRTL, language } = useTranslation();
  const isAr =
    isRTL ||
    language === "ar" ||
    (typeof document !== "undefined" &&
      (document.documentElement.getAttribute("dir") === "rtl" ||
        document.documentElement.getAttribute("data-lang") === "ar" ||
        document.documentElement.lang === "ar"));

  const severity = getSemanticSeverity(item);

  // ------------------------------------------------------------
  // 1. LEADING ICON & TINTED CIRCULAR BADGE RESOLUTION
  // ------------------------------------------------------------
  let IconComponent = Bell;
  let iconContainerClasses = "bg-primary/15 text-primary border-primary/25";
  let borderAccentClasses = "border-s-primary border-s-3 ring-1 ring-primary/15";
  let severityLabel = isAr ? "إشعار" : "INFO";

  switch (severity) {
    case "URGENT":
      IconComponent = AlertTriangle;
      iconContainerClasses = "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      borderAccentClasses = "border-s-rose-500 border-s-3 ring-1 ring-rose-500/20";
      severityLabel = isAr ? "عاجل" : "URGENT";
      break;
    case "WARNING":
      IconComponent = AlertCircle;
      iconContainerClasses = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      borderAccentClasses = "border-s-amber-500 border-s-3 ring-1 ring-amber-500/20";
      severityLabel = isAr ? "تنبيه" : "WARNING";
      break;
    case "SECURITY":
      IconComponent = Shield;
      iconContainerClasses = "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
      borderAccentClasses = "border-s-purple-500 border-s-3 ring-1 ring-purple-500/20";
      severityLabel = isAr ? "أمان" : "SECURITY";
      break;
    case "SUCCESS":
      IconComponent = CheckCircle2;
      iconContainerClasses = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      borderAccentClasses = "border-s-emerald-500 border-s-3 ring-1 ring-emerald-500/20";
      severityLabel = isAr ? "مكتمل" : "SUCCESS";
      break;
    case "MESSAGE":
      IconComponent = MessageSquare;
      iconContainerClasses = "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30";
      borderAccentClasses = "border-s-sky-500 border-s-3 ring-1 ring-sky-500/20";
      severityLabel = isAr ? "رسالة" : "MESSAGE";
      break;
    case "INFO":
    default:
      IconComponent = Bell;
      iconContainerClasses = "bg-primary/15 text-primary border-primary/25";
      borderAccentClasses = "border-s-primary border-s-3 ring-1 ring-primary/15";
      severityLabel = isAr ? "إشعار" : "INFO";
      break;
  }

  // ------------------------------------------------------------
  // 2. SECONDARY METADATA & RELATIVE TIME RESOLUTION
  // ------------------------------------------------------------
  const clientName = item.metadata?.clientName || item.metadata?.client_name;
  const contextTitle =
    item.context_title ||
    item.metadata?.taskTitle ||
    item.metadata?.taskName ||
    item.metadata?.projectName ||
    (item.source_module ? item.source_module.toUpperCase() : null);

  const displayContext = clientName || contextTitle || item.category;

  // Relative time calculator
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

  // ------------------------------------------------------------
  // 3. TARGET ACTION LABEL RESOLUTION
  // ------------------------------------------------------------
  const getActionText = () => {
    if (!item.link_url) return null;
    const url = item.link_url.toLowerCase();
    const event = (item.event_type || "").toUpperCase();

    if (url.includes("task") || event.startsWith("TASK_")) {
      return isAr ? "عرض المهمة" : "View task";
    }
    if (url.includes("finance") || url.includes("salary") || url.includes("commissions")) {
      return isAr ? "عرض المالية" : "View finance";
    }
    if (url.includes("client") || url.includes("workspace")) {
      return isAr ? "عرض مساحة العميل" : "Open workspace";
    }
    if (url.includes("sales") || url.includes("deals")) {
      return isAr ? "عرض الصفقة" : "View deal";
    }
    return isAr ? "عرض التفاصيل" : "View item";
  };

  const actionText = getActionText();

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

  return (
    <div
      role="alert"
      aria-live={severity === "URGENT" ? "assertive" : "polite"}
      onClick={() => {
        if (item.link_url) {
          toast.dismiss(toastId);
          if (onNavigate) onNavigate(item.link_url);
          else window.location.href = item.link_url;
        }
      }}
      className={cn(
        "group/toast relative w-full select-none text-start transition-all duration-200",
        "bg-card/95 dark:bg-[#0c1017]/95 backdrop-blur-md",
        "border border-border/80 shadow-xl dark:shadow-2xl rounded-2xl",
        "p-3 sm:p-3.5",
        "flex items-start gap-2.5 sm:gap-3",
        "cursor-pointer hover:border-primary/40 hover:shadow-2xl",
        borderAccentClasses
      )}
    >
      {/* ========================================================
          A. LEADING ICON: Compact severity icon inside tinted circular bg
          ======================================================== */}
      <div
        className={cn(
          "size-8 sm:size-9 rounded-full shrink-0 flex items-center justify-center border transition-transform duration-200 group-hover/toast:scale-105",
          iconContainerClasses
        )}
      >
        <IconComponent className={cn("size-4 shrink-0", severity === "URGENT" && "animate-pulse")} />
      </div>

      {/* ========================================================
          B. NOTIFICATION CONTENT: Title, Secondary Metadata, Description
          ======================================================== */}
      <div className="flex-1 min-w-0">
        {/* Top Header Row: Severity Badge, Client/Context Entity, Subtle Timestamp */}
        <div className="flex items-center justify-between gap-1.5 leading-none mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Severity Pill (Textual accessibility so not color-only) */}
            <span
              className={cn(
                "text-[9px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full shrink-0",
                severity === "URGENT"
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : severity === "WARNING"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : severity === "SECURITY"
                  ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                  : severity === "SUCCESS"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : severity === "MESSAGE"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                  : "bg-primary/10 text-primary"
              )}
            >
              {severityLabel}
            </span>

            {/* Client / Context / Source Entity */}
            {displayContext && (
              <span
                className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate max-w-[140px] sm:max-w-[160px]"
                title={displayContext}
              >
                · {displayContext}
              </span>
            )}
          </div>

          {/* Right/Left Timestamp & Dismiss Button Container */}
          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/75">
            <span className="text-[10px] font-mono tabular-nums flex items-center gap-0.5">
              <Clock className="size-2.5 opacity-70" />
              {formatTime()}
            </span>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label={isAr ? "إغلاق الإشعار" : "Dismiss notification"}
              className="size-5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/80 transition-colors grid place-items-center cursor-pointer focus:outline-hidden focus-visible:ring-1 focus-visible:ring-primary"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>

        {/* Title: High visual priority */}
        <h4 className="text-xs sm:text-[13px] font-bold text-foreground leading-snug line-clamp-2 transition-colors group-hover/toast:text-primary">
          {item.title}
        </h4>

        {/* Description: Maximum ~2 lines, graceful truncation */}
        {item.message && (
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-0.5 break-words">
            {item.message}
          </p>
        )}

        {/* ========================================================
            C. ACTION: Compact, clearly clickable text link with arrow
            ======================================================== */}
        {item.link_url && actionText && (
          <div className="mt-2 pt-1 border-t border-border/40 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer group/link focus:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded py-0.5"
            >
              <span>{actionText}</span>
              <ArrowRight className="size-3 rtl:rotate-180 transition-transform duration-150 group-hover/link:translate-x-0.5 rtl:group-hover/link:-translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

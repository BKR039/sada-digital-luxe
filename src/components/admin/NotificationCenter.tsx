// ============================================================
// SADA OS — NOTIFICATION EXPERIENCE 2.1: ATTENTION MANAGEMENT SYSTEM
// High-Density Alert Console, Responsive Mobile Sheet / Drawer,
// Semantic Urgency Badges, Smart Grouping 2.1, Actionable Cockpit,
// Dynamic Attention Summary, and Restrained Single-Cycle Arrival Signals.
// ============================================================

import React, { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  CheckCheck,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Shield,
  Film,
  Check,
  Inbox,
  Flame,
  CircleDot,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  User,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Zap,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useNotifications } from "@/lib/notification-context";
import {
  resolveNotification,
  getSemanticSeverity,
  getFunctionalCategory,
  groupSimilarNotifications,
} from "@/lib/notification-service";
import type {
  NotificationItem,
  NotificationPriority,
  NotificationSemanticSeverity,
  NotificationGroup,
} from "@/types/notifications-and-audit";
import { NotificationPreferencesModal } from "@/components/admin/NotificationPreferencesModal";
import { formatRelativeTime } from "@/lib/date-locale";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/lib/auth";
import {
  NotificationCenterSkeleton,
  SADAButton,
  SADABadge,
  SADASelect,
  SADAEmptyState,
  SADAErrorState,
  SADADrawer,
} from "@/components/ui/sada-ui";

// ============================================================
// 1. PERSISTENT HEADER / LOGO NOTIFICATION INDICATOR
// ============================================================

interface SadaNotificationIndicatorProps {
  variant?: "header" | "sidebar" | "mobile" | "logo-badge" | "compact";
  onClick?: () => void;
  className?: string;
}

export const SadaNotificationIndicator = React.forwardRef<
  HTMLButtonElement,
  SadaNotificationIndicatorProps & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({
  variant = "header",
  onClick,
  className = "",
  ...restProps
}, ref) => {
  const { t, isRTL } = useTranslation();
  const { unreadCount, hasUrgent, hasHighPriority, isNewArrival } = useNotifications();

  const isUrgentState = hasUrgent || (hasHighPriority && unreadCount > 0);
  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...restProps}
      className={`relative grid place-items-center rounded-xl transition-all cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary select-none ${
        variant === "header" || variant === "sidebar" || variant === "mobile"
          ? "size-9 hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-border/70 bg-card/80 backdrop-blur-xs shadow-2xs hover:border-border hover:shadow-xs active:scale-95"
          : variant === "logo-badge"
          ? "size-8 hover:bg-muted/70 text-muted-foreground hover:text-foreground border border-border/50 bg-card/60 backdrop-blur-xs"
          : "size-8 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
      } ${className}`}
      aria-label={`${t("notifications.title") || "Attention Management"}${
        unreadCount > 0 ? ` (${unreadCount} ${isRTL ? "غير مقروء" : "unread"})` : ""
      }`}
      title={`${t("notifications.title") || "Attention Management"}${
        unreadCount > 0 ? ` (${unreadCount})` : ""
      }`}
      aria-haspopup="dialog"
    >
      {/* Alert Bell with restrained single-cycle ring animation */}
      <Bell
        className={`size-4 transition-transform ${
          isNewArrival ? "sada-arrival-ring text-primary" : ""
        } ${isUrgentState ? "text-rose-500" : ""}`}
      />

      {/* Unread Counter Badge with non-looping arrival halo */}
      {unreadCount > 0 && (
        <span
          className={`absolute top-0 end-0 min-w-[17px] h-[17px] px-0.5 rounded-full font-mono text-[9px] font-extrabold flex items-center justify-center transition-transform shadow-xs tabular-nums select-none ${
            isUrgentState
              ? "bg-rose-600 text-white ring-1.5 ring-card"
              : "bg-primary text-primary-foreground ring-1.5 ring-card"
          }`}
        >
          {isNewArrival && (
            <span
              className={`absolute inset-0 rounded-full sada-arrival-halo ${
                isUrgentState ? "bg-rose-500" : "bg-primary"
              }`}
            />
          )}
          <span className="relative z-10 leading-none">{displayCount}</span>
        </span>
      )}
    </button>
  );
});
SadaNotificationIndicator.displayName = "SadaNotificationIndicator";

// ============================================================
// 2. MAIN ATTENTION MANAGEMENT SYSTEM (NOTIFICATION CENTER 2.1)
// ============================================================

interface NotificationCenterProps {
  userId?: string;
  userRole?: string;
  displayMode?: "popover" | "drawer" | "auto";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

type ActiveFilterTab =
  | "ALL"
  | "NEEDS_ATTENTION"
  | "TASK"
  | "OPERATIONS"
  | "FINANCE"
  | "MESSAGE"
  | "SECURITY"
  | "SYSTEM";

export function NotificationCenter({
  userId,
  userRole,
  displayMode = "auto",
  side,
  align,
}: NotificationCenterProps) {
  const { t, isRTL } = useTranslation();
  const auth = useAuth();
  const nav = useNavigate();

  // Desktop popover positioning:
  // In the admin sidebar (or when side not explicitly provided):
  // English LTR: Popover opens to the 'right' of the sidebar into the workspace canvas.
  // Arabic RTL: Popover opens to the 'left' of the sidebar into the workspace canvas.
  // This keeps the SADA Logo, Account Identity box, and sidebar items completely unobstructed.
  const popoverSide = side || (isRTL ? "left" : "right");
  const popoverAlign = align || "start";

  const effectiveUserId = userId || auth.user?.id;
  const effectiveRole = userRole || auth.role || "worker";
  const hasFinanceAccess = auth.canAccessModule
    ? auth.canAccessModule("finance")
    : effectiveRole === "super_admin";

  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    isPreferencesOpen,
    setIsPreferencesOpen,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveFilterTab>("ALL");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | NotificationPriority>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Helper: Evaluates if an item requires immediate action ("NEEDS ATTENTION")
  const isNeedsAttentionItem = (item: NotificationItem): boolean => {
    const severity = getSemanticSeverity(item);
    if (severity === "URGENT") return true;
    if (item.read) return false;

    const isUrgentOrHigh =
      item.priority === "urgent" ||
      item.priority === "high" ||
      severity === "WARNING" ||
      severity === "SECURITY";

    const event = (item.event_type || "").toUpperCase();
    const isActionableEvent =
      event.includes("BLOCKED") ||
      event.includes("OVERDUE") ||
      event.includes("APPROVAL") ||
      event.includes("PENDING") ||
      event.includes("AUDIT") ||
      event.includes("ALERT") ||
      event.includes("INVOICE_OVERDUE") ||
      event.includes("FAILED");

    return isUrgentOrHigh || isActionableEvent;
  };

  // Compute operational stats across feed for header cockpit & attention summary strip
  const attentionStats = useMemo(() => {
    let criticalCount = 0;
    let highCount = 0;
    let tasksCount = 0;
    let operationsCount = 0;
    let needsAttentionCount = 0;

    for (const n of notifications) {
      const severity = getSemanticSeverity(n);
      const isCriticalOrUrgent = n.priority === "urgent" || severity === "URGENT";
      const isHigh = n.priority === "high" || severity === "WARNING";
      const cat = getFunctionalCategory(n);

      if (!n.read) {
        if (isCriticalOrUrgent) criticalCount++;
        else if (isHigh) highCount++;

        if (cat === "TASK") tasksCount++;
        if (cat === "OPERATIONS") operationsCount++;

        if (isNeedsAttentionItem(n)) {
          needsAttentionCount++;
        }
      } else if (isCriticalOrUrgent) {
        // Unresolved urgent items maintain weight
        criticalCount++;
      }
    }

    return {
      criticalCount,
      highCount,
      tasksCount,
      operationsCount,
      needsAttentionCount,
      hasUrgentItems: criticalCount > 0 || highCount > 0,
    };
  }, [notifications]);

  // Compute unread counts per tab
  const categoryUnreadCounts = useMemo(() => {
    const counts: Record<ActiveFilterTab, number> = {
      ALL: unreadCount,
      NEEDS_ATTENTION: 0,
      TASK: 0,
      OPERATIONS: 0,
      FINANCE: 0,
      MESSAGE: 0,
      SYSTEM: 0,
      SECURITY: 0,
    };

    for (const n of notifications) {
      if (!n.read) {
        if (isNeedsAttentionItem(n)) {
          counts.NEEDS_ATTENTION++;
        }

        const isFinance =
          n.category === "finance" ||
          n.category === "billing" ||
          n.event_type?.startsWith("INVOICE_") ||
          n.event_type?.startsWith("COMMISSION_") ||
          n.event_type?.startsWith("SALARY_");

        if (isFinance) {
          counts.FINANCE++;
        }

        const cat = getFunctionalCategory(n);
        if (cat === "OPERATIONS" || cat === "SECURITY" || cat === "SYSTEM") {
          counts.OPERATIONS++;
        } else if (cat in counts) {
          counts[cat]++;
        }
      }
    }

    return counts;
  }, [notifications, unreadCount]);

  // Filter pipeline
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // 1. Attention & Functional Category Tab
      if (activeTab === "NEEDS_ATTENTION") {
        if (!isNeedsAttentionItem(n)) return false;
      } else if (activeTab === "FINANCE") {
        const isFinance =
          n.category === "finance" ||
          n.category === "billing" ||
          n.event_type?.startsWith("INVOICE_") ||
          n.event_type?.startsWith("COMMISSION_") ||
          n.event_type?.startsWith("SALARY_");
        if (!isFinance) return false;
      } else if (activeTab === "OPERATIONS") {
        const cat = getFunctionalCategory(n);
        if (cat !== "OPERATIONS" && cat !== "SECURITY" && cat !== "SYSTEM") return false;
      } else if (activeTab !== "ALL") {
        const cat = getFunctionalCategory(n);
        if (cat !== activeTab) return false;
      }

      // 2. Urgent toggle
      if (urgentOnly) {
        const isUrgent = n.priority === "urgent" || getSemanticSeverity(n) === "URGENT";
        if (!isUrgent) return false;
      }

      // 3. Unread toggle
      if (unreadOnly && n.read) {
        return false;
      }

      // 4. Priority select
      if (priorityFilter !== "all" && n.priority !== priorityFilter) {
        return false;
      }

      // 5. Search query (title, message, context_title, client name, module)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (n.title || "").toLowerCase().includes(q);
        const msgMatch = (n.message || "").toLowerCase().includes(q);
        const contextMatch = (n.context_title || "").toLowerCase().includes(q);
        const moduleMatch = (n.source_module || "").toLowerCase().includes(q);
        const clientMatch = String(n.metadata?.clientName || n.metadata?.client_name || "").toLowerCase().includes(q);
        const taskMatch = String(n.metadata?.taskTitle || n.metadata?.taskName || "").toLowerCase().includes(q);

        if (!titleMatch && !msgMatch && !contextMatch && !moduleMatch && !clientMatch && !taskMatch) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, activeTab, urgentOnly, unreadOnly, priorityFilter, searchQuery]);

  // Smart grouped feed items
  const feedItems = useMemo(() => {
    // Only group when not actively searching to avoid obscuring search matches
    if (searchQuery.trim()) {
      return filteredNotifications.map((item) => ({ kind: "single" as const, item }));
    }
    return groupSimilarNotifications(filteredNotifications, 3);
  }, [filteredNotifications, searchQuery]);

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const handleCardClick = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    if (item.link_url) {
      setOpen(false);
      setIsMobileDrawerOpen(false);
      nav({ to: item.link_url as any });
    }
  };

  const handleGroupAction = async (group: NotificationGroup) => {
    for (const item of group.items) {
      if (!item.read) {
        markAsRead(item.id);
      }
    }
    if (group.linkUrl) {
      setOpen(false);
      setIsMobileDrawerOpen(false);
      nav({ to: group.linkUrl as any });
    }
  };

  // Specific, operational action verb resolver
  const getActionLabel = (item: NotificationItem, isRtlLocale: boolean): string => {
    const cat = getFunctionalCategory(item);
    const event = (item.event_type || "").toUpperCase();
    const title = (item.title || "").toLowerCase();

    if (event.includes("BLOCKED") || title.includes("block")) {
      return isRtlLocale ? "معالجة العائق" : "Resolve Blocked";
    }
    if (event.includes("APPROVAL") || title.includes("approval")) {
      return isRtlLocale ? "مراجعة الموافقة" : "Review Approval";
    }
    if (event.includes("OVERDUE") || title.includes("overdue")) {
      return isRtlLocale ? "فحص المتأخرات" : "Inspect Overdue";
    }
    if (cat === "TASK") {
      return isRtlLocale ? "فتح المهمة" : "Open Task";
    }
    if (cat === "OPERATIONS") {
      if (
        item.category === "billing" ||
        item.category === "finance" ||
        event.includes("INVOICE") ||
        event.includes("PAYMENT")
      ) {
        return isRtlLocale ? "مراجعة الدفعة" : "Review Payment";
      }
      if (item.category === "clients" || item.entity_type === "client") {
        return isRtlLocale ? "فتح ملف العميل" : "Open Client";
      }
      if (item.category === "production" || event.includes("PRODUCTION")) {
        return isRtlLocale ? "عرض جدول التسليم" : "Open Delivery";
      }
      return isRtlLocale ? "فتح العمليات" : "Open Operations";
    }
    if (cat === "MESSAGE") {
      return isRtlLocale ? "فتح المحادثة" : "Open Message";
    }
    if (cat === "SECURITY") {
      return isRtlLocale ? "فحص سجل الأمان" : "Review Security";
    }
    return isRtlLocale ? "عرض التفاصيل" : "Open Details";
  };

  const CATEGORY_TABS = useMemo(() => {
    const tabs: Array<{ id: ActiveFilterTab; label: string; icon?: React.ReactNode }> = [
      { id: "ALL", label: isRTL ? "الكل" : "All" },
      {
        id: "NEEDS_ATTENTION",
        label: isRTL ? "يتطلب إجراء" : "Needs Attention",
        icon: <Zap className="size-3 text-amber-500 shrink-0" />,
      },
      { id: "TASK", label: isRTL ? "المهام" : "Tasks" },
      { id: "OPERATIONS", label: isRTL ? "العمليات" : "Operations" },
    ];

    if (hasFinanceAccess) {
      tabs.push({ id: "FINANCE", label: isRTL ? "المالية" : "Finance" });
    }

    tabs.push({ id: "MESSAGE", label: isRTL ? "الرسائل" : "Messages" });

    return tabs;
  }, [isRTL, hasFinanceAccess]);

  const priorityOptions = [
    { value: "all", label: isRTL ? "الكل" : "All Priorities" },
    { value: "urgent", label: isRTL ? "عاجل" : "Urgent" },
    { value: "high", label: isRTL ? "عالي" : "High" },
    { value: "normal", label: isRTL ? "عادي" : "Normal" },
    { value: "low", label: isRTL ? "منخفض" : "Low" },
  ];

  const hasActiveFilters =
    activeTab !== "ALL" ||
    urgentOnly ||
    unreadOnly ||
    priorityFilter !== "all" ||
    Boolean(searchQuery.trim());

  // ============================================================
  // SINGLE NOTIFICATION COMPACT ROW RENDERER (5-LEVEL HIERARCHY)
  // Level 1: SEVERITY + CATEGORY + TIME + MARK READ
  // Level 2: TITLE
  // Level 3: CLIENT / CONTEXT / ENTITY
  // Level 4: SHORT OPERATIONAL EXPLANATION
  // Level 5: TARGET ACTION
  // ============================================================
  const renderNotificationRow = (item: NotificationItem) => {
    const resolved = resolveNotification(item, t);
    const timeAgo = formatRelativeTime(item.created_at);
    const severity = getSemanticSeverity(item);
    const category = getFunctionalCategory(item);
    const isActionable = Boolean(item.link_url);
    const actionLabel = getActionLabel(item, isRTL);
    const contextTitle =
      item.context_title || item.metadata?.taskTitle || item.metadata?.taskName;
    const clientName = item.metadata?.clientName || item.metadata?.client_name;
    const senderName = item.metadata?.senderName;

    // Check if event is resolved / completed to settle its visual prominence
    const isCompletedEvent =
      item.metadata?.status === "completed" ||
      (item.event_type || "").includes("COMPLETED") ||
      (item.event_type || "").includes("RESOLVED") ||
      severity === "SUCCESS";

    // Severity and Category labels
    const severityLabel =
      severity === "URGENT"
        ? (isRTL ? "عاجل" : "URGENT")
        : severity === "WARNING"
        ? (isRTL ? "تنبيه" : "WARNING")
        : severity === "SECURITY"
        ? (isRTL ? "أمان" : "SECURITY")
        : severity === "SUCCESS"
        ? (isRTL ? "مكتمل" : "SUCCESS")
        : severity === "MESSAGE"
        ? (isRTL ? "رسالة" : "MESSAGE")
        : (isRTL ? "معلومات" : "INFO");

    const categoryLabel =
      category === "TASK"
        ? (isRTL ? "مهمة" : "TASK")
        : category === "OPERATIONS"
        ? (isRTL ? "عمليات" : "OPERATIONS")
        : category === "MESSAGE"
        ? (isRTL ? "محادثة" : "MESSAGE")
        : category === "SECURITY"
        ? (isRTL ? "أمان" : "SECURITY")
        : category === "SYSTEM"
        ? (isRTL ? "نظام" : "SYSTEM")
        : (isRTL ? "عام" : "GENERAL");

    // Semantic Color tokens
    const severityTextClass =
      severity === "URGENT"
        ? "text-rose-500 dark:text-rose-400"
        : severity === "WARNING"
        ? "text-amber-500 dark:text-amber-400"
        : severity === "SECURITY"
        ? "text-purple-500 dark:text-purple-400"
        : severity === "SUCCESS"
        ? "text-emerald-500 dark:text-emerald-400"
        : severity === "MESSAGE"
        ? "text-sky-500 dark:text-sky-400"
        : "text-muted-foreground";

    const severityDotClass =
      severity === "URGENT"
        ? "bg-rose-500 shadow-rose-500/50 shadow-2xs"
        : severity === "WARNING"
        ? "bg-amber-500 shadow-amber-500/50 shadow-2xs"
        : severity === "SECURITY"
        ? "bg-purple-500 shadow-purple-500/50 shadow-2xs"
        : severity === "SUCCESS"
        ? "bg-emerald-500"
        : severity === "MESSAGE"
        ? "bg-sky-500"
        : "bg-slate-400";

    const unreadCardBorder =
      severity === "URGENT"
        ? "bg-rose-500/[0.04] dark:bg-rose-500/[0.08] border-rose-500/30 border-s-3 border-s-rose-500 shadow-2xs"
        : severity === "WARNING"
        ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border-amber-500/30 border-s-3 border-s-amber-500 shadow-2xs"
        : severity === "SECURITY"
        ? "bg-purple-500/[0.04] dark:bg-purple-500/[0.08] border-purple-500/30 border-s-3 border-s-purple-500 shadow-2xs"
        : severity === "SUCCESS"
        ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.08] border-emerald-500/30 border-s-3 border-s-emerald-500 shadow-2xs"
        : severity === "MESSAGE"
        ? "bg-sky-500/[0.04] dark:bg-sky-500/[0.08] border-sky-500/30 border-s-3 border-s-sky-500 shadow-2xs"
        : "bg-primary/[0.03] dark:bg-primary/[0.06] border-primary/25 border-s-3 border-s-primary shadow-2xs";

    const actionPillClass =
      severity === "URGENT"
        ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
        : severity === "WARNING"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
        : severity === "SECURITY"
        ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/25"
        : severity === "SUCCESS"
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
        : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20";

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => handleCardClick(item)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(item);
          }
        }}
        className={`p-2.5 rounded-lg border transition-all cursor-pointer relative text-start flex flex-col gap-0.5 group select-none min-w-0 ${
          !item.read
            ? unreadCardBorder
            : isCompletedEvent
            ? "bg-card/30 dark:bg-card/20 border-border/30 hover:bg-muted/30 opacity-70 hover:opacity-90"
            : "bg-card/50 dark:bg-card/30 border-border/40 hover:bg-muted/40 hover:border-border opacity-85 hover:opacity-100"
        }`}
      >
        {/* ROW 1: SEVERITY / CATEGORY + TIME + MARK READ */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono leading-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`size-1.5 rounded-full shrink-0 ${severityDotClass}`} />
            <span className={`font-bold tracking-wider uppercase truncate ${severityTextClass}`}>
              {severityLabel} · {categoryLabel}
            </span>
            {!item.read ? (
              <span className="text-[8.5px] font-extrabold text-primary px-1 py-0.2 rounded bg-primary/10 tracking-widest shrink-0">
                • NEW
              </span>
            ) : isCompletedEvent ? (
              <span className="text-[8.5px] font-semibold text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded bg-emerald-500/10 tracking-wider shrink-0">
                ✓ {isRTL ? "مكتمل" : "RESOLVED"}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/80">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {timeAgo}
            </span>
            {!item.read && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  markAsRead(item.id);
                }}
                className="size-4.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
                title={isRTL ? "تحديد كمقروء" : "Mark as read"}
                aria-label={isRTL ? "تحديد كمقروء" : "Mark as read"}
              >
                <Check className="size-2.5" />
              </button>
            )}
          </div>
        </div>

        {/* ROW 2: TITLE */}
        <h4
          dir="auto"
          className={`text-xs leading-snug mt-0.5 ${
            !item.read ? "font-bold text-foreground" : "font-semibold text-foreground/85"
          } [overflow-wrap:anywhere] break-words line-clamp-1 group-hover:line-clamp-2 transition-all`}
        >
          <bdi dir="auto">{resolved.title}</bdi>
        </h4>

        {/* ROW 3: CONTEXT / CLIENT / ENTITY + COMPACT ACTION */}
        <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-medium text-muted-foreground min-w-0 pt-0.5">
          <div className="flex items-center gap-1 min-w-0 flex-1 truncate">
            {clientName && (
              <bdi
                dir="auto"
                className="text-foreground/90 font-semibold truncate shrink-0 max-w-[45%]"
              >
                {clientName}
              </bdi>
            )}
            {clientName && (contextTitle || senderName) && <span className="opacity-40 shrink-0">·</span>}
            {contextTitle && (
              <bdi dir="auto" className="truncate min-w-0 flex-1 text-muted-foreground/90 [overflow-wrap:anywhere]">
                {contextTitle}
              </bdi>
            )}
            {senderName && !contextTitle && (
              <bdi dir="auto" className="truncate min-w-0 flex-1 inline-flex items-center gap-1">
                <User className="size-2.5 shrink-0" />
                {senderName}
              </bdi>
            )}
          </div>

          {isActionable && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-semibold transition-all shrink-0 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 ${actionPillClass}`}
            >
              <bdi dir="auto">{actionLabel}</bdi>
              {isRTL ? <ArrowLeft className="size-2.5" /> : <ArrowRight className="size-2.5" />}
            </span>
          )}
        </div>

        {/* ROW 4: SHORT OPERATIONAL EXPLANATION */}
        {resolved.message && (
          <p
            dir="auto"
            className="text-[10px] sm:text-[10.5px] text-muted-foreground/80 leading-snug line-clamp-1 group-hover:line-clamp-2 break-words mt-0.5"
          >
            <bdi dir="auto">{resolved.message}</bdi>
          </p>
        )}
      </div>
    );
  };

  // ============================================================
  // GROUP CARD RENDERER (SMART GROUPING 2.1)
  // Cross-client attention context, non-destructive underlying items
  // ============================================================
  const renderGroupCard = (group: NotificationGroup) => {
    const isExpanded = Boolean(expandedGroups[group.groupKey]);
    const timeAgo = formatRelativeTime(group.latestCreatedAt);

    // Extract unique client names and tasks for cross-client attention context
    const clientNames = Array.from(
      new Set(
        group.items
          .map((it) => it.metadata?.clientName || it.metadata?.client_name)
          .filter(Boolean) as string[]
      )
    );

    return (
      <div
        key={group.groupKey}
        className="p-2.5 rounded-lg border border-primary/30 bg-primary/[0.03] dark:bg-primary/[0.06] shadow-2xs transition-all space-y-1.5"
      >
        {/* GROUP HEADER: CATEGORY · COUNT + TIME + EXPAND */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono leading-none">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="size-1.5 rounded-full bg-primary shrink-0" />
            <span className="font-bold tracking-wider uppercase text-primary truncate">
              {isRTL ? "مجموعة عمليات" : "OPERATION GROUP"} · {group.count} {isRTL ? "عناصر" : "ITEMS"}
            </span>
            <span className="text-[8.5px] font-extrabold text-primary px-1 py-0.2 rounded bg-primary/10 tracking-widest shrink-0">
              • NEW
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground/80">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-2.5" />
              {timeAgo}
            </span>
            <button
              type="button"
              onClick={() => toggleGroupExpand(group.groupKey)}
              className="px-1.5 py-0.5 rounded text-[9.5px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <span>{isExpanded ? (isRTL ? "طي" : "Collapse") : (isRTL ? "عرض الكل" : "Expand")}</span>
              {isExpanded ? <ChevronUp className="size-2.5" /> : <ChevronDown className="size-2.5" />}
            </button>
          </div>
        </div>

        {/* GROUP TITLE */}
        <div>
          <h4 className="text-xs font-bold text-foreground leading-snug">
            {isRTL
              ? group.eventType === "TASK_ASSIGNED"
                ? `${group.count} مهام مسندة إليك`
                : group.eventType === "TASK_DUE_SOON"
                ? `${group.count} مهام يقترب موعد تسليمها`
                : group.eventType === "TASK_OVERDUE"
                ? `${group.count} مهام متأخرة عن الموعد`
                : group.eventType === "PAYMENT_RECEIVED"
                ? `${group.count} دفعات مالية مستلمة`
                : `${group.count} تنبيهات مهام جديدة`
              : group.title}
          </h4>
        </div>

        {/* CROSS-CLIENT ATTENTION CONTEXT SUBLINE */}
        {clientNames.length > 0 && (
          <div className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground flex-wrap">
            {clientNames.slice(0, 3).map((name, i) => (
              <React.Fragment key={name}>
                {i > 0 && <span className="opacity-40">·</span>}
                <bdi dir="auto" className="text-foreground/90 font-semibold truncate max-w-[120px]">
                  {name}
                </bdi>
              </React.Fragment>
            ))}
            {clientNames.length > 3 && (
              <span className="text-[9.5px] font-mono text-muted-foreground">
                +{clientNames.length - 3} {isRTL ? "عملاء" : "clients"}
              </span>
            )}
          </div>
        )}

        {/* COLLAPSED QUICK ACTION */}
        {!isExpanded && (
          <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[10px]">
            <button
              type="button"
              onClick={() => handleGroupAction(group)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer"
            >
              <span>{isRTL ? "عرض جميع المهام" : "View all tasks"}</span>
              {isRTL ? <ArrowLeft className="size-2.5" /> : <ArrowRight className="size-2.5" />}
            </button>
            <button
              type="button"
              onClick={async () => {
                for (const gi of group.items) {
                  await markAsRead(gi.id);
                }
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground font-mono cursor-pointer"
            >
              {isRTL ? "تحديد كمقروء" : "Mark group read"}
            </button>
          </div>
        )}

        {/* EXPANDED SUB-FEED */}
        {isExpanded && (
          <div className="space-y-1 pt-1 ps-2 border-s-2 border-primary/40 mt-1">
            {group.items.map((item) => renderNotificationRow(item))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // FEED CONTAINER COMPONENT
  // Attention Cockpit Header, Dynamic Summary, Tabs, Filters & Feed
  // ============================================================
  const renderNotificationFeed = (isMobileView = false) => {
    return (
      <div className="flex flex-col h-full min-h-0 overflow-hidden">
        {/* HEADER BAR: ATTENTION COCKPIT (DESKTOP) / COMPACT CONTROLS (MOBILE) */}
        {!isMobileView ? (
          <div className="px-3.5 py-2.5 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Bell className="size-3.5 text-primary shrink-0" />
                  <span className="text-xs font-bold font-heading text-foreground uppercase tracking-wider truncate">
                    {isRTL ? "إدارة الانتباه والعمليات" : "Attention Management"}
                  </span>
                  {attentionStats.criticalCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
                      <span className="size-1 rounded-full bg-rose-500 animate-pulse" />
                      {attentionStats.criticalCount} {isRTL ? "حرج" : "CRITICAL"}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-mono text-muted-foreground tracking-tight">
                  SADA OS ATTENTION SYSTEM
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <SADAButton
                  variant="ghost"
                  size="xs"
                  onClick={markAllAsRead}
                  leftIcon={<CheckCheck className="size-3" />}
                  className="text-[10.5px] h-6.5 px-2 font-medium"
                >
                  {t("notifications.markAllRead") || "Mark all read"}
                </SADAButton>
              )}
              <button
                type="button"
                onClick={() => refresh()}
                title={isRTL ? "تحديث" : "Refresh"}
                aria-label={isRTL ? "تحديث" : "Refresh"}
                className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              </button>
              {effectiveUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setIsMobileDrawerOpen(false);
                    setIsPreferencesOpen(true);
                  }}
                  className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
                  title={t("notifications.preferences") || "Preferences"}
                  aria-label={t("notifications.preferences") || "Preferences"}
                >
                  <Sliders className="size-3" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-3.5 py-2 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold font-heading text-foreground uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <Bell className="size-3 text-primary shrink-0" />
                {isRTL ? "الانتباه" : "Attention"}
              </span>
              {unreadCount > 0 && (
                <SADABadge variant="primary" size="xs" className="px-1.5 py-0.2 font-mono">
                  {unreadCount}
                </SADABadge>
              )}
              {attentionStats.criticalCount > 0 && (
                <SADABadge variant="danger" size="xs" dot pulse className="px-1.5 py-0.2 shadow-2xs font-bold font-mono">
                  {attentionStats.criticalCount}
                </SADABadge>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {unreadCount > 0 && (
                <SADAButton
                  variant="ghost"
                  size="xs"
                  onClick={markAllAsRead}
                  leftIcon={<CheckCheck className="size-3" />}
                  className="text-[10px] h-6 px-1.5 font-medium"
                >
                  {t("notifications.markAllRead") || "Mark read"}
                </SADAButton>
              )}
              <button
                type="button"
                onClick={() => refresh()}
                title={isRTL ? "تحديث" : "Refresh"}
                aria-label={isRTL ? "تحديث" : "Refresh"}
                className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              </button>
              {effectiveUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setIsMobileDrawerOpen(false);
                    setIsPreferencesOpen(true);
                  }}
                  className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors"
                  title={t("notifications.preferences") || "Preferences"}
                  aria-label={t("notifications.preferences") || "Preferences"}
                >
                  <Sliders className="size-3" />
                </button>
              )}
              {isMobileView && (
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="size-6.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer transition-colors ms-0.5"
                  aria-label={isRTL ? "إغلاق" : "Close"}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* DYNAMIC ATTENTION SUMMARY STRIP (SURFACES URGENCY, COLLAPSES WHEN 0 URGENT) */}
        {attentionStats.hasUrgentItems && (
          <div className="px-3 py-1 bg-rose-500/[0.04] dark:bg-rose-500/[0.07] border-b border-rose-500/20 flex items-center justify-between gap-1.5 text-[10.5px] font-mono shrink-0 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Flame className="size-2.5 text-rose-500" />
                {isRTL ? "الانتباه" : "ATTENTION"}
              </span>

              {attentionStats.criticalCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setUrgentOnly(true);
                    setActiveTab("ALL");
                  }}
                  className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="size-1 rounded-full bg-rose-500 animate-pulse" />
                  <span>{attentionStats.criticalCount} {isRTL ? "حرج" : "Critical"}</span>
                </button>
              )}

              {attentionStats.highCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPriorityFilter("high");
                    setActiveTab("ALL");
                  }}
                  className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="size-1 rounded-full bg-amber-500" />
                  <span>{attentionStats.highCount} {isRTL ? "عالي" : "High"}</span>
                </button>
              )}

              {attentionStats.tasksCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("TASK");
                    setUrgentOnly(false);
                  }}
                  className="px-1.5 py-0.2 rounded-full text-[9.5px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <span className="size-1 rounded-full bg-sky-500" />
                  <span>{attentionStats.tasksCount} {isRTL ? "مهام" : "Tasks"}</span>
                </button>
              )}
            </div>

            {attentionStats.needsAttentionCount > 0 && activeTab !== "NEEDS_ATTENTION" && (
              <button
                type="button"
                onClick={() => setActiveTab("NEEDS_ATTENTION")}
                className="text-[9.5px] text-primary hover:underline font-semibold shrink-0 cursor-pointer"
              >
                {isRTL ? "عرض العناصر الحرجة ←" : "Focus urgent →"}
              </button>
            )}
          </div>
        )}

        {/* PRIMARY CATEGORY NAVIGATION */}
        <div
          dir={isRTL ? "rtl" : "ltr"}
          className="flex items-center gap-1.5 px-3 py-2 border-b border-border/60 bg-muted/30 dark:bg-muted/20 text-xs overflow-x-auto sada-scrollbar overscroll-contain shrink-0"
        >
          {CATEGORY_TABS.map((tab) => {
            const tabUnread = categoryUnreadCounts[tab.id] || 0;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`h-7.5 min-h-[30px] px-2.5 sm:px-3 rounded-lg transition-all whitespace-nowrap cursor-pointer text-xs flex items-center gap-1.5 shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-primary text-primary-foreground font-bold shadow-xs border border-primary"
                    : "bg-card dark:bg-card/85 text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/80 hover:border-border shadow-2xs font-semibold"
                }`}
              >
                {tab.icon && (
                  <span className={isActive ? "text-primary-foreground" : ""}>
                    {tab.icon}
                  </span>
                )}
                <span>{tab.label}</span>
                {tabUnread > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none ${
                      isActive
                        ? "bg-primary-foreground/25 text-primary-foreground font-extrabold"
                        : "bg-primary/15 text-primary border border-primary/20 font-bold"
                    }`}
                  >
                    {tabUnread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SECONDARY FILTER CONTROLS */}
        <div className="px-3 py-1.5 border-b border-border/30 bg-card/60 flex items-center gap-1.5 text-xs shrink-0 overflow-x-auto no-scrollbar">
          {/* Search Input */}
          <div className="relative shrink-0 w-[120px] sm:w-[150px]">
            <Search className="size-2.5 text-muted-foreground absolute start-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? "بحث..." : "Search..."}
              className="w-full h-6.5 ps-6 pe-5 text-[10.5px] rounded-md border border-border/60 bg-muted/30 focus:bg-background focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="size-3.5 absolute end-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground grid place-items-center cursor-pointer"
                title={isRTL ? "مسح" : "Clear"}
              >
                <X className="size-2" />
              </button>
            )}
          </div>

          {/* Urgent Filter Toggle */}
          <button
            type="button"
            onClick={() => setUrgentOnly((prev) => !prev)}
            className={`px-2 py-0.5 h-6.5 rounded-md text-[10px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer border shrink-0 whitespace-nowrap ${
              urgentOnly
                ? "bg-rose-500/15 border-rose-500/40 text-rose-500 font-bold"
                : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Flame className="size-2.5" />
            <span>{isRTL ? "عاجل" : "Urgent"}</span>
          </button>

          {/* Unread Filter Toggle */}
          <button
            type="button"
            onClick={() => setUnreadOnly((prev) => !prev)}
            className={`px-2 py-0.5 h-6.5 rounded-md text-[10px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer border shrink-0 whitespace-nowrap ${
              unreadOnly
                ? "bg-primary/10 border-primary/30 text-primary font-bold"
                : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            <CircleDot className="size-2.5" />
            <span>{isRTL ? "غير مقروء" : "Unread"}</span>
          </button>

          {/* Priority Selector */}
          <div className="w-[105px] shrink-0">
            <SADASelect
              value={priorityFilter}
              onChange={(v) => setPriorityFilter(v as any)}
              options={priorityOptions}
              size="compact"
              placeholder={isRTL ? "الأولوية" : "Priority"}
            />
          </div>

          {/* Reset Filters shortcut */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("ALL");
                setUrgentOnly(false);
                setUnreadOnly(false);
                setPriorityFilter("all");
                setSearchQuery("");
              }}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground shrink-0 cursor-pointer underline whitespace-nowrap ps-1"
            >
              {isRTL ? "إعادة الضبط" : "Reset"}
            </button>
          )}
        </div>

        {/* SCROLLABLE NOTIFICATION LIST */}
        <div
          dir={isRTL ? "rtl" : "ltr"}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden sada-scrollbar overscroll-contain"
        >
          {loading && notifications.length === 0 ? (
            <div className="p-3">
              <NotificationCenterSkeleton />
            </div>
          ) : error ? (
            <div className="p-4">
              <SADAErrorState
                compact
                title={isRTL ? "تعذر تحميل الإشعارات" : "Failed to load alerts"}
                message={error}
                onRetry={() => refresh()}
              />
            </div>
          ) : feedItems.length === 0 ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center">
              <div className="size-8 rounded-full bg-muted/60 grid place-items-center text-muted-foreground mb-2">
                <Inbox className="size-4" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                {hasActiveFilters
                  ? (isRTL ? "لا توجد تنبيهات مطابقة للتصفية" : "No alerts match your current filters")
                  : (t("notifications.allCaughtUp") || "All caught up!")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[240px]">
                {hasActiveFilters
                  ? (isRTL ? "جرّب تغيير التصنيف أو خيارات البحث." : "Try adjusting your category or search query.")
                  : (t("notifications.emptyDescription") || "Zero pending alerts in your operational queue.")}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("ALL");
                    setUrgentOnly(false);
                    setUnreadOnly(false);
                    setPriorityFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-3 px-2.5 py-1 rounded-md text-[10.5px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  {isRTL ? "إعادة ضبط التصفية" : "Reset Filters"}
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 space-y-1.5 pb-8 sm:pb-4">
              {feedItems.map((feedItem) => {
                if (feedItem.kind === "group") {
                  return renderGroupCard(feedItem.group);
                }
                return renderNotificationRow(feedItem.item);
              })}
            </div>
          )}
        </div>

        {/* FOOTER TELEMETRY */}
        <div className="px-3 py-1.5 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[9.5px] text-muted-foreground font-mono shrink-0">
          <span className="truncate">
            {isRTL
              ? "نظام إدارة الانتباه SADA OS 2.2 • عزل أمني"
              : "SADA OS Attention Engine 2.2 • Security Isolated"}
          </span>
          <span className="shrink-0 px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground font-semibold">
            {filteredNotifications.length} {isRTL ? "عناصر" : "items"}
          </span>
        </div>
      </div>
    );
  };

  const showDesktop = displayMode === "popover" || displayMode === "auto";
  const showMobile = displayMode === "drawer" || displayMode === "auto";

  return (
    <>
      {/* DESKTOP POPOVER TRIGGER */}
      {showDesktop && (
        <div className={displayMode === "auto" ? "hidden md:block" : ""}>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <SadaNotificationIndicator
                variant="sidebar"
              />
            </PopoverTrigger>
            <PopoverContent
              align={popoverAlign}
              side={popoverSide}
              sideOffset={24}
              collisionPadding={16}
              className="w-[480px] max-w-[calc(100vw-24px)] h-[min(660px,calc(100vh-32px))] p-0 shadow-2xl border-border bg-card dark:bg-slate-950 overflow-hidden rounded-2xl z-50 flex flex-col"
            >
              {renderNotificationFeed(false)}
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* MOBILE TRIGGER BUTTON */}
      {showMobile && (
        <div className={displayMode === "auto" ? "md:hidden" : ""}>
          <SadaNotificationIndicator
            variant="mobile"
            onClick={() => setIsMobileDrawerOpen(true)}
          />
        </div>
      )}

      {/* MOBILE FULL DRAWER SHEET */}
      <SADADrawer
        open={isMobileDrawerOpen}
        onOpenChange={setIsMobileDrawerOpen}
        side="bottom"
        showCloseButton={false}
        className="p-0 overflow-hidden"
        contentClassName="p-0 max-h-[92dvh] h-[92dvh] rounded-t-3xl bg-card dark:bg-slate-950 border-t border-border shadow-2xl pb-safe flex flex-col"
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {renderNotificationFeed(true)}
        </div>
      </SADADrawer>

      {/* PREFERENCES MODAL */}
      {effectiveUserId && (
        <NotificationPreferencesModal
          open={isPreferencesOpen}
          onOpenChange={setIsPreferencesOpen}
          userId={effectiveUserId}
        />
      )}
    </>
  );
}

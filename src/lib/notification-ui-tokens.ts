// ============================================================
// SADA OS — UNIFIED PREMIUM NOTIFICATION UI TOKENS & RESOLVERS
// Canonical Visual System: White card, subtle border (#BFDBFE),
// soft shadow, rounded-2xl, circular pastel icon container,
// compact horizontal layout, and high-contrast SADA Blue CTA.
// ============================================================

import React from "react";
import type { NotificationItem, NotificationSemanticSeverity } from "@/types/notifications-and-audit";
import { getSemanticSeverity, getFunctionalCategory } from "@/lib/notification-service";
import {
  Bell,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Shield,
  DollarSign,
  Film,
  MessageSquare,
  FileEdit,
  UserCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export interface NotificationVisualTokens {
  severity: NotificationSemanticSeverity;
  IconComponent: React.ComponentType<{ className?: string }>;
  iconContainerClasses: string;
  cardBorderClasses: string;
  cardBgClasses: string;
  badgeClasses: string;
  dotClass: string;
  actionText: string;
  secondaryText?: string;
  isUrgent: boolean;
}

/**
 * Resolves canonical visual tokens matching the SADA OS push alert reference banner.
 */
export function getNotificationVisualTokens(
  item: NotificationItem,
  opts: { isRTL?: boolean; isRead?: boolean } = {}
): NotificationVisualTokens {
  const isAr = Boolean(opts.isRTL);
  const isRead = Boolean(opts.isRead ?? item.read);
  const severity = getSemanticSeverity(item);
  const category = getFunctionalCategory(item);
  const ev = (item.event_type || "").toUpperCase();
  const title = (item.title || "").toLowerCase();

  const isOverdue = ev === "TASK_OVERDUE" || ev === "DELIVERABLE_BEHIND" || title.includes("overdue");
  const isUrgent = severity === "URGENT" || isOverdue;

  // ------------------------------------------------------------
  // 1. CONTEXTUAL ICON RESOLUTION
  // ------------------------------------------------------------
  let IconComponent: React.ComponentType<{ className?: string }> = Bell;

  if (category === "SECURITY" || ev === "SECURITY_AUDIT") {
    IconComponent = Shield;
  } else if (category === "MESSAGE" || ev.includes("COMMENT") || ev.includes("MENTION")) {
    IconComponent = MessageSquare;
  } else if (ev.includes("REVISION")) {
    IconComponent = FileEdit;
  } else if (ev.includes("REVIEW") || ev.includes("APPROVAL")) {
    IconComponent = UserCheck;
  } else if (
    item.category === "finance" ||
    item.category === "billing" ||
    ev.includes("INVOICE") ||
    ev.includes("PAYMENT") ||
    ev.includes("COMMISSION") ||
    ev.includes("SALARY")
  ) {
    IconComponent = DollarSign;
  } else if (
    item.category === "production" ||
    ev.includes("PRODUCTION") ||
    ev.includes("CALENDAR") ||
    ev.includes("SHOOT")
  ) {
    IconComponent = Calendar;
  } else if (isOverdue) {
    IconComponent = AlertTriangle;
  } else if (ev.includes("DUE") || ev.includes("DEADLINE") || ev.includes("REMINDER")) {
    IconComponent = Clock;
  } else if (severity === "SUCCESS" || ev.includes("APPROVED") || ev.includes("COMPLETED")) {
    IconComponent = CheckCircle2;
  } else if (severity === "WARNING") {
    IconComponent = AlertCircle;
  }

  // ------------------------------------------------------------
  // 2. CANONICAL COLOR TOKENS (WHITE CARD, #BFDBFE BORDER, PASTEL CIRCLE)
  // ------------------------------------------------------------
  let iconContainerClasses =
    "bg-blue-50 dark:bg-blue-500/15 text-[#0878E8] dark:text-blue-400 border border-blue-100 dark:border-blue-500/25";
  let cardBorderClasses = "border-[#BFDBFE] dark:border-primary/40";
  let cardBgClasses = isRead
    ? "bg-[#F8FAFC]/90 dark:bg-[#0c1017]/60"
    : "bg-white dark:bg-[#0c1017]";
  let badgeClasses =
    "bg-blue-50 text-[#0878E8] dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20";
  let dotClass = "bg-[#0878E8]";

  if (severity === "URGENT" || isOverdue) {
    iconContainerClasses =
      "bg-red-50 dark:bg-red-500/15 text-[#DC2626] dark:text-red-400 border border-red-100 dark:border-red-500/25";
    cardBorderClasses = isRead
      ? "border-red-200/50 dark:border-red-500/20"
      : "border-red-200 dark:border-red-500/40";
    badgeClasses =
      "bg-red-50 text-[#DC2626] dark:bg-red-500/10 dark:text-red-400 border border-red-100 dark:border-red-500/20";
    dotClass = "bg-[#DC2626]";
  } else if (severity === "WARNING" || ev.includes("REVISION") || ev.includes("DUE_SOON")) {
    iconContainerClasses =
      "bg-amber-50 dark:bg-amber-500/15 text-[#D97706] dark:text-amber-400 border border-amber-100 dark:border-amber-500/25";
    cardBorderClasses = isRead
      ? "border-amber-200/50 dark:border-amber-500/20"
      : "border-amber-200 dark:border-amber-500/40";
    badgeClasses =
      "bg-amber-50 text-[#D97706] dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20";
    dotClass = "bg-[#D97706]";
  } else if (severity === "SUCCESS" || ev.includes("APPROVED") || ev.includes("PAID")) {
    iconContainerClasses =
      "bg-emerald-50 dark:bg-emerald-500/15 text-[#059669] dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/25";
    cardBorderClasses = isRead
      ? "border-emerald-200/50 dark:border-emerald-500/20"
      : "border-emerald-200 dark:border-emerald-500/40";
    badgeClasses =
      "bg-emerald-50 text-[#059669] dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20";
    dotClass = "bg-[#059669]";
  } else if (severity === "SECURITY") {
    iconContainerClasses =
      "bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/25";
    cardBorderClasses = isRead
      ? "border-purple-200/50 dark:border-purple-500/20"
      : "border-purple-200 dark:border-purple-500/40";
    badgeClasses =
      "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20";
    dotClass = "bg-purple-600";
  }

  // ------------------------------------------------------------
  // 3. CONTEXTUAL PRIMARY ACTION VERBS
  // Standardized against SADA OS canonical specification
  // ------------------------------------------------------------
  let actionText = isAr ? "عرض التفاصيل" : "Open Details";

  if (isOverdue) {
    actionText = isAr ? "معالجة المهمة" : "Resolve Task";
  } else if (ev === "TASK_ASSIGNED" || ev === "TASK_REASSIGNED") {
    actionText = isAr ? "فتح المهمة" : "Open Task";
  } else if (ev === "TASK_DUE_SOON" || ev === "TASK_DEADLINE" || ev === "REMINDER_DUE") {
    actionText = isAr ? "عرض المهمة" : "View Task";
  } else if (ev.includes("REVISION")) {
    actionText = isAr ? "مراجعة التعديلات" : "Review Changes";
  } else if (ev === "USER_MENTIONED" || ev === "TASK_COMMENT" || category === "MESSAGE") {
    actionText = isAr ? "عرض التعليق" : "View Comment";
  } else if (ev.includes("CLIENT_APPROVAL") || ev.includes("CLIENT_ACTION") || ev.includes("INQUIRY")) {
    actionText = isAr ? "عرض الطلب" : "View Request";
  } else if (ev.includes("REVIEW_REQUESTED") || ev.includes("APPROVAL_REQUIRED")) {
    actionText = isAr ? "مراجعة المهمة" : "Review Task";
  } else if (
    item.category === "finance" ||
    item.category === "billing" ||
    ev.includes("INVOICE") ||
    ev.includes("PAYMENT") ||
    ev.includes("SALARY") ||
    ev.includes("COMMISSION")
  ) {
    actionText = isAr ? "عرض المعاملة" : "View Transaction";
  } else if (
    item.category === "production" ||
    ev.includes("PRODUCTION") ||
    ev.includes("CALENDAR")
  ) {
    actionText = isAr ? "عرض الجدول" : "View Schedule";
  } else if (category === "SECURITY" || ev === "SECURITY_AUDIT") {
    actionText = isAr ? "فحص الأمان" : "Review Security";
  } else if (category === "TASK") {
    actionText = isAr ? "فتح المهمة" : "Open Task";
  }

  return {
    severity,
    IconComponent,
    iconContainerClasses,
    cardBorderClasses,
    cardBgClasses,
    badgeClasses,
    dotClass,
    actionText,
    secondaryText: isAr ? "لاحقاً" : "Maybe Later",
    isUrgent,
  };
}

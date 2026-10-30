// ============================================================
// SADA OS — PHASE 8: EVENT-DRIVEN NOTIFICATION & AUTOMATION ENGINE
// Role-aware notification dispatch, user preferences, automated scans,
// and real-time activity events for operations and finance.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  NotificationItem,
  NotificationEventType,
  NotificationCategory,
  NotificationPriority,
  RoleTarget,
  NotificationPreferences,
  NotificationSemanticSeverity,
  NotificationFunctionalCategory,
  NotificationPriorityTier,
  NotificationGroup,
} from "@/types/notifications-and-audit";
import { format, addDays, isPast, isTomorrow, parseISO } from "date-fns";
import { getBusinessRuleNumber } from "./business-rules-service";
import { assertAuthorizedMutation } from "@/lib/security-isolation-service";
import type { PermissionContext } from "@/lib/permissions";

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, "user_id"> = {
  task_assigned: true,
  task_due_soon: true,
  task_overdue: true,
  client_approval_required: true,
  invoice_overdue: true,
  payment_received: true,
  commission_eligible: true,
  commission_approved: true,
  salary_paid: true,
  salary_request_pending: true,
  production_tomorrow: true,
  deliverable_behind: true,
  month_end_closing: true,
  desktop_push_enabled: false,
  mobile_push_enabled: false,
  messages_enabled: true,
  operations_enabled: true,
  security_enabled: true,
};

// ============================================================
// PRIORITY WEIGHTING & SORTING RULES
// Urgent (4) > High (3) > Normal (2) > Low (1)
// ============================================================

export const PRIORITY_WEIGHTS: Record<NotificationPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Resolves semantic severity for visual language & alerts.
 * Categories: INFO | SUCCESS | WARNING | URGENT | ERROR | MESSAGE | SECURITY
 */
export function getSemanticSeverity(
  item: NotificationItem | { priority?: string; event_type?: string; category?: string }
): NotificationSemanticSeverity {
  const priority = item.priority || "normal";
  const eventType = item.event_type || "";
  const category = item.category || "system";

  if (priority === "urgent" || eventType === "TASK_BLOCKED") return "URGENT";
  if (category === "security" || eventType === "SECURITY_AUDIT") return "SECURITY";
  if (eventType === "TASK_ALERT" || eventType === "MANAGER_MESSAGE" || category === "messages") {
    return "MESSAGE";
  }
  if (
    eventType === "TASK_APPROVED" ||
    eventType === "TASK_PUBLISHED" ||
    eventType === "PAYMENT_RECEIVED" ||
    eventType === "COMMISSION_APPROVED" ||
    eventType === "SALARY_PAID"
  ) {
    return "SUCCESS";
  }
  if (priority === "high" || eventType === "TASK_OVERDUE" || eventType === "DELIVERABLE_BEHIND") {
    return "WARNING";
  }
  return "INFO";
}

/**
 * Resolves functional category for information architecture & filters.
 * Categories: TASK | OPERATIONS | MESSAGE | SYSTEM | SECURITY
 */
export function getFunctionalCategory(
  item: NotificationItem | { category?: string; entity_type?: string; event_type?: string }
): NotificationFunctionalCategory {
  const category = item.category || "";
  const entityType = item.entity_type || "";
  const eventType = item.event_type || "";

  if (
    category === "task" ||
    entityType === "task" ||
    entityType === "project_task" ||
    eventType.startsWith("TASK_")
  ) {
    return "TASK";
  }
  if (
    category === "production" ||
    category === "billing" ||
    category === "finance" ||
    category === "clients" ||
    eventType.startsWith("PRODUCTION_") ||
    eventType.startsWith("INVOICE_") ||
    eventType.startsWith("COMMISSION_") ||
    eventType.startsWith("SALARY_") ||
    eventType === "DELIVERABLE_BEHIND"
  ) {
    return "OPERATIONS";
  }
  if (
    category === "messages" ||
    eventType === "TASK_ALERT" ||
    eventType === "MANAGER_MESSAGE"
  ) {
    return "MESSAGE";
  }
  if (category === "security" || eventType === "SECURITY_AUDIT") {
    return "SECURITY";
  }
  return "SYSTEM";
}

/**
 * Maps database priority to standard OS priority tier (CRITICAL | HIGH | MEDIUM | LOW)
 */
export function getPriorityTier(priority?: NotificationPriority | string): NotificationPriorityTier {
  switch (priority) {
    case "urgent":
      return "CRITICAL";
    case "high":
      return "HIGH";
    case "normal":
      return "MEDIUM";
    case "low":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

/**
 * Feed item representation for smart grouping
 */
export type DisplayFeedItem =
  | { kind: "single"; item: NotificationItem }
  | { kind: "group"; group: NotificationGroup };

/**
 * Groups 3+ unread notifications of the same event_type to avoid feed clutter
 * while strictly preserving individual notifications upon expanding.
 */
export function groupSimilarNotifications(
  items: NotificationItem[],
  minGroupThreshold = 3
): DisplayFeedItem[] {
  const unreadByEvent = new Map<string, NotificationItem[]>();
  const feed: DisplayFeedItem[] = [];
  const processedIds = new Set<string>();

  for (const item of items) {
    if (!item.read) {
      const key = `${item.event_type}_${item.role_target}`;
      const list = unreadByEvent.get(key) || [];
      list.push(item);
      unreadByEvent.set(key, list);
    }
  }

  const groupEligibleKeys = new Set<string>();
  for (const [key, groupItems] of unreadByEvent.entries()) {
    if (groupItems.length >= minGroupThreshold) {
      groupEligibleKeys.add(key);
    }
  }

  for (const item of items) {
    if (processedIds.has(item.id)) continue;

    const key = `${item.event_type}_${item.role_target}`;
    if (!item.read && groupEligibleKeys.has(key)) {
      const groupItems = unreadByEvent.get(key) || [];
      groupEligibleKeys.delete(key);

      for (const gi of groupItems) {
        processedIds.add(gi.id);
      }

      const sample = groupItems[0];
      const functionalCategory = getFunctionalCategory(sample);
      const semanticSeverity = getSemanticSeverity(sample);

      let groupTitle = `${groupItems.length} new ${functionalCategory.toLowerCase()} alerts`;
      if (sample.event_type === "TASK_ASSIGNED") {
        groupTitle = `${groupItems.length} tasks assigned to you`;
      } else if (sample.event_type === "TASK_DUE_SOON") {
        groupTitle = `${groupItems.length} tasks due soon`;
      } else if (sample.event_type === "TASK_OVERDUE") {
        groupTitle = `${groupItems.length} tasks overdue`;
      } else if (sample.event_type === "PAYMENT_RECEIVED") {
        groupTitle = `${groupItems.length} payments received`;
      }

      feed.push({
        kind: "group",
        group: {
          groupKey: key,
          eventType: sample.event_type,
          functionalCategory,
          semanticSeverity,
          title: groupTitle,
          count: groupItems.length,
          items: groupItems,
          latestCreatedAt: groupItems[0].created_at,
          unreadCount: groupItems.filter((g) => !g.read).length,
          linkUrl: sample.link_url || "/admin/my-work",
          entityType: sample.entity_type,
        },
      });
    } else {
      processedIds.add(item.id);
      feed.push({ kind: "single", item });
    }
  }

  return feed;
}

/**
 * Sorts notifications strictly by priority first (Urgent > High > Normal > Low),
 * then by recency (created_at DESC).
 */
export function sortNotificationsByPriorityAndRecency(items: NotificationItem[]): NotificationItem[] {
  return [...items].sort((a, b) => {
    const weightA = PRIORITY_WEIGHTS[a.priority] ?? 2;
    const weightB = PRIORITY_WEIGHTS[b.priority] ?? 2;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return timeB - timeA;
  });
}

/**
 * Authoritative recipient and scope isolation check.
 * Enforces security invariant at API and Realtime layers:
 * - Worker A cannot see Worker B notifications
 * - Workers cannot see Admin-only or Super-Admin notifications
 * - Users without Finance access cannot receive Finance/Billing notifications
 */
export function isNotificationVisibleToUser(
  item: Partial<NotificationItem> | Record<string, any>,
  user: {
    userId?: string | null;
    role?: string | null;
    hasFinanceAccess?: boolean;
  }
): boolean {
  if (!user || !user.userId) return false;

  const userRole = user.role || "worker";

  // 1. Root Super Admin sees everything
  if (userRole === "super_admin") return true;

  // 2. Personal notification (user_id is set)
  if (item.user_id) {
    return item.user_id === user.userId;
  }

  // 3. Broadcast notification (user_id is null / undefined)
  const roleTarget: RoleTarget = item.role_target || "all";
  const category: NotificationCategory = item.category || "system";

  // Super Admin exclusive broadcast
  if (roleTarget === "super_admin") {
    return false;
  }

  // Admin broadcast
  if (userRole === "admin") {
    const isTargetRole = roleTarget === "admin" || roleTarget === "worker" || roleTarget === "all";
    if (!isTargetRole) return false;

    // Strict finance / billing isolation
    if (category === "finance" || category === "billing") {
      return Boolean(user.hasFinanceAccess);
    }
    return true;
  }

  // Worker broadcast
  if (roleTarget === "worker" || roleTarget === "all") {
    // Workers are strictly barred from finance, billing, and security broadcasts
    if (category === "finance" || category === "billing" || category === "security") {
      return false;
    }
    return true;
  }

  return false;
}

// ============================================================
// 1. FETCH NOTIFICATIONS (STRICT RECIPIENT & FINANCE ISOLATION)
// ============================================================

export interface FetchNotificationsParams {
  userId?: string;
  role?: string;
  hasFinanceAccess?: boolean;
  limit?: number;
}

export async function fetchNotifications(
  params: FetchNotificationsParams
): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  try {
    const limit = params.limit || 50;
    let query = (supabase as any)
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Apply strict recipient and role isolation filters at API query layer
    if (params.role === "super_admin") {
      // Super Admin sees all rows allowed by RLS
    } else if (params.role === "admin") {
      if (params.hasFinanceAccess) {
        query = query.or(
          `user_id.eq.${params.userId || "00000000-0000-0000-0000-000000000000"},and(user_id.is.null,role_target.in.(admin,worker,all))`
        );
      } else {
        // Exclude broadcast finance and billing from the query
        query = query.or(
          `user_id.eq.${params.userId || "00000000-0000-0000-0000-000000000000"},and(user_id.is.null,role_target.in.(admin,worker,all),category.not.in.(finance,billing))`
        );
      }
    } else {
      // Worker: only personal items OR broadcast worker/all non-finance non-billing non-security
      query = query.or(
        `user_id.eq.${params.userId || "00000000-0000-0000-0000-000000000000"},and(user_id.is.null,role_target.in.(worker,all),category.not.in.(finance,billing,security))`
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    // Defense in depth: secondary filter through authoritative isNotificationVisibleToUser
    const rawNotifications: NotificationItem[] = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      role_target: (row.role_target as RoleTarget) || "all",
      event_type: row.event_type as NotificationEventType,
      title: row.title,
      message: row.message,
      category: (row.category as NotificationCategory) || "system",
      priority: (row.priority as NotificationPriority) || "normal",
      link_url: row.link_url,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      context_title: row.context_title,
      source_module: row.source_module,
      metadata: row.metadata || {},
      i18n_key: row.i18n_key,
      i18n_params: row.i18n_params || {},
      read: Boolean(row.read),
      read_at: row.read_at,
      created_at: row.created_at,
    }));

    const verifiedNotifications = rawNotifications.filter((item) =>
      isNotificationVisibleToUser(item, {
        userId: params.userId,
        role: params.role,
        hasFinanceAccess: params.hasFinanceAccess,
      })
    );

    // Sort strictly: Priority first (Urgent > High > Normal > Low), then recency
    const notifications = sortNotificationsByPriorityAndRecency(verifiedNotifications);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return { notifications, unreadCount };
  } catch (err) {
    console.error("[fetchNotifications] Error:", err);
    return { notifications: [], unreadCount: 0 };
  }
}

// ============================================================
// 2. MARK AS READ / CLEAR
// ============================================================

export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[markNotificationAsRead] Error:", err);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId?: string): Promise<boolean> {
  try {
    let query = (supabase as any)
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("read", false);

    if (userId) {
      query = query.or(`user_id.eq.${userId},role_target.in.(all,worker,admin,super_admin)`);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[markAllNotificationsAsRead] Error:", err);
    return false;
  }
}

export async function deleteNotification(
  id: string,
  ctx?: PermissionContext,
  clientOverride?: any
): Promise<boolean> {
  try {
    const activeClient = clientOverride || supabase;
    const { data: notif } = await (activeClient as any)
      .from("notifications")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();

    await assertAuthorizedMutation(activeClient, "dashboard", "dashboard.clear_notification", {
      ctx,
      resourceType: "notification_message",
      resource: notif || { id },
      resourceAction: "delete",
    });

    const { error } = await (activeClient as any).from("notifications").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[deleteNotification] Error:", err);
    return false;
  }
}

// ============================================================
// 3. USER NOTIFICATION PREFERENCES
// ============================================================

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const { data, error } = await (supabase as any)
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      return {
        user_id: data.user_id,
        task_assigned: data.task_assigned ?? true,
        task_due_soon: data.task_due_soon ?? true,
        task_overdue: data.task_overdue ?? true,
        client_approval_required: data.client_approval_required ?? true,
        invoice_overdue: data.invoice_overdue ?? true,
        payment_received: data.payment_received ?? true,
        commission_eligible: data.commission_eligible ?? true,
        commission_approved: data.commission_approved ?? true,
        salary_paid: data.salary_paid ?? true,
        salary_request_pending: data.salary_request_pending ?? true,
        production_tomorrow: data.production_tomorrow ?? true,
        deliverable_behind: data.deliverable_behind ?? true,
        month_end_closing: data.month_end_closing ?? true,
        desktop_push_enabled: data.desktop_push_enabled ?? false,
        mobile_push_enabled: data.mobile_push_enabled ?? false,
        messages_enabled: data.messages_enabled ?? true,
        operations_enabled: data.operations_enabled ?? true,
        security_enabled: data.security_enabled ?? true,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    }

    // Default row
    return {
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  } catch (err) {
    console.error("[fetchNotificationPreferences] Error:", err);
    return {
      user_id: userId,
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences> & { user_id: string },
  ctx?: PermissionContext,
  clientOverride?: any
): Promise<boolean> {
  try {
    const activeClient = clientOverride || supabase;
    await assertAuthorizedMutation(activeClient, "dashboard", "dashboard.manage_preferences", {
      ctx,
      actorId: ctx?.userId || prefs.user_id,
      resourceType: "notification_message",
      resource: { user_id: prefs.user_id },
      resourceAction: "write",
    });

    const payload = {
      ...prefs,
      updated_at: new Date().toISOString(),
    };
    
    // Attempt upsert with all fields
    const { error } = await (activeClient as any)
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      // If error is due to newly added columns not yet populated in remote schema cache, fallback to base columns
      const basePayload = {
        user_id: prefs.user_id,
        task_assigned: prefs.task_assigned ?? true,
        task_due_soon: prefs.task_due_soon ?? true,
        task_overdue: prefs.task_overdue ?? true,
        client_approval_required: prefs.client_approval_required ?? true,
        invoice_overdue: prefs.invoice_overdue ?? true,
        payment_received: prefs.payment_received ?? true,
        commission_eligible: prefs.commission_eligible ?? true,
        commission_approved: prefs.commission_approved ?? true,
        salary_paid: prefs.salary_paid ?? true,
        salary_request_pending: prefs.salary_request_pending ?? true,
        production_tomorrow: prefs.production_tomorrow ?? true,
        deliverable_behind: prefs.deliverable_behind ?? true,
        month_end_closing: prefs.month_end_closing ?? true,
        updated_at: new Date().toISOString(),
      };
      const { error: fallbackError } = await (activeClient as any)
        .from("notification_preferences")
        .upsert(basePayload, { onConflict: "user_id" });
      if (fallbackError) throw fallbackError;
    }
    return true;
  } catch (err) {
    console.error("[saveNotificationPreferences] Error:", err);
    return false;
  }
}

// ============================================================
// 4. EMIT NOTIFICATION (EVENT DISPATCHER)
// ============================================================

export interface EmitNotificationParams {
  eventType: NotificationEventType;
  title: string;
  message: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  roleTarget?: RoleTarget;
  userId?: string | null;
  linkUrl?: string;
  entityType?: string;
  entityId?: string;
  contextTitle?: string;
  sourceModule?: string;
  metadata?: Record<string, any>;
  i18nKey?: string;
  i18nParams?: Record<string, any>;
  deduplicationKey?: string;
}

export async function emitNotification(
  params: EmitNotificationParams
): Promise<{ success: boolean; id?: string; deduplicated?: boolean; data?: any }> {
  try {
    // Default category mapping
    let category: NotificationCategory = params.category || "system";
    if (!params.category) {
      if (params.eventType.startsWith("TASK_")) category = "task";
      else if (
        params.eventType.startsWith("PRODUCTION_") ||
        params.eventType === "DELIVERABLE_BEHIND" ||
        params.eventType === "CLIENT_APPROVAL_REQUIRED"
      ) {
        category = "production";
      } else if (params.eventType.startsWith("INVOICE_") || params.eventType === "PAYMENT_RECEIVED") {
        category = "billing";
      } else if (
        params.eventType.startsWith("COMMISSION_") ||
        params.eventType.startsWith("SALARY_") ||
        params.eventType === "MONTH_END_CLOSING"
      ) {
        category = "finance";
      } else if (params.eventType === "SECURITY_AUDIT") {
        category = "security";
      }
    }

    // Default role target mapping
    let roleTarget: RoleTarget = params.roleTarget || "all";
    if (!params.roleTarget) {
      if (
        params.eventType === "SALARY_REQUEST_PENDING" ||
        params.eventType === "MONTH_END_CLOSING" ||
        params.eventType === "SECURITY_AUDIT"
      ) {
        roleTarget = "super_admin";
      } else if (params.eventType === "INVOICE_OVERDUE" || params.eventType === "PAYMENT_RECEIVED") {
        roleTarget = "admin";
      } else if (params.eventType === "TASK_ASSIGNED" || params.eventType === "SALARY_PAID") {
        roleTarget = "worker";
      }
    }

    // Security Invariant: Broadcast finance, billing, and security notifications
    // can never target workers
    if (
      !params.userId &&
      roleTarget === "worker" &&
      (category === "finance" || category === "billing" || category === "security")
    ) {
      console.warn(
        `[emitNotification] Security rejection: broadcast ${category} notification cannot target worker role.`
      );
      return { success: false, deduplicated: false };
    }

    // If targeted to a specific user, check preferences
    if (params.userId) {
      const prefs = await fetchNotificationPreferences(params.userId);
      const prefKeyMap: Partial<Record<NotificationEventType, keyof NotificationPreferences>> = {
        TASK_ASSIGNED: "task_assigned",
        TASK_DUE_SOON: "task_due_soon",
        TASK_OVERDUE: "task_overdue",
        TASK_DEADLINE: "task_due_soon",
        TASK_ALERT: "task_assigned",
        MANAGER_MESSAGE: "task_assigned",
        TASK_REASSIGNED: "task_assigned",
        TASK_BLOCKED: "task_assigned",
        TASK_UNBLOCKED: "task_assigned",
        TASK_REVIEW_REQUESTED: "task_assigned",
        TASK_REVISION_REQUESTED: "task_assigned",
        TASK_APPROVED: "task_assigned",
        TASK_PUBLISHING_HANDOFF: "task_assigned",
        TASK_PUBLISHED: "task_assigned",
        CLIENT_APPROVAL_REQUIRED: "client_approval_required",
        INVOICE_OVERDUE: "invoice_overdue",
        PAYMENT_RECEIVED: "payment_received",
        COMMISSION_ELIGIBLE: "commission_eligible",
        COMMISSION_APPROVED: "commission_approved",
        SALARY_PAID: "salary_paid",
        SALARY_REQUEST_PENDING: "salary_request_pending",
        PRODUCTION_TOMORROW: "production_tomorrow",
        DELIVERABLE_BEHIND: "deliverable_behind",
        MONTH_END_CLOSING: "month_end_closing",
        SECURITY_AUDIT: "month_end_closing",
        GENERAL: "task_assigned",
      };

      const key = prefKeyMap[params.eventType];
      if (key && prefs[key] === false) {
        // User opted out of this notification category
        return { success: true, deduplicated: false };
      }
    }

    // Deduplication Guard based on canonical business rules
    const targetEntityId = params.entityId || params.deduplicationKey;
    if (targetEntityId && params.eventType) {
      const dedupHours = getBusinessRuleNumber("notification_deduplication_hours", 24);
      const cutoff = new Date(Date.now() - dedupHours * 60 * 60 * 1000).toISOString();
      const { data: existing } = await (supabase as any)
        .from("notifications")
        .select("id")
        .eq("event_type", params.eventType)
        .eq("entity_id", targetEntityId)
        .gte("created_at", cutoff)
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        return { success: true, id: existing.id, deduplicated: true };
      }
    }

    const basePayload: any = {
      user_id: params.userId || null,
      role_target: roleTarget,
      event_type: params.eventType,
      title: params.title,
      message: params.message,
      category,
      priority: params.priority || "normal",
      link_url: params.linkUrl || null,
      entity_type: params.entityType || null,
      entity_id: targetEntityId || null,
      context_title: params.contextTitle || null,
      source_module: params.sourceModule || null,
      metadata: params.metadata || {},
      i18n_key: params.i18nKey || null,
      i18n_params: params.i18nParams || {},
      read: false,
    };

    let { data: inserted, error } = await (supabase as any)
      .from("notifications")
      .insert(basePayload)
      .select()
      .maybeSingle();

    // Graceful fallback if remote Supabase schema cache hasn't reloaded new columns yet (PGRST204)
    if (error && error.code === "PGRST204") {
      const corePayload = {
        user_id: params.userId || null,
        role_target: roleTarget,
        event_type: params.eventType,
        title: params.title,
        message: params.message,
        category,
        priority: params.priority || "normal",
        link_url: params.linkUrl || null,
        entity_type: params.entityType || null,
        entity_id: targetEntityId || null,
        read: false,
      };
      const retryResult = await (supabase as any)
        .from("notifications")
        .insert(corePayload)
        .select()
        .maybeSingle();
      if (!retryResult.error) {
        inserted = retryResult.data;
        error = null;
      }
    }

    if (error) throw error;
    if (inserted?.id) {
      // The Edge Function sends notifications through the service worker, including
      // when the recipient's PWA is closed. Do not block in-app notification creation.
      void (supabase as any).functions.invoke("send-web-push", {
        body: { notificationId: inserted.id },
      }).then(({ error: pushError }: { error: unknown }) => {
        if (pushError) console.warn("[emitNotification] Background push dispatch failed:", pushError);
      }).catch((pushError: unknown) => {
        console.warn("[emitNotification] Background push request failed:", pushError);
      });
    }
    return { success: true, id: inserted?.id, deduplicated: false, data: inserted };
  } catch (err) {
    console.error("[emitNotification] Error:", err);
    return { success: false, deduplicated: false };
  }
}

// ============================================================
// 5. AUTOMATED SCHEDULED / REACTIVE SCANS
// ============================================================

let lastScanTimestamp = 0;
let inFlightScan: Promise<{ scanned: number; emitted: number }> | null = null;

export async function scanAndEmitAutomations(): Promise<{ scanned: number; emitted: number }> {
  if (inFlightScan) return inFlightScan;
  if (Date.now() - lastScanTimestamp < 30000) {
    return { scanned: 0, emitted: 0 };
  }

  inFlightScan = (async () => {
    let emitted = 0;
    try {
      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");

      const dedupHours = getBusinessRuleNumber("notification_deduplication_hours", 24);
      const leadDays = getBusinessRuleNumber("task_due_soon_days", 2);
      const cutoff = new Date(Date.now() - dedupHours * 60 * 60 * 1000).toISOString();
      const { data: recentNotifs } = await (supabase as any)
        .from("notifications")
        .select("event_type, entity_id")
        .gte("created_at", cutoff);

      const recentKeys = new Set(
        (recentNotifs || []).map((n: any) => `${n.event_type}_${n.entity_id}`)
      );

      // --- A. TASK_OVERDUE & TASK_DUE_SOON ---
      const { data: tasks } = await (supabase as any)
        .from("project_tasks")
        .select("id, title, deadline, status, assignee_id, client_id, client:clients(name)")
        .not("status", "in", "(done,delivered,approved)");

      for (const t of tasks || []) {
        if (!t.deadline) continue;
        const dDate = parseISO(t.deadline);
        const diffDays = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        const clientName = t.client?.name || "Client";

        // Overdue (Urgent / High priority)
        if (isPast(dDate) && t.deadline < todayStr) {
          const key = `TASK_OVERDUE_${t.id}`;
          if (!recentKeys.has(key)) {
            await emitNotification({
              eventType: "TASK_OVERDUE",
              title: `Task Overdue: ${t.title}`,
              message: `Task for client ${clientName} passed its deadline on ${t.deadline}.`,
              category: "task",
              priority: "high",
              roleTarget: "admin",
              userId: t.assignee_id || null,
              linkUrl: `/admin/my-work?task=${t.id}`,
              entityType: "task",
              entityId: t.id,
              contextTitle: clientName,
              sourceModule: "tasks",
              metadata: { taskId: t.id, taskTitle: t.title, taskName: t.title, clientName, deadline: t.deadline },
              i18nKey: "notifications.events.task_overdue",
              i18nParams: { taskId: t.id, taskTitle: t.title, taskName: t.title, clientName, deadline: t.deadline },
            });
            recentKeys.add(key);
            emitted++;
          }
        }
        // Due Soon (Within configurable leadDays) - skip if task is blocked to avoid misleading alerts
        else if (t.status !== "blocked" && diffDays >= 0 && diffDays <= leadDays) {
          const key = `TASK_DUE_SOON_${t.id}`;
          if (!recentKeys.has(key)) {
            await emitNotification({
              eventType: "TASK_DUE_SOON",
              title: `Task Due Soon: ${t.title}`,
              message: `Task is due on ${t.deadline} (in ${diffDays === 0 ? "today" : diffDays + " day(s)"}). Action required.`,
              category: "task",
              priority: "normal",
              roleTarget: "worker",
              userId: t.assignee_id || null,
              linkUrl: `/admin/my-work?task=${t.id}`,
              entityType: "task",
              entityId: t.id,
              contextTitle: clientName,
              sourceModule: "tasks",
              metadata: { taskId: t.id, taskTitle: t.title, taskName: t.title, clientName, deadline: t.deadline },
              i18nKey: "notifications.events.task_due_soon",
              i18nParams: { taskId: t.id, taskTitle: t.title, taskName: t.title, clientName, deadline: t.deadline },
            });
            recentKeys.add(key);
            emitted++;
          }
        }
      }

      // --- B. INVOICE_OVERDUE ---
      const { data: overdueInvoices } = await (supabase as any)
        .from("invoices")
        .select("id, invoice_number, total_amount, paid_amount, due_date, status, client:clients(name)")
        .lt("due_date", todayStr)
        .not("status", "in", "('paid','cancelled')");

      for (const inv of overdueInvoices || []) {
        const key = `INVOICE_OVERDUE_${inv.id}`;
        if (!recentKeys.has(key)) {
          const clientName = inv.client?.name || "Client";
          await emitNotification({
            eventType: "INVOICE_OVERDUE",
            title: `Overdue Invoice ${inv.invoice_number}`,
            message: `Invoice for ${clientName} (${inv.total_amount} TND) was due on ${inv.due_date}.`,
            category: "billing",
            priority: "urgent",
            roleTarget: "super_admin",
            linkUrl: `/admin/finance`,
            entityType: "invoice",
            entityId: inv.id,
            contextTitle: clientName,
            sourceModule: "finance",
            metadata: { invoiceNumber: inv.invoice_number, clientName, amount: `${inv.total_amount} TND` },
            i18nKey: "notifications.events.invoice_overdue",
            i18nParams: { invoiceNumber: inv.invoice_number, clientName, amount: `${inv.total_amount} TND` },
          });
          recentKeys.add(key);
          emitted++;
        }
      }

      // --- C. PRODUCTION_TOMORROW ---
      const { data: bookings } = await (supabase as any)
        .from("production_bookings")
        .select("id, client:clients(name), date, time, location, production_type")
        .eq("date", tomorrowStr);

      for (const b of bookings || []) {
        const key = `PRODUCTION_TOMORROW_${b.id}`;
        if (!recentKeys.has(key)) {
          const clientName = b.client?.name || "Client";
          await emitNotification({
            eventType: "PRODUCTION_TOMORROW",
            title: `Production Shoot Tomorrow: ${clientName}`,
            message: `${b.production_type || "Production"} scheduled tomorrow at ${b.time || "scheduled time"} (${b.location || "On location"}).`,
            category: "production",
            priority: "high",
            roleTarget: "admin",
            linkUrl: `/admin/calendar`,
            entityType: "production_booking",
            entityId: b.id,
            contextTitle: clientName,
            sourceModule: "calendar",
            metadata: { clientName, location: b.location, time: b.time },
            i18nKey: "notifications.events.production_tomorrow",
            i18nParams: { clientName },
          });
          recentKeys.add(key);
          emitted++;
        }
      }

      // --- D. DELIVERABLE_BEHIND ---
      const { data: deliverables } = await (supabase as any)
        .from("client_deliverables")
        .select("id, title, deliverable_type, target_quantity, done_quantity, deadline, client:clients(name)")
        .not("status", "eq", "completed");

      for (const d of deliverables || []) {
        if (!d.deadline) continue;
        const dDate = parseISO(d.deadline);
        const remainingDays = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
        const target = Number(d.target_quantity || 0);
        const done = Number(d.done_quantity || 0);

        if (remainingDays <= 7 && remainingDays >= 0 && done < target * 0.5 && target > 0) {
          const key = `DELIVERABLE_BEHIND_${d.id}`;
          if (!recentKeys.has(key)) {
            const clientName = d.client?.name || "Client";
            const deliverableTitle = d.title || d.deliverable_type || "Deliverable";
            await emitNotification({
              eventType: "DELIVERABLE_BEHIND",
              title: `Deliverable Behind Pace: ${deliverableTitle}`,
              message: `${done}/${target} completed with only ${remainingDays} days remaining for ${clientName}.`,
              category: "production",
              priority: "high",
              roleTarget: "admin",
              linkUrl: `/admin/client-workspaces`,
              entityType: "client_deliverable",
              entityId: d.id,
              contextTitle: clientName,
              sourceModule: "clients",
              metadata: { clientName, deliverableName: deliverableTitle },
              i18nKey: "notifications.events.deliverable_behind",
              i18nParams: { clientName, deliverableName: deliverableTitle },
            });
            recentKeys.add(key);
            emitted++;
          }
        }
      }

      // --- E. MONTH_END_CLOSING ---
      const endOfMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const daysUntilMonthEnd = endOfMonthDate.getDate() - today.getDate();
      if (daysUntilMonthEnd <= 3) {
        const monthStr = format(today, "yyyy-MM");
        const key = `MONTH_END_CLOSING_${monthStr}`;
        if (!recentKeys.has(key)) {
          await emitNotification({
            eventType: "MONTH_END_CLOSING",
            title: `Month-End Financial Closing Due: ${format(today, "MMMM yyyy")}`,
            message: `The accounting period for ${format(today, "MMMM yyyy")} requires reconciliation and ledger closing.`,
            category: "finance",
            priority: "urgent",
            roleTarget: "super_admin",
            linkUrl: `/admin/finance`,
            entityType: "financial_closing_period",
            entityId: monthStr,
            contextTitle: "Ledger Reconciliation",
            sourceModule: "finance",
            metadata: { month: format(today, "MMMM yyyy") },
            i18nKey: "notifications.events.month_end_closing",
          });
          recentKeys.add(key);
          emitted++;
        }
      }

      return { scanned: (tasks?.length || 0) + (overdueInvoices?.length || 0), emitted };
    } catch (err) {
      console.error("[scanAndEmitAutomations] Error:", err);
      return { scanned: 0, emitted: 0 };
    } finally {
      lastScanTimestamp = Date.now();
      inFlightScan = null;
    }
  })();

  return inFlightScan;
}

// ============================================================
// 6. REALTIME NOTIFICATIONS SUBSCRIPTION MANAGER
// Multi-component ref-counted singleton channel lifecycle with
// STRICT RECIPIENT & FINANCE ISOLATION
// ============================================================

export type RealtimeNotificationEvent = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any>;
  old: Record<string, any>;
};

export type NotificationSubscriberCallback = (event: RealtimeNotificationEvent) => void;

export interface RealtimeSubscriptionOptions {
  role?: string;
  hasFinanceAccess?: boolean;
}

interface RegisteredSubscriber {
  callback: NotificationSubscriberCallback;
  options?: RealtimeSubscriptionOptions;
}

interface UserChannelSession {
  channel: RealtimeChannel | null;
  subscribers: Set<RegisteredSubscriber>;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  status: "idle" | "subscribing" | "subscribed" | "teardown_pending";
}

const activeChannelSessions = new Map<string, UserChannelSession>();

/**
 * Subscribes to realtime Postgres changes for the 'notifications' table.
 * Enforces recipient and finance isolation at the socket boundary:
 * - Worker A cannot receive Worker B notifications
 * - Workers cannot receive Admin-only broadcasts
 * - Unauthorized users cannot receive Finance broadcasts
 */
export function subscribeToRealtimeNotifications(
  userId: string | undefined | null,
  callback: NotificationSubscriberCallback,
  options?: RealtimeSubscriptionOptions
): () => void {
  if (!userId || typeof userId !== "string" || userId.trim() === "" || userId === "anon") {
    return () => {};
  }

  const cleanUserId = userId.trim();
  let session = activeChannelSessions.get(cleanUserId);

  if (!session) {
    session = {
      channel: null,
      subscribers: new Set(),
      teardownTimer: null,
      status: "idle",
    };
    activeChannelSessions.set(cleanUserId, session);
  }

  if (session.teardownTimer) {
    clearTimeout(session.teardownTimer);
    session.teardownTimer = null;
    session.status = session.channel ? "subscribed" : "idle";
  }

  const subscriberRecord: RegisteredSubscriber = { callback, options };
  session.subscribers.add(subscriberRecord);

  if (!session.channel) {
    session.status = "subscribing";
    const channelTopic = `notifications-${cleanUserId}`;

    const channel = supabase.channel(channelTopic);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
      },
      (payload: any) => {
        const currentSession = activeChannelSessions.get(cleanUserId);
        if (!currentSession) return;

        const row = payload.eventType === "DELETE" ? payload.old : payload.new;
        if (!row) return;

        const eventData: RealtimeNotificationEvent = {
          eventType: payload.eventType,
          new: payload.new || {},
          old: payload.old || {},
        };

        // Filter events strictly per subscriber permissions
        for (const sub of currentSession.subscribers) {
          try {
            const isVisible = isNotificationVisibleToUser(row, {
              userId: cleanUserId,
              role: sub.options?.role,
              hasFinanceAccess: sub.options?.hasFinanceAccess,
            });

            // If DELETE, allow through if previously tracked or authorized
            if (isVisible || payload.eventType === "DELETE") {
              sub.callback(eventData);
            }
          } catch (err) {
            console.error("[subscribeToRealtimeNotifications] Subscriber handler error:", err);
          }
        }
      }
    );

    channel.subscribe((status, err) => {
      if (err) {
        console.warn(`[subscribeToRealtimeNotifications] Channel subscription warning for ${channelTopic}:`, err);
      }
      const cur = activeChannelSessions.get(cleanUserId);
      if (cur && status === "SUBSCRIBED") {
        cur.status = "subscribed";
      }
    });

    session.channel = channel;
  }

  return () => {
    const currentSession = activeChannelSessions.get(cleanUserId);
    if (!currentSession) return;

    currentSession.subscribers.delete(subscriberRecord);

    if (currentSession.subscribers.size === 0) {
      if (currentSession.teardownTimer) {
        clearTimeout(currentSession.teardownTimer);
      }
      currentSession.status = "teardown_pending";

      currentSession.teardownTimer = setTimeout(() => {
        const finalSession = activeChannelSessions.get(cleanUserId);
        if (finalSession && finalSession.subscribers.size === 0) {
          if (finalSession.channel) {
            const ch = finalSession.channel;
            finalSession.channel = null;
            try {
              supabase.removeChannel(ch);
            } catch (removeErr) {
              console.warn("[subscribeToRealtimeNotifications] Error removing channel:", removeErr);
            }
          }
          activeChannelSessions.delete(cleanUserId);
        }
      }, 150);
    }
  };
}

export function getActiveNotificationRealtimeSession(userId: string): {
  subscriberCount: number;
  hasChannel: boolean;
  status: string;
} | null {
  const session = activeChannelSessions.get(userId.trim());
  if (!session) return null;
  return {
    subscriberCount: session.subscribers.size,
    hasChannel: !!session.channel,
    status: session.status,
  };
}

/**
 * Token interpolation helper for parameterized notifications
 */
/**
 * Token interpolation helper for parameterized notifications.
 * Strictly cleans up unreplaced tokens so raw {token} never renders in UI.
 */
export function interpolateTokens(template: string, params: Record<string, any>): string {
  if (!template) return "";
  return template
    .replace(/\{(\w+)\}/g, (match, key) => {
      if (params[key] !== undefined && params[key] !== null && String(params[key]).trim() !== "") {
        return String(params[key]);
      }
      return "";
    })
    .trim();
}

/**
 * Resolves a notification item into localized title, message, priority, and category labels.
 * Supports structured i18n_key with token interpolation, event_type fallback, and raw strings.
 * Guarantees zero raw {token} leaks and preserves custom manager/user-directed messages.
 */
export function resolveNotification(
  item: NotificationItem,
  t: (key: string, fallbackOrParams?: any, maybeParams?: any) => string
): {
  title: string;
  message: string;
  priorityLabel: string;
  categoryLabel: string;
} {
  const mergedParams: Record<string, any> = {
    message: item.message || "",
    customMessage: item.metadata?.customMessage || item.message || "",
    taskTitle: item.metadata?.taskTitle || item.metadata?.taskName || item.title || "",
    taskName: item.metadata?.taskName || item.metadata?.taskTitle || item.title || "",
    clientName: item.context_title || item.metadata?.clientName || "",
    senderName: item.metadata?.senderName || "Manager",
    deadline: item.metadata?.deadline || "",
    ...(item.metadata || {}),
    ...(item.i18n_params || {}),
  };

  if (!mergedParams.message && item.message) {
    mergedParams.message = item.message;
  }

  // Category label
  const catKey = `notifications.categories.${item.category}`;
  let catTrans = t(catKey);
  if (!catTrans || catTrans === catKey) {
    const categoryDefaults: Record<string, string> = {
      task: "Tasks & Milestones",
      production: "Operations & Shoots",
      billing: "Invoices & Billing",
      finance: "Finance & Accounts",
      security: "Security & Audits",
      messages: "Direct Messages",
      system: "System & Platform",
    };
    catTrans = categoryDefaults[item.category] || item.category;
  }
  const categoryLabel = catTrans;

  // Priority label
  const prioKey = `notifications.priorities.${item.priority}`;
  let prioTrans = t(prioKey);
  if (!prioTrans || prioTrans === prioKey) {
    const priorityDefaults: Record<string, string> = {
      urgent: "Urgent",
      high: "High Priority",
      normal: "Normal",
      low: "Low",
    };
    prioTrans = priorityDefaults[item.priority] || item.priority.toUpperCase();
  }
  const priorityLabel = prioTrans;

  // Direct User-Directed Alerts (TASK_ALERT / MANAGER_MESSAGE)
  if (item.event_type === "TASK_ALERT" || item.event_type === "MANAGER_MESSAGE") {
    const sender = mergedParams.senderName || item.metadata?.senderName || "Manager";
    const customMsg = mergedParams.customMessage || item.message || mergedParams.message || "";
    const eventKeyLower = `notifications.events.${item.event_type.toLowerCase()}`;
    const transTitle = t(`${eventKeyLower}.title`, { ...mergedParams, senderName: sender });
    const title =
      transTitle && transTitle !== `${eventKeyLower}.title`
        ? interpolateTokens(transTitle, { ...mergedParams, senderName: sender })
        : item.title || `Message from ${sender}`;

    const cleanMsg = interpolateTokens(customMsg, mergedParams) || customMsg;
    return {
      title: title || `Message from ${sender}`,
      message: cleanMsg,
      priorityLabel,
      categoryLabel,
    };
  }

  // 1. Explicit i18n_key if present
  if (item.i18n_key) {
    const customTitle = t(`${item.i18n_key}.title`, mergedParams);
    const customMsg = t(`${item.i18n_key}.message`, mergedParams);
    if (customTitle && customTitle !== `${item.i18n_key}.title`) {
      const resolvedTitle = interpolateTokens(customTitle, mergedParams);
      let resolvedMsg =
        customMsg && customMsg !== `${item.i18n_key}.message`
          ? interpolateTokens(customMsg, mergedParams)
          : interpolateTokens(item.message, mergedParams);

      if (!resolvedMsg || resolvedMsg === "{message}") {
        resolvedMsg = item.message || "";
      }

      return {
        title: resolvedTitle || item.title,
        message: resolvedMsg || item.message,
        priorityLabel,
        categoryLabel,
      };
    }
  }

  // 2. Lookup by event_type (support lowercase key)
  if (item.event_type) {
    const eventKeyLower = `notifications.events.${item.event_type.toLowerCase()}`;
    const transTitle = t(`${eventKeyLower}.title`, mergedParams);
    const transMsg = t(`${eventKeyLower}.message`, mergedParams);

    if (transTitle && transTitle !== `${eventKeyLower}.title`) {
      let finalTitle = interpolateTokens(transTitle, mergedParams);
      // Guard: do not override a specific contextual title with generic "System Notification"
      const isGenericDefault =
        finalTitle.toLowerCase() === "system notification" ||
        finalTitle === "إشعار نظام";
      const hasSpecificTitle =
        item.title &&
        item.title.toLowerCase() !== "system notification" &&
        item.title !== "إشعار نظام" &&
        item.title !== "general";

      if (isGenericDefault && hasSpecificTitle) {
        finalTitle = item.title;
      }

      let finalMsg =
        transMsg && transMsg !== `${eventKeyLower}.message` && transMsg !== "{message}"
          ? interpolateTokens(transMsg, mergedParams)
          : interpolateTokens(item.message, mergedParams);

      if (!finalMsg || finalMsg === "{message}") {
        finalMsg = item.message || "";
      }

      return {
        title: finalTitle || item.title,
        message: finalMsg || item.message,
        priorityLabel,
        categoryLabel,
      };
    }
  }

  return {
    title: interpolateTokens(item.title, mergedParams) || item.title,
    message: interpolateTokens(item.message, mergedParams) || item.message,
    priorityLabel,
    categoryLabel,
  };
}

// In-flight deduplication cache for user alerts
const alertInFlightMap = new Map<string, number>();

export interface SendTaskAlertParams {
  taskId: string;
  senderId: string;
  recipientId: string;
  priority?: NotificationPriority;
  message: string;
  actorRole?: string | null;
  senderRole?: string | null;
  senderName?: string;
  taskTitle?: string;
  clientName?: string;
  idempotencyKey?: string;
}

/**
 * Dispatches an operational user-directed task alert from manager/sender to assigned recipient.
 * Validates authorization, recipient, task existence, logs activity, and emits realtime notification.
 */
export async function sendTaskAlert(
  params: SendTaskAlertParams
): Promise<{ success: boolean; id?: string; error?: string; deduplicated?: boolean }> {
  try {
    const { taskId, senderId, recipientId, priority = "high", message, actorRole, senderRole } = params;

    if (!taskId || !senderId || !recipientId) {
      return { success: false, error: "Missing required fields: taskId, senderId, or recipientId." };
    }
    const trimmedMessage = (message || "").trim();
    if (!trimmedMessage) {
      return { success: false, error: "Alert message cannot be empty." };
    }

    // 1. Authorization check
    // Super Admin and Admin have root dispatch permission.
    // Workers must be assigned to the task, reviewer, or task delegator.
    const effectiveRole = actorRole || senderRole || "worker";
    if (effectiveRole !== "super_admin" && effectiveRole !== "admin") {
      const { data: taskRecord } = await (supabase as any)
        .from("project_tasks")
        .select("id, assignee_id, reviewer_id, assigned_by_id")
        .eq("id", taskId)
        .maybeSingle();

      if (!taskRecord) {
        return { success: false, error: "UNAUTHORIZED_SENDER" };
      }

      const isAssociated =
        taskRecord.assignee_id === senderId ||
        taskRecord.reviewer_id === senderId ||
        taskRecord.assigned_by_id === senderId;

      if (!isAssociated) {
        return {
          success: false,
          error: "UNAUTHORIZED_SENDER",
        };
      }
    }

    // 2. Fetch Task context if not passed
    let taskTitle = params.taskTitle;
    let clientName = params.clientName;
    if (!taskTitle || !clientName) {
      const { data: taskData } = await (supabase as any)
        .from("project_tasks")
        .select("id, title, client_id, client:clients(name)")
        .eq("id", taskId)
        .maybeSingle();
      if (taskData) {
        taskTitle = taskTitle || taskData.title;
        clientName = clientName || taskData.client?.name || "Client";
      }
    }

    // 3. Resolve Sender Name
    let senderName = "Management";
    const { data: senderProfile } = await (supabase as any)
      .from("profiles")
      .select("display_name")
      .eq("id", senderId)
      .maybeSingle();
    if (senderProfile?.display_name) {
      senderName = senderProfile.display_name;
    } else {
      const { data: senderMember } = await (supabase as any)
        .from("team_members")
        .select("display_name, name")
        .or(`id.eq.${senderId},profile_id.eq.${senderId}`)
        .maybeSingle();
      if (senderMember) {
        senderName = senderMember.display_name || senderMember.name || "Management";
      }
    }

    // 4. Resolve Target Recipient User ID (Auth UUID)
    let targetUserId = recipientId;
    const { data: memberRecord } = await (supabase as any)
      .from("team_members")
      .select("id, profile_id")
      .eq("id", recipientId)
      .maybeSingle();
    if (memberRecord?.profile_id) {
      targetUserId = memberRecord.profile_id;
    }

    // 5. Idempotency Guard (prevent double-clicks / rapid retries within 5 seconds)
    const dedupSignature = `${taskId}_${senderId}_${targetUserId}_${trimmedMessage.slice(0, 40)}`;
    const now = Date.now();
    const lastEmitted = alertInFlightMap.get(dedupSignature);
    if (lastEmitted && now - lastEmitted < 5000) {
      return { success: true, deduplicated: true };
    }
    alertInFlightMap.set(dedupSignature, now);

    // 6. Emit Notification
    const emitRes = await emitNotification({
      eventType: "TASK_ALERT",
      title: `Message from ${senderName}`,
      message: trimmedMessage,
      category: "task",
      priority,
      roleTarget: "worker",
      userId: targetUserId,
      linkUrl: `/admin/my-work?task=${taskId}`,
      entityType: "task",
      entityId: taskId,
      contextTitle: clientName ? `${taskTitle || "Task"} • ${clientName}` : taskTitle || "Task",
      sourceModule: "tasks",
      metadata: {
        taskId,
        taskTitle,
        clientName,
        senderId,
        senderName,
        customMessage: trimmedMessage,
      },
      i18nKey: "notifications.events.task_alert",
      i18nParams: {
        senderName,
        taskTitle,
        taskName: taskTitle,
        clientName,
        message: trimmedMessage,
      },
    });

    if (!emitRes.success && !emitRes.deduplicated) {
      return { success: false, error: "Failed to dispatch notification." };
    }

    // 7. Audit Logging in project_activity
    try {
      await (supabase as any).from("project_activity").insert({
        task_id: taskId,
        actor_id: senderId,
        action: "task_alert_sent",
        details: {
          recipient_id: targetUserId,
          sender_name: senderName,
          priority,
          message: trimmedMessage,
        },
      });
    } catch (auditErr) {
      console.warn("[sendTaskAlert] Activity logging notice:", auditErr);
    }

    return { success: true, id: emitRes.id, deduplicated: emitRes.deduplicated };
  } catch (err: any) {
    console.error("[sendTaskAlert] Error:", err);
    return { success: false, error: err.message || "Failed to send task alert" };
  }
}



// ============================================================
// SADA OS — CANONICAL NOTIFICATION CONTEXT & ALERT LAYER
// Phase 4: Centralized Realtime Alert State & Arrival Lifecycle
// Coordinates In-App indicators, Favicon badge, Browser Push,
// Soundless attention ring, and single socket subscription.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type {
  NotificationItem,
  NotificationCategory,
  NotificationPriority,
} from "@/types/notifications-and-audit";
import {
  fetchNotifications,
  markNotificationAsRead as apiMarkRead,
  markAllNotificationsAsRead as apiMarkAllRead,
  deleteNotification as apiDeleteNotification,
  subscribeToRealtimeNotifications,
  scanAndEmitAutomations,
  sortNotificationsByPriorityAndRecency,
  isNotificationVisibleToUser,
  fetchNotificationPreferences,
  getSemanticSeverity,
} from "@/lib/notification-service";
import { syncBrowserTabBadge } from "@/lib/browser-notification-badge";
import { showNativeBrowserNotification } from "@/lib/browser-push-service";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { NotificationToastCard } from "@/components/admin/NotificationToastCard";

interface NotificationContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  hasUrgent: boolean;
  hasHighPriority: boolean;
  isNewArrival: boolean;
  latestArrival: NotificationItem | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteItem: (id: string) => Promise<boolean>;
  isPreferencesOpen: boolean;
  setIsPreferencesOpen: (open: boolean) => void;
  isMobileDrawerOpen: boolean;
  setIsMobileDrawerOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const effectiveUserId = auth.user?.id;
  const effectiveRole = auth.role || "worker";
  const hasFinanceAccess = auth.canAccessModule
    ? auth.canAccessModule("finance")
    : effectiveRole === "super_admin";

  let nav: any;
  try {
    nav = useNavigate();
  } catch (_) {}

  const [cachedPrefs, setCachedPrefs] = useState<{ desktop_push_enabled?: boolean } | null>(null);

  // Fetch cached preferences once for desktop notification gating
  useEffect(() => {
    if (effectiveUserId) {
      fetchNotificationPreferences(effectiveUserId)
        .then((p) => setCachedPrefs(p))
        .catch(() => {});
    }
  }, [effectiveUserId]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arrival animation state (lasts 3.5s then resets cleanly)
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [latestArrival, setLatestArrival] = useState<NotificationItem | null>(null);
  const arrivalTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Priority flags
  const hasUrgent = useMemo(() => {
    return notifications.some((n) => !n.read && n.priority === "urgent");
  }, [notifications]);

  const hasHighPriority = useMemo(() => {
    return notifications.some((n) => !n.read && (n.priority === "high" || n.priority === "urgent"));
  }, [notifications]);

  // Sync favicon badge whenever unreadCount updates
  useEffect(() => {
    syncBrowserTabBadge(unreadCount);
  }, [unreadCount]);

  // Clean arrival pulse after duration
  const triggerArrivalAnimation = useCallback((item: NotificationItem) => {
    setIsNewArrival(true);
    setLatestArrival(item);

    if (arrivalTimerRef.current) {
      clearTimeout(arrivalTimerRef.current);
    }

    arrivalTimerRef.current = setTimeout(() => {
      setIsNewArrival(false);
    }, 3800);
  }, []);

  useEffect(() => {
    return () => {
      if (arrivalTimerRef.current) {
        clearTimeout(arrivalTimerRef.current);
      }
    };
  }, []);

  // Visual QA & test harness trigger hook
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__triggerNotificationToast = (customItem: Partial<NotificationItem>) => {
        const item: NotificationItem = {
          id: customItem.id || "test-" + Math.random().toString(36).substring(2, 9),
          role_target: customItem.role_target || "all",
          event_type: customItem.event_type || "GENERAL",
          title: customItem.title || "Notification Title",
          message: customItem.message || "",
          category: customItem.category || "system",
          priority: customItem.priority || "normal",
          link_url: customItem.link_url,
          entity_type: customItem.entity_type,
          entity_id: customItem.entity_id,
          context_title: customItem.context_title,
          metadata: customItem.metadata,
          created_at: customItem.created_at || new Date().toISOString(),
          read: false,
        };
        toast.custom(
          (id) => (
            <NotificationToastCard
              item={item}
              toastId={id}
              onNavigate={(url) => {
                if (nav) nav({ to: url as any });
                else window.location.href = url;
              }}
            />
          ),
          { duration: 15000 }
        );
      };
    }
  }, [nav]);

  // Fetch notifications
  const loadNotifications = useCallback(
    async (showLoading = false) => {
      if (!effectiveUserId) return;
      if (showLoading) setLoading(true);
      setError(null);

      try {
        const res = await fetchNotifications({
          userId: effectiveUserId,
          role: effectiveRole,
          hasFinanceAccess,
          limit: 100,
        });

        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      } catch (err: any) {
        console.error("[NotificationProvider] Fetch error:", err);
        setError(err?.message || "Failed to load notifications");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [effectiveUserId, effectiveRole, hasFinanceAccess]
  );

  // Initial load + background automations scan + single realtime channel
  useEffect(() => {
    if (!effectiveUserId) return;

    loadNotifications(true);

    // Initial background automation scan
    scanAndEmitAutomations()
      .then((res) => {
        if (res && res.emitted > 0) {
          loadNotifications(false);
        }
      })
      .catch((e) => console.warn("[NotificationProvider] Automations scan notice:", e));

    // Fallback sync every 60s
    const intervalTimer = setInterval(() => {
      loadNotifications(false);
    }, 60000);

    // CANONICAL REALTIME CHANNEL SUBSCRIPTION
    const unsubscribe = subscribeToRealtimeNotifications(
      effectiveUserId,
      (event) => {
        const row = event.new && Object.keys(event.new).length > 0 ? event.new : event.old;
        if (!row) return;

        if (event.eventType === "INSERT") {
          const newItem: NotificationItem = {
            id: event.new.id,
            user_id: event.new.user_id,
            role_target: event.new.role_target || "all",
            event_type: event.new.event_type,
            title: event.new.title,
            message: event.new.message,
            category: event.new.category || "system",
            priority: (event.new.priority as NotificationPriority) || "normal",
            link_url: event.new.link_url,
            entity_type: event.new.entity_type,
            entity_id: event.new.entity_id,
            context_title: event.new.context_title,
            source_module: event.new.source_module,
            metadata: event.new.metadata || {},
            i18n_key: event.new.i18n_key,
            i18n_params: event.new.i18n_params || {},
            read: Boolean(event.new.read),
            read_at: event.new.read_at,
            created_at: event.new.created_at || new Date().toISOString(),
          };

          // Authoritative Security isolation check
          const isVisible = isNotificationVisibleToUser(newItem, {
            userId: effectiveUserId,
            role: effectiveRole,
            hasFinanceAccess,
          });

          if (!isVisible) return;

          setNotifications((prev) => {
            const next = [newItem, ...prev.filter((x) => x.id !== newItem.id)];
            return sortNotificationsByPriorityAndRecency(next);
          });

          if (!newItem.read) {
            setUnreadCount((c) => c + 1);
          }

          // Trigger subtle arrival animation and badge ring
          triggerArrivalAnimation(newItem);

          // Native desktop notification if permitted & enabled
          showNativeBrowserNotification(newItem, {
            desktopPushEnabled: cachedPrefs?.desktop_push_enabled,
            onClick: () => {
              if (newItem.link_url) {
                if (nav) {
                  nav({ to: newItem.link_url as any });
                } else {
                  window.location.href = newItem.link_url;
                }
              }
            },
          });

          // Elegant compact in-app toast preview using SADA Premium Notification Card
          toast.custom(
            (id) => (
              <NotificationToastCard
                item={newItem}
                toastId={id}
                onNavigate={(url) => {
                  if (nav) {
                    nav({ to: url as any });
                  } else {
                    window.location.href = url;
                  }
                }}
              />
            ),
            { duration: 5000 }
          );
        } else if (event.eventType === "UPDATE") {
          const updatedRow = event.new;
          setNotifications((prev) => {
            const next = prev.map((item) =>
              item.id === updatedRow.id
                ? {
                    ...item,
                    read: Boolean(updatedRow.read),
                    read_at: updatedRow.read_at,
                    priority: updatedRow.priority || item.priority,
                    title: updatedRow.title || item.title,
                    message: updatedRow.message || item.message,
                  }
                : item
            );
            return sortNotificationsByPriorityAndRecency(next);
          });
          // Recalculate unread count
          setUnreadCount((prev) => {
            return event.new.read ? Math.max(0, prev - 1) : prev;
          });
        } else if (event.eventType === "DELETE") {
          const deletedId = event.old.id;
          setNotifications((prev) => {
            const removed = prev.find((x) => x.id === deletedId);
            if (removed && !removed.read) {
              setUnreadCount((c) => Math.max(0, c - 1));
            }
            return prev.filter((x) => x.id !== deletedId);
          });
        }
      },
      { role: effectiveRole, hasFinanceAccess }
    );

    return () => {
      clearInterval(intervalTimer);
      unsubscribe();
    };
  }, [effectiveUserId, effectiveRole, hasFinanceAccess, loadNotifications, triggerArrivalAnimation]);

  // Mark single as read
  const markAsRead = useCallback(
    async (id: string): Promise<boolean> => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      const ok = await apiMarkRead(id);
      if (!ok) {
        // Rollback on failure
        loadNotifications(false);
      }
      return ok;
    },
    [loadNotifications]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    const ok = await apiMarkAllRead(effectiveUserId);
    if (!ok) {
      loadNotifications(false);
    }
    return ok;
  }, [effectiveUserId, loadNotifications]);

  // Delete notification
  const deleteItem = useCallback(
    async (id: string): Promise<boolean> => {
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }

      const ok = await apiDeleteNotification(id);
      if (!ok) {
        loadNotifications(false);
      }
      return ok;
    },
    [notifications, loadNotifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      hasUrgent,
      hasHighPriority,
      isNewArrival,
      latestArrival,
      loading,
      error,
      refresh: () => loadNotifications(false),
      markAsRead,
      markAllAsRead,
      deleteItem,
      isPreferencesOpen,
      setIsPreferencesOpen,
      isMobileDrawerOpen,
      setIsMobileDrawerOpen,
    }),
    [
      notifications,
      unreadCount,
      hasUrgent,
      hasHighPriority,
      isNewArrival,
      latestArrival,
      loading,
      error,
      loadNotifications,
      markAsRead,
      markAllAsRead,
      deleteItem,
      isPreferencesOpen,
      isMobileDrawerOpen,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Accessible screen-reader live region for incoming alerts */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {latestArrival ? `${latestArrival.title}: ${latestArrival.message}` : ""}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}

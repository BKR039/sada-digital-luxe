// ============================================================
// SADA OS — BROWSER NATIVE & MOBILE WEB PUSH SERVICE
// Phase 6 & Phase 7: Web Notifications & Multi-Device Push Infrastructure
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type { NotificationItem, PushSubscriptionRecord } from "@/types/notifications-and-audit";
import { isWebPushSupported, registerServiceWorker } from "@/lib/pwa-service";

export type { PushSubscriptionRecord };

const LOCAL_STORAGE_PUSH_KEY = "sada_push_subscription_v2";

/**
 * Returns current browser notification permission status.
 */
export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Explicitly requests Web Notification permission from user.
 * Must only be called in response to user interaction (e.g. clicking 'Enable').
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn("[requestBrowserNotificationPermission] Error:", err);
    return Notification.permission;
  }
}

/**
 * Triggers a native desktop/browser notification if permission is granted.
 */
export function showNativeBrowserNotification(
  item: NotificationItem,
  options?: { onClick?: () => void; fallbackToCurrentTab?: boolean; desktopPushEnabled?: boolean }
): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  // If user disabled desktop notifications in preferences, respect choice unless mandatory security event
  const isSecurity = item.category === "security" || item.event_type === "SECURITY_AUDIT";
  if (options?.desktopPushEnabled === false && !isSecurity) {
    return false;
  }

  try {
    const iconUrl = "/icons/icon-192x192.svg";
    const badgeUrl = "/favicon.svg";

    const clientName = item.metadata?.clientName || item.metadata?.client_name;
    const contextTitle = item.context_title || item.metadata?.taskTitle || item.metadata?.taskName;

    let displayTitle = item.title || "SADA OS Alert";
    if (clientName && contextTitle) {
      displayTitle = `${clientName} · ${contextTitle}`;
    } else if (clientName) {
      displayTitle = `${clientName} — ${item.title || "Alert"}`;
    } else if (contextTitle) {
      displayTitle = `${contextTitle} — ${item.title || "Alert"}`;
    }

    const notifOptions: any = {
      body: item.message || "New activity requires your attention.",
      icon: iconUrl,
      badge: badgeUrl,
      tag: `sada-notif-${item.id || Date.now()}`,
      renotify: true,
      data: {
        linkUrl: item.link_url || "/admin/my-work",
        notificationId: item.id,
      },
    };

    const nativeNotif = new Notification(displayTitle, notifOptions);

    nativeNotif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      nativeNotif.close();

      if (options?.onClick) {
        options.onClick();
      } else if (item.link_url) {
        window.location.href = item.link_url;
      }
    };

    return true;
  } catch (err) {
    console.warn("[showNativeBrowserNotification] Could not display notification:", err);
    return false;
  }
}

/**
 * Detects current device classification.
 */
export function detectDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(ua)) {
    return "tablet";
  }
  if (/(mobi|ipod|phone|blackberry|opera mini)/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Subscribes the current device to Web Push and registers in `public.push_subscriptions`.
 */
export async function registerPushDeviceSubscription(
  userId: string
): Promise<{ success: boolean; subscription?: PushSubscriptionRecord; error?: string }> {
  if (!userId) {
    return { success: false, error: "Authenticated user ID is required." };
  }

  if (!isWebPushSupported()) {
    return { success: false, error: "Web Push is not supported by this browser." };
  }

  try {
    const vapidPublicKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return { success: false, error: "Web Push is not configured yet. Contact your SADA administrator." };
    }

    // 1. Ensure Service Worker is registered
    const reg = await registerServiceWorker();
    const swReg = reg || (await navigator.serviceWorker.ready);

    if (!swReg || !swReg.pushManager) {
      return { success: false, error: "Service Worker PushManager is unavailable." };
    }

    // 2. Request / verify permission
    const currentPermission = Notification.permission;
    if (currentPermission !== "granted") {
      const requested = await Notification.requestPermission();
      if (requested !== "granted") {
        return { success: false, error: "Push notification permission was denied." };
      }
    }

    // 3. Obtain or create PushSubscription
    let sub = await swReg.pushManager.getSubscription();
    const expectedApplicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    const currentApplicationServerKey = sub?.options.applicationServerKey;
    const matchesVapidKey = currentApplicationServerKey &&
      bytesEqual(new Uint8Array(currentApplicationServerKey), expectedApplicationServerKey);
    if (sub && !matchesVapidKey) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) {
      const subOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
      };
      subOptions.applicationServerKey = expectedApplicationServerKey as any;

      sub = await swReg.pushManager.subscribe(subOptions);
    }

    if (!sub) {
      return { success: false, error: "Failed to generate push subscription token." };
    }

    // 4. Extract keys
    const rawKeys = sub.toJSON().keys || {};
    const p256dh = rawKeys.p256dh || "";
    const auth = rawKeys.auth || "";
    const deviceType = detectDeviceType();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

    const record: PushSubscriptionRecord = {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      device_type: deviceType,
      user_agent: userAgent,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    };

    // 5. Persist to database. Without this row the server cannot deliver background push.
    const { error: dbErr } = await (supabase as any)
      .from("push_subscriptions")
      .upsert(record, { onConflict: "user_id,endpoint" });

    if (dbErr) {
      console.error("[registerPushDeviceSubscription] DB persistence failed:", dbErr.message);
      return { success: false, error: "Your device subscription could not be saved. Please try again." };
    }

    // 6. Cache in localStorage for offline/client awareness
    try {
      localStorage.setItem(LOCAL_STORAGE_PUSH_KEY, JSON.stringify(record));
    } catch (_) {}

    return { success: true, subscription: record };
  } catch (err: any) {
    console.error("[registerPushDeviceSubscription] Error:", err);
    return { success: false, error: err?.message || "Failed to subscribe to Push" };
  }
}

/**
 * Unsubscribes current device from Web Push and marks inactive in DB.
 */
export async function unregisterPushDeviceSubscription(userId: string): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return true;
  }

  try {
    const swReg = await navigator.serviceWorker.ready;
    if (swReg && swReg.pushManager) {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        if (userId && endpoint) {
          try {
            await (supabase as any)
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("user_id", userId)
              .eq("endpoint", endpoint);
          } catch (_) {}
        }
      }
    }

    localStorage.removeItem(LOCAL_STORAGE_PUSH_KEY);
    return true;
  } catch (err) {
    console.warn("[unregisterPushDeviceSubscription] Error:", err);
    return false;
  }
}

/**
 * Fetches all registered active push subscriptions for a user.
 */
export async function fetchActiveUserSubscriptions(
  userId: string
): Promise<PushSubscriptionRecord[]> {
  if (!userId) return [];
  try {
    const { data, error } = await (supabase as any)
      .from("push_subscriptions")
      .select("id, user_id, endpoint, device_type, user_agent, is_active, last_seen_at, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[fetchActiveUserSubscriptions] DB query notice:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("[fetchActiveUserSubscriptions] Error:", err);
    return [];
  }
}

/**
 * Removes or deactivates a specific push subscription by ID.
 */
export async function removeDeviceSubscription(subscriptionId: string): Promise<boolean> {
  if (!subscriptionId) return false;
  try {
    const { error } = await (supabase as any)
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("id", subscriptionId);

    return !error;
  } catch (err) {
    console.error("[removeDeviceSubscription] Error:", err);
    return false;
  }
}

/**
 * Sends a controlled test notification to the authenticated user to verify device push delivery.
 */
export async function sendTestPushNotification(
  userId: string,
  lang: "en" | "ar" = "en"
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "User ID required" };

  try {
    const { emitNotification } = await import("./notification-service");
    const isAr = lang === "ar";
    const res = await emitNotification({
      eventType: "GENERAL",
      userId,
      title: isAr ? "إشعار تجريبي • SADA OS" : "Test Notification • SADA OS",
      message: isAr
        ? "تم تأكيد وصول الإشعارات إلى جهازك بنجاح. أنت الآن متصل بـ SADA OS!"
        : "Push notifications are working on this device. You're connected to SADA OS!",
      category: "system",
      priority: "high",
      linkUrl: "/admin/my-work",
    });

    return { success: res.success, error: res.success ? undefined : "Failed to emit notification" };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send test push" };
  }
}

/**
 * Helper to convert Base64 URL to Uint8Array for VAPID applicationServerKey
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

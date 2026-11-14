// ============================================================
// SADA OS — SERVER-SIDE WEB PUSH DISPATCHER (PUSH 3.0)
// VAPID Delivery, Recipient Isolation, Per-Device Tracking,
// Multi-Device Idempotency, Retry Handling & Automatic Eviction.
// ============================================================

import * as webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
}

export interface DeviceDeliveryAttempt {
  subscriptionId: string;
  deviceType: string;
  endpointPrefix: string;
  status: "pending" | "processing" | "delivered" | "failed" | "expired";
  statusCode?: number;
  attemptCount: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  deliveredAt?: string;
  errorMessage?: string;
}

export interface PushDeliveryTracking {
  deliveryStatus: "pending" | "processing" | "delivered" | "partially_delivered" | "failed" | "no_active_devices";
  totalDevices: number;
  deliveredCount: number;
  failedCount: number;
  expiredCount: number;
  devices: Record<string, DeviceDeliveryAttempt>;
  lastEvaluatedAt: string;
}

export interface DispatchPushResult {
  success: boolean;
  notificationId: string;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  deactivatedCount: number;
  duplicate?: boolean;
  deliveryStatus?: PushDeliveryTracking["deliveryStatus"];
  deviceDetails?: DeviceDeliveryAttempt[];
  error?: string;
}

export interface DispatchPushOptions {
  client?: SupabaseClient;
  callerId?: string;
  authHeader?: string;
  forceRetry?: boolean;
}

let vapidConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@sada.agency";

  if (!publicKey || !privateKey) {
    console.warn("[PushDispatcher] VAPID keys not configured in environment.");
    return false;
  }

  const wp = (webpush as any).default || webpush;
  wp.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Creates an admin or service-role Supabase client for backend operations.
 */
async function getBackendClient(clientOverride?: SupabaseClient, authHeader?: string): Promise<SupabaseClient> {
  if (clientOverride) return clientOverride;

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error("[PushDispatcher] Missing Supabase URL in server environment.");
  }

  // 1. Service role if configured
  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // 2. Caller provided authHeader (forward only if it's a valid 3-part Supabase user JWT)
  if (authHeader && anonKey) {
    const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (rawToken && rawToken.split(".").length === 3) {
      return createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    }
  }

  // 3. Fallback: Authenticate with server-configured admin credentials if provided (zero plaintext in source)
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL;
  const adminPass = process.env.SYSTEM_ADMIN_PASSWORD;

  if (adminEmail && adminPass && anonKey) {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPass,
      });

      if (!authErr && authData.session?.access_token) {
        return createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
        });
      }
    } catch (_) {}
  }

  return createClient(supabaseUrl, anonKey || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Dispatches Web Push for a given notification ID.
 * Tracks delivery per device, handles partial failures, avoids premature sent marking,
 * and maintains idempotency across multiple devices.
 */
export async function dispatchPushNotification(
  notificationId: string,
  options?: DispatchPushOptions
): Promise<DispatchPushResult> {
  const result: DispatchPushResult = {
    success: false,
    notificationId,
    recipientsCount: 0,
    sentCount: 0,
    failedCount: 0,
    deactivatedCount: 0,
  };

  if (!notificationId) {
    result.error = "notificationId is required";
    return result;
  }

  const supabase = await getBackendClient(options?.client, options?.authHeader);

  try {
    // 1. Fetch the canonical notification
    const { data: notification, error: notifErr } = await (supabase as any)
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .maybeSingle();

    if (notifErr || !notification) {
      result.error = notifErr?.message || "Notification not found";
      return result;
    }

    // 2. Per-Device Idempotency & Delivery State Evaluation
    const existingTracking: PushDeliveryTracking | null =
      notification.metadata?.push_delivery_tracking || null;

    // If already fully delivered to all devices and not force-retrying, skip
    if (
      existingTracking?.deliveryStatus === "delivered" &&
      !options?.forceRetry
    ) {
      result.success = true;
      result.duplicate = true;
      result.deliveryStatus = "delivered";
      result.deviceDetails = Object.values(existingTracking.devices || {});
      return result;
    }

    // 3. Resolve recipient user IDs with strict role & module isolation
    let recipientIds: string[] = [];

    if (notification.user_id) {
      recipientIds = [notification.user_id];
    } else {
      // Broadcast notification
      const roleTarget = notification.role_target || "all";
      const category = notification.category || "system";

      // Security boundaries
      if (category === "security") {
        const { data: sas } = await (supabase as any)
          .from("profiles")
          .select("id")
          .eq("role", "super_admin");
        recipientIds = (sas || []).map((p: any) => p.id).filter(Boolean);
      } else if (category === "finance" || category === "billing") {
        // Finance events: only super_admin or admins with finance module permission
        const { data: adminProfiles } = await (supabase as any)
          .from("profiles")
          .select("id, role, permissions")
          .in("role", ["super_admin", "admin"]);
        recipientIds = (adminProfiles || [])
          .filter((p: any) => {
            if (p.role === "super_admin") return true;
            const perms = p.permissions || {};
            return perms.finance === true || perms.all === true;
          })
          .map((p: any) => p.id);
      } else {
        // General / Operations / Task broadcasts
        let roleQuery = ["super_admin", "admin", "worker"];
        if (roleTarget === "super_admin") roleQuery = ["super_admin"];
        else if (roleTarget === "admin") roleQuery = ["super_admin", "admin"];
        else if (roleTarget === "worker") roleQuery = ["worker"];

        const { data: targetProfiles } = await (supabase as any)
          .from("profiles")
          .select("id")
          .in("role", roleQuery);
        recipientIds = (targetProfiles || []).map((p: any) => p.id).filter(Boolean);
      }
    }

    // Avoid notifying the initiating actor of their own broadcast action
    if (options?.callerId && recipientIds.length > 1) {
      recipientIds = recipientIds.filter((id) => id !== options.callerId);
    }

    result.recipientsCount = recipientIds.length;
    if (recipientIds.length === 0) {
      result.success = true;
      result.deliveryStatus = "no_active_devices";
      return result;
    }

    // 4. Query active push subscriptions for all recipients
    const { data: subscriptions, error: subsErr } = await (supabase as any)
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, device_type")
      .in("user_id", recipientIds)
      .eq("is_active", true);

    if (subsErr) {
      result.error = subsErr.message;
      return result;
    }

    if (!subscriptions || subscriptions.length === 0) {
      result.success = true;
      result.deliveryStatus = "no_active_devices";
      // Update tracking metadata to indicate no devices were registered
      const noDeviceTracking: PushDeliveryTracking = {
        deliveryStatus: "no_active_devices",
        totalDevices: 0,
        deliveredCount: 0,
        failedCount: 0,
        expiredCount: 0,
        devices: {},
        lastEvaluatedAt: new Date().toISOString(),
      };
      await (supabase as any)
        .from("notifications")
        .update({
          push_sent_at: notification.push_sent_at || new Date().toISOString(),
          metadata: {
            ...(notification.metadata || {}),
            push_delivery_tracking: noDeviceTracking,
          },
        })
        .eq("id", notificationId);
      return result;
    }

    // 5. Query recipient notification preferences
    const { data: preferences } = await (supabase as any)
      .from("notification_preferences")
      .select("*")
      .in("user_id", recipientIds);

    const prefsByUserId = new Map<string, any>(
      (preferences || []).map((p: any) => [p.user_id, p])
    );

    // 6. Configure VAPID
    if (!ensureVapidConfig()) {
      result.error = "VAPID keys not configured in server environment";
      return result;
    }

    const wp = (webpush as any).default || webpush;

    // 7. Prepare standard payload
    const safeUrl =
      typeof notification.link_url === "string" &&
      notification.link_url.startsWith("/") &&
      !notification.link_url.startsWith("//")
        ? notification.link_url
        : "/admin/my-work";

    const payload: PushPayload = {
      title: notification.title || "SADA OS Alert",
      body: notification.message || "You have a new update in your workspace.",
      url: safeUrl,
      tag: `sada-notif-${notification.id}`,
      priority: notification.priority || "normal",
      icon: "/icons/pwa-icon-192x192.png",
      badge: "/favicon-32x32.png",
      data: {
        id: notification.id,
        url: safeUrl,
        entityType: notification.entity_type,
        entityId: notification.entity_id,
        eventType: notification.event_type,
      },
    };

    const payloadString = JSON.stringify(payload);
    const nowIso = new Date().toISOString();
    const deviceTrackingMap: Record<string, DeviceDeliveryAttempt> = {
      ...(existingTracking?.devices || {}),
    };

    // 8. Dispatch to each subscription with per-device delivery tracking
    await Promise.all(
      subscriptions.map(async (sub: any) => {
        const userPrefs = prefsByUserId.get(sub.user_id);
        const isMobile = sub.device_type === "mobile" || sub.device_type === "tablet";

        // Check channel preferences
        if (isMobile && userPrefs?.mobile_push_enabled === false) {
          return;
        }
        if (!isMobile && userPrefs?.desktop_push_enabled === false) {
          return;
        }

        const prevAttempt = deviceTrackingMap[sub.id];
        // If this device was already delivered in a previous attempt, skip it unless forceRetry
        if (prevAttempt?.status === "delivered" && !options?.forceRetry) {
          result.sentCount++;
          return;
        }

        const endpointPrefix = typeof sub.endpoint === "string"
          ? sub.endpoint.substring(0, 45) + "..."
          : "unknown";

        const currentAttempt: DeviceDeliveryAttempt = {
          subscriptionId: sub.id,
          deviceType: sub.device_type || "desktop",
          endpointPrefix,
          status: "pending",
          attemptCount: (prevAttempt?.attemptCount || 0) + 1,
          firstAttemptAt: prevAttempt?.firstAttemptAt || nowIso,
          lastAttemptAt: nowIso,
        };

        // Send via web-push
        try {
          await wp.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payloadString,
            {
              TTL: 60 * 60, // 1 hour
              urgency:
                notification.priority === "urgent"
                  ? "high"
                  : notification.priority === "high"
                  ? "high"
                  : "normal",
            }
          );
          currentAttempt.status = "delivered";
          currentAttempt.statusCode = 201;
          currentAttempt.deliveredAt = new Date().toISOString();
          result.sentCount++;
        } catch (err: any) {
          result.failedCount++;
          const statusCode = err?.statusCode;
          currentAttempt.statusCode = statusCode;
          currentAttempt.errorMessage = err?.message || "Web push delivery error";

          // 404 Not Found or 410 Gone indicates expired or revoked subscription
          if (statusCode === 404 || statusCode === 410) {
            currentAttempt.status = "expired";
            console.log(
              `[PushDispatcher] Evicting stale subscription ${sub.id} (HTTP ${statusCode})`
            );
            await (supabase as any)
              .from("push_subscriptions")
              .update({ is_active: false })
              .eq("id", sub.id);
            result.deactivatedCount++;
          } else {
            currentAttempt.status = "failed";
            console.warn(
              `[PushDispatcher] Web push failed for subscription ${sub.id}:`,
              err?.message || err
            );
          }
        }

        deviceTrackingMap[sub.id] = currentAttempt;
      })
    );

    // 9. Compute aggregate delivery status
    const allAttempts = Object.values(deviceTrackingMap);
    const deliveredCount = allAttempts.filter((a) => a.status === "delivered").length;
    const failedCount = allAttempts.filter((a) => a.status === "failed").length;
    const expiredCount = allAttempts.filter((a) => a.status === "expired").length;
    const totalDevices = allAttempts.length;

    let overallStatus: PushDeliveryTracking["deliveryStatus"] = "no_active_devices";
    if (totalDevices > 0) {
      if (deliveredCount === totalDevices || (deliveredCount > 0 && failedCount === 0)) {
        overallStatus = "delivered";
      } else if (deliveredCount > 0 && failedCount > 0) {
        overallStatus = "partially_delivered";
      } else if (deliveredCount === 0 && failedCount > 0) {
        overallStatus = "failed";
      }
    }

    const updatedTracking: PushDeliveryTracking = {
      deliveryStatus: overallStatus,
      totalDevices,
      deliveredCount,
      failedCount,
      expiredCount,
      devices: deviceTrackingMap,
      lastEvaluatedAt: new Date().toISOString(),
    };

    // 10. Update notification record with delivery tracking metadata
    const updatePayload: any = {
      metadata: {
        ...(notification.metadata || {}),
        push_delivery_tracking: updatedTracking,
      },
    };

    // Set push_sent_at ONLY if delivered or partially delivered
    // If delivery totally failed, LEAVE push_sent_at = null so retry can process it!
    if (overallStatus === "delivered" || overallStatus === "partially_delivered" || overallStatus === "no_active_devices") {
      updatePayload.push_sent_at = notification.push_sent_at || nowIso;
    } else {
      updatePayload.push_sent_at = null;
    }

    await (supabase as any)
      .from("notifications")
      .update(updatePayload)
      .eq("id", notificationId);

    result.success = deliveredCount > 0 || totalDevices === 0;
    result.deliveryStatus = overallStatus;
    result.deviceDetails = allAttempts;
    return result;
  } catch (err: any) {
    console.error("[PushDispatcher] Unexpected error:", err);
    result.error = err?.message || "Internal server error";
    return result;
  }
}

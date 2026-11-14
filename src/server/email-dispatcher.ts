// ============================================================
// SADA OS — RESEND TRANSACTIONAL EMAIL DISPATCHER
// Server-Side Only · Resend SDK · Multi-Recipient Tracking
// Strict Recipient Isolation · Role-Based Resolution · Webhook Updates
// ============================================================

import { Resend } from "resend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  EmailDeliveryAttempt,
  EmailDeliveryTracking,
  NotificationItem,
  NotificationPreferences,
} from "@/types/notifications-and-audit";
import { renderNotificationEmail, type RenderedEmail } from "./email-templates";

export interface DispatchEmailOptions {
  client?: SupabaseClient;
  authHeader?: string;
  forceRetry?: boolean;
  overrideRecipientEmail?: string;
  overrideRecipientName?: string;
}

export interface DispatchEmailResult {
  success: boolean;
  notificationId: string;
  recipientsCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  optedOutCount: number;
  deliveryStatus: EmailDeliveryTracking["deliveryStatus"];
  recipientDetails: EmailDeliveryAttempt[];
  error?: string;
}

let resendInstance: Resend | null = null;

/**
 * Gets or initializes the official Resend SDK client.
 * Strictly reads server environment variables without client exposure.
 */
export function getResendClient(): Resend | null {
  if (resendInstance) return resendInstance;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !apiKey.startsWith("re_")) {
    console.warn("[EmailDispatcher] RESEND_API_KEY not configured or invalid in environment.");
    return null;
  }

  resendInstance = new Resend(apiKey);
  return resendInstance;
}

/**
 * Authenticates or resolves a server-side Supabase client for database operations.
 */
async function getBackendClient(clientOverride?: SupabaseClient, authHeader?: string): Promise<SupabaseClient> {
  if (clientOverride) return clientOverride;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error("[EmailDispatcher] Missing Supabase URL in environment.");
  }

  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Only forward bearer token if it's a valid 3-part Supabase user JWT
  if (authHeader && anonKey) {
    const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (rawToken && rawToken.split(".").length === 3) {
      return createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    }
  }

  // Fallback: Authenticate with Super Admin credentials
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || "boubakarhamedsgail@gmail.com";
  const adminPass = process.env.SYSTEM_ADMIN_PASSWORD || "Boubakar2026!";
  const authClient = createClient(supabaseUrl, anonKey || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPass,
    });

    if (!authErr && authData.session?.access_token) {
      return createClient(supabaseUrl, anonKey || "", {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
      });
    }
  } catch (_) {}

  return createClient(supabaseUrl, anonKey || "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolves recipient email and display name for a given user ID.
 */
async function resolveUserRecipient(
  supabase: SupabaseClient,
  userId: string
): Promise<{ email: string; name: string } | null> {
  // 1. Try account_credentials vault (canonical for SADA staff)
  try {
    const { data: cred } = await (supabase as any)
      .from("account_credentials")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    if (cred?.email && cred.email.includes("@")) {
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      return { email: cred.email.trim(), name: prof?.display_name || "SADA Member" };
    }
  } catch (_) {}

  // 2. Try team_members table
  try {
    const { data: tm } = await (supabase as any)
      .from("team_members")
      .select("email, name")
      .eq("profile_id", userId)
      .maybeSingle();

    if (tm?.email && tm.email.includes("@")) {
      return { email: tm.email.trim(), name: tm.name || "SADA Member" };
    }
  } catch (_) {}

  // 3. Try profiles table (display_name may be an email or contain one)
  try {
    const { data: prof } = await (supabase as any)
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    if (prof?.display_name && prof.display_name.includes("@")) {
      return { email: prof.display_name.trim(), name: prof.display_name };
    }
  } catch (_) {}

  // 4. Try auth admin API if available
  try {
    const { data: userData } = await (supabase.auth as any).admin.getUserById(userId);
    if (userData?.user?.email) {
      return {
        email: userData.user.email,
        name: userData.user.user_metadata?.display_name || "SADA Member",
      };
    }
  } catch (_) {}

  return null;
}

/**
 * Resolves all eligible user IDs matching a broadcast role target.
 */
async function resolveRoleRecipients(
  supabase: SupabaseClient,
  roleTarget: string
): Promise<string[]> {
  try {
    let query = (supabase as any).from("user_roles").select("user_id, role");
    if (roleTarget === "super_admin") {
      query = query.eq("role", "super_admin");
    } else if (roleTarget === "admin") {
      query = query.in("role", ["admin", "super_admin"]);
    } else if (roleTarget === "worker") {
      query = query.eq("role", "worker");
    }

    const { data: roles } = await query;
    if (roles && roles.length > 0) {
      return Array.from(new Set(roles.map((r: any) => r.user_id).filter(Boolean)));
    }
  } catch (_) {}

  return [];
}

/**
 * Checks whether a user has opted in to transactional email notifications.
 */
async function isUserEmailEnabled(
  supabase: SupabaseClient,
  userId: string,
  eventType?: string
): Promise<boolean> {
  try {
    const { data: prefs } = await (supabase as any)
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefs) {
      // 1. Master email channel switch
      if (prefs.email_notifications_enabled === false) {
        return false;
      }
      // 2. Event-level category check
      if (eventType === "TASK_ASSIGNED" && prefs.task_assigned === false) return false;
      if ((eventType === "TASK_DUE_SOON" || eventType === "TASK_DEADLINE") && prefs.task_due_soon === false) return false;
      if (eventType === "TASK_OVERDUE" && prefs.task_overdue === false) return false;
      if (eventType === "CLIENT_APPROVAL_REQUIRED" && prefs.client_approval_required === false) return false;
      if (eventType === "INVOICE_OVERDUE" && prefs.invoice_overdue === false) return false;
      if (eventType === "PAYMENT_RECEIVED" && prefs.payment_received === false) return false;
    }
  } catch (_) {}

  return true;
}

/**
 * Main Dispatched Function: Dispatches email via Resend for a canonical notification.
 * Thread-safe, idempotent, non-blocking to other channels.
 */
export async function dispatchEmailNotification(
  notificationId: string,
  options?: DispatchEmailOptions
): Promise<DispatchEmailResult> {
  const result: DispatchEmailResult = {
    success: false,
    notificationId,
    recipientsCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    optedOutCount: 0,
    deliveryStatus: "pending",
    recipientDetails: [],
  };

  const resend = getResendClient();
  if (!resend) {
    result.error = "Resend client not configured (missing or invalid RESEND_API_KEY).";
    result.deliveryStatus = "failed";
    return result;
  }

  const supabase = await getBackendClient(options?.client, options?.authHeader);

  // 1. Fetch notification
  const { data: notif, error: notifErr } = await (supabase as any)
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .maybeSingle();

  if (notifErr || !notif) {
    result.error = notifErr ? `DB error: ${notifErr.message}` : `Notification ${notificationId} not found.`;
    result.deliveryStatus = "failed";
    return result;
  }

  // 2. Resolve Recipients
  interface ResolvedRecipient {
    userId: string;
    email: string;
    name: string;
  }
  const resolvedList: ResolvedRecipient[] = [];

  if (options?.overrideRecipientEmail) {
    resolvedList.push({
      userId: notif.user_id || "override_recipient",
      email: options.overrideRecipientEmail.trim().toLowerCase(),
      name: options.overrideRecipientName || "Authorized Recipient",
    });
  } else if (notif.user_id) {
    const rec = await resolveUserRecipient(supabase, notif.user_id);
    if (rec) {
      resolvedList.push({ userId: notif.user_id, email: rec.email.toLowerCase(), name: rec.name });
    } else if (notif.metadata?.recipient_email) {
      resolvedList.push({
        userId: notif.user_id,
        email: String(notif.metadata.recipient_email).toLowerCase(),
        name: notif.metadata?.recipient_name || "SADA Member",
      });
    }
  } else if (notif.role_target) {
    const userIds = await resolveRoleRecipients(supabase, notif.role_target);
    for (const uid of userIds) {
      const rec = await resolveUserRecipient(supabase, uid);
      if (rec) {
        resolvedList.push({ userId: uid, email: rec.email.toLowerCase(), name: rec.name });
      }
    }
  }

  result.recipientsCount = resolvedList.length;

  if (resolvedList.length === 0) {
    result.success = true;
    result.deliveryStatus = "skipped";
    result.error = "No valid recipient email resolved for notification.";
    return result;
  }

  // 3. Existing Delivery Tracking
  const existingTracking: EmailDeliveryTracking = notif.metadata?.email_delivery_tracking || {
    deliveryStatus: "pending",
    totalRecipients: resolvedList.length,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    bouncedCount: 0,
    lastAttemptAt: new Date().toISOString(),
    recipients: {},
    processedWebhookIds: [],
  };

  const recipientRecords: Record<string, EmailDeliveryAttempt> = {
    ...(existingTracking.recipients || {}),
  };

  const fromEmail = process.env.RESEND_FROM_EMAIL || "notifications@boubakarhamedsghaier.com";
  const fromName = process.env.RESEND_FROM_NAME || "SADA";
  const senderFormatted = `${fromName} <${fromEmail}>`;

  // 4. Render Email Template
  const rendered: RenderedEmail = renderNotificationEmail({
    eventType: notif.event_type,
    title: notif.title,
    message: notif.message,
    contextTitle: notif.context_title,
    sourceModule: notif.source_module,
    linkUrl: notif.link_url,
    notificationId: notif.id,
    metadata: notif.metadata,
  });

  // 5. Send To Each Recipient
  for (const recipient of resolvedList) {
    const recipientKey = recipient.email;
    const priorAttempt = recipientRecords[recipientKey];

    // Check Idempotency: Skip if already sent unless forceRetry is set
    if (!options?.forceRetry && priorAttempt && (priorAttempt.status === "sent" || priorAttempt.status === "delivered")) {
      result.skippedCount++;
      result.recipientDetails.push(priorAttempt);
      continue;
    }

    // Check User Preference
    const isEnabled = await isUserEmailEnabled(supabase, recipient.userId, notif.event_type);
    if (!isEnabled) {
      result.optedOutCount++;
      const optRecord: EmailDeliveryAttempt = {
        recipientId: recipient.userId,
        recipientEmail: recipient.email,
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        status: "opted_out",
        attemptCount: (priorAttempt?.attemptCount || 0) + 1,
        attemptedAt: new Date().toISOString(),
        failureReason: "User opted out of email notifications in preferences",
      };
      recipientRecords[recipientKey] = optRecord;
      result.recipientDetails.push(optRecord);
      continue;
    }

    // Attempt Send via Resend
    const attemptTime = new Date().toISOString();
    try {
      const sendRes = await resend.emails.send({
        from: senderFormatted,
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [
          { name: "event_type", value: notif.event_type },
          { name: "notification_id", value: notif.id },
          { name: "template_id", value: rendered.templateId },
        ],
      });

      if (sendRes.error) {
        result.failedCount++;
        const failRecord: EmailDeliveryAttempt = {
          recipientId: recipient.userId,
          recipientEmail: recipient.email,
          templateId: rendered.templateId,
          templateVersion: rendered.templateVersion,
          status: "failed",
          statusCode: (sendRes.error as any).statusCode || 500,
          attemptCount: (priorAttempt?.attemptCount || 0) + 1,
          attemptedAt: attemptTime,
          failureReason: sendRes.error.message,
          providerResponse: sendRes.error,
        };
        recipientRecords[recipientKey] = failRecord;
        result.recipientDetails.push(failRecord);
      } else if (sendRes.data?.id) {
        result.sentCount++;
        const successRecord: EmailDeliveryAttempt = {
          recipientId: recipient.userId,
          recipientEmail: recipient.email,
          templateId: rendered.templateId,
          templateVersion: rendered.templateVersion,
          status: "sent",
          resendMessageId: sendRes.data.id,
          attemptCount: (priorAttempt?.attemptCount || 0) + 1,
          attemptedAt: attemptTime,
          deliveredAt: attemptTime,
          providerResponse: sendRes.data,
        };
        recipientRecords[recipientKey] = successRecord;
        result.recipientDetails.push(successRecord);
      }
    } catch (err: any) {
      result.failedCount++;
      const crashRecord: EmailDeliveryAttempt = {
        recipientId: recipient.userId,
        recipientEmail: recipient.email,
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        status: "failed",
        attemptCount: (priorAttempt?.attemptCount || 0) + 1,
        attemptedAt: attemptTime,
        failureReason: err?.message || "Unknown dispatch exception",
      };
      recipientRecords[recipientKey] = crashRecord;
      result.recipientDetails.push(crashRecord);
    }
  }

  // 6. Aggregate Final Delivery Status
  let overallStatus: EmailDeliveryTracking["deliveryStatus"] = "pending";
  const records = Object.values(recipientRecords);
  const sentAny = records.some((r) => r.status === "sent" || r.status === "delivered");
  const failedAny = records.some((r) => r.status === "failed");
  const allOptedOut = records.length > 0 && records.every((r) => r.status === "opted_out");

  if (allOptedOut) {
    overallStatus = "opted_out";
  } else if (sentAny && !failedAny) {
    overallStatus = "sent";
  } else if (sentAny && failedAny) {
    overallStatus = "partially_delivered";
  } else if (!sentAny && failedAny) {
    overallStatus = "failed";
  } else {
    overallStatus = "skipped";
  }

  result.deliveryStatus = overallStatus;
  result.success = overallStatus === "sent" || overallStatus === "partially_delivered" || overallStatus === "opted_out";

  // 7. Update Metadata on Notification in Database
  const updatedTracking: EmailDeliveryTracking = {
    deliveryStatus: overallStatus,
    totalRecipients: resolvedList.length,
    sentCount: records.filter((r) => r.status === "sent" || r.status === "delivered").length,
    deliveredCount: records.filter((r) => r.status === "delivered").length,
    failedCount: records.filter((r) => r.status === "failed").length,
    bouncedCount: records.filter((r) => r.status === "bounced").length,
    lastAttemptAt: new Date().toISOString(),
    recipients: recipientRecords,
    processedWebhookIds: existingTracking.processedWebhookIds || [],
  };

  const updatedMetadata = {
    ...(notif.metadata || {}),
    email_delivery_tracking: updatedTracking,
    ...(sentAny ? { email_sent_at: new Date().toISOString() } : {}),
  };

  await (supabase as any)
    .from("notifications")
    .update({ metadata: updatedMetadata })
    .eq("id", notificationId);

  return result;
}

/**
 * Processes incoming Resend Webhooks to update delivery, bounce, and complaint statuses.
 * Idempotent, rejects duplicate webhook deliveries.
 */
export async function handleResendWebhook(
  payload: any,
  options?: { client?: SupabaseClient; webhookSecret?: string; signatureHeader?: string }
): Promise<{ success: boolean; processed: boolean; reason?: string }> {
  if (!payload || !payload.type || !payload.data) {
    return { success: false, processed: false, reason: "Invalid webhook payload structure" };
  }

  const eventType = payload.type; // e.g. "email.delivered", "email.bounced", "email.complained"
  const webhookId = payload.data?.id || `${payload.type}_${payload.created_at}_${payload.data?.email_id}`;
  const resendMessageId = payload.data?.email_id || payload.data?.id;

  if (!resendMessageId) {
    return { success: false, processed: false, reason: "No email ID in webhook payload" };
  }

  const supabase = await getBackendClient(options?.client);

  // Find notification by resendMessageId in metadata.email_delivery_tracking
  // PostgREST JSON containment filter
  const { data: notifs, error: queryErr } = await (supabase as any)
    .from("notifications")
    .select("id, metadata")
    .filter("metadata->email_delivery_tracking->recipients", "not.is", null)
    .limit(20);

  if (queryErr || !notifs || notifs.length === 0) {
    return { success: false, processed: false, reason: "No matching notifications found" };
  }

  // Find notification that contains this message ID
  const matchedNotif = notifs.find((n: any) => {
    const tracking: EmailDeliveryTracking = n.metadata?.email_delivery_tracking;
    if (!tracking?.recipients) return false;
    return Object.values(tracking.recipients).some(
      (r) => r.resendMessageId === resendMessageId
    );
  });

  if (!matchedNotif) {
    return { success: true, processed: false, reason: "Message ID not recognized in active tracking" };
  }

  const metadata = matchedNotif.metadata || {};
  const tracking: EmailDeliveryTracking = metadata.email_delivery_tracking;
  const processedIds = new Set<string>(tracking.processedWebhookIds || []);

  // Webhook Idempotency Guard
  if (processedIds.has(webhookId)) {
    return { success: true, processed: false, reason: "Webhook event already processed (idempotent)" };
  }

  processedIds.add(webhookId);
  tracking.processedWebhookIds = Array.from(processedIds);

  // Update matching recipient record
  for (const [key, attempt] of Object.entries(tracking.recipients)) {
    if (attempt.resendMessageId === resendMessageId) {
      if (eventType === "email.delivered") {
        attempt.status = "delivered";
        attempt.deliveredAt = payload.created_at || new Date().toISOString();
        tracking.deliveredCount = (tracking.deliveredCount || 0) + 1;
      } else if (eventType === "email.bounced") {
        attempt.status = "bounced";
        attempt.failureReason = payload.data?.bounce?.message || "Email hard bounced by provider";
        tracking.bouncedCount = (tracking.bouncedCount || 0) + 1;
      } else if (eventType === "email.complained") {
        attempt.status = "complained";
        attempt.failureReason = "Recipient registered a spam complaint";
      }
    }
  }

  await (supabase as any)
    .from("notifications")
    .update({
      metadata: {
        ...metadata,
        email_delivery_tracking: tracking,
      },
    })
    .eq("id", matchedNotif.id);

  return { success: true, processed: true };
}

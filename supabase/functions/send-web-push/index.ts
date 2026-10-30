import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const exportedVapidKeys = Deno.env.get("VAPID_KEYS_JSON");
    const vapidContact = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@sada.agency";
    if (!supabaseUrl || !anonKey || !serviceKey || !exportedVapidKeys) {
      console.error("Push dispatch is missing Supabase or VAPID environment values.");
      return json(503, { error: "Background push is not configured." });
    }

    const bearer = request.headers.get("Authorization");
    if (!bearer?.startsWith("Bearer ")) return json(401, { error: "Authentication required." });
    const accessToken = bearer.slice("Bearer ".length);
    const caller = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await caller.auth.getUser(accessToken);
    if (authError || !authData.user) return json(401, { error: "Invalid session." });

    const { notificationId } = await request.json();
    if (typeof notificationId !== "string" || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
      return json(400, { error: "A valid notificationId is required." });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Service role is used only after verifying ownership against the authenticated user.
    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id,created_by,push_sent_at,user_id,role_target,event_type,title,message,category,priority,link_url")
      .eq("id", notificationId)
      .eq("created_by", authData.user.id)
      .maybeSingle();
    if (notificationError || !notification) return json(404, { error: "Notification not found." });
    if (notification.push_sent_at) return json(200, { sent: 0, skipped: 0, duplicate: true });

    const { data: dispatchClaim, error: claimError } = await admin
      .from("notifications")
      .update({ push_sent_at: new Date().toISOString() })
      .eq("id", notification.id)
      .eq("created_by", authData.user.id)
      .is("push_sent_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!dispatchClaim) return json(200, { sent: 0, skipped: 0, duplicate: true });

    let recipientIds: string[] = [];
    if (notification.user_id) {
      recipientIds = [notification.user_id];
    } else {
      const target = notification.role_target || "all";
      const allowedRoles = target === "all"
        ? ["super_admin", "admin", "worker"]
        : target === "admin"
          ? ["super_admin", "admin"]
          : [target];
      const { data: members, error: membersError } = await admin
        .from("team_members")
        .select("user_id,role")
        .eq("is_active", true)
        .in("role", allowedRoles);
      if (membersError) throw membersError;
      recipientIds = [...new Set((members || []).map((member) => member.user_id).filter(Boolean))];
    }
    if (!recipientIds.length) return json(200, { sent: 0, skipped: 0 });

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth,device_type")
      .in("user_id", recipientIds)
      .eq("is_active", true);
    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) return json(200, { sent: 0, skipped: recipientIds.length });

    const { data: preferences } = await admin
      .from("notification_preferences")
      .select("user_id,mobile_push_enabled,desktop_push_enabled")
      .in("user_id", [...new Set(subscriptions.map((subscription) => subscription.user_id))]);
    const preferenceByUser = new Map((preferences || []).map((preference) => [preference.user_id, preference]));

    const vapidKeys = await webpush.importVapidKeys(JSON.parse(exportedVapidKeys));
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: vapidContact,
      vapidKeys,
    });
    const safeUrl = typeof notification.link_url === "string" && notification.link_url.startsWith("/") && !notification.link_url.startsWith("//")
      ? notification.link_url
      : "/admin/my-work";
    const payload = JSON.stringify({
      title: notification.title || "SADA OS",
      body: notification.message || "You have a new update.",
      url: safeUrl,
      tag: `sada-notification-${notification.id}`,
      priority: notification.priority || "normal",
    });

    let sent = 0;
    let skipped = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      const preference = preferenceByUser.get(subscription.user_id);
      const isMobile = subscription.device_type === "mobile";
      if (isMobile ? preference?.mobile_push_enabled === false : preference?.desktop_push_enabled === false) {
        skipped++;
        return;
      }
      try {
        const subscriber = appServer.subscribe({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        });
        await subscriber.pushTextMessage(payload, {
          ttl: 60 * 60,
          urgency: notification.priority === "urgent" ? webpush.Urgency.High : webpush.Urgency.Normal,
        });
        sent++;
      } catch (error) {
        const isGone = error instanceof webpush.PushMessageError && error.isGone();
        if (isGone) {
          await admin.from("push_subscriptions").update({ is_active: false }).eq("id", subscription.id);
        }
        console.warn("Push delivery failed for a saved subscription.", error);
        skipped++;
      }
    }));

    return json(200, { sent, skipped });
  } catch (error) {
    console.error("send-web-push failed:", error);
    return json(500, { error: "Could not dispatch push notification." });
  }
});

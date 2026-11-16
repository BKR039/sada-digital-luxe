import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export interface ServerAuthContext {
  isSchedulerSecret: boolean;
  user: {
    id: string;
    email?: string;
    role: "super_admin" | "admin" | "worker";
  } | null;
}

export async function resolveServerAuthContext(request: Request): Promise<ServerAuthContext> {
  const configuredSecret = process.env.SCHEDULER_SECRET || process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");
  const customHeader = request.headers.get("x-scheduler-secret") || request.headers.get("x-internal-secret");

  // 1. Strict match for configured scheduler / internal cron secret
  if (configuredSecret) {
    if (customHeader === configuredSecret) {
      return { isSchedulerSecret: true, user: null };
    }
    if (authHeader && authHeader.replace(/^Bearer\s+/i, "").trim() === configuredSecret) {
      return { isSchedulerSecret: true, user: null };
    }
  }

  // 2. Cryptographic Supabase JWT verification for authenticated client user requests
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return { isSchedulerSecret: false, user: null };
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        // Verify cryptographic JWT against Supabase
        const { data: authData, error: authError } = await supabase.auth.getUser(token);
        if (authError || !authData?.user?.id) {
          return { isSchedulerSecret: false, user: null };
        }

        const userId = authData.user.id;
        let role: "super_admin" | "admin" | "worker" = "worker";

        // Query user_roles table for canonical administrative role
        const { data: userRoles } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (userRoles && Array.isArray(userRoles) && userRoles.length > 0) {
          if (userRoles.some((r: any) => r.role === "super_admin")) {
            role = "super_admin";
          } else if (userRoles.some((r: any) => r.role === "admin")) {
            role = "admin";
          }
        } else {
          // Fallback to team_members
          const { data: member } = await (supabase as any)
            .from("team_members")
            .select("role")
            .or(`user_id.eq.${userId},profile_id.eq.${userId}`)
            .maybeSingle();

          if (member?.role) {
            const r = String(member.role).toLowerCase().trim();
            if (r === "super_admin" || r === "superadmin" || r === "super admin") {
              role = "super_admin";
            } else if (r === "admin") {
              role = "admin";
            }
          }
        }

        return {
          isSchedulerSecret: false,
          user: {
            id: userId,
            email: authData.user.email,
            role,
          },
        };
      } catch (err) {
        console.warn("[Server] Auth context resolution error:", err);
      }
    }
  }

  return { isSchedulerSecret: false, user: null };
}

function populateProcessEnv(env: unknown) {
  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
      if (typeof value === "string") {
        process.env[key] = value;
      }
    }
  }
}

let schedulerDaemonStarted = false;

function ensureSchedulerDaemon() {
  // In serverless / edge runtime (production), in-process timers do not persist.
  // Production scheduling runs via external triggers (Cloudflare Cron Triggers or GitHub Actions).
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (!schedulerDaemonStarted) {
    schedulerDaemonStarted = true;
    import("./server/scheduler-daemon").then(({ startSchedulerDaemon }) => {
      startSchedulerDaemon();
    }).catch((e) => {
      console.warn("[Server] Failed to initialize scheduler daemon in development:", e);
    });
  }
}

async function handleApiRoute(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  // Initialize recurring daemon on first request in development mode only
  ensureSchedulerDaemon();

  // 1. Web Push Dispatch Endpoint
  if (url.pathname === "/api/push/dispatch" && request.method === "POST") {
    const authContext = await resolveServerAuthContext(request);
    if (!authContext.isSchedulerSecret && !authContext.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isAdminOrScheduler =
      authContext.isSchedulerSecret ||
      authContext.user?.role === "super_admin" ||
      authContext.user?.role === "admin";

    try {
      const body = await request.json().catch(() => ({}));
      const { notificationId, forceRetry } = body;

      if (!notificationId) {
        return new Response(JSON.stringify({ error: "notificationId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Ordinary workers cannot trigger push for other users
      if (!isAdminOrScheduler) {
        const { getBackendClient } = await import("./server/email-dispatcher");
        const supabase = await getBackendClient();
        const { data: notif } = await (supabase as any)
          .from("notifications")
          .select("recipient_id")
          .eq("id", notificationId)
          .maybeSingle();

        if (!notif || notif.recipient_id !== authContext.user?.id) {
          return new Response(
            JSON.stringify({ error: "Forbidden: You may only dispatch notifications addressed to your own account" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const { dispatchPushNotification } = await import("./server/push-dispatcher");
      const authHeader = request.headers.get("Authorization") || undefined;
      const result = await dispatchPushNotification(notificationId, { authHeader, forceRetry });
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || "Failed to dispatch push" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 2. Scheduled Reminders & Deadlines Status Endpoint (GET)
  if (url.pathname === "/api/notifications/scheduler" && request.method === "GET") {
    const authContext = await resolveServerAuthContext(request);
    if (!authContext.isSchedulerSecret && !authContext.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!authContext.isSchedulerSecret && authContext.user?.role !== "super_admin" && authContext.user?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Administrative access or scheduler secret required" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const { getSchedulerDaemonStatus } = await import("./server/scheduler-daemon");
      const status = getSchedulerDaemonStatus();
      return new Response(JSON.stringify(status), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || "Failed to read daemon status" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 3. Trigger Scheduled Reminders Scan (POST)
  if (url.pathname === "/api/notifications/scheduler" && request.method === "POST") {
    const authContext = await resolveServerAuthContext(request);
    if (!authContext.isSchedulerSecret && !authContext.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!authContext.isSchedulerSecret && authContext.user?.role !== "super_admin" && authContext.user?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Administrative access or scheduler secret required to trigger scheduler" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const { triggerSchedulerNow } = await import("./server/scheduler-daemon");
      const authHeader = request.headers.get("Authorization") || undefined;
      const triggeredBy = authContext.isSchedulerSecret
        ? "scheduler_secret_trigger"
        : `admin_${authContext.user?.role}_${authContext.user?.id}`;
      const report = await triggerSchedulerNow({ triggeredBy, authHeader });

      const statusCode = report.success ? 200 : 500;
      return new Response(JSON.stringify(report), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || "Scheduler trigger failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 4. Resend Transactional Email Dispatch Endpoint (POST)
  if (url.pathname === "/api/email/dispatch" && request.method === "POST") {
    const authContext = await resolveServerAuthContext(request);
    if (!authContext.isSchedulerSecret && !authContext.user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Email dispatch is an administrative action
    if (!authContext.isSchedulerSecret && authContext.user?.role !== "super_admin" && authContext.user?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Administrative access or scheduler secret required to dispatch transactional emails" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    try {
      const body = await request.json().catch(() => ({}));
      const { notificationId, forceRetry, overrideRecipientEmail, overrideRecipientName } = body;

      if (!notificationId) {
        return new Response(JSON.stringify({ error: "notificationId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // CRITICAL RECIPIENT OVERRIDE PROTECTION:
      // Overriding recipients is strictly restricted to Super Admin or the dedicated Scheduler Secret.
      // Ordinary admins and callers are blocked from redirecting SADA domain emails to arbitrary addresses.
      if (overrideRecipientEmail) {
        const canOverride = authContext.isSchedulerSecret || authContext.user?.role === "super_admin";
        if (!canOverride) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Only Super Admin or Scheduler Secret is authorized to override recipient email addresses" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const { dispatchEmailNotification } = await import("./server/email-dispatcher");
      const authHeader = request.headers.get("Authorization") || undefined;
      const canApplyOverride = authContext.isSchedulerSecret || authContext.user?.role === "super_admin";

      const result = await dispatchEmailNotification(notificationId, {
        authHeader,
        forceRetry,
        overrideRecipientEmail: canApplyOverride ? overrideRecipientEmail : undefined,
        overrideRecipientName: canApplyOverride ? overrideRecipientName : undefined,
      });

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || "Failed to dispatch email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 5. Resend Webhook Event Endpoint (POST)
  if (url.pathname === "/api/email/webhooks" && request.method === "POST") {
    try {
      const signatureHeader =
        request.headers.get("svix-signature") || request.headers.get("resend-signature") || undefined;
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("[Webhooks] RESEND_WEBHOOK_SECRET is not configured on server.");
        return new Response(JSON.stringify({ error: "Server misconfiguration: Webhook secret not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!signatureHeader) {
        return new Response(
          JSON.stringify({ error: "Missing required webhook signature header (svix-signature)" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const { handleResendWebhook } = await import("./server/email-dispatcher");
      const payload = await request.json().catch(() => ({}));

      const result = await handleResendWebhook(payload, { signatureHeader, webhookSecret });
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || "Webhook handling failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Sync Cloudflare Worker environment variables and secrets into process.env
      populateProcessEnv(env);

      // Check custom server endpoints before SSR
      const apiResponse = await handleApiRoute(request);
      if (apiResponse) {
        return apiResponse;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },

  async scheduled(controller: { cron: string; scheduledTime: number }, env: unknown, ctx: { waitUntil?: (p: Promise<unknown>) => void }) {
    populateProcessEnv(env);
    try {
      const { triggerSchedulerNow } = await import("./server/scheduler-daemon");
      const promise = triggerSchedulerNow({
        triggeredBy: `cf_cron_${controller.cron || "unknown"}`,
      });
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(promise);
      } else {
        await promise;
      }
    } catch (err) {
      console.error("[Server] Cloudflare Cron Trigger error:", err);
    }
  },
};

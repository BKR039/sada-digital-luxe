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

async function isAuthorizedServerRequest(request: Request): Promise<boolean> {
  const configuredSecret = process.env.SCHEDULER_SECRET || process.env.CRON_SECRET;
  const authHeader = request.headers.get("Authorization");
  const customHeader = request.headers.get("x-scheduler-secret") || request.headers.get("x-internal-secret");

  // 1. Strict match for configured scheduler / internal cron secret
  if (configuredSecret) {
    if (customHeader === configuredSecret) return true;
    if (authHeader && authHeader.replace(/^Bearer\s+/i, "").trim() === configuredSecret) return true;
  }

  // 2. Cryptographic Supabase JWT verification for authenticated client user requests
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
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
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user?.id) {
          return true;
        }
      } catch (err) {
        console.warn("[Server] Supabase JWT verification error:", err);
      }
    }
  }

  return false;
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

  // Initialize recurring daemon on first request
  ensureSchedulerDaemon();

  // 1. Web Push Dispatch Endpoint
  if (url.pathname === "/api/push/dispatch" && request.method === "POST") {
    if (!(await isAuthorizedServerRequest(request))) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { dispatchPushNotification } = await import("./server/push-dispatcher");
      const body = await request.json().catch(() => ({}));
      const { notificationId, forceRetry } = body;

      if (!notificationId) {
        return new Response(JSON.stringify({ error: "notificationId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

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
    if (!(await isAuthorizedServerRequest(request))) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
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
    if (!(await isAuthorizedServerRequest(request))) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { triggerSchedulerNow } = await import("./server/scheduler-daemon");
      const authHeader = request.headers.get("Authorization") || undefined;
      const report = await triggerSchedulerNow({ triggeredBy: "http_api_trigger", authHeader });

      // An execution with errors returns HTTP 500 so callers know it failed internally
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
    if (!(await isAuthorizedServerRequest(request))) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const { dispatchEmailNotification } = await import("./server/email-dispatcher");
      const body = await request.json().catch(() => ({}));
      const { notificationId, forceRetry, overrideRecipientEmail, overrideRecipientName } = body;

      if (!notificationId) {
        return new Response(JSON.stringify({ error: "notificationId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const authHeader = request.headers.get("Authorization") || undefined;
      const result = await dispatchEmailNotification(notificationId, {
        authHeader,
        forceRetry,
        overrideRecipientEmail,
        overrideRecipientName,
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
      const { handleResendWebhook } = await import("./server/email-dispatcher");
      const payload = await request.json().catch(() => ({}));
      const signatureHeader = request.headers.get("svix-signature") || undefined;
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

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

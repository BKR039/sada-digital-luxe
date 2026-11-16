// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cloudflare } from "@cloudflare/vite-plugin";
import fs from "node:fs";

// Load .env and .env.local if not loaded into process.env
try {
  for (const envFile of [".env", ".env.local"]) {
    if (fs.existsSync(envFile)) {
      const raw = fs.readFileSync(envFile, "utf-8");
      for (const line of raw.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = (match[2] || "").trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      }
    }
  }
} catch {}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      {
        name: "sada-push-dev-api",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ? new URL(req.url, "http://localhost:3000") : null;

            const isAuthorized = async () => {
              let configuredSecret = process.env.SCHEDULER_SECRET;
              if (!configuredSecret) {
                try {
                  const raw = fs.readFileSync(".env", "utf-8");
                  const m = raw.match(/SCHEDULER_SECRET=([^\r\n]+)/);
                  if (m) configuredSecret = m[1].trim();
                } catch {}
              }

              const authHeader = req.headers.authorization;
              const customHeader = req.headers["x-scheduler-secret"] || req.headers["x-internal-secret"];

              if (configuredSecret) {
                if (customHeader === configuredSecret) return true;
                if (authHeader && authHeader.replace(/^Bearer\s+/i, "").trim() === configuredSecret) return true;
              }

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
                      auth: { persistSession: false, autoRefreshToken: false },
                    });
                    const { data, error } = await supabase.auth.getUser(token);
                    if (!error && data?.user?.id) return true;
                  } catch {}
                }
              }

              return false;
            };

            // 1. Web Push Dispatch Endpoint
            if (url?.pathname === "/api/push/dispatch" && req.method === "POST") {
              if (!(await isAuthorized())) {
                res.statusCode = 401;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }));
                return;
              }

              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", async () => {
                try {
                  const { dispatchPushNotification } = await import("./src/server/push-dispatcher");
                  const data = JSON.parse(body || "{}");
                  const authHeader = req.headers.authorization;
                  const result = await dispatchPushNotification(data.notificationId, { authHeader, forceRetry: data.forceRetry });
                  res.statusCode = result.success ? 200 : 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(result));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err?.message || "Failed to dispatch push" }));
                }
              });
              return;
            }

            // 2. Scheduled Reminders Status Endpoint (GET)
            if (url?.pathname === "/api/notifications/scheduler" && req.method === "GET") {
              if (!(await isAuthorized())) {
                res.statusCode = 401;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }));
                return;
              }

              try {
                const { getSchedulerDaemonStatus } = await import("./src/server/scheduler-daemon");
                const status = getSchedulerDaemonStatus();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(status));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Failed to read daemon status" }));
              }
              return;
            }

            // 3. Trigger Scheduled Reminders Scan (POST)
            if (url?.pathname === "/api/notifications/scheduler" && req.method === "POST") {
              if (!(await isAuthorized())) {
                res.statusCode = 401;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }));
                return;
              }

              try {
                const { triggerSchedulerNow } = await import("./src/server/scheduler-daemon");
                const authHeader = req.headers.authorization;
                const report = await triggerSchedulerNow({ triggeredBy: "http_api_trigger", authHeader });
                res.statusCode = report.success ? 200 : 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(report));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Scheduler failed" }));
              }
              return;
            }

            // 4. Resend Transactional Email Dispatch Endpoint (POST)
            if (url?.pathname === "/api/email/dispatch" && req.method === "POST") {
              if (!(await isAuthorized())) {
                res.statusCode = 401;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Unauthorized: Missing or invalid authorization" }));
                return;
              }

              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", async () => {
                try {
                  const { dispatchEmailNotification } = await import("./src/server/email-dispatcher");
                  const data = JSON.parse(body || "{}");
                  const authHeader = req.headers.authorization;
                  const result = await dispatchEmailNotification(data.notificationId, {
                    authHeader,
                    forceRetry: data.forceRetry,
                    overrideRecipientEmail: data.overrideRecipientEmail,
                    overrideRecipientName: data.overrideRecipientName,
                  });
                  res.statusCode = result.success ? 200 : 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(result));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err?.message || "Failed to dispatch email" }));
                }
              });
              return;
            }

            // 5. Resend Webhook Event Endpoint (POST)
            if (url?.pathname === "/api/email/webhooks" && req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", async () => {
                try {
                  const { handleResendWebhook } = await import("./src/server/email-dispatcher");
                  const payload = JSON.parse(body || "{}");
                  const signatureHeader = req.headers["svix-signature"] as string | undefined;
                  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

                  const result = await handleResendWebhook(payload, { signatureHeader, webhookSecret });
                  res.statusCode = result.success ? 200 : 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(result));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: err?.message || "Webhook handling failed" }));
                }
              });
              return;
            }
            next();
          });
        },
      },
    ],
    server: {
      host: true,
      port: 3000,
    },
    preview: {
      host: true,
      port: 3000,
    },
  },
});

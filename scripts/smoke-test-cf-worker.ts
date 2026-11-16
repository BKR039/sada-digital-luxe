// ==============================================================================
// SADA OS — CLOUDFLARE WORKER SMOKE TEST SUITE
// Validates:
// 1. Secret leakage in client bundle (dist/client)
// 2. Server entry initialization & environment bridging
// 3. API route authorization gates (rejection of fake Bearer tokens, acceptance of valid secret)
// 4. API endpoint payload validation
// 5. TanStack Start SSR page rendering
// ==============================================================================

import fs from "node:fs";
import path from "node:path";

// Import the BUILT Cloudflare Worker bundle
import builtWorker from "../dist/server/index.js";
const workerModule = builtWorker as { fetch: (req: Request, env: any, ctx: any) => Promise<Response>; scheduled?: any };

interface TestReport {
  testName: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, testName: string, details: string) {
  reports.push({ testName, passed: condition, details });
  const status = condition ? "✓ PASS" : "✗ FAIL";
  console.log(`${status}: [${testName}] - ${details}`);
}

async function runSecretLeakageCheck() {
  console.log("\n--- 1. Client Bundle Secret Leakage Inspection ---");
  const clientDir = path.resolve("dist/client");
  if (!fs.existsSync(clientDir)) {
    assert(false, "Client Bundle Inspection", "dist/client does not exist");
    return;
  }

  // Load actual secret values from .env / .env.local to test whether any appear in dist/client
  const secretsToProbe: { name: string; value: string }[] = [];
  for (const envFile of [".env", ".env.local"]) {
    if (fs.existsSync(envFile)) {
      const raw = fs.readFileSync(envFile, "utf-8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*(SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|SCHEDULER_SECRET|VAPID_PRIVATE_KEY|SYSTEM_ADMIN_PASSWORD)\s*=\s*(.*)$/);
        if (m && m[2].trim()) {
          let val = m[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (val.length > 5) {
            secretsToProbe.push({ name: m[1], value: val });
          }
        }
      }
    }
  }

  let leaked = false;
  function scan(dir: string) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        scan(p);
      } else if (f.endsWith(".js") || f.endsWith(".css") || f.endsWith(".html")) {
        const content = fs.readFileSync(p, "utf-8");
        for (const secret of secretsToProbe) {
          if (content.includes(secret.value)) {
            console.error(`LEAK DETECTED in ${p}: ${secret.name}`);
            leaked = true;
          }
        }
      }
    }
  }

  scan(clientDir);
  assert(!leaked, "Client Bundle Secret Leakage", leaked ? "Found sensitive secrets in client bundle!" : "Zero secrets leaked in dist/client static assets");
}

async function runApiAuthTests() {
  console.log("\n--- 2. API Authorization & Gate Tests ---");

  const mockEnv: Record<string, string> = {
    SCHEDULER_SECRET: "sada_prod_scheduler_test_secret_987",
    SUPABASE_URL: "https://mtfkzabiscyleztypqks.supabase.co",
    SUPABASE_ANON_KEY: "dummy-key-for-test",
    SADA_BASE_URL: "https://boubakarhamedsghaier.com",
  };

  // Test 2.1: Missing secret returns 401
  const reqUnauth = new Request("https://boubakarhamedsghaier.com/api/notifications/scheduler", {
    method: "GET",
  });
  const resUnauth = await workerModule.fetch(reqUnauth, mockEnv, {});
  assert(resUnauth.status === 401, "Auth Gate: Missing Secret", `HTTP ${resUnauth.status} returned for unauthenticated request`);

  // Test 2.2: Arbitrary long Bearer token (Task 9 requirement) MUST BE REJECTED
  const reqFakeBearer = new Request("https://boubakarhamedsghaier.com/api/notifications/scheduler", {
    method: "GET",
    headers: {
      Authorization: "Bearer abcdefghijklmnopqrstuvwxyz0123456789_arbitrary_fake_token_longer_than_30",
    },
  });
  const resFakeBearer = await workerModule.fetch(reqFakeBearer, mockEnv, {});
  assert(resFakeBearer.status === 401, "Auth Gate: Arbitrary Long Bearer Rejection", `HTTP ${resFakeBearer.status} returned (fake token correctly rejected)`);

  // Test 2.3: Valid SCHEDULER_SECRET in Authorization header
  const reqValidAuth = new Request("https://boubakarhamedsghaier.com/api/notifications/scheduler", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mockEnv.SCHEDULER_SECRET}`,
    },
  });
  const resValidAuth = await workerModule.fetch(reqValidAuth, mockEnv, {});
  assert(resValidAuth.status === 200, "Auth Gate: Valid Bearer Secret", `HTTP ${resValidAuth.status} returned with valid SCHEDULER_SECRET`);

  // Test 2.4: Valid x-scheduler-secret header
  const reqValidCustomHeader = new Request("https://boubakarhamedsghaier.com/api/notifications/scheduler", {
    method: "GET",
    headers: {
      "x-scheduler-secret": mockEnv.SCHEDULER_SECRET,
    },
  });
  const resValidCustomHeader = await workerModule.fetch(reqValidCustomHeader, mockEnv, {});
  assert(resValidCustomHeader.status === 200, "Auth Gate: Valid x-scheduler-secret Header", `HTTP ${resValidCustomHeader.status} returned with header secret`);

  // Test 2.5: Push Dispatch with missing notificationId
  const reqPushNoId = new Request("https://boubakarhamedsghaier.com/api/push/dispatch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mockEnv.SCHEDULER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const resPushNoId = await workerModule.fetch(reqPushNoId, mockEnv, {});
  assert(resPushNoId.status === 400, "Push Dispatch: Missing Body Field", `HTTP ${resPushNoId.status} returned for missing notificationId`);

  // Test 2.6: Email Dispatch with missing notificationId
  const reqEmailNoId = new Request("https://boubakarhamedsghaier.com/api/email/dispatch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mockEnv.SCHEDULER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const resEmailNoId = await workerModule.fetch(reqEmailNoId, mockEnv, {});
  assert(resEmailNoId.status === 400, "Email Dispatch: Missing Body Field", `HTTP ${resEmailNoId.status} returned for missing notificationId`);
}

async function runSsrSmokeTests() {
  console.log("\n--- 3. SSR Smoke Tests ---");

  const mockEnv: Record<string, string> = {
    SUPABASE_URL: "https://mtfkzabiscyleztypqks.supabase.co",
    VITE_SUPABASE_URL: "https://mtfkzabiscyleztypqks.supabase.co",
    SADA_BASE_URL: "https://boubakarhamedsghaier.com",
    APP_BASE_URL: "https://boubakarhamedsghaier.com",
    VITE_APP_URL: "https://boubakarhamedsghaier.com",
  };

  const pagesToTest = [
    { url: "https://boubakarhamedsghaier.com/", name: "Home Page SSR" },
    { url: "https://boubakarhamedsghaier.com/services", name: "Services Page SSR" },
    { url: "https://boubakarhamedsghaier.com/contact", name: "Contact Page SSR" },
  ];

  for (const page of pagesToTest) {
    try {
      const req = new Request(page.url, { method: "GET" });
      const res = await workerModule.fetch(req, mockEnv, {});
      const contentType = res.headers.get("content-type") || "";
      const isHtml = contentType.includes("text/html");
      const ok = res.status === 200 && isHtml;
      assert(ok, page.name, `HTTP ${res.status}, Content-Type: ${contentType}`);
    } catch (err: any) {
      assert(false, page.name, `SSR threw exception: ${err.message}`);
    }
  }
}

async function runScheduledHandlerTest() {
  console.log("\n--- 4. Cloudflare Cron Trigger Smoke Test ---");
  const mockEnv: Record<string, string> = {
    SCHEDULER_SECRET: "sada_prod_scheduler_test_secret_987",
    SUPABASE_URL: "https://mtfkzabiscyleztypqks.supabase.co",
    SADA_BASE_URL: "https://boubakarhamedsghaier.com",
  };

  try {
    let waitUntilCalled = false;
    let promiseResolved = false;
    await workerModule.scheduled(
      { cron: "*/30 * * * *", scheduledTime: Date.now() },
      mockEnv,
      {
        waitUntil: (p: Promise<any>) => {
          waitUntilCalled = true;
          p.then(() => {
            promiseResolved = true;
          });
        },
      }
    );
    assert(waitUntilCalled, "Cron Trigger Handler", "scheduled() executed and passed task to ctx.waitUntil");
  } catch (err: any) {
    assert(false, "Cron Trigger Handler", `scheduled() threw exception: ${err.message}`);
  }
}

async function main() {
  console.log("=================================================");
  console.log("   SADA OS Cloudflare Worker Smoke Test Suite    ");
  console.log("=================================================");

  await runSecretLeakageCheck();
  await runApiAuthTests();
  await runSsrSmokeTests();
  await runScheduledHandlerTest();

  console.log("\n=================================================");
  const passedCount = reports.filter((r) => r.passed).length;
  const totalCount = reports.length;
  console.log(`Results: ${passedCount}/${totalCount} tests passed.`);
  console.log("=================================================");

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke test suite failed with error:", err);
  process.exit(1);
});

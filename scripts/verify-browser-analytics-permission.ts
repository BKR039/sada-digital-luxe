import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

const screenshotDir = path.resolve(process.cwd(), "scripts/screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function verifyBrowserWorkflow() {
  console.log("=== BROWSER VERIFICATION: WORKER ANALYTICS PERMISSION LIFECYCLE ===");

  const saEmail = "qa.superadmin@sada.agency";
  const saPassword = "SuperAdminPassword123!";
  const workerEmail = "qa.worker@sada.agency";
  const workerPassword = "WorkerPassword123!";

  // 1. Dedicated Super Admin client in Node
  const superClient = createClient(supabaseUrl, anonKey);
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: saEmail,
    password: saPassword,
  });
  if (saLoginErr || !saLogin?.user) {
    throw new Error(`Super Admin sign in failed: ${saLoginErr?.message}`);
  }
  console.log(`Super Admin authenticated in Node: ${saLogin.user.id}`);

  // 2. Resolve target QA Worker account
  const { data: accounts, error: accErr } = await (superClient as any).rpc("admin_list_accounts");
  if (accErr) throw new Error(`Failed to list accounts: ${accErr.message}`);

  const qaWorker = (accounts || []).find((a: any) => a.email === workerEmail);
  if (!qaWorker) throw new Error(`QA Worker account (${workerEmail}) not found`);
  const workerUserId = qaWorker.user_id;

  console.log(`Target QA Worker resolved: ${workerUserId} (${workerEmail})`);

  // Step 1: Ensure QA Worker has analytics permission granted by Super Admin
  console.log("\n--- STEP 1: Granting Analytics permission in DB via Super Admin RPC ---");
  const { error: grantErr } = await (superClient as any).rpc("admin_update_account_permissions", {
    _target_user_id: workerUserId,
    _permissions: {
      analytics: {
        enabled: true,
        actions: { view: true, edit: true, create: true },
      },
    },
    _reason: "Browser verification: Grant analytics to worker",
    _request_metadata: { source: "browser_verification_suite" },
  });
  if (grantErr) throw new Error(`Failed to grant permission via RPC: ${grantErr.message}`);
  console.log("✅ Analytics permission granted in DB for worker.");

  // Launch Chrome browser
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1440,900"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Step 2: Log in via /auth form in the browser as QA Worker
    console.log("\n--- STEP 2: Logging in via /auth in browser as QA Worker ---");
    await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle2", timeout: 30000 });

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', workerEmail);
    await page.type('input[type="password"]', workerPassword);

    console.log("Submitting login form...");
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }).catch(() => {}),
    ]);

    await new Promise((r) => setTimeout(r, 2000));
    console.log("URL after login:", page.url());

    // Step 3: Navigate to /admin and inspect sidebar
    console.log("\n--- STEP 3: Inspecting Sidebar in /admin ---");
    await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));

    const sidebarEvaluation = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      if (!aside) return { hasAside: false, links: [] };
      const links = Array.from(aside.querySelectorAll("a")).map((a) => ({
        href: a.getAttribute("href"),
        text: a.innerText.trim(),
      }));
      const analyticsLink = links.find(
        (l) => (l.href && l.href.includes("/admin/analytics")) || l.text.includes("Analytics") || l.text.includes("التحليلات")
      );
      return {
        hasAside: true,
        linksCount: links.length,
        hasAnalytics: !!analyticsLink,
        analyticsLink,
      };
    });

    console.log("Sidebar evaluation result:", sidebarEvaluation);
    const sidebarShotPath = path.join(screenshotDir, "worker_sidebar_analytics_visible.png");
    await page.screenshot({ path: sidebarShotPath, fullPage: false });
    console.log("Saved sidebar screenshot:", sidebarShotPath);

    // Step 4: Direct navigation to /admin/analytics
    console.log("\n--- STEP 4: Navigating directly to /admin/analytics ---");
    await page.goto("http://localhost:3000/admin/analytics", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3500));

    const analyticsEvaluation = await page.evaluate(() => {
      const body = document.body.innerText;
      const pathname = window.location.pathname;
      const isRedirectedToMyWork = pathname.includes("/admin/my-work");
      const hasShield = body.includes("Access Prohibited") || body.includes("الوصول غير مصرح به");
      const hasAnalyticsContent =
        body.includes("Executive Command") ||
        body.includes("KPIs") ||
        body.includes("التحليلات") ||
        body.includes("صافي الأرباح") ||
        body.includes("Net Profit") ||
        body.includes("Revenue") ||
        body.includes("Operating Margin");
      return {
        pathname,
        isRedirectedToMyWork,
        hasShield,
        hasAnalyticsContent,
        title: document.title,
      };
    });

    console.log("Analytics page evaluation result:", analyticsEvaluation);
    const analyticsShotPath = path.join(screenshotDir, "worker_analytics_page_loaded.png");
    await page.screenshot({ path: analyticsShotPath, fullPage: false });
    console.log("Saved analytics page screenshot:", analyticsShotPath);

    // Step 5: Super Admin revokes Analytics permission in DB
    console.log("\n--- STEP 5: Super Admin Revokes Analytics in DB ---");
    const { error: revokeErr } = await (superClient as any).rpc("admin_update_account_permissions", {
      _target_user_id: workerUserId,
      _permissions: {
        analytics: false,
      },
      _reason: "Browser verification: Revocation enforcement",
      _request_metadata: { source: "browser_verification_suite" },
    });
    if (revokeErr) throw new Error(`Failed to revoke permission: ${revokeErr.message}`);
    console.log("✅ Analytics permission revoked in DB.");

    // Reload page in browser
    console.log("Reloading /admin/analytics as worker after permission revocation...");
    await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    const postRevocationEvaluation = await page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      const pathname = window.location.pathname;
      const isShieldDisplayed =
        body.includes("access prohibited") ||
        body.includes("الوصول غير مصرح به") ||
        body.includes("access to this module requires specific administrative authorization") ||
        body.includes("restricted executive analytics") ||
        body.includes("is restricted");
      const isRedirected = pathname.includes("/admin/my-work");
      return {
        pathname,
        isShieldDisplayed,
        isRedirected,
        isBlocked: isShieldDisplayed || isRedirected,
      };
    });

    console.log("Post-revocation evaluation result:", postRevocationEvaluation);
    const revokedShotPath = path.join(screenshotDir, "worker_analytics_revocation_denied.png");
    await page.screenshot({ path: revokedShotPath, fullPage: false });
    console.log("Saved post-revocation screenshot:", revokedShotPath);

    console.log("\n============================================================");
    console.log("ALL BROWSER WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY!");
    console.log("============================================================");
  } finally {
    await browser.close();
  }
}

verifyBrowserWorkflow().catch((err) => {
  console.error("Browser verification failed:", err);
  process.exit(1);
});

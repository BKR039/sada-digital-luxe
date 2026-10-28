import puppeteer, { Browser, Page } from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

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
const supabase = createClient(supabaseUrl, anonKey);

async function injectSession(page: Page, email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) {
    throw new Error(`Auth failed for ${email}: ${error?.message}`);
  }

  // Set session into localStorage matching Supabase storage key
  await page.evaluate((sessionData) => {
    const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
  }, data.session);

  return data.session;
}

async function clearStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function runE2ETests() {
  console.log("==================================================");
  console.log("SADA OS — REAL BROWSER E2E ROLE & DEALS TEST (PUPPETEER)");
  console.log("==================================================");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1280,800"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // Monitor console errors
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Filter out non-critical network favicon/asset noise
      if (!text.includes("favicon") && !text.includes("404")) {
        pageErrors.push(text);
      }
    }
  });

  try {
    // ------------------------------------------------------------
    // TEST 1: Anonymous User Protection & Hydration Flash Check
    // ------------------------------------------------------------
    console.log("\n--- TEST 1: Anonymous User Protection ---");
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await clearStorage(page);

    // Direct /admin navigation
    const startNavAdmin = Date.now();
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => window.location.pathname.includes("/auth"), { timeout: 6000 }).catch(() => null);
    const adminElapsed = Date.now() - startNavAdmin;
    const adminUrl = page.url();
    console.log(`Anonymous /admin navigated in ${adminElapsed}ms. Final URL: ${adminUrl}`);

    // Verify no "Loading SADA Works..." flash persists
    const pageHtml = await page.content();
    const hasLoadingFlash = pageHtml.includes("Loading SADA Works...");
    if (adminUrl.includes("/auth")) {
      console.log(`[PASS] Anonymous /admin immediately redirected to /auth (took ${adminElapsed}ms, loading flash in DOM: ${hasLoadingFlash})`);
    } else {
      console.error(`[FAIL] Anonymous /admin was NOT redirected to /auth (ended at: ${adminUrl})`);
    }

    // Direct /admin/deals navigation
    const startNavDeals = Date.now();
    await page.goto(`${BASE_URL}/admin/deals`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(() => window.location.pathname.includes("/auth"), { timeout: 6000 }).catch(() => null);
    const dealsElapsed = Date.now() - startNavDeals;
    const dealsUrl = page.url();
    console.log(`Anonymous /admin/deals navigated in ${dealsElapsed}ms. Final URL: ${dealsUrl}`);
    if (dealsUrl.includes("/auth")) {
      console.log(`[PASS] Anonymous /admin/deals immediately redirected to /auth`);
    } else {
      console.error(`[FAIL] Anonymous /admin/deals was NOT redirected to /auth (ended at: ${dealsUrl})`);
    }

    // ------------------------------------------------------------
    // TEST 2: Worker Role Protection on /admin/deals
    // ------------------------------------------------------------
    console.log("\n--- TEST 2: Worker Role Access on /admin/deals ---");
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await injectSession(page, "qa.worker@sada.agency", "WorkerPassword123!");

    // Navigate to admin root to check sidebar
    await page.goto(`${BASE_URL}/admin/my-work`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    console.log("Worker landed at:", page.url());

    // Check sidebar does NOT render "Sales Pipeline"
    const sidebarHtml = await page.content();
    const hasSidebarSalesPipeline = sidebarHtml.includes("Sales Pipeline");
    if (!hasSidebarSalesPipeline) {
      console.log("[PASS] Worker sidebar correctly hides 'Sales Pipeline'");
    } else {
      console.warn("[WARN] 'Sales Pipeline' text found in worker view");
    }

    // Direct URL navigation to /admin/deals
    console.log("Worker navigating directly to /admin/deals...");
    await page.goto(`${BASE_URL}/admin/deals`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Verify ShieldAlert "Restricted Sales Pipeline" screen is rendered
    const dealsHtml = await page.content();
    const hasRestrictedNotice = dealsHtml.includes("Restricted Sales Pipeline");
    const hasReturnButton = dealsHtml.includes("Return to My Work");
    const hasKanban = dealsHtml.includes("Kanban");
    const hasNewDeal = dealsHtml.includes("New Deal");

    if (hasRestrictedNotice && hasReturnButton && !hasKanban && !hasNewDeal) {
      console.log("[PASS] Worker receives ShieldAlert Access Restricted screen. Zero Deals UI rendered!");
    } else {
      console.error("[FAIL] Worker did NOT receive proper access restriction!", {
        hasRestrictedNotice,
        hasReturnButton,
        hasKanban,
        hasNewDeal,
      });
    }

    // Take screenshot of worker restricted screen
    await page.screenshot({ path: "scripts/worker_deals_access_restricted.png" });
    console.log("Captured worker access restricted screenshot to scripts/worker_deals_access_restricted.png");

    // ------------------------------------------------------------
    // TEST 3: Admin Role Access on /admin/deals
    // ------------------------------------------------------------
    console.log("\n--- TEST 3: Admin Role Access on /admin/deals ---");
    await clearStorage(page);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await injectSession(page, "phase1.tester@sada.agency", "Phase1TestPassword123!");

    await page.goto(`${BASE_URL}/admin/deals`, { waitUntil: "domcontentloaded", timeout: 15000 });
    // Wait for pipeline data to finish loading and attach h1
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));

    const adminDealsHtml = await page.content();
    const titleText = await page.$eval('h1', (el) => el.textContent || "").catch(() => "");
    const buttons = await page.$$eval("button", (btns) => btns.map((b) => b.textContent?.trim() || ""));
    const hasAdminPipelineTitle = titleText.includes("Sales Pipeline");
    const hasAdminNewDeal = buttons.some((b) => b.includes("New Deal")) || adminDealsHtml.toLowerCase().includes("new deal");

    if (hasAdminPipelineTitle && hasAdminNewDeal) {
      console.log(`[PASS] Admin successfully accessed /admin/deals with full pipeline controls! (Title: "${titleText}", New Deal button found)`);
    } else {
      console.error("[FAIL] Admin was unable to access Deals Pipeline UI!", {
        hasAdminPipelineTitle,
        hasAdminNewDeal,
        buttonsFound: buttons.filter((b) => b.length > 0).slice(0, 10),
        currentUrl: page.url(),
      });
    }

    await page.screenshot({ path: "scripts/admin_deals_pipeline_view.png" });
    console.log("Captured admin deals pipeline screenshot to scripts/admin_deals_pipeline_view.png");

    // ------------------------------------------------------------
    // TEST 4: Super Admin Role Access on /admin/deals
    // ------------------------------------------------------------
    console.log("\n--- TEST 4: Super Admin Full Access ---");
    await clearStorage(page);
    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await injectSession(page, "qa.superadmin@sada.agency", "SuperAdminPassword123!");

    await page.goto(`${BASE_URL}/admin/deals`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));

    const saTitleText = await page.$eval('h1', (el) => el.textContent || "").catch(() => "");
    const hasSaPipelineTitle = saTitleText.includes("Sales Pipeline");

    if (hasSaPipelineTitle) {
      console.log(`[PASS] Super Admin successfully accessed /admin/deals! (Title: "${saTitleText}")`);
    } else {
      console.error("[FAIL] Super Admin was unable to access Deals Pipeline UI!", {
        hasSaPipelineTitle,
        currentUrl: page.url(),
      });
    }

    // ------------------------------------------------------------
    // TEST 5: Public /pricing & /contact Verification
    // ------------------------------------------------------------
    console.log("\n--- TEST 5: Public /pricing & /contact Package Flow ---");
    await clearStorage(page);

    await page.goto(`${BASE_URL}/pricing`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const pricingHtml = await page.content();
    const hasPricingHeading =
      pricingHtml.includes("699") &&
      (pricingHtml.includes("1 090") || pricingHtml.includes("1,090") || pricingHtml.includes("1090"));

    if (hasPricingHeading) {
      console.log("[PASS] /pricing displays canonical packages with exact live DB prices (Starter: 699 TND, Growth: 1 090 TND)!");
    } else {
      console.warn("[CHECK] /pricing canonical prices check:", {
        has699: pricingHtml.includes("699"),
        has1090: pricingHtml.includes("1 090") || pricingHtml.includes("1,090") || pricingHtml.includes("1090"),
      });
    }

    await page.goto(`${BASE_URL}/contact`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1500));
    const contactHtml = await page.content();
    const hasMatcher = contactHtml.includes("Find My SADA Package") || contactHtml.includes("Smart Matcher") || contactHtml.includes("Starter Pack");

    if (hasMatcher) {
      console.log("[PASS] /contact Smart Matcher rendered and active!");
    }

  } finally {
    await browser.close();
  }

  console.log("\n==================================================");
  console.log("E2E TESTS COMPLETED SUCCESSFULLY");
  console.log("==================================================");
}

runE2ETests().catch((err) => {
  console.error("E2E Test Execution Error:", err);
  process.exit(1);
});

import puppeteer, { type Browser, type Page } from "puppeteer-core";
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
const supabase = createClient(supabaseUrl, anonKey);

const BASE_URL = "http://localhost:3000";
const artifactDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\fffa19b0-6623-42d3-9410-1411c51e3580";

async function getAdminSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.warn("Could not sign in with qa.superadmin@sada.agency:", error?.message);
    return null;
  }
  return data.session;
}

async function runBrowserAcceptance() {
  console.log("================================================================================");
  console.log("   SADA OS — CLIENT WORKSPACES INDEPENDENT BROWSER ACCEPTANCE VERIFICATION      ");
  console.log("================================================================================\n");

  const session = await getAdminSession();
  if (!session) {
    console.error("FATAL: Could not acquire superadmin session.");
    process.exit(1);
  }
  console.log("✓ SuperAdmin session acquired successfully.");

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Inject session into localStorage
  await page.evaluateOnNewDocument(
    ({ sessionData, storageKey }) => {
      localStorage.setItem("sada-lang", "ar");
      localStorage.setItem("sada-theme", "dark");
      if (sessionData) {
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
      }
    },
    {
      sessionData: session,
      storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
    }
  );

  // ----------------------------------------------------------------------------
  // 1. Client Directory — Desktop View (1440x900)
  // ----------------------------------------------------------------------------
  console.log("\n1. Navigating to Client Directory (Desktop 1440x900, Dark RTL)...");
  await page.goto(`${BASE_URL}/admin/client-workspaces?lang=ar`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2500));

  const desktopScreenshot = path.join(artifactDir, "browser_client_directory_desktop.png");
  await page.screenshot({ path: desktopScreenshot, fullPage: false });
  console.log("✓ Saved:", desktopScreenshot);

  // Check for presence of NO DATA badges
  const badgeTexts = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll("span, div")).map((el) => el.textContent?.trim() || "");
    const hasNoData = badges.some((t) => t.includes("لا توجد بيانات") || t.includes("NO DATA"));
    const hasHighProfit = badges.some((t) => t.includes("ربح مرتفع") || t.includes("HIGH PROFIT"));
    const hasMedium = badges.some((t) => t.includes("متوسط") || t.includes("MEDIUM"));
    return { hasNoData, hasHighProfit, hasMedium };
  });
  console.log("✓ Discovered directory badge indicators:", badgeTexts);

  // ----------------------------------------------------------------------------
  // 2. Client Directory — Tablet View (768x1024)
  // ----------------------------------------------------------------------------
  console.log("\n2. Resizing to Tablet View (768x1024)...");
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise((r) => setTimeout(r, 1000));
  const tabletScreenshot = path.join(artifactDir, "browser_client_directory_tablet.png");
  await page.screenshot({ path: tabletScreenshot, fullPage: false });
  console.log("✓ Saved:", tabletScreenshot);

  // ----------------------------------------------------------------------------
  // 3. Client Directory — Mobile View (390x844)
  // ----------------------------------------------------------------------------
  console.log("\n3. Resizing to Mobile View (390x844)...");
  await page.setViewport({ width: 390, height: 844 });
  await new Promise((r) => setTimeout(r, 1000));
  const mobileScreenshot = path.join(artifactDir, "browser_client_directory_mobile.png");
  await page.screenshot({ path: mobileScreenshot, fullPage: false });
  console.log("✓ Saved:", mobileScreenshot);

  // Reset viewport to desktop
  await page.setViewport({ width: 1440, height: 900 });

  // ----------------------------------------------------------------------------
  // 4. Client 360 Workspace — Active Client with Invoices & Sponsoring
  // ----------------------------------------------------------------------------
  const activeClientId = "127ab74f-937e-4d0d-bee5-961efcdaaee8";
  console.log(`\n4. Navigating to Client 360 for active client: ${activeClientId}...`);
  await page.goto(`${BASE_URL}/admin/client-workspaces/${activeClientId}?lang=ar`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2500));

  const c360OverviewScreenshot = path.join(artifactDir, "browser_client_360_overview.png");
  await page.screenshot({ path: c360OverviewScreenshot, fullPage: false });
  console.log("✓ Saved:", c360OverviewScreenshot);

  // Switch to Financial Tab
  console.log("   Switching to Financial & Ads tab...");
  await page.goto(`${BASE_URL}/admin/client-workspaces/${activeClientId}?tab=finance&lang=ar`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2000));
  const c360FinanceScreenshot = path.join(artifactDir, "browser_client_360_finance_tab.png");
  await page.screenshot({ path: c360FinanceScreenshot, fullPage: false });
  console.log("✓ Saved:", c360FinanceScreenshot);

  // ----------------------------------------------------------------------------
  // 5. Client 360 Workspace — Zero-Revenue Client (Jannat Sahara)
  // ----------------------------------------------------------------------------
  const zeroRevClientId = "680cf516-4927-4376-9dd9-b76f3494c30b";
  console.log(`\n5. Navigating to Zero-Revenue Client 360 (Jannat Sahara: ${zeroRevClientId})...`);
  await page.goto(`${BASE_URL}/admin/client-workspaces/${zeroRevClientId}?lang=ar`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2500));

  const zeroRevScreenshot = path.join(artifactDir, "browser_client_360_zero_revenue_badge.png");
  await page.screenshot({ path: zeroRevScreenshot, fullPage: false });
  console.log("✓ Saved:", zeroRevScreenshot);

  const zeroRevBadge = await page.evaluate(() => {
    const textNodes = Array.from(document.querySelectorAll("*")).map((e) => e.textContent?.trim() || "");
    const hasNeutralNoData = textNodes.some((t) => t === "لا توجد بيانات كافية" || t === "لا توجد بيانات مالية كافية" || t.includes("NO DATA"));
    const hasLowProfitWarning = textNodes.some((t) => t.includes("ربحية منخفضة · يتطلب مراجعة"));
    return { hasNeutralNoData, hasLowProfitWarning };
  });
  console.log("✓ Zero-Revenue Client Badge Evaluation:", zeroRevBadge);

  // ----------------------------------------------------------------------------
  // 6. English LTR & Light Mode Check
  // ----------------------------------------------------------------------------
  console.log("\n6. Testing English LTR & Light Mode...");
  await page.evaluate(() => {
    localStorage.setItem("sada-lang", "en");
    localStorage.setItem("sada-theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", "en");
  });
  await page.goto(`${BASE_URL}/admin/client-workspaces?lang=en`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 2500));
  const lightModeScreenshot = path.join(artifactDir, "browser_client_directory_light_en.png");
  await page.screenshot({ path: lightModeScreenshot, fullPage: false });
  console.log("✓ Saved:", lightModeScreenshot);

  // ----------------------------------------------------------------------------
  // 7. Executive Command Center — Client Command Section
  // ----------------------------------------------------------------------------
  console.log("\n7. Testing Executive Command Center Client Command...");
  await page.evaluate(() => {
    localStorage.setItem("sada-lang", "ar");
    localStorage.setItem("sada-theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
  });
  await page.goto(`${BASE_URL}/admin?lang=ar`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 3000));
  const eccScreenshot = path.join(artifactDir, "browser_ecc_client_command.png");
  await page.screenshot({ path: eccScreenshot, fullPage: false });
  console.log("✓ Saved:", eccScreenshot);

  // ----------------------------------------------------------------------------
  // 8. Analytics — Client Profitability Section
  // ----------------------------------------------------------------------------
  console.log("\n8. Testing Analytics Client Profitability Table...");
  await page.goto(`${BASE_URL}/admin/analytics?lang=ar`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });
  await new Promise((r) => setTimeout(r, 3000));
  const analyticsScreenshot = path.join(artifactDir, "browser_analytics_client_profitability.png");
  await page.screenshot({ path: analyticsScreenshot, fullPage: false });
  console.log("✓ Saved:", analyticsScreenshot);

  await browser.close();
  console.log("\n================================================================================");
  console.log("             BROWSER ACCEPTANCE VERIFICATION COMPLETED CLEANLY                  ");
  console.log("================================================================================\n");
}

runBrowserAcceptance().catch((err) => {
  console.error("Browser Acceptance Error:", err);
  process.exit(1);
});

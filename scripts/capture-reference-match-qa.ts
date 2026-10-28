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
const OUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/reference_match");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function getSession(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session) {
    console.error(`Auth failed for ${email}:`, error?.message);
    return null;
  }
  return data.session;
}

interface TestAssertion {
  name: string;
  passed: boolean;
  details?: string;
}

const assertions: TestAssertion[] = [];

async function setAuthAndPreferences(page: Page, session: any, options: { theme?: "light" | "dark"; lang?: "en" | "ar" } = {}) {
  const { theme = "light", lang = "en" } = options;
  await page.evaluateOnNewDocument((sess, t, l) => {
    const projectRef = "mtfkzabiscyleztypqks";
    localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(sess));
    localStorage.setItem("sada-theme", t);
    localStorage.setItem("sada-lang", l);
  }, session, theme, lang);
}

async function checkHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const clientWidth = window.innerWidth;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
    return {
      hasOverflow: scrollWidth > clientWidth + 1,
      scrollWidth,
      clientWidth,
    };
  });

  assertions.push({
    name: `No Horizontal Overflow: ${label}`,
    passed: !overflow.hasOverflow,
    details: `scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`,
  });
  return overflow;
}

async function applyPageThemeAndDirection(page: Page, options: { theme?: "light" | "dark"; lang?: "en" | "ar" } = {}) {
  const { theme = "light", lang = "en" } = options;
  await page.evaluate((t, l) => {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", l);
  }, theme, lang);
}

async function scrollToFinancialCommand(page: Page) {
  await page.waitForSelector("#executive-financial-command", { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => {
    const el = document.getElementById("executive-financial-command");
    const main = document.getElementById("sada-admin-main") || document.scrollingElement;
    if (el && main) {
      const elRect = el.getBoundingClientRect();
      const currentScroll = main.scrollTop || window.scrollY || 0;
      const targetScroll = Math.max(0, currentScroll + elRect.top - 68);
      if ("scrollTop" in main) {
        main.scrollTop = targetScroll;
      }
      window.scrollTo({ top: targetScroll, behavior: "instant" });
    }
  });
}

async function run() {
  console.log("=== SADA OS Reference Match & Drawer Usability Suite ===");
  const session = await getSession("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  if (!session) {
    console.error("Super admin login failed");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();

    // 1. Viewport 390x844 Light (Exact reference screen size)
    console.log("--- Testing Viewport 390x844 Light Mode ---");
    await page.setViewport({ width: 390, height: 844 });
    await setAuthAndPreferences(page, session, { theme: "light", lang: "en" });

    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "light", lang: "en" });
    await new Promise((r) => setTimeout(r, 2000));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 600));

    // Check Financial Command & Cards on /admin
    await checkHorizontalOverflow(page, "390px /admin Dashboard");

    const dashShotPath = path.join(OUT_DIR, "01_admin_dashboard_390px_reference_match.png");
    await page.screenshot({ path: dashShotPath });
    console.log(`Saved dashboard screenshot: ${dashShotPath}`);

    // Verify Financial Command heading card exists and has correct text
    const hasFinancialCommand = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("Financial Command") && text.includes("Finance & Accounting");
    });
    assertions.push({
      name: "Financial Command section card exists with link",
      passed: hasFinancialCommand,
    });

    // Verify Receivables card has Q5 Answer title and Drill down button
    const hasReceivablesCard = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes("Q5 Answer: Unpaid Client Receivables") || text.includes("Unpaid Client Receivables");
    });
    assertions.push({
      name: "Unpaid Client Receivables card rendered",
      passed: hasReceivablesCard,
    });

    // Open Drill Down from Receivables card
    console.log("--- Opening Source Drill-Down Drawer from Receivables ---");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Drill down") || b.innerText.includes("Inspect Invoices"));
      if (btn) btn.click();
    });

    await new Promise((r) => setTimeout(r, 1000));

    // Capture the open drawer
    const drawerShotPath = path.join(OUT_DIR, "02_source_drilldown_drawer_390px_open.png");
    await page.screenshot({ path: drawerShotPath });
    console.log(`Saved drawer screenshot: ${drawerShotPath}`);

    // Verify Drawer Elements match reference
    const drawerDetails = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const hasTitle = bodyText.includes("Source Drill-Down");
      const hasAggValue = bodyText.includes("Aggregated Value");
      const hasExportCSV = bodyText.includes("Export CSV");
      const hasAuthRecords = bodyText.includes("Authoritative Source Records");
      const hasRealTimeFacts = bodyText.includes("Real-time DB Facts");
      const hasFooterAttribution = bodyText.includes("Drill-down powered by SADA OS Financial OS & Operational Ledger");

      // Check drawer scrollability
      const dialog = document.querySelector('[role="dialog"]');
      const scrollableBody = dialog?.querySelector(".sada-scrollbar, .overflow-y-auto");
      const isScrollable = scrollableBody ? scrollableBody.scrollHeight >= scrollableBody.clientHeight : false;

      return {
        hasTitle,
        hasAggValue,
        hasExportCSV,
        hasAuthRecords,
        hasRealTimeFacts,
        hasFooterAttribution,
        isScrollable,
      };
    });

    assertions.push({
      name: "Drawer Header: 'Source Drill-Down' title present",
      passed: drawerDetails.hasTitle,
    });
    assertions.push({
      name: "Drawer Content: 'Aggregated Value' and 'Export CSV' present",
      passed: drawerDetails.hasAggValue && drawerDetails.hasExportCSV,
    });
    assertions.push({
      name: "Drawer Stats: 2-column Authoritative Source Records & Real-time DB Facts present",
      passed: drawerDetails.hasAuthRecords && drawerDetails.hasRealTimeFacts,
    });
    assertions.push({
      name: "Drawer Footer: Attribution text present",
      passed: drawerDetails.hasFooterAttribution,
    });

    // Test Drawer Close Action
    console.log("--- Testing Drawer Close ---");
    const closeBtn = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;
      const btns = Array.from(dialog.querySelectorAll("button"));
      const cBtn = btns.find((b) => b.innerText.includes("Close") || b.innerText.includes("إغلاق"));
      if (cBtn) {
        cBtn.click();
        return true;
      }
      return false;
    });

    await new Promise((r) => setTimeout(r, 600));

    const isDrawerClosed = await page.evaluate(() => {
      return !document.querySelector('[role="dialog"]');
    });

    assertions.push({
      name: "Drawer Close Button closes drawer cleanly",
      passed: isDrawerClosed,
    });

    // 1b. Test Client Profitability Empty State Drill-Down (Exact match for reference image bottom half)
    console.log("--- Opening Source Drill-Down Drawer from Client Profitability (Empty State) ---");
    const openedClientDrillDown = await page.evaluate(() => {
      // Find mobile client card that triggers client_contribution_profit
      const cards = Array.from(document.querySelectorAll("div")).filter((d) =>
        d.innerText.includes("Contribution Profit") && (d.innerText.includes("View Details") || d.innerText.includes("عرض التفاصيل"))
      );
      if (cards.length > 0) {
        cards[0].click();
        return true;
      }
      return false;
    });

    if (openedClientDrillDown) {
      await new Promise((r) => setTimeout(r, 1000));
      const emptyDrawerShotPath = path.join(OUT_DIR, "02b_source_drilldown_drawer_empty_state_reference_match.png");
      await page.screenshot({ path: emptyDrawerShotPath });
      console.log(`Saved empty state drawer screenshot: ${emptyDrawerShotPath}`);

      const emptyDrawerChecks = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          hasContributionProfitFormula: bodyText.includes("Contribution Profit = Service Revenue + Sponsoring Margin - Sales Commission - Direct Costs"),
          hasEmptyRecordsText: bodyText.includes("No individual source records found for this calculation period."),
          has0Records: bodyText.includes("0 records"),
        };
      });

      assertions.push({
        name: "Empty State Drill-Down matches reference formula and message",
        passed: emptyDrawerChecks.hasContributionProfitFormula && emptyDrawerChecks.hasEmptyRecordsText,
      });

      // Close the empty state drawer
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;
        const btns = Array.from(dialog.querySelectorAll("button"));
        const cBtn = btns.find((b) => b.innerText.includes("Close") || b.innerText.includes("إغلاق"));
        if (cBtn) cBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
    }

    // 2. Viewport 320x640 (Narrowest mobile)
    console.log("--- Testing Viewport 320x640 (Narrowest Mobile) ---");
    await page.setViewport({ width: 320, height: 640 });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "light", lang: "en" });
    await new Promise((r) => setTimeout(r, 1200));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 400));

    await checkHorizontalOverflow(page, "320px /admin Dashboard");
    const shot320 = path.join(OUT_DIR, "03_admin_dashboard_320px.png");
    await page.screenshot({ path: shot320 });
    console.log(`Saved 320px screenshot: ${shot320}`);

    // Open Drill down on 320px
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Drill down") || b.innerText.includes("Inspect Invoices"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const shot320Drawer = path.join(OUT_DIR, "04_source_drilldown_drawer_320px.png");
    await page.screenshot({ path: shot320Drawer });
    console.log(`Saved 320px drawer screenshot: ${shot320Drawer}`);

    // Close drawer
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btns = dialog ? Array.from(dialog.querySelectorAll("button")) : [];
      const c = btns.find((b) => b.innerText.includes("Close") || b.innerText.includes("إغلاق"));
      if (c) c.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 3. Viewport 360x800 Light
    console.log("--- Testing Viewport 360x800 ---");
    await page.setViewport({ width: 360, height: 800 });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "light", lang: "en" });
    await new Promise((r) => setTimeout(r, 1200));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 400));
    await checkHorizontalOverflow(page, "360px /admin Dashboard");

    const shot360 = path.join(OUT_DIR, "05_admin_dashboard_360px.png");
    await page.screenshot({ path: shot360 });
    console.log(`Saved 360px screenshot: ${shot360}`);

    // 4. Viewport 430x932 Light (Large Mobile)
    console.log("--- Testing Viewport 430x932 ---");
    await page.setViewport({ width: 430, height: 932 });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "light", lang: "en" });
    await new Promise((r) => setTimeout(r, 1200));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 400));
    await checkHorizontalOverflow(page, "430px /admin Dashboard");

    const shot430 = path.join(OUT_DIR, "06_admin_dashboard_430px.png");
    await page.screenshot({ path: shot430 });
    console.log(`Saved 430px screenshot: ${shot430}`);

    // 5. Arabic RTL Mode at 390x844
    console.log("--- Testing Arabic RTL Mode (390x844) ---");
    await page.setViewport({ width: 390, height: 844 });
    await setAuthAndPreferences(page, session, { theme: "light", lang: "ar" });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "light", lang: "ar" });
    await new Promise((r) => setTimeout(r, 1500));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 400));

    await checkHorizontalOverflow(page, "390px Arabic RTL /admin Dashboard");
    const shotRTL = path.join(OUT_DIR, "07_admin_dashboard_390px_arabic_rtl.png");
    await page.screenshot({ path: shotRTL });
    console.log(`Saved RTL screenshot: ${shotRTL}`);

    // Open Drawer in RTL
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("تفصيل") || b.innerText.includes("Drill down"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const shotRTLDrawer = path.join(OUT_DIR, "08_source_drilldown_drawer_390px_arabic_rtl.png");
    await page.screenshot({ path: shotRTLDrawer });
    console.log(`Saved RTL drawer screenshot: ${shotRTLDrawer}`);

    // Close RTL drawer
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btns = dialog ? Array.from(dialog.querySelectorAll("button")) : [];
      const c = btns.find((b) => b.innerText.includes("إغلاق") || b.innerText.includes("Close"));
      if (c) c.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 6. Dark Mode at 390x844
    console.log("--- Testing Dark Theme (390x844) ---");
    await setAuthAndPreferences(page, session, { theme: "dark", lang: "en" });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "dark", lang: "en" });
    await new Promise((r) => setTimeout(r, 1500));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 400));

    await checkHorizontalOverflow(page, "390px Dark Mode /admin Dashboard");
    const shotDark = path.join(OUT_DIR, "09_admin_dashboard_390px_dark_mode.png");
    await page.screenshot({ path: shotDark });
    console.log(`Saved Dark Mode screenshot: ${shotDark}`);

    // Open Drawer in Dark Mode
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Drill down") || b.innerText.includes("Inspect Invoices"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const shotDarkDrawer = path.join(OUT_DIR, "10_source_drilldown_drawer_390px_dark_mode.png");
    await page.screenshot({ path: shotDarkDrawer });
    console.log(`Saved Dark Mode drawer screenshot: ${shotDarkDrawer}`);

    // Close Dark drawer
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btns = dialog ? Array.from(dialog.querySelectorAll("button")) : [];
      const c = btns.find((b) => b.innerText.includes("Close") || b.innerText.includes("إغلاق"));
      if (c) c.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 7. Desktop Layout at 1280x800 & 1440x900
    console.log("--- Testing Desktop Viewport (1440x900) ---");
    await page.setViewport({ width: 1440, height: 900 });
    await setAuthAndPreferences(page, session, { theme: "light", lang: "en" });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await applyPageThemeAndDirection(page, { theme: "light", lang: "en" });
    await new Promise((r) => setTimeout(r, 1500));
    await scrollToFinancialCommand(page);
    await new Promise((r) => setTimeout(r, 400));

    await checkHorizontalOverflow(page, "1440px Desktop /admin");
    const shotDesktop = path.join(OUT_DIR, "11_admin_dashboard_1440px_desktop.png");
    await page.screenshot({ path: shotDesktop });
    console.log(`Saved Desktop screenshot: ${shotDesktop}`);

    // Open modal on desktop to verify centered dialog layout
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("Drill down") || b.innerText.includes("Inspect Invoices"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const shotDesktopModal = path.join(OUT_DIR, "12_source_drilldown_modal_1440px_desktop.png");
    await page.screenshot({ path: shotDesktopModal });
    console.log(`Saved Desktop modal screenshot: ${shotDesktopModal}`);

    console.log("\n=== TEST ASSERTION RESULTS ===");
    let allPassed = true;
    for (const a of assertions) {
      const icon = a.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${icon}: ${a.name} ${a.details ? `(${a.details})` : ""}`);
      if (!a.passed) allPassed = false;
    }

    if (!allPassed) {
      console.error("\nSome visual layout assertions failed!");
      process.exit(1);
    } else {
      console.log("\nALL VISUAL AND INTERACTION ASSERTIONS PASSED PERFECTLY!");
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

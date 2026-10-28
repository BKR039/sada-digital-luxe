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
const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

const VIEWPORTS = [
  { name: "desktop_1440x900", width: 1440, height: 900, isMobile: false },
  { name: "desktop_1280x800", width: 1280, height: 800, isMobile: false },
  { name: "tablet_1024x768", width: 1024, height: 768, isMobile: false },
  { name: "tablet_portrait_768x1024", width: 768, height: 1024, isMobile: false },
  { name: "mobile_390x844", width: 390, height: 844, isMobile: true },
  { name: "compact_mobile_375x667", width: 375, height: 667, isMobile: true },
];

const SECTIONS = [
  { id: "overview-section", label: "Overview 360" },
  { id: "services-section", label: "Services & Package" },
  { id: "delivery-section", label: "Delivery Center" },
  { id: "team-section", label: "Team & Work" },
  { id: "financial-section", label: "Financial & Ads" },
  { id: "memory-section", label: "Client Memory" },
  { id: "history-section", label: "Work History" },
];

async function main() {
  console.log("===============================================================");
  console.log("SADA OS — CLIENT 360 STICKY NAVIGATION ACCEPTANCE SUITE");
  console.log("===============================================================");

  const screenshotsDir = path.resolve(process.cwd(), "scripts", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr || !authData.session) throw new Error(`Auth error: ${authErr?.message}`);

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1);
  const clientId = clients![0].id;
  console.log(`Auditing Client Workspace: ${clients![0].name} (${clientId})`);

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page: Page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  const resultsSummary: any[] = [];

  // Test across all 6 viewports
  for (const vp of VIEWPORTS) {
    console.log(`\n===============================================================`);
    console.log(`AUDITING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`===============================================================`);

    await page.setViewport({ width: vp.width, height: vp.height });
    await page.evaluate(
      ({ s, k }) => {
        localStorage.setItem(k, JSON.stringify(s));
        localStorage.setItem("sada-lang", "en");
        localStorage.setItem("sada-theme", "dark");
      },
      { s: authData.session, k: storageKey }
    );

    await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, {
      waitUntil: "networkidle2",
    });
    await new Promise((r) => setTimeout(r, 1200));

    // 1. Initial State Measurement
    const initialNavData = await page.evaluate(() => {
      const nav = (document.querySelector("#client-360-nav-wrapper") ||
        document.querySelector("[data-testid='client-360-sticky-nav']")) as HTMLElement;
      const main = document.querySelector("#sada-admin-main") as HTMLElement;
      if (!nav || !main) return null;
      const rect = nav.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        width: rect.width,
        mainScrollTop: main.scrollTop,
      };
    });

    if (!initialNavData) throw new Error(`Navigation element not found in ${vp.name}`);
    console.log(`Initial Nav Position (Scroll 0): top=${initialNavData.top}px, height=${initialNavData.height}px`);

    // Capture initial screenshot
    const initScreenshot = path.join(screenshotsDir, `client360_nav_${vp.name}_scroll0.png`);
    await page.screenshot({ path: initScreenshot });

    // 2. Scroll Stability Test across 100px, 300px, 600px
    const scrollStability: any[] = [];
    for (const offset of [100, 300, 600]) {
      await page.evaluate((amt) => {
        const main = document.querySelector("#sada-admin-main") as HTMLElement;
        if (main) main.scrollTop = amt;
      }, offset);

      await new Promise((r) => setTimeout(r, 150));

      const navAfter = await page.evaluate(() => {
        const nav = (document.querySelector("#client-360-nav-wrapper") ||
          document.querySelector("[data-testid='client-360-sticky-nav']")) as HTMLElement;
        const main = document.querySelector("#sada-admin-main") as HTMLElement;
        const rect = nav.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          scrollTop: main?.scrollTop,
        };
      });

      const deviation = Math.abs(navAfter.top - initialNavData.top);
      scrollStability.push({
        offset,
        navTop: navAfter.top,
        deviation,
        passed: deviation <= 2.0,
      });

      console.log(
        `Scroll ${offset}px: navTop=${navAfter.top}px, initialTop=${initialNavData.top}px, dev=${deviation}px -> ${deviation <= 2 ? "PASS (<=2px)" : "FAIL"}`
      );
      if (deviation > 2.0) {
        throw new Error(`Stability failure at ${offset}px on ${vp.name}: deviation ${deviation}px > 2px`);
      }
    }

    // Capture scrolled screenshot
    const scrolledScreenshot = path.join(screenshotsDir, `client360_nav_${vp.name}_scroll600.png`);
    await page.screenshot({ path: scrolledScreenshot });

    // 3. Section Navigation Item Click & Clearance Assertions
    console.log(`\nTesting All 7 Section Tabs Click & Clearance for ${vp.name}:`);
    const sectionResults: any[] = [];
    for (const sec of SECTIONS) {
      await page.evaluate((sId) => {
        const btn = document.querySelector(`button[data-section-tab="${sId}"]`) as HTMLElement;
        if (btn) btn.click();
      }, sec.id);

      // Wait for smooth scroll
      await new Promise((r) => setTimeout(r, 700));

      const sectionAudit = await page.evaluate((sId) => {
        const nav = (document.querySelector("#client-360-nav-wrapper") ||
          document.querySelector("[data-testid='client-360-sticky-nav']")) as HTMLElement;
        const secEl = document.getElementById(sId);
        if (!secEl || !nav) return null;

        const navRect = nav.getBoundingClientRect();
        const h2 = secEl.querySelector("h2") || secEl.querySelector("h1");
        const headingRect = h2 ? h2.getBoundingClientRect() : secEl.getBoundingClientRect();

        const gap = headingRect.top - navRect.bottom;
        const isCovered = headingRect.top < navRect.bottom;

        return {
          navBottom: navRect.bottom,
          headingTop: headingRect.top,
          gap,
          isCovered,
        };
      }, sec.id);

      if (!sectionAudit) throw new Error(`Section audit failed for ${sec.id}`);

      const pass = sectionAudit.gap >= 12.0 && !sectionAudit.isCovered;
      console.log(
        `  Tab [${sec.label}]: navBottom=${sectionAudit.navBottom.toFixed(1)}px, headingTop=${sectionAudit.headingTop.toFixed(1)}px, gap=${sectionAudit.gap.toFixed(1)}px (>=12px), covered=${sectionAudit.isCovered} -> ${pass ? "PASS" : "FAIL"}`
      );
      if (!pass) {
        throw new Error(`Clearance failure for ${sec.label} on ${vp.name}: gap=${sectionAudit.gap}px`);
      }

      sectionResults.push({
        section: sec.label,
        gap: sectionAudit.gap,
        isCovered: sectionAudit.isCovered,
      });
    }

    // Reset scroll to 0
    await page.evaluate(() => {
      const main = document.querySelector("#sada-admin-main") as HTMLElement;
      if (main) main.scrollTop = 0;
    });
    await new Promise((r) => setTimeout(r, 300));

    resultsSummary.push({
      viewport: vp.name,
      initialNavTop: initialNavData.top,
      scrollStability,
      sectionResults,
    });
  }

  // 4. Test Arabic RTL & Light Mode
  console.log(`\n===============================================================`);
  console.log(`TESTING ARABIC RTL & LIGHT THEME VERIFICATION`);
  console.log(`===============================================================`);

  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(
    ({ s, k }) => {
      localStorage.setItem(k, JSON.stringify(s));
      localStorage.setItem("sada-lang", "ar");
      localStorage.setItem("sada-theme", "light");
    },
    { s: authData.session, k: storageKey }
  );

  await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, {
    waitUntil: "networkidle2",
  });
  await new Promise((r) => setTimeout(r, 1200));

  const rtlInitialNav = await page.evaluate(() => {
    const nav = document.querySelector("#client-360-nav-wrapper") as HTMLElement;
    const isRtl = document.documentElement.dir === "rtl" || document.body.dir === "rtl";
    const rect = nav.getBoundingClientRect();
    return { isRtl, top: rect.top, bottom: rect.bottom, height: rect.height };
  });

  console.log("Arabic RTL Nav:", JSON.stringify(rtlInitialNav, null, 2));

  // Scroll 300px in RTL
  await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main") as HTMLElement;
    if (main) main.scrollTop = 300;
  });
  await new Promise((r) => setTimeout(r, 150));

  const rtlScrolledNav = await page.evaluate(() => {
    const nav = document.querySelector("#client-360-nav-wrapper") as HTMLElement;
    const rect = nav.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
  });

  const rtlDev = Math.abs(rtlScrolledNav.top - rtlInitialNav.top);
  console.log(`Arabic RTL Scroll 300px dev: ${rtlDev}px (Tolerance <= 2px) -> ${rtlDev <= 2 ? "PASS" : "FAIL"}`);
  if (rtlDev > 2.0) throw new Error("RTL stability test failed!");

  const rtlScreenshot = path.join(screenshotsDir, `client360_nav_arabic_rtl_light.png`);
  await page.screenshot({ path: rtlScreenshot });

  console.log(`\nConsole Errors count: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log("Console Errors:", consoleErrors);
  }

  console.log("\n===============================================================");
  console.log("ALL REAL BROWSER ACCEPTANCE TESTS PASSED ACCROSS ALL VIEWPORTS!");
  console.log("===============================================================");
  console.log(JSON.stringify(resultsSummary, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error("ACCEPTANCE TEST FAILED:", err);
  process.exit(1);
});

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
const supabase = createClient(supabaseUrl, anonKey);

const BASE_URL = "http://localhost:3000";
const SHOTS_DIR = path.resolve(process.cwd(), "docs/audit/mvp/screenshots");

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function runBrowserQA() {
  console.log("==================================================================");
  console.log("SADA OS — Phase 2B Browser Responsive QA & Visual Capture");
  console.log("==================================================================\n");

  console.log("Authenticating as QA Super Admin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authError || !authData.session) {
    console.error("Auth failed:", authError);
    process.exit(1);
  }
  console.log("Authenticated. Launching Google Chrome via puppeteer-core...");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1280,900"],
  });

  const page = await browser.newPage();

  // Storage key deduction
  const projectRef = supabaseUrl.split("//")[1]?.split(".")[0] || "mtfkzabiscyleztypqks";
  const storageKey = `sb-${projectRef}-auth-token`;

  console.log(`Setting up local storage session (key: ${storageKey})...`);
  await page.evaluateOnNewDocument(
    ({ sessionData, storageKey }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "dark");
      sessionStorage.setItem("sada_dashboard_scope", "executive_command");
      if (sessionData) {
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
        localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
      }
    },
    { sessionData: authData.session, storageKey }
  );

  const viewports = [
    { name: "desktop_1280", width: 1280, height: 800, file: "ecc_phase2b_desktop_dark_en.png" },
    { name: "tablet_768", width: 768, height: 1024, file: "ecc_phase2b_tablet_768.png" },
    { name: "mobile_430", width: 430, height: 932, file: "ecc_phase2b_mobile_430.png" },
    { name: "mobile_390", width: 390, height: 844, file: "ecc_phase2b_mobile_390.png" },
    { name: "mobile_375", width: 375, height: 812, file: "ecc_phase2b_mobile_375.png" },
    { name: "mobile_320", width: 320, height: 640, file: "ecc_phase2b_mobile_320.png" },
  ];

  // 1. Initial Desktop Load
  console.log("\n[1] Navigating to http://localhost:3000/admin (Desktop 1280x800)...");
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2", timeout: 30000 });

  // Ensure Executive Command scope is active
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const cmdBtn = buttons.find((b) => b.innerText.includes("Command") && !b.innerText.includes("Financial"));
    if (cmdBtn) cmdBtn.click();
  });

  // Wait for Executive Command Center metrics to render
  try {
    await page.waitForFunction(
      () =>
        document.body.innerText.includes("Recognized Revenue") ||
        document.body.innerText.includes("Liquid Treasury") ||
        document.body.innerText.includes("88,200"),
      { timeout: 15000 }
    );
  } catch {
    console.log("Waiting for selector fallback...");
  }

  // Small delay for animations/renders to settle
  await new Promise((r) => setTimeout(r, 2000));

  // Extract page content metrics
  const desktopMetrics = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasRecognizedRev = text.includes("3,000") || text.includes("3000");
    const hasMoMDelta = text.includes("-73.9%") || text.includes("-74%") || text.includes("73.9%");
    const hasLiquidTreasury = text.includes("88,200") || text.includes("88200");
    const hasRunway = text.includes("36.8");
    const hasReceivables = text.includes("2,300") || text.includes("2300");
    const hasActiveProjects = text.includes("24");
    const hasOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;

    return {
      hasRecognizedRev,
      hasMoMDelta,
      hasLiquidTreasury,
      hasRunway,
      hasReceivables,
      hasActiveProjects,
      hasOverflow,
      url: window.location.href,
    };
  });

  console.log("Desktop Metrics Observed:", desktopMetrics);

  const desktopPath = path.join(SHOTS_DIR, "ecc_phase2b_desktop_dark_en.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  console.log(`Saved screenshot: ${desktopPath}`);

  // 2. Financial Command Tab
  console.log("\n[2] Testing Financial Command Tab...");
  try {
    const financeTabClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const btn = buttons.find((b) => b.innerText.includes("Financial Command") || b.innerText.includes("المالي"));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (financeTabClicked) {
      await new Promise((r) => setTimeout(r, 1500));
      const finPath = path.join(SHOTS_DIR, "ecc_phase2b_desktop_financial.png");
      await page.screenshot({ path: finPath, fullPage: false });
      console.log(`Saved screenshot: ${finPath}`);
    }
  } catch (err) {
    console.warn("Could not click Financial Command tab:", err);
  }

  // 3. Light Mode
  console.log("\n[3] Testing Light Mode (1280x800)...");
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    localStorage.setItem("sada-theme", "light");
  });
  await new Promise((r) => setTimeout(r, 800));
  const lightPath = path.join(SHOTS_DIR, "ecc_phase2b_desktop_light.png");
  await page.screenshot({ path: lightPath, fullPage: false });
  console.log(`Saved screenshot: ${lightPath}`);

  // Revert back to Dark Mode
  await page.evaluate(() => {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    localStorage.setItem("sada-theme", "dark");
  });

  // 4. Arabic RTL
  console.log("\n[4] Testing Arabic RTL Mode (1280x800)...");
  await page.evaluate(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
    localStorage.setItem("sada-lang", "ar");
    sessionStorage.setItem("sada_dashboard_scope", "executive_command");
  });
  await page.reload({ waitUntil: "networkidle2" });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const cmdBtn = buttons.find((b) => (b.innerText.includes("Command") || b.innerText.includes("القيادة") || b.innerText.includes("التحكم")) && !b.innerText.includes("Financial"));
    if (cmdBtn) cmdBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  const rtlPath = path.join(SHOTS_DIR, "ecc_phase2b_desktop_rtl.png");
  await page.screenshot({ path: rtlPath, fullPage: false });
  console.log(`Saved screenshot: ${rtlPath}`);

  // Revert back to English LTR
  await page.evaluate(() => {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", "en");
    localStorage.setItem("sada-lang", "en");
    sessionStorage.setItem("sada_dashboard_scope", "executive_command");
  });
  await page.reload({ waitUntil: "networkidle2" });
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const cmdBtn = buttons.find((b) => b.innerText.includes("Command") && !b.innerText.includes("Financial"));
    if (cmdBtn) cmdBtn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));

  // 5. Responsive Viewports
  console.log("\n[5] Testing Responsive Viewports...");
  const responsiveResults: Record<string, boolean> = {};

  for (const vp of viewports.slice(1)) {
    console.log(`Testing viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise((r) => setTimeout(r, 1200));

    const overflowCheck = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    responsiveResults[vp.name] = !overflowCheck;
    console.log(`  Horizontal overflow: ${overflowCheck ? "DETECTED (FAIL)" : "NONE (PASS)"}`);

    const shotPath = path.join(SHOTS_DIR, vp.file);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  Saved screenshot: ${shotPath}`);
  }

  await browser.close();

  console.log("\n==================================================================");
  console.log("BROWSER RESPONSIVE QA SUMMARY");
  console.log("==================================================================");
  console.log("Desktop Metrics Verified:", desktopMetrics);
  console.log("Responsive Viewport Results:", responsiveResults);
  console.log("Screenshots captured in docs/audit/mvp/screenshots/");
  console.log("==================================================================\n");
}

runBrowserQA().catch((err) => {
  console.error("FATAL ERROR in runBrowserQA:", err);
  process.exit(1);
});

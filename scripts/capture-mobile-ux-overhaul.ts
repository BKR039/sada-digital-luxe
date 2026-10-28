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

async function injectSession(page: any, email: string, pass: string) {
  const { data } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (data?.session) {
    await page.evaluate((sessionData: any) => {
      const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    }, data.session);
  }
}

async function runMobileUxOverhaulCapture() {
  const outputDir = path.resolve(process.cwd(), "scripts", "screenshots", "mobile_ux_audit", "overhaul");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const viewports = [
      { width: 320, height: 640, label: "320x640" },
      { width: 360, height: 800, label: "360x800" },
      { width: 390, height: 844, label: "390x844" },
    ];

    // ==============================================================
    // 1. CAPTURE /admin/analytics (Client Profitability & Overview)
    // ==============================================================
    for (const vp of viewports) {
      console.log(`\n--- Capturing Analytics at ${vp.label} ---`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true });

      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
      await injectSession(page, "qa.superadmin@sada.agency", "SuperAdminPassword123!");

      // 1A. Analytics Tab 0 (Overview with Financial Trends & Expense Breakdown)
      await page.goto("http://localhost:3000/admin/analytics", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[role='tab']", { timeout: 20000 });
      await new Promise(r => setTimeout(r, 1200));

      const overviewPath = path.join(outputDir, `${vp.label}_analytics_overview.png`);
      await page.screenshot({ path: overviewPath });
      console.log(`✓ Saved ${overviewPath}`);

      // Scroll to Financial Trends Chart & Expense Breakdown
      await page.evaluate(() => {
        window.scrollBy({ top: 400, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 800));
      const chartsPath = path.join(outputDir, `${vp.label}_analytics_charts.png`);
      await page.screenshot({ path: chartsPath });
      console.log(`✓ Saved ${chartsPath}`);

      // 1B. Analytics Tab 1 (Client Profitability)
      console.log(`Clicking Client Profitability tab at ${vp.label}...`);
      const tabHandles = await page.$$("[role='tab']");
      for (const tab of tabHandles) {
        const text = await page.evaluate(el => el.innerText, tab);
        if (text.includes("Client Profitability") || text.includes("ربحية العملاء")) {
          await tab.click();
          break;
        }
      }

      await new Promise(r => setTimeout(r, 1200));
      const cpTopPath = path.join(outputDir, `${vp.label}_client_profitability_kpis.png`);
      await page.screenshot({ path: cpTopPath });
      console.log(`✓ Saved ${cpTopPath}`);

      // Scroll to Client Profitability Mobile Record Cards
      await page.evaluate(() => {
        window.scrollBy({ top: 380, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 800));
      const cpCardsPath = path.join(outputDir, `${vp.label}_client_profitability_cards.png`);
      await page.screenshot({ path: cpCardsPath });
      console.log(`✓ Saved ${cpCardsPath}`);

      await page.close();
    }

    // ==============================================================
    // 2. CAPTURE /admin Executive Command Center at 320, 360, 390
    // ==============================================================
    for (const vp of viewports) {
      console.log(`\n--- Capturing Executive Command Center at ${vp.label} ---`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true });

      await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
      await injectSession(page, "qa.superadmin@sada.agency", "SuperAdminPassword123!");

      await page.goto("http://localhost:3000/admin", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("h1, h2", { timeout: 20000 });
      await new Promise(r => setTimeout(r, 1200));

      const adminPath = path.join(outputDir, `${vp.label}_admin_executive.png`);
      await page.screenshot({ path: adminPath });
      console.log(`✓ Saved ${adminPath}`);

      await page.close();
    }

    console.log("\nAll mobile overhaul screenshots captured successfully!");
  } finally {
    await browser.close();
  }
}

runMobileUxOverhaulCapture().catch(err => {
  console.error("Capture script failed:", err);
  process.exit(1);
});

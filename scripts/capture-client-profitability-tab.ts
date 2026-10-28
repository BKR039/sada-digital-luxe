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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (data?.session) {
    await page.evaluate((sessionData: any) => {
      const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
    }, data.session);
  }
}

async function captureClientProfitabilityAndMobile() {
  const screenshotsDir = path.resolve(process.cwd(), "scripts", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    // -------------------------------------------------------------
    // PART 1: Client Profitability Tab on Desktop
    // -------------------------------------------------------------
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log("1. Navigating to base URL...");
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await injectSession(page, "qa.superadmin@sada.agency", "SuperAdminPassword123!");

    console.log("2. Navigating to /admin/analytics...");
    await page.goto("http://localhost:3000/admin/analytics", { waitUntil: "domcontentloaded" });

    // Wait for the tab strip to mount
    console.log("3. Waiting for tab strip...");
    await page.waitForSelector("[role='tab']", { timeout: 25000 });
    
    console.log("4. Clicking Client Profitability tab via native CDP click...");
    const tabHandles = await page.$$("[role='tab']");
    for (const tab of tabHandles) {
      const text = await page.evaluate(el => el.innerText, tab);
      if (text.includes("Client Profitability") || text.includes("ربحية العملاء")) {
        console.log(`Found tab: "${text}", clicking...`);
        await tab.click();
        break;
      }
    }
    
    // Wait for table to render
    await page.waitForSelector('table', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll table into view
    await page.evaluate(() => {
      const table = document.querySelector('table');
      if (table) table.scrollIntoView({ behavior: "instant", block: "center" });
    });
    await new Promise(r => setTimeout(r, 800));

    const cpScreenshotPath = path.join(screenshotsDir, "analytics_client_profitability_verified.png");
    await page.screenshot({ path: cpScreenshotPath });
    console.log(`✓ Client Profitability screenshot saved: ${cpScreenshotPath}`);

    // -------------------------------------------------------------
    // PART 2: Clean Mobile Viewport (390x844) from the start
    // -------------------------------------------------------------
    console.log("5. Opening new mobile page (390x844)...");
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true });
    
    await mobilePage.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
    await injectSession(mobilePage, "qa.superadmin@sada.agency", "SuperAdminPassword123!");

    await mobilePage.goto("http://localhost:3000/admin/analytics", { waitUntil: "domcontentloaded" });
    await mobilePage.waitForSelector('h1', { timeout: 25000 });
    // Wait for KPI cards to mount
    await mobilePage.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("Recognized Revenue") || text.includes("Cash Collected") || text.includes("Net Profit");
    }, { timeout: 15000 }).catch(() => null);

    await new Promise(r => setTimeout(r, 1500));

    const mobileScreenshotPath = path.join(screenshotsDir, "analytics_mobile_verified.png");
    await mobilePage.screenshot({ path: mobileScreenshotPath });
    console.log(`✓ Mobile screenshot saved: ${mobileScreenshotPath}`);

  } finally {
    await browser.close();
  }
}

captureClientProfitabilityAndMobile().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});

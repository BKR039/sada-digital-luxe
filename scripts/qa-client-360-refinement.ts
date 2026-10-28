import puppeteer, { type Browser } from "puppeteer-core";
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
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\3bc6394f-3e07-411b-9b48-e1f05f6b43da\\screenshots";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function getAdminSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.error("Auth failed:", error?.message);
    return null;
  }
  return data.session;
}

async function run() {
  console.log("=== SADA CLIENT 360 COMPREHENSIVE VISUAL QA ===");
  const session = await getAdminSession();
  if (!session) {
    console.error("Could not obtain admin session");
    process.exit(1);
  }

  const monthlyClientId = "680cf516-4927-4376-9dd9-b76f3494c30b"; // Jannat Sahara
  const oneOffClientId = "68bb50df-cd4c-4782-a3cb-352dba438516"; // Phase D Client

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Helper to establish session and theme
  const prepareSession = async (theme: "dark" | "light", lang: "en" | "ar", width: number, height: number) => {
    await page.setViewport({ width, height });
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ sessionData, storageKey, th, lg }) => {
        localStorage.setItem("sada-lang", lg);
        localStorage.setItem("sada-theme", th);
        if (sessionData) {
          localStorage.setItem(storageKey, JSON.stringify(sessionData));
        }
      },
      {
        sessionData: session,
        storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
        th: theme,
        lg: lang,
      }
    );
  };

  const testMatrix = [
    // 1. Desktop 1440x900 - Monthly Retainer - Dark - Arabic RTL
    { name: "01_desktop_1440_monthly_dark_ar", clientId: monthlyClientId, theme: "dark" as const, lang: "ar" as const, w: 1440, h: 900 },
    // 2. Desktop 1440x900 - Monthly Retainer - Light - English LTR
    { name: "02_desktop_1440_monthly_light_en", clientId: monthlyClientId, theme: "light" as const, lang: "en" as const, w: 1440, h: 900 },
    // 3. Desktop 1280x800 - One-Off Engagement - Dark - English LTR
    { name: "03_desktop_1280_oneoff_dark_en", clientId: oneOffClientId, theme: "dark" as const, lang: "en" as const, w: 1280, h: 800 },
    // 4. Tablet 1024x768 - Monthly Retainer - Dark - Arabic RTL
    { name: "04_tablet_1024_monthly_dark_ar", clientId: monthlyClientId, theme: "dark" as const, lang: "ar" as const, w: 1024, h: 768 },
    // 5. Tablet 768x1024 (Portrait) - Monthly Retainer - Light - English LTR
    { name: "05_tablet_768_monthly_light_en", clientId: monthlyClientId, theme: "light" as const, lang: "en" as const, w: 768, h: 1024 },
    // 6. Mobile 390x844 (iPhone 14) - Monthly Retainer - Dark - Arabic RTL
    { name: "06_mobile_390_monthly_dark_ar", clientId: monthlyClientId, theme: "dark" as const, lang: "ar" as const, w: 390, h: 844 },
    // 7. Mobile 375x667 (iPhone SE) - One-Off - Light - English LTR
    { name: "07_mobile_375_oneoff_light_en", clientId: oneOffClientId, theme: "light" as const, lang: "en" as const, w: 375, h: 667 },
  ];

  for (const item of testMatrix) {
    console.log(`Testing: ${item.name} (${item.w}x${item.h}, ${item.theme}, ${item.lang})`);
    await prepareSession(item.theme, item.lang, item.w, item.h);

    await page.goto(`${BASE_URL}/admin/clients/${item.clientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    await new Promise(r => setTimeout(r, 3500));

    // Viewport screenshot (from top: Header + Cockpit + Overview)
    const viewPath = path.join(outputDir, `${item.name}.png`);
    await page.screenshot({ path: viewPath });
    console.log(`  -> Viewport screenshot saved: ${item.name}.png`);

    // In 01_desktop_1440_monthly_dark_ar, scroll to each major section and capture
    if (item.name === "01_desktop_1440_monthly_dark_ar") {
      const sections = [
        { id: "services-section", file: "section_02_services_ledger.png" },
        { id: "delivery-section", file: "section_03_monthly_delivery.png" },
        { id: "team-section", file: "section_04_team_contributors.png" },
        { id: "financial-section", file: "section_05_financial_console.png" },
        { id: "memory-section", file: "section_06_client_memory.png" },
        { id: "history-section", file: "section_07_work_history.png" },
      ];

      for (const sec of sections) {
        await page.evaluate((sId) => {
          const el = document.getElementById(sId);
          if (el) el.scrollIntoView({ behavior: "instant" });
        }, sec.id);
        await new Promise(r => setTimeout(r, 1200));
        await page.screenshot({ path: path.join(outputDir, sec.file) });
        console.log(`  -> Section screenshot saved: ${sec.file}`);
      }
    }
  }

  await browser.close();
  console.log("=== ALL VISUAL QA CAPTURES FINISHED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Visual QA failed:", err);
  process.exit(1);
});

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
const SHOTS_DIR = path.resolve(process.cwd(), "scripts/screenshots/thmanyah_qa");

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function captureScreens() {
  console.log("Acquiring admin session...");
  const { data } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  await page.evaluateOnNewDocument(
    ({ sessionData, storageKey }) => {
      localStorage.setItem("sada-lang", "ar");
      localStorage.setItem("sada-theme", "dark");
      if (sessionData) {
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
      }
    },
    {
      sessionData: data?.session,
      storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
    }
  );

  const targets = [
    { route: "/?lang=ar", name: "01_public_home_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/services?lang=ar", name: "02_public_services_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/pricing?lang=ar", name: "03_public_pricing_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/about?lang=ar", name: "04_public_about_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/sada-os?lang=ar", name: "05_public_sada_os_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin?lang=ar", name: "06_admin_dashboard_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/clients?lang=ar", name: "07_admin_clients_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/sales?lang=ar", name: "08_admin_sales_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/my-work?lang=ar", name: "09_admin_my_work_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/calendar?lang=ar", name: "10_admin_calendar_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/packages?lang=ar", name: "11_admin_packages_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/accounts?lang=ar", name: "12_admin_accounts_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/finance?lang=ar", name: "13_admin_finance_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin/analytics?lang=ar", name: "14_admin_analytics_1440x900.png", vp: { width: 1440, height: 900 } },
    { route: "/admin?lang=ar", name: "15_admin_mobile_390x844.png", vp: { width: 390, height: 844 } },
    { route: "/?lang=ar", name: "16_public_mobile_375x667.png", vp: { width: 375, height: 667 } },
    { route: "/admin?lang=ar", name: "17_admin_mobile_430x932.png", vp: { width: 430, height: 932 } },
  ];

  for (const t of targets) {
    try {
      await page.setViewport(t.vp);
      await page.goto(`${BASE_URL}${t.route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
      // Wait for content rendering
      await new Promise((r) => setTimeout(r, 1600));

      const filePath = path.join(SHOTS_DIR, t.name);
      await page.screenshot({ path: filePath });
      console.log(`Saved screenshot: ${t.name}`);
    } catch (e: any) {
      console.error(`Failed ${t.name}:`, e.message);
    }
  }

  await browser.close();
  console.log("All screenshots captured successfully.");
}

captureScreens().catch(console.error);

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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/step1_2_verification");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getSession(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) return null;
  return data.session;
}

async function main() {
  const session = await getSession("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  if (!session) {
    console.error("Failed to authenticate session");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const projectRef = "mtfkzabiscyleztypqks";
  const storageKey = `sb-${projectRef}-auth-token`;

  try {
    const scenarios = [
      { width: 320, height: 640, label: "320x640_en", lang: "en" },
      { width: 360, height: 800, label: "360x800_en", lang: "en" },
      { width: 390, height: 844, label: "390x844_en", lang: "en" },
      { width: 360, height: 800, label: "360x800_ar", lang: "ar" },
    ];

    for (const sc of scenarios) {
      console.log(`\nTesting ${sc.label} (${sc.lang})...`);
      const page = await browser.newPage();
      await page.setViewport({ width: sc.width, height: sc.height, isMobile: true, hasTouch: true });

      await page.goto(`${BASE_URL}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.evaluate(
        ({ sess, key, lang }) => {
          localStorage.setItem("sada-lang", lang);
          localStorage.setItem("sada_language", lang);
          localStorage.setItem("theme", "dark");
          localStorage.setItem("sada-theme", "dark");
          if (sess) {
            localStorage.setItem(key, JSON.stringify(sess));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
          }
        },
        { sess: session, key: storageKey, lang: sc.lang }
      );

      // 1. Analytics Overview: Executive Command Strip + Financial Trends + Expense Breakdown
      await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await page.waitForSelector("[role='tab']", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 1500));

      // Dismiss toasts
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Screenshot 1: Command Strip
      const shot1 = path.join(OUTPUT_DIR, `${sc.label}_analytics_command_strip.png`);
      await page.screenshot({ path: shot1 });
      console.log(`Saved ${shot1}`);

      // Scroll to Financial Trends Chart & Expense Breakdown
      await page.evaluate(() => {
        const main = document.querySelector("#sada-admin-main");
        if (main) main.scrollBy({ top: 950, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 1000));

      const shot2 = path.join(OUTPUT_DIR, `${sc.label}_analytics_chart_expense.png`);
      await page.screenshot({ path: shot2 });
      console.log(`Saved ${shot2}`);

      // Scroll a bit more to Expense Breakdown Ranking
      await page.evaluate(() => {
        const main = document.querySelector("#sada-admin-main");
        if (main) main.scrollBy({ top: 400, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 800));

      const shot2b = path.join(OUTPUT_DIR, `${sc.label}_analytics_expense_breakdown.png`);
      await page.screenshot({ path: shot2b });
      console.log(`Saved ${shot2b}`);

      // 2. Analytics Tab 1: Client Profitability
      await page.evaluate(() => {
        // Reset scroll to top before clicking tab
        const main = document.querySelector("#sada-admin-main");
        if (main) main.scrollTo({ top: 0, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 500));

      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll("button, [role='tab']")) as HTMLElement[];
        const target = tabs.find(t => t.innerText.includes("Client Profitability") || t.innerText.includes("ربحية"));
        if (target) {
          target.click();
        } else {
          const trigger = document.querySelector('button[value="client_profitability"], [data-value="client_profitability"]') as HTMLElement;
          if (trigger) trigger.click();
        }
      });
      await new Promise(r => setTimeout(r, 1500));

      // Scroll down past the 4 summary KPI cards into the mobile matrix cards
      await page.evaluate(() => {
        const main = document.querySelector("#sada-admin-main");
        if (main) main.scrollBy({ top: 950, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 1000));

      const shot3 = path.join(OUTPUT_DIR, `${sc.label}_analytics_profitability_matrix.png`);
      await page.screenshot({ path: shot3 });
      console.log(`Saved ${shot3}`);

      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

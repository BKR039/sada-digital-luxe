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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/flawless_step1_2");
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
    const testCases = [
      { width: 320, height: 640, lang: "en", name: "320x640_en" },
      { width: 360, height: 800, lang: "en", name: "360x800_en" },
      { width: 390, height: 844, lang: "en", name: "390x844_en" },
      { width: 360, height: 800, lang: "ar", name: "360x800_ar" },
    ];

    for (const tc of testCases) {
      console.log(`\n=== Capturing ${tc.name} (${tc.lang}) ===`);
      const page = await browser.newPage();
      await page.setViewport({ width: tc.width, height: tc.height, isMobile: true, hasTouch: true });

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
        { sess: session, key: storageKey, lang: tc.lang }
      );

      // --- VIEW A: /admin/analytics TAB 0: Chart & Expense Breakdown ---
      await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Scroll to Financial Trends Chart
      await page.evaluate(() => {
        const chart = document.querySelector(".recharts-responsive-container");
        if (chart) {
          const card = chart.closest(".bg-card") || chart;
          card.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      const chartPath = path.join(OUTPUT_DIR, `${tc.name}_trends_chart.png`);
      await page.screenshot({ path: chartPath });
      console.log(`Saved ${chartPath}`);

      // Scroll to Expense Breakdown
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const btn = buttons.find(b => b.innerText.includes("By Category") || b.innerText.includes("حسب الباب"));
        if (btn) {
          const card = btn.closest(".bg-card") || btn;
          card.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      const expensePath = path.join(OUTPUT_DIR, `${tc.name}_expense_breakdown.png`);
      await page.screenshot({ path: expensePath });
      console.log(`Saved ${expensePath}`);

      // --- VIEW B: /admin/analytics TAB 1: Client Profitability ---
      // Click Tab 1
      await page.evaluate(() => {
        const tab = document.querySelector('button[value="client_profitability"]') as HTMLElement;
        if (tab) tab.click();
      });
      await new Promise(r => setTimeout(r, 1200));

      // Scroll to mobile matrix cards
      await page.evaluate(() => {
        const mobileContainer = document.querySelector(".block.md\\:hidden");
        if (mobileContainer) {
          mobileContainer.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      const clientPath = path.join(OUTPUT_DIR, `${tc.name}_client_profitability.png`);
      await page.screenshot({ path: clientPath });
      console.log(`Saved ${clientPath}`);

      // --- VIEW C: /admin/finance: Client Profitability View ---
      await page.goto(`${BASE_URL}/admin/finance`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
        const tab = document.querySelector('button[value="profitability"]') as HTMLElement;
        if (tab) tab.click();
      });
      await new Promise(r => setTimeout(r, 1200));

      // Scroll to mobile matrix cards in finance
      await page.evaluate(() => {
        const mobileContainer = document.querySelector(".block.md\\:hidden");
        if (mobileContainer) {
          mobileContainer.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      const finPath = path.join(OUTPUT_DIR, `${tc.name}_finance_client_matrix.png`);
      await page.screenshot({ path: finPath });
      console.log(`Saved ${finPath}`);

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

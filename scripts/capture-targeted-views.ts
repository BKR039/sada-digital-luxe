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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/targeted_views");
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
    const viewports = [
      { width: 320, height: 640, label: "320x640" },
      { width: 360, height: 800, label: "360x800" },
      { width: 390, height: 844, label: "390x844" },
    ];

    for (const vp of viewports) {
      console.log(`\nCapturing targeted views at ${vp.label}...`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      await page.goto(`${BASE_URL}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.evaluate(
        ({ sess, key }) => {
          localStorage.setItem("sada-lang", "en");
          localStorage.setItem("sada_language", "en");
          localStorage.setItem("theme", "dark");
          localStorage.setItem("sada-theme", "dark");
          if (sess) {
            localStorage.setItem(key, JSON.stringify(sess));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
          }
        },
        { sess: session, key: storageKey }
      );

      // --- 1. /admin/analytics ---
      await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Target 1: Financial Trends Chart
      const foundChart = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h3"));
        const target = headings.find(h => h.innerText.includes("Revenue, Expenses & Profit Trend"));
        if (target) {
          const card = target.closest(".bg-card") || target;
          card.scrollIntoView({ block: "start", behavior: "instant" });
          return true;
        }
        return false;
      });
      console.log(`Found Financial Trends Chart: ${foundChart}`);
      await new Promise(r => setTimeout(r, 1000));
      const chartShot = path.join(OUTPUT_DIR, `${vp.label}_chart_trends.png`);
      await page.screenshot({ path: chartShot });
      console.log(`Saved ${chartShot}`);

      // Target 2: Expense Breakdown View
      const foundExpense = await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h3"));
        const target = headings.find(h => h.innerText.includes("Where Does the Money Go"));
        if (target) {
          const card = target.closest(".bg-card") || target;
          card.scrollIntoView({ block: "start", behavior: "instant" });
          return true;
        }
        return false;
      });
      console.log(`Found Expense Breakdown: ${foundExpense}`);
      await new Promise(r => setTimeout(r, 1000));
      const expenseShot = path.join(OUTPUT_DIR, `${vp.label}_expense_ranking.png`);
      await page.screenshot({ path: expenseShot });
      console.log(`Saved ${expenseShot}`);

      // Target 3: Client Profitability Tab
      const clickedTab = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll("button, [role='tab']")) as HTMLElement[];
        const target = tabs.find(t => t.innerText.includes("Client Profitability") || t.innerText.includes("ربحية"));
        if (target) {
          target.click();
          return true;
        }
        return false;
      });
      console.log(`Clicked Client Profitability tab: ${clickedTab}`);
      await new Promise(r => setTimeout(r, 1500));

      // Scroll to the mobile matrix cards
      await page.evaluate(() => {
        const headings = Array.from(document.querySelectorAll("h3, h4"));
        const target = headings.find(h => h.innerText.includes("Client Profitability Matrix") || h.innerText.includes("Formula:"));
        if (target) {
          target.scrollIntoView({ block: "start", behavior: "instant" });
        } else {
          const matrixContainer = document.querySelector(".block.md\\:hidden");
          if (matrixContainer) matrixContainer.scrollIntoView({ block: "start", behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 1000));
      const matrixShot = path.join(OUTPUT_DIR, `${vp.label}_analytics_profitability_matrix.png`);
      await page.screenshot({ path: matrixShot });
      console.log(`Saved ${matrixShot}`);

      // --- 2. /admin/finance Client Profitability View ---
      await page.goto(`${BASE_URL}/admin/finance`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
        const tabs = Array.from(document.querySelectorAll("button, [role='tab']")) as HTMLElement[];
        const target = tabs.find(t => t.innerText.includes("Client Profitability") || t.innerText.includes("ربحية العملاء"));
        if (target) target.click();
      });
      await new Promise(r => setTimeout(r, 1500));
      await page.evaluate(() => {
        const matrixContainer = document.querySelector(".block.md\\:hidden");
        if (matrixContainer) matrixContainer.scrollIntoView({ block: "start", behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 1000));
      const finMatrixShot = path.join(OUTPUT_DIR, `${vp.label}_finance_profitability_matrix.png`);
      await page.screenshot({ path: finMatrixShot });
      console.log(`Saved ${finMatrixShot}`);

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

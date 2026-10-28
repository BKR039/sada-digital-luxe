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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/test_views");
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
  if (!session) process.exit(1);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });

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

    await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForSelector("nav[aria-label='Management Analytics Sections']", { timeout: 25000 });
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
    });

    // 1. Scroll directly to Trends Chart using container bounding rect
    console.log("Scrolling to chart container...");
    await page.evaluate(() => {
      const main = document.querySelector("#sada-admin-main");
      const chart = document.querySelector(".recharts-responsive-container");
      if (main && chart) {
        const top = chart.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
        main.scrollTo({ top: top - 80, behavior: "instant" });
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "320_chart_scroll.png") });
    console.log("Saved 320_chart_scroll.png");

    // 2. Click client_profitability using robust pointer/mouse events
    console.log("Clicking client_profitability trigger...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("[role='tab']")) as HTMLElement[];
      const target = tabs.find(t => t.textContent?.includes("Client Profitability") || t.textContent?.includes("ربحية"));
      if (target) {
        target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
        target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        target.click();
      }
    });
    await new Promise(r => setTimeout(r, 1500));

    // Scroll to the mobile cards
    await page.evaluate(() => {
      const main = document.querySelector("#sada-admin-main");
      const mobileCards = document.querySelector(".block.md\\:hidden");
      if (main && mobileCards) {
        const top = mobileCards.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
        main.scrollTo({ top: top - 20, behavior: "instant" });
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, "320_client_profitability_scroll.png") });
    console.log("Saved 320_client_profitability_scroll.png");

    await page.close();
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

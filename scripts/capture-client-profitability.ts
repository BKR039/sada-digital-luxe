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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/profitability_baseline");
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

  const projectRef = "mtfkzabiscyleztypqks";
  const storageKey = `sb-${projectRef}-auth-token`;

  try {
    const viewports = [
      { width: 320, height: 640, label: "320x640" },
      { width: 360, height: 800, label: "360x800" },
      { width: 390, height: 844, label: "390x844" },
    ];

    for (const vp of viewports) {
      console.log(`\nTesting ${vp.label}...`);
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

      // Go to /admin/analytics
      await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await page.waitForSelector("[role='tab']", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 1500));

      // Dismiss toasts
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Click tab client_profitability
      console.log(`Clicking tab client_profitability at ${vp.label}...`);
      await page.evaluate(() => {
        const trigger = document.querySelector('button[value="client_profitability"], [data-value="client_profitability"]') as HTMLElement;
        if (trigger) {
          trigger.click();
        } else {
          const tabs = Array.from(document.querySelectorAll("[role='tab']")) as HTMLElement[];
          const target = tabs.find(t => t.innerText.includes("Client Profitability") || t.innerText.includes("ربحية"));
          if (target) target.click();
        }
      });
      await new Promise(r => setTimeout(r, 2000));

      const tabShot = path.join(OUTPUT_DIR, `${vp.label}_analytics_tab1_top.png`);
      await page.screenshot({ path: tabShot });
      console.log(`Saved ${tabShot}`);

      // Scroll into the matrix
      await page.evaluate(() => {
        const main = document.querySelector("#sada-admin-main");
        if (main) main.scrollBy({ top: 380, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 1000));

      const matrixShot = path.join(OUTPUT_DIR, `${vp.label}_analytics_tab1_matrix.png`);
      await page.screenshot({ path: matrixShot });
      console.log(`Saved ${matrixShot}`);

      // Also navigate to /admin/finance to see ClientProfitabilityView in Finance
      console.log(`Navigating to /admin/finance at ${vp.label}...`);
      await page.goto(`${BASE_URL}/admin/finance`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Switch to Client Profitability tab in /admin/finance
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll("button, [role='tab']")) as HTMLElement[];
        const tab = tabs.find(t => t.innerText.includes("Client Profitability") || t.innerText.includes("ربحية العملاء"));
        if (tab) tab.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      // Scroll down to cards
      await page.evaluate(() => {
        const main = document.querySelector("#sada-admin-main");
        if (main) main.scrollBy({ top: 300, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 1000));

      const finCpShot = path.join(OUTPUT_DIR, `${vp.label}_finance_client_profitability.png`);
      await page.screenshot({ path: finCpShot });
      console.log(`Saved ${finCpShot}`);

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

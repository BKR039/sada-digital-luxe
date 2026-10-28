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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/baseline_v2");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function getSession(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) {
    console.error(`Auth failed for ${email}:`, error?.message);
    return null;
  }
  return data.session;
}

interface DefectFinding {
  viewport: string;
  route: string;
  component: string;
  issue: string;
  details: any;
}

const findings: DefectFinding[] = [];

async function main() {
  const session = await getSession("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  if (!session) {
    console.error("Could not obtain session. Exiting.");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const projectRef = "mtfkzabiscyleztypqks";
  const storageKey = `sb-${projectRef}-auth-token`;

  const viewports = [
    { width: 320, height: 640, label: "320x640" },
    { width: 360, height: 800, label: "360x800" },
    { width: 390, height: 844, label: "390x844" },
  ];

  try {
    for (const vp of viewports) {
      console.log(`\n================== AUDITING ${vp.label} ==================`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      // 0. Establish origin & inject session
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

      // --- 1. /admin/analytics (Overview: Charts & Expense Breakdown) ---
      console.log(`1. Navigating to /admin/analytics at ${vp.label}...`);
      await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await page.waitForSelector("[role='tab']", { timeout: 25000 });
      await page.evaluate(() => {
        const toasts = document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]");
        toasts.forEach(t => t.remove());
      });
      await new Promise((r) => setTimeout(r, 2000));

      const topShot = path.join(OUTPUT_DIR, `${vp.label}_analytics_top.png`);
      await page.screenshot({ path: topShot });
      console.log(`  Saved ${topShot}`);

      // Scroll to Financial Trends Chart & Expense Breakdown
      await page.evaluate(() => {
        const el = document.querySelector("#sada-admin-main");
        if (el) el.scrollBy({ top: 520, behavior: "instant" });
      });
      await new Promise((r) => setTimeout(r, 1000));
      const chartsShot = path.join(OUTPUT_DIR, `${vp.label}_analytics_charts.png`);
      await page.screenshot({ path: chartsShot });
      console.log(`  Saved ${chartsShot}`);

      // Inspect Financial Trends and Expense Breakdown DOM metrics
      const chartMetrics = await page.evaluate(() => {
        const issues: string[] = [];
        const buttons = Array.from(document.querySelectorAll("button"));
        buttons.forEach((b) => {
          const rect = b.getBoundingClientRect();
          if (b.scrollWidth > b.clientWidth + 1) {
            issues.push(`Button "${b.innerText.trim().slice(0, 20)}" clipped: scrollWidth ${b.scrollWidth} > clientWidth ${b.clientWidth}`);
          }
        });
        const cards = Array.from(document.querySelectorAll(".rounded-2xl, .rounded-xl, [class*='bg-card']"));
        cards.forEach((c) => {
          if (c.scrollWidth > c.clientWidth + 2) {
            issues.push(`Card ${c.className.slice(0, 30)} has horizontal overflow: ${c.scrollWidth} vs ${c.clientWidth}`);
          }
        });
        return issues;
      });
      if (chartMetrics.length) {
        findings.push({
          viewport: vp.label,
          route: "/admin/analytics",
          component: "Charts & Expense Breakdown",
          issue: "Component bounding overflow or clipping detected",
          details: chartMetrics,
        });
      }

      // --- 2. /admin/analytics (Client Profitability Tab) ---
      console.log(`2. Clicking Client Profitability tab at ${vp.label}...`);
      await page.evaluate(() => {
        const mainEl = document.querySelector("#sada-admin-main");
        if (mainEl) mainEl.scrollTo({ top: 0, behavior: "instant" });
        const tabs = Array.from(document.querySelectorAll("[role='tab']")) as HTMLElement[];
        for (const t of tabs) {
          if (t.innerText.includes("Client Profitability") || t.innerText.includes("ربحية العملاء")) {
            t.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
            t.click();
            break;
          }
        }
      });
      await new Promise((r) => setTimeout(r, 1500));

      // Scroll down slightly to see matrix
      const cpShot = path.join(OUTPUT_DIR, `${vp.label}_client_profitability.png`);
      await page.screenshot({ path: cpShot });
      console.log(`  Saved ${cpShot}`);

      // Scroll down into cards
      await page.evaluate(() => {
        const el = document.querySelector("#sada-admin-main");
        if (el) el.scrollBy({ top: 450, behavior: "instant" });
      });
      await new Promise((r) => setTimeout(r, 1000));
      const cpCardsShot = path.join(OUTPUT_DIR, `${vp.label}_client_profitability_cards.png`);
      await page.screenshot({ path: cpCardsShot });
      console.log(`  Saved ${cpCardsShot}`);

      // --- 3. /admin Executive Command Center ---
      console.log(`3. Navigating to /admin at ${vp.label}...`);
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise((r) => setTimeout(r, 2000));
      await page.evaluate(() => {
        const toasts = document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]");
        toasts.forEach(t => t.remove());
      });

      const adminShot = path.join(OUTPUT_DIR, `${vp.label}_admin_executive.png`);
      await page.screenshot({ path: adminShot });
      console.log(`  Saved ${adminShot}`);

      // Scroll down to see full command center
      await page.evaluate(() => {
        const el = document.querySelector("#sada-admin-main");
        if (el) el.scrollBy({ top: 450, behavior: "instant" });
      });
      await new Promise((r) => setTimeout(r, 1000));
      const adminLowerShot = path.join(OUTPUT_DIR, `${vp.label}_admin_executive_lower.png`);
      await page.screenshot({ path: adminLowerShot });
      console.log(`  Saved ${adminLowerShot}`);

      // --- 4. /admin/finance (Finance data tables & profitability) ---
      console.log(`4. Navigating to /admin/finance at ${vp.label}...`);
      await page.goto(`${BASE_URL}/admin/finance`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise((r) => setTimeout(r, 2000));
      await page.evaluate(() => {
        const toasts = document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]");
        toasts.forEach(t => t.remove());
      });

      const financeShot = path.join(OUTPUT_DIR, `${vp.label}_finance_top.png`);
      await page.screenshot({ path: financeShot });
      console.log(`  Saved ${financeShot}`);

      await page.evaluate(() => {
        const el = document.querySelector("#sada-admin-main");
        if (el) el.scrollBy({ top: 500, behavior: "instant" });
      });
      await new Promise((r) => setTimeout(r, 1000));
      const financeTableShot = path.join(OUTPUT_DIR, `${vp.label}_finance_table.png`);
      await page.screenshot({ path: financeTableShot });
      console.log(`  Saved ${financeTableShot}`);

      await page.close();
    }

    fs.writeFileSync(
      path.join(OUTPUT_DIR, "baseline_findings.json"),
      JSON.stringify(findings, null, 2),
      "utf-8"
    );
    console.log("\nBaseline audit completed successfully! Results written to baseline_findings.json.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Baseline audit failed:", err);
  process.exit(1);
});

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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/final_release_suite");
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
      console.log(`\n========================================`);
      console.log(`CAPTURING VIEWPORT: ${tc.name} (${tc.lang})`);
      console.log(`========================================`);
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

      // --- SCREEN 1: /admin Executive Command Center ---
      console.log(`Capturing /admin for ${tc.name}...`);
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      await page.screenshot({ path: path.join(OUTPUT_DIR, `${tc.name}_admin_command_center_top.png`) });

      // Scroll inside #sada-admin-main
      await page.evaluate(() => {
        const main = document.getElementById("sada-admin-main");
        if (main) main.scrollBy({ top: 400, behavior: "instant" });
      });
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${tc.name}_admin_command_center_mid.png`) });

      // --- SCREEN 2: /admin/analytics (Financial Trends & Expense Ranking) ---
      console.log(`Capturing /admin/analytics for ${tc.name}...`);
      await page.goto(`${BASE_URL}/admin/analytics`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Command strip at top
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${tc.name}_analytics_command_strip.png`) });

      // Scroll to Financial Trends Chart
      await page.evaluate(() => {
        const chart = document.querySelector(".recharts-responsive-container");
        const main = document.getElementById("sada-admin-main");
        if (chart && main) {
          const card = chart.closest(".bg-card") || chart;
          const top = card.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
          main.scrollTo({ top: top - 20, behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${tc.name}_analytics_trends_chart.png`) });

      // Scroll to Expense Breakdown
      await page.evaluate(() => {
        const main = document.getElementById("sada-admin-main");
        const headings = Array.from(document.querySelectorAll("h3, h4, span"));
        const target = headings.find(h => h.textContent?.includes("Expense Breakdown") || h.textContent?.includes("تفصيل المصاريف") || h.textContent?.includes("Expense Ranking"));
        if (target && main) {
          const card = target.closest(".bg-card") || target;
          const top = card.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
          main.scrollTo({ top: top - 20, behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${tc.name}_analytics_expense_breakdown.png`) });

      // Switch to Client Profitability Tab
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll("[role='tab']"));
        const targetTab = tabs.find(t =>
          t.textContent?.includes("Client Profitability") ||
          t.textContent?.includes("ربحية العملاء")
        ) as HTMLElement | undefined;
        if (targetTab) {
          targetTab.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
          targetTab.click();
        }
      });
      await new Promise(r => setTimeout(r, 1200));

      // Scroll into Client Profitability cards
      await page.evaluate(() => {
        const main = document.getElementById("sada-admin-main");
        const headings = Array.from(document.querySelectorAll("h3, h4"));
        const target = headings.find(h =>
          h.textContent?.includes("Client Profitability") ||
          h.textContent?.includes("ربحية العملاء")
        );
        if (target && main) {
          const card = target.closest(".bg-card") || target;
          const top = card.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop;
          main.scrollTo({ top: top - 20, behavior: "instant" });
        }
      });
      await new Promise(r => setTimeout(r, 800));
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${tc.name}_client_profitability_matrix.png`) });

      await page.close();
    }

    // --- SCREEN 3: /admin/finance & /admin/sales targeted at 320px ---
    console.log(`\nCapturing /admin/finance at 320px...`);
    const page320 = await browser.newPage();
    await page320.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });

    await page320.goto(`${BASE_URL}`, { waitUntil: "domcontentloaded" });
    await page320.evaluate(({ sess, key }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada_language", "en");
      localStorage.setItem("theme", "dark");
      localStorage.setItem("sada-theme", "dark");
      if (sess) {
        localStorage.setItem(key, JSON.stringify(sess));
        localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
      }
    }, { sess: session, key: storageKey });

    await page320.goto(`${BASE_URL}/admin/finance`, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page320.waitForSelector(".admin-shell", { timeout: 25000 });
    await new Promise(r => setTimeout(r, 2000));
    await page320.evaluate(() => {
      document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
    });
    await page320.screenshot({ path: path.join(OUTPUT_DIR, `320x640_finance_inflows.png`) });

    // Switch to Outflows tab
    await page320.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("[role='tab'], button"));
      const target = tabs.find(t => t.textContent?.includes("Operating Expenses") || t.textContent?.includes("Outflows") || t.textContent?.includes("Expenses"));
      if (target) {
        target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        (target as HTMLElement).click();
      }
    });
    await new Promise(r => setTimeout(r, 1000));
    await page320.screenshot({ path: path.join(OUTPUT_DIR, `320x640_finance_outflows.png`) });

    // Check Sales Pipeline at 320px
    console.log(`Capturing /admin/sales at 320px...`);
    await page320.goto(`${BASE_URL}/admin/sales`, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page320.waitForSelector(".admin-shell", { timeout: 25000 });
    await new Promise(r => setTimeout(r, 2000));
    await page320.evaluate(() => {
      document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
    });
    await page320.screenshot({ path: path.join(OUTPUT_DIR, `320x640_sales_pipeline_kanban.png`) });

    // Switch to Table mode in Sales
    await page320.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const tableBtn = btns.find(b => b.textContent?.trim() === "Table" || b.textContent?.trim() === "جدول");
      if (tableBtn) tableBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await page320.screenshot({ path: path.join(OUTPUT_DIR, `320x640_sales_pipeline_table_cards.png`) });

    // Switch to Commissions tab in Sales
    await page320.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const commBtn = btns.find(b => b.textContent?.includes("Commissions") || b.textContent?.includes("عمولاتي"));
      if (commBtn) commBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));
    await page320.screenshot({ path: path.join(OUTPUT_DIR, `320x640_sales_commissions_cards.png`) });

    await page320.close();
    console.log("\nALL SCREENSHOTS CAPTURED SUCCESSFULLY!");
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

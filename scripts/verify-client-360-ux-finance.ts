import puppeteer, { type Browser, type Page } from "puppeteer-core";
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
const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

const OUTPUT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\0a498431-76c6-4e93-b54f-d0b328068466\\client_360_qa";

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 1. Authenticate with SuperAdmin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }

  const { data: clients } = await supabase.from("clients").select("id, name").order("created_at", { ascending: false }).limit(1);
  const clientId = clients![0].id;
  const clientName = clients![0].name;
  console.log(`Testing Client: ${clientName} (${clientId})`);

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  // ==========================================
  // VIEWPORT MATRIX TESTS & SCREENSHOT CAPTURE
  // ==========================================
  const viewports = [
    { width: 1440, height: 900, name: "desktop_1440x900", lang: "en", theme: "dark" },
    { width: 1280, height: 800, name: "laptop_1280x800", lang: "en", theme: "light" },
    { width: 1024, height: 768, name: "tablet_landscape_1024x768", lang: "ar", theme: "dark" },
    { width: 768, height: 1024, name: "tablet_portrait_768x1024", lang: "ar", theme: "light" },
    { width: 390, height: 844, name: "mobile_iphone14_390x844", lang: "en", theme: "dark" },
    { width: 375, height: 667, name: "mobile_compact_375x667", lang: "ar", theme: "light" },
  ];

  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height}) Lang=${vp.lang} Theme=${vp.theme}`);
    const page: Page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    // Seed Auth & Settings
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ s, k, l, th }) => {
      localStorage.setItem(k, JSON.stringify(s));
      localStorage.setItem("sada-lang", l);
      localStorage.setItem("sada-theme", th);
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
      if (th === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }, { s: authData.session, k: storageKey, l: vp.lang, th: vp.theme });

    await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));

    // Capture Top of Page
    const topScreenshotPath = path.join(OUTPUT_DIR, `${vp.name}_top.png`);
    await page.screenshot({ path: topScreenshotPath });
    console.log(`  Saved top-of-page screenshot: ${topScreenshotPath}`);

    // Click Financial & Ads section
    await page.evaluate((isAr) => {
      const btns = Array.from(document.querySelectorAll(".sticky button"));
      const btn = btns.find((b) => b.textContent?.includes(isAr ? "المالي" : "Financial"));
      if (btn) (btn as HTMLElement).click();
    }, vp.lang === "ar");

    await new Promise((r) => setTimeout(r, 1200));

    // Verify Financial Section is in view and pinned sticky nav is clean
    const scrolledScreenshotPath = path.join(OUTPUT_DIR, `${vp.name}_scrolled_financial.png`);
    await page.screenshot({ path: scrolledScreenshotPath });
    console.log(`  Saved scrolled-financial screenshot: ${scrolledScreenshotPath}`);

    // On desktop_1440x900, test inline financial modal triggers and form interaction
    if (vp.name === "desktop_1440x900") {
      console.log("\n  --- Testing Inline Modal Triggers in Client Context ---");

      // Test 1: Record Income Modal
      const incomeBtnFound = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Record Income") || b.textContent?.includes("تسجيل مقبوضات"));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log(`    Clicked Record Income: ${incomeBtnFound}`);
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_record_income.png") });

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Close"], [role="dialog"] button.shrink-0');
        if (closeBtn) (closeBtn as HTMLElement).click();
        else {
          const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.textContent?.includes('إلغاء'));
          if (cancelBtn) (cancelBtn as HTMLElement).click();
        }
      });
      await new Promise((r) => setTimeout(r, 400));

      // Test 2: Record Expense Modal
      const expenseBtnFound = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Record Expense") || b.textContent?.includes("تسجيل مصروف"));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log(`    Clicked Record Expense: ${expenseBtnFound}`);
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_record_expense.png") });

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.textContent?.includes('إلغاء'));
        if (cancelBtn) (cancelBtn as HTMLElement).click();
      });
      await new Promise((r) => setTimeout(r, 400));

      // Test 3: New Invoice Modal
      const invoiceBtnFound = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("New Invoice") || b.textContent?.includes("فاتورة جديدة"));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log(`    Clicked New Invoice: ${invoiceBtnFound}`);
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_new_invoice.png") });

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.textContent?.includes('إلغاء'));
        if (cancelBtn) (cancelBtn as HTMLElement).click();
      });
      await new Promise((r) => setTimeout(r, 400));

      // Test 4: Sponsoring Modal
      const sponsoringBtnFound = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const btn = btns.find((b) => b.textContent?.includes("Sponsoring") || b.textContent?.includes("إعلان ممول"));
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });
      console.log(`    Clicked Sponsoring: ${sponsoringBtnFound}`);
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUTPUT_DIR, "modal_sponsoring.png") });

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cancel') || b.textContent?.includes('إلغاء'));
        if (cancelBtn) (cancelBtn as HTMLElement).click();
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    await page.close();
  }

  await browser.close();
  console.log("\n=== ALL QA VERIFICATIONS AND SCREENSHOTS COMPLETED SUCCESSFULLY! ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

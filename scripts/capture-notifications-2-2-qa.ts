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

const BASE_URL = "http://localhost:3000";
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\3bc6394f-3e07-411b-9b48-e1f05f6b43da\\notifications_qa";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function getAdminSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.warn("Could not sign in with qa.superadmin@sada.agency:", error?.message);
    return null;
  }
  return data.session;
}

async function openNotificationBell(page: Page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const notifBtn = buttons.find((b) => {
      const label = (b.getAttribute("aria-label") || "") + (b.getAttribute("title") || "");
      const hasBell = b.querySelector("svg.lucide-bell") !== null;
      return hasBell || label.includes("Attention") || label.includes("الإشعارات") || label.includes("إشعار");
    });
    if (notifBtn) {
      (notifBtn as HTMLElement).click();
    }
  });
  await new Promise((r) => setTimeout(r, 600));
}

async function run() {
  console.log("Starting SADA OS — Notification Experience 2.2 QA Capture Suite...");
  const session = await getAdminSession();
  console.log("Admin session authenticated:", Boolean(session));

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    const configureSessionAndNavigate = async (
      width: number,
      height: number,
      lang: "ar" | "en",
      theme: "dark" | "light"
    ) => {
      await page.setViewport({ width, height });
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ sessionData, storageKey, l, t }) => {
          localStorage.setItem("sada-lang", l);
          localStorage.setItem("sada-theme", t);
          if (sessionData) {
            localStorage.setItem(storageKey, JSON.stringify(sessionData));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
          }
          if (l === "ar") {
            document.documentElement.dir = "rtl";
            document.documentElement.lang = "ar";
          } else {
            document.documentElement.dir = "ltr";
            document.documentElement.lang = "en";
          }
          if (t === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        },
        {
          sessionData: session,
          storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
          l: lang,
          t: theme,
        }
      );
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));
    };

    // ----------------------------------------------------
    // 1. DESKTOP 1440x900 — ARABIC RTL DARK MODE (OPEN POPOVER)
    // ----------------------------------------------------
    console.log("1. Capturing Desktop 1440x900 Arabic RTL Dark with Notification Center Open...");
    await configureSessionAndNavigate(1440, 900, "ar", "dark");
    await openNotificationBell(page);
    await page.screenshot({ path: path.join(outputDir, "01_desktop_1440_notif_ar_dark.png") });

    // ----------------------------------------------------
    // 2. DESKTOP 1440x900 — NOTIFICATION PANEL SCROLLED (INTERNAL SCROLL ONLY)
    // ----------------------------------------------------
    console.log("2. Capturing Desktop 1440x900 Scrolled State (header/filters fixed)...");
    await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar");
      if (scrollable) {
        scrollable.scrollTop = 350;
      }
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outputDir, "02_desktop_1440_notif_scrolled.png") });

    // ----------------------------------------------------
    // 3. DESKTOP 1280x800 — ENGLISH LTR DARK MODE (ALL FILTERS VISIBLE)
    // ----------------------------------------------------
    console.log("3. Capturing Desktop 1280x800 English LTR Dark (All Filters Visible)...");
    await configureSessionAndNavigate(1280, 800, "en", "dark");
    await openNotificationBell(page);
    await page.screenshot({ path: path.join(outputDir, "03_desktop_1280_all_filters_en_dark.png") });

    // ----------------------------------------------------
    // 4. DESKTOP 1024x768 — NEEDS ATTENTION FILTER ACTIVE
    // ----------------------------------------------------
    console.log("4. Capturing Tablet 1024x768 Needs Attention Tab Active...");
    await configureSessionAndNavigate(1024, 768, "ar", "dark");
    await openNotificationBell(page);
    // Click Needs Attention tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const needsAttn = buttons.find((b) => b.textContent?.includes("يتطلب إجراء") || b.textContent?.includes("Needs Attention"));
      if (needsAttn) needsAttn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: path.join(outputDir, "04_tablet_1024_needs_attention.png") });

    // ----------------------------------------------------
    // 5. DESKTOP 1440x900 — LIGHT MODE ENGLISH LTR
    // ----------------------------------------------------
    console.log("5. Capturing Desktop 1440x900 English LTR Light Mode...");
    await configureSessionAndNavigate(1440, 900, "en", "light");
    await openNotificationBell(page);
    await page.screenshot({ path: path.join(outputDir, "05_desktop_1440_light_en.png") });

    // ----------------------------------------------------
    // 6. DESKTOP EMPTY STATE (SEARCH WITH NO RESULTS)
    // ----------------------------------------------------
    console.log("6. Capturing Desktop Compact Empty State...");
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Search"], input[placeholder*="بحث"]') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    });
    await page.type('input[placeholder*="Search"], input[placeholder*="بحث"]', "zero_matching_alerts_xyz");
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(outputDir, "06_desktop_compact_empty_state.png") });

    // Clear search
    await page.evaluate(() => {
      const clearBtn = document.querySelector('button[title*="Clear"], button[title*="مسح"]') as HTMLButtonElement;
      if (clearBtn) clearBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));


    // ----------------------------------------------------
    // 7. TABLET 768x1024 — PORTRAIT LIGHT MODE
    // ----------------------------------------------------
    console.log("7. Capturing Tablet 768x1024 Portrait Light Mode...");
    await configureSessionAndNavigate(768, 1024, "en", "light");
    await openNotificationBell(page);
    await page.screenshot({ path: path.join(outputDir, "07_tablet_768_portrait_light.png") });

    // ----------------------------------------------------
    // 8. MOBILE 390x844 — ARABIC RTL DARK MODE (DRAWER OPEN)
    // ----------------------------------------------------
    console.log("8. Capturing Mobile 390x844 Arabic RTL Dark Drawer...");
    await configureSessionAndNavigate(390, 844, "ar", "dark");
    await openNotificationBell(page);
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(outputDir, "08_mobile_390_drawer_ar_dark.png") });

    // ----------------------------------------------------
    // 9. MOBILE 390x844 — DRAWER SCROLLED (INTERNAL SCROLL ONLY)
    // ----------------------------------------------------
    console.log("9. Capturing Mobile 390x844 Drawer Scrolled State...");
    await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar");
      if (scrollable) {
        scrollable.scrollTop = 300;
      }
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outputDir, "09_mobile_390_drawer_scrolled.png") });

    // ----------------------------------------------------
    // 10. MOBILE 375x667 — ENGLISH LTR LIGHT MODE
    // ----------------------------------------------------
    console.log("10. Capturing Mobile 375x667 English LTR Light Mode Drawer...");
    await configureSessionAndNavigate(375, 667, "en", "light");
    await openNotificationBell(page);
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(outputDir, "10_mobile_375_drawer_en_light.png") });

    console.log("All 10 Visual QA captures completed successfully in:", outputDir);
  } catch (err) {
    console.error("Visual QA capture encountered error:", err);
  } finally {
    await browser.close();
  }
}

run();

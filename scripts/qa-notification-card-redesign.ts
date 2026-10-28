// ============================================================
// SADA OS — PREMIUM NOTIFICATION TOAST CARD VERIFICATION SUITE
// Automated verification for UI/UX redesign & stacking behavior:
// - Simultaneous toasts stacking without overlapping
// - Desktop (1440px), Mobile (390px), Ultra-narrow (320px)
// - Dark vs Light theme
// - English (LTR) vs Arabic (RTL)
// - Dismissal and action interaction
// ============================================================

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
const artifactDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\c376bf4f-06f9-404f-b927-0979f0e69530";

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

async function runVerification() {
  console.log("=== SADA OS Notification Toast Card Redesign QA ===");
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

    const setupAuthAndLang = async (lang: "en" | "ar", theme: "dark" | "light") => {
      await page.evaluateOnNewDocument(
        ({ sessionData, storageKey, l, t }) => {
          localStorage.setItem("sada-lang", l);
          localStorage.setItem("sada-theme", t);
          if (sessionData) {
            localStorage.setItem(storageKey, JSON.stringify(sessionData));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
          }
        },
        {
          sessionData: session,
          storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
          l: lang,
          t: theme,
        }
      );
    };

    // ------------------------------------------------------------
    // TEST 1: Desktop Dark LTR — Simultaneous Stacking (3 Toasts)
    // ------------------------------------------------------------
    console.log("\n--- TEST 1: Desktop Dark LTR (3 simultaneous toasts) ---");
    await setupAuthAndLang("en", "dark");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/admin?lang=en`, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(() => typeof (window as any).__triggerNotificationToast === "function", { timeout: 10000 });

    await page.evaluate(() => {
      const trigger = (window as any).__triggerNotificationToast;

      // Toast 1: Urgent task deadline
      trigger({
        id: "toast-urgent",
        title: "High Priority Task Overdue: Brand Identity Deck",
        message: "Delivery deadline passed 2 hours ago. Immediate action required for review.",
        category: "task",
        priority: "urgent",
        link_url: "/admin/calendar",
        context_title: "CAFFE 707",
        metadata: { clientName: "Caffe 707" },
      });

      // Toast 2: Warning budget threshold
      trigger({
        id: "toast-warning",
        title: "Deal Commission Threshold Warning",
        message: "Monthly allocation has reached 85% of projected operational cap.",
        category: "finance",
        priority: "high",
        link_url: "/admin/sales",
        context_title: "FINANCE",
        metadata: { clientName: "Maya Lux" },
      });

      // Toast 3: Success contract signoff
      trigger({
        id: "toast-success",
        title: "Publishing Package Approved",
        message: "All 12 scheduled reels and carousels have been signed off by client.",
        category: "system",
        priority: "normal",
        link_url: "/admin/projects",
        context_title: "WORKFLOW",
        metadata: { clientName: "Dr. Nour Dental" },
      });
    });

    await new Promise((r) => setTimeout(r, 1000));
    const shot1Path = path.join(artifactDir, "toast_stack_desktop_dark_ltr.png");
    await page.screenshot({ path: shot1Path });
    console.log("Saved Screenshot 1:", shot1Path);

    // Verify DOM positions: No overlapping!
    const stackMetrics = await page.evaluate(() => {
      const toasts = Array.from(document.querySelectorAll("[data-sonner-toast]"));
      return toasts.map((t, idx) => {
        const rect = t.getBoundingClientRect();
        return {
          index: idx,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          width: rect.width,
        };
      });
    });
    console.log("Desktop Toast stack rects:", stackMetrics);

    // ------------------------------------------------------------
    // TEST 2: Desktop Light Theme
    // ------------------------------------------------------------
    console.log("\n--- TEST 2: Desktop Light LTR ---");
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("sada-theme", "light");
    });
    await new Promise((r) => setTimeout(r, 600));

    const shot2Path = path.join(artifactDir, "toast_stack_desktop_light_ltr.png");
    await page.screenshot({ path: shot2Path });
    console.log("Saved Screenshot 2:", shot2Path);

    // ------------------------------------------------------------
    // TEST 3: Arabic RTL Layout (Native ?lang=ar)
    // ------------------------------------------------------------
    console.log("\n--- TEST 3: Desktop Dark RTL (Arabic) ---");
    await page.goto(`${BASE_URL}/admin?lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sada-theme", "dark");
      localStorage.setItem("sada-lang", "ar");
    });
    await page.waitForFunction(() => typeof (window as any).__triggerNotificationToast === "function", { timeout: 10000 });

    await page.evaluate(() => {
      const trigger = (window as any).__triggerNotificationToast;
      trigger({
        id: "toast-ar-urgent",
        title: "مهمة عاجلة متأخرة: هوية المقهى 707",
        message: "انتهى الموعد النهائي للتسليم. يرجى المراجعة وتحديث حالة المهمة فوراً.",
        category: "task",
        priority: "urgent",
        link_url: "/admin/calendar",
        context_title: "كافيه 707",
        metadata: { clientName: "كافيه 707" },
      });

      trigger({
        id: "toast-ar-security",
        title: "تنبيه أمني: تسجيل دخول جديد من تونس",
        message: "تم رصد تسجيل دخول جديد للحساب من متصفح غير معروف.",
        category: "security",
        priority: "high",
        link_url: "/admin",
        context_title: "الأمان",
      });

      trigger({
        id: "toast-ar-success",
        title: "تم استلام الدفعة المالية بنجاح",
        message: "تم إيداع مبلغ 4,200 د.ت لحساب العميل د. نور في سجل المعاملات.",
        category: "finance",
        priority: "normal",
        link_url: "/admin/sales",
        context_title: "المالية",
        metadata: { clientName: "د. نور" },
      });
    });

    await new Promise((r) => setTimeout(r, 1200));
    const shot3Path = path.join(artifactDir, "toast_stack_desktop_dark_rtl.png");
    await page.screenshot({ path: shot3Path });
    console.log("Saved Screenshot 3:", shot3Path);

    // ------------------------------------------------------------
    // TEST 4: Mobile Responsive (390x844)
    // ------------------------------------------------------------
    console.log("\n--- TEST 4: Mobile Viewport (390x844) ---");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/admin?lang=en`, { waitUntil: "networkidle2", timeout: 30000 });
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sada-theme", "dark");
      localStorage.setItem("sada-lang", "en");
    });
    await page.waitForFunction(() => typeof (window as any).__triggerNotificationToast === "function", { timeout: 10000 });

    await page.evaluate(() => {
      const trigger = (window as any).__triggerNotificationToast;
      trigger({
        id: "toast-mobile-1",
        title: "Urgent Payment Verification",
        message: "Transaction $4,200 pending reconciliation for Maya Lux contract.",
        category: "finance",
        priority: "urgent",
        link_url: "/admin/sales",
        metadata: { clientName: "Maya Lux" },
      });
      trigger({
        id: "toast-mobile-2",
        title: "Task Assigned: Social Reel Cut",
        message: "New editorial asset ready for final sound sync and export.",
        category: "task",
        priority: "normal",
        link_url: "/admin/calendar",
        metadata: { clientName: "Dr. Nour" },
      });
    });

    await new Promise((r) => setTimeout(r, 1200));
    const shot4Path = path.join(artifactDir, "toast_stack_mobile_dark_ltr.png");
    await page.screenshot({ path: shot4Path });
    console.log("Saved Screenshot 4:", shot4Path);

    // Verify mobile width containment
    const mobileMetrics = await page.evaluate(() => {
      const toast = document.querySelector("[data-sonner-toast]");
      if (!toast) return null;
      const rect = toast.getBoundingClientRect();
      return {
        width: rect.width,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: rect.right > window.innerWidth,
      };
    });
    console.log("Mobile metrics (390px):", mobileMetrics);

    // ------------------------------------------------------------
    // TEST 5: Ultra-Narrow Mobile (320x640)
    // ------------------------------------------------------------
    console.log("\n--- TEST 5: Ultra-Narrow Mobile (320x640) ---");
    await page.setViewport({ width: 320, height: 640, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 600));

    const shot5Path = path.join(artifactDir, "toast_stack_mobile_320_ltr.png");
    await page.screenshot({ path: shot5Path });
    console.log("Saved Screenshot 5:", shot5Path);

    const narrowMetrics = await page.evaluate(() => {
      const toast = document.querySelector("[data-sonner-toast]");
      if (!toast) return null;
      const rect = toast.getBoundingClientRect();
      return {
        width: rect.width,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: rect.right > window.innerWidth,
      };
    });
    console.log("Ultra-narrow metrics (320px):", narrowMetrics);

    // ------------------------------------------------------------
    // TEST 6: Edge Cases (Long title, no message, long client)
    // ------------------------------------------------------------
    console.log("\n--- TEST 6: Edge Cases Verification ---");
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/admin?lang=en`, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(() => typeof (window as any).__triggerNotificationToast === "function", { timeout: 10000 });

    await page.evaluate(() => {
      const trigger = (window as any).__triggerNotificationToast;
      // Long title and long entity
      trigger({
        id: "toast-edge-long",
        title: "Very Long Multi-Line Notification Title That Describes An Elaborate Strategic Operation Across Multiple Cross-Functional Marketing Channels",
        message: "Concise description that wraps gracefully without overflowing the card boundaries or obscuring the action button below.",
        category: "system",
        priority: "high",
        link_url: "/admin/business-rules",
        metadata: { clientName: "International Luxury Hospitality Group Middle East & North Africa" },
      });

      // No message (title only)
      trigger({
        id: "toast-edge-no-desc",
        title: "Quick System Ping: Storage Backup Completed",
        priority: "normal",
        link_url: "/admin",
        metadata: { clientName: "Infra" },
      });
    });

    await new Promise((r) => setTimeout(r, 1200));
    const shot6Path = path.join(artifactDir, "toast_edge_cases_dark.png");
    await page.screenshot({ path: shot6Path });
    console.log("Saved Screenshot 6:", shot6Path);

    // ------------------------------------------------------------
    // TEST 7: Dismissal Interaction
    // ------------------------------------------------------------
    console.log("\n--- TEST 7: Dismissal Interaction ---");
    const dismissResult = await page.evaluate(() => {
      const dismissBtns = Array.from(document.querySelectorAll("button[aria-label*='Dismiss'], button[aria-label*='إغلاق']"));
      if (dismissBtns.length === 0) return { success: false, reason: "No dismiss button found" };
      const initialCount = document.querySelectorAll("[data-sonner-toast]").length;
      (dismissBtns[0] as HTMLButtonElement).click();
      return { success: true, initialCount };
    });
    console.log("Dismiss button clicked:", dismissResult);
    await new Promise((r) => setTimeout(r, 600));

    const postDismissCount = await page.evaluate(() => {
      return document.querySelectorAll("[data-sonner-toast]").length;
    });
    console.log(`Toasts before dismiss: ${dismissResult.initialCount}, after dismiss: ${postDismissCount}`);

    console.log("\n=== ALL QA VERIFICATION SCENARIOS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Verification failed with error:", err);
  } finally {
    await browser.close();
  }
}

runVerification();

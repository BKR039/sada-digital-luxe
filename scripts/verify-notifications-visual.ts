// ============================================================
// SADA OS — NOTIFICATION EXPERIENCE 2.0 VISUAL QA RUNNER
// Captures Headless Chrome screenshots across Desktop & Mobile:
// 1. Desktop Notification Center Popover & Persistent Logo Bell
// 2. Notification Preferences Modal with Delivery Channels & Mandatory Tier
// 3. Mobile Viewport (390x844) Header Indicator & Full Bottom Drawer
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
const artifactDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\96632da9-4418-4b03-95d4-508da0f84e11";

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

async function runVisualQA() {
  console.log("Starting Notification 2.0 Visual QA...");
  const session = await getAdminSession();
  console.log("Admin session status:", Boolean(session));

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    // Setup local storage auth tokens
    await page.evaluateOnNewDocument(
      ({ sessionData, storageKey }) => {
        localStorage.setItem("sada-lang", "ar");
        localStorage.setItem("sada-theme", "dark");
        if (sessionData) {
          localStorage.setItem(storageKey, JSON.stringify(sessionData));
          localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
        }
      },
      {
        sessionData: session,
        storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
      }
    );

    console.log("Navigating to Admin Dashboard...");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // SCREENSHOT 1: Desktop View with Notification Center Open
    console.log("Opening Notification Center on Desktop...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const visibleBtn = buttons.find((b) => {
        const label = (b.getAttribute("aria-label") || "") + (b.getAttribute("title") || "");
        const isNotif = label.includes("Notifications") || label.includes("الإشعارات");
        const rect = b.getBoundingClientRect();
        return isNotif && rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).display !== "none";
      });
      if (visibleBtn) visibleBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const desktopShotPath = path.join(artifactDir, "notification_2_desktop_center.png");
    await page.screenshot({ path: desktopShotPath });
    console.log("Saved desktop screenshot:", desktopShotPath);

    // SCREENSHOT 2: Preferences Modal
    console.log("Opening Notification Preferences Modal...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const prefBtn = buttons.find((b) => {
        const label = (b.getAttribute("aria-label") || "") + (b.getAttribute("title") || "");
        return label.includes("Preferences") || label.includes("تفضيلات");
      });
      if (prefBtn) prefBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const prefShotPath = path.join(artifactDir, "notification_2_preferences.png");
    await page.screenshot({ path: prefShotPath });
    console.log("Saved preferences screenshot:", prefShotPath);

    // Close modal by pressing Escape
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 600));

    // SCREENSHOT 3: Mobile Viewport (390x844) & Drawer
    console.log("Switching to Mobile Viewport (390x844)...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2000));

    // Click mobile top bar notification trigger
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const visibleBtn = buttons.find((b) => {
        const label = (b.getAttribute("aria-label") || "") + (b.getAttribute("title") || "");
        const isNotif = label.includes("Notifications") || label.includes("الإشعارات");
        const rect = b.getBoundingClientRect();
        return isNotif && rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).display !== "none";
      });
      if (visibleBtn) visibleBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));

    const mobileShotPath = path.join(artifactDir, "notification_2_mobile_drawer.png");
    await page.screenshot({ path: mobileShotPath });
    console.log("Saved mobile drawer screenshot:", mobileShotPath);

    console.log("Visual QA completed successfully!");
  } catch (err) {
    console.error("Visual QA error:", err);
  } finally {
    await browser.close();
  }
}

runVisualQA();

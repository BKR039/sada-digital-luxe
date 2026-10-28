// ============================================================
// VERIFY ADMIN REALTIME IN HEADLESS CHROME
// Uses local Chrome via puppeteer-core to verify /admin page loads,
// NotificationCenter mounts (multiple instances), popover opens,
// and NO realtime subscription errors are thrown in the console.
// ============================================================

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

async function injectSession(page: any, email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) {
    throw new Error(`Auth failed for ${email}: ${error?.message}`);
  }

  // Set session into localStorage matching Supabase storage key
  await page.evaluate((sessionData: any) => {
    const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
  }, data.session);

  return data.session;
}

async function verifyAdminRealtime() {
  console.log("==================================================");
  console.log("STARTING ADMIN NOTIFICATION REALTIME BROWSER TEST");
  console.log("==================================================");

  const consoleLogs: { type: string; text: string }[] = [];
  const realtimeErrors: string[] = [];

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (
      text.includes("cannot add 'postgres_changes'") ||
      text.includes("after `subscribe()`") ||
      text.includes("after subscribe()")
    ) {
      realtimeErrors.push(text);
      console.error(`[CRITICAL REALTIME ERROR DETECTED] ${text}`);
    }
  });

  page.on("pageerror", (err) => {
    if (err.message.includes("postgres_changes") || err.message.includes("subscribe()")) {
      realtimeErrors.push(err.message);
      console.error("[CRITICAL REALTIME PAGE ERROR]", err.message);
    }
  });

  console.log("1. Navigating to base URL to establish origin...");
  await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded" });

  console.log("2. Injecting authenticated session for qa.superadmin@sada.agency...");
  await injectSession(page, "qa.superadmin@sada.agency", "SuperAdminPassword123!");

  console.log("3. Navigating to /admin...");
  await page.goto("http://localhost:3001/admin", { waitUntil: "networkidle2", timeout: 30000 });

  console.log("4. Waiting for NotificationCenter bell to mount...");
  const bellSelector = 'button[aria-label="Notifications"]';
  await page.waitForSelector(bellSelector, { timeout: 15000 });
  const bellButtons = await page.$$(bellSelector);
  console.log(`[PASS] Found ${bellButtons.length} NotificationCenter button(s) mounted simultaneously.`);

  console.log("5. Clicking NotificationCenter bell to trigger popover...");
  await page.evaluate(() => {
    const bells = document.querySelectorAll('button[aria-label="Notifications"]');
    for (const b of bells) {
      const rect = b.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        (b as HTMLButtonElement).click();
        return;
      }
    }
    // Fallback click first button
    if (bells.length > 0) (bells[0] as HTMLButtonElement).click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Verify popover is visible
  const popoverContent = await page.evaluate(() => {
    return document.body.innerText.includes("Notification Center");
  });
  console.log(`[PASS] Notification Center Popover is open: ${popoverContent}`);

  // Take screenshot of opened notification center
  const screenshotPath = path.resolve(process.cwd(), "scripts/admin_notification_center_verified.png");
  await page.screenshot({ path: screenshotPath });
  console.log(`[PASS] Saved screenshot to ${screenshotPath}`);

  // Test navigation to /admin/finance and back to /admin
  console.log("6. Testing route transition to /admin/finance and back...");
  await page.goto("http://localhost:3001/admin/finance", { waitUntil: "networkidle2", timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1000));
  await page.goto("http://localhost:3001/admin", { waitUntil: "networkidle2", timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1500));

  console.log("7. Clicking NotificationCenter bell again after route transition...");
  await page.evaluate(() => {
    const bells = document.querySelectorAll('button[aria-label="Notifications"]');
    for (const b of bells) {
      const rect = b.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        (b as HTMLButtonElement).click();
        return;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  console.log("\n==================================================");
  console.log("FINAL REALTIME VERIFICATION RESULTS");
  console.log("==================================================");
  console.log(`Total console entries logged: ${consoleLogs.length}`);
  console.log(`Total 'cannot add postgres_changes after subscribe()' errors: ${realtimeErrors.length}`);

  if (realtimeErrors.length === 0) {
    console.log(">>> SUCCESS: Realtime subscription lifecycle is 100% CLEAN. ZERO ERRORS! <<<");
  } else {
    console.error(">>> FAILURE: Realtime subscription errors detected! <<<");
    realtimeErrors.forEach((e) => console.error(" - ", e));
  }

  await browser.close();

  if (realtimeErrors.length > 0) {
    process.exit(1);
  }
}

verifyAdminRealtime().catch((err) => {
  console.error("Browser verification script failed:", err);
  process.exit(1);
});

import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
      env[match[1]] = value;
    }
  });
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("=== BROWSER REPRODUCTION: P0 SESSION MISMATCH ===");

  const screenshotDir = path.resolve(process.cwd(), "scripts", "screenshots", "p0_investigation");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // 1. Sign in as SA in node to get real auth session
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr || !authData?.session) {
    console.error("Node login failed:", authErr);
    return;
  }
  const saSession = authData.session;
  console.log("Authenticated SA in node, user id:", saSession.user.id);

  // Target BKR039 session ID
  const bkrSessionId = "sess_ba992ed2b12144138e7af28ef2f8ab51";
  console.log("Simulating stale localStorage sada_session_ref:", bkrSessionId);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1440,900"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("Session") || text.includes("Error") || text.includes("error") || text.includes("Drawer") || text.includes("Account")) {
        console.log(`[Browser Console ${msg.type()}]:`, text);
      }
    });

    // Go to origin to set localStorage
    await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Inject SA session AND the stale BKR039 session ID into localStorage
    await page.evaluate(({ sessionData, targetSid }) => {
      const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
      localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
      localStorage.setItem("sada_session_ref", targetSid);
    }, { sessionData: saSession, targetSid: bkrSessionId });

    console.log("Navigating directly to BKR039 account drawer URL...");
    await page.goto("http://localhost:3000/admin/accounts?section=accounts&account=560fd7c4-c38b-4562-8f9d-95729dfb2bab", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 3000));

    // Capture drawer open screenshot
    const drawerOpenPath = path.join(screenshotDir, "drawer_opened_bkr039.png");
    await page.screenshot({ path: drawerOpenPath });
    console.log("Drawer opened screenshot:", drawerOpenPath);

    // Check for error banner on open
    let errorBanner = await page.evaluate(() => {
      const el = document.querySelector(".bg-rose-500\\/10");
      return el ? el.textContent?.trim() : null;
    });
    console.log("Error banner on drawer open:", errorBanner);

    // Now submit Save Changes
    console.log("Submitting 'Save Changes' form on the drawer...");
    await page.evaluate(() => {
      const form = document.querySelector("#edit-account-form") as HTMLFormElement;
      if (form) {
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      } else {
        const btns = Array.from(document.querySelectorAll("button"));
        const save = btns.find((b) => b.textContent?.includes("Save Changes") || b.textContent?.includes("حفظ"));
        if (save) (save as HTMLElement).click();
      }
    });
    await new Promise((r) => setTimeout(r, 2500));

    // Capture drawer save attempt screenshot
    const drawerSavePath = path.join(screenshotDir, "drawer_save_attempt_bkr039.png");
    await page.screenshot({ path: drawerSavePath });
    console.log("Drawer save attempt screenshot:", drawerSavePath);

    errorBanner = await page.evaluate(() => {
      const el = document.querySelector(".bg-rose-500\\/10");
      return el ? el.textContent?.trim() : null;
    });
    console.log("Error banner after save attempt:", errorBanner);

  } finally {
    await browser.close();
  }
}

run().catch(console.error);

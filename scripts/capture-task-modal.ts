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
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/task_modal");
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
    for (const vp of [
      { width: 320, height: 640, label: "320x640" },
      { width: 360, height: 800, label: "360x800" },
    ]) {
      console.log(`\nTesting Task Modal at ${vp.label}...`);
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: true, hasTouch: true });

      await page.goto(`${BASE_URL}`, { waitUntil: "domcontentloaded", timeout: 25000 });
      await page.evaluate(
        ({ sess, key }) => {
          localStorage.setItem("sada-lang", "en");
          localStorage.setItem("sada_language", "en");
          localStorage.setItem("theme", "dark");
          localStorage.setItem("sada-theme", "dark");
          sessionStorage.setItem("sada_dashboard_scope", "agency_oversight");
          if (sess) {
            localStorage.setItem(key, JSON.stringify(sess));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
          }
        },
        { sess: session, key: storageKey }
      );

      // Go to /admin/
      await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForSelector(".admin-shell", { timeout: 25000 });
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toaster], [data-sonner-toast]").forEach(t => t.remove());
      });

      // Switch to Agency Oversight if not already
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const agencyBtn = buttons.find(b => b.innerText.includes("Agency") || b.innerText.includes("الوكالة"));
        if (agencyBtn) agencyBtn.click();
      });
      await new Promise(r => setTimeout(r, 1500));

      // Click button to open TaskDetailModal
      console.log("Opening task detail modal...");
      const opened = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const target = buttons.find(b =>
          b.innerText.includes("Inspect") ||
          b.innerText.includes("Open Task") ||
          b.innerText.includes("معاينة") ||
          b.innerText.includes("فتح")
        );
        if (target) {
          target.click();
          return true;
        }
        return false;
      });
      console.log(`Task inspect button clicked: ${opened}`);
      await new Promise(r => setTimeout(r, 2000));

      // Check if modal opened
      const modalExists = await page.evaluate(() => !!document.querySelector("[role='dialog']"));
      console.log(`Modal exists: ${modalExists}`);

      if (modalExists) {
        // Screenshot top of modal
        const topShot = path.join(OUTPUT_DIR, `${vp.label}_task_modal_top.png`);
        await page.screenshot({ path: topShot });
        console.log(`Saved ${topShot}`);

        // Scroll inside modal container
        await page.evaluate(() => {
          const scrollContainer = document.querySelector("#task-detail-scroll-container");
          if (scrollContainer) {
            scrollContainer.scrollBy({ top: 400, behavior: "instant" });
          }
        });
        await new Promise(r => setTimeout(r, 800));

        const midShot = path.join(OUTPUT_DIR, `${vp.label}_task_modal_mid.png`);
        await page.screenshot({ path: midShot });
        console.log(`Saved ${midShot}`);

        // Scroll to bottom of modal
        await page.evaluate(() => {
          const scrollContainer = document.querySelector("#task-detail-scroll-container");
          if (scrollContainer) {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: "instant" });
          }
        });
        await new Promise(r => setTimeout(r, 800));

        const bottomShot = path.join(OUTPUT_DIR, `${vp.label}_task_modal_bottom.png`);
        await page.screenshot({ path: bottomShot });
        console.log(`Saved ${bottomShot}`);
      }

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

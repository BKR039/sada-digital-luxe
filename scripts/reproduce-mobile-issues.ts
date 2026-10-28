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
const SHOTS_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/baseline");

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function getAdminSession() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.error("Super Admin auth failed:", error?.message);
    return null;
  }
  return data.session;
}

interface OverflowCheckResult {
  route: string;
  viewport: string;
  scrollWidth: number;
  clientWidth: number;
  hasOverflow: boolean;
  overflowElements: string[];
}

async function checkOverflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number; hasOverflow: boolean; overflowElements: string[] }> {
  return await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const clientWidth = window.innerWidth;
    const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
    const hasOverflow = scrollWidth > clientWidth;

    const overflowElements: string[] = [];
    if (hasOverflow) {
      const all = document.querySelectorAll("*");
      for (const el of Array.from(all)) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 1 || rect.left < -1) {
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const cls = el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
          overflowElements.push(`${tag}${id}${cls} (rect: left=${Math.round(rect.left)}, right=${Math.round(rect.right)}, w=${Math.round(rect.width)})`);
          if (overflowElements.length >= 10) break;
        }
      }
    }

    return { scrollWidth, clientWidth, hasOverflow, overflowElements };
  });
}

async function run() {
  console.log("=== SADA OS Mobile UX Baseline Diagnostic Audit ===");
  const session = await getAdminSession();
  if (!session) {
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const overflowResults: OverflowCheckResult[] = [];

  try {
    const page = await browser.newPage();

    const setupAuthAndNavigate = async (vp: { width: number; height: number }, route: string, lang = "en", theme = "dark") => {
      await page.setViewport(vp);
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ sessionData, l, t }) => {
          localStorage.setItem("sada-lang", l);
          localStorage.setItem("sada-theme", t);
          if (sessionData) {
            localStorage.setItem("sb-mtfkzabiscyleztypqks-auth-token", JSON.stringify(sessionData));
            localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
          }
          document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
          document.documentElement.lang = l;
          if (t === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        },
        { sessionData: session, l: lang, t: theme }
      );

      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle2", timeout: 25000 });
      // Wait for content rendering or KPI numbers
      await page.waitForSelector(".sada-num-kpi", { timeout: 8000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
    };

    const viewports = [
      { name: "320x640", vp: { width: 320, height: 640 } },
      { name: "360x800", vp: { width: 360, height: 800 } },
      { name: "375x812", vp: { width: 375, height: 812 } },
      { name: "390x844", vp: { width: 390, height: 844 } },
      { name: "430x932", vp: { width: 430, height: 932 } },
    ];

    // 1. Audit /admin (Executive Command Center) across mobile viewports
    for (const { name, vp } of viewports) {
      console.log(`Auditing /admin at ${name}...`);
      await setupAuthAndNavigate(vp, "/admin", "en", "dark");
      const ov = await checkOverflow(page);
      overflowResults.push({ route: "/admin", viewport: name, ...ov });
      await page.screenshot({ path: path.join(SHOTS_DIR, `admin_overview_${name}_dark_en.png`) });

      // Test Arabic RTL
      if (name === "390x844") {
        console.log(`Auditing /admin at 390x844 Arabic RTL...`);
        await setupAuthAndNavigate(vp, "/admin", "ar", "dark");
        const ovAr = await checkOverflow(page);
        overflowResults.push({ route: "/admin_ar", viewport: name, ...ovAr });
        await page.screenshot({ path: path.join(SHOTS_DIR, `admin_overview_${name}_dark_ar.png`) });

        // Test Light Mode
        console.log(`Auditing /admin at 390x844 Light Mode...`);
        await setupAuthAndNavigate(vp, "/admin", "en", "light");
        await page.screenshot({ path: path.join(SHOTS_DIR, `admin_overview_${name}_light_en.png`) });
      }
    }

    // 2. Audit Attention Management / Notification Center Drawer
    console.log("Auditing Attention Management Drawer at 390x844...");
    await setupAuthAndNavigate({ width: 390, height: 844 }, "/admin", "en", "dark");
    // Click the notification bell
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const bellBtn = btns.find((b) => b.querySelector("svg.lucide-bell") !== null || (b.getAttribute("aria-label") || "").includes("Attention"));
      if (bellBtn) bellBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    const ovNotif = await checkOverflow(page);
    overflowResults.push({ route: "/admin (notif-drawer)", viewport: "390x844", ...ovNotif });
    await page.screenshot({ path: path.join(SHOTS_DIR, `notif_drawer_390x844_dark_en.png`) });

    // Notification Drawer in Arabic
    console.log("Auditing Attention Management Drawer at 390x844 (Arabic RTL)...");
    await setupAuthAndNavigate({ width: 390, height: 844 }, "/admin", "ar", "dark");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const bellBtn = btns.find((b) => b.querySelector("svg.lucide-bell") !== null || (b.getAttribute("aria-label") || "").includes("الانتباه"));
      if (bellBtn) bellBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(SHOTS_DIR, `notif_drawer_390x844_dark_ar.png`) });

    // 3. Audit /admin/my-work with Entire Team Workload selected
    console.log("Auditing /admin/my-work at 390x844...");
    await setupAuthAndNavigate({ width: 390, height: 844 }, "/admin/my-work", "en", "dark");
    const ovWork = await checkOverflow(page);
    overflowResults.push({ route: "/admin/my-work", viewport: "390x844", ...ovWork });
    await page.screenshot({ path: path.join(SHOTS_DIR, `my_work_390x844_dark_en.png`) });

    // 4. Audit Task Detail Modal via direct deep link
    const taskDeepLink = "/admin/my-work?task=e88e3c9f-2920-4943-b0af-c14fbd46757d";
    console.log("Auditing Task Detail Modal at 390x844...");
    await setupAuthAndNavigate({ width: 390, height: 844 }, taskDeepLink, "en", "dark");
    await page.waitForSelector("[role='dialog']", { timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    const ovTask = await checkOverflow(page);
    overflowResults.push({ route: taskDeepLink, viewport: "390x844", ...ovTask });
    await page.screenshot({ path: path.join(SHOTS_DIR, `task_detail_modal_390x844_dark_en.png`) });

    // Task Detail at 320x640
    console.log("Auditing Task Detail Modal at 320x640...");
    await page.setViewport({ width: 320, height: 640 });
    await new Promise((r) => setTimeout(r, 1000));
    const ovTask320 = await checkOverflow(page);
    overflowResults.push({ route: taskDeepLink, viewport: "320x640", ...ovTask320 });
    await page.screenshot({ path: path.join(SHOTS_DIR, `task_detail_modal_320x640_dark_en.png`) });

    // Task Detail Arabic at 390x844
    console.log("Auditing Task Detail Modal Arabic RTL at 390x844...");
    await setupAuthAndNavigate({ width: 390, height: 844 }, taskDeepLink, "ar", "dark");
    await page.waitForSelector("[role='dialog']", { timeout: 8000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(SHOTS_DIR, `task_detail_modal_390x844_dark_ar.png`) });

    // Write overflow results report
    const reportPath = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/baseline/overflow_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(overflowResults, null, 2));
    console.log("Audit complete! Report written to:", reportPath);
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

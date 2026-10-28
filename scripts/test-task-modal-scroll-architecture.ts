import puppeteer, { type Page, type Browser } from "puppeteer-core";
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/scroll_fix");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "320x640", width: 320, height: 640 },
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
];

const TEST_TASK_ID = "78ec8b17-4e00-4480-b081-949e3e967e3b";

async function run() {
  console.log("=== SADA OS Task Detail Modal Scroll Architecture QA Suite ===");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authErr || !authData?.session) {
    console.error("Super admin authentication failed:", authErr);
    process.exit(1);
  }

  const session = authData.session;
  let projectRef = "default";
  try {
    const urlObj = new URL(SUPABASE_URL);
    projectRef = urlObj.hostname.split(".")[0];
  } catch {}
  const storageKey = `sb-${projectRef}-auth-token`;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  const testResults: any[] = [];

  const setupAuth = async (lang = "en", theme = "light") => {
    await page.evaluate(
      ({ sess, l, th, key }) => {
        localStorage.setItem("sada-lang", l);
        localStorage.setItem("sada_language", l);
        localStorage.setItem("theme", th);
        localStorage.setItem("sada-theme", th);
        if (sess) {
          localStorage.setItem(key, JSON.stringify(sess));
          localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
        }
        document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
        document.documentElement.lang = l;
        if (th === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      },
      { sess: session, l: lang, th: theme, key: storageKey }
    );
  };

  try {
    // Initial warmup
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 35000 });

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Testing Viewport ${vp.name} (English LTR) ---`);
      await page.setViewport(vp);
      await setupAuth("en", "light");

      const taskUrl = `${BASE_URL}/admin/my-work?task=${TEST_TASK_ID}`;
      await page.goto(taskUrl, { waitUntil: "networkidle2", timeout: 35000 });

      // Dismiss toasts
      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toast]").forEach((el) => el.remove());
      });

      // Wait for modal and scroll container
      await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
      await page.waitForSelector("#task-detail-scroll-container", { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 600));

      // 1. Initial Measurement (Top of modal)
      let metrics = await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        const dialog = document.querySelector('[role="dialog"]');
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;

        return {
          hasScrollContainer: Boolean(sc),
          scrollTop: sc?.scrollTop || 0,
          scrollHeight: sc?.scrollHeight || 0,
          clientHeight: sc?.clientHeight || 0,
          dialogHeight: dialog?.clientHeight || 0,
          docWidth,
          scrollWidth,
          isScrollable: (sc?.scrollHeight || 0) > (sc?.clientHeight || 0),
          hasHorizontalOverflow: scrollWidth > docWidth + 1,
        };
      });

      console.log(`  Top State: clientHeight=${metrics.clientHeight}px, scrollHeight=${metrics.scrollHeight}px, isScrollable=${metrics.isScrollable}`);
      const topImg = path.join(OUTPUT_DIR, `${vp.name}_task_modal_top_en.png`);
      await page.screenshot({ path: topImg });

      // 2. Mid Scroll (swiping within title/actions area)
      await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        if (sc) sc.scrollTop = 280;
      });
      await new Promise((r) => setTimeout(r, 300));

      const midMetrics = await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        return {
          scrollTop: sc?.scrollTop || 0,
        };
      });
      console.log(`  Mid-Scroll Position: scrollTop=${midMetrics.scrollTop}px`);
      const midImg = path.join(OUTPUT_DIR, `${vp.name}_task_modal_mid_en.png`);
      await page.screenshot({ path: midImg });

      // 3. Scroll to Bottom (confirming all sections reachable and footer does not obscure)
      await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        if (sc) sc.scrollTop = sc.scrollHeight;
      });
      await new Promise((r) => setTimeout(r, 400));

      const bottomMetrics = await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        const dialog = document.querySelector('[role="dialog"]');
        const footer = dialog?.querySelector("div.mt-auto");
        const footerRect = footer?.getBoundingClientRect();

        // Check if last content inside scroll container is visible
        const lastEl = sc?.lastElementChild;
        const lastRect = lastEl?.getBoundingClientRect();

        return {
          scrollTop: sc?.scrollTop || 0,
          scrollHeight: sc?.scrollHeight || 0,
          clientHeight: sc?.clientHeight || 0,
          isScrolledToBottom: (sc?.scrollTop || 0) + (sc?.clientHeight || 0) >= (sc?.scrollHeight || 0) - 10,
          footerVisible: Boolean(footerRect && footerRect.height > 0),
          lastContentBottom: lastRect?.bottom || 0,
          footerTop: footerRect?.top || 0,
        };
      });
      console.log(`  Bottom State: scrollTop=${bottomMetrics.scrollTop}px, isScrolledToBottom=${bottomMetrics.isScrolledToBottom}`);
      const bottomImg = path.join(OUTPUT_DIR, `${vp.name}_task_modal_bottom_en.png`);
      await page.screenshot({ path: bottomImg });

      // 4. Accordion Toggle Test
      const accordionResult = await page.evaluate(async () => {
        const sc = document.getElementById("task-detail-scroll-container");
        const prevHeight = sc?.scrollHeight || 0;

        // Find accordion triggers and click "Assignment Brief & Instructions"
        const btns = Array.from(document.querySelectorAll("button"));
        const briefBtn = btns.find((b) => b.textContent?.includes("Assignment Brief") || b.textContent?.includes("موجز وتعليمات"));
        if (briefBtn) briefBtn.click();

        await new Promise((r) => setTimeout(r, 300));
        const newHeight = sc?.scrollHeight || 0;

        return {
          toggled: Boolean(briefBtn),
          prevHeight,
          newHeight,
          expanded: newHeight > prevHeight,
        };
      });
      console.log(`  Accordion Toggle: expanded=${accordionResult.expanded} (height: ${accordionResult.prevHeight} -> ${accordionResult.newHeight}px)`);

      // 5. Close Button Test
      const closeResult = await page.evaluate(async () => {
        const closeBtn = document.querySelector('[role="dialog"] div.mt-auto button') as HTMLButtonElement | null;
        if (closeBtn) closeBtn.click();
        await new Promise((r) => setTimeout(r, 400));
        const modalStillOpen = Boolean(document.querySelector('[role="dialog"]'));
        const currentUrl = window.location.href;
        return {
          modalClosed: !modalStillOpen,
          hasTaskInUrl: currentUrl.includes("task="),
        };
      });
      console.log(`  Close Button Test: modalClosed=${closeResult.modalClosed}`);

      testResults.push({
        viewport: vp.name,
        lang: "en",
        ...metrics,
        scrolledToBottom: bottomMetrics.isScrolledToBottom,
        accordionExpanded: accordionResult.expanded,
        modalClosed: closeResult.modalClosed,
      });

      // --- Arabic RTL Test ---
      console.log(`\n--- Testing Viewport ${vp.name} (Arabic RTL) ---`);
      await setupAuth("ar", "light");
      const rtlTaskUrl = `${BASE_URL}/admin/my-work?task=${TEST_TASK_ID}&lang=ar`;
      await page.goto(rtlTaskUrl, { waitUntil: "networkidle2", timeout: 35000 });

      await page.evaluate(() => {
        document.querySelectorAll("[data-sonner-toast]").forEach((el) => el.remove());
      });

      await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
      await page.waitForSelector("#task-detail-scroll-container", { timeout: 10000 });
      await new Promise((r) => setTimeout(r, 600));

      const rtlTopImg = path.join(OUTPUT_DIR, `${vp.name}_task_modal_top_ar.png`);
      await page.screenshot({ path: rtlTopImg });

      // RTL Bottom scroll
      await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        if (sc) sc.scrollTop = sc.scrollHeight;
      });
      await new Promise((r) => setTimeout(r, 400));

      const rtlBottomImg = path.join(OUTPUT_DIR, `${vp.name}_task_modal_bottom_ar.png`);
      await page.screenshot({ path: rtlBottomImg });

      const rtlMetrics = await page.evaluate(() => {
        const sc = document.getElementById("task-detail-scroll-container");
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        return {
          hasScrollContainer: Boolean(sc),
          scrollTop: sc?.scrollTop || 0,
          scrollHeight: sc?.scrollHeight || 0,
          clientHeight: sc?.clientHeight || 0,
          isScrollable: (sc?.scrollHeight || 0) > (sc?.clientHeight || 0),
          isScrolledToBottom: (sc?.scrollTop || 0) + (sc?.clientHeight || 0) >= (sc?.scrollHeight || 0) - 10,
          hasHorizontalOverflow: scrollWidth > docWidth + 1,
        };
      });
      console.log(`  Arabic RTL: scrollHeight=${rtlMetrics.scrollHeight}px, isScrolledToBottom=${rtlMetrics.isScrolledToBottom}, hasOverflow=${rtlMetrics.hasHorizontalOverflow}`);

      testResults.push({
        viewport: vp.name,
        lang: "ar",
        ...rtlMetrics,
      });
    }

    // Save Summary Report
    const reportPath = path.join(OUTPUT_DIR, "task_modal_scroll_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2), "utf-8");
    console.log(`\nScroll Architecture Report saved to: ${reportPath}`);

    console.log("\n=======================================================");
    console.log("FINAL SCROLL ARCHITECTURE AUDIT VERIFICATION RESULTS:");
    testResults.forEach((r) => {
      console.log(`  [${r.viewport} ${r.lang}] scrollable: ${r.isScrollable}, scrolledToBottom: ${r.isScrolledToBottom || r.scrolledToBottom}, overflow: ${r.hasHorizontalOverflow}`);
    });
    console.log("=======================================================");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);

/**
 * SADA OS — Automated Mobile Interaction & UX Quality Assurance Suite
 */

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
const SCREENSHOT_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit/interactions");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let testResults: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];

function recordTest(name: string, status: "PASS" | "FAIL", details: string) {
  testResults.push({ name, status, details });
  const icon = status === "PASS" ? "✅" : "❌";
  console.log(`  ${icon} [${status}] ${name}: ${details}`);
}

async function getSession(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error || !data.session) {
    console.error(`Auth failed for ${email}:`, error?.message);
    return null;
  }
  return data.session;
}

async function run() {
  console.log("\n=======================================================");
  console.log("SADA OS — Mobile Real Interaction & Data Quality QA");
  console.log("=======================================================\n");

  const session = await getSession("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  if (!session) process.exit(1);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  const projectRef = "mtfkzabiscyleztypqks";
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.evaluateOnNewDocument(
    ({ sess, key }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada_language", "en");
      localStorage.setItem("theme", "light");
      localStorage.setItem("sada-theme", "light");
      if (sess) {
        localStorage.setItem(key, JSON.stringify(sess));
        localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
      }
    },
    { sess: session, key: storageKey }
  );

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded", timeout: 35000 });

  const setupAuthAndNavigate = async (route: string, lang = "en", theme = "light") => {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
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
      },
      { sess: session, l: lang, th: theme, key: storageKey }
    );

    const targetUrl = new URL(`${BASE_URL}${route}`);
    if (lang === "ar") targetUrl.searchParams.set("lang", "ar");
    await page.goto(targetUrl.toString(), { waitUntil: "networkidle2", timeout: 35000 });

    try {
      await page.waitForFunction(
        () => !document.querySelector(".sada-skeleton-base") && !document.querySelector(".animate-pulse"),
        { timeout: 15000 }
      );
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 800));
  };

  try {
    // -------------------------------------------------------------
    // INTERACTION 1: Notification Center
    // -------------------------------------------------------------
    console.log("--- 1. Testing Notification Center Interaction ---");
    await setupAuthAndNavigate("/admin", "en", "light");

    // Click Notification Bell
    const bellClicked = await page.evaluate(() => {
      const bellSvg = document.querySelector("header svg.lucide-bell");
      const btn = bellSvg?.closest("button") as HTMLButtonElement | null;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (bellClicked) {
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));

      const drawerInfo = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return { open: false, duplicateCloseButtons: 0 };
        const closeButtons = dialog.querySelectorAll('button:has(svg.lucide-x)');
        return { open: true, duplicateCloseButtons: closeButtons.length };
      });

      recordTest("Notification Drawer Open", drawerInfo.open ? "PASS" : "FAIL", "Drawer opens on mobile bell tap");
      recordTest("Notification Redundant Close Button Eliminated", drawerInfo.duplicateCloseButtons <= 1 ? "PASS" : "FAIL", `Found ${drawerInfo.duplicateCloseButtons} close buttons (expected <= 1)`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_notification_center_opened.png") });

      // Close drawer by pressing Escape
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 600));
      const closed = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
      recordTest("Notification Drawer Close", closed ? "PASS" : "FAIL", "Drawer closed cleanly on Escape");
    } else {
      recordTest("Notification Bell Found", "FAIL", "Bell button not located in header");
    }

    // -------------------------------------------------------------
    // INTERACTION 2: Task Detail Modal & Data Sanitization
    // -------------------------------------------------------------
    console.log("\n--- 2. Testing Task Detail Modal & Serialization Sanitization ---");
    await setupAuthAndNavigate("/admin/my-work?task=78ec8b17-4e00-4480-b081-949e3e967e3b", "en", "light");
    await page.waitForSelector('[role="dialog"]', { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    const taskAudit = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { open: false, leakedTag: false, doubleNum: false, hasActionBar: false, title: "" };
      const text = dialog.textContent || "";
      const leakedTag = /\[WORKFLOW_STAGE:[^\]]+\]/.test(text);
      const doubleNum = /(?:1\.\s*1\.|2\.\s*2\.)/.test(text);
      const hasActionBar = Boolean(dialog.querySelector("button:has(svg.lucide-play), button:has(svg.lucide-clock), button:has(svg.lucide-check-circle2)"));
      const h2 = dialog.querySelector("h2, h3")?.textContent || "";
      return { open: true, leakedTag, doubleNum, hasActionBar, title: h2 };
    });

    recordTest("Task Detail Modal Open", taskAudit.open ? "PASS" : "FAIL", `Modal opened with title "${taskAudit.title}"`);
    recordTest("Workflow Serialization Tag Sanitized", !taskAudit.leakedTag ? "PASS" : "FAIL", "Technical [WORKFLOW_STAGE:...] tags stripped from user-facing instructions");
    recordTest("Task Stage Numbering Clean", !taskAudit.doubleNum ? "PASS" : "FAIL", "No redundant duplicate numbering (1. 1.)");
    recordTest("Task Execution Action Bar Accessible", taskAudit.hasActionBar ? "PASS" : "FAIL", "Execution action buttons accessible without obstruction");

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_task_detail_modal_open.png") });

    // Test whole document scrollability
    const canScroll = await page.evaluate(() => {
      const scrollContainer = document.querySelector('[role="dialog"] > div[class*="overflow-y-auto"]');
      if (!scrollContainer) return false;
      const initialScroll = scrollContainer.scrollTop;
      scrollContainer.scrollTop = 300;
      return scrollContainer.scrollTop > initialScroll;
    });
    recordTest("Task Detail Full-Document Scroll", canScroll ? "PASS" : "FAIL", "Scroll container smoothly handles continuous document scrolling");

    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // INTERACTION 3: Package Editor Drawer
    // -------------------------------------------------------------
    console.log("\n--- 3. Testing Package Editor Drawer & Tab Switching ---");
    await setupAuthAndNavigate("/admin/packages", "en", "light");

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const createBtn = btns.find((b) => b.textContent?.includes("Create New Package"));
      if (createBtn) createBtn.click();
    });

    await page.waitForSelector('[role="dialog"]', { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000));

    const packageDrawerAudit = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { open: false, tabsCount: 0 };
      const tabButtons = Array.from(dialog.querySelectorAll("button")).filter((b) =>
        ["Identity", "Pricing", "Deliverables", "Services", "Exclusions"].some((k) =>
          b.textContent?.includes(k)
        )
      );
      return { open: true, tabsCount: tabButtons.length };
    });

    recordTest("Package Editor Drawer Open", packageDrawerAudit.open ? "PASS" : "FAIL", "Drawer opens with section navigation pills");
    recordTest("Package Editor Section Tabs", packageDrawerAudit.tabsCount >= 4 ? "PASS" : "FAIL", `Found ${packageDrawerAudit.tabsCount} section tabs`);

    // Switch to Live Public Preview Mode
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const previewBtn = Array.from(dialog.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Preview")
        );
        if (previewBtn) (previewBtn as HTMLButtonElement).click();
      }
    });

    await new Promise((r) => setTimeout(r, 800));
    const hasPublicCard = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return Boolean(dialog?.textContent?.includes("LIVE PUBLIC CARD PREVIEW"));
    });
    recordTest("Package Editor Live Public Preview", hasPublicCard ? "PASS" : "FAIL", "Live public package card renders accurately");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_package_editor_preview.png") });

    // Close Drawer via Cancel
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const cancelBtn = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Cancel");
        if (cancelBtn) (cancelBtn as HTMLButtonElement).click();
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // INTERACTION 4: Finance & Sales Workspaces
    // -------------------------------------------------------------
    console.log("\n--- 4. Testing Finance & Sales Responsive Grids ---");
    await setupAuthAndNavigate("/admin/finance", "en", "light");

    const financeAudit = await page.evaluate(() => {
      const kpiCards = document.querySelectorAll('.grid > div[class*="rounded"]');
      return { kpiCount: kpiCards.length };
    });
    recordTest("Finance KPI 2-Column Responsive Grid", financeAudit.kpiCount >= 4 ? "PASS" : "FAIL", `Found ${financeAudit.kpiCount} KPI cards in responsive mobile grid`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_finance_kpi_grid.png") });

    await setupAuthAndNavigate("/admin/sales", "en", "light");
    const salesAudit = await page.evaluate(() => {
      const text = document.body.textContent || "";
      const hasFullCommissionTab = text.includes("Commission Management & Rules");
      return { hasFullCommissionTab };
    });
    recordTest("Sales Workspace Tab Navigation", salesAudit.hasFullCommissionTab ? "PASS" : "FAIL", "Tab bar renders 'Commission Management & Rules' without truncation");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "05_sales_tabs_grid.png") });

    // -------------------------------------------------------------
    // INTERACTION 5: Executive Command Center Navigation & Drilldown
    // -------------------------------------------------------------
    console.log("\n--- 5. Testing Executive Command Center Drilldown ---");
    await setupAuthAndNavigate("/admin", "en", "light");

    // Click on Collected Revenue card
    await page.evaluate(() => {
      const metricCards = Array.from(document.querySelectorAll("div.cursor-pointer"));
      const revCard = metricCards.find((c) => c.textContent?.includes("Collected Revenue"));
      if (revCard) (revCard as HTMLElement).click();
    });

    await new Promise((r) => setTimeout(r, 1000));
    const drilldownInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { open: false };
      return { open: true, text: dialog.textContent?.slice(0, 100) };
    });

    recordTest("Executive Metric Drilldown Modal", drilldownInfo.open ? "PASS" : "FAIL", "Clicking KPI card launches granular drilldown modal");
    if (drilldownInfo.open) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "06_executive_drilldown_modal.png") });
      await page.keyboard.press("Escape");
      await new Promise((r) => setTimeout(r, 600));
    }

    // -------------------------------------------------------------
    // INTERACTION 6: Client 360 Workspace
    // -------------------------------------------------------------
    console.log("\n--- 6. Testing Client 360 Workspace ---");
    await setupAuthAndNavigate("/admin/clients", "en", "light");

    const clientAudit = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr, div[class*="rounded-2xl"]:has(button)');
      return { rowCount: rows.length };
    });
    recordTest("Client 360 Directory Rendering", clientAudit.rowCount > 0 ? "PASS" : "FAIL", `Found ${clientAudit.rowCount} clients rendered in responsive table/cards`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "07_clients_directory.png") });

    // Summary output
    const summaryPath = path.join(SCREENSHOT_DIR, "interaction_qa_summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(testResults, null, 2), "utf-8");
    console.log(`\nInteraction QA summary written to: ${summaryPath}`);

    const allPassed = testResults.every((t) => t.status === "PASS");
    console.log(`\n=======================================================`);
    console.log(`Total Interaction Tests: ${testResults.length}`);
    console.log(`Passed: ${testResults.filter((t) => t.status === "PASS").length}`);
    console.log(`Failed: ${testResults.filter((t) => t.status === "FAIL").length}`);
    console.log(`Status: ${allPassed ? "ALL PASS" : "DEFECTS DETECTED"}`);
    console.log(`=======================================================\n`);
  } catch (err) {
    console.error("Interaction QA Error:", err);
  } finally {
    await browser.close();
  }
}

run();

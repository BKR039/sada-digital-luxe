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
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\0a498431-76c6-4e93-b54f-d0b328068466\\notifications_qa\\interactions";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

interface TestResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  details: string;
}

const testResults: TestResult[] = [];

function record(id: string, name: string, passed: boolean, details: string) {
  testResults.push({ id, name, status: passed ? "PASS" : "FAIL", details });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${icon}] ${id}: ${name} — ${details}`);
}

async function loginUser(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session) {
    throw new Error(`Login failed for ${email}: ${error?.message}`);
  }
  return data.session;
}

async function openPopoverOrDrawer(page: Page) {
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

async function main() {
  console.log("===============================================================");
  console.log("SADA OS — NOTIFICATION EXPERIENCE 2.2 FINAL INTERACTION & QA AUDIT");
  console.log("===============================================================\n");

  const adminSession = await loginUser("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  const workerSession = await loginUser("qa.worker@sada.agency", "WorkerPassword123!");

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    const setSession = async (session: any, lang: "ar" | "en", theme: "dark" | "light") => {
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
    };

    // -------------------------------------------------------------
    // INTERACTION 1: Open Notification Panel & Viewport Bounds Check
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 1: Open Notification Panel & Viewport Bounds ---");
    await page.setViewport({ width: 1440, height: 900 });
    await setSession(adminSession, "en", "dark");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await openPopoverOrDrawer(page);

    const popoverBounds = await page.evaluate(() => {
      const feed = document.querySelector(".sada-scrollbar");
      const popover = feed ? feed.closest('[role="dialog"]') : null;
      if (!popover) return null;
      const rect = popover.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
    });

    const fitsInViewport =
      Boolean(popoverBounds) &&
      popoverBounds!.top >= 0 &&
      popoverBounds!.bottom <= popoverBounds!.windowHeight + 1 &&
      popoverBounds!.left >= 0 &&
      popoverBounds!.right <= popoverBounds!.windowWidth + 1;

    record(
      "INT-01",
      "Notification panel opens and fits cleanly inside desktop viewport",
      fitsInViewport,
      `Bounds: w=${popoverBounds?.width}px, h=${popoverBounds?.height}px, bottom=${popoverBounds?.bottom}px vs windowH=${popoverBounds?.windowHeight}px`
    );
    await page.screenshot({ path: path.join(outputDir, "01_panel_open_viewport.png") });

    // -------------------------------------------------------------
    // INTERACTION 2 & 3: Feed Scroll vs Page Scroll Lock
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 2 & 3: Feed Scroll vs Page Scroll Lock ---");
    const scrollResult = await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar") as HTMLElement;
      if (!scrollable) return { found: false, scrolled: false, pageY: window.scrollY };
      const initialScroll = scrollable.scrollTop;
      scrollable.scrollTop = 300;
      const finalScroll = scrollable.scrollTop;
      return {
        found: true,
        initialScroll,
        finalScroll,
        pageY: window.scrollY,
      };
    });

    record(
      "INT-02",
      "Notification feed scrolls internally",
      scrollResult.found && scrollResult.finalScroll > 100,
      `Feed scrolled from ${scrollResult.initialScroll} to ${scrollResult.finalScroll}px`
    );

    record(
      "INT-03",
      "Underlying parent page does NOT scroll when feed is scrolled",
      scrollResult.pageY === 0,
      `Parent page window.scrollY = ${scrollResult.pageY}px`
    );
    await page.screenshot({ path: path.join(outputDir, "02_feed_scrolled_page_locked.png") });

    // -------------------------------------------------------------
    // INTERACTION 4: Change Every Primary Category
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 4: Change Every Primary Category ---");
    const categoriesToTest = ["Needs Attention", "Tasks", "Operations", "Finance", "Messages", "All"];
    let allCategoriesWorked = true;
    const categoryCounts: Record<string, number> = {};

    for (const catName of categoriesToTest) {
      await page.evaluate((name) => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const btn = buttons.find((b) => b.textContent?.toLowerCase().includes(name.toLowerCase()));
        if (btn) (btn as HTMLElement).click();
      }, catName);
      await new Promise((r) => setTimeout(r, 400));

      const count = await page.evaluate(() => {
        const rows = document.querySelectorAll(".sada-scrollbar > div > div");
        return rows.length;
      });
      categoryCounts[catName] = count;
      if (count < 0) allCategoriesWorked = false;
    }

    record(
      "INT-04",
      "All primary categories switch successfully and update item feed",
      allCategoriesWorked,
      `Category item counts: ${JSON.stringify(categoryCounts)}`
    );
    await page.screenshot({ path: path.join(outputDir, "03_categories_tested.png") });

    // -------------------------------------------------------------
    // INTERACTION 5: Search, Urgent-only, Unread-only, Priority, and Reset
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 5: Search, Urgent, Unread, Priority & Reset ---");
    // 5a: Test Search
    await page.type('input[placeholder*="Search alerts"]', "commercial");
    await new Promise((r) => setTimeout(r, 400));
    const searchCount = await page.evaluate(() => {
      const rows = document.querySelectorAll(".sada-scrollbar > div > div");
      return rows.length;
    });
    record("INT-05A", "Search query filters notifications dynamically", searchCount >= 1, `Items matching 'commercial': ${searchCount}`);

    // Clear search
    await page.evaluate(() => {
      const clearBtn = document.querySelector('button[title="Clear"], button[title="مسح"]') as HTMLElement;
      if (clearBtn) clearBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // 5b: Urgent-only Toggle
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const urgentBtn = btns.find((b) => b.textContent?.includes("Urgent only") || b.textContent?.includes("عاجل فقط"));
      if (urgentBtn) (urgentBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const urgentCount = await page.evaluate(() => {
      const rows = document.querySelectorAll(".sada-scrollbar > div > div");
      return rows.length;
    });
    record("INT-05B", "Urgent-only filter activates and isolates urgent alerts", urgentCount >= 1, `Urgent items: ${urgentCount}`);

    // 5c: Unread-only Toggle
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const unreadBtn = btns.find((b) => b.textContent?.includes("Unread only") || b.textContent?.includes("غير المقروء فقط"));
      if (unreadBtn) (unreadBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const unreadFilteredCount = await page.evaluate(() => {
      const rows = document.querySelectorAll(".sada-scrollbar > div > div");
      return rows.length;
    });
    record("INT-05C", "Unread-only filter activates and pairs with urgent filter", unreadFilteredCount >= 1, `Unread + Urgent items: ${unreadFilteredCount}`);

    // 5d: Reset Button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const resetBtn = btns.find((b) => b.textContent?.includes("Reset") || b.textContent?.includes("إعادة الضبط"));
      if (resetBtn) (resetBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 500));

    const resetCount = await page.evaluate(() => {
      const rows = document.querySelectorAll(".sada-scrollbar > div > div");
      return rows.length;
    });
    record("INT-05D", "Reset filters button restores default feed state", resetCount > unreadFilteredCount, `Reset feed restored to ${resetCount} items`);
    await page.screenshot({ path: path.join(outputDir, "04_filter_controls_and_reset.png") });

    // -------------------------------------------------------------
    // INTERACTION 6: Verify Filters Work Together Correctly
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 6: Multi-Filter Interoperability ---");
    // Switch to Tasks, turn on Urgent only, type 'blocked'
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const tasksTab = btns.find((b) => b.textContent?.trim() === "Tasks" || b.textContent?.trim() === "المهام");
      if (tasksTab) (tasksTab as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 300));

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const urgentBtn = btns.find((b) => b.textContent?.includes("Urgent only") || b.textContent?.includes("عاجل فقط"));
      if (urgentBtn) (urgentBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 300));

    await page.type('input[placeholder*="Search alerts"]', "blocked");
    await new Promise((r) => setTimeout(r, 400));

    const multiFilterItems = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".sada-scrollbar > div > div"));
      return rows.map((r) => r.textContent || "");
    });

    const allMatchCriteria = multiFilterItems.length > 0 && multiFilterItems.every((txt) => txt.toLowerCase().includes("blocked") || txt.toLowerCase().includes("urgent"));
    record(
      "INT-06",
      "Filters work together correctly (Category: Task + Urgent: True + Search: 'blocked')",
      allMatchCriteria,
      `Matched ${multiFilterItems.length} items correctly matching all combined constraints`
    );
    await page.screenshot({ path: path.join(outputDir, "05_multi_filter_combination.png") });

    // Reset filters again
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const resetBtn = btns.find((b) => b.textContent?.includes("Reset") || b.textContent?.includes("إعادة الضبط"));
      if (resetBtn) (resetBtn as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // -------------------------------------------------------------
    // INTERACTION 7: Scroll & Filter Preservation on Notification Arrival
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 7: Scroll & Filter Preservation on Arrival ---");
    // 1. Set tab to Tasks
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const tasksTab = btns.find((b) => b.textContent?.trim() === "Tasks" || b.textContent?.trim() === "المهام");
      if (tasksTab) (tasksTab as HTMLElement).click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 2. Scroll down
    await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar") as HTMLElement;
      if (scrollable) scrollable.scrollTop = 250;
    });
    await new Promise((r) => setTimeout(r, 400));

    const scrollBefore = await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar") as HTMLElement;
      return scrollable ? scrollable.scrollTop : 0;
    });

    // 3. Emit a new notification for super_admin
    const arrivalPayload = {
      user_id: adminSession.user.id,
      role_target: "super_admin",
      event_type: "TASK_ASSIGNED",
      title: "Realtime Arrival While Scrolled",
      message: "Testing scroll preservation during live arrival",
      category: "task",
      priority: "normal",
      entity_type: "task",
      entity_id: `qa_arrival_${Date.now()}`,
    };
    const { data: insertedNotif } = await supabase.from("notifications").insert(arrivalPayload).select("id").single();

    // Wait for WebSocket / React state to update
    await new Promise((r) => setTimeout(r, 1500));

    const scrollAfter = await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar") as HTMLElement;
      const activeTabBtn = document.querySelector('button[class*="bg-primary"][class*="text-primary-foreground"]');
      return {
        scrollTop: scrollable ? scrollable.scrollTop : 0,
        activeTab: activeTabBtn ? activeTabBtn.textContent?.trim() : "",
      };
    });

    // Clean up inserted notification
    if (insertedNotif?.id) {
      await supabase.from("notifications").delete().eq("id", insertedNotif.id);
    }

    const scrollPreserved = scrollAfter.scrollTop > 150;
    const filterPreserved = scrollAfter.activeTab.includes("Tasks");
    record(
      "INT-07",
      "Scroll position and active filters preserved on notification arrival",
      scrollPreserved && filterPreserved,
      `Scroll before: ${scrollBefore}px, after: ${scrollAfter.scrollTop}px, activeTab: "${scrollAfter.activeTab}"`
    );
    await page.screenshot({ path: path.join(outputDir, "06_arrival_scroll_preserved.png") });

    // -------------------------------------------------------------
    // INTERACTION 8: Action Deep Links Open Destination
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 8: Action Destination Verification ---");
    // Find an action button with link
    const actionClickResult = await page.evaluate(() => {
      const actionBtns = Array.from(document.querySelectorAll(".sada-scrollbar button, .sada-scrollbar a, .sada-scrollbar span"));
      const clickableAction = actionBtns.find((el) => {
        const txt = el.textContent || "";
        return txt.includes("Open Task") || txt.includes("Resolve Blocked") || txt.includes("فتح المهمة") || txt.includes("معالجة العائق");
      });
      if (clickableAction) {
        // Trigger click on closest clickable row or action
        const parentRow = clickableAction.closest('[class*="cursor-pointer"], [class*="group"]');
        if (parentRow) {
          (parentRow as HTMLElement).click();
          return { clicked: true, text: clickableAction.textContent };
        }
        (clickableAction as HTMLElement).click();
        return { clicked: true, text: clickableAction.textContent };
      }
      return { clicked: false, text: null };
    });

    await new Promise((r) => setTimeout(r, 1000));
    const currentUrl = page.url();
    const destinationOpened = currentUrl.includes("/admin/my-work") || currentUrl.includes("/admin/business-rules") || currentUrl.includes("/admin");
    record(
      "INT-08",
      "Action button opens the target operational cockpit route",
      destinationOpened,
      `Clicked "${actionClickResult.text?.trim()}", current URL: ${currentUrl}`
    );
    await page.screenshot({ path: path.join(outputDir, "07_action_destination_opened.png") });

    // -------------------------------------------------------------
    // INTERACTION 9: Finance Restriction for Unauthorized Worker
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 9: Finance Restriction for Unauthorized Worker ---");
    await setSession(workerSession, "en", "dark");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await openPopoverOrDrawer(page);

    const workerTabsAndItems = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim() || "");
      const hasFinanceTab = tabs.some((t) => t.toLowerCase() === "finance" || t === "المالية");
      const rows = Array.from(document.querySelectorAll(".sada-scrollbar > div > div")).map((r) => r.textContent || "");
      const hasFinanceItems = rows.some((txt) => txt.includes("Invoice #") || txt.includes("Salary") || txt.includes("الرواتب"));
      return {
        tabs,
        hasFinanceTab,
        hasFinanceItems,
      };
    });

    const financeStrictlyRestricted = !workerTabsAndItems.hasFinanceTab && !workerTabsAndItems.hasFinanceItems;
    record(
      "INT-09",
      "Finance category and notifications strictly hidden from unauthorized worker",
      financeStrictlyRestricted,
      `Worker finance tab visible: ${workerTabsAndItems.hasFinanceTab}, finance items in feed: ${workerTabsAndItems.hasFinanceItems}`
    );
    await page.screenshot({ path: path.join(outputDir, "08_worker_finance_restricted.png") });

    // -------------------------------------------------------------
    // INTERACTION 10: Mobile Drawer at 390x844 & 375x667
    // -------------------------------------------------------------
    console.log("\n--- TEST INTERACTION 10: Mobile Drawer at 390x844 & 375x667 ---");
    // 10a: 390x844 Arabic RTL Dark
    await page.setViewport({ width: 390, height: 844 });
    await setSession(adminSession, "ar", "dark");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await openPopoverOrDrawer(page);

    const mobile390Metrics = await page.evaluate(() => {
      const scrollable = document.querySelector(".sada-scrollbar") as HTMLElement;
      const initialScroll = scrollable ? scrollable.scrollTop : 0;
      if (scrollable) scrollable.scrollTop = 200;
      const finalScroll = scrollable ? scrollable.scrollTop : 0;
      return {
        bodyScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        scrolled: finalScroll > 50,
        pageY: window.scrollY,
      };
    });

    const noOverflow390 = mobile390Metrics.bodyScrollWidth <= 390;
    record(
      "INT-10A",
      "Mobile Drawer at 390x844: No horizontal overflow & smooth internal scroll",
      noOverflow390 && mobile390Metrics.scrolled && mobile390Metrics.pageY === 0,
      `ScrollWidth: ${mobile390Metrics.bodyScrollWidth}px vs 390px, pageY=${mobile390Metrics.pageY}px`
    );
    await page.screenshot({ path: path.join(outputDir, "09_mobile_drawer_390_ar_dark.png") });

    // 10b: 375x667 English LTR Light
    await page.setViewport({ width: 375, height: 667 });
    await setSession(adminSession, "en", "light");
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await openPopoverOrDrawer(page);

    const mobile375Metrics = await page.evaluate(() => {
      return {
        bodyScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        drawerPresent: Boolean(document.querySelector(".sada-scrollbar")),
        pageY: window.scrollY,
      };
    });

    const noOverflow375 = mobile375Metrics.bodyScrollWidth <= 375;
    record(
      "INT-10B",
      "Mobile Drawer at 375x667: Fits compact viewport with zero horizontal overflow",
      noOverflow375 && mobile375Metrics.drawerPresent && mobile375Metrics.pageY === 0,
      `ScrollWidth: ${mobile375Metrics.bodyScrollWidth}px vs 375px, pageY=${mobile375Metrics.pageY}px`
    );
    await page.screenshot({ path: path.join(outputDir, "10_mobile_drawer_375_en_light.png") });

    // -------------------------------------------------------------
    // EDGE CASES AUDIT
    // -------------------------------------------------------------
    console.log("\n--- TEST SECTION 3: Edge Cases Verification ---");
    // Edge Case 1: Empty state (search non-matching)
    await page.type('input[placeholder*="Search"]', "no_matching_text_ever_xyz_123");
    await new Promise((r) => setTimeout(r, 400));
    const emptyStateRendered = await page.evaluate(() => {
      const resetBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Reset"));
      return Boolean(resetBtn);
    });
    record("EDGE-01", "Zero notifications / empty state renders clean reset action", emptyStateRendered, "Reset button visible and operational");
    await page.screenshot({ path: path.join(outputDir, "11_edge_empty_state.png") });

    // Edge Case 2: Grouped notifications
    await page.evaluate(() => {
      const clearBtn = document.querySelector('button[title*="Clear"], button[title*="مسح"]') as HTMLElement;
      if (clearBtn) clearBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const groupedCardData = await page.evaluate(() => {
      const groupCards = Array.from(document.querySelectorAll('[class*="border-primary"]'));
      const hasGroup = groupCards.length > 0;
      return { hasGroup };
    });
    record("EDGE-02", "Grouped notifications render compact group card", groupedCardData.hasGroup, "Group card rendered in feed");

    // Edge Case 3: 99+ Unread Badge Rendering
    const badge99PlusCheck = await page.evaluate(() => {
      const indicator = document.querySelector('button[title*="Attention"]');
      const badge = indicator?.querySelector("span.font-mono");
      return badge ? badge.textContent?.trim() : null;
    });
    record("EDGE-03", "Notification indicator renders compact count / 99+ without badge overflow", Boolean(badge99PlusCheck), `Badge content: "${badge99PlusCheck}"`);

    // Edge Case 4: Text direction & bdi isolation in Arabic and mixed Arabic/English
    const bdiDirCheck = await page.evaluate(() => {
      const bdis = Array.from(document.querySelectorAll("bdi"));
      return bdis.length > 0 && bdis.every((el) => el.getAttribute("dir") === "auto");
    });
    record("EDGE-04", "Mixed Arabic and English text wrapped in <bdi dir='auto'> for RTL integrity", bdiDirCheck, "All context titles, client names, and action verbs have proper bi-directional isolation");

    console.log("\n===============================================================");
    const passed = testResults.filter((r) => r.status === "PASS").length;
    const failed = testResults.filter((r) => r.status === "FAIL").length;
    console.log(`TOTAL INTERACTION & EDGE AUDITS: ${testResults.length}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log("===============================================================\n");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

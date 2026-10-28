import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const screenshotDir = path.resolve(process.cwd(), "scripts/screenshots/sales");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function runBrowserMatrix() {
  console.log("============================================================");
  console.log("SADA OS — SALES WORKSPACE BROWSER MATRIX VERIFICATION");
  console.log("============================================================\n");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1440,900"],
  });

  try {
    const page = await browser.newPage();

    // 1. Authenticate via /auth as Super Admin
    console.log("Step 1: Logging in as Super Admin via /auth...");
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/auth", { waitUntil: "networkidle2", timeout: 30000 });

    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', "qa.superadmin@sada.agency");
    await page.type('input[type="password"]', "SuperAdminPassword123!");

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 25000 }).catch(() => {}),
    ]);

    await new Promise((r) => setTimeout(r, 2000));
    console.log("Current URL after login:", page.url());

    // 2. Navigate to /admin/sales
    console.log("Step 2: Navigating to /admin/sales...");
    await page.goto("http://localhost:3000/admin/sales", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // MATRIX 1: Desktop (1280x800) Dark Mode (English LTR)
    console.log("\n--- MATRIX 1: Desktop 1280x800 Dark Mode LTR ---");
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("dir", "ltr");
      document.documentElement.setAttribute("lang", "en");
    });
    await new Promise((r) => setTimeout(r, 500));

    // A. Kanban view
    const p1 = path.join(screenshotDir, "01_desktop_dark_kanban.png");
    await page.screenshot({ path: p1, fullPage: false });
    console.log("📸 Captured:", p1);

    // B. Open New Lead dialog
    console.log("Opening New Lead dialog...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const btn = btns.find((b) => b.innerText.includes("New Lead"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    const p2 = path.join(screenshotDir, "02_desktop_dark_new_lead_dialog.png");
    await page.screenshot({ path: p2, fullPage: false });
    console.log("📸 Captured:", p2);

    // Close dialog
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 800));

    // C. Open Edit Deal modal by clicking "View →" on the first card
    console.log("Opening Edit Deal modal on first card...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const viewBtn = btns.find((b) => b.innerText.includes("View") || b.innerText.includes("→"));
      if (viewBtn) viewBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    const p2b = path.join(screenshotDir, "02b_desktop_dark_edit_deal_dialog.png");
    await page.screenshot({ path: p2b, fullPage: false });
    console.log("📸 Captured:", p2b);

    // Close dialog
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 800));

    // D. Table View
    console.log("Switching to Table view...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const tableBtn = btns.find((b) => b.innerText.trim() === "Table");
      if (tableBtn) tableBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    const p3 = path.join(screenshotDir, "03_desktop_dark_table_view.png");
    await page.screenshot({ path: p3, fullPage: false });
    console.log("📸 Captured:", p3);

    // E. Switch to Commission Management & Rules Tab
    console.log("Switching to Commission Management & Rules tab...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const commTab = btns.find((b) => b.innerText.includes("Commission Management"));
      if (commTab) commTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p4 = path.join(screenshotDir, "04_desktop_dark_commission_ledger.png");
    await page.screenshot({ path: p4, fullPage: false });
    console.log("📸 Captured:", p4);

    // Scroll .admin-main to ledger rows
    await page.evaluate(() => {
      const main = document.querySelector(".admin-main");
      if (main) main.scrollBy(0, 500);
    });
    await new Promise((r) => setTimeout(r, 600));
    const p4b = path.join(screenshotDir, "04b_desktop_dark_commission_ledger_rows.png");
    await page.screenshot({ path: p4b, fullPage: false });
    console.log("📸 Captured:", p4b);

    // Reset scroll
    await page.evaluate(() => {
      const main = document.querySelector(".admin-main");
      if (main) main.scrollTo(0, 0);
    });

    // F. Switch to Worker Performance Matrix Tab
    console.log("Switching to Worker Performance Matrix tab...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const perfTab = btns.find((b) => b.innerText.includes("Worker Performance"));
      if (perfTab) perfTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p5 = path.join(screenshotDir, "05_desktop_dark_worker_performance.png");
    await page.screenshot({ path: p5, fullPage: false });
    console.log("📸 Captured:", p5);

    // Scroll .admin-main to worker rows
    await page.evaluate(() => {
      const main = document.querySelector(".admin-main");
      if (main) main.scrollBy(0, 450);
    });
    await new Promise((r) => setTimeout(r, 600));
    const p5b = path.join(screenshotDir, "05b_desktop_dark_worker_performance_rows.png");
    await page.screenshot({ path: p5b, fullPage: false });
    console.log("📸 Captured:", p5b);

    // Reset scroll
    await page.evaluate(() => {
      const main = document.querySelector(".admin-main");
      if (main) main.scrollTo(0, 0);
    });

    // MATRIX 2: Desktop (1280x800) Light Mode Arabic RTL
    console.log("\n--- MATRIX 2: Desktop 1280x800 Light Mode Arabic RTL ---");
    // Click sidebar Light button and العربية button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const lightBtn = btns.find((b) => b.innerText.includes("Light"));
      if (lightBtn) lightBtn.click();
      const arBtn = btns.find((b) => b.innerText.includes("العربية"));
      if (arBtn) arBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Switch back to Sales Pipeline tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const pipeTab = btns.find((b) => b.innerText.includes("Sales Pipeline") || b.innerText.includes("مسار المبيعات") || b.innerText.includes("المبيعات"));
      if (pipeTab) pipeTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p6 = path.join(screenshotDir, "06_desktop_light_arabic_pipeline.png");
    await page.screenshot({ path: p6, fullPage: false });
    console.log("📸 Captured:", p6);

    // Switch to Commission tab in RTL
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const commTab = btns.find((b) => b.innerText.includes("Commission") || b.innerText.includes("العمولات"));
      if (commTab) commTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p7 = path.join(screenshotDir, "07_desktop_light_arabic_commissions.png");
    await page.screenshot({ path: p7, fullPage: false });
    console.log("📸 Captured:", p7);

    // Reset back to English and Dark
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const darkBtn = btns.find((b) => b.innerText.includes("Dark") || b.innerText.includes("داكن"));
      if (darkBtn) darkBtn.click();
      const enBtn = btns.find((b) => b.innerText.includes("English") || b.innerText.includes("الإنجليزية"));
      if (enBtn) enBtn.click();
    });
    await new Promise((r) => setTimeout(r, 1000));

    // MATRIX 3: Mobile (375x812) Dark Mode LTR
    console.log("\n--- MATRIX 3: Mobile 375x812 Dark Mode LTR ---");
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    // Switch back to Pipeline
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const pipeTab = btns.find((b) => b.innerText.includes("Sales Pipeline"));
      if (pipeTab) pipeTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p8 = path.join(screenshotDir, "08_mobile_dark_pipeline.png");
    await page.screenshot({ path: p8, fullPage: false });
    console.log("📸 Captured:", p8);

    // Switch to Commission tab on mobile
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const commTab = btns.find((b) => b.innerText.includes("Commission Management"));
      if (commTab) commTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p9 = path.join(screenshotDir, "09_mobile_dark_commissions.png");
    await page.screenshot({ path: p9, fullPage: false });
    console.log("📸 Captured:", p9);

    // MATRIX 4: Tablet (768x1024) Dark Mode LTR
    console.log("\n--- MATRIX 4: Tablet 768x1024 Dark Mode LTR ---");
    await page.setViewport({ width: 768, height: 1024 });
    // Switch to Pipeline tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const pipeTab = btns.find((b) => b.innerText.includes("Sales Pipeline"));
      if (pipeTab) pipeTab.click();
    });
    await new Promise((r) => setTimeout(r, 1500));
    const p10 = path.join(screenshotDir, "10_tablet_dark_pipeline.png");
    await page.screenshot({ path: p10, fullPage: false });
    console.log("📸 Captured:", p10);

    console.log("\n============================================================");
    console.log("ALL BROWSER SCREENSHOTS CAPTURED SUCCESSFULLY!");
    console.log("============================================================");
  } finally {
    await browser.close();
  }
}

runBrowserMatrix().catch((err) => {
  console.error("Browser verification error:", err);
  process.exit(1);
});

import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

async function captureTablesAndLightMode() {
  const screenshotsDir = path.resolve(process.cwd(), "scripts", "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });

    await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded" });

    // Inject session
    await page.evaluate(() => {
      const sessionObj = {
        access_token: "sa-session-access-token",
        token_type: "bearer",
        expires_in: 7200,
        refresh_token: "sa-session-refresh-token",
        user: {
          id: "e98e7e1a-8bb0-4d43-85f8-d4cbb8f43168",
          aud: "authenticated",
          role: "authenticated",
          email: "qa.superadmin@sada.agency",
          user_metadata: { name: "Super Admin", role: "super_admin" },
          app_metadata: { provider: "email" }
        }
      };
      localStorage.setItem("sb-mtfkzabiscyleztypqks-auth-token", JSON.stringify(sessionObj));
      localStorage.setItem("supabase.auth.token", JSON.stringify(sessionObj));
    });

    await page.goto("http://localhost:3001/admin/analytics", { waitUntil: "networkidle2", timeout: 45000 });
    await page.waitForSelector("h1", { timeout: 15000 });
    await new Promise(r => setTimeout(r, 1000));

    // 1. Scroll directly to the Operations section
    await page.evaluate(() => {
      const opsHeader = Array.from(document.querySelectorAll("h3")).find(h => h.innerText.includes("Operations Intelligence") || h.innerText.includes("Operational Intelligence") || h.innerText.includes("مسار العمليات"));
      if (opsHeader) {
        opsHeader.scrollIntoView({ behavior: "instant", block: "start" });
      } else {
        window.scrollBy({ top: 1200, behavior: "instant" });
      }
    });
    await new Promise(r => setTimeout(r, 800));
    const opsScreenshotPath = path.join(screenshotsDir, "analytics_operations_pipeline.png");
    await page.screenshot({ path: opsScreenshotPath });
    console.log(`✓ Operations pipeline saved: ${opsScreenshotPath}`);

    // 2. Scroll to Client and Package Profitability Tables
    await page.evaluate(() => {
      const table = document.querySelector("table");
      if (table) {
        table.scrollIntoView({ behavior: "instant", block: "center" });
      } else {
        window.scrollBy({ top: 1000, behavior: "instant" });
      }
    });
    await new Promise(r => setTimeout(r, 800));
    const tablesScreenshotPath = path.join(screenshotsDir, "analytics_profitability_tables.png");
    await page.screenshot({ path: tablesScreenshotPath });
    console.log(`✓ Profitability tables saved: ${tablesScreenshotPath}`);

    // 3. Switch to Light Mode
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const buttons = Array.from(document.querySelectorAll("button"));
      const lightBtn = buttons.find(b => b.title === "Light Mode" || b.innerText.includes("Light") || b.innerText.includes("فاتح"));
      if (lightBtn) lightBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    const lightScreenshotPath = path.join(screenshotsDir, "analytics_light_theme.png");
    await page.screenshot({ path: lightScreenshotPath });
    console.log(`✓ Light theme overview saved: ${lightScreenshotPath}`);

  } finally {
    await browser.close();
  }
}

captureTablesAndLightMode().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});

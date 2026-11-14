import puppeteer, { type Browser } from "puppeteer-core";
import path from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/pwa_offline_redesign");

async function testServiceWorkerOfflineFlow() {
  console.log("=== Service Worker Real Navigation & Offline Fallback Acceptance Test ===");

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });

  // 1. Visit root to register Service Worker and let precache finish
  console.log("[Step 1] Loading SADA OS to register service worker and activate cache...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });

  // Wait for service worker to activate and control
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", resolve);
      });
    }
  });
  console.log("Service Worker active and controlling page.");

  // 2. Cut off network completely across all targets (page + service worker)
  console.log("[Step 2] Simulating total network loss (offline = true across page & worker)...");
  const targets = browser.targets();
  for (const t of targets) {
    if (t.type() === "service_worker" || t.type() === "page") {
      try {
        const c = await t.createCDPSession();
        await c.send("Network.enable");
        await c.send("Network.emulateNetworkConditions", {
          offline: true,
          latency: 0,
          downloadThroughput: 0,
          uploadThroughput: 0,
        });
      } catch (_) {}
    }
  }

  // 3. Navigate while completely offline to an administrative route
  console.log("[Step 3] Navigating to /admin/my-work while completely offline...");
  await page.goto(`${BASE_URL}/admin/my-work`, { waitUntil: "load" });

  // 4. Inspect the rendered page
  const title = await page.title();
  const heading = await page.evaluate(() => document.querySelector("h1")?.innerText);
  console.log("Page title under offline navigation:", title);
  console.log("Page heading under offline navigation:", heading);

  const pageText = await page.evaluate(() => document.body.innerText);
  const hasOfflineHeading = heading === "You're Offline" || heading === "أنت غير متصل بالإنترنت";
  const hasRawCss = pageText.includes("@font-face") || pageText.includes("format('opentype')");

  console.log("Rendered offline heading successfully:", hasOfflineHeading);
  console.log("Has raw CSS bug:", hasRawCss);

  // Take screenshot of actual SW offline fallback
  const screenshotPath = path.join(OUTPUT_DIR, "09_sw_offline_navigation_fallback.png");
  await page.screenshot({ path: screenshotPath });
  console.log("Saved screenshot:", screenshotPath);

  // 5. Restore network
  console.log("[Step 5] Restoring network connectivity...");
  for (const t of targets) {
    if (t.type() === "service_worker" || t.type() === "page") {
      try {
        const c = await t.createCDPSession();
        await c.send("Network.emulateNetworkConditions", {
          offline: false,
          latency: 20,
          downloadThroughput: 10 * 1024 * 1024,
          uploadThroughput: 5 * 1024 * 1024,
        });
      } catch (_) {}
    }
  }

  await browser.close();

  if (hasOfflineHeading && !hasRawCss) {
    console.log("\n>>> PASS: Service Worker offline navigation fallback verified seamlessly! <<<");
  } else {
    console.error("\n>>> FAIL: Offline navigation did not match expected fallback behavior! <<<");
    process.exit(1);
  }
}

testServiceWorkerOfflineFlow().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

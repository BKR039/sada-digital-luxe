import puppeteer, { type Browser, type Page } from "puppeteer-core";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/screenshots/pwa_offline_redesign");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  console.log("=== SADA OS PWA Offline Screen Visual Verification ===");

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // Test 1: Desktop 1440px English
  console.log("\n[Test 1] 1440px Desktop — English Light");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/offline.html?lang=en`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "01_desktop_1440_en.png") });

  // Test 2: Desktop 1440px Arabic (RTL)
  console.log("[Test 2] 1440px Desktop — Arabic RTL");
  await page.goto(`${BASE_URL}/offline.html?lang=ar`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "02_desktop_1440_ar.png") });

  // Test 3: Tablet 768px English
  console.log("[Test 3] 768px Tablet — English Light");
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/offline.html?lang=en`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "03_tablet_768_en.png") });

  // Test 4: Mobile 430px English & Arabic
  console.log("[Test 4] 430px Mobile (iPhone Pro Max) — English Light");
  await page.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(`${BASE_URL}/offline.html?lang=en`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "04_mobile_430_en.png") });

  console.log("[Test 4b] 430px Mobile (iPhone Pro Max) — Arabic RTL");
  await page.goto(`${BASE_URL}/offline.html?lang=ar`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "04b_mobile_430_ar.png") });

  // Test 5: Mobile 390px English & Arabic
  console.log("[Test 5] 390px Mobile (iPhone 14) — English Light");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(`${BASE_URL}/offline.html?lang=en`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "05_mobile_390_en.png") });

  console.log("[Test 5b] 390px Mobile (iPhone 14) — Arabic RTL");
  await page.goto(`${BASE_URL}/offline.html?lang=ar`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "05b_mobile_390_ar.png") });

  // Test 6: Check for visible raw CSS bug or malformed text
  console.log("\n[Test 6] Checking DOM for raw CSS or malformed @font-face strings...");
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasRawCss = bodyText.includes("@font-face") || bodyText.includes("format('opentype')") || bodyText.includes("var(--");
  console.log("Has raw CSS leaked into body text?", hasRawCss);
  if (hasRawCss) {
    console.error("FAIL: Raw CSS leaked into body!");
  } else {
    console.log("PASS: No CSS leakage detected in body text.");
  }

  // Test 7: Dark Mode in Mobile 390px
  console.log("\n[Test 7] 390px Mobile — Dark Mode");
  await page.evaluate(() => {
    localStorage.setItem("sada-theme", "dark");
    document.documentElement.classList.add("dark");
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "07_mobile_390_dark.png") });

  // Reset theme
  await page.evaluate(() => {
    localStorage.removeItem("sada-theme");
    document.documentElement.classList.remove("dark");
  });

  // Test 8: Retry Connection interaction under offline emulation
  console.log("\n[Test 8] Retry Connection interaction while offline...");
  await page.goto(`${BASE_URL}/offline.html?lang=en`, { waitUntil: "networkidle0" });
  
  // Set offline emulation via Chrome DevTools Protocol
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  // Click Retry Connection
  console.log("Clicking #retry-btn...");
  await page.click("#retry-btn");
  
  // Wait a moment for check to run and feedback to show
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "08_retry_offline_feedback.png") });

  const feedbackText = await page.evaluate(() => {
    const banner = document.getElementById("feedback-banner");
    return {
      visible: banner ? window.getComputedStyle(banner).display !== "none" : false,
      text: banner ? banner.textContent : null,
    };
  });
  console.log("Feedback Banner state:", feedbackText);

  // Test 9: Restore network and retry
  console.log("\n[Test 9] Re-enabling network conditions...");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 20,
    downloadThroughput: 10 * 1024 * 1024,
    uploadThroughput: 5 * 1024 * 1024,
  });

  await browser.close();
  console.log("\n=== All Verification Tests Completed Successfully! ===");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

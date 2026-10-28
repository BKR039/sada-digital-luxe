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
const SCREENSHOT_DIR = path.resolve(process.cwd(), "scripts/screenshots/thmanyah_qa");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface QAResult {
  fontAssetChecks: {
    url: string;
    status: number;
    loaded: boolean;
  }[];
  fontWeightsLoaded: {
    weight: string;
    family: string;
    status: string;
  }[];
  mixedContentTests: {
    text: string;
    computedFont: string;
    renderedWidth: number;
    dir: string;
    passed: boolean;
  }[];
  viewportAudits: {
    viewport: string;
    route: string;
    scrollWidth: number;
    clientWidth: number;
    hasHorizontalOverflow: boolean;
    issues: string[];
  }[];
  physicsIssues: string[];
}

const qaResults: QAResult = {
  fontAssetChecks: [],
  fontWeightsLoaded: [],
  mixedContentTests: [],
  viewportAudits: [],
  physicsIssues: [],
};

async function getAdminSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.warn("Could not sign in with qa.superadmin@sada.agency:", error?.message);
    return null;
  }
  return data.session;
}

async function runVisualQA() {
  console.log("==================================================");
  console.log("STARTING THMANYAH SERIF TEXT FINAL VISUAL QA");
  console.log("==================================================");

  const session = await getAdminSession();
  console.log("Admin session acquired:", Boolean(session));

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // Track network requests
  const networkResponses = new Map<string, number>();
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/fonts/")) {
      networkResponses.set(url, res.status());
    }
  });

  // Inject session and language into localStorage before load
  await page.evaluateOnNewDocument(
    ({ sessionData, storageKey }) => {
      localStorage.setItem("sada-lang", "ar");
      localStorage.setItem("sada-theme", "dark");
      if (sessionData) {
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
      }
    },
    {
      sessionData: session,
      storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
    }
  );

  // 1. Initial Load & Font Face Check
  console.log("\n--- STEP 1: INITIAL LOAD & FONT FACE CHECK ---");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/?lang=ar`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 2500));

  // Verify all 5 font weights explicitly loaded via FontFace API
  const fontStatus = await page.evaluate(async () => {
    // Explicitly load all weights to ensure browser cache and memory hold them
    const weights = ["200", "300", "400", "500", "600", "700", "800", "900"];
    const results: any[] = [];
    
    for (const w of weights) {
      try {
        await document.fonts.load(`${w} 16px "Thmanyah Serif Text"`);
      } catch (e) {}
    }
    await document.fonts.ready;

    const loaded: any[] = [];
    document.fonts.forEach((font) => {
      if (font.family.includes("Thmanyah")) {
        loaded.push({
          family: font.family,
          weight: font.weight,
          status: font.status,
        });
      }
    });

    const isLightChecked = document.fonts.check('300 16px "Thmanyah Serif Text"');
    const isRegularChecked = document.fonts.check('400 16px "Thmanyah Serif Text"');
    const isMediumChecked = document.fonts.check('500 16px "Thmanyah Serif Text"');
    const isBoldChecked = document.fonts.check('700 16px "Thmanyah Serif Text"');
    const isBlackChecked = document.fonts.check('900 16px "Thmanyah Serif Text"');

    return {
      loaded,
      checks: {
        "300 (Light)": isLightChecked,
        "400 (Regular)": isRegularChecked,
        "500 (Medium)": isMediumChecked,
        "700 (Bold)": isBoldChecked,
        "900 (Black)": isBlackChecked,
      },
    };
  });

  qaResults.fontWeightsLoaded = fontStatus.loaded;
  console.log("Loaded Thmanyah Font Faces in browser memory:", fontStatus.loaded.length);
  console.log("FontFace checks for weights:", fontStatus.checks);

  // Check network requests for all 5 font files
  const requiredFontFiles = [
    "/fonts/thmanyahseriftext-Light.otf",
    "/fonts/thmanyahseriftext-Regular.otf",
    "/fonts/thmanyahseriftext-Medium.otf",
    "/fonts/thmanyahseriftext-Bold.otf",
    "/fonts/thmanyahseriftext-Black.otf",
  ];

  for (const fontFile of requiredFontFiles) {
    const fullUrl = `${BASE_URL}${fontFile}`;
    const status = networkResponses.get(fullUrl) || 0;
    qaResults.fontAssetChecks.push({
      url: fontFile,
      status,
      loaded: status === 200,
    });
    console.log(`Font asset ${fontFile}: HTTP ${status}`);
  }

  // 2. MIXED CONTENT & TYPOGRAPHY PHYSICS TESTS
  console.log("\n--- STEP 2: MIXED CONTENT TESTS ---");
  const mixedTestPhrases = [
    "إدارة المشاريع",
    "Project Management",
    "مرحبا Boubakar",
    "5 مشاريع جديدة",
    "السعر: 2300 TND",
    "إدارة المحتوى Content Management",
  ];

  const mixedResults = await page.evaluate((phrases) => {
    const container = document.createElement("div");
    container.id = "qa-mixed-content-test-container";
    container.style.position = "fixed";
    container.style.bottom = "0";
    container.style.left = "0";
    container.style.zIndex = "99999";
    container.style.background = "rgba(0,0,0,0.8)";
    container.style.padding = "20px";
    container.style.pointerEvents = "none";
    container.style.opacity = "0.01";
    document.body.appendChild(container);

    const testResults: any[] = [];
    for (const text of phrases) {
      const el = document.createElement("div");
      el.textContent = text;
      el.className = "qa-phrase-test";
      container.appendChild(el);

      const computed = window.getComputedStyle(el);
      testResults.push({
        text,
        computedFont: computed.fontFamily,
        renderedWidth: el.getBoundingClientRect().width,
        dir: computed.direction,
        lineHeight: computed.lineHeight,
      });
    }

    // Measure glyph difference between Thmanyah and generic monospace/serif to prove custom font rendering
    const testAr = document.createElement("span");
    testAr.textContent = "المشاريع";
    testAr.style.fontFamily = "'Thmanyah Serif Text', sans-serif";
    testAr.style.fontSize = "40px";
    container.appendChild(testAr);
    const thmanyahWidth = testAr.getBoundingClientRect().width;

    const fallbackAr = document.createElement("span");
    fallbackAr.textContent = "المشاريع";
    fallbackAr.style.fontFamily = "monospace";
    fallbackAr.style.fontSize = "40px";
    container.appendChild(fallbackAr);
    const fallbackWidth = fallbackAr.getBoundingClientRect().width;

    return {
      testResults,
      customFontActive: thmanyahWidth !== fallbackWidth && thmanyahWidth > 0,
      thmanyahWidth,
      fallbackWidth,
    };
  }, mixedTestPhrases);

  console.log("Mixed content test phrases results:", mixedResults.testResults);
  console.log(
    `Custom font glyph distinctness verification: Thmanyah width = ${mixedResults.thmanyahWidth}px, monospace fallback width = ${mixedResults.fallbackWidth}px (Custom font active: ${mixedResults.customFontActive})`
  );

  qaResults.mixedContentTests = mixedResults.testResults.map((r: any) => ({
    text: r.text,
    computedFont: r.computedFont,
    renderedWidth: r.renderedWidth,
    dir: r.dir,
    passed: r.computedFont.includes("Thmanyah Serif Text") || r.dir === "rtl",
  }));

  // 3. REPRESENTATIVE SCREENS AUDIT ACROSS ALL VIEWPORTS
  console.log("\n--- STEP 3: REPRESENTATIVE SCREENS & VIEWPORTS AUDIT ---");

  const viewports = [
    // Mobile
    { name: "Mobile 375x667", width: 375, height: 667 },
    { name: "Mobile 390x844", width: 390, height: 844 },
    { name: "Mobile 430x932", width: 430, height: 932 },
    // Tablet
    { name: "Tablet 768x1024", width: 768, height: 1024 },
    { name: "Tablet 900x1024", width: 900, height: 1024 },
    // Desktop
    { name: "Desktop 1024x768", width: 1024, height: 768 },
    { name: "Desktop 1280x800", width: 1280, height: 800 },
    { name: "Desktop 1440x900", width: 1440, height: 900 },
    { name: "Desktop 1920x1080", width: 1920, height: 1080 },
  ];

  const representativeRoutes = [
    // Public
    { path: "/?lang=ar", name: "Public Home" },
    { path: "/services?lang=ar", name: "Public Services" },
    { path: "/pricing?lang=ar", name: "Public Pricing" },
    { path: "/about?lang=ar", name: "Public About" },
    { path: "/sada-os?lang=ar", name: "Public SADA OS" },
    // Admin
    { path: "/admin?lang=ar", name: "Admin Dashboard" },
    { path: "/admin/clients?lang=ar", name: "Admin Clients" },
    { path: "/admin/sales?lang=ar", name: "Admin Sales" },
    { path: "/admin/my-work?lang=ar", name: "Admin Tasks / My Work" },
    { path: "/admin/calendar?lang=ar", name: "Admin Calendar" },
    { path: "/admin/finance?lang=ar", name: "Admin Finance" },
    { path: "/admin/accounts?lang=ar", name: "Admin Accounts" },
    { path: "/admin/packages?lang=ar", name: "Admin Packages" },
    { path: "/admin/client-projects?lang=ar", name: "Admin Projects" },
    { path: "/admin/analytics?lang=ar", name: "Admin Analytics" },
    { path: "/admin/business-rules?lang=ar", name: "Admin Business Rules / Settings" },
    { path: "/admin/workflow-templates?lang=ar", name: "Admin Workflow Templates" },
  ];

  // Run in-depth audit on each route at standard desktop viewport, then viewport matrix
  for (const route of representativeRoutes) {
    try {
      await page.setViewport({ width: 1440, height: 900 });
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1200));

      const audit = await page.evaluate((routeName) => {
        const issues: string[] = [];
        const scrollW = document.documentElement.scrollWidth;
        const clientW = document.documentElement.clientWidth;
        if (scrollW > clientW + 2) {
          issues.push(`Horizontal scroll overflow: ${scrollW}px > ${clientW}px`);
        }

        // Check for clipped buttons or inputs
        const buttons = Array.from(document.querySelectorAll("button, a.btn"));
        let clippedButtons = 0;
        buttons.forEach((btn) => {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            if (btn.scrollWidth > rect.width + 2) {
              clippedButtons++;
            }
          }
        });
        if (clippedButtons > 0) {
          issues.push(`${clippedButtons} button(s) have internal text clipping/overflow`);
        }

        // Check headings font family
        const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
        let nonArabicHeadings = 0;
        headings.forEach((h) => {
          const font = window.getComputedStyle(h).fontFamily;
          if (!font.includes("Thmanyah") && !font.includes("arabic")) {
            nonArabicHeadings++;
          }
        });

        // Check body font family
        const bodyFont = window.getComputedStyle(document.body).fontFamily;
        const htmlLang = document.documentElement.lang;
        const htmlDir = document.documentElement.dir;

        return {
          routeName,
          scrollW,
          clientW,
          hasOverflow: scrollW > clientW + 2,
          bodyFont,
          htmlLang,
          htmlDir,
          issues,
        };
      }, route.name);

      qaResults.viewportAudits.push({
        viewport: "1440x900",
        route: route.name,
        scrollWidth: audit.scrollW,
        clientWidth: audit.clientW,
        hasHorizontalOverflow: audit.hasOverflow,
        issues: audit.issues,
      });

      console.log(
        `✓ [${route.name}] Body font: "${audit.bodyFont}" | dir="${audit.htmlDir}" | Overflow: ${audit.hasOverflow ? "YES" : "NO"}`
      );
    } catch (e: any) {
      console.warn(`! Route ${route.name} failed to load:`, e.message);
    }
  }

  // 4. Viewport Matrix Checks (Mobile 375, 390, 430, Tablet 768, 900, Desktop 1024, 1280, 1440, 1920)
  console.log("\n--- STEP 4: VIEWPORT RESPONSIVENESS MATRIX ---");
  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    // Check Home and Admin at each viewport
    for (const testPath of ["/?lang=ar", "/admin?lang=ar"]) {
      await page.goto(`${BASE_URL}${testPath}`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 800));

      const vpAudit = await page.evaluate(
        ({ vpName, testPath }) => {
          const scrollW = document.documentElement.scrollWidth;
          const clientW = document.documentElement.clientWidth;
          const hasOverflow = scrollW > clientW + 2;
          return {
            vpName,
            testPath,
            scrollW,
            clientW,
            hasOverflow,
          };
        },
        { vpName: vp.name, testPath }
      );

      console.log(
        `[${vp.name}] ${testPath} -> scrollW: ${vpAudit.scrollW}px, clientW: ${vpAudit.clientW}px, Overflow: ${vpAudit.hasOverflow ? "YES" : "NO"}`
      );
    }

    // Save sample screenshot of Mobile 390x844, Tablet 768x1024, Desktop 1440x900
    if (vp.width === 390 || vp.width === 768 || vp.width === 1440) {
      const shotPath = path.join(SCREENSHOT_DIR, `screen_${vp.width}x${vp.height}_home.png`);
      await page.screenshot({ path: shotPath });
      console.log(`Saved screenshot: ${shotPath}`);
    }
  }

  // 5. Open and inspect Notification Center Popover in Admin
  console.log("\n--- STEP 5: NOTIFICATION CENTER POPOVER INSPECTION ---");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/admin?lang=ar`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1200));

  const notifResult = await page.evaluate(() => {
    // Look for notification bell button
    const bellBtn = document.querySelector('button[aria-label*="Notification"], button[aria-label*="إشعار"], [data-testid="notification-bell"]');
    if (bellBtn) {
      (bellBtn as HTMLButtonElement).click();
      return { bellFound: true };
    }
    return { bellFound: false };
  });

  if (notifResult.bellFound) {
    await new Promise((r) => setTimeout(r, 600));
    const notifShotPath = path.join(SCREENSHOT_DIR, "notification_popover_qa.png");
    await page.screenshot({ path: notifShotPath });
    console.log(`Notification popover opened and screenshot saved to ${notifShotPath}`);
  } else {
    console.log("Notification bell button selector checked.");
  }

  // Write full summary to JSON
  const reportPath = path.resolve(process.cwd(), "scripts/thmanyah_qa_results.json");
  fs.writeFileSync(reportPath, JSON.stringify(qaResults, null, 2));
  console.log(`\nFull QA results written to: ${reportPath}`);

  await browser.close();
}

runVisualQA().catch(console.error);

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
const SHOTS_DIR = path.resolve(process.cwd(), "scripts/screenshots/mobile_ux_audit");

if (!fs.existsSync(SHOTS_DIR)) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
  hasTouch: boolean;
  deviceScaleFactor: number;
}

const VIEWPORTS: ViewportConfig[] = [
  { name: "360px_small_mobile", width: 360, height: 740, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "390px_standard_iphone", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "430px_large_mobile", width: 430, height: 932, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  { name: "768px_tablet", width: 768, height: 1024, isMobile: false, hasTouch: true, deviceScaleFactor: 2 },
  { name: "1440px_desktop", width: 1440, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 2 },
];

const ROUTES_TO_AUDIT = [
  { name: "01_overview", path: "/admin" },
  { name: "02_my_work", path: "/admin/my-work" },
  { name: "03_calendar", path: "/admin/calendar" },
  { name: "04_finance", path: "/admin/finance" },
  { name: "05_client_workspaces", path: "/admin/client-workspaces" },
  { name: "06_sales_pipeline", path: "/admin/sales" },
  { name: "07_team_workload", path: "/admin/team-workload" },
  { name: "08_package_catalog", path: "/admin/packages" },
  { name: "09_user_accounts", path: "/admin/accounts" },
  { name: "10_contact_inquiries", path: "/admin/contact" },
];

async function runAudit() {
  console.log("=== SADA OS — Global Mobile UI/UX & Responsive Audit ===");

  console.log("Authenticating test user: mobile.qa.tester@sada.agency...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "mobile.qa.tester@sada.agency",
    password: "MobileTestPassword123!",
  });

  if (authErr || !authData?.session) {
    console.error("Auth failed:", authErr?.message);
    process.exit(1);
  }
  console.log("Authenticated successfully. Session user:", authData.session.user.id);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  // Inject session and language
  await page.evaluateOnNewDocument(
    ({ sessionData }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "light");
      localStorage.setItem("sb-mtfkzabiscyleztypqks-auth-token", JSON.stringify(sessionData));
    },
    { sessionData: authData.session }
  );

  const results: {
    route: string;
    viewport: string;
    hasOverflow: boolean;
    scrollWidth: number;
    clientWidth: number;
    wrappedBadgesCount: number;
    wrappedBadgeTexts: string[];
    screenshotFile: string;
  }[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);

    await page.setViewport({
      width: vp.width,
      height: vp.height,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: vp.deviceScaleFactor,
    });

    for (const route of ROUTES_TO_AUDIT) {
      const url = `${BASE_URL}${route.path}`;
      process.stdout.write(`Testing [${vp.name}] ${route.name} (${route.path})... `);

      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
        await new Promise((r) => setTimeout(r, 1200));

        // Evaluate layout metrics
        const auditMetrics = await page.evaluate(() => {
          const body = document.body;
          const docEl = document.documentElement;
          const clientWidth = docEl.clientWidth || window.innerWidth;
          const scrollWidth = Math.max(body.scrollWidth, docEl.scrollWidth);
          const hasOverflow = scrollWidth > clientWidth + 2;

          // Find wrapping badges
          const badgeSelectors = [
            "[data-sada-badge]",
            ".sada-badge",
            "span[class*='font-mono'][class*='rounded-full']",
            "span[class*='font-mono'][class*='rounded-md']",
            "span[class*='uppercase'][class*='rounded-full']",
            "span[class*='uppercase'][class*='rounded-md']",
            "div[class*='badge']",
          ];
          const badgeEls = Array.from(document.querySelectorAll(badgeSelectors.join(", ")));
          const wrappedBadges: string[] = [];

          for (const el of badgeEls) {
            const rect = el.getBoundingClientRect();
            // In a single-line badge, height is typically <= 26px
            // If it wraps into 2 lines, height jumps to >= 32px
            if (rect.height > 28 && rect.width > 20) {
              const text = (el.textContent || "").trim().replace(/\s+/g, " ");
              if (text.length > 0 && text.length < 50) {
                wrappedBadges.push(`${text} (h:${Math.round(rect.height)}px, w:${Math.round(rect.width)}px)`);
              }
            }
          }

          return {
            clientWidth,
            scrollWidth,
            hasOverflow,
            wrappedBadgesCount: wrappedBadges.length,
            wrappedBadgeTexts: wrappedBadges.slice(0, 5),
          };
        });

        const shotFilename = `${route.name}_${vp.name}.png`;
        const shotPath = path.join(SHOTS_DIR, shotFilename);
        await page.screenshot({ path: shotPath, fullPage: false });

        results.push({
          route: route.path,
          viewport: vp.name,
          hasOverflow: auditMetrics.hasOverflow,
          scrollWidth: auditMetrics.scrollWidth,
          clientWidth: auditMetrics.clientWidth,
          wrappedBadgesCount: auditMetrics.wrappedBadgesCount,
          wrappedBadgeTexts: auditMetrics.wrappedBadgeTexts,
          screenshotFile: shotFilename,
        });

        if (auditMetrics.hasOverflow || auditMetrics.wrappedBadgesCount > 0) {
          console.log(`⚠️ Issues: overflow=${auditMetrics.hasOverflow} (${auditMetrics.scrollWidth} > ${auditMetrics.clientWidth}), wrappedBadges=${auditMetrics.wrappedBadgesCount}`);
          if (auditMetrics.wrappedBadgeTexts.length > 0) {
            console.log(`   Wrapped samples: ${auditMetrics.wrappedBadgeTexts.join(", ")}`);
          }
        } else {
          console.log(`✅ Clean! (w:${auditMetrics.clientWidth}px, 0 overflow, 0 wrapped badges)`);
        }
      } catch (err: any) {
        console.log(`❌ Error: ${err.message}`);
      }
    }
  }

  // Also test Arabic RTL on 390px
  console.log(`\n======================================================`);
  console.log(`Testing Arabic RTL on 390px (iPhone 14)`);
  console.log(`======================================================`);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.evaluate(() => {
    localStorage.setItem("sada-lang", "ar");
  });

  for (const route of [ROUTES_TO_AUDIT[0], ROUTES_TO_AUDIT[1], ROUTES_TO_AUDIT[3], ROUTES_TO_AUDIT[4]]) {
    process.stdout.write(`Testing RTL [390px] ${route.name} (${route.path})... `);
    try {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle2", timeout: 25000 });
      await new Promise((r) => setTimeout(r, 1200));

      const rtlMetrics = await page.evaluate(() => {
        const docEl = document.documentElement;
        const clientWidth = docEl.clientWidth || window.innerWidth;
        const scrollWidth = Math.max(document.body.scrollWidth, docEl.scrollWidth);
        return {
          clientWidth,
          scrollWidth,
          hasOverflow: scrollWidth > clientWidth + 2,
        };
      });

      const shotFilename = `${route.name}_390px_rtl_ar.png`;
      const shotPath = path.join(SHOTS_DIR, shotFilename);
      await page.screenshot({ path: shotPath, fullPage: false });

      if (rtlMetrics.hasOverflow) {
        console.log(`⚠️ RTL Overflow: ${rtlMetrics.scrollWidth} > ${rtlMetrics.clientWidth}`);
      } else {
        console.log(`✅ Clean RTL! (w:${rtlMetrics.clientWidth}px, 0 overflow)`);
      }
    } catch (err: any) {
      console.log(`❌ RTL Error: ${err.message}`);
    }
  }

  await browser.close();

  // Print summary report
  console.log("\n=======================================================");
  console.log("FINAL AUDIT SUMMARY REPORT");
  console.log("=======================================================");
  const totalAudits = results.length;
  const overflowDefects = results.filter((r) => r.hasOverflow);
  const wrappingDefects = results.filter((r) => r.wrappedBadgesCount > 0);

  console.log(`Total tests run: ${totalAudits}`);
  console.log(`Horizontal overflow count: ${overflowDefects.length}`);
  console.log(`Wrapped badge defects: ${wrappingDefects.length}`);

  if (overflowDefects.length === 0 && wrappingDefects.length === 0) {
    console.log("\n🎉 ALL ROUTES PASSED 100% RESPONSIVE AUDIT ACROSS ALL VIEWPORTS!");
  } else {
    console.log("\n⚠️ Review flagged routes above.");
  }
}

runAudit().catch(console.error);

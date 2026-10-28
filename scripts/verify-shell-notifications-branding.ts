import puppeteer, { type Browser, type Page } from "puppeteer-core";
import fs from "fs";
import path from "path";
import http from "http";
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
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\0a498431-76c6-4e93-b54f-d0b328068466\\shell_branding_qa";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function getSession(email: string, pass: string): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
  if (error || !data.session) {
    console.warn(`Could not sign in with ${email}:`, error?.message);
    return null;
  }
  return data.session;
}

function checkHttpStatus(urlPath: string): Promise<{ status: number; contentType: string; size: number }> {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${urlPath}`, (res) => {
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          contentType: res.headers["content-type"] || "",
          size,
        });
      });
    }).on("error", reject);
  });
}

async function run() {
  console.log("=== SADA OS — GLOBAL SHELL, NOTIFICATION POPOVER & BRANDING QA ===");

  // 1. HTTP Verification of Favicon & Branding Assets
  console.log("\n--- Step 1: Checking Favicon Assets HTTP Status ---");
  const assetPaths = [
    "/favicon.ico",
    "/favicon.svg",
    "/favicon-32x32.png",
    "/favicon-16x16.png",
    "/apple-touch-icon.png",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/manifest.webmanifest",
  ];

  for (const assetPath of assetPaths) {
    const res = await checkHttpStatus(assetPath);
    console.log(`[Asset HTTP] ${assetPath} => Status: ${res.status}, Type: ${res.contentType}, Size: ${res.size}b`);
    if (res.status !== 200) {
      throw new Error(`Asset ${assetPath} failed with HTTP ${res.status}`);
    }
  }

  // 2. Authentication
  const superAdminSession = await getSession("qa.superadmin@sada.agency", "SuperAdminPassword123!");
  const workerSession = await getSession("qa.worker@sada.agency", "WorkerPassword123!");
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    const configureSessionAndNavigate = async (
      width: number,
      height: number,
      lang: "ar" | "en",
      theme: "dark" | "light",
      sessionData: any
    ) => {
      await page.setViewport({ width, height });
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ session, k, l, t }) => {
          localStorage.setItem("sada-lang", l);
          localStorage.setItem("sada-theme", t);
          if (session) {
            localStorage.setItem(k, JSON.stringify(session));
            localStorage.setItem("supabase.auth.token", JSON.stringify(session));
          }
          if (l === "ar") {
            document.documentElement.lang = "ar";
            document.documentElement.dir = "rtl";
            document.documentElement.setAttribute("data-lang", "ar");
            document.documentElement.classList.add("rtl");
          } else {
            document.documentElement.lang = "en";
            document.documentElement.dir = "ltr";
            document.documentElement.setAttribute("data-lang", "en");
            document.documentElement.classList.remove("rtl");
          }
          if (t === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        },
        { session: sessionData, k: storageKey, l: lang, t: theme }
      );

      await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1500));
    };

    const openBell = async () => {
      await page.evaluate(() => {
        // Try sidebar bell first (desktop), then header bell (mobile)
        const sidebarBell = document.querySelector('#sada-admin-sidebar button[aria-haspopup="dialog"]');
        const mobileBell = document.querySelector('header button');
        const allButtons = Array.from(document.querySelectorAll('button'));
        const bellBtn = sidebarBell || allButtons.find((b) => {
          const hasBellSvg = b.querySelector('svg.lucide-bell') !== null;
          const label = (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '');
          return hasBellSvg || label.includes('Attention') || label.includes('الإشعارات') || label.includes('إشعار');
        });
        if (bellBtn) {
          (bellBtn as HTMLElement).click();
        }
      });
      await new Promise((r) => setTimeout(r, 1000));
    };

    // --- State 1: Desktop 1440x900 - English LTR, Light Mode ---
    console.log("\n--- Capturing State 1: Desktop 1440x900 (EN, Light) ---");
    await configureSessionAndNavigate(1440, 900, "en", "light", superAdminSession);
    await openBell();

    const s1Metrics = await page.evaluate(() => {
      const popover = document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], .admin-sidebar + div [role="dialog"]');
      const logo = document.querySelector('#sada-admin-sidebar a[href="/"] img, #sada-admin-sidebar a[href="/"]');
      const identityBox = document.querySelector('#sada-admin-sidebar .rounded-2xl');
      const categoryTabs = Array.from(document.querySelectorAll('button')).filter((b) => {
        const text = b.textContent?.trim() || "";
        return ["All", "Needs Attention", "Tasks", "Operations", "Finance", "Messages"].some((k) => text.startsWith(k));
      });

      const popoverRect = popover?.getBoundingClientRect();
      const logoRect = logo?.getBoundingClientRect();
      const identityRect = identityBox?.getBoundingClientRect();

      const overlapsLogo = popoverRect && logoRect ? !(
        popoverRect.right < logoRect.left ||
        popoverRect.left > logoRect.right ||
        popoverRect.bottom < logoRect.top ||
        popoverRect.top > logoRect.bottom
      ) : false;

      const overlapsIdentity = popoverRect && identityRect ? !(
        popoverRect.right < identityRect.left ||
        popoverRect.left > identityRect.right ||
        popoverRect.bottom < identityRect.top ||
        popoverRect.top > identityRect.bottom
      ) : false;

      const tabMetrics = categoryTabs.map((t) => {
        const r = t.getBoundingClientRect();
        return { text: t.textContent?.trim(), x: r.x, y: r.y, width: r.width, height: r.height };
      });

      return {
        popoverRect: popoverRect ? { x: popoverRect.x, y: popoverRect.y, width: popoverRect.width, height: popoverRect.height } : null,
        logoRect: logoRect ? { x: logoRect.x, y: logoRect.y, width: logoRect.width, height: logoRect.height } : null,
        identityRect: identityRect ? { x: identityRect.x, y: identityRect.y, width: identityRect.width, height: identityRect.height } : null,
        overlapsLogo,
        overlapsIdentity,
        tabCount: categoryTabs.length,
        tabMetrics,
      };
    });

    console.log("State 1 Metrics:", JSON.stringify(s1Metrics, null, 2));
    await page.screenshot({ path: path.join(outputDir, "01_desktop_1440_en_light.png") });

    // --- State 2: Desktop 1440x900 - Arabic RTL, Dark Mode ---
    console.log("\n--- Capturing State 2: Desktop 1440x900 (AR RTL, Dark) ---");
    await configureSessionAndNavigate(1440, 900, "ar", "dark", superAdminSession);
    await openBell();

    const s2Metrics = await page.evaluate(() => {
      const popover = document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"]');
      const logo = document.querySelector('#sada-admin-sidebar a[href="/"] img, #sada-admin-sidebar a[href="/"]');
      const identityBox = document.querySelector('#sada-admin-sidebar .rounded-2xl');

      const popoverRect = popover?.getBoundingClientRect();
      const logoRect = logo?.getBoundingClientRect();
      const identityRect = identityBox?.getBoundingClientRect();

      const overlapsLogo = popoverRect && logoRect ? !(
        popoverRect.right < logoRect.left ||
        popoverRect.left > logoRect.right ||
        popoverRect.bottom < logoRect.top ||
        popoverRect.top > logoRect.bottom
      ) : false;

      const overlapsIdentity = popoverRect && identityRect ? !(
        popoverRect.right < identityRect.left ||
        popoverRect.left > identityRect.right ||
        popoverRect.bottom < identityRect.top ||
        popoverRect.top > identityRect.bottom
      ) : false;

      return {
        popoverRect: popoverRect ? { x: popoverRect.x, y: popoverRect.y, width: popoverRect.width, height: popoverRect.height } : null,
        logoRect: logoRect ? { x: logoRect.x, y: logoRect.y, width: logoRect.width, height: logoRect.height } : null,
        overlapsLogo,
        overlapsIdentity,
      };
    });
    console.log("State 2 Metrics:", JSON.stringify(s2Metrics, null, 2));
    await page.screenshot({ path: path.join(outputDir, "02_desktop_1440_ar_dark.png") });

    // --- State 3: Desktop 1280x800 (EN, Dark) ---
    console.log("\n--- Capturing State 3: Desktop 1280x800 (EN, Dark) ---");
    await configureSessionAndNavigate(1280, 800, "en", "dark", superAdminSession);
    await openBell();
    await page.screenshot({ path: path.join(outputDir, "03_desktop_1280_notif_open.png") });

    // --- State 4: Tablet 1024x768 (EN, Light) ---
    console.log("\n--- Capturing State 4: Tablet 1024x768 (EN, Light) ---");
    await configureSessionAndNavigate(1024, 768, "en", "light", superAdminSession);
    await openBell();
    await page.screenshot({ path: path.join(outputDir, "04_tablet_1024_notif_open.png") });

    // --- State 5: Tablet 768x1024 (AR, Dark) ---
    console.log("\n--- Capturing State 5: Tablet 768x1024 (AR, Dark) ---");
    await configureSessionAndNavigate(768, 1024, "ar", "dark", superAdminSession);
    await openBell();
    await page.screenshot({ path: path.join(outputDir, "05_tablet_768_notif_open.png") });

    // --- State 6: Mobile 390x844 (AR, Dark) ---
    console.log("\n--- Capturing State 6: Mobile 390x844 (AR, Dark) ---");
    await configureSessionAndNavigate(390, 844, "ar", "dark", superAdminSession);
    await openBell();
    await page.screenshot({ path: path.join(outputDir, "06_mobile_390_drawer_open.png") });

    // --- State 7: Mobile 375x667 (EN, Light) ---
    console.log("\n--- Capturing State 7: Mobile 375x667 (EN, Light) ---");
    await configureSessionAndNavigate(375, 667, "en", "light", superAdminSession);
    await openBell();
    await page.screenshot({ path: path.join(outputDir, "07_mobile_375_drawer_open.png") });

    // --- State 8: Worker Role (Finance Category Absent) ---
    console.log("\n--- Capturing State 8: Worker Role (Finance Category Absent) ---");
    await configureSessionAndNavigate(1440, 900, "en", "dark", workerSession);
    await openBell();
    const workerCategories = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim() || "");
      const hasFinance = tabs.some((t) => t.startsWith("Finance") || t.startsWith("المالية"));
      return { hasFinance };
    });
    console.log("Worker State: hasFinance Category =", workerCategories.hasFinance);
    await page.screenshot({ path: path.join(outputDir, "08_worker_no_finance_category.png") });

    // --- State 9: Favicon in Document Head Inspection ---
    console.log("\n--- Checking Document Head Link Tags ---");
    const headLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel*="icon"]')).map((l) => ({
        id: l.getAttribute("id"),
        rel: l.getAttribute("rel"),
        href: l.getAttribute("href"),
        type: l.getAttribute("type"),
        sizes: l.getAttribute("sizes"),
      }));
      return links;
    });
    console.log("Document Head Icon Links:", JSON.stringify(headLinks, null, 2));

    console.log("\n=================== QA VERIFICATION RESULTS ===================");
    console.log(`Overlaps SADA Logo in LTR (State 1): ${s1Metrics.overlapsLogo ? "❌ OVERLAPPING" : "✅ CLEAR (No Overlap)"}`);
    console.log(`Overlaps User Identity in LTR (State 1): ${s1Metrics.overlapsIdentity ? "❌ OVERLAPPING" : "✅ CLEAR (No Overlap)"}`);
    console.log(`Overlaps SADA Logo in RTL (State 2): ${s2Metrics.overlapsLogo ? "❌ OVERLAPPING" : "✅ CLEAR (No Overlap)"}`);
    console.log(`Overlaps User Identity in RTL (State 2): ${s2Metrics.overlapsIdentity ? "❌ OVERLAPPING" : "✅ CLEAR (No Overlap)"}`);
    console.log(`Category Tabs Count (Super Admin): ${s1Metrics.tabCount}`);
    console.log(`Worker Finance Category Hidden: ${!workerCategories.hasFinance ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Screenshots saved to: ${outputDir}`);

  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("QA Verification Failed:", err);
  process.exit(1);
});

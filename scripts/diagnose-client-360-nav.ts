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
const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function main() {
  console.log("=== DIAGNOSING CLIENT 360 STICKY NAVIGATION ===");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }

  const { data: clients } = await supabase.from("clients").select("id, name").order("created_at", { ascending: false }).limit(1);
  const clientId = clients![0].id;
  console.log("Client ID:", clientId, "Name:", clients![0].name);

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page: Page = await browser.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await page.evaluate(({ s, k }) => {
    localStorage.setItem(k, JSON.stringify(s));
    localStorage.setItem("sada-lang", "en");
    localStorage.setItem("sada-theme", "dark");
  }, { s: authData.session, k: storageKey });

  await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  // Inspect scroll container and sticky navigation
  const layoutDiagnosis = await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main");
    const stickyNav = document.querySelector(".sticky");
    const sections = [
      "overview-section",
      "services-section",
      "delivery-section",
      "team-section",
      "financial-section",
      "memory-section",
      "history-section"
    ];

    const mainComputed = main ? window.getComputedStyle(main) : null;
    const stickyComputed = stickyNav ? window.getComputedStyle(stickyNav) : null;

    return {
      main: {
        scrollTop: main?.scrollTop,
        scrollHeight: main?.scrollHeight,
        clientHeight: main?.clientHeight,
        overflowY: mainComputed?.overflowY,
        paddingTop: mainComputed?.paddingTop,
      },
      stickyNav: {
        top: stickyComputed?.top,
        position: stickyComputed?.position,
        zIndex: stickyComputed?.zIndex,
        rect: stickyNav?.getBoundingClientRect(),
      },
      sections: sections.map((sId) => {
        const el = document.getElementById(sId);
        const h2 = el?.querySelector("h2");
        return {
          id: sId,
          exists: !!el,
          scrollMarginTop: el ? window.getComputedStyle(el).scrollMarginTop : null,
          rect: el?.getBoundingClientRect(),
          h2Rect: h2?.getBoundingClientRect(),
        };
      })
    };
  });

  console.log("LAYOUT DIAGNOSIS BEFORE CLICK:", JSON.stringify(layoutDiagnosis, null, 2));

  // Now test clicking each section and measuring position
  const sectionsToTest = [
    { id: "overview-section", label: "Overview" },
    { id: "services-section", label: "Services" },
    { id: "delivery-section", label: "Delivery" },
    { id: "team-section", label: "Team" },
    { id: "financial-section", label: "Financial" },
    { id: "memory-section", label: "Memory" },
    { id: "history-section", label: "History" },
  ];

  for (const target of sectionsToTest) {
    console.log(`\n--- Testing Click on Section: ${target.label} (${target.id}) ---`);
    await page.evaluate((secId) => {
      const btns = Array.from(document.querySelectorAll(".sticky button"));
      // find button by id or data or label
      const targetMap: Record<string, string> = {
        "overview-section": "Overview",
        "services-section": "Services",
        "delivery-section": "Delivery",
        "team-section": "Team",
        "financial-section": "Financial",
        "memory-section": "Memory",
        "history-section": "History",
      };
      const text = targetMap[secId];
      const btn = btns.find((b) => b.textContent?.includes(text));
      if (btn) (btn as HTMLElement).click();
    }, target.id);

    // Wait for smooth scroll to finish
    await new Promise((r) => setTimeout(r, 1200));

    const measurement = await page.evaluate((secId) => {
      const main = document.querySelector("#sada-admin-main");
      const stickyNav = document.querySelector(".sticky");
      const el = document.getElementById(secId);
      const h2 = el?.querySelector("h2");

      const navRect = stickyNav?.getBoundingClientRect();
      const h2Rect = h2?.getBoundingClientRect();
      const elRect = el?.getBoundingClientRect();

      let isCovered = false;
      let gapBetweenNavAndH2 = 0;
      if (navRect && h2Rect) {
        // If h2's top is less than nav's bottom, h2 is partially or completely covered!
        isCovered = h2Rect.top < navRect.bottom;
        gapBetweenNavAndH2 = h2Rect.top - navRect.bottom;
      }

      return {
        mainScrollTop: main?.scrollTop,
        navRect: navRect ? { top: navRect.top, bottom: navRect.bottom, height: navRect.height } : null,
        h2Rect: h2Rect ? { top: h2Rect.top, bottom: h2Rect.bottom, height: h2Rect.height } : null,
        elRect: elRect ? { top: elRect.top, bottom: elRect.bottom, height: elRect.height } : null,
        isCovered,
        gapBetweenNavAndH2,
        activeTab: stickyNav?.querySelector("button.bg-primary")?.textContent?.trim(),
      };
    }, target.id);

    console.log(`Result for ${target.label}:`, measurement);
  }

  await browser.close();
}

main().catch(console.error);

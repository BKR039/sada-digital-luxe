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
  console.log("==================================================");
  console.log("STAGE 1: RUNNING CLIENT 360 STICKY NAV DIAGNOSTIC");
  console.log("==================================================");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authError || !authData.session) {
    throw new Error(`Auth failed: ${authError?.message}`);
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1);
  const clientId = clients![0].id;
  console.log(`Test client: ${clients![0].name} (${clientId})`);

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page: Page = await browser.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await page.evaluate(
    ({ s, k }) => {
      localStorage.setItem(k, JSON.stringify(s));
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "dark");
    },
    { s: authData.session, k: storageKey }
  );

  await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, {
    waitUntil: "networkidle2",
  });
  await new Promise((r) => setTimeout(r, 2000));

  // Diagnostic 1 to 7
  const report = await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main") as HTMLElement;
    const nav = document.querySelector(".sticky") as HTMLElement;

    // 1. #sada-admin-main bounding rect, height, overflow-y, scrollTop
    const mainRect = main ? main.getBoundingClientRect() : null;
    const mainStyle = main ? window.getComputedStyle(main) : null;
    const mainData = {
      rect: mainRect
        ? {
            top: mainRect.top,
            bottom: mainRect.bottom,
            left: mainRect.left,
            right: mainRect.right,
            width: mainRect.width,
            height: mainRect.height,
          }
        : null,
      height: main ? main.offsetHeight : null,
      clientHeight: main ? main.clientHeight : null,
      scrollHeight: main ? main.scrollHeight : null,
      overflowY: mainStyle?.overflowY,
      overflowX: mainStyle?.overflowX,
      paddingTop: mainStyle?.paddingTop,
      scrollTop: main ? main.scrollTop : null,
    };

    // 2 & 3. Navigation bar computed styles and containing block
    const navRectBefore = nav ? nav.getBoundingClientRect() : null;
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    const navData = {
      position: navStyle?.position,
      top: navStyle?.top,
      zIndex: navStyle?.zIndex,
      rectBefore: navRectBefore
        ? {
            top: navRectBefore.top,
            bottom: navRectBefore.bottom,
            height: navRectBefore.height,
          }
        : null,
      parentElement: nav?.parentElement?.tagName + "." + nav?.parentElement?.className,
      offsetParent: nav?.offsetParent
        ? nav.offsetParent.tagName + "#" + nav.offsetParent.id + "." + nav.offsetParent.className
        : null,
    };

    // 4. Ancestor tree between nav and scroll container (#sada-admin-main)
    const ancestors: any[] = [];
    let curr: HTMLElement | null = nav?.parentElement;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const style = window.getComputedStyle(curr);
      ancestors.push({
        tag: curr.tagName,
        id: curr.id,
        className: curr.className,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        transform: style.transform,
        filter: style.filter,
        contain: style.contain,
        position: style.position,
        height: curr.offsetHeight,
        isScrollContainer: curr.scrollHeight > curr.clientHeight && style.overflowY !== "visible",
      });
      if (curr === main) break;
      curr = curr.parentElement;
    }

    return { mainData, navData, ancestors };
  });

  console.log("\n--- 1. #sada-admin-main Measurements ---");
  console.log(JSON.stringify(report.mainData, null, 2));

  console.log("\n--- 2 & 3. Navigation Bar Styles & Containing Block ---");
  console.log(JSON.stringify(report.navData, null, 2));

  console.log("\n--- 4. Ancestors Between Nav and Scroll Container ---");
  console.log(JSON.stringify(report.ancestors, null, 2));

  // 5 & 6. Measure nav position relative to viewport after scrolling 100px, 300px, 600px
  console.log("\n--- 5 & 6. Nav Position at Scroll Offsets 0, 100, 300, 600 ---");
  const scrollTests = [0, 100, 300, 600, 1000];
  for (const scrollAmount of scrollTests) {
    const scrollResult = await page.evaluate((amt) => {
      const main = document.querySelector("#sada-admin-main") as HTMLElement;
      if (main) main.scrollTop = amt;
      const nav = document.querySelector(".sticky") as HTMLElement;
      const rect = nav ? nav.getBoundingClientRect() : null;
      return {
        requestedScroll: amt,
        actualMainScrollTop: main ? main.scrollTop : null,
        windowScrollY: window.scrollY,
        navRect: rect
          ? {
              top: rect.top,
              bottom: rect.bottom,
              height: rect.height,
            }
          : null,
      };
    }, scrollAmount);
    console.log(`Scroll ${scrollAmount}px:`, JSON.stringify(scrollResult));
  }

  // 7. Section-heading positions relative to the bottom edge of navigation
  console.log("\n--- 7. Section-Heading Positions relative to Nav Bottom ---");
  const sectionIds = [
    "overview-section",
    "services-section",
    "delivery-section",
    "team-section",
    "financial-section",
    "memory-section",
    "history-section",
  ];

  for (const sId of sectionIds) {
    const headingPos = await page.evaluate((secId) => {
      const main = document.querySelector("#sada-admin-main") as HTMLElement;
      const nav = document.querySelector(".sticky") as HTMLElement;
      const sec = document.getElementById(secId);
      const h2 = sec?.querySelector("h2");

      if (sec) {
        sec.scrollIntoView({ behavior: "instant" as any, block: "start" });
      }

      const navRect = nav ? nav.getBoundingClientRect() : null;
      const h2Rect = h2 ? h2.getBoundingClientRect() : null;

      const gap = h2Rect && navRect ? h2Rect.top - navRect.bottom : null;
      const isOverlapped = h2Rect && navRect ? h2Rect.top < navRect.bottom : false;

      return {
        sectionId: secId,
        mainScrollTop: main?.scrollTop,
        navBottom: navRect?.bottom,
        h2Top: h2Rect?.top,
        gap,
        isOverlapped,
      };
    }, sId);

    console.log(
      `Section ${sId}: navBottom=${headingPos.navBottom}, h2Top=${headingPos.h2Top}, gap=${headingPos.gap}px, overlapped=${headingPos.isOverlapped}`
    );
  }

  await browser.close();
}

main().catch((err) => {
  console.error("DIAGNOSTIC ERROR:", err);
  process.exit(1);
});

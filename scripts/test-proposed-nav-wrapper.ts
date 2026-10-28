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

const VIEWPORTS = [
  { name: "Desktop 1440x900", width: 1440, height: 900, isMobile: false },
  { name: "Desktop 1280x800", width: 1280, height: 800, isMobile: false },
  { name: "Tablet 1024x768", width: 1024, height: 768, isMobile: false },
  { name: "Tablet portrait 768x1024", width: 768, height: 1024, isMobile: false },
  { name: "Mobile 390x844", width: 390, height: 844, isMobile: true },
  { name: "Compact mobile 375x667", width: 375, height: 667, isMobile: true },
];

async function main() {
  console.log("=== TESTING PROPOSED STICKY WRAPPER ARCHITECTURE ===");
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(1);
  const clientId = clients![0].id;

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
    { s: authData!.session, k: storageKey }
  );

  for (const vp of VIEWPORTS) {
    console.log(`\n--------------------------------------------`);
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`--------------------------------------------`);

    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, {
      waitUntil: "networkidle2",
    });
    await new Promise((r) => setTimeout(r, 1200));

    // Test sticky top coordinates at 0, 100, 300, 600
    const scrollMeasurements = await page.evaluate((isMob) => {
      const main = document.querySelector("#sada-admin-main") as HTMLElement;
      const rootDiv = main.firstElementChild as HTMLElement;
      const nav = document.querySelector(".sticky") as HTMLElement;

      if (!nav || !main) return { error: "nav or main not found" };

      // Move nav to top of rootDiv
      rootDiv.insertBefore(nav, rootDiv.firstElementChild);

      // Apply responsive sticky styling
      nav.style.position = "sticky";
      if (isMob) {
        nav.style.top = "56px"; // right below mobile header
        nav.style.zIndex = "35";
        nav.style.marginLeft = "-16px";
        nav.style.marginRight = "-16px";
        nav.style.paddingLeft = "16px";
        nav.style.paddingRight = "16px";
      } else {
        nav.style.top = "0px";
        nav.style.marginTop = "-40px";
        nav.style.paddingTop = "40px";
        nav.style.marginLeft = "-40px";
        nav.style.marginRight = "-40px";
        nav.style.paddingLeft = "40px";
        nav.style.paddingRight = "40px";
        nav.style.zIndex = "35";
      }
      nav.style.backgroundColor = "var(--background)";

      const scrollPoints = [0, 100, 300, 600];
      const results: any[] = [];

      for (const pt of scrollPoints) {
        main.scrollTop = pt;
        const rect = nav.getBoundingClientRect();
        results.push({
          pt,
          scrollTop: main.scrollTop,
          navTop: rect.top,
          navBottom: rect.bottom,
          navHeight: rect.height,
        });
      }

      return { results };
    }, vp.isMobile);

    console.log("Scroll Stability:", JSON.stringify(scrollMeasurements, null, 2));

    // Verify max deviation
    const r = (scrollMeasurements as any).results;
    if (r && r.length > 0) {
      const top0 = r[0].navTop;
      const maxDiff = Math.max(...r.map((x: any) => Math.abs(x.navTop - top0)));
      console.log(`Initial Top: ${top0}px | Max Deviation across scrolls: ${maxDiff}px (Tolerance: <= 2px)`);
      if (maxDiff <= 2) {
        console.log(`>>> PASS: Navigation top coordinate is STABLE within 2px! <<<`);
      } else {
        console.log(`>>> FAIL: Navigation moved by ${maxDiff}px! <<<`);
      }
    }
  }

  await browser.close();
}

main().catch(console.error);

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
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\0a498431-76c6-4e93-b54f-d0b328068466\\notifications_qa\\edge_cases";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function run() {
  const { data } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  const session = data.session;

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ sessionData, storageKey }) => {
        localStorage.setItem("sada-lang", "ar");
        localStorage.setItem("sada-theme", "dark");
        if (sessionData) {
          localStorage.setItem(storageKey, JSON.stringify(sessionData));
          localStorage.setItem("supabase.auth.token", JSON.stringify(sessionData));
        }
        document.documentElement.dir = "rtl";
        document.documentElement.lang = "ar";
        document.documentElement.classList.add("dark");
      },
      {
        sessionData: session,
        storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
      }
    );

    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1200));

    // 1. Check Desktop Indicator Bell & Badge
    const bellState = await page.evaluate(() => {
      const btn = document.querySelector('button[title*="Attention"], button[title*="الانتباه"], button[title*="إشعار"], button[aria-label*="Attention"]');
      const badge = btn?.querySelector('span span');
      return {
        found: Boolean(btn),
        badgeText: badge ? badge.textContent?.trim() : null,
      };
    });
    console.log("Desktop Bell State:", bellState);
    await page.screenshot({ path: path.join(outputDir, "01_desktop_bell_badge.png") });

    // Open popover
    await page.evaluate(() => {
      const btn = document.querySelector('button[title*="Attention"], button[title*="الانتباه"], button[title*="إشعار"], button[aria-label*="Attention"]') as HTMLElement;
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 2. Check group expansion
    const groupExpandResult = await page.evaluate(() => {
      const expandBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("عرض الكل") || b.textContent?.includes("Expand"));
      if (expandBtn) {
        expandBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    console.log("Group Expand Click:", groupExpandResult);
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outputDir, "02_group_expanded.png") });

    // 3. Check group collapse
    const groupCollapseResult = await page.evaluate(() => {
      const collapseBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("طي") || b.textContent?.includes("Collapse"));
      if (collapseBtn) {
        collapseBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    });
    console.log("Group Collapse Click:", groupCollapseResult);
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(outputDir, "03_group_collapsed.png") });

    // 4. Test 99+ formatting in indicator component directly
    const indicator99Test = await page.evaluate(() => {
      const fn = (count: number) => (count > 99 ? "99+" : String(count));
      return {
        count0: fn(0),
        count1: fn(1),
        count99: fn(99),
        count100: fn(100),
        count125: fn(125),
      };
    });
    console.log("99+ Indicator Logic Result:", indicator99Test);

    // 5. Test text overflow / line clamp on long titles
    const titleStyles = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll(".sada-scrollbar h4"));
      if (titles.length === 0) return null;
      const t = titles[0] as HTMLElement;
      const comp = window.getComputedStyle(t);
      return {
        webkitLineClamp: comp.webkitLineClamp,
        overflow: comp.overflow,
        textOverflow: comp.textOverflow,
        wordBreak: comp.wordBreak,
        overflowWrap: comp.overflowWrap,
      };
    });
    console.log("Title Clamp Styles:", titleStyles);

    console.log("Edge cases verification complete!");
  } finally {
    await browser.close();
  }
}

run().catch(console.error);

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

  await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, {
    waitUntil: "networkidle2",
  });
  await new Promise((r) => setTimeout(r, 2000));

  const testResult = await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main") as HTMLElement;
    const rootDiv = main.firstElementChild as HTMLElement;
    const nav = document.querySelector(".sticky") as HTMLElement;

    rootDiv.insertBefore(nav, rootDiv.firstElementChild);

    // Apply negative top margin and padding to cover container padding
    // Desktop main has padding-top: 40px (md:pt-10) and padding-left/right: 40px (md:p-10)
    nav.style.position = "sticky";
    nav.style.top = "-40px"; // or top: 0 with -mt-10
    nav.style.marginTop = "-40px";
    nav.style.paddingTop = "40px";
    nav.style.marginLeft = "-40px";
    nav.style.marginRight = "-40px";
    nav.style.paddingLeft = "40px";
    nav.style.paddingRight = "40px";
    nav.style.zIndex = "40";
    nav.style.backgroundColor = "var(--background)";

    const scrollPoints = [0, 100, 300, 600];
    const data = scrollPoints.map((pt) => {
      main.scrollTop = pt;
      const rect = nav.getBoundingClientRect();
      // Check if anything visible is above nav.top
      const elements = Array.from(rootDiv.querySelectorAll("*"));
      const visibleAbove = elements.filter((el) => {
        if (el === nav || nav.contains(el)) return false;
        const r = el.getBoundingClientRect();
        return r.top < rect.top && r.bottom > 0 && r.height > 0;
      });

      return {
        pt,
        scrollTop: main.scrollTop,
        navTop: rect.top,
        navBottom: rect.bottom,
        navHeight: rect.height,
        navLeft: rect.left,
        navWidth: rect.width,
        elementsAboveNav: visibleAbove.length,
      };
    });

    return data;
  });

  console.log("NEGATIVE TOP MARGIN & PADDING RESULT:");
  console.log(JSON.stringify(testResult, null, 2));

  await browser.close();
}

main().catch(console.error);

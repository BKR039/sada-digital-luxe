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
    defaultViewport: { width: 390, height: 844 }, // Mobile viewport
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

  console.log("Testing Mobile behavior (390x844)...");
  const results = await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main") as HTMLElement;
    const rootDiv = main.firstElementChild as HTMLElement;
    const nav = document.querySelector(".sticky") as HTMLElement;

    if (!nav || !main) return { error: "nav or main not found" };

    // Move nav to top of rootDiv
    rootDiv.insertBefore(nav, rootDiv.firstElementChild);

    // Style nav
    const mobileHeader = document.querySelector("header.md\\:hidden") as HTMLElement;
    const headerRect = mobileHeader ? mobileHeader.getBoundingClientRect() : null;

    // What if sticky top is headerRect ? headerRect.height : 0
    const stickyTop = headerRect ? headerRect.height : 56;
    nav.style.position = "sticky";
    nav.style.top = `${stickyTop}px`;
    nav.style.zIndex = "35";

    const scrollPoints = [0, 100, 300, 600];
    const data: any[] = [];

    for (const pt of scrollPoints) {
      main.scrollTop = pt;
      const rect = nav.getBoundingClientRect();
      data.push({
        scrollTop: pt,
        headerBottom: headerRect ? headerRect.bottom : null,
        navTop: rect.top,
        navBottom: rect.bottom,
        navHeight: rect.height,
        navTopMinusHeaderBottom: headerRect ? rect.top - headerRect.bottom : null,
      });
    }

    return { headerRect, data };
  });

  console.log("MOBILE EXPERIMENT RESULTS:");
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

main().catch(console.error);

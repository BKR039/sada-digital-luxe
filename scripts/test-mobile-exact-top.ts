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
    defaultViewport: { width: 390, height: 844 },
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
  await new Promise((r) => setTimeout(r, 1200));

  const result = await page.evaluate(() => {
    const main = document.querySelector("#sada-admin-main") as HTMLElement;
    const rootDiv = main.firstElementChild as HTMLElement;
    const nav = document.querySelector(".sticky") as HTMLElement;

    rootDiv.insertBefore(nav, rootDiv.firstElementChild);

    // Header has height 56px (h-14). Main has pt-16 (64px).
    // What if nav has:
    // marginTop: -64px + 56px = -8px? Or marginTop: -64px?
    // Let's test two configs:
    // Config 1: marginTop = "-64px", paddingTop = "8px", top = "56px"
    nav.style.position = "sticky";
    nav.style.marginTop = "-64px";
    nav.style.top = "56px";
    nav.style.paddingTop = "8px";
    nav.style.zIndex = "35";

    const pts = [0, 50, 100, 300];
    return pts.map((pt) => {
      main.scrollTop = pt;
      const rect = nav.getBoundingClientRect();
      return { pt, scrollTop: main.scrollTop, navTop: rect.top, navBottom: rect.bottom };
    });
  });

  console.log("MOBILE EXACT TOP CONFIG 1:", JSON.stringify(result, null, 2));

  await browser.close();
}

main().catch(console.error);

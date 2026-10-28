import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      env[match[1]] = value;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  const { data } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  const session = data.session;

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  await page.evaluate(
    ({ session, key }) => {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem("supabase.auth.token", JSON.stringify(session));
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "dark");
    },
    { session, key: storageKey }
  );

  console.log("Navigating to http://localhost:3000/admin...");
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1500));

  // Click on Client Workspaces sidebar link
  console.log("Clicking Client Workspaces sidebar item...");
  const clicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("aside a, nav a, a"));
    const link = links.find((a) => a.textContent?.includes("Client Workspaces"));
    if (link) {
      (link as HTMLElement).click();
      return { clicked: true, href: link.getAttribute("href") };
    }
    return { clicked: false, href: null };
  });
  console.log("Clicked sidebar link:", clicked);

  await new Promise((r) => setTimeout(r, 2000));
  console.log("Current URL after click:", page.url());

  const diagnostic = await page.evaluate(() => {
    const mainContent = document.querySelector("main")?.innerText || "";
    const hasNotFound = document.body.innerText.includes("Not Found");
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      hasNotFound,
      mainTextPreview: mainContent.slice(0, 500),
      bodyPreview: document.body.innerText.slice(0, 500),
    };
  });
  console.log("Diagnostic:", diagnostic);

  await page.screenshot({ path: "scripts/screenshots/reproduced_client_workspaces_notfound.png" });
  await browser.close();
}

run().catch(console.error);

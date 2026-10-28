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

async function getAdminSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    console.warn("Could not sign in with qa.superadmin@sada.agency:", error?.message);
    return null;
  }
  return data.session;
}

async function main() {
  const session = await getAdminSession();
  console.log("Admin session authenticated:", Boolean(session));

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page: Page = await browser.newPage();

  // Set auth session in localStorage before navigating
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  if (session) {
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    await page.evaluate(({ sess, key }) => {
      localStorage.setItem(key, JSON.stringify(sess));
      localStorage.setItem("supabase.auth.token", JSON.stringify(sess));
      localStorage.setItem("sada-lang", "en");
    }, { sess: session, key: storageKey });
  }

  console.log("\n1. Navigating to http://localhost:3000/admin/client-workspaces...");
  await page.goto("http://localhost:3000/admin/client-workspaces", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  const url1 = page.url();
  const text1 = await page.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    return main.innerText.slice(0, 400);
  });
  console.log("URL after navigation:", url1);
  console.log("Content snippet:\n", text1);

  console.log("\n2. Checking sidebar link for Client Workspaces...");
  const sidebarHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("aside a"));
    const cwLink = links.find((l) => (l.textContent || "").includes("Client Workspaces") || (l.textContent || "").includes("مساحات عمل"));
    return cwLink ? cwLink.getAttribute("href") : "NOT FOUND";
  });
  console.log("Sidebar link href:", sidebarHref);

  await browser.close();
}

main().catch(console.error);

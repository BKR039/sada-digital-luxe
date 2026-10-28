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

async function main() {
  const { data: adminAuth } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  const adminSession = adminAuth.session;

  const { data: workerAuth } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  const workerSession = workerAuth.session;

  const { data: clients } = await supabase.from("clients").select("id, name").limit(3);
  const testClientId = clients?.[0]?.id || "test-client";
  console.log("Test Client ID:", testClientId);

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const urlsToTest = [
    "/admin/client-workspaces",
    "/admin/client-workspaces/",
    `/admin/client-workspaces/${testClientId}`,
    "/admin/clients",
    "/admin/clients/",
    `/admin/clients/${testClientId}`,
    "/admin/client-projects",
    "/admin/client-projects/",
    `/admin/client-projects/${testClientId}`,
  ];

  const page = await browser.newPage();
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;

  const setupAuth = async (sess: any) => {
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ session, key }) => {
        localStorage.setItem(key, JSON.stringify(session));
        localStorage.setItem("supabase.auth.token", JSON.stringify(session));
        localStorage.setItem("sada-lang", "en");
        localStorage.setItem("sada-theme", "dark");
      },
      { session: sess, key: storageKey }
    );
  };

  console.log("\n--- TESTING AS SUPERADMIN ---");
  await setupAuth(adminSession);

  for (const urlPath of urlsToTest) {
    try {
      await page.goto(`http://localhost:3000${urlPath}`, { waitUntil: "networkidle2", timeout: 15000 });
      await new Promise(r => setTimeout(r, 1000));
      const res = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const mainText = document.querySelector("main")?.innerText || "";
        const notFoundInMain = mainText.includes("Not Found") || mainText.startsWith("Not Found");
        const notFoundInBody = bodyText.includes("Not Found");
        const h1 = document.querySelector("h1")?.innerText || "";
        return {
          finalUrl: window.location.href,
          pathname: window.location.pathname,
          notFoundInMain,
          notFoundInBody,
          h1,
          mainSnippet: mainText.substring(0, 100).replace(/\n/g, " "),
        };
      });
      console.log(`[SuperAdmin] ${urlPath} -> ${res.pathname} | Not Found in Main: ${res.notFoundInMain} | Main: "${res.mainSnippet}"`);
      if (res.notFoundInMain) {
        await page.screenshot({ path: `scripts/screenshots/notfound_superadmin_${urlPath.replace(/[/]/g, "_")}.png` });
      }
    } catch (err: any) {
      console.log(`[SuperAdmin] ${urlPath} ERROR:`, err.message);
    }
  }

  console.log("\n--- TESTING AS WORKER ---");
  await setupAuth(workerSession);

  for (const urlPath of urlsToTest) {
    try {
      await page.goto(`http://localhost:3000${urlPath}`, { waitUntil: "networkidle2", timeout: 15000 });
      await new Promise(r => setTimeout(r, 1000));
      const res = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const mainText = document.querySelector("main")?.innerText || "";
        const notFoundInMain = mainText.includes("Not Found") || mainText.startsWith("Not Found");
        const notFoundInBody = bodyText.includes("Not Found");
        return {
          finalUrl: window.location.href,
          pathname: window.location.pathname,
          notFoundInMain,
          notFoundInBody,
          mainSnippet: mainText.substring(0, 100).replace(/\n/g, " "),
        };
      });
      console.log(`[Worker] ${urlPath} -> ${res.pathname} | Not Found in Main: ${res.notFoundInMain} | Main: "${res.mainSnippet}"`);
      if (res.notFoundInMain) {
        await page.screenshot({ path: `scripts/screenshots/notfound_worker_${urlPath.replace(/[/]/g, "_")}.png` });
      }
    } catch (err: any) {
      console.log(`[Worker] ${urlPath} ERROR:`, err.message);
    }
  }

  // Also test clicking from sidebar directly in UI
  console.log("\n--- TESTING SIDEBAR CLICK TRANSITIONS ---");
  await setupAuth(adminSession);
  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1000));

  const sidebarLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("aside a")).map(a => ({
      text: a.textContent?.trim(),
      href: a.getAttribute("href"),
    }));
  });
  console.log("Sidebar Links:", sidebarLinks);

  // Click Client Workspaces
  await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll("aside a")).find(a => a.textContent?.includes("Client Workspaces"));
    (link as HTMLElement)?.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  const clickRes = await page.evaluate(() => {
    const mainText = document.querySelector("main")?.innerText || "";
    return {
      url: window.location.href,
      notFoundInMain: mainText.includes("Not Found"),
      mainSnippet: mainText.substring(0, 100).replace(/\n/g, " "),
    };
  });
  console.log("After Sidebar Click:", clickRes);

  await browser.close();
}

main().catch(console.error);

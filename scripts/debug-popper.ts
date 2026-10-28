import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

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

async function main() {
  const { data } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.evaluate(({ session, k }) => {
    localStorage.setItem("sada-lang", "en");
    localStorage.setItem("sada-theme", "light");
    localStorage.setItem(k, JSON.stringify(session));
    localStorage.setItem("supabase.auth.token", JSON.stringify(session));
  }, { session: data.session, k: storageKey });

  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1000));

  // Find all bell buttons
  const bells = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'));
    return all.map((b, i) => {
      const rect = b.getBoundingClientRect();
      const parent = b.closest('#sada-admin-sidebar') ? 'sidebar' : b.closest('header') ? 'header' : 'other';
      return { index: i, parent, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } };
    });
  });
  console.log("All bell buttons found:", bells);

  // Click the sidebar bell specifically
  await page.evaluate(() => {
    const sidebarBell = document.querySelector('#sada-admin-sidebar button[aria-haspopup="dialog"]');
    if (sidebarBell) {
      (sidebarBell as HTMLElement).click();
    }
  });

  await new Promise((r) => setTimeout(r, 800));

  const popperAnalysis = await page.evaluate(() => {
    const wrapper = document.querySelector("[data-radix-popper-content-wrapper]");
    const content = wrapper?.firstElementChild;
    const sidebar = document.querySelector("#sada-admin-sidebar");
    const logo = document.querySelector('#sada-admin-sidebar a[href="/"] img, #sada-admin-sidebar a[href="/"]');
    const identityBox = document.querySelector('#sada-admin-sidebar .rounded-2xl');
    const bell = document.querySelector('#sada-admin-sidebar button[aria-haspopup="dialog"]');

    const popoverRect = content?.getBoundingClientRect();
    const logoRect = logo?.getBoundingClientRect();
    const identityRect = identityBox?.getBoundingClientRect();

    const overlapsLogo = popoverRect && logoRect ? !(
      popoverRect.right < logoRect.left ||
      popoverRect.left > logoRect.right ||
      popoverRect.bottom < logoRect.top ||
      popoverRect.top > logoRect.bottom
    ) : false;

    const overlapsIdentity = popoverRect && identityRect ? !(
      popoverRect.right < identityRect.left ||
      popoverRect.left > identityRect.right ||
      popoverRect.bottom < identityRect.top ||
      popoverRect.top > identityRect.bottom
    ) : false;

    return {
      wrapperStyle: wrapper?.getAttribute("style"),
      contentDataSide: content?.getAttribute("data-side"),
      contentDataAlign: content?.getAttribute("data-align"),
      bellRect: bell ? { x: bell.getBoundingClientRect().x, y: bell.getBoundingClientRect().y, w: bell.getBoundingClientRect().width, h: bell.getBoundingClientRect().height } : null,
      contentRect: content ? { x: content.getBoundingClientRect().x, y: content.getBoundingClientRect().y, w: content.getBoundingClientRect().width, h: content.getBoundingClientRect().height } : null,
      sidebarRect: sidebar ? { x: sidebar.getBoundingClientRect().x, y: sidebar.getBoundingClientRect().y, w: sidebar.getBoundingClientRect().width, h: sidebar.getBoundingClientRect().height } : null,
      overlapsLogo,
      overlapsIdentity,
    };
  });

  console.log("Popper Analysis after clicking sidebar bell:", JSON.stringify(popperAnalysis, null, 2));
  await page.screenshot({ path: "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\0a498431-76c6-4e93-b54f-d0b328068466\\shell_branding_qa\\test_sidebar_click.png" });
  await browser.close();
}

main().catch(console.error);

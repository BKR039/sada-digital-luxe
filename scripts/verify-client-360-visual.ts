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
const artifactDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\96632da9-4418-4b03-95d4-508da0f84e11";

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

async function verifyClient360() {
  console.log("Starting Client 360 Visual Verification with Chrome...");
  const session = await getAdminSession();
  console.log("Admin session acquired:", Boolean(session));

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Inject session and language into localStorage before load
  await page.evaluateOnNewDocument(
    ({ sessionData, storageKey }) => {
      localStorage.setItem("sada-lang", "ar");
      localStorage.setItem("sada-theme", "dark");
      if (sessionData) {
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
      }
    },
    {
      sessionData: session,
      storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
    }
  );

  // 1. Open Client Directory
  console.log("1. Navigating to Client Directory...");
  await page.goto(`${BASE_URL}/admin/clients?lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2500));

  await page.screenshot({ path: path.join(artifactDir, "client_directory_verified.png"), fullPage: false });
  console.log("✓ Saved client_directory_verified.png");

  // Get first client link from the rendered table
  const clientHref = await page.evaluate(() => {
    const link = document.querySelector('tbody tr a[href*="/admin/clients/"]');
    return link ? link.getAttribute("href") : null;
  });

  console.log("Discovered client link from DOM:", clientHref);
  if (!clientHref) {
    throw new Error("Could not find client link in DOM table!");
  }

  console.log(`2. Navigating to Client 360 at: ${clientHref}...`);
  await page.goto(`${BASE_URL}${clientHref}?lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Screenshot 1: Overview 360 Cockpit
  await page.screenshot({ path: path.join(artifactDir, "client_360_overview.png"), fullPage: false });
  console.log("✓ Saved client_360_overview.png");

  const baseUrlWithoutQuery = clientHref.split("?")[0];

  // 3. Switch to Services & Package Tab
  console.log("3. Switching to Services & Package Tab...");
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=services&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_services.png"), fullPage: false });
  console.log("✓ Saved client_360_services.png");

  // 4. Switch to Monthly Delivery Center Tab
  console.log("4. Switching to Monthly Delivery Center Tab...");
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=delivery&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_delivery.png"), fullPage: false });
  console.log("✓ Saved client_360_delivery.png");

  // 5. Switch to Team & Work Tab
  console.log("5. Switching to Team & Work Tab...");
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=team&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_team.png"), fullPage: false });
  console.log("✓ Saved client_360_team.png");

  // 6. Switch to Financial & Ads Tab
  console.log("6. Switching to Financial & Ads Tab...");
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=finance&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_finance.png"), fullPage: false });
  console.log("✓ Saved client_360_finance.png");

  // 7. Switch to Notes Tab
  console.log("7. Switching to Notes Tab...");
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=notes&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_notes.png"), fullPage: false });
  console.log("✓ Saved client_360_notes.png");

  // 8. Switch to Work History Tab
  console.log("8. Switching to Work History Tab...");
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=history&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_history.png"), fullPage: false });
  console.log("✓ Saved client_360_history.png");

  // 9. Mobile Responsive View Test (390x844)
  console.log("9. Testing Mobile Responsive View...");
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${BASE_URL}${baseUrlWithoutQuery}?tab=overview&lang=ar`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(artifactDir, "client_360_mobile.png"), fullPage: false });
  console.log("✓ Saved client_360_mobile.png");

  await browser.close();
  console.log("All Client 360 Visual Verification checks completed successfully!");
}

verifyClient360().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});

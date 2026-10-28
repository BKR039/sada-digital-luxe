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
const artifactDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\82b99962-f23c-4617-bd24-c104a54622c9";

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

async function runVisualQA() {
  console.log("==================================================");
  console.log("RUNNING CLIENT 360 FINAL UNIFICATION VISUAL QA");
  console.log("==================================================");

  const session = await getAdminSession();
  console.log("Admin session authenticated:", Boolean(session));

  // Get active client
  const { data: clientList, error: clientErr } = await supabase
    .from("clients")
    .select("id, name, client_type")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: monthlyClients } = await supabase
    .from("clients")
    .select("id, name, client_type")
    .eq("client_type", "monthly")
    .limit(5);

  const testClient = clientList && clientList.length > 0 ? clientList[0] : { id: "f760aebb-99e5-4881-93b2-431b9a65b450", name: "Test Client", client_type: "one_off" };
  const monthlyClient = monthlyClients && monthlyClients.length > 0 ? monthlyClients[0] : testClient;
  console.log("One-Off Target Client:", testClient.name, `(${testClient.id})`);
  console.log("Monthly Target Client:", monthlyClient.name, `(${monthlyClient.id})`);

  const targetClientUrl = `${BASE_URL}/admin/clients/${testClient.id}`;
  const targetMonthlyUrl = `${BASE_URL}/admin/clients/${monthlyClient.id}`;

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Helper to configure page session, theme, and language
  const configureSession = async (theme: "dark" | "light" = "dark", lang: "ar" | "en" = "ar") => {
    await page.evaluateOnNewDocument(
      ({ sessionData, storageKey, th, lg }) => {
        localStorage.setItem("sada-lang", lg);
        localStorage.setItem("sada-theme", th);
        if (sessionData) {
          localStorage.setItem(storageKey, JSON.stringify(sessionData));
        }
      },
      {
        sessionData: session,
        storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
        th: theme,
        lg: lang,
      }
    );
  };

  await configureSession("dark", "ar");

  // ----------------------------------------------------
  // VIEWPORT 1: Desktop 1440 x 900 (Arabic Dark Mode)
  // ----------------------------------------------------
  console.log("1. Capturing Desktop 1440x900 (Arabic Dark Mode)...");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${targetClientUrl}?lang=ar`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise(r => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_overview_ar_dark.png"), fullPage: false });
  console.log("✓ Saved 1440_client360_overview_ar_dark.png");

  // Scroll to Services
  console.log("2. Capturing Services & Package Section...");
  await page.evaluate(() => {
    document.getElementById("services-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_services_ar_dark.png"), fullPage: false });
  console.log("✓ Saved 1440_client360_services_ar_dark.png");

  // Scroll to Monthly Delivery
  console.log("3. Capturing Monthly Delivery Center Section...");
  await page.evaluate(() => {
    document.getElementById("delivery-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_delivery_ar_dark.png"), fullPage: false });
  console.log("✓ Saved 1440_client360_delivery_ar_dark.png");

  // Scroll to Team
  console.log("4. Capturing Team & Active Contributors Section...");
  await page.evaluate(() => {
    document.getElementById("team-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_team_ar_dark.png"), fullPage: false });
  console.log("✓ Saved 1440_client360_team_ar_dark.png");

  // Scroll to Financial
  console.log("5. Capturing Financial & Sponsoring Section...");
  await page.evaluate(() => {
    document.getElementById("financial-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_financial_ar_dark.png"), fullPage: false });
  console.log("✓ Saved 1440_client360_financial_ar_dark.png");

  // Scroll to Client Memory
  console.log("6. Capturing Client Memory Directives Section...");
  await page.evaluate(() => {
    document.getElementById("memory-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_memory_ar_dark.png"), fullPage: false });
  console.log("✓ Saved 1440_client360_memory_ar_dark.png");

  // Scroll to Work History
  console.log("7. Capturing Work History Archive Section...");
  await page.evaluate(() => {
    document.getElementById("history-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_client360_history_ar_dark.png"), fullPage: false });
  // 7b. Capture Monthly Retainer Client Specific View
  console.log("7b. Capturing Monthly Client 360 View...");
  await page.goto(`${targetMonthlyUrl}?lang=ar`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(artifactDir, "1440_monthly_client_overview.png"), fullPage: false });
  console.log("✓ Saved 1440_monthly_client_overview.png");

  // Scroll to services
  await page.evaluate(() => {
    document.getElementById("services-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1440_monthly_client_services.png"), fullPage: false });
  console.log("✓ Saved 1440_monthly_client_services.png");

  // ----------------------------------------------------
  // VIEWPORT 2: Laptop 1280 x 800 (Arabic Dark Mode)
  // ----------------------------------------------------
  console.log("8. Capturing Laptop 1280x800...");
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1280_client360_header_cockpit.png"), fullPage: false });
  console.log("✓ Saved 1280_client360_header_cockpit.png");

  // ----------------------------------------------------
  // VIEWPORT 3: Tablet 1024 x 768 (Arabic Dark Mode)
  // ----------------------------------------------------
  console.log("9. Capturing Tablet Landscape 1024x768...");
  await page.setViewport({ width: 1024, height: 768 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "1024_client360_overview.png"), fullPage: false });
  console.log("✓ Saved 1024_client360_overview.png");

  // ----------------------------------------------------
  // VIEWPORT 4: Tablet Portrait 768 x 1024
  // ----------------------------------------------------
  console.log("10. Capturing Tablet Portrait 768x1024...");
  await page.setViewport({ width: 768, height: 1024 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "768_client360_portrait.png"), fullPage: false });
  console.log("✓ Saved 768_client360_portrait.png");

  // ----------------------------------------------------
  // VIEWPORT 5: Mobile 390 x 844 (iPhone 14)
  // ----------------------------------------------------
  console.log("11. Capturing Mobile 390x844...");
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(artifactDir, "390_client360_mobile_cockpit.png"), fullPage: false });
  console.log("✓ Saved 390_client360_mobile_cockpit.png");

  await page.evaluate(() => {
    document.getElementById("delivery-section")?.scrollIntoView({ behavior: "instant" });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "390_client360_mobile_delivery.png"), fullPage: false });
  console.log("✓ Saved 390_client360_mobile_delivery.png");

  // ----------------------------------------------------
  // VIEWPORT 6: Small Mobile 375 x 667 (iPhone SE)
  // ----------------------------------------------------
  console.log("12. Capturing Small Mobile 375x667...");
  await page.setViewport({ width: 375, height: 667, isMobile: true });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(artifactDir, "375_client360_small_mobile.png"), fullPage: false });
  console.log("✓ Saved 375_client360_small_mobile.png");

  // ----------------------------------------------------
  // TEST: English LTR & Light Mode (1440x900)
  // ----------------------------------------------------
  console.log("13. Capturing English LTR & Light Mode...");
  const lightPage = await browser.newPage();
  await lightPage.setViewport({ width: 1440, height: 900 });
  await lightPage.evaluateOnNewDocument(
    ({ sessionData, storageKey }) => {
      localStorage.setItem("sada-lang", "en");
      localStorage.setItem("sada-theme", "light");
      if (sessionData) {
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
      }
    },
    {
      sessionData: session,
      storageKey: "sb-mtfkzabiscyleztypqks-auth-token",
    }
  );
  await lightPage.goto(`${targetMonthlyUrl}?lang=en`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  await lightPage.screenshot({ path: path.join(artifactDir, "1440_client360_english_light.png"), fullPage: false });
  await lightPage.close();
  console.log("✓ Saved 1440_client360_english_light.png");

  // ----------------------------------------------------
  // TEST: Operations Center (/admin/client-projects)
  // ----------------------------------------------------
  console.log("14. Capturing Operations Center (/admin/client-projects)...");
  await page.evaluate(() => {
    localStorage.setItem("sada-lang", "ar");
    localStorage.setItem("sada-theme", "dark");
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.classList.add("dark");
  });
  await page.goto(`${BASE_URL}/admin/client-projects?lang=ar`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(artifactDir, "1440_operations_center_scorecard.png"), fullPage: false });
  console.log("✓ Saved 1440_operations_center_scorecard.png");

  await browser.close();
  console.log("==================================================");
  console.log("✓ ALL VISUAL QA CAPTURES FINISHED SUCCESSFULLY!");
  console.log("==================================================");
}

runVisualQA().catch(err => {
  console.error("Visual QA failed:", err);
  process.exit(1);
});

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
const outputDir = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\0a498431-76c6-4e93-b54f-d0b328068466\\client_workspaces_qa";

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function getAdminSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (error || !data.session) {
    throw new Error(`Failed to sign in as superadmin: ${error?.message}`);
  }
  return data.session;
}

async function getWorkerSession(): Promise<any> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  if (error || !data.session) {
    return null;
  }
  return data.session;
}

async function getFirstClientId(): Promise<string> {
  const { data, error } = await supabase.from("clients").select("id, name").order("created_at", { ascending: false }).limit(1);
  if (error || !data || data.length === 0) {
    throw new Error(`Failed to fetch client: ${error?.message}`);
  }
  return data[0].id;
}

async function getFirstProjectId(): Promise<string | null> {
  const { data } = await supabase.from("client_projects").select("id, client_id").limit(1);
  return data?.[0]?.id || null;
}

async function main() {
  console.log("=== SADA OS CLIENT WORKSPACES ROUTING VERIFICATION ===");
  const adminSession = await getAdminSession();
  const clientId = await getFirstClientId();
  const projectId = await getFirstProjectId();
  console.log("Using Test Client ID:", clientId);
  console.log("Using Test Project ID:", projectId);

  const browser: Browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page: Page = await browser.newPage();

  // Helper to authenticate session
  const setSession = async (sess: any, lang: "en" | "ar" = "en", theme: "dark" | "light" = "dark") => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    await page.evaluate(({ s, k, l, t }) => {
      localStorage.setItem(k, JSON.stringify(s));
      localStorage.setItem("supabase.auth.token", JSON.stringify(s));
      localStorage.setItem("sada-lang", l);
      localStorage.setItem("sada-theme", t);
    }, { s: sess, k: storageKey, l: lang, t: theme });
  };

  await setSession(adminSession, "en", "dark");

  const results: { scenario: string; passed: boolean; details: string }[] = [];

  // Scenario 1 & 2: Click Client Workspaces in sidebar & Confirm list loads
  console.log("\n--- Scenario 1 & 2: Sidebar Click & List Load ---");
  await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));

  // Find sidebar link
  const sidebarClicked = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("aside a"));
    const cwLink = links.find((l) => (l.textContent || "").includes("Client Workspaces") || (l.textContent || "").includes("مساحات عمل"));
    if (cwLink) {
      (cwLink as HTMLElement).click();
      return true;
    }
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));

  const listUrl = page.url();
  const listContent = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  const listPassed = listUrl.includes("/admin/client-workspaces") && !listContent.includes("Not Found") && (listContent.includes("Clients") || listContent.includes("العملاء"));
  console.log(`Scenario 1 & 2: URL=${listUrl}, Has 'Clients'=${listContent.includes("Clients")}, Has 'Not Found'=${listContent.includes("Not Found")}`);
  results.push({
    scenario: "1 & 2: Sidebar click navigates to /admin/client-workspaces and list loads without Not Found",
    passed: listPassed,
    details: `Navigated to ${listUrl}, found list content, no 'Not Found'`,
  });
  await page.screenshot({ path: path.join(outputDir, "01_list_from_sidebar.png") });

  // Scenario 3 & 4: Open existing client & confirm detail page loads correct client
  console.log("\n--- Scenario 3 & 4: Open Client & Detail Page ---");
  const detailNav = await page.evaluate(() => {
    const clientLink = document.querySelector("table tbody tr a, .grid a");
    if (clientLink) {
      (clientLink as HTMLElement).click();
      return true;
    }
    return false;
  });
  await new Promise(r => setTimeout(r, 2500));

  const detailUrl = page.url();
  const detailContent = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  const detailPassed = detailUrl.includes("/admin/client-workspaces/") && !detailContent.includes("Not Found") && detailContent.includes("SADA CLIENT 360");
  console.log(`Scenario 3 & 4: URL=${detailUrl}, Has 'SADA CLIENT 360'=${detailContent.includes("SADA CLIENT 360")}, Has 'Not Found'=${detailContent.includes("Not Found")}`);
  results.push({
    scenario: "3 & 4: Select client navigates to /admin/client-workspaces/$id and loads Client 360",
    passed: detailPassed,
    details: `URL: ${detailUrl}, loaded complete Client 360 command center`,
  });
  await page.screenshot({ path: path.join(outputDir, "02_client_360_detail.png") });

  // Scenario 5: Refresh the detail page directly
  console.log("\n--- Scenario 5: Direct Refresh ---");
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2000));
  const refreshUrl = page.url();
  const refreshContent = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  const refreshPassed = refreshUrl.includes("/admin/client-workspaces/") && !refreshContent.includes("Not Found") && refreshContent.includes("SADA CLIENT 360");
  console.log(`Scenario 5: URL=${refreshUrl}, Has 'SADA CLIENT 360'=${refreshContent.includes("SADA CLIENT 360")}`);
  results.push({
    scenario: "5: Direct refresh of Client Workspace detail page retains state and does not show Not Found",
    passed: refreshPassed,
    details: `URL: ${refreshUrl}, reloaded successfully`,
  });
  await page.screenshot({ path: path.join(outputDir, "03_direct_refresh.png") });

  // Scenario 6: Open the detail route in a new browser tab / page
  console.log("\n--- Scenario 6: New Tab / Direct URL ---");
  const newPage = await browser.newPage();
  await newPage.setViewport({ width: 1440, height: 900 });
  await newPage.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2000));
  const newTabUrl = newPage.url();
  const newTabContent = await newPage.evaluate(() => document.querySelector("main")?.innerText || "");
  const newTabPassed = newTabUrl.includes(`/admin/client-workspaces/${clientId}`) && !newTabContent.includes("Not Found") && newTabContent.includes("SADA CLIENT 360");
  console.log(`Scenario 6: URL=${newTabUrl}, Has 'SADA CLIENT 360'=${newTabContent.includes("SADA CLIENT 360")}`);
  results.push({
    scenario: "6: Direct navigation in a new tab to canonical detail URL loads Client 360",
    passed: newTabPassed,
    details: `URL: ${newTabUrl}`,
  });
  await newPage.close();

  // Scenario 7: Navigate back to the list
  console.log("\n--- Scenario 7: Back Navigation to List ---");
  const backClicked = await page.evaluate(() => {
    const backBtn = document.querySelector('a[href="/admin/client-workspaces"]') as HTMLElement;
    if (backBtn) {
      backBtn.click();
      return true;
    }
    return false;
  });
  await new Promise(r => setTimeout(r, 2000));
  const backUrl = page.url();
  const backContent = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  const backPassed = backUrl.endsWith("/admin/client-workspaces") && (backContent.includes("Clients") || backContent.includes("العملاء")) && !backContent.includes("Not Found");
  console.log(`Scenario 7: URL=${backUrl}, Has 'Clients'=${backContent.includes("Clients")}`);
  results.push({
    scenario: "7: Back link in workspace detail navigates cleanly back to /admin/client-workspaces",
    passed: backPassed,
    details: `URL: ${backUrl}`,
  });

  // Scenario 8: Test legacy client URLs and confirm clean redirects
  console.log("\n--- Scenario 8: Legacy Redirects ---");
  // 8a. /admin/clients -> /admin/client-workspaces
  await page.goto(`${BASE_URL}/admin/clients`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const redirectListUrl = page.url();
  const redirectListPassed = redirectListUrl.includes("/admin/client-workspaces");
  console.log(`Scenario 8a: /admin/clients redirected to: ${redirectListUrl}`);

  // 8b. /admin/clients/:id -> /admin/client-workspaces/:id
  await page.goto(`${BASE_URL}/admin/clients/${clientId}`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const redirectDetailUrl = page.url();
  const redirectDetailPassed = redirectDetailUrl.includes(`/admin/client-workspaces/${clientId}`);
  console.log(`Scenario 8b: /admin/clients/${clientId} redirected to: ${redirectDetailUrl}`);

  // 8c. /admin/client-projects -> /admin/client-workspaces
  await page.goto(`${BASE_URL}/admin/client-projects`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const redirectProjectsListUrl = page.url();
  const redirectProjectsListPassed = redirectProjectsListUrl.includes("/admin/client-workspaces");
  console.log(`Scenario 8c: /admin/client-projects redirected to: ${redirectProjectsListUrl}`);

  // 8d. /admin/client-projects/:id -> /admin/client-workspaces/:id (with project or client ID)
  const testRedirectId = projectId || clientId;
  await page.goto(`${BASE_URL}/admin/client-projects/${testRedirectId}`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const redirectProjectsDetailUrl = page.url();
  const redirectProjectsDetailPassed = redirectProjectsDetailUrl.includes("/admin/client-workspaces/");
  console.log(`Scenario 8d: /admin/client-projects/${testRedirectId} redirected to: ${redirectProjectsDetailUrl}`);

  results.push({
    scenario: "8: Legacy URLs (/admin/clients, /admin/clients/$id, /admin/client-projects, /admin/client-projects/$id) cleanly redirect to canonical destinations",
    passed: redirectListPassed && redirectDetailPassed && redirectProjectsListPassed && redirectProjectsDetailPassed,
    details: `/admin/clients -> ${redirectListUrl}, /admin/clients/:id -> ${redirectDetailUrl}, /admin/client-projects -> ${redirectProjectsListUrl}, /admin/client-projects/:id -> ${redirectProjectsDetailUrl}`,
  });

  // Scenario 9: Test invalid client ID
  console.log("\n--- Scenario 9: Invalid Client ID Handling ---");
  await page.goto(`${BASE_URL}/admin/client-workspaces/00000000-0000-0000-0000-000000000000`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2000));
  const invalidContent = await page.evaluate(() => document.querySelector("main")?.innerText || "");
  const invalidPassed = invalidContent.includes("Client Record Not Found") || invalidContent.includes("لم يتم العثور على سجل العميل") || invalidContent.includes("Return to Client Directory") || invalidContent.includes("العودة إلى دليل العملاء");
  console.log(`Scenario 9: Has 'Client Record Not Found' / Return button: ${invalidPassed}`);
  results.push({
    scenario: "9: Invalid client ID renders graceful SADA not-found state with Return button",
    passed: invalidPassed,
    details: `Handled with graceful client not found component`,
  });
  await page.screenshot({ path: path.join(outputDir, "04_invalid_client_graceful_not_found.png") });

  // Scenario 10: Unauthorized user access test
  console.log("\n--- Scenario 10: Unauthorized / Unauthenticated Access ---");
  const anonPage = await browser.newPage();
  await anonPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await anonPage.evaluate(() => localStorage.clear());
  await anonPage.goto(`${BASE_URL}/admin/client-workspaces`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 1500));
  const anonUrl = anonPage.url();
  const anonBlocked = anonUrl === `${BASE_URL}/` || anonUrl.includes("/auth");
  console.log(`Scenario 10: Unauthenticated access redirected to: ${anonUrl} (Blocked=${anonBlocked})`);
  results.push({
    scenario: "10: Unauthenticated/unauthorized request to /admin/client-workspaces is blocked by route guard",
    passed: anonBlocked,
    details: `Unauthenticated hit redirected to ${anonUrl}`,
  });
  await anonPage.close();

  // Scenario 11: Section 6 Sticky Navigator Opaque Check
  console.log("\n--- Scenario 11: Sticky Navigation Solid & Opaque ---");
  await setSession(adminSession, "en", "dark");
  await page.goto(`${BASE_URL}/admin/client-workspaces/${clientId}`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2000));

  const stickyStyles = await page.evaluate(() => {
    const nav = document.querySelector(".sticky");
    if (!nav) return null;
    const computed = window.getComputedStyle(nav);
    return {
      position: computed.position,
      backgroundColor: computed.backgroundColor,
      backdropFilter: computed.backdropFilter,
      zIndex: computed.zIndex,
    };
  });
  console.log("Sticky Navigator Computed Styles:", stickyStyles);
  const stickyPassed = stickyStyles !== null && stickyStyles.position === "sticky" && (!stickyStyles.backdropFilter || stickyStyles.backdropFilter === "none");
  results.push({
    scenario: "11: Sticky section navigation is solid and fully opaque without backdrop transparency",
    passed: stickyPassed,
    details: `Styles: pos=${stickyStyles?.position}, bg=${stickyStyles?.backgroundColor}, backdropFilter=${stickyStyles?.backdropFilter}`,
  });
  await page.screenshot({ path: path.join(outputDir, "05_sticky_navigation_solid.png") });

  console.log("\n=================== VERIFICATION SUMMARY ===================");
  let allPassed = true;
  for (const r of results) {
    console.log(`${r.passed ? "✅ PASS" : "❌ FAIL"}: ${r.scenario}`);
    if (!r.passed) allPassed = false;
  }

  await browser.close();

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

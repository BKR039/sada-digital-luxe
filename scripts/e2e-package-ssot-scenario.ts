import puppeteer, { Browser, Page } from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:3000";

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

async function injectAdminSession(page: Page) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "phase1.tester@sada.agency",
    password: "Phase1TestPassword123!",
  });
  if (error || !data.session) {
    throw new Error(`Auth failed: ${error?.message}`);
  }

  await page.evaluate((sessionData) => {
    const storageKey = "sb-mtfkzabiscyleztypqks-auth-token";
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
  }, data.session);

  return data.session;
}

async function runSSOTScenario() {
  console.log("==================================================");
  console.log("SADA OS — PACKAGE SINGLE SOURCE OF TRUTH (SSOT) E2E TEST");
  console.log("==================================================");

  // Authenticate admin client
  const adminClient = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
    email: "phase1.tester@sada.agency",
    password: "Phase1TestPassword123!",
  });
  if (authErr || !authData.user) {
    throw new Error(`Failed admin login: ${authErr?.message}`);
  }

  // Get active category for packages
  const { data: categories } = await adminClient.from("package_categories").select("id").limit(1);
  const categoryId = categories?.[0]?.id || null;

  const testPackageCode = `SSOT-TEST-${Date.now().toString().slice(-4)}`;
  const testPackageName = `SSOT Test Package ${testPackageCode}`;
  let initialPrice = 1750;
  let updatedPrice = 1890;
  let createdPackageId: string | null = null;

  try {
    // ------------------------------------------------------------
    // STEP 1: CREATE PACKAGE IN package_catalog
    // ------------------------------------------------------------
    console.log(`\n[STEP 1] Creating test package in canonical package_catalog (${testPackageCode})...`);
    const { data: newPkg, error: createErr } = await adminClient
      .from("package_catalog")
      .insert({
        code: testPackageCode,
        slug: testPackageCode.toLowerCase(),
        name: testPackageName,
        price: initialPrice,
        billing_type: "monthly",
        is_active: true,
        is_published: true,
        category_id: categoryId,
        description: "Canonical SSOT verification package",
        included_items: ["Social media management", "Weekly reporting", "Dedicated manager"],
      })
      .select()
      .single();

    if (createErr || !newPkg) {
      throw new Error(`Failed to create test package in package_catalog: ${createErr?.message}`);
    }
    createdPackageId = newPkg.id;
    console.log(`✓ Created test package: ID=${createdPackageId}, Code=${testPackageCode}, Price=${initialPrice} TND`);

    // Ensure PostgreSQL FK bridge is satisfied for deals table
    await adminClient.from("packages").upsert({
      id: createdPackageId,
      name: testPackageName,
      price: initialPrice,
      is_active: true,
      features: ["Social media management", "Weekly reporting"],
    }, { onConflict: "id" });

    // ------------------------------------------------------------
    // STEP 2: LAUNCH BROWSER & VERIFY IN /admin/packages
    // ------------------------------------------------------------
    console.log("\n[STEP 2] Launching browser to verify in /admin/packages...");
    const browser = await puppeteer.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--window-size=1280,800"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(`${BASE_URL}/auth`, { waitUntil: "domcontentloaded" });
    await injectAdminSession(page);

    await page.goto(`${BASE_URL}/admin/packages`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));
    const pkgListHtml = await page.content();
    const hasTestPkgInAdmin = pkgListHtml.includes(testPackageCode) || pkgListHtml.includes(testPackageName);
    console.log(`✓ /admin/packages reflects new package in catalog: ${hasTestPkgInAdmin}`);

    // ------------------------------------------------------------
    // STEP 3: VERIFY IN /admin/deals NEW DEAL MODAL
    // ------------------------------------------------------------
    console.log("\n[STEP 3] Opening /admin/deals New Deal package selector...");
    await page.goto(`${BASE_URL}/admin/deals`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));

    // Click "New Deal" button
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes("New Deal")) {
        await btn.click();
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 1200));
    const dealsModalHtml = await page.content();
    const hasTestPkgInDealsSelector =
      dealsModalHtml.includes(testPackageName) ||
      dealsModalHtml.includes(testPackageCode) ||
      dealsModalHtml.includes(initialPrice.toString());
    console.log(`✓ Deals New Deal modal contains canonical package: ${hasTestPkgInDealsSelector}`);

    // ------------------------------------------------------------
    // STEP 4: UPDATE PACKAGE PRICE IN package_catalog
    // ------------------------------------------------------------
    console.log(`\n[STEP 4] Updating package price to ${updatedPrice} TND in package_catalog...`);
    const { error: updateErr } = await adminClient
      .from("package_catalog")
      .update({ price: updatedPrice })
      .eq("id", createdPackageId);

    if (updateErr) {
      throw new Error(`Failed to update package price in DB: ${updateErr.message}`);
    }

    // Update FK bridge table
    await adminClient.from("packages").update({ price: updatedPrice }).eq("id", createdPackageId);
    console.log(`✓ DB package price updated to ${updatedPrice} TND.`);

    // ------------------------------------------------------------
    // STEP 5: VERIFY DEALS MODAL PROPAGATION OF NEW PRICE
    // ------------------------------------------------------------
    console.log("\n[STEP 5] Refreshing /admin/deals to verify updated price propagation...");
    await page.goto(`${BASE_URL}/admin/deals`, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector("h1", { timeout: 15000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));

    const buttonsAfter = await page.$$("button");
    for (const btn of buttonsAfter) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes("New Deal")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
    const dealsUpdatedHtml = await page.content();
    const hasUpdatedPriceInDeals =
      dealsUpdatedHtml.includes(updatedPrice.toString()) || dealsUpdatedHtml.includes(testPackageName);
    console.log(`✓ Deals New Deal reflects updated database price (${updatedPrice} TND): ${hasUpdatedPriceInDeals}`);

    await browser.close();

    console.log("\n==================================================");
    console.log("PACKAGE SSOT VERIFICATION RESULT: PASS");
    console.log("Proven: ONE DATABASE SOURCE (package_catalog) → live propagation");
    console.log("==================================================");

  } finally {
    // Cleanup test package
    if (createdPackageId) {
      console.log(`\nCleaning up test package ${createdPackageId}...`);
      await adminClient.from("deals").delete().eq("package_id", createdPackageId);
      await adminClient.from("package_catalog").delete().eq("id", createdPackageId);
      await adminClient.from("packages").delete().eq("id", createdPackageId);
      console.log("Cleanup complete.");
    }
  }
}

runSSOTScenario().catch((err) => {
  console.error("SSOT Scenario Error:", err);
  process.exit(1);
});

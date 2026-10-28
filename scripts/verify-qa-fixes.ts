import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// 1. Load environment variables
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

const client = createClient(supabaseUrl, anonKey);

async function runVerification() {
  console.log("==================================================");
  console.log("SADA OS — AUTHORITATIVE QA FIX & REGRESSION SUITE");
  console.log("==================================================");

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test #${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test #${totalTests}: ${testName}`);
      if (details) console.error(`       Details: ${details}`);
    }
  }

  // ------------------------------------------------------------
  // SECTION 1: Package Catalog SSOT Verification
  // ------------------------------------------------------------
  console.log("\n--- SECTION 1: Package Catalog SSOT Verification ---");

  // Test 1: Fetch from package_catalog
  const { data: catPkgs, error: catErr } = await client
    .from("package_catalog")
    .select("id, code, name, price, is_active, is_published")
    .eq("is_active", true)
    .order("price", { ascending: true });

  assert(!catErr && (catPkgs || []).length > 0, "package_catalog is readable and populated", `Count: ${catPkgs?.length || 0}`);

  // Test 2: Verify Growth & Starter prices match canonical SSOT
  const starter = catPkgs?.find(p => p.code === "MG-01");
  const growth = catPkgs?.find(p => p.code === "MG-02");
  const growthPlus = catPkgs?.find(p => p.code === "MG-03");

  assert(starter?.price === 699, "Starter package price is canonical 699 TND", `Actual: ${starter?.price}`);
  assert(growth?.price === 1090, "Growth package price is canonical 1090 TND", `Actual: ${growth?.price}`);
  assert(growthPlus?.price === 1290, "Growth+ package price is canonical 1290 TND", `Actual: ${growthPlus?.price}`);

  // ------------------------------------------------------------
  // SECTION 2: Deals <-> Package Catalog E2E Lifecycle
  // ------------------------------------------------------------
  console.log("\n--- SECTION 2: Deals Package Lifecycle & Foreign Key Bridge ---");

  // Login as Super Admin
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  assert(!authErr && !!authData.user, "Super Admin authenticated successfully", `User: ${authData?.user?.email}`);

  if (authData.user) {
    const adminClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
    });

    // Test 3: Create a dynamic package in package_catalog
    const testCode = `TEST-${Date.now().toString().slice(-4)}`;
    const testPrice = 1750;
    const { data: createdPkg, error: createPkgErr } = await adminClient
      .from("package_catalog")
      .insert({
        code: testCode,
        name: `Automated Test Package ${testCode}`,
        slug: `test-pkg-${testCode.toLowerCase()}`,
        package_type: "standard",
        billing_type: "monthly",
        price: testPrice,
        currency: "TND",
        is_active: true,
        is_published: true,
        monthly_reels: 6,
        monthly_posts: 6,
        platforms: ["instagram", "facebook"],
      })
      .select("*")
      .single();

    assert(!createPkgErr && !!createdPkg, `Created dynamic test package ${testCode} in package_catalog`, createPkgErr?.message);

    if (createdPkg) {
      // Test 4: Mirror to legacy packages table for foreign key constraint compatibility
      const { error: bridgeErr } = await adminClient
        .from("packages")
        .upsert({
          id: createdPkg.id,
          name: createdPkg.name,
          selling_price: createdPkg.price,
          services: createdPkg.platforms,
          is_active: true,
        });

      assert(!bridgeErr, "Packages legacy table bridge mirror synced successfully", bridgeErr?.message);

      // Test 5: Create a Deal linking to this newly created package_catalog ID
      const { data: newDeal, error: dealErr } = await adminClient
        .from("deals")
        .insert({
          title: `Deal for ${createdPkg.name}`,
          company_name: "QA Test Corp",
          contact_name: "Sarah Tester",
          stage: "lead",
          package_id: createdPkg.id,
          deal_value: testPrice,
          service_revenue: testPrice,
          sponsoring_budget: 0,
          commission_rate: 10,
        })
        .select("*")
        .single();

      assert(!dealErr && !!newDeal, "Deal successfully created referencing package_catalog ID without FK constraint violation", dealErr?.message);

      // Test 6: Verify Deal fetches and attaches package correctly
      if (newDeal) {
        const { data: fetchedPkg } = await adminClient
          .from("package_catalog")
          .select("*, category:package_categories(name)")
          .eq("id", newDeal.package_id)
          .single();

        assert(fetchedPkg?.code === testCode && fetchedPkg?.price === testPrice, "Deal resolves correct package_catalog details (code, price, name)");

        // Test 7: Update price in package_catalog and verify reflection
        const updatedPrice = 1890;
        const { error: updateErr } = await adminClient
          .from("package_catalog")
          .update({ price: updatedPrice })
          .eq("id", createdPkg.id);

        assert(!updateErr, "Updated price in package_catalog to 1890 TND", updateErr?.message);

        const { data: verifyPkg } = await adminClient
          .from("package_catalog")
          .select("price")
          .eq("id", createdPkg.id)
          .single();

        assert(verifyPkg?.price === updatedPrice, "package_catalog confirms updated price 1890 TND immediately");

        // Clean up test deal
        await adminClient.from("deals").delete().eq("id", newDeal.id);
      }

      // Clean up test package
      await adminClient.from("package_catalog").delete().eq("id", createdPkg.id);
      await adminClient.from("packages").delete().eq("id", createdPkg.id);
    }
  }

  // ------------------------------------------------------------
  // SECTION 3: RBAC Roles Verification
  // ------------------------------------------------------------
  console.log("\n--- SECTION 3: RBAC Route Guard & Role Isolation ---");

  // Test 8: Anonymous user cannot fetch private tables
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: anonDeals, error: anonDealsErr } = await anonClient.from("deals").select("*");
  assert(anonDeals === null || anonDeals?.length === 0 || !!anonDealsErr, "Anonymous client is blocked from reading deals via RLS");

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log("==================================================");

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});

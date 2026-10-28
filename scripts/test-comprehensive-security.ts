import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { runPackageRecommendationEngine, fetchMatcherEligiblePackages } from "../src/lib/smart-match-service";

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://mtfkzabiscyleztypqks.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("============================================================");
  console.log("SADA OS — COMPREHENSIVE SECURITY & RLS AUDIT TEST SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title}`);
      if (detail) console.error(`         -> ${detail}`);
      failed++;
    }
  }

  // 1. Authenticate Admin
  console.log("1. Authenticating Super Admin...");
  const { error: authErr } = await adminClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!authErr, "Super Admin authenticated successfully", authErr?.message);

  // 2. Super Admin can read all 35 packages and internal metrics
  console.log("\n2. Testing Super Admin catalog access...");
  const { data: adminAll, error: adminErr } = await adminClient
    .from("package_catalog")
    .select("code, is_internal_only, is_published, approval_status, employee_cost, gross_margin, operational_notes");

  assert(!adminErr && Boolean(adminAll && adminAll.length === 35), `Super Admin reads all 35 packages (found ${adminAll?.length || 0})`);
  const hasMg01 = adminAll?.some(p => p.code === "MG-01");
  const hasHy05 = adminAll?.some(p => p.code === "HY-05");
  const hasPubMs01 = adminAll?.some(p => p.code === "PUB-MS-01");
  assert(hasMg01 && hasHy05 && hasPubMs01, "Super Admin sees MG-01, HY-05, and PUB-MS-01");

  // 3. Anonymous user tests against current catalog
  console.log("\n3. Testing Anonymous user isolation...");
  const { data: anonAll, error: anonErr } = await anonClient
    .from("package_catalog")
    .select("*");

  assert(!anonErr, "Anon query executes without Postgres exception", anonErr?.message);
  assert(anonAll?.length === 0, `Anon receives 0 records from package_catalog (found ${anonAll?.length || 0})`);

  // Explicit targeted query for internal code
  const { data: anonInternal } = await anonClient
    .from("package_catalog")
    .select("*")
    .eq("code", "HY-05");
  assert(!anonInternal || anonInternal.length === 0, "Anon cannot read internal package HY-05 by code");

  // Explicit targeted query for unapproved proposal
  const { data: anonProposal } = await anonClient
    .from("package_catalog")
    .select("*")
    .eq("code", "PUB-MS-01");
  assert(!anonProposal || anonProposal.length === 0, "Anon cannot read unapproved proposal PUB-MS-01 by code");

  // 4. Test Anonymous write operations (MUST FAIL)
  console.log("\n4. Testing Anonymous write permissions...");
  const { error: anonInsertErr } = await anonClient
    .from("package_catalog")
    .insert({
      code: "HACK-01",
      name: "Hacked Package",
      price: 10,
    });
  assert(Boolean(anonInsertErr), "Anon cannot INSERT into package_catalog", anonInsertErr?.message);

  const { error: anonUpdateErr } = await anonClient
    .from("package_catalog")
    .update({ name: "Tampered" })
    .eq("code", "MG-01");
  assert(Boolean(anonUpdateErr), "Anon cannot UPDATE package_catalog", anonUpdateErr?.message);

  // 5. Test Published Public Package Behavior (Active Verification)
  console.log("\n5. Testing Active Published Package RLS & Leakage Boundaries...");
  const testPkgCode = "TEST-PUB-TEMP";
  // Create temporary published public package as Admin
  const { data: createdPkg, error: createErr } = await adminClient
    .from("package_catalog")
    .insert({
      code: testPkgCode,
      name: "Test Public Package",
      slug: "test-public-package-temp",
      price: 199,
      billing_type: "one_time",
      billing_unit: "project",
      is_active: true,
      is_published: true,
      is_internal_only: false,
      approval_status: "approved",
      employee_cost: 75.0,
      operational_notes: "TOP_SECRET_INTERNAL_NOTE_NEVER_EXPOSE",
    })
    .select("id, code")
    .single();

  assert(!createErr, "Created temporary published package as Admin", createErr?.message);

  if (createdPkg?.id) {
    try {
      // Test 5A: Anonymous CAN read this published public package
      const { data: anonPubRow, error: anonPubErr } = await anonClient
        .from("package_catalog")
        .select("id, code, name, price, billing_unit, is_published, approval_status")
        .eq("id", createdPkg.id)
        .single();

      assert(!anonPubErr && anonPubRow?.code === testPkgCode, "Anon CAN read approved & published public package");

      // Test 5B: Still cannot read internal packages while a published package exists
      const { data: anonCheckInternal } = await anonClient
        .from("package_catalog")
        .select("code")
        .eq("code", "MG-01");
      assert(!anonCheckInternal || anonCheckInternal.length === 0, "Anon STILL cannot read internal MG-01 while public package exists");

      // Test 5C: Smart Matching with temporary published package
      console.log("\n6. Testing Smart Matcher Isolation...");
      const eligible = await fetchMatcherEligiblePackages();
      assert(eligible.length === 1 && eligible[0].code === testPkgCode, `Smart Matcher finds exactly 1 eligible published package (${eligible[0]?.code})`);

      const recResult = runPackageRecommendationEngine(eligible, {
        objective: "sales",
        budgetRange: "under_1000",
        businessType: "other",
        businessStage: "established",
        contentIntensity: "standard",
        advertisingNeed: "not_needed",
        websiteNeed: "not_needed",
      });

      assert(recResult.status === "success" || recResult.status === "match" || recResult.status === "custom_fit", `Smart Matcher processed recommendation (status: ${recResult.status})`);
      assert(recResult.bestFit?.packageCode === testPkgCode, `Smart Matcher recommended test public package`);
      
      // Verify no internal codes leaked in recommendation
      const allRecCodes = [recResult.bestFit?.packageCode, ...(recResult.alternatives || []).map(a => a.packageCode)].filter(Boolean);
      const leakedInternal = allRecCodes.filter(c => c !== testPkgCode);
      assert(leakedInternal.length === 0, "No internal codes leaked in recommendations", `Leaked: ${leakedInternal.join(", ")}`);

    } finally {
      // Clean up temporary package
      await adminClient.from("package_catalog").delete().eq("id", createdPkg.id);
      console.log("  [CLEANUP] Deleted temporary published test package.");
    }
  }

  // 7. Verify all 9 public proposals remain strictly unpublished & unapproved
  console.log("\n7. Verifying all 9 Public Proposals remain unpublished...");
  const { data: proposals } = await adminClient
    .from("package_catalog")
    .select("code, name, proposed_price, is_published, approval_status")
    .like("code", "PUB-%");

  assert(Boolean(proposals && proposals.length === 9), `Found exactly 9 public proposals in database (${proposals?.length || 0})`);
  const anyPublished = (proposals || []).some(p => p.is_published === true);
  const anyApproved = (proposals || []).some(p => p.approval_status !== "proposed");
  assert(!anyPublished, "ALL 9 public proposals have is_published = false");
  assert(!anyApproved, "ALL 9 public proposals have approval_status = 'proposed'");

  console.log("\n============================================================");
  console.log(`SECURITY AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");
}

main().catch(console.error);

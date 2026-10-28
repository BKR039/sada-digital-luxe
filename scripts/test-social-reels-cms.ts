// ============================================================
// SADA OS — Social Reels CMS & Homepage Showcase Test Suite
// Verifying against the live remote Supabase database
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

interface TestRecord {
  id: number;
  section: string;
  name: string;
  status: "PASS" | "FAIL";
  details?: string;
}

const records: TestRecord[] = [];

function assertTest(id: number, section: string, name: string, condition: boolean, details?: string) {
  const status = condition ? "PASS" : "FAIL";
  records.push({ id, section, name, status, details });
  const icon = condition ? "✓" : "❌";
  console.log(`${icon} [${section}] Test ${id}: ${name} -> ${status}`);
  if (!condition && details) {
    console.error(`   ↳ Failure details: ${details}`);
  }
}

// Instagram URL validator utility under test
function parseInstagramReelUrl(url: string): { isValid: boolean; shortcode: string | null } {
  if (!url || typeof url !== "string") return { isValid: false, shortcode: null };
  const cleanUrl = url.trim();
  const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  if (match && match[1]) {
    return { isValid: true, shortcode: match[1] };
  }
  return { isValid: false, shortcode: null };
}

async function runSocialReelsTestSuite() {
  console.log("=================================================================");
  console.log("SADA REELS CMS — AUTOMATED PRODUCTION TEST SUITE");
  console.log("=================================================================\n");

  const anonClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
  const adminClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
  const workerClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
  const superAdminClient = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });

  // -------------------------------------------------------------
  // Step 0: Sign in roles
  // -------------------------------------------------------------
  console.log("Authenticating test personas...");

  const adminAuth = await adminClient.auth.signInWithPassword({
    email: "phase1.tester@sada.agency",
    password: "Phase1TestPassword123!",
  });
  if (adminAuth.error) throw new Error(`Admin auth failed: ${adminAuth.error.message}`);
  console.log(`✓ Admin session authenticated: ${adminAuth.data.user.email}`);

  const workerAuth = await workerClient.auth.signInWithPassword({
    email: "team.e2e.1789469945865@sada.agency",
    password: "TestPassword123!",
  });
  if (workerAuth.error) throw new Error(`Worker auth failed: ${workerAuth.error.message}`);
  console.log(`✓ Worker session authenticated: ${workerAuth.data.user.email}`);

  const superAdminAuth = await superAdminClient.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  if (superAdminAuth.error) throw new Error(`Super Admin auth failed: ${superAdminAuth.error.message}`);
  console.log(`✓ Super Admin session authenticated: ${superAdminAuth.data.user.email}\n`);

  // -------------------------------------------------------------
  // SECTION 1: PUBLIC / ANONYMOUS HOMEPAGE QUERY
  // -------------------------------------------------------------
  console.log("--- 1. Testing Public Homepage Access & Deterministic Order ---");

  const { data: publicReels, error: pubErr } = await anonClient
    .from("social_reels")
    .select("*")
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("display_order", { ascending: true });

  assertTest(1, "Public", "Public can select published reels", !pubErr && Array.isArray(publicReels), pubErr?.message);
  assertTest(2, "Public", "At least 3 initial real reels returned", (publicReels?.length || 0) >= 3, `Count: ${publicReels?.length}`);

  const firstReel = publicReels?.[0];
  assertTest(3, "Public", "First reel is the Featured Reel", firstReel?.is_featured === true, `Title: ${firstReel?.title}`);
  assertTest(
    4,
    "Public",
    "First reel matches title",
    firstReel?.title === "المشكل موش ديما في مشروعك" || firstReel?.title === "من الفكرة حتى المبيعات",
    `Title: ${firstReel?.title}`,
  );

  const secondReel = publicReels?.[1];
  assertTest(
    5,
    "Public",
    "Second reel matches title",
    secondReel?.title === "موش كل Reel يعمل Views، يعمل Business." || secondReel?.title === "استراتيجية تصنع الفرق",
    `Title: ${secondReel?.title}`,
  );

  const thirdReel = publicReels?.[2];
  assertTest(
    6,
    "Public",
    "Third reel matches title",
    thirdReel?.title === "الفكرة وحدها ما تكفيش" || thirdReel?.title === "SADA هي الحل",
    `Title: ${thirdReel?.title}`,
  );

  // Check thumbnails
  const allThumbnailsValid = publicReels?.every((r) => r.thumbnail_url && r.thumbnail_url.startsWith("http"));
  assertTest(7, "Public", "All thumbnails are valid public URLs", !!allThumbnailsValid);

  // -------------------------------------------------------------
  // SECTION 2: ADMIN CMS CRUD & DRAFT ISOLATION
  // -------------------------------------------------------------
  console.log("\n--- 2. Testing Admin CMS Operations & Draft Isolation ---");

  const testSlug = `test-reel-${Date.now()}`;
  const testTitle = `E2E Automated Reel Test ${Date.now()}`;

  // Admin inserts a DRAFT reel
  const { data: createdReel, error: insErr } = await adminClient
    .from("social_reels")
    .insert({
      slug: testSlug,
      title: testTitle,
      category: "Test Category",
      caption: "Temporary automated test reel",
      instagram_url: "https://www.instagram.com/reel/C99TESTE2E/",
      instagram_shortcode: "C99TESTE2E",
      thumbnail_url: "https://mtfkzabiscyleztypqks.supabase.co/storage/v1/object/public/media/reels/reel-strategy.webp",
      display_order: 99,
      is_published: false, // DRAFT!
      is_featured: false,
    })
    .select()
    .single();

  assertTest(8, "Admin", "Admin can insert a new Reel", !insErr && !!createdReel, insErr?.message);

  const testReelId = createdReel?.id;

  // Anon must NOT see this draft
  const { data: anonDraftCheck } = await anonClient
    .from("social_reels")
    .select("id")
    .eq("id", testReelId);

  assertTest(9, "Security", "Public / Anon CANNOT read unpublished draft reel", !anonDraftCheck || anonDraftCheck.length === 0);

  // Admin CAN read draft
  const { data: adminDraftCheck } = await adminClient
    .from("social_reels")
    .select("id")
    .eq("id", testReelId);

  assertTest(10, "Admin", "Admin CAN read unpublished draft reel", (adminDraftCheck?.length || 0) === 1);

  // Admin updates draft to published
  const { error: pubUpdateErr } = await adminClient
    .from("social_reels")
    .update({ is_published: true })
    .eq("id", testReelId);

  assertTest(11, "Admin", "Admin can publish reel", !pubUpdateErr, pubUpdateErr?.message);

  // Anon can now see it
  const { data: anonPubCheck } = await anonClient
    .from("social_reels")
    .select("id")
    .eq("id", testReelId);

  assertTest(12, "Public", "Public CAN read reel once published", (anonPubCheck?.length || 0) === 1);

  // -------------------------------------------------------------
  // SECTION 3: SINGLE FEATURED REEL ENGINE CONSTRAINT & TRIGGER
  // -------------------------------------------------------------
  console.log("\n--- 3. Testing Single-Featured Reel Constraint & Automatic Trigger ---");

  // Mark test reel as Featured
  const { error: featUpdateErr } = await adminClient
    .from("social_reels")
    .update({ is_featured: true })
    .eq("id", testReelId);

  assertTest(13, "Trigger", "Admin can mark test reel as Featured", !featUpdateErr, featUpdateErr?.message);

  // Verify the previously featured reel was AUTOMATICALLY reset to false by DB trigger
  const { data: prevFeaturedReel } = await adminClient
    .from("social_reels")
    .select("id, slug, is_featured")
    .eq("slug", "from-idea-to-sales")
    .single();

  assertTest(
    14,
    "Trigger",
    "Database trigger automatically unsets previous featured reel",
    prevFeaturedReel?.is_featured === false,
    `Previous reel is_featured: ${prevFeaturedReel?.is_featured}`
  );

  // Verify exactly ONE featured reel exists across the entire table
  const { data: allFeatured } = await adminClient
    .from("social_reels")
    .select("id, title")
    .eq("is_featured", true);

  assertTest(15, "Constraint", "Strictly ONE featured reel exists in entire table", allFeatured?.length === 1, `Count: ${allFeatured?.length}`);

  // Restore the original featured reel
  await adminClient
    .from("social_reels")
    .update({ is_featured: true })
    .eq("slug", "from-idea-to-sales");

  // Verify test reel is now automatically reset to false
  const { data: testReelAfterRestore } = await adminClient
    .from("social_reels")
    .select("is_featured")
    .eq("id", testReelId)
    .single();

  assertTest(
    16,
    "Trigger",
    "Restoring original featured reel automatically resets test reel",
    testReelAfterRestore?.is_featured === false
  );

  // -------------------------------------------------------------
  // SECTION 4: RBAC PERMISSION GUARDS (WORKER RESTRICTIONS)
  // -------------------------------------------------------------
  console.log("\n--- 4. Testing Worker Access Restrictions (RLS Protection) ---");

  // Worker attempts to insert
  const { error: workerInsErr } = await workerClient
    .from("social_reels")
    .insert({
      slug: `worker-prohibited-${Date.now()}`,
      title: "Worker Prohibited Reel",
      instagram_url: "https://www.instagram.com/reel/CPROHIBITED/",
      instagram_shortcode: "CPROHIBITED",
      thumbnail_url: "https://example.com/thumb.jpg",
    });

  assertTest(17, "RBAC", "Worker INSERT is prohibited by RLS", !!workerInsErr);

  // Worker attempts to update
  const { error: workerUpdErr } = await workerClient
    .from("social_reels")
    .update({ title: "Tampered by Worker" })
    .eq("id", testReelId);

  // In Supabase RLS, prohibited UPDATE returns either an error or 0 affected rows
  const { data: checkTamper } = await adminClient
    .from("social_reels")
    .select("title")
    .eq("id", testReelId)
    .single();

  assertTest(
    18,
    "RBAC",
    "Worker UPDATE is prevented by RLS",
    checkTamper?.title === testTitle,
    `Title: ${checkTamper?.title}`
  );

  // Worker attempts to delete
  const { error: workerDelErr } = await workerClient
    .from("social_reels")
    .delete()
    .eq("id", testReelId);

  const { data: checkNotDeleted } = await adminClient
    .from("social_reels")
    .select("id")
    .eq("id", testReelId);

  assertTest(
    19,
    "RBAC",
    "Worker DELETE is prohibited by RLS",
    (checkNotDeleted?.length || 0) === 1
  );

  // -------------------------------------------------------------
  // SECTION 5: SUPER ADMIN EXCLUSIVE DELETION
  // -------------------------------------------------------------
  console.log("\n--- 5. Testing Deletion Guard: Admin Rejected, Super Admin Allowed ---");

  // Admin attempts delete -> MUST be rejected (RLS delete is Super Admin only!)
  const { error: adminDelErr } = await adminClient
    .from("social_reels")
    .delete()
    .eq("id", testReelId);

  const { data: checkStillExists } = await adminClient
    .from("social_reels")
    .select("id")
    .eq("id", testReelId);

  assertTest(
    20,
    "RBAC",
    "Standard Admin CANNOT delete reel (Super Admin only)",
    (checkStillExists?.length || 0) === 1
  );

  // Super Admin deletes test reel -> MUST succeed
  const { error: saDelErr } = await superAdminClient
    .from("social_reels")
    .delete()
    .eq("id", testReelId);

  const { data: checkDeleted } = await superAdminClient
    .from("social_reels")
    .select("id")
    .eq("id", testReelId);

  assertTest(21, "RBAC", "Super Admin successfully deletes reel", !saDelErr && checkDeleted?.length === 0, saDelErr?.message);

  // -------------------------------------------------------------
  // SECTION 6: INSTAGRAM URL VALIDATION UNIT CHECKS
  // -------------------------------------------------------------
  console.log("\n--- 6. Testing Instagram URL Parser & Validator ---");

  const v1 = parseInstagramReelUrl("https://www.instagram.com/reel/C7-X5zTsp9Q/");
  assertTest(22, "Validation", "Standard reel URL parses shortcode", v1.isValid && v1.shortcode === "C7-X5zTsp9Q");

  const v2 = parseInstagramReelUrl("https://instagram.com/reels/C51m3K2I5vN?igsh=MXRkcn...");
  assertTest(23, "Validation", "Plural reels with query parameters parses shortcode", v2.isValid && v2.shortcode === "C51m3K2I5vN");

  const v3 = parseInstagramReelUrl("https://www.instagram.com/p/C34v8LpI1wA/");
  assertTest(24, "Validation", "Post URL format parses shortcode", v3.isValid && v3.shortcode === "C34v8LpI1wA");

  const v4 = parseInstagramReelUrl("https://youtube.com/watch?v=dQw4w9WgXcQ");
  assertTest(25, "Validation", "External non-Instagram URL rejected", !v4.isValid && v4.shortcode === null);

  const v5 = parseInstagramReelUrl("just a random string");
  assertTest(26, "Validation", "Arbitrary string rejected", !v5.isValid && v5.shortcode === null);

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log("\n=================================================================");
  console.log("TEST SUITE SUMMARY");
  console.log("=================================================================");
  const passed = records.filter((r) => r.status === "PASS").length;
  const failed = records.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL: ${records.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed!`);
    process.exit(1);
  } else {
    console.log("\n✓ ALL TESTS PASSED WITH 100% SUCCESS!");
  }
}

runSocialReelsTestSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});

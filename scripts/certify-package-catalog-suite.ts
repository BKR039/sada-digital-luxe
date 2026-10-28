// ============================================================
// SADA OS — MASTER PACKAGE CATALOG & PUBLIC PRICING CERTIFICATION
// Automated Verification Suite for Specification Conformance
// ============================================================

import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

// Load .env into process.env before initializing services
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://mtfkzabiscyleztypqks.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

if (!SUPABASE_ANON_KEY) {
  console.error("FATAL: VITE_SUPABASE_ANON_KEY is missing from environment.");
  process.exit(1);
}

// 1. Admin Service Client (Bypasses RLS to audit raw database contents)
const adminClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

// 2. Anonymous Client (Simulates public visitor subjected to Postgres RLS)
const anonClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

interface ExpectedInternalEntry {
  code: string;
  name: string;
  price: number;
  unit: string;
  category: string;
}

const EXPECTED_INTERNAL_ENTRIES: ExpectedInternalEntry[] = [
  // 1. SMM
  { code: "MG-01", name: "Starter", price: 699, unit: "month", category: "SMM" },
  { code: "MG-02", name: "Growth", price: 1090, unit: "month", category: "SMM" },
  { code: "MG-03", name: "Growth+", price: 1290, unit: "month", category: "SMM" },
  { code: "MG-04", name: "Scale", price: 1590, unit: "month", category: "SMM" },
  // 2. Production
  { code: "PR-01", name: "Content Session", price: 550, unit: "session", category: "PRODUCTION" },
  { code: "PR-02", name: "Content Session Pro", price: 750, unit: "session", category: "PRODUCTION" },
  { code: "PR-03", name: "Long Production Day", price: 900, unit: "session", category: "PRODUCTION" },
  { code: "PR-04", name: "Full Production Day", price: 1200, unit: "day", category: "PRODUCTION" },
  // 3. Story
  { code: "ST-01", name: "Story Batch", price: 350, unit: "batch", category: "STORY" },
  { code: "ST-02", name: "Story Visits", price: 600, unit: "month", category: "STORY" },
  { code: "ST-03", name: "Story Plus", price: 800, unit: "month", category: "STORY" },
  { code: "ST-04", name: "Daily Story", price: 1000, unit: "month", category: "STORY" },
  { code: "ST-05", name: "Daily Story Pro", price: 1300, unit: "month", category: "STORY" },
  // 4. Ads
  { code: "AD-01", name: "Ads Basic", price: 250, unit: "month", category: "ADS" },
  { code: "AD-02", name: "Ads Pro", price: 400, unit: "month", category: "ADS" },
  // 5. Web
  { code: "WEB-01", name: "Landing Page", price: 700, unit: "project", category: "WEB" },
  { code: "WEB-02", name: "Business Website", price: 1500, unit: "project", category: "WEB" },
  { code: "WEB-03", name: "Business System", price: 2500, unit: "project", category: "WEB" },
  // 6. Strategy
  { code: "STG-01", name: "Content Strategy", price: 300, unit: "service", category: "STRATEGY" },
  { code: "STG-02", name: "Marketing Strategy", price: 500, unit: "service", category: "STRATEGY" },
  // 7. Combined / Hybrid
  { code: "HY-01", name: "Growth Produce", price: 1490, unit: "month", category: "COMBINED" },
  { code: "HY-02", name: "Growth+ Produce", price: 1790, unit: "month", category: "COMBINED" },
  { code: "HY-03", name: "Scale Produce", price: 2190, unit: "month", category: "COMBINED" },
  { code: "HY-04", name: "Premium", price: 2490, unit: "month", category: "COMBINED" },
  { code: "HY-05", name: "Premium Plus", price: 2890, unit: "month", category: "COMBINED" },
  // 8. Custom
  { code: "CUS-01", name: "Build Your Package", price: 0, unit: "custom", category: "CUSTOM" },
];

interface ExpectedAddon {
  code: string;
  name: string;
  price: number;
  unit: string;
}

const EXPECTED_ADDONS: ExpectedAddon[] = [
  { code: "ADD-01", name: "Extra Reel — Editing", price: 80, unit: "reel" },
  { code: "ADD-02", name: "Extra Reel — Full Production", price: 150, unit: "reel" },
  { code: "ADD-03", name: "Extra Post", price: 35, unit: "post" },
  { code: "ADD-04", name: "Extra Carousel", price: 50, unit: "carousel" },
  { code: "ADD-05", name: "Extra Story Batch", price: 100, unit: "batch" },
  { code: "ADD-06", name: "Extra Shooting Hour", price: 100, unit: "hour" },
  { code: "ADD-07", name: "Extra Production Hour", price: 120, unit: "hour" },
  { code: "ADD-08", name: "Extra Story Visit", price: 80, unit: "visit" },
  { code: "ADD-09", name: "Extra Photography Session", price: 250, unit: "session" },
  { code: "ADD-10", name: "Express 48h", price: 0, unit: "modifier" },
  { code: "ADD-11", name: "Express 24h", price: 0, unit: "modifier" },
  { code: "ADD-12", name: "Extra Website Hour", price: 80, unit: "hour" },
];

interface ExpectedProposal {
  code: string;
  name: string;
  proposedPrice: number;
  unit: string;
}

const EXPECTED_PROPOSALS: ExpectedProposal[] = [
  // Monthly Subscriptions
  { code: "PUB-MS-01", name: "Social Presence", proposedPrice: 1490, unit: "month" },
  { code: "PUB-MS-02", name: "Growth Engine", proposedPrice: 1990, unit: "month" },
  { code: "PUB-MS-03", name: "Full Brand Growth", proposedPrice: 2490, unit: "month" },
  // Service On Demand
  { code: "PUB-OD-01", name: "Content Session", proposedPrice: 550, unit: "session" },
  { code: "PUB-OD-02", name: "Production Day", proposedPrice: 900, unit: "day" },
  { code: "PUB-OD-03", name: "Pro Production Day", proposedPrice: 1200, unit: "day" },
  // Individual Services
  { code: "PUB-IS-01", name: "Reel Editing", proposedPrice: 80, unit: "reel" },
  { code: "PUB-IS-02", name: "Meta Ads Management", proposedPrice: 250, unit: "month" },
  { code: "PUB-IS-03", name: "Content Strategy Session", proposedPrice: 300, unit: "service" },
];

async function runCertificationSuite() {
  console.log("============================================================");
  console.log("SADA OS — COMPLETE PACKAGE CATALOG CERTIFICATION SUITE");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         -> ${detail}`);
      failed++;
    }
  }

  // Authenticate Admin client as Super Admin to inspect all catalog data under RLS
  console.log("[0/6] Authenticating Admin client as Super Admin...");
  const { data: authData, error: authErr } = await adminClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!authErr, "Admin client authenticated as Super Admin", authErr?.message);

  // ------------------------------------------------------------
  // TEST SECTION 1: Master Categories Presence
  // ------------------------------------------------------------
  console.log("[1/6] Auditing Master Categories...");
  const { data: categories, error: catError } = await adminClient
    .from("package_categories")
    .select("code, name, is_active");

  assert(!catError, "Fetch categories without DB error", catError?.message);
  assert(Boolean(categories && categories.length >= 12), `Category census count: ${categories?.length || 0} (expected >= 12)`);
  
  const expectedCategoryCodes = ["SMM", "PRODUCTION", "STORY", "ADS", "WEB", "STRATEGY", "COMBINED", "CUSTOM", "ADDONS", "PUB-MONTHLY", "PUB-ONDEMAND", "PUB-INDIVIDUAL"];
  const presentCategoryCodes = (categories || []).map(c => c.code);
  const missingCategories = expectedCategoryCodes.filter(c => !presentCategoryCodes.includes(c));
  assert(missingCategories.length === 0, "All 12 category codes exist", `Missing: ${missingCategories.join(", ")}`);

  // ------------------------------------------------------------
  // TEST SECTION 2: Internal Master Catalog (26 entries)
  // ------------------------------------------------------------
  console.log("\n[2/6] Auditing Internal Master Catalog (26 entries)...");
  const { data: internalPackages, error: intError } = await adminClient
    .from("package_catalog")
    .select("code, name, price, billing_unit, is_internal_only, is_published, approval_status, source_page_ref")
    .eq("is_internal_only", true);

  assert(!intError, "Fetch internal catalog entries without DB error", intError?.message);
  assert(Boolean(internalPackages && internalPackages.length === 26), `Internal catalog count: ${internalPackages?.length || 0} / 26`);

  for (const expected of EXPECTED_INTERNAL_ENTRIES) {
    const found = (internalPackages || []).find(p => p.code === expected.code);
    if (!found) {
      assert(false, `Internal package ${expected.code} exists`, `Missing code ${expected.code}`);
      continue;
    }

    const priceMatches = expected.code === "CUS-01" ? true : Number(found.price) === expected.price;
    const isInternalOnly = found.is_internal_only === true;
    const isUnpublished = found.is_published === false;
    const isApproved = found.approval_status === "approved";

    assert(
      priceMatches && isInternalOnly && isUnpublished && isApproved,
      `${expected.code} (${expected.name}) verified: ${found.price} TND / ${found.billing_unit} | internal=${found.is_internal_only} | published=${found.is_published}`,
      `Details: price=${found.price} (expected ${expected.price}), internal=${found.is_internal_only}, pub=${found.is_published}, approval=${found.approval_status}`
    );
  }

  // ------------------------------------------------------------
  // TEST SECTION 3: Add-Ons Master Catalog (12 items)
  // ------------------------------------------------------------
  console.log("\n[3/6] Auditing Master Add-Ons (12 items)...");
  const { data: addons, error: addError } = await adminClient
    .from("package_addons")
    .select("code, name, price, unit, percentage_modifier, source_page_ref");

  assert(!addError, "Fetch add-ons without DB error", addError?.message);
  assert(Boolean(addons && addons.length >= 12), `Add-ons count: ${addons?.length || 0} / 12`);

  for (const expected of EXPECTED_ADDONS) {
    const found = (addons || []).find(a => a.code === expected.code);
    if (!found) {
      assert(false, `Add-on ${expected.code} exists`, `Missing code ${expected.code}`);
      continue;
    }

    const priceMatches = expected.unit === "percentage" ? (found.percentage_modifier !== null) : Number(found.price) === expected.price;
    assert(
      priceMatches,
      `${expected.code} (${expected.name}) verified: price=${found.price} unit=${found.unit} modifier=${found.percentage_modifier}`,
      `Details: expected price ${expected.price}, actual ${found.price}`
    );
  }

  // ------------------------------------------------------------
  // TEST SECTION 4: Nine Proposed Public Packages (Unpublished Drafts)
  // ------------------------------------------------------------
  console.log("\n[4/6] Auditing 9 Proposed Public Packages (Drafts / Unapproved)...");
  const { data: proposals, error: propError } = await adminClient
    .from("package_catalog")
    .select("code, name, price, proposed_price, billing_unit, is_internal_only, is_published, approval_status, source_page_ref")
    .in("code", EXPECTED_PROPOSALS.map(p => p.code));

  assert(!propError, "Fetch public proposals without DB error", propError?.message);
  assert(Boolean(proposals && proposals.length === 9), `Proposed packages count: ${proposals?.length || 0} / 9`);

  for (const expected of EXPECTED_PROPOSALS) {
    const found = (proposals || []).find(p => p.code === expected.code);
    if (!found) {
      assert(false, `Proposal ${expected.code} exists`, `Missing code ${expected.code}`);
      continue;
    }

    const proposedPriceMatches = Number(found.proposed_price) === expected.proposedPrice;
    const isUnpublished = found.is_published === false;
    const isProposedStatus = found.approval_status === "proposed";
    const isPublicScope = found.is_internal_only === false;

    assert(
      proposedPriceMatches && isUnpublished && isProposedStatus && isPublicScope,
      `${expected.code} (${expected.name}): proposed=${found.proposed_price} TND/${found.billing_unit} | is_published=${found.is_published} | approval=${found.approval_status}`,
      `Details: proposed_price=${found.proposed_price} (expected ${expected.proposedPrice}), is_published=${found.is_published} (MUST BE false), approval=${found.approval_status} (MUST BE proposed)`
    );
  }

  // ------------------------------------------------------------
  // TEST SECTION 5: Security & Anonymous Visitor Isolation
  // ------------------------------------------------------------
  console.log("\n[5/6] Testing Security, RLS & Anonymous Visitor Isolation...");
  // Query anonymously through RLS
  const { data: anonPackages, error: anonError } = await anonClient
    .from("package_catalog")
    .select("code, name, is_published, is_internal_only, approval_status");

  assert(!anonError, "Anonymous query executed against RLS", anonError?.message);

  // Since all 9 public proposals are unpublished drafts and all 26 catalog items are internal-only,
  // anonPackages MUST return ZERO packages!
  const leakedCount = (anonPackages || []).length;
  assert(
    leakedCount === 0,
    `Zero unapproved or internal packages leaked to anonymous visitor: ${leakedCount} returned (expected 0)`,
    `Leaked packages: ${(anonPackages || []).map((p: any) => p.code).join(", ")}`
  );

  // ------------------------------------------------------------
  // TEST SECTION 6: Integrity & Non-Destructive Invariance
  // ------------------------------------------------------------
  console.log("\n[6/6] Auditing Data Integrity & Non-Destructive Invariance...");
  const { data: totalCatalog } = await adminClient
    .from("package_catalog")
    .select("id, code, is_published, approval_status");

  const publishedCount = (totalCatalog || []).filter(p => p.is_published).length;
  assert(
    publishedCount === 0,
    `Publication invariant preserved: ${publishedCount} packages published (0 automatically published)`,
    `Found prematurely published packages: ${(totalCatalog || []).filter(p => p.is_published).map(p => p.code).join(", ")}`
  );

  assert(
    Boolean(totalCatalog && totalCatalog.length === 35),
    `Total database census: ${totalCatalog?.length || 0} packages (26 internal + 9 public proposals = 35 total)`
  );

  // ------------------------------------------------------------
  // TEST SECTION 7: Smart Package Matching Isolation & Recommendation
  // ------------------------------------------------------------
  console.log("\n[7/7] Auditing Smart Matching Engine & Isolation...");
  const { fetchMatcherEligiblePackages, runPackageRecommendationEngine } = await import("../src/lib/smart-match-service");
  const { INITIAL_CANONICAL_ANSWERS } = await import("../src/types/smart-match");

  const eligiblePublic = await fetchMatcherEligiblePackages();
  assert(
    eligiblePublic.length === 0,
    `Smart Matcher public pool is empty until proposals approved: ${eligiblePublic.length} eligible (expected 0)`,
    `Prematurely eligible packages: ${eligiblePublic.map(p => p.code).join(", ")}`
  );

  const matchResult = runPackageRecommendationEngine(eligiblePublic, INITIAL_CANONICAL_ANSWERS);
  assert(
    matchResult.status === "no_match" && matchResult.bestFit === null,
    "Smart Matcher gracefully returns no_match fallback when no public packages are published"
  );
  assert(
    Boolean(matchResult.fallbackReason === "no_published_packages" || matchResult.status === "no_match"),
    "Smart Matcher provides clear fallback routing to Contact Us / Custom Proposal"
  );

  // Test that internal-only packages are strictly excluded even if passed to engine
  const syntheticMix: any[] = [
    {
      id: "test-internal-1",
      code: "MG-01",
      name: "Starter",
      is_active: true,
      is_published: true, // artificially published
      is_internal_only: true, // internal flag
      approval_status: "approved",
      price: 699,
      monthly_reels: 4,
      monthly_posts: 4,
    },
    {
      id: "test-public-proposed",
      code: "PUB-MS-01",
      name: "Social Presence",
      is_active: true,
      is_published: true, // artificially published
      is_internal_only: false,
      approval_status: "proposed", // still unapproved
      proposed_price: 1490,
      monthly_reels: 4,
    },
    {
      id: "test-approved-public",
      code: "PUB-MS-02",
      name: "Growth Engine",
      is_active: true,
      is_published: true,
      is_internal_only: false,
      approval_status: "approved",
      price: 1990,
      monthly_reels: 8,
      monthly_posts: 8,
      recommendation_enabled: true,
    }
  ];

  const engineMixResult = runPackageRecommendationEngine(syntheticMix, {
    ...INITIAL_CANONICAL_ANSWERS,
    serviceType: "monthly_retainer",
    contentFocus: "reels_and_posts",
  });

  // Only the approved, non-internal, published package should be considered
  const recommendedCodes = [
    engineMixResult.bestFit?.packageCode,
    ...engineMixResult.alternatives.map(a => a.packageCode)
  ].filter(Boolean);

  assert(
    !recommendedCodes.includes("MG-01"),
    "Smart Matcher engine strictly rejects internal-only packages (MG-01 rejected)"
  );
  assert(
    !recommendedCodes.includes("PUB-MS-01"),
    "Smart Matcher engine strictly rejects unapproved proposals (PUB-MS-01 rejected)"
  );
  assert(
    recommendedCodes.includes("PUB-MS-02") || (engineMixResult.bestFit?.packageCode === "PUB-MS-02"),
    `Smart Matcher engine successfully recommends verified public approved package (got bestFit=${engineMixResult.bestFit?.packageCode}, status=${engineMixResult.status})`
  );

  console.log("\n============================================================");
  console.log(`CERTIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCertificationSuite().catch(err => {
  console.error("Fatal suite exception:", err);
  process.exit(1);
});

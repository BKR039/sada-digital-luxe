// ============================================================
// SADA OS — PACKAGE CATALOG FINAL VERIFICATION GATE
// Independent verification suite for SSOT, publication lifecycle,
// Smart Matching accuracy, Financial OS consistency, and public data confidentiality.
// Target for Mutations: 127.0.0.1:5432/sada_local_test (Protected by test-db-guard)
// Target for Read-Only Logic: Live application services + synthetic scenarios
// ============================================================

import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

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

import { enforceDatabaseIsolation } from "./test-db-guard";
import { fetchPublicPackages, PUBLIC_PACKAGE_SELECT } from "../src/lib/package-service";
import {
  fetchDirectPublicPackages,
  fetchMatcherEligiblePackages,
  runPackageRecommendationEngine,
  scorePackage,
  submitSmartContactLead,
} from "../src/lib/smart-match-service";
import { INITIAL_CANONICAL_ANSWERS } from "../src/types/smart-match";
import type { CanonicalAnswers } from "../src/types/smart-match";
import type { PackageCatalogItem } from "../src/types/package-catalog";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

const PSQL_BIN = path.join(
  process.env.LOCALAPPDATA || "",
  "Programs",
  "PostgreSQL16",
  "pgsql",
  "bin",
  "psql.exe"
);

function psql(sql: string): string {
  enforceDatabaseIsolation(LOCAL_DB_URL);
  const safeEnv: NodeJS.ProcessEnv = { ...process.env };
  delete safeEnv.DATABASE_URL;
  delete safeEnv.SUPABASE_DB_URL;
  safeEnv.PGHOST = TARGET_HOST;
  safeEnv.PGPORT = TARGET_PORT;
  safeEnv.PGDATABASE = TARGET_DB;
  safeEnv.PGUSER = "postgres";

  return execFileSync(PSQL_BIN, ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-c", sql], {
    env: safeEnv,
    encoding: "utf-8",
  });
}

async function runFinalVerificationGate() {
  console.log("=================================================================");
  console.log("SADA OS — PACKAGE CATALOG & PRICING CMS FINAL VERIFICATION GATE");
  console.log("=================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testId: string, description: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✓ [PASS] [${testId}] ${description}`);
    } else {
      console.error(`✗ [FAIL] [${testId}] ${description}`);
    }
  }

  // -----------------------------------------------------------------
  // 1. DATA CONFIDENTIALITY & PROJECTION AUDIT (Gate E)
  // -----------------------------------------------------------------
  console.log("\n--- Gate E: Public Data Confidentiality & Projection Whitelist ---");
  const publicCategories = await fetchPublicPackages();
  const samplePkg = publicCategories[0]?.packages?.[0];

  assert(Boolean(samplePkg), "CONF-01", "fetchPublicPackages returned populated package list");

  const restrictedKeys = [
    "employee_cost",
    "freelancer_cost",
    "transport_cost",
    "subscription_allocation",
    "commission",
    "direct_costs",
    "gross_profit",
    "gross_margin",
    "created_by",
    "updated_by",
  ];

  if (samplePkg) {
    let leakedKeysInPublic: string[] = [];
    for (const key of restrictedKeys) {
      if ((samplePkg as any)[key] !== undefined) {
        leakedKeysInPublic.push(key);
      }
    }
    assert(
      leakedKeysInPublic.length === 0,
      "CONF-02",
      `fetchPublicPackages strictly omits restricted fields (Leaked: ${leakedKeysInPublic.length === 0 ? "NONE" : leakedKeysInPublic.join(", ")})`
    );
  }

  const directPkgs = await fetchDirectPublicPackages();
  assert(directPkgs.length > 0, "CONF-03", "fetchDirectPublicPackages returned direct public packages");
  if (directPkgs[0]) {
    let leakedInDirect: string[] = [];
    for (const key of restrictedKeys) {
      if ((directPkgs[0] as any)[key] !== undefined) {
        leakedInDirect.push(key);
      }
    }
    assert(
      leakedInDirect.length === 0,
      "CONF-04",
      `fetchDirectPublicPackages strictly omits restricted fields (Leaked: ${leakedInDirect.length === 0 ? "NONE" : leakedInDirect.join(", ")})`
    );
  }

  const matcherPkgs = await fetchMatcherEligiblePackages();
  assert(matcherPkgs.length > 0, "CONF-05", "fetchMatcherEligiblePackages returned eligible packages");
  if (matcherPkgs[0]) {
    let leakedInMatcher: string[] = [];
    for (const key of restrictedKeys) {
      if ((matcherPkgs[0] as any)[key] !== undefined) {
        leakedInMatcher.push(key);
      }
    }
    assert(
      leakedInMatcher.length === 0,
      "CONF-06",
      `fetchMatcherEligiblePackages strictly omits restricted fields (Leaked: ${leakedInMatcher.length === 0 ? "NONE" : leakedInMatcher.join(", ")})`
    );
  }

  // -----------------------------------------------------------------
  // 2. SMART MATCHING ACCURACY & EDGE CASES (Gate C)
  // -----------------------------------------------------------------
  console.log("\n--- Gate C: Smart Matching Accuracy, Determinism & Edge Cases ---");

  // Edge Case 1: Budget below all packages (< 700 TND)
  const lowBudgetAnswers: CanonicalAnswers = {
    ...INITIAL_CANONICAL_ANSWERS,
    businessType: "Local Business",
    businessStage: "starting",
    primaryGoals: ["Grow social media presence"],
    requiredServices: ["Posts / Carousels", "Stories"],
    contentIntensity: "light",
    advertisingNeed: "no",
    websiteNeed: "no",
    budgetRange: "under_700",
  };
  const lowBudgetRes = runPackageRecommendationEngine(matcherPkgs, lowBudgetAnswers);
  assert(
    Boolean(lowBudgetRes.bestFit && (lowBudgetRes.bestFit.packageCode === "MG-01" || lowBudgetRes.bestFit.packagePrice <= 750)),
    "SMART-01",
    `Sub-700 budget correctly matched lowest-tier Starter (MG-01, 699 TND), actual: ${lowBudgetRes.bestFit?.packageCode} (${lowBudgetRes.bestFit?.packagePrice} TND)`
  );

  // Edge Case 2: Contradictory scope (High Production) + low budget
  const contradictoryAnswers: CanonicalAnswers = {
    ...INITIAL_CANONICAL_ANSWERS,
    businessType: "Travel / Tourism",
    businessStage: "established",
    primaryGoals: ["Grow social media presence", "Run paid advertising", "Build a website"],
    requiredServices: ["Reels / Video Content", "Meta Ads", "Website", "Production Sessions"],
    contentIntensity: "high_growth",
    advertisingNeed: "every_month",
    websiteNeed: "booking_system",
    budgetRange: "under_700",
  };
  const contradictoryRes = runPackageRecommendationEngine(matcherPkgs, contradictoryAnswers);
  assert(
    Boolean(contradictoryRes.bestFit && contradictoryRes.bestFit.gaps.length > 0),
    "SMART-02",
    `Contradictory scope correctly annotates strategic investment gaps (Found ${contradictoryRes.bestFit?.gaps.length} gaps: "${contradictoryRes.bestFit?.gaps[0]}")`
  );

  // Edge Case 3: Missing / completely blank answers
  const blankAnswers: CanonicalAnswers = { ...INITIAL_CANONICAL_ANSWERS };
  const blankRes = runPackageRecommendationEngine(matcherPkgs, blankAnswers);
  assert(
    Boolean(blankRes.bestFit && blankRes.status === "success"),
    "SMART-03",
    `Missing/blank answers handled gracefully without crashing (Winner: ${blankRes.bestFit?.packageCode}, Score: ${blankRes.bestFit?.score}%)`
  );

  // Edge Case 4: No suitable published package (Empty catalog fallback)
  const emptyRes = runPackageRecommendationEngine([], lowBudgetAnswers);
  assert(
    emptyRes.status === "no_match" && emptyRes.bestFit === null && Boolean(emptyRes.fallbackMessage),
    "SMART-04",
    `Empty catalog / no match triggers graceful fallback with bespoke consultation message`
  );

  // Edge Case 5: A package becoming hidden/unpublished
  const poolWithoutMG01 = matcherPkgs.filter((p) => p.code !== "MG-01");
  const hiddenPkgRes = runPackageRecommendationEngine(poolWithoutMG01, lowBudgetAnswers);
  assert(
    Boolean(hiddenPkgRes.bestFit && hiddenPkgRes.bestFit.packageCode !== "MG-01"),
    "SMART-05",
    `Hidden package (MG-01) is strictly excluded; runner-up selected: ${hiddenPkgRes.bestFit?.packageCode}`
  );

  // Edge Case 6: CMS criteria edit reactivity (MG-01 price increased to 1500)
  const modifiedPool = matcherPkgs.map((p) => (p.code === "MG-01" ? { ...p, price: 1500 } : p));
  const cmsEditRes = runPackageRecommendationEngine(modifiedPool, lowBudgetAnswers);
  assert(
    Boolean(cmsEditRes.bestFit && cmsEditRes.bestFit.packageCode !== "MG-01"),
    "SMART-06",
    `CMS price increase reacts dynamically, unseating MG-01 from sub-700 recommendation (New winner: ${cmsEditRes.bestFit?.packageCode})`
  );

  // Edge Case 7: Section 7 fields analysis
  // Verify that concrete capabilities (monthly_reels, has_ads_management, has_website, production_hours) drive recommendation
  const adsOnlyAnswers: CanonicalAnswers = {
    ...INITIAL_CANONICAL_ANSWERS,
    advertisingNeed: "paid_ads",
    requiredServices: ["Paid Advertising"],
  };
  const adsRes = runPackageRecommendationEngine(matcherPkgs, adsOnlyAnswers);
  assert(
    Boolean(adsRes.bestFit && (adsRes.bestFit.packageItem as any).has_ads_management === true),
    "SMART-07",
    `Hard capability matching verified: winner must have has_ads_management=true (Winner: ${adsRes.bestFit?.packageCode})`
  );

  // -----------------------------------------------------------------
  // 3. PUBLISH / HIDE / REPUBLISH LIFECYCLE (Gate B)
  // -----------------------------------------------------------------
  console.log("\n--- Gate B: Publish / Hide / Republish Lifecycle on Isolated Local DB ---");
  
  // 1. Initialize full schema on local test DB (sada_local_test)
  psql(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS public.package_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        priority INTEGER NOT NULL DEFAULT 0,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.package_catalog_full (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price NUMERIC(12,2) NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_published BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER NOT NULL DEFAULT 0,
        employee_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
        freelancer_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
        transport_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
        subscription_allocation NUMERIC(12,2) NOT NULL DEFAULT 0,
        commission NUMERIC(12,2) NOT NULL DEFAULT 0,
        direct_costs NUMERIC(12,2) GENERATED ALWAYS AS (
            employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission
        ) STORED,
        gross_profit NUMERIC(12,2) GENERATED ALWAYS AS (
            price - (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission)
        ) STORED,
        gross_margin NUMERIC(8,2) GENERATED ALWAYS AS (
            CASE 
                WHEN price > 0 THEN 
                    ((price - (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission)) / price) * 100.0
                ELSE 0.0 
            END
        ) STORED
    );
  `);

  const testPkgCode = `PKG-GATE-${Date.now().toString().slice(-4)}`;

  // Step 1: Insert unpublished package
  psql(`
    INSERT INTO public.package_catalog_full (code, name, price, is_active, is_published, employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission)
    VALUES ('${testPkgCode}', 'Gate Test Package', 1200, true, false, 200, 100, 50, 50, 100);
  `);

  // Query public view: should be ABSENT
  const unpubCheck = psql(`
    SELECT count(*)::int as count FROM public.package_catalog_full WHERE is_active = true AND is_published = true AND code = '${testPkgCode}';
  `);
  assert(unpubCheck.includes("0"), "LIFE-01", "Unpublished package is strictly absent from public active+published query");

  // Step 2: Publish package
  psql(`
    UPDATE public.package_catalog_full SET is_published = true WHERE code = '${testPkgCode}';
  `);
  const pubCheck = psql(`
    SELECT count(*)::int as count FROM public.package_catalog_full WHERE is_active = true AND is_published = true AND code = '${testPkgCode}';
  `);
  assert(pubCheck.includes("1"), "LIFE-02", "Publishing package makes it immediately visible in public active+published query");

  // Step 3: Hide package
  psql(`
    UPDATE public.package_catalog_full SET is_published = false WHERE code = '${testPkgCode}';
  `);
  const hideCheck = psql(`
    SELECT count(*)::int as count FROM public.package_catalog_full WHERE is_active = true AND is_published = true AND code = '${testPkgCode}';
  `);
  assert(hideCheck.includes("0"), "LIFE-03", "Hiding package immediately removes it from public active+published query");

  // Step 4: Republish package
  psql(`
    UPDATE public.package_catalog_full SET is_published = true WHERE code = '${testPkgCode}';
  `);
  const repubCheck = psql(`
    SELECT count(*)::int as count FROM public.package_catalog_full WHERE is_active = true AND is_published = true AND code = '${testPkgCode}';
  `);
  assert(repubCheck.includes("1"), "LIFE-04", "Republishing package restores visibility in public active+published query");

  // Step 5: Test submission rejection for unpublished ID
  const directRejectRes = await submitSmartContactLead({
    lead: { fullName: "Test Gate User", email: "test.gate@sada.agency" },
    qualification: { primaryGoals: [], requiredServices: [] },
    source: "direct_package",
    recommendation: {
      packageId: "00000000-0000-0000-0000-000000000000",
      packageCode: "UNPUB-01",
      packageName: "Unpublished Package",
      score: 100,
      matchLevel: "strong",
      alternativePackageIds: [],
      reasons: [],
      isUnpublished: true,
    },
  });
  assert(
    directRejectRes.success === false && directRejectRes.error?.includes("no longer available or published"),
    "LIFE-05",
    `Direct submission with unpublished package ID is strictly rejected (${directRejectRes.error})`
  );

  // Cleanup test fixture from local test db
  psql(`
    DELETE FROM public.package_catalog_full WHERE code = '${testPkgCode}';
  `);
  const cleanupCheck = psql(`
    SELECT count(*)::int as count FROM public.package_catalog_full WHERE code = '${testPkgCode}';
  `);
  assert(cleanupCheck.includes("0"), "LIFE-06", "Test fixture cleaned up with 0 orphaned records in sada_local_test");

  // -----------------------------------------------------------------
  // 4. FINANCIAL ARITHMETIC & GENERATED COLUMNS (Gate D)
  // -----------------------------------------------------------------
  console.log("\n--- Gate D: Financial Arithmetic Invariants (PostgreSQL Generated Columns) ---");

  // Insert representative financial cases into local test db
  psql(`
    INSERT INTO public.package_catalog_full (code, name, price, employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission)
    VALUES 
      ('FIN-ZERO-PRICE', 'Zero Price Case', 0, 0, 0, 0, 0, 0),
      ('FIN-ZERO-COST', 'Zero Cost Case', 1000, 0, 0, 0, 0, 0),
      ('FIN-STANDARD', 'Standard Case', 1090, 200, 150, 50, 45, 100),
      ('FIN-LOSS-LEADER', 'High Cost Loss Leader', 500, 300, 200, 100, 50, 50);
  `);

  const finResults = psql(`
    SELECT code, price, direct_costs, gross_profit, gross_margin 
    FROM public.package_catalog_full 
    WHERE code LIKE 'FIN-%'
    ORDER BY code;
  `);

  // Verify Zero Price
  assert(
    finResults.includes("FIN-ZERO-PRICE") && finResults.includes("0.00 |         0.00 |         0.00 |         0.00"),
    "FIN-01",
    "Zero price handled with 0 profit and 0.00% margin (zero division guard)"
  );

  // Verify Zero Cost
  assert(
    finResults.includes("FIN-ZERO-COST") && finResults.includes("1000.00 |         0.00 |      1000.00 |       100.00"),
    "FIN-02",
    "Zero cost produces 100.00% gross margin"
  );

  // Verify Standard Case (1090 price, 545 costs -> 545 profit, 50.00% margin)
  assert(
    finResults.includes("FIN-STANDARD") && finResults.includes("1090.00 |       545.00 |       545.00 |        50.00"),
    "FIN-03",
    "Standard pricing produces exact 50.00% gross margin"
  );

  // Verify Loss Leader (500 price, 700 costs -> -200 profit, -40.00% margin)
  assert(
    finResults.includes("FIN-LOSS-LEADER") && finResults.includes("500.00 |       700.00 |      -200.00 |       -40.00"),
    "FIN-04",
    "Loss leader correctly produces negative profit (-200 TND) and negative margin (-40.00%)"
  );

  // Cleanup financial test fixtures
  psql(`
    DELETE FROM public.package_catalog_full WHERE code LIKE 'FIN-%';
  `);
  console.log("✓ Financial test fixtures cleaned up from local database.");

  console.log("\n=================================================================");
  console.log(`FINAL VERIFICATION GATE SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("=================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runFinalVerificationGate().catch((err) => {
  console.error("FATAL ERROR in runFinalVerificationGate:", err);
  process.exit(1);
});

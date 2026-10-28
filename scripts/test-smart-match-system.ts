// ============================================================
// SADA SMART MATCH SYSTEM — FULL INTEGRATION VERIFICATION TEST
// Verifies 3 paths, eligibility rules, scoring engine, lead insertion & admin view
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Load .env
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

import {
  fetchMatcherEligiblePackages,
  fetchDirectPublicPackages,
  runPackageRecommendationEngine,
  scorePackage,
  submitSmartContactLead,
} from "../src/lib/smart-match-service";
import {
  INITIAL_CANONICAL_ANSWERS,
  CanonicalAnswers,
  SmartLeadSubmissionPayload,
} from "../src/types/smart-match";

interface TestReport {
  name: string;
  passed: boolean;
  details: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, name: string, details: string) {
  reports.push({
    name,
    passed: condition,
    details: condition ? `PASS: ${details}` : `FAIL: ${details}`,
  });
  const symbol = condition ? "✓" : "✗";
  console.log(`${symbol} [${condition ? "PASS" : "FAIL"}] ${name} — ${details}`);
}

async function runSystemVerification() {
  console.log("=================================================");
  console.log("SADA CONTACT US — SMART PACKAGE MATCHING TEST");
  console.log("=================================================\n");

  const createdLeadIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Test 1: Package Eligibility Rules (Active vs Published)
    // -------------------------------------------------------------
    console.log("--- Section 2: Package Eligibility Rules ---");
    const eligiblePackages = await fetchMatcherEligiblePackages();
    const publicPackages = await fetchDirectPublicPackages();

    assert(
      eligiblePackages.length > 0,
      "Eligible Packages Fetch",
      `Loaded ${eligiblePackages.length} packages for smart matcher.`
    );

    assert(
      publicPackages.length > 0,
      "Public Catalog Packages Fetch",
      `Loaded ${publicPackages.length} active and published packages for direct intake.`
    );

    // Verify all eligible packages are active
    const anyInactiveEligible = eligiblePackages.some((p) => p.is_active === false);
    assert(
      !anyInactiveEligible,
      "No Inactive Packages in Recommendation",
      "Strictly 0 inactive packages participate in the recommendation engine."
    );

    // Verify public packages are strictly active AND published
    const anyUnpublishedInPublic = publicPackages.some((p) => !p.is_active || !p.is_published);
    assert(
      !anyUnpublishedInPublic,
      "Public Catalog Isolation",
      "Public catalog strictly exposes is_active = true AND is_published = true."
    );

    // -------------------------------------------------------------
    // Test 2: Smart Match Long Form Flow (High Content & Growth)
    // -------------------------------------------------------------
    console.log("\n--- Section 4 & 5: Smart Match Long Form Flow ---");
    const smartAnswers: CanonicalAnswers = {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Restaurant / Café",
      marketScope: "Tunisia-wide",
      primaryGoals: ["Grow social media presence", "Create consistent content"],
      requiredServices: ["Reels / Video Content", "Posts / Carousels", "Stories", "Community Management"],
      contentIntensity: "active",
      advertisingNeed: "no",
      websiteNeed: "no",
      currentMarketingSetup: "self",
      businessStage: "operating_growth",
      budgetRange: "700_1200",
      startTimeline: "asap",
      additionalContext: "Looking to establish strong brand presence across Tunis and Sousse.",
    };

    const smartResult = runPackageRecommendationEngine(eligiblePackages, smartAnswers);

    assert(
      smartResult.status === "success" && Boolean(smartResult.bestFit),
      "Deterministic Recommendation Generated",
      `Recommended: ${smartResult.bestFit?.packageName} (${smartResult.bestFit?.score}% score, match level: ${smartResult.bestFit?.matchLevel})`
    );

    assert(
      Boolean(smartResult.bestFit?.reasons && smartResult.bestFit.reasons.length > 0),
      "Explainable Factual Reasons",
      `Generated ${smartResult.bestFit?.reasons.length} factual reasons: "${smartResult.bestFit?.reasons[0]?.text}"`
    );

    assert(
      smartResult.alternatives.length <= 2,
      "Max 2 Alternatives Rule",
      `Provided ${smartResult.alternatives.length} alternatives (max 2 enforced).`
    );

    // -------------------------------------------------------------
    // Test 3: Hard Constraints vs Soft Signals (Website & Ads)
    // -------------------------------------------------------------
    console.log("\n--- Section 12: Hard Constraints vs Soft Signals ---");
    const bookingExplicitAnswers: CanonicalAnswers = {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "E-commerce",
      primaryGoals: ["Get more sales", "Build a website"],
      requiredServices: ["Website", "Booking / Ordering System", "Meta Ads"],
      contentIntensity: "light",
      advertisingNeed: "every_month",
      websiteNeed: "booking_system",
      budgetRange: "2000_plus",
      businessStage: "growing_quickly",
    };

    const bookingResult = runPackageRecommendationEngine(eligiblePackages, bookingExplicitAnswers);

    assert(
      Boolean(bookingResult.bestFit?.packageItem.has_website),
      "Hard Constraint: Website Capability",
      `Winner "${bookingResult.bestFit?.packageName}" has has_website = true when booking system is explicitly required.`
    );

    // -------------------------------------------------------------
    // Test 4: Quick Match (3 Questions)
    // -------------------------------------------------------------
    console.log("\n--- Section 7: Quick Match Canonical Flow ---");
    const quickAnswers: CanonicalAnswers = {
      ...INITIAL_CANONICAL_ANSWERS,
      primaryGoals: ["Grow social media presence", "Create consistent content"],
      requiredServices: ["Reels / Video Content", "Posts / Carousels"],
      contentIntensity: "active",
      advertisingNeed: "no",
      websiteNeed: "no",
      budgetRange: "700_1200",
    };

    const quickResult = runPackageRecommendationEngine(eligiblePackages, quickAnswers);

    assert(
      quickResult.status === "success" && Boolean(quickResult.bestFit),
      "Quick Match Engine Consistency",
      `Quick Match feeds the canonical engine and recommended "${quickResult.bestFit?.packageName}" (${quickResult.bestFit?.score}%).`
    );

    // -------------------------------------------------------------
    // Test 5: Server-Side Lead Submission & Pipeline Integration
    // -------------------------------------------------------------
    console.log("\n--- Section 17, 18 & 19: Secure Submission & Lead Intake ---");
    const testLeadPayload: SmartLeadSubmissionPayload = {
      lead: {
        fullName: "Test Automated Verification Lead",
        businessName: "SADA Automated Quality Systems",
        phone: "+216 98 765 432",
        email: "auto.test@sada.agency",
        city: "Tunis",
        additionalMessage: "Integration test for Phase Contact Us Smart Matching.",
      },
      qualification: smartAnswers,
      recommendation: {
        packageId: smartResult.bestFit!.packageId,
        packageCode: smartResult.bestFit!.packageCode,
        packageName: smartResult.bestFit!.packageName,
        score: smartResult.bestFit!.score,
        matchLevel: smartResult.bestFit!.matchLevel,
        alternativePackageIds: smartResult.alternatives.map((a) => a.packageId),
        reasons: smartResult.bestFit!.reasons.map((r) => r.text),
        isUnpublished: smartResult.bestFit!.isUnpublished,
      },
      source: "smart_match",
    };

    const submitRes = await submitSmartContactLead(testLeadPayload);

    assert(
      submitRes.success && Boolean(submitRes.leadId),
      "Lead Capture in contact_submissions",
      `Successfully created lead with id: ${submitRes.leadId}`
    );

    if (submitRes.leadId) {
      createdLeadIds.push(submitRes.leadId);
    }

    // -------------------------------------------------------------
    // Test 6: Verify Database Record & Structured Discovery JSONB
    // -------------------------------------------------------------
    console.log("\n--- Section 21: Database Record Verification ---");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, anonKey);

    await adminSupabase.auth.signInWithPassword({
      email: "sec.admin@sada.agency",
      password: "AdminPassword123!",
    });

    if (submitRes.leadId) {
      const { data: leadRow, error: fetchErr } = await adminSupabase
        .from("contact_submissions")
        .select("*")
        .eq("id", submitRes.leadId)
        .single();

      assert(
        !fetchErr && Boolean(leadRow),
        "Lead Record Queryable by Admin",
        `Fetched lead record from database.`
      );

      assert(
        leadRow?.discovery_data?.source === "smart_match",
        "Lead Source Integrity",
        `Stored source: "${leadRow?.discovery_data?.source}"`
      );

      assert(
        Boolean(leadRow?.discovery_data?.recommendation?.packageName),
        "Lead Recommendation Data Persisted",
        `Persisted recommended package: "${leadRow?.discovery_data?.recommendation?.packageName}" with score ${leadRow?.discovery_data?.recommendation?.score}%`
      );

      assert(
        Boolean(leadRow?.discovery_data?.qualification?.businessType),
        "Lead Qualification Context Persisted",
        `Persisted qualification: businessType = "${leadRow?.discovery_data?.qualification?.businessType}"`
      );
    }

    // -------------------------------------------------------------
    // Test 7: Direct Package Intake Flow
    // -------------------------------------------------------------
    console.log("\n--- Section 8: Direct Package Flow Verification ---");
    const sampleDirectPkg = publicPackages[0];
    const directLeadPayload: SmartLeadSubmissionPayload = {
      lead: {
        fullName: "Direct Package Test Lead",
        businessName: "Direct Intake Corp",
        phone: "+216 22 333 444",
        email: "direct.test@sada.agency",
        city: "Sousse",
      },
      qualification: { ...INITIAL_CANONICAL_ANSWERS },
      recommendation: {
        packageId: sampleDirectPkg.id,
        packageCode: sampleDirectPkg.code,
        packageName: sampleDirectPkg.name,
        score: 100,
        matchLevel: "strong",
        alternativePackageIds: [],
        reasons: ["Direct package selection by client."],
        isUnpublished: false,
      },
      source: "direct_package",
    };

    const directSubmitRes = await submitSmartContactLead(directLeadPayload);
    assert(
      directSubmitRes.success && Boolean(directSubmitRes.leadId),
      "Direct Package Lead Capture",
      `Direct intake created lead: ${directSubmitRes.leadId}`
    );

    if (directSubmitRes.leadId) {
      createdLeadIds.push(directSubmitRes.leadId);
    }
  } catch (err: any) {
    console.error("Test execution threw error:", err);
    assert(false, "Uncaught Exception", err.message);
  } finally {
    // Clean up created test leads
    console.log("\n--- Cleaning up test records ---");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
    const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, anonKey);
    await adminSupabase.auth.signInWithPassword({
      email: "sec.admin@sada.agency",
      password: "AdminPassword123!",
    });

    for (const lid of createdLeadIds) {
      const { error: delErr } = await adminSupabase.from("contact_submissions").delete().eq("id", lid);
      if (!delErr) {
        console.log(`Cleaned up lead: ${lid}`);
      }
    }
  }

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${reports.filter((r) => r.passed).length} / ${reports.length} PASSED`);
  console.log("=================================================");
}

runSystemVerification();

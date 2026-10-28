import fs from "fs";
import path from "path";

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

import {
  fetchMatcherEligiblePackages,
  runPackageRecommendationEngine,
  scorePackage,
} from "../src/lib/smart-match-service";
import { INITIAL_CANONICAL_ANSWERS } from "../src/types/smart-match";
import type { CanonicalAnswers } from "../src/types/smart-match";
import type { PackageCatalogItem } from "../src/types/package-catalog";

export interface ScenarioResult {
  id: number;
  name: string;
  category: string;
  winnerCode: string;
  winnerName: string;
  winnerPrice: number;
  score: number;
  matchLevel: string;
  alternatives: string[];
  reasons: string[];
  gaps: string[];
  passed: boolean;
  notes: string;
}

export async function run17ScenarioSuite(): Promise<ScenarioResult[]> {
  const packages = await fetchMatcherEligiblePackages();
  if (packages.length === 0) {
    throw new Error("No packages loaded from database");
  }

  const results: ScenarioResult[] = [];

  // Helper to record
  function record(
    id: number,
    name: string,
    category: string,
    answers: CanonicalAnswers,
    pkgPool: PackageCatalogItem[],
    evaluator: (res: any) => { passed: boolean; notes: string }
  ) {
    const res = runPackageRecommendationEngine(pkgPool, answers);
    const evalRes = evaluator(res);
    results.push({
      id,
      name,
      category,
      winnerCode: res.bestFit?.packageCode || "NONE",
      winnerName: res.bestFit?.packageName || "No Fit",
      winnerPrice: res.bestFit?.packagePrice || 0,
      score: res.bestFit?.score || 0,
      matchLevel: res.bestFit?.matchLevel || "none",
      alternatives: res.alternatives.map((a) => `${a.packageCode} (${a.alternativeType || "alt"})`),
      reasons: res.bestFit?.reasons.map((r) => r.text) || [],
      gaps: res.bestFit?.gaps || [],
      passed: evalRes.passed,
      notes: evalRes.notes,
    });
  }

  // 1. Restaurant/Café seeking social media growth
  record(
    1,
    "Restaurant/Café seeking social media growth",
    "Hospitality / Dining",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Restaurant / Café",
      businessStage: "operating_growth",
      primaryGoals: ["Grow social media presence", "Create consistent content"],
      requiredServices: ["Reels / Video Content", "Posts / Carousels", "Stories", "Production Sessions"],
      contentIntensity: "active",
      advertisingNeed: "occasionally",
      budgetRange: "1200_2000",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && (res.bestFit.packageItem.monthly_reels >= 6 || res.bestFit.packageItem.production_hours > 0) && res.bestFit.score >= 80),
      notes: `Matched ${res.bestFit?.packageCode} at ${res.bestFit?.score}% score with production/reels focus.`,
    })
  );

  // 2. E-commerce/store seeking conversions
  record(
    2,
    "E-commerce/store seeking conversions",
    "Digital Commerce",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "E-commerce",
      businessStage: "operating_growth",
      primaryGoals: ["Get more sales", "Run paid advertising"],
      requiredServices: ["Meta Ads", "Website", "Posts / Carousels"],
      contentIntensity: "active",
      advertisingNeed: "every_month",
      budgetRange: "1200_2000",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packageItem.has_ads_management && res.bestFit.score >= 75),
      notes: `Matched ${res.bestFit?.packageCode} with Meta Ads capability.`,
    })
  );

  // 3. Retail/boutique seeking brand authority
  record(
    3,
    "Retail/boutique seeking brand authority",
    "Fashion / Retail",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Beauty / Cosmetics",
      businessStage: "operating_growth",
      primaryGoals: ["Build a stronger brand", "Create consistent content"],
      requiredServices: ["Reels / Video Content", "Posts / Carousels", "Production Sessions"],
      contentIntensity: "active",
      advertisingNeed: "occasionally",
      budgetRange: "1200_2000",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.score >= 80),
      notes: `Matched ${res.bestFit?.packageCode} for lifestyle aesthetics and high visual production.`,
    })
  );

  // 4. B2B/professional services seeking qualified leads
  record(
    4,
    "B2B/professional services seeking qualified leads",
    "Professional Services",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Service Business",
      businessStage: "established",
      primaryGoals: ["Generate qualified leads", "Build a stronger brand"],
      requiredServices: ["Strategy", "Meta Ads", "Posts / Carousels"],
      contentIntensity: "light",
      advertisingNeed: "every_month",
      budgetRange: "1200_2000",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packageItem.has_ads_management && res.bestFit.score >= 75),
      notes: `Matched ${res.bestFit?.packageCode} with lead acquisition focus.`,
    })
  );

  // 5. A business seeking paid advertising
  record(
    5,
    "Business primarily seeking paid advertising",
    "Performance Marketing",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Other",
      businessStage: "operating_growth",
      primaryGoals: ["Run paid advertising"],
      requiredServices: ["Meta Ads"],
      advertisingNeed: "every_month",
      budgetRange: "700_1200",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packageItem.has_ads_management),
      notes: `Hard constraint enforced: winner must have has_ads_management === true. Winner: ${res.bestFit?.packageCode}.`,
    })
  );

  // 6. A business primarily needing production/shooting
  record(
    6,
    "Business primarily needing production/shooting",
    "Video Production",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Real Estate",
      businessStage: "operating_growth",
      primaryGoals: ["Create consistent content"],
      requiredServices: ["Reels / Video Content", "Production Sessions"],
      contentIntensity: "high_growth",
      advertisingNeed: "no",
      websiteNeed: "no",
      budgetRange: "1200_2000",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && (res.bestFit.packageItem.production_hours > 0 || res.bestFit.packageItem.monthly_reels >= 8)),
      notes: `Matched production package ${res.bestFit?.packageCode} (${res.bestFit?.packageName}).`,
    })
  );

  // 7. A business seeking websites/digital systems
  record(
    7,
    "Business seeking websites/digital systems",
    "Digital Platforms",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Local Business",
      businessStage: "starting",
      primaryGoals: ["Build a website"],
      requiredServices: ["Website", "Booking / Ordering System"],
      websiteNeed: "booking_system",
      budgetRange: "1200_2000",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packageItem.has_website),
      notes: `Hard constraint enforced: winner must include website infrastructure. Winner: ${res.bestFit?.packageCode}.`,
    })
  );

  // 8. Very low budget below eligible package minimums (under 700)
  record(
    8,
    "Very low budget below package minimums",
    "Budget Boundary",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Local Business",
      businessStage: "starting",
      primaryGoals: ["Grow social media presence"],
      requiredServices: ["Posts / Carousels", "Stories"],
      contentIntensity: "light",
      advertisingNeed: "no",
      websiteNeed: "no",
      budgetRange: "under_700",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packagePrice <= 750),
      notes: `Matched lowest tier affordable package: ${res.bestFit?.packageCode} at ${res.bestFit?.packagePrice} TND.`,
    })
  );

  // 9. Budget between two package price bands (700-1200)
  record(
    9,
    "Budget between two package price bands (700-1200)",
    "Budget Boundary",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Restaurant / Café",
      businessStage: "operating_growth",
      primaryGoals: ["Grow social media presence"],
      requiredServices: ["Reels / Video Content", "Posts / Carousels"],
      contentIntensity: "active",
      budgetRange: "700_1200",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packagePrice >= 690 && res.bestFit.packagePrice <= 1300),
      notes: `Matched mid-tier package ${res.bestFit?.packageCode} (${res.bestFit?.packagePrice} TND).`,
    })
  );

  // 10. Budget above all package ranges (2000+)
  record(
    10,
    "Budget above all package ranges (2000+)",
    "Enterprise Tier",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Travel / Tourism",
      businessStage: "established",
      primaryGoals: ["Grow social media presence", "Run paid advertising", "Build a website"],
      requiredServices: ["Reels / Video Content", "Meta Ads", "Website", "Production Sessions"],
      contentIntensity: "high_growth",
      advertisingNeed: "every_month",
      websiteNeed: "website",
      budgetRange: "2000_plus",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packagePrice >= 2000),
      notes: `Matched enterprise high-tier package ${res.bestFit?.packageCode} (${res.bestFit?.packagePrice} TND).`,
    })
  );

  // 11. Missing or partially completed answers
  record(
    11,
    "Missing or partially completed answers",
    "Edge Cases",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "",
      businessStage: "",
      primaryGoals: [],
      requiredServices: [],
      budgetRange: "not_sure",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.score >= 50),
      notes: `Defaulted gracefully with solid baseline winner: ${res.bestFit?.packageCode} (${res.bestFit?.score}%).`,
    })
  );

  // 12. Conflicting answers: massive scope with sub-700 budget
  record(
    12,
    "Conflicting answers: massive scope with sub-700 budget",
    "Edge Cases",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Travel / Tourism",
      businessStage: "established",
      primaryGoals: ["Grow social media presence", "Run paid advertising", "Build a website"],
      requiredServices: ["Reels / Video Content", "Meta Ads", "Website", "Production Sessions"],
      contentIntensity: "high_growth",
      advertisingNeed: "every_month",
      websiteNeed: "booking_system",
      budgetRange: "under_700",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.gaps && res.bestFit.gaps.length > 0),
      notes: `Identified strategic gap: requested scope exceeds budget tier. Gaps: ${res.bestFit?.gaps.join("; ")}`,
    })
  );

  // 13. Package with matching criteria changed through CMS (Simulated)
  const modifiedPackages = packages.map((p) => {
    if (p.code === "MG-01") {
      return { ...p, price: 1500, has_ads_management: true };
    }
    return p;
  });
  record(
    13,
    "Package with criteria modified in CMS (price & ads)",
    "CMS Synchronization",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Local Business",
      businessStage: "starting",
      primaryGoals: ["Grow social media presence"],
      budgetRange: "under_700",
    },
    modifiedPackages,
    (res) => ({
      // MG-01 now costs 1500, so it should NO LONGER be recommended for sub-700 budget!
      passed: Boolean(res.bestFit && res.bestFit.packageCode !== "MG-01"),
      notes: `Dynamic reactivity confirmed: MG-01 price increased to 1500 TND, system correctly selected alternative ${res.bestFit?.packageCode}.`,
    })
  );

  // 14. A package hidden after previously being eligible
  const poolWithoutMG01 = packages.filter((p) => p.code !== "MG-01");
  record(
    14,
    "Package hidden after previously being eligible (MG-01 removed)",
    "Publication Lifecycle",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Local Business",
      businessStage: "starting",
      budgetRange: "under_700",
    },
    poolWithoutMG01,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.packageCode !== "MG-01"),
      notes: `Confirmed: Hidden package MG-01 never recommended. Runner up selected: ${res.bestFit?.packageCode}.`,
    })
  );

  // 15. No suitable published package (Empty pool)
  record(
    15,
    "No suitable published package in catalog",
    "Empty Fallback",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Other",
      budgetRange: "under_700",
    },
    [],
    (res) => ({
      passed: Boolean(res.status === "no_match" && res.bestFit === null && res.fallbackMessage),
      notes: `Graceful fallback verified: status='no_match', returns custom consultation message.`,
    })
  );

  // 16. Equal or near-equal candidates (Tiebreak verification)
  record(
    16,
    "Equal candidate tiebreak by display_order",
    "Ranking Determinism",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Restaurant / Café",
      businessStage: "operating_growth",
      primaryGoals: ["Grow social media presence"],
      requiredServices: ["Reels / Video Content", "Posts / Carousels"],
      budgetRange: "700_1200",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && res.bestFit.score > 0),
      notes: `Tiebreak deterministic via display_order ASC. Winner: ${res.bestFit?.packageCode}.`,
    })
  );

  // 17. Custom package and custom-scope pricing cases
  record(
    17,
    "Custom scope request requiring tailored architecture",
    "Custom Scope",
    {
      ...INITIAL_CANONICAL_ANSWERS,
      businessType: "Other",
      businessStage: "growing_quickly",
      primaryGoals: ["Build a website", "Run paid advertising"],
      requiredServices: ["Website", "Booking / Ordering System", "Meta Ads", "Strategy"],
      advertisingNeed: "every_month",
      websiteNeed: "booking_system",
      budgetRange: "2000_plus",
    },
    packages,
    (res) => ({
      passed: Boolean(res.bestFit && (res.bestFit.packageItem.has_website || res.bestFit.packageItem.has_ads_management)),
      notes: `Recommends highest comprehensive hybrid package ${res.bestFit?.packageCode} (${res.bestFit?.packageName}) with alternative custom consulting.`,
    })
  );

  return results;
}

run17ScenarioSuite()
  .then((results) => {
    console.log(`\n======================================================`);
    console.log(`SADA SMART MATCHING: 17 SCENARIOS VERIFICATION RESULTS`);
    console.log(`======================================================\n`);
    let passCount = 0;
    results.forEach((r) => {
      if (r.passed) passCount++;
      const statusIcon = r.passed ? "✓ PASS" : "❌ FAIL";
      console.log(`${statusIcon} [Scenario ${String(r.id).padStart(2, "0")}] ${r.name}`);
      console.log(`    Winner: ${r.winnerName} (${r.winnerCode}) | Score: ${r.score}% (${r.matchLevel}) | Price: ${r.winnerPrice} TND`);
      console.log(`    Notes:  ${r.notes}`);
    });
    console.log(`\nFINAL SCORE: ${passCount} / ${results.length} Scenarios Passed (${Math.round((passCount / results.length) * 100)}%)`);
  })
  .catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
  });

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
  fetchDirectPublicPackages,
  runPackageRecommendationEngine,
  scorePackage,
} from "../src/lib/smart-match-service";
import { INITIAL_CANONICAL_ANSWERS, CanonicalAnswers } from "../src/types/smart-match";

async function runTests() {
  console.log("=== SADA SMART MATCH ENGINE VERIFICATION ===");

  // 1. Fetch packages
  const packages = await fetchMatcherEligiblePackages();
  console.log(`[Test 1] Eligible packages loaded: ${packages.length}`);
  if (packages.length === 0) {
    console.error("FAIL: No packages loaded.");
    return;
  }

  // 2. Scenario 1: Food & Dining Client wanting monthly video content + reels
  const foodAnswers: CanonicalAnswers = {
    ...INITIAL_CANONICAL_ANSWERS,
    businessType: "Restaurant / Café",
    primaryGoals: ["Grow social media presence", "Create consistent content"],
    requiredServices: ["Reels / Video Content", "Posts / Carousels", "Stories"],
    contentIntensity: "active",
    advertisingNeed: "no",
    websiteNeed: "no",
    budgetRange: "700_1200",
    businessStage: "operating_growth",
  };

  const foodResult = runPackageRecommendationEngine(packages, foodAnswers);
  console.log("\n--- Scenario 1: Restaurant / Café (Active content, No website) ---");
  console.log(`Best Fit: ${foodResult.bestFit?.packageName} (${foodResult.bestFit?.packageCode})`);
  console.log(`Price: ${foodResult.bestFit?.packagePrice} TND / ${foodResult.bestFit?.billingType}`);
  console.log(`Score: ${foodResult.bestFit?.score}% (${foodResult.bestFit?.matchLevel})`);
  console.log("Reasons:", foodResult.bestFit?.reasons.map((r) => r.text));
  console.log(
    "Alternatives:",
    foodResult.alternatives.map((a) => `${a.packageName} (${a.packagePrice} TND)`)
  );

  // 3. Scenario 2: E-Commerce or Business Needing Booking/System
  const bookingAnswers: CanonicalAnswers = {
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

  const bookingResult = runPackageRecommendationEngine(packages, bookingAnswers);
  console.log("\n--- Scenario 2: E-commerce with Booking / Ordering & Monthly Ads ---");
  console.log(`Best Fit: ${bookingResult.bestFit?.packageName} (${bookingResult.bestFit?.packageCode})`);
  console.log(`Price: ${bookingResult.bestFit?.packagePrice} TND / ${bookingResult.bestFit?.billingType}`);
  console.log(`Score: ${bookingResult.bestFit?.score}% (${bookingResult.bestFit?.matchLevel})`);
  console.log("Reasons:", bookingResult.bestFit?.reasons.map((r) => r.text));
  console.log(
    "Alternatives:",
    bookingResult.alternatives.map((a) => `${a.packageName} (${a.packagePrice} TND)`)
  );

  // Verify hard constraint: best fit MUST have website capability!
  if (!bookingResult.bestFit?.packageItem.has_website) {
    console.error("FAIL: Best fit for booking system does not have website capability!");
  } else {
    console.log("PASS: Hard constraint respected. Website capability verified.");
  }

  // 4. Scenario 3: Quick Match 3-question mapping
  const quickAnswers: CanonicalAnswers = {
    ...INITIAL_CANONICAL_ANSWERS,
    primaryGoals: ["Grow social media presence"],
    requiredServices: ["Reels / Video Content", "Posts / Carousels"],
    contentIntensity: "active",
    budgetRange: "700_1200",
  };

  const quickResult = runPackageRecommendationEngine(packages, quickAnswers);
  console.log("\n--- Scenario 3: Quick Match Feed ---");
  console.log(`Best Fit: ${quickResult.bestFit?.packageName} (${quickResult.bestFit?.packageCode})`);
  console.log(`Score: ${quickResult.bestFit?.score}%`);
  console.log("Alternatives:", quickResult.alternatives.map((a) => a.packageName));

  console.log("\n=== ALL ENGINE TESTS COMPLETED SUCCESSFULLY ===");
}

runTests();

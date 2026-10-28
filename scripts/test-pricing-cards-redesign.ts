import fs from "node:fs";
import path from "node:path";
import { resolvePackageVisualConfig } from "../src/components/packages/pricing-card-types";
import type { PackageCatalogItem } from "../src/types/package-catalog";

console.log("==================================================");
console.log("VERIFYING SADA PRICING CARDS PREMIUM UI/UX REDESIGN");
console.log("==================================================");

let totalChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

// 1. Mock Base Package
const mockBasePkg: PackageCatalogItem = {
  id: "pkg-1",
  code: "SMM-01",
  name: "Essential Social",
  name_ar: "باقة السوشيال الأساسية",
  slug: "essential-social",
  category_id: "cat-1",
  category_name: "Social Media Management",
  package_type: "standard",
  billing_type: "monthly",
  price: 1490,
  currency: "TND",
  is_active: true,
  is_published: true,
  is_featured: false,
  badge: null,
  badge_ar: null,
  priority: 1,
  display_order: 1,
  short_description: "Core social presence for growing businesses",
  short_description_ar: "حضور رقمي متوازن للشركات الناشئة",
  included_items: [
    { text: "Content Planning & Calendar" },
    { text: "8 High-Frequency Reels" },
    { text: "8 Creative Posts" },
    { text: "Weekly Stories" },
    { text: "Performance Analytics" },
    { text: "Community Management" },
  ],
  excluded_items: [
    { text: "Meta Ads Sponsoring Budget" },
    { text: "Website Development" },
  ],
  monthly_reels: 8,
  monthly_posts: 8,
  monthly_stories: "Weekly Story Sequences",
  production_hours: 0,
  production_sessions: 0,
  platforms: ["instagram", "facebook"],
  has_ads_management: false,
  has_website: false,
  has_strategy: true,
  has_community_management: true,
  custom_pricing: false,
  employee_cost: 400,
  freelancer_cost: 0,
  transport_cost: 50,
  subscription_allocation: 100,
  commission: 149,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// 2. Test Visual Tier Resolution
const standardConfig = resolvePackageVisualConfig(mockBasePkg);
assert(standardConfig.tier === "standard", "Standard package correctly resolves to tier='standard'");
assert(!standardConfig.isRecommended, "Standard package is not recommended");
assert(!standardConfig.isFeatured, "Standard package is not featured");
assert(!standardConfig.accentGlow, "Standard package does not force accent glow");

const featuredPkg: PackageCatalogItem = {
  ...mockBasePkg,
  is_featured: true,
  badge: "featured",
};
const featuredConfig = resolvePackageVisualConfig(featuredPkg);
assert(featuredConfig.tier === "featured", "Featured package correctly resolves to tier='featured'");
assert(featuredConfig.isFeatured, "Featured package has isFeatured=true");
assert(featuredConfig.accentGlow, "Featured package has accentGlow=true");

const recommendedPkg: PackageCatalogItem = {
  ...mockBasePkg,
  badge: "recommended",
};
const recommendedConfig = resolvePackageVisualConfig(recommendedPkg);
assert(recommendedConfig.tier === "recommended", "Recommended package correctly resolves to tier='recommended'");
assert(recommendedConfig.isRecommended, "Recommended package has isRecommended=true");
assert(recommendedConfig.accentGlow, "Recommended package has accentGlow=true");

const premiumPkg: PackageCatalogItem = {
  ...mockBasePkg,
  code: "CUS-01",
  name: "Build Your Package",
  package_type: "custom",
  billing_type: "custom",
  custom_pricing: true,
  price: 0,
};
const premiumConfig = resolvePackageVisualConfig(premiumPkg);
assert(premiumConfig.tier === "premium", "Custom scope package correctly resolves to tier='premium'");
assert(premiumConfig.isPremium, "Custom package has isPremium=true");
assert(premiumConfig.badgeType === "custom_scope", "Custom package resolves badgeType='custom_scope'");

const unavailablePkg: PackageCatalogItem = {
  ...mockBasePkg,
  is_active: false,
};
const unavailableConfig = resolvePackageVisualConfig(unavailablePkg);
assert(unavailableConfig.tier === "unavailable", "Inactive package correctly resolves to tier='unavailable'");
assert(unavailableConfig.isUnavailable, "Inactive package has isUnavailable=true");

// 3. Verify Components Exist
const componentFiles = [
  "src/components/packages/pricing-card-types.ts",
  "src/components/packages/PricingCardBadge.tsx",
  "src/components/packages/PricingCardHeader.tsx",
  "src/components/packages/PricingCardPrice.tsx",
  "src/components/packages/PricingCardDeliverables.tsx",
  "src/components/packages/PricingCardFeatures.tsx",
  "src/components/packages/PricingCardCTA.tsx",
  "src/components/packages/PublicPackageCard.tsx",
];

for (const comp of componentFiles) {
  const filePath = path.resolve(comp);
  assert(fs.existsSync(filePath), `Component file exists: ${comp}`);
}

// 4. Verify CSS Liquid Glass & Atmospheric Diffusion in src/styles.css
const stylesContent = fs.readFileSync(path.resolve("src/styles.css"), "utf-8");
assert(stylesContent.includes(".sada-pricing-card"), "styles.css contains .sada-pricing-card");
assert(stylesContent.includes(".sada-pricing-recommended"), "styles.css contains .sada-pricing-recommended");
assert(stylesContent.includes(".sada-pricing-featured"), "styles.css contains .sada-pricing-featured");
assert(stylesContent.includes(".sada-pricing-premium"), "styles.css contains .sada-pricing-premium");
assert(stylesContent.includes(".sada-pricing-card-ambient"), "styles.css contains .sada-pricing-card-ambient");
assert(stylesContent.includes("translateY(-4px)"), "styles.css implements GPU hover elevation");

// 5. Verify NO Purple Used in Pricing Badge or Card
const publicCardContent = fs.readFileSync(path.resolve("src/components/packages/PublicPackageCard.tsx"), "utf-8");
const badgeContent = fs.readFileSync(path.resolve("src/components/packages/PricingCardBadge.tsx"), "utf-8");
const utilsContent = fs.readFileSync(path.resolve("src/components/packages/package-utils.ts"), "utf-8");

assert(!badgeContent.includes("purple"), "Zero purple in PricingCardBadge.tsx");
assert(!publicCardContent.includes("purple"), "Zero purple in PublicPackageCard.tsx");
assert(!utilsContent.includes("purple"), "Zero purple in package-utils.ts");

// 6. Verify Public /pricing route consumes PublicPackageCard
const pricingRouteContent = fs.readFileSync(path.resolve("src/routes/pricing.tsx"), "utf-8");
assert(pricingRouteContent.includes("<PublicPackageCard"), "pricing.tsx renders <PublicPackageCard");
assert(pricingRouteContent.includes("sada-pricing-card"), "pricing.tsx loading skeleton mirrors sada-pricing-card structure");
assert(pricingRouteContent.includes("radial-gradient"), "pricing.tsx includes atmospheric background diffusion");

// 7. Verify Admin Package Live Preview consumes PublicPackageCard
const drawerContent = fs.readFileSync(path.resolve("src/components/admin/packages/PackageEditorDrawer.tsx"), "utf-8");
assert(drawerContent.includes("<PublicPackageCard"), "PackageEditorDrawer.tsx renders live preview via PublicPackageCard");

console.log("==================================================");
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
console.log("==================================================");

if (passedChecks !== totalChecks) {
  process.exit(1);
} else {
  console.log("ALL SADA PRICING CARDS VERIFICATION CHECKS PASSED!");
}

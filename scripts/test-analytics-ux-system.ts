import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ANALYTICS_SECTIONS } from "../src/components/admin/AnalyticsSectionNav";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

console.log("=================================================================");
console.log("SADA OS — ANALYTICS & KPIS PAGE UX REFINEMENT TEST SUITE");
console.log("=================================================================\n");

let passed = 0;
let total = 0;

function it(desc: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`✓ PASS: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
  }
}

// -------------------------------------------------------------
// TEST 1: Section Definitions & Layout Rows
// -------------------------------------------------------------
console.log("--- 1. Section Definitions & Desktop Row Distribution ---");

it("Contains all 11 analytics sections without dropping any existing section", () => {
  assert.strictEqual(ANALYTICS_SECTIONS.length, 11);
  const ids = ANALYTICS_SECTIONS.map((s) => s.id);
  const expectedIds = [
    "client_profitability",
    "package_profitability",
    "service_profitability",
    "employee_performance",
    "sales_performance",
    "production_performance",
    "monthly_pnl",
    "cash_flow",
    "commission_performance",
    "revenue_trends",
    "audit_activity",
  ];
  assert.deepStrictEqual(ids, expectedIds);
});

it("Desktop Row 1 exactly matches the 4 preferred sections", () => {
  const row1 = ANALYTICS_SECTIONS.slice(0, 4).map((s) => s.id);
  assert.deepStrictEqual(row1, [
    "client_profitability",
    "package_profitability",
    "service_profitability",
    "employee_performance",
  ]);
});

it("Desktop Row 2 exactly matches the 4 preferred sections", () => {
  const row2 = ANALYTICS_SECTIONS.slice(4, 8).map((s) => s.id);
  assert.deepStrictEqual(row2, [
    "sales_performance",
    "production_performance",
    "monthly_pnl",
    "cash_flow",
  ]);
});

it("Desktop Row 3 cleanly accommodates the remaining 3 sections", () => {
  const row3 = ANALYTICS_SECTIONS.slice(8).map((s) => s.id);
  assert.deepStrictEqual(row3, [
    "commission_performance",
    "revenue_trends",
    "audit_activity",
  ]);
});

// -------------------------------------------------------------
// TEST 2: Static Layout Analysis & Scrollbar Elimination
// -------------------------------------------------------------
console.log("\n--- 2. Static Layout & Scrollbar Elimination Audit ---");

const navFilePath = resolve(__dirname, "../src/components/admin/AnalyticsSectionNav.tsx");
const navSource = readFileSync(navFilePath, "utf8");

const analyticsRoutePath = resolve(__dirname, "../src/routes/admin.analytics.tsx");
const analyticsRouteSource = readFileSync(analyticsRoutePath, "utf8");

it("Completely removed 'overflow-x-auto' from AnalyticsSectionNav and Tabs strip in admin.analytics.tsx", () => {
  assert.strictEqual(navSource.includes("overflow-x-auto"), false);
  // Verify Tabs strip does not wrap in overflow-x-auto
  const tabsStripMatch = analyticsRouteSource.match(/\{\/\* 2\. ANALYTICS TABS STRIP[\s\S]*?<AnalyticsSectionNav/);
  assert.ok(tabsStripMatch, "Tabs strip with AnalyticsSectionNav must be found");
  assert.strictEqual(tabsStripMatch[0].includes("overflow-x-auto"), false);
});

it("Uses responsive multi-row CSS grid in AnalyticsSectionNav", () => {
  assert.strictEqual(navSource.includes("grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2"), true);
});

it("Preserves Radix UI TabsList and TabsTrigger for full keyboard accessibility", () => {
  assert.strictEqual(navSource.includes("<TabsList"), true);
  assert.strictEqual(navSource.includes("<TabsTrigger"), true);
  assert.strictEqual(navSource.includes("focus-visible:ring-2"), true);
});

it("Preserves semantic landmark nav with accessible label", () => {
  assert.strictEqual(navSource.includes("<nav"), true);
  assert.strictEqual(navSource.includes('aria-label="Management Analytics Sections"'), true);
});

// -------------------------------------------------------------
// TEST 3: Package Profitability Grid & Card Hierarchy
// -------------------------------------------------------------
console.log("\n--- 3. Package Profitability Grid & Card Hierarchy Audit ---");

it("Package Profitability uses genuine responsive CSS grid (1 col mobile, 2 col tablet/medium, 3 col desktop)", () => {
  assert.strictEqual(
    analyticsRouteSource.includes('className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5"'),
    true
  );
});

it("Package cards enforce equal height with flex layout (h-full flex flex-col justify-between)", () => {
  assert.strictEqual(
    analyticsRouteSource.includes("flex flex-col justify-between h-full group"),
    true
  );
});

it("Package card hierarchy places Selling Price as primary metric above cost breakdown", () => {
  const pkgSection = analyticsRouteSource.substring(
    analyticsRouteSource.indexOf('TabsContent value="package_profitability"'),
    analyticsRouteSource.indexOf('TabsContent value="service_profitability"')
  );
  const sellingPriceIdx = pkgSection.indexOf("Selling Price");
  const costBreakdownIdx = pkgSection.indexOf("Internal Employee Cost");
  const grossProfitIdx = pkgSection.indexOf("Gross Profit");
  const inspectIdx = pkgSection.indexOf("Inspect");

  assert.ok(sellingPriceIdx > 0, "Selling Price must exist");
  assert.ok(costBreakdownIdx > sellingPriceIdx, "Cost breakdown must follow Selling Price");
  assert.ok(grossProfitIdx > costBreakdownIdx, "Gross Profit must follow Cost breakdown");
  assert.ok(inspectIdx > grossProfitIdx, "Inspect action must follow Gross Profit");
});

it("Header controls wrap cleanly without horizontal overflow", () => {
  assert.strictEqual(
    analyticsRouteSource.includes('className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto"'),
    true
  );
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================================");
console.log(`TEST RESULTS: ${passed}/${total} PASSED (${((passed / total) * 100).toFixed(0)}%)`);
console.log("=================================================================");

if (passed === total) {
  process.exit(0);
} else {
  process.exit(1);
}

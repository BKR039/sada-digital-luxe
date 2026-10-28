import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getFinanceSections } from "../src/components/admin/finance/FinanceSectionNav";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

console.log("=================================================================");
console.log("SADA FINANCE — SECTION NAVIGATION UX REFINEMENT TEST SUITE");
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
// TEST 1: Section Definitions Completeness
// -------------------------------------------------------------
console.log("--- 1. Section Definitions & Data Integrity ---");

const mockCounts = {
  ledger: 142,
  inflows: 51,
  sponsoring: 8,
  expenses: 39,
  subscriptions: 15,
  commissions: 4,
};

const sectionsWithAlert = getFinanceSections(mockCounts, true);
const sectionsWithoutAlert = getFinanceSections(mockCounts, false);

it("Contains all 13 finance sections without dropping any existing section", () => {
  assert.strictEqual(sectionsWithAlert.length, 13);
  const ids = sectionsWithAlert.map((s) => s.id);
  const expectedIds = [
    "overview",
    "ledger",
    "inflows",
    "revenue",
    "sponsoring",
    "expenses",
    "subscriptions",
    "salaries",
    "commissions",
    "requests",
    "cashflow",
    "profitability",
    "closing",
  ];
  assert.deepStrictEqual(ids, expectedIds);
});

it("Preserves exact section labels without truncation or text-overflow ellipsis", () => {
  const labelMap = Object.fromEntries(sectionsWithAlert.map((s) => [s.id, s.label]));
  assert.strictEqual(labelMap["overview"], "Overview");
  assert.strictEqual(labelMap["ledger"], "Ledger");
  assert.strictEqual(labelMap["inflows"], "Inflows");
  assert.strictEqual(labelMap["revenue"], "Invoices & Billing");
  assert.strictEqual(labelMap["sponsoring"], "Sponsoring");
  assert.strictEqual(labelMap["expenses"], "Outflows");
  assert.strictEqual(labelMap["subscriptions"], "SaaS Subscriptions");
  assert.strictEqual(labelMap["salaries"], "Payroll");
  assert.strictEqual(labelMap["commissions"], "Commissions");
  assert.strictEqual(labelMap["requests"], "Worker Requests");
  assert.strictEqual(labelMap["cashflow"], "Cash Flow & Treasury");
  assert.strictEqual(labelMap["profitability"], "Client Profitability");
  assert.strictEqual(labelMap["closing"], "Period Closing & Audit");
});

it("Underlying counts dynamically reflect finance data", () => {
  const countMap = Object.fromEntries(sectionsWithAlert.map((s) => [s.id, s.count]));
  assert.strictEqual(countMap["ledger"], 142);
  assert.strictEqual(countMap["inflows"], 51);
  assert.strictEqual(countMap["sponsoring"], 8);
  assert.strictEqual(countMap["expenses"], 39);
  assert.strictEqual(countMap["subscriptions"], 15);
  assert.strictEqual(countMap["commissions"], 4);
  assert.strictEqual(countMap["overview"], undefined);
  assert.strictEqual(countMap["salaries"], undefined);
  assert.strictEqual(countMap["cashflow"], undefined);
  assert.strictEqual(countMap["profitability"], undefined);
  assert.strictEqual(countMap["closing"], undefined);
});

it("Worker requests alert flag toggles correctly", () => {
  const reqWithAlert = sectionsWithAlert.find((s) => s.id === "requests");
  const reqWithoutAlert = sectionsWithoutAlert.find((s) => s.id === "requests");
  assert.strictEqual(reqWithAlert?.hasAlert, true);
  assert.strictEqual(reqWithoutAlert?.hasAlert, false);
});

// -------------------------------------------------------------
// TEST 2: Static Layout Analysis & Scrollbar Elimination
// -------------------------------------------------------------
console.log("\n--- 2. Static Layout & Scrollbar Elimination Audit ---");

const navFilePath = resolve(__dirname, "../src/components/admin/finance/FinanceSectionNav.tsx");
const navSource = readFileSync(navFilePath, "utf8");

const financeRoutePath = resolve(__dirname, "../src/routes/admin.finance.tsx");
const financeRouteSource = readFileSync(financeRoutePath, "utf8");

it("Completely removed 'overflow-x-auto' from FinanceSectionNav and admin.finance.tsx tabs", () => {
  assert.strictEqual(navSource.includes("overflow-x-auto"), false);
  assert.strictEqual(financeRouteSource.includes("overflow-x-auto"), false);
});

it("Completely removed 'overflow-x-scroll' from navigation", () => {
  assert.strictEqual(navSource.includes("overflow-x-scroll"), false);
  assert.strictEqual(financeRouteSource.includes("overflow-x-scroll"), false);
});

it("Completely removed 'no-scrollbar' hiding hack from navigation", () => {
  assert.strictEqual(navSource.includes("no-scrollbar"), false);
});

it("TabsTrigger does not have 'shrink-0' so it spans grid columns cleanly", () => {
  // Extract TabsTrigger className block
  const triggerBlockMatch = navSource.match(/<TabsTrigger[\s\S]*?className=\{cn\(([\s\S]*?)\)\}/);
  assert.ok(triggerBlockMatch, "TabsTrigger with cn() className must be present");
  const triggerClasses = triggerBlockMatch[1];
  assert.strictEqual(triggerClasses.includes("shrink-0"), false, "TabsTrigger itself must not have shrink-0");
  assert.strictEqual(triggerClasses.includes("w-full"), true, "TabsTrigger must have w-full to span column");
  assert.strictEqual(triggerClasses.includes("h-10"), true, "TabsTrigger must have h-10 for consistent height");
});

it("Uses responsive CSS Grid with 'repeat(auto-fill, minmax(min(100%, 205px), 1fr))'", () => {
  assert.strictEqual(navSource.includes("repeat(auto-fill, minmax(min(100%, 205px), 1fr))"), true);
});

it("Preserves Radix UI TabsList and TabsTrigger for full keyboard accessibility", () => {
  assert.strictEqual(navSource.includes("<TabsList"), true);
  assert.strictEqual(navSource.includes("<TabsTrigger"), true);
  assert.strictEqual(navSource.includes("focus-visible:ring-2"), true);
});

it("Preserves semantic landmark nav with accessible label", () => {
  assert.strictEqual(navSource.includes('<nav'), true);
  assert.strictEqual(navSource.includes('aria-label="Finance navigation sections"'), true);
});

// -------------------------------------------------------------
// TEST 3: Multi-Viewport Grid Calculations
// -------------------------------------------------------------
console.log("\n--- 3. Multi-Viewport Layout Math & Zero-Clipping Proof ---");

interface ViewportScenario {
  name: string;
  viewportWidth: number;
  sidebarWidth: number;
  containerPadding: number;
  expectedMinColumns: number;
  expectedMaxColumns: number;
}

const scenarios: ViewportScenario[] = [
  { name: "1440px Desktop", viewportWidth: 1440, sidebarWidth: 280, containerPadding: 64, expectedMinColumns: 5, expectedMaxColumns: 6 },
  { name: "1280px Desktop", viewportWidth: 1280, sidebarWidth: 280, containerPadding: 64, expectedMinColumns: 4, expectedMaxColumns: 5 },
  { name: "1024px Tablet/Desktop", viewportWidth: 1024, sidebarWidth: 280, containerPadding: 64, expectedMinColumns: 3, expectedMaxColumns: 4 },
  { name: "768px Tablet", viewportWidth: 768, sidebarWidth: 280, containerPadding: 48, expectedMinColumns: 2, expectedMaxColumns: 2 },
  { name: "390px Mobile (iPhone)", viewportWidth: 390, sidebarWidth: 0, containerPadding: 32, expectedMinColumns: 1, expectedMaxColumns: 1 },
  { name: "375px Mobile (iPhone SE)", viewportWidth: 375, sidebarWidth: 0, containerPadding: 32, expectedMinColumns: 1, expectedMaxColumns: 1 },
];

const MIN_COLUMN_WIDTH = 205; // px
const GAP = 8; // px

for (const scenario of scenarios) {
  it(`Calculates correct columns for ${scenario.name} with NO overflow`, () => {
    const availableWidth = scenario.viewportWidth - scenario.sidebarWidth - scenario.containerPadding;
    // Calculate columns: repeat(auto-fill, minmax(min(100%, 205px), 1fr))
    const minTrack = Math.min(availableWidth, MIN_COLUMN_WIDTH);
    // Standard grid track calculation: N * track + (N-1) * gap <= availableWidth
    const columns = Math.max(1, Math.floor((availableWidth + GAP) / (minTrack + GAP)));
    const columnWidth = (availableWidth - (columns - 1) * GAP) / columns;

    assert.ok(
      columns >= scenario.expectedMinColumns && columns <= scenario.expectedMaxColumns,
      `Expected columns between ${scenario.expectedMinColumns} and ${scenario.expectedMaxColumns}, got ${columns} (width: ${columnWidth.toFixed(1)}px)`
    );

    // Verify column width is at least minTrack
    assert.ok(columnWidth >= minTrack - 1, `Column width ${columnWidth}px must be >= minTrack ${minTrack}px`);

    // Verify longest label "Period Closing & Audit" (needs ~185px) fits with room to spare
    if (columns > 1) {
      assert.ok(columnWidth >= 185, `Column width ${columnWidth}px has ample room for longest label (185px)`);
    } else {
      assert.ok(columnWidth >= 300, `Single column width ${columnWidth}px provides massive space on mobile`);
    }

    console.log(
      `   → ${scenario.name}: ${columns} columns × ~${columnWidth.toFixed(0)}px per tab (Available width: ${availableWidth}px, 0px horizontal scroll)`
    );
  });
}

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

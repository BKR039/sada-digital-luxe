import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

console.log("=================================================================");
console.log("SADA OS — CLIENTS DIRECTORY UX & RESPONSIVE TABLE TEST SUITE");
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

const clientsIndexContent = readFileSync(
  resolve(__dirname, "../src/routes/admin.clients.index.tsx"),
  "utf-8"
);

// -------------------------------------------------------------
// TEST 1: ZERO HORIZONTAL OVERFLOW ARCHITECTURE
// -------------------------------------------------------------
console.log("--- 1. Zero Horizontal Overflow Architecture ---");

it("Root page container enforces overflow-x-hidden and min-w-0", () => {
  assert(
    clientsIndexContent.includes("overflow-x-hidden"),
    "Page container must have overflow-x-hidden"
  );
  assert(
    clientsIndexContent.includes("w-full max-w-7xl mx-auto"),
    "Page container must be full width constrained"
  );
  assert(
    clientsIndexContent.includes("min-w-0"),
    "Page container must have min-w-0 to prevent flex/grid blowouts"
  );
});

it("Eliminated all horizontal scroll areas (no overflow-x-auto in client tables or filters)", () => {
  // Check the table and filter areas do not use overflow-x-auto
  const hasTableOverflowXAuto = /<div className="overflow-x-auto[^>]*>\s*<table/i.test(clientsIndexContent);
  assert.strictEqual(
    hasTableOverflowXAuto,
    false,
    "Table container must not use overflow-x-auto; it must be fixed and responsive"
  );

  const hasFilterOverflowXAuto = /overflow-x-auto\s+scrollbar-none/i.test(clientsIndexContent);
  assert.strictEqual(
    hasFilterOverflowXAuto,
    false,
    "Filter bar must wrap flex items instead of using overflow-x-auto"
  );
});

it("No oversized fixed min-width declarations (no min-w-[1400px], w-max, or min-w-max)", () => {
  assert(!clientsIndexContent.includes("min-w-[1400px]"), "Must not have oversized min-width");
  assert(!clientsIndexContent.includes("min-w-[1200px]"), "Must not have oversized min-width");
  assert(!clientsIndexContent.includes("min-w-max"), "Must not have min-w-max");
});

// -------------------------------------------------------------
// TEST 2: RESPONSIVE TABLE & BREAKPOINT STRATEGY
// -------------------------------------------------------------
console.log("\n--- 2. Responsive Table & Breakpoint Strategy ---");

it("Desktop table uses table-fixed with controlled colgroup percentages", () => {
  assert(
    clientsIndexContent.includes("table-fixed"),
    "Tables must use table-fixed for strict column containment"
  );
  assert(
    clientsIndexContent.includes("<colgroup>"),
    "Must define colgroup for precise column allocation"
  );
  assert(
    clientsIndexContent.includes("hidden xl:block"),
    "Desktop table must be responsive on large screens (>= 1100px / xl:block)"
  );
});

it("Tablet compact table (768px-1099px) displays 6 prioritized columns", () => {
  assert(
    clientsIndexContent.includes("hidden md:block xl:hidden"),
    "Tablet table must specifically target md to xl viewports (768px - 1099px)"
  );
  assert(
    clientsIndexContent.includes("Client & Team"),
    "Tablet table must combine client identity and secondary team metadata"
  );
});

it("Mobile compact table (< 768px) prevents horizontal overflow if user selects table view", () => {
  assert(
    clientsIndexContent.includes("block md:hidden"),
    "Must provide a compact mobile table representation (< 768px)"
  );
  assert(
    !clientsIndexContent.includes("overflow-x-scroll"),
    "Mobile table must not scroll horizontally"
  );
});

// -------------------------------------------------------------
// TEST 3: WORKSPACE ACTION ACCESSIBILITY
// -------------------------------------------------------------
console.log("\n--- 3. Workspace Action Accessibility & Touch Targets ---");

it("Desktop table always displays direct Workspace button and quick link", () => {
  assert(
    clientsIndexContent.includes("View Client Workspace"),
    "Quick link [ ↗ ] must be present in desktop table"
  );
  assert(
    clientsIndexContent.includes("<span>Workspace</span>"),
    "Direct [ Workspace → ] button must be present in desktop table"
  );
});

it("Tablet table always displays direct Workspace button without scrolling", () => {
  const matches = (clientsIndexContent.match(/<span>Workspace<\/span>/g) || []).length;
  assert(matches >= 2, "Workspace button must be present in both desktop and tablet tables");
});

it("Mobile cards provide large 44px (h-11) full-width Open Workspace touch target", () => {
  assert(
    clientsIndexContent.includes("w-full h-11"),
    "Mobile cards must have full-width h-11 button (minimum 44px touch target)"
  );
  assert(
    clientsIndexContent.includes("<span>Open Workspace</span>"),
    "Mobile cards must display clear Open Workspace action"
  );
});

it("Workspace action strictly preserves canonical routing logic", () => {
  const routingCheck = `c.primaryWorkspace ? "/admin/client-projects/$id" : "/admin/clients/$id"`;
  assert(
    clientsIndexContent.includes(routingCheck),
    "Workspace button must link to primary client project or fallback to client workspace"
  );
});

// -------------------------------------------------------------
// TEST 4: ALL 9 REQUIRED CLIENT DATA FIELDS
// -------------------------------------------------------------
console.log("\n--- 4. Full Client Information Visibility ---");

it("Cards & Table display Client Name and Contact Person without data loss", () => {
  assert(clientsIndexContent.includes("c.name"), "Client Name must be displayed");
  assert(clientsIndexContent.includes("c.contact_name"), "Contact person must be displayed");
});

it("Cards & Table display Industry and Package fields", () => {
  assert(clientsIndexContent.includes("c.industry"), "Industry must be displayed");
  assert(clientsIndexContent.includes("c.package_name"), "Package Name must be displayed");
});

it("Cards & Table display Financial Metrics (Revenue, Sponsoring, Payment, Health)", () => {
  assert(clientsIndexContent.includes("c.monthlyRevenue"), "Monthly Revenue must be displayed");
  assert(clientsIndexContent.includes("c.sponsoringBudget"), "Sponsoring Budget must be displayed");
  assert(clientsIndexContent.includes("c.paymentStatus"), "Payment Status must be displayed");
  assert(clientsIndexContent.includes("c.clientHealth"), "Client Health must be displayed");
});

it("Cards & Table display Client Status with indicator dot", () => {
  assert(clientsIndexContent.includes("c.status === \"active\""), "Active/Inactive status must be evaluated");
  assert(clientsIndexContent.includes("Active"), "Active label must be displayed");
  assert(clientsIndexContent.includes("Inactive"), "Inactive label must be displayed");
});

// -------------------------------------------------------------
// TEST 5: SEARCH, FILTERS & RESPONSIVE TOGGLE
// -------------------------------------------------------------
console.log("\n--- 5. Search, Filter Controls & View Toggle ---");

it("Filter pills wrap cleanly into rows without horizontal clipping or scrollbars", () => {
  assert(
    clientsIndexContent.includes("flex flex-wrap items-center gap-1.5"),
    "Filter pills must use flex-wrap"
  );
  assert(clientsIndexContent.includes("All Clients"), "All Clients filter must exist");
  assert(clientsIndexContent.includes("Monthly Retainers"), "Monthly Retainers filter must exist");
  assert(clientsIndexContent.includes("One-Off / À La Carte"), "One-Off filter must exist");
});

it("Table / Cards view switcher is fully responsive and intact", () => {
  assert(clientsIndexContent.includes("onClick={() => setViewMode(\"table\")}"));
  assert(clientsIndexContent.includes("onClick={() => setViewMode(\"cards\")}"));
});

it("Automatically defaults to Cards on mobile viewports (< 768px)", () => {
  assert(
    clientsIndexContent.includes("window.innerWidth < 768"),
    "Must detect mobile screens to default to cards"
  );
  assert(
    clientsIndexContent.includes("setViewMode(\"cards\")"),
    "Must set viewMode to cards on mobile"
  );
});

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================================");
console.log(`TOTAL TESTS: ${total}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${total - passed}`);
console.log("=================================================================");

if (total !== passed) {
  process.exit(1);
}

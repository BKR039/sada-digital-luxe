import fs from "fs";
import path from "path";
import { canAccessFinance, canViewFinance, canManageFinance } from "../src/lib/permissions";
import { getPresetPeriod } from "../src/lib/finance-service";

async function runFinanceAudit() {
  console.log("==================================================");
  console.log("SADA FINANCE MODULE — PRODUCTION READINESS AUDIT");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}${detail ? ` — ${detail}` : ""}`);
      failed++;
    }
  }

  // 1. AUTHORIZATION & RBAC VERIFICATION
  console.log("1. RBAC & Access Control Verification (Super Admin Only):");
  assert(canAccessFinance("super_admin") === true, "Super Admin has finance access");
  assert(canAccessFinance("admin") === false, "Admin is denied finance access");
  assert(canAccessFinance("worker") === false, "Worker is denied finance access");
  assert(canAccessFinance("sales") === false, "Sales role is denied finance access");
  assert(canAccessFinance("") === false, "Anonymous/empty role is denied finance access");
  assert(canViewFinance("super_admin") === true, "canViewFinance granted to Super Admin");
  assert(canViewFinance("admin") === false, "canViewFinance denied to Admin");
  assert(canManageFinance("super_admin") === true, "canManageFinance granted to Super Admin");
  assert(canManageFinance("admin") === false, "canManageFinance denied to Admin");

  // 2. SIDEBAR NAVIGATION PROTECTION
  console.log("\n2. Sidebar Navigation Guarding in admin.tsx:");
  const adminLayoutPath = path.resolve(process.cwd(), "src/routes/admin.tsx");
  const adminLayoutSrc = fs.readFileSync(adminLayoutPath, "utf-8");
  assert(
    adminLayoutSrc.includes('{ to: "/admin/finance", labelKey: "admin.finance", defaultLabel: "Finance", Icon: Landmark, superAdminOnly: true, section: "operations" }'),
    "Finance link in sidebar is explicitly marked superAdminOnly: true"
  );
  assert(
    adminLayoutSrc.includes("if (item.superAdminOnly && !isSuperAdmin) return false;"),
    "Sidebar filters out superAdminOnly items when isSuperAdmin is false"
  );

  // 3. ROUTE LEVEL PROTECTION IN admin.finance.tsx
  console.log("\n3. Route Guard & Data Leakage Protection in admin.finance.tsx:");
  const financeRoutePath = path.resolve(process.cwd(), "src/routes/admin.finance.tsx");
  const financeRouteSrc = fs.readFileSync(financeRoutePath, "utf-8");
  assert(
    financeRouteSrc.includes("if (!isSuperAdmin)"),
    "Finance page has strict !isSuperAdmin shield"
  );
  assert(
    financeRouteSrc.includes("Restricted Financial Area"),
    "Controlled access denied experience rendered for unauthorized visits"
  );
  assert(
    financeRouteSrc.includes("if (!isSuperAdmin) return;") && financeRouteSrc.includes("loadFinance"),
    "Data loading is aborted immediately if not super admin (no data leakage)"
  );

  // 4. INFLOW BUG RESOLUTION & ARCHITECTURAL EQUIVALENCE
  console.log("\n4. Inflow Bug Resolution & Architectural Parity:");
  const recordIncomeModalPath = path.resolve(process.cwd(), "src/components/admin/finance/RecordIncomeModal.tsx");
  assert(fs.existsSync(recordIncomeModalPath), "RecordIncomeModal.tsx exists");
  const recordIncomeSrc = fs.readFileSync(recordIncomeModalPath, "utf-8");
  assert(
    recordIncomeSrc.includes("export function RecordIncomeModal"),
    "RecordIncomeModal exports proper SADA dialog component"
  );
  assert(
    recordIncomeSrc.includes("createIncome") && recordIncomeSrc.includes("updateIncome"),
    "RecordIncomeModal integrates createIncome and updateIncome data layer"
  );
  assert(
    financeRouteSrc.includes("const [openNewIncome, setOpenNewIncome] = useState(false);"),
    "admin.finance.tsx maintains openNewIncome modal state"
  );
  assert(
    financeRouteSrc.includes("<RecordIncomeModal") && financeRouteSrc.includes("isOpen={openNewIncome}"),
    "admin.finance.tsx renders RecordIncomeModal with proper props"
  );
  assert(
    financeRouteSrc.includes('value="inflows"') && financeRouteSrc.includes("<IncomeTable"),
    "admin.finance.tsx contains dedicated Inflows tab rendering IncomeTable"
  );

  // 5. OUTFLOW 5-SECTION MODAL HIERARCHY
  console.log("\n5. Outflow Modal 5-Section Hierarchy:");
  const recordExpenseModalPath = path.resolve(process.cwd(), "src/components/admin/finance/RecordExpenseModal.tsx");
  assert(fs.existsSync(recordExpenseModalPath), "RecordExpenseModal.tsx exists");
  const recordExpenseSrc = fs.readFileSync(recordExpenseModalPath, "utf-8");
  assert(recordExpenseSrc.includes("A. Transaction Core"), "Section A: Transaction Core present");
  assert(recordExpenseSrc.includes("B. Classification & Attribution"), "Section B: Classification & Attribution present");
  assert(recordExpenseSrc.includes("C. Status & Reference"), "Section C: Status & Reference present");
  assert(recordExpenseSrc.includes("D. Recurrence"), "Section D: Recurrence present");
  assert(recordExpenseSrc.includes("E. Documentation & Notes"), "Section E: Documentation & Notes present");
  assert(recordExpenseSrc.includes("SADASwitch"), "Recurrence uses high-contrast SADASwitch");

  // 6. RECURRING SUBSCRIPTION MODAL & STEPPERS
  console.log("\n6. Recurring Subscription Modal & SADANumberStepper:");
  const subViewPath = path.resolve(process.cwd(), "src/components/admin/finance/SubscriptionsView.tsx");
  const subViewSrc = fs.readFileSync(subViewPath, "utf-8");
  assert(subViewSrc.includes("SADANumberStepper"), "SubscriptionsView uses SADANumberStepper for Billing Day");
  assert(subViewSrc.includes("unit=\"day\""), "Billing Day stepper displays unit outside buttons");
  assert(subViewSrc.includes("SADAConfirmDialog"), "SubscriptionsView uses SADAConfirmDialog (no browser confirm)");
  assert(!subViewSrc.includes("confirm("), "No browser confirm() calls in SubscriptionsView");

  // 7. ZERO BROWSER-NATIVE CONTROLS AUDIT
  console.log("\n7. Zero Browser-Native UI Controls in Finance Components:");
  const financeCompDir = path.resolve(process.cwd(), "src/components/admin/finance");
  const files = fs.readdirSync(financeCompDir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));

  let nativeControlsFound = 0;
  for (const file of files) {
    const filePath = path.join(financeCompDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    if (content.includes("from \"@/components/ui/button\"")) {
      console.error(`    Found raw Button in ${file}`);
      nativeControlsFound++;
    }
    if (content.includes("from \"@/components/ui/input\"")) {
      console.error(`    Found raw Input in ${file}`);
      nativeControlsFound++;
    }
    if (content.includes("from \"@/components/ui/textarea\"")) {
      console.error(`    Found raw Textarea in ${file}`);
      nativeControlsFound++;
    }
    if (content.match(/<select[\s>]/)) {
      console.error(`    Found raw <select> in ${file}`);
      nativeControlsFound++;
    }
    if (content.match(/type="checkbox"/)) {
      console.error(`    Found raw checkbox in ${file}`);
      nativeControlsFound++;
    }
    if (content.includes("confirm(")) {
      console.error(`    Found raw confirm() in ${file}`);
      nativeControlsFound++;
    }
    if (content.includes("alert(")) {
      console.error(`    Found raw alert() in ${file}`);
      nativeControlsFound++;
    }
  }

  assert(nativeControlsFound === 0, `Zero browser-native controls in all ${files.length} Finance components`, `${nativeControlsFound} occurrences found`);

  // 8. RESPONSIVE HORIZONTAL NAVIGATION TABS
  console.log("\n8. Navigation & Tabs Layout:");
  assert(
    financeRouteSrc.includes("overflow-x-auto no-scrollbar scroll-smooth"),
    "TabsList uses smooth horizontal scrolling with no-scrollbar"
  );
  assert(
    !financeRouteSrc.includes("flex-wrap gap-1 h-auto"),
    "TabsList does not use flex-wrap that clutters small screens into 3-4 rows"
  );

  // 9. FINANCIAL PERIOD COMPUTATION
  console.log("\n9. Financial Period Computations:");
  const thisMonth = getPresetPeriod("this_month");
  assert(!!thisMonth.startDate && !!thisMonth.endDate, "Preset this_month returns start and end date");
  assert(thisMonth.type === "this_month", "Preset type is this_month");

  console.log("\n==================================================");
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runFinanceAudit().catch((err) => {
  console.error("Audit failed with exception:", err);
  process.exit(1);
});

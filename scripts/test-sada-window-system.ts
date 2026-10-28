/**
 * SADA OS Global Window Presentation System Verification Suite
 * 
 * Validates:
 * 1. Canonical window primitives exist (SADADialog, SADADrawer, SADAConfirmDialog)
 * 2. All canonical size & width variants are exported and configured
 * 3. Canonical GPU-accelerated keyframe animation engine exists in styles.css
 * 4. prefers-reduced-motion accessibility rules exist
 * 5. ZERO native window.confirm() calls remain anywhere in src/
 * 6. Finance Inflow (RecordIncomeModal) uses canonical SADADialog with size="large" and sticky footer
 * 7. Finance Outflow (RecordExpenseModal) uses canonical SADADialog with size="large" and sticky footer
 * 8. Package Catalog & Editor (admin.packages) uses canonical SADADrawer and SADAConfirmDialog
 * 9. Account workflows (CreateAccountModal, AccountDetailsDrawer) use canonical SADADialog and SADADrawer
 * 10. Task workflows & Detail Modals use canonical SADAConfirmDialog and no nested modals
 * 11. Lead Conversion (ConvertToProjectModal) uses canonical SADADialog
 * 12. CRUD system (CrudPage) uses canonical SADADialog and SADAConfirmDialog
 */

import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(process.cwd(), "src");

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".css")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

let passedChecks = 0;
let totalChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedChecks++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log("\n========================================================");
console.log("   SADA OS GLOBAL WINDOW PRESENTATION SYSTEM VERIFICATION");
console.log("========================================================\n");

// ---------------------------------------------------------------------------
// 1. Primitive Existence & Exports
// ---------------------------------------------------------------------------
console.log("Step 1: Canonical Window Layer Primitives & Exports");

const sadaDialogPath = path.join(SRC_DIR, "components/ui/sada-dialog.tsx");
const sadaDrawerPath = path.join(SRC_DIR, "components/ui/sada-drawer.tsx");
const sadaConfirmPath = path.join(SRC_DIR, "components/ui/sada-confirm-dialog.tsx");
const sadaUiIndexPath = path.join(SRC_DIR, "components/ui/sada-ui.ts");

assert(fs.existsSync(sadaDialogPath), "sada-dialog.tsx exists");
assert(fs.existsSync(sadaDrawerPath), "sada-drawer.tsx exists");
assert(fs.existsSync(sadaConfirmPath), "sada-confirm-dialog.tsx exists");
assert(fs.existsSync(sadaUiIndexPath), "sada-ui.ts central export exists");

const sadaUiContent = fs.readFileSync(sadaUiIndexPath, "utf8");
assert(sadaUiContent.includes("SADADialog"), "sada-ui.ts exports SADADialog");
assert(sadaUiContent.includes("SADADrawer"), "sada-ui.ts exports SADADrawer");
assert(sadaUiContent.includes("SADAConfirmDialog"), "sada-ui.ts exports SADAConfirmDialog");

// ---------------------------------------------------------------------------
// 2. Variant Completeness
// ---------------------------------------------------------------------------
console.log("\nStep 2: Canonical Sizing & Variant Completeness");

const dialogContent = fs.readFileSync(sadaDialogPath, "utf8");
assert(dialogContent.includes("micro:") && dialogContent.includes("420px"), "SADADialog supports size='micro' (~420px)");
assert(dialogContent.includes("compact:") && dialogContent.includes("520px"), "SADADialog supports size='compact' (~520px)");
assert(dialogContent.includes("default:") && dialogContent.includes("640px"), "SADADialog supports size='default' (~640px)");
assert(dialogContent.includes("large:") && dialogContent.includes("820px"), "SADADialog supports size='large' (~820px)");
assert(dialogContent.includes("xl:") && dialogContent.includes("960px"), "SADADialog supports size='xl' (~960px)");

const drawerContent = fs.readFileSync(sadaDrawerPath, "utf8");
assert(drawerContent.includes("sm:") && drawerContent.includes("max-w-md"), "SADADrawer supports width='sm'");
assert(drawerContent.includes("default:") && drawerContent.includes("max-w-lg"), "SADADrawer supports width='default'");
assert(drawerContent.includes("lg:") && drawerContent.includes("max-w-xl"), "SADADrawer supports width='lg'");
assert(drawerContent.includes("xl:") && drawerContent.includes("max-w-2xl"), "SADADrawer supports width='xl'");
assert((drawerContent.includes('"2xl":') || drawerContent.includes("2xl:")) && drawerContent.includes("max-w-3xl"), "SADADrawer supports width='2xl'");
assert(drawerContent.includes("placement") || drawerContent.includes("side"), "SADADrawer supports configurable drawer placement");

// ---------------------------------------------------------------------------
// 3. Animation Engine & Reduced Motion
// ---------------------------------------------------------------------------
console.log("\nStep 3: Canonical Keyframe Motion & Accessibility");

const stylesCssPath = path.join(SRC_DIR, "styles.css");
const stylesCss = fs.readFileSync(stylesCssPath, "utf8");

assert(stylesCss.includes("@keyframes sada-overlay-in"), "styles.css defines sada-overlay-in keyframes");
assert(stylesCss.includes("@keyframes sada-overlay-out"), "styles.css defines sada-overlay-out keyframes");
assert(stylesCss.includes("@keyframes sada-dialog-in"), "styles.css defines sada-dialog-in keyframes");
assert(stylesCss.includes("@keyframes sada-dialog-out"), "styles.css defines sada-dialog-out keyframes");
assert(stylesCss.includes("@keyframes sada-drawer-in-right"), "styles.css defines sada-drawer-in-right keyframes");
assert(stylesCss.includes("@keyframes sada-drawer-out-right"), "styles.css defines sada-drawer-out-right keyframes");
assert(stylesCss.includes("@keyframes sada-drawer-in-bottom"), "styles.css defines sada-drawer-in-bottom keyframes");
assert(stylesCss.includes("@keyframes sada-drawer-out-bottom"), "styles.css defines sada-drawer-out-bottom keyframes");
assert(stylesCss.includes("prefers-reduced-motion: reduce"), "styles.css provides prefers-reduced-motion overrides");

// ---------------------------------------------------------------------------
// 4. Codebase-wide Native confirm() Eradication
// ---------------------------------------------------------------------------
console.log("\nStep 4: Zero Native confirm() Invocations in src/");

const allFiles = walkDir(SRC_DIR);
const confirmViolations: string[] = [];

// Matches confirm( or window.confirm(
const confirmRegex = /\b(window\.)?confirm\s*\(/g;

for (const file of allFiles) {
  if (file.endsWith(".ts") || file.endsWith(".tsx")) {
    const raw = fs.readFileSync(file, "utf8");
    // Strip comments
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    if (confirmRegex.test(stripped)) {
      confirmViolations.push(path.relative(process.cwd(), file).replace(/\\/g, "/"));
    }
  }
}

assert(confirmViolations.length === 0, `ZERO native confirm() calls found in src/ (violations: ${confirmViolations.length})`);
if (confirmViolations.length > 0) {
  console.error("  Violating files:", confirmViolations);
}

// ---------------------------------------------------------------------------
// 5. Finance Workflows (Inflow & Outflow)
// ---------------------------------------------------------------------------
console.log("\nStep 5: Finance Modal Architecture");

const incomeModalPath = path.join(SRC_DIR, "components/admin/finance/RecordIncomeModal.tsx");
const expenseModalPath = path.join(SRC_DIR, "components/admin/finance/RecordExpenseModal.tsx");

const incomeContent = fs.readFileSync(incomeModalPath, "utf8");
assert(incomeContent.includes("<SADADialog"), "RecordIncomeModal uses SADADialog");
assert(incomeContent.includes('size="large"'), "RecordIncomeModal uses size='large'");
assert(incomeContent.includes("footer="), "RecordIncomeModal uses sticky action footer");
assert(incomeContent.includes('form="record-income-form"'), "RecordIncomeModal footer triggers form submission via form id");

const expenseContent = fs.readFileSync(expenseModalPath, "utf8");
assert(expenseContent.includes("<SADADialog"), "RecordExpenseModal uses SADADialog");
assert(expenseContent.includes('size="large"'), "RecordExpenseModal uses size='large'");
assert(expenseContent.includes("footer="), "RecordExpenseModal uses sticky action footer");
assert(expenseContent.includes('form="record-expense-form"'), "RecordExpenseModal footer triggers form submission via form id");

// ---------------------------------------------------------------------------
// 6. Package Catalog & Package Editor
// ---------------------------------------------------------------------------
console.log("\nStep 6: Package Catalog & Editor Architecture");

const packagesPath = path.join(SRC_DIR, "routes/admin.packages.tsx");
const packagesContent = fs.readFileSync(packagesPath, "utf8");

assert(packagesContent.includes("<SADADrawer"), "Package Editor uses SADADrawer instead of heavy centered modal");
assert(packagesContent.includes('width="2xl"'), "Package Editor uses width='2xl'");
assert(packagesContent.includes("SADAConfirmDialog"), "Package management uses SADAConfirmDialog for archive/delete");
assert(!packagesContent.includes("confirm("), "Package management has zero window.confirm() calls");

// ---------------------------------------------------------------------------
// 7. Accounts Management Architecture
// ---------------------------------------------------------------------------
console.log("\nStep 7: Accounts Management Architecture");

const createAccountPath = path.join(SRC_DIR, "components/admin/accounts/CreateAccountModal.tsx");
const accountDetailsPath = path.join(SRC_DIR, "components/admin/accounts/AccountDetailsDrawer.tsx");
const dangerZonePath = path.join(SRC_DIR, "components/admin/accounts/AccountDangerZone.tsx");

const createAccountContent = fs.readFileSync(createAccountPath, "utf8");
assert(createAccountContent.includes("<SADADialog"), "CreateAccountModal uses SADADialog");
assert(createAccountContent.includes('size="default"'), "CreateAccountModal uses size='default'");

const accountDetailsContent = fs.readFileSync(accountDetailsPath, "utf8");
assert(accountDetailsContent.includes("<SADADrawer"), "AccountDetailsDrawer uses SADADrawer");
assert(accountDetailsContent.includes('width="2xl"'), "AccountDetailsDrawer uses width='2xl'");
assert(accountDetailsContent.includes("<SADADialog"), "AccountDetailsDrawer uses SADADialog for Role Impact Confirmation (no z-60 stacking)");

const dangerZoneContent = fs.readFileSync(dangerZonePath, "utf8");
assert(dangerZoneContent.includes("<SADADialog"), "AccountDangerZone uses SADADialog for suspend, reactivate, and delete confirmations");

// ---------------------------------------------------------------------------
// 8. Task & Deliverable Workflows (No Nested Modals)
// ---------------------------------------------------------------------------
console.log("\nStep 8: Task & Deliverable Presentation System");

const taskModalPath = path.join(SRC_DIR, "components/admin/TaskModal.tsx");
const taskDetailPath = path.join(SRC_DIR, "components/admin/TaskDetailModal.tsx");
const calendarPath = path.join(SRC_DIR, "routes/admin.calendar.tsx");

const taskModalContent = fs.readFileSync(taskModalPath, "utf8");
assert(taskModalContent.includes("SADAConfirmDialog"), "TaskModal uses SADAConfirmDialog for permanent task deletion");
assert(taskModalContent.includes("sada-dialog-in"), "TaskModal uses canonical sada-dialog-in animation");
assert(!taskModalContent.includes("confirm("), "TaskModal has zero window.confirm() calls");

const taskDetailContent = fs.readFileSync(taskDetailPath, "utf8");
assert(taskDetailContent.includes("SADAConfirmDialog"), "TaskDetailModal uses SADAConfirmDialog for deliverable deletion");
assert(taskDetailContent.includes("sada-dialog-in"), "TaskDetailModal uses canonical sada-dialog-in animation");
assert(!taskDetailContent.includes("confirm("), "TaskDetailModal has zero window.confirm() calls");

const calendarContent = fs.readFileSync(calendarPath, "utf8");
assert(calendarContent.includes("<SADADialog"), "Calendar uses SADADialog for project selection");
// Verify that TaskModal is NOT rendered inside a modal div
assert(!calendarContent.includes('<div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-3xl elevated-shadow w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 fade-in">\n            <div className="px-6 pt-5 pb-0">\n              <ProjectPicker'), "Calendar eliminated nested modal container around TaskModal");

// ---------------------------------------------------------------------------
// 9. Lead Conversion & CRUD System
// ---------------------------------------------------------------------------
console.log("\nStep 9: Lead Conversion & CRUD Standardization");

const convertModalPath = path.join(SRC_DIR, "components/admin/ConvertToProjectModal.tsx");
const crudPagePath = path.join(SRC_DIR, "components/admin/CrudPage.tsx");
const contactRoutePath = path.join(SRC_DIR, "routes/admin.contact.tsx");

const convertModalContent = fs.readFileSync(convertModalPath, "utf8");
assert(convertModalContent.includes("<SADADialog"), "ConvertToProjectModal uses SADADialog");
assert(convertModalContent.includes('size="large"'), "ConvertToProjectModal uses size='large'");

const crudPageContent = fs.readFileSync(crudPagePath, "utf8");
assert(crudPageContent.includes("<SADADialog"), "CrudPage uses SADADialog");
assert(crudPageContent.includes("<SADAConfirmDialog"), "CrudPage uses SADAConfirmDialog");
assert(!crudPageContent.includes("confirm("), "CrudPage has zero window.confirm() calls");

const contactContent = fs.readFileSync(contactRoutePath, "utf8");
assert(contactContent.includes("<SADAConfirmDialog"), "admin.contact.tsx uses SADAConfirmDialog for inquiry deletion");
assert(!contactContent.includes("confirm("), "admin.contact.tsx has zero window.confirm() calls");

// ---------------------------------------------------------------------------
// Final Report
// ---------------------------------------------------------------------------
console.log("\n========================================================");
console.log(`   TEST RESULT: ${passedChecks}/${totalChecks} CHECKS PASSED`);
console.log("========================================================\n");

if (passedChecks === totalChecks) {
  console.log("SUCCESS: SADA OS Global Window Presentation System is 100% compliant.\n");
  process.exit(0);
} else {
  console.error(`FAILURE: ${totalChecks - passedChecks} check(s) failed.\n`);
  process.exit(1);
}

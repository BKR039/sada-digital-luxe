import { readFileSync } from "fs";
import { resolve } from "path";

console.log("=== SADA ADMIN SHELL & SIDEBAR RESTORATION VERIFICATION ===\n");

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

// 1. Inspect src/styles.css
const stylesPath = resolve(process.cwd(), "src/styles.css");
const stylesCss = readFileSync(stylesPath, "utf-8");

assert(stylesCss.includes(".admin-shell"), "styles.css defines .admin-shell");
assert(stylesCss.includes(".admin-sidebar"), "styles.css defines .admin-sidebar");
assert(stylesCss.includes(".admin-main"), "styles.css defines .admin-main");

// Verify stable desktop dimensions
assert(stylesCss.includes("width: 280px !important") && stylesCss.includes("flex-shrink: 0 !important"), "Desktop sidebar has fixed non-shrinking 280px width");
assert(stylesCss.includes("flex: 1 1 0% !important") && stylesCss.includes("min-width: 0 !important"), "Main content has flex: 1 and min-width: 0 to prevent card/table blowout");

// Verify desktop persistence (cannot be translated or fixed on desktop)
assert(stylesCss.includes("@media (min-width: 768px)") && stylesCss.includes("transform: none !important"), "Desktop media query explicitly enforces transform: none !important");
assert(stylesCss.includes("position: relative !important") && stylesCss.includes("visibility: visible !important"), "Desktop media query enforces position: relative and visibility: visible");

// Verify RTL & logical properties
assert(stylesCss.includes("border-inline-end: 1px solid var(--border) !important"), "Sidebar uses logical border-inline-end for automatic LTR/RTL border placement");
assert(stylesCss.includes("inset-inline-start: 0 !important"), "Mobile drawer uses inset-inline-start for automatic LTR/RTL anchor");
assert(stylesCss.includes("[dir=\"rtl\"] .admin-sidebar") && stylesCss.includes("transform: translateX(100%)"), "RTL mobile drawer off-screen translation is translateX(100%)");

// Verify mobile drawer open state
assert(stylesCss.includes(".admin-sidebar.is-open") && stylesCss.includes("transform: translateX(0) !important"), "Mobile drawer slides in with translateX(0) when .is-open");

// 2. Inspect src/routes/admin.tsx
const adminRoutePath = resolve(process.cwd(), "src/routes/admin.tsx");
const adminCode = readFileSync(adminRoutePath, "utf-8");

assert(adminCode.includes('className="admin-shell'), "admin.tsx uses canonical .admin-shell container");
assert(adminCode.includes('id="sada-admin-sidebar"'), "admin.tsx has #sada-admin-sidebar");
assert(adminCode.includes('className={`admin-sidebar p-4 sm:p-5 ${sidebarOpen ? "is-open" : ""}`'), "admin.tsx toggles .is-open on sidebar");
assert(adminCode.includes('id="sada-admin-main"'), "admin.tsx has #sada-admin-main");
assert(adminCode.includes('className="admin-main'), "admin.tsx uses canonical .admin-main");

// Verify hamburger and overlay
assert(adminCode.includes("md:hidden") && adminCode.includes("start-4") && adminCode.includes("setSidebarOpen(!sidebarOpen)"), "Mobile hamburger uses logical start-4 and toggles sidebarOpen");
assert(adminCode.includes("md:hidden fixed inset-0") && adminCode.includes("setSidebarOpen(false)"), "Mobile backdrop overlay closes sidebar on click");

// Verify Theme Switcher inside sidebar
assert(adminCode.includes('t("admin.appearance")'), "Sidebar contains Appearance section");
assert(adminCode.includes('setTheme("light")') && adminCode.includes('setTheme("dark")'), "Sidebar has Light and Dark theme controls");
assert(adminCode.includes("useTheme()"), "Theme switcher uses global ThemeProvider");

// Verify Language Switcher inside sidebar
assert(adminCode.includes('t("admin.language")'), "Sidebar contains Language section");
assert(adminCode.includes('setLanguage("en")') && adminCode.includes('setLanguage("ar")'), "Sidebar has English and Arabic language controls");
assert(adminCode.includes("useTranslation()"), "Language switcher uses global i18nProvider");

// Verify Super Admin routes
assert(adminCode.includes('to: "/admin/finance"') && adminCode.includes("superAdminOnly: true"), "Finance route is registered with superAdminOnly: true");
assert(adminCode.includes('to: "/admin/accounts"') && adminCode.includes("superAdminOnly: true"), "Accounts route is registered with superAdminOnly: true");

// Verify Worker routes
assert(adminCode.includes('to: "/admin/my-salary"') && adminCode.includes("workerVisible: true") && adminCode.includes("workerOnly: true"), "My Salary route is registered for workers");

// Verify child routes inherit the shell
const financePath = resolve(process.cwd(), "src/routes/admin.finance.tsx");
const financeCode = readFileSync(financePath, "utf-8");
assert(financeCode.includes('createFileRoute("/admin/finance")'), "admin.finance.tsx is a sub-route of /admin");
assert(!financeCode.includes("<aside"), "admin.finance.tsx does not define a rogue sidebar or override shell");

const accountsPath = resolve(process.cwd(), "src/routes/admin.accounts.tsx");
const accountsCode = readFileSync(accountsPath, "utf-8");
assert(accountsCode.includes('createFileRoute("/admin/accounts")'), "admin.accounts.tsx is a sub-route of /admin");
assert(!accountsCode.includes("<aside"), "admin.accounts.tsx does not define a rogue sidebar or override shell");

console.log(`\n==================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

if (failed > 0) process.exit(1);

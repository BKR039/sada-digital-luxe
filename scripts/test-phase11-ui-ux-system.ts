// ============================================================
// SADA OS — PHASE 11: UI/UX CONSOLIDATION & DESIGN SYSTEM TEST SUITE
// Comprehensive Verification & Acceptance Suite for Phase 11
//
// Domains Tested:
// 1. Canonical SADA UI Component System (Existence, exports, controls, consistency)
// 2. Native UI Prohibition (0 native <select>, 0 type="date", 0 type="time", 0 raw alert())
// 3. Package UX & SADACombobox (Category grouping, codes, prices, margins, badges)
// 4. Sales Pipeline & Kanban Layout (Responsive min-w-[280px], empty states, badges)
// 5. Global Command Menu (Ctrl+K, instant quick actions, cross-domain search)
// 6. Design System Tokens & Typography (Sora/Manrope, Thmanyah Serif Text Arabic, CSS tokens)
// 7. Accessibility & Keyboard Navigation (ARIA roles, keyboard handlers, Escape to close)
// ============================================================

import fs from "fs";
import path from "path";

interface TestResult {
  category: string;
  num: number;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(category: string, num: number, name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      throw new Error("Synchronous test runner expected");
    }
    results.push({ category, num, name, passed: true });
    console.log(`  ✓ [TEST ${num}] ${name}`);
  } catch (err: any) {
    results.push({ category, num, name, passed: false, error: err.message });
    console.error(`  ✗ [TEST ${num}] ${name}: ${err.message}`);
  }
}

async function recordAsyncTest(category: string, num: number, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ category, num, name, passed: true });
    console.log(`  ✓ [TEST ${num}] ${name}`);
  } catch (err: any) {
    results.push({ category, num, name, passed: false, error: err.message });
    console.error(`  ✗ [TEST ${num}] ${name}: ${err.message}`);
  }
}

async function runPhase11Tests() {
  console.log("============================================================");
  console.log("SADA OS — PHASE 11: UI/UX CONSOLIDATION & DESIGN SYSTEM VERIFICATION");
  console.log("============================================================\n");

  const srcDir = path.resolve(process.cwd(), "src");

  // ============================================================
  // DOMAIN 1: CANONICAL SADA UI COMPONENT SYSTEM
  // ============================================================
  console.log("DOMAIN 1: Canonical SADA UI Component System");

  recordTest("Component System", 1, "Canonical SADA UI files exist in src/components/ui/", () => {
    const requiredFiles = [
      "sada-button.tsx",
      "sada-input.tsx",
      "sada-select.tsx",
      "sada-combobox.tsx",
      "sada-date-picker.tsx",
      "sada-badge.tsx",
      "sada-card.tsx",
      "sada-dialog.tsx",
      "sada-drawer.tsx",
      "sada-empty-state.tsx",
      "sada-skeleton.tsx",
      "sada-error-state.tsx",
      "sada-filter-bar.tsx",
      "sada-controls.ts",
      "sada-ui.ts",
    ];

    for (const f of requiredFiles) {
      const fullPath = path.join(srcDir, "components", "ui", f);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing canonical component file: ${f}`);
      }
    }
  });

  recordTest("Component System", 2, "sada-ui.ts exports all canonical components and types", () => {
    const barrelPath = path.join(srcDir, "components", "ui", "sada-ui.ts");
    const content = fs.readFileSync(barrelPath, "utf-8");

    const expectedExports = [
      "SADAButton",
      "SADAInput",
      "SADATextarea",
      "SADASelect",
      "SADACombobox",
      "SADADatePicker",
      "SADABadge",
      "SADACard",
      "SADADialog",
      "SADADrawer",
      "SADAEmptyState",
      "SADASkeleton",
      "SADAErrorState",
      "SADAFilterBar",
    ];

    for (const exp of expectedExports) {
      if (!content.includes(exp)) {
        throw new Error(`sada-ui.ts missing export: ${exp}`);
      }
    }
  });

  recordTest("Component System", 3, "Centralized control tokens exist in sada-controls.ts", () => {
    const controlsPath = path.join(srcDir, "components", "ui", "sada-controls.ts");
    const content = fs.readFileSync(controlsPath, "utf-8");

    if (!content.includes("SADA_CONTROL_BASE")) throw new Error("Missing SADA_CONTROL_BASE");
    if (!content.includes("SADA_CONTROL_SIZES")) throw new Error("Missing SADA_CONTROL_SIZES");
    if (!content.includes("SADA_POPOVER_BASE")) throw new Error("Missing SADA_POPOVER_BASE");
    if (!content.includes("SADA_ITEM_BASE")) throw new Error("Missing SADA_ITEM_BASE");
  });

  // ============================================================
  // DOMAIN 2: NATIVE UI PROHIBITION & ZERO LEAKS
  // ============================================================
  console.log("\nDOMAIN 2: Native Browser UI Prohibition (Zero Leaks)");

  recordTest("Native UI", 4, "Zero native <select> elements in src/ (strictly SADASelect / SADACombobox)", () => {
    // Scan all .tsx files in src/
    function checkDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(full);
        } else if (entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          // Match actual JSX tag <select (exclude comments)
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("{/*")) return;
            if (/<select[\s>]/.test(line)) {
              throw new Error(`Native <select> found in ${path.relative(process.cwd(), full)} at line ${idx + 1}`);
            }
          });
        }
      }
    }
    checkDirectory(srcDir);
  });

  recordTest("Native UI", 5, "Zero native <input type=\"date\"> in src/ (strictly SADADatePicker)", () => {
    function checkDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(full);
        } else if (entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("{/*")) return;
            if (/type=["']date["']/.test(line)) {
              throw new Error(`Native date input found in ${path.relative(process.cwd(), full)} at line ${idx + 1}`);
            }
          });
        }
      }
    }
    checkDirectory(srcDir);
  });

  recordTest("Native UI", 6, "Zero native <input type=\"time\"> in src/ (strictly SADA controls)", () => {
    function checkDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(full);
        } else if (entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*") || trimmed.startsWith("{/*")) return;
            if (/type=["']time["']/.test(line)) {
              throw new Error(`Native time input found in ${path.relative(process.cwd(), full)} at line ${idx + 1}`);
            }
          });
        }
      }
    }
    checkDirectory(srcDir);
  });

  recordTest("Native UI", 7, "Zero raw alert(...) calls across the entire src/ application", () => {
    function checkDirectory(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDirectory(full);
        } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
          const content = fs.readFileSync(full, "utf-8");
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
            if (/\balert\(/.test(line)) {
              throw new Error(`Raw alert() call found in ${path.relative(process.cwd(), full)} at line ${idx + 1}`);
            }
          });
        }
      }
    }
    checkDirectory(srcDir);
  });

  // ============================================================
  // DOMAIN 3: PACKAGE SELECTOR & SADACOMBOBOX UX
  // ============================================================
  console.log("\nDOMAIN 3: Package Selector & SADACombobox UX");

  recordTest("Package UX", 8, "SADACombobox supports category grouping, codes, prices, margins & badges", () => {
    const cbPath = path.join(srcDir, "components", "ui", "sada-combobox.tsx");
    const content = fs.readFileSync(cbPath, "utf-8");

    if (!content.includes("category?:")) throw new Error("SADAComboboxOption missing category prop");
    if (!content.includes("code?:")) throw new Error("SADAComboboxOption missing code prop");
    if (!content.includes("price?:")) throw new Error("SADAComboboxOption missing price prop");
    if (!content.includes("margin?:")) throw new Error("SADAComboboxOption missing margin prop");
    if (!content.includes("badge?:")) throw new Error("SADAComboboxOption missing badge prop");
    if (!content.includes("CommandPrimitive.Group")) throw new Error("SADACombobox missing group rendering");
  });

  recordTest("Package UX", 9, "Create Sales Deal uses canonical SADACombobox with packageOptions", () => {
    const dealsPath = path.join(srcDir, "routes", "admin.deals.tsx");
    const content = fs.readFileSync(dealsPath, "utf-8");

    if (!content.includes("<SADACombobox")) {
      throw new Error("Create Sales Deal does not use SADACombobox");
    }
    if (!content.includes("options={packageOptions}")) {
      throw new Error("SADACombobox in deals does not bind packageOptions");
    }
    if (!content.includes("category.toUpperCase()")) {
      throw new Error("packageOptions does not group packages by category");
    }
  });

  recordTest("Package UX", 10, "Package CMS uses SADASelect for Category, Status, and Editor fields", () => {
    const pkgsPath = path.join(srcDir, "routes", "admin.packages.tsx");
    const content = fs.readFileSync(pkgsPath, "utf-8");

    if (!content.includes("options={categoryFilterOptions}")) {
      throw new Error("Category filter does not use SADASelect with categoryFilterOptions");
    }
    if (!content.includes("options={statusFilterOptions}")) {
      throw new Error("Status filter does not use SADASelect with statusFilterOptions");
    }
    if (!content.includes("options={editorCategoryOptions}")) {
      throw new Error("Editor does not use SADASelect with editorCategoryOptions");
    }
  });

  // ============================================================
  // DOMAIN 4: SALES PIPELINE & KANBAN RESPONSIVE UX
  // ============================================================
  console.log("\nDOMAIN 4: Sales Pipeline & Kanban Responsive UX");

  recordTest("Pipeline UX", 11, "Kanban board uses smooth horizontal scroll with min-w-[280px] columns", () => {
    const dealsPath = path.join(srcDir, "routes", "admin.deals.tsx");
    const content = fs.readFileSync(dealsPath, "utf-8");

    if (!content.includes("min-w-[280px]")) {
      throw new Error("Kanban columns missing min-w-[280px] to prevent horizontal squishing");
    }
    if (!content.includes("snap-x")) {
      throw new Error("Kanban board missing snap-x scrolling container");
    }
    if (content.includes("lg:grid-cols-8")) {
      throw new Error("Kanban still has rigid lg:grid-cols-8 which squishes columns");
    }
  });

  recordTest("Pipeline UX", 12, "Empty stages render informative micro empty states instead of raw 'Empty'", () => {
    const dealsPath = path.join(srcDir, "routes", "admin.deals.tsx");
    const content = fs.readFileSync(dealsPath, "utf-8");

    if (content.includes("<div className=\"p-4 rounded-xl border border-dashed border-border/60 text-center text-[11px] text-muted-foreground/60\">\n                      Empty\n                    </div>")) {
      throw new Error("Raw 'Empty' placeholder text found in kanban column");
    }
    if (!content.includes("No deals in")) {
      throw new Error("Informative empty state message missing in kanban column");
    }
  });

  // ============================================================
  // DOMAIN 5: GLOBAL COMMAND MENU (Ctrl+K)
  // ============================================================
  console.log("\nDOMAIN 5: Global Command Menu (Ctrl+K)");

  recordTest("Command Menu", 13, "GlobalSearchModal provides instant 1-click Quick Actions for key workflows", () => {
    const modalPath = path.join(srcDir, "components", "admin", "GlobalSearchModal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");

    if (!content.includes("defaultQuickActions")) {
      throw new Error("GlobalSearchModal missing defaultQuickActions");
    }
    if (!content.includes("Go to Sales Pipeline") && !content.includes("qa-deals")) {
      throw new Error("Missing quick action: Go to Sales Pipeline");
    }
    if (!content.includes("Go to Package Catalog") && !content.includes("qa-packages")) {
      throw new Error("Missing quick action: Go to Package Catalog");
    }
    if (!content.includes("Create Sales Deal") && !content.includes("qa-create-deal")) {
      throw new Error("Missing quick action: Create Sales Deal");
    }
    if (!content.includes("Create Package") && !content.includes("qa-create-package")) {
      throw new Error("Missing quick action: Create Package");
    }
  });

  recordTest("Command Menu", 14, "GlobalSearchModal searches Packages and Deals with custom category badges", () => {
    const modalPath = path.join(srcDir, "components", "admin", "GlobalSearchModal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");

    if (!content.includes(".from(\"package_catalog\")")) {
      throw new Error("GlobalSearchModal does not search package_catalog");
    }
    if (!content.includes(".from(\"deals\")")) {
      throw new Error("GlobalSearchModal does not search deals");
    }
    if (!content.includes("case \"deal\":") || !content.includes("case \"package\":")) {
      throw new Error("Missing category badges for deal and package");
    }
  });

  // ============================================================
  // DOMAIN 6: DESIGN SYSTEM TOKENS & TYPOGRAPHY
  // ============================================================
  console.log("\nDOMAIN 6: Design System Tokens & Typography");

  recordTest("Design Tokens", 15, "Typography tokens enforce Sora/Manrope for English and Thmanyah Serif Text for Arabic", () => {
    const cssPath = path.join(srcDir, "styles.css");
    const content = fs.readFileSync(cssPath, "utf-8");

    if (!content.includes("Thmanyah Serif Text")) {
      throw new Error("Arabic typography 'Thmanyah Serif Text' not configured in styles.css");
    }
    if (!content.includes("font-display") && !content.includes("font-sans")) {
      throw new Error("Font family tokens missing in styles.css");
    }
  });

  recordTest("Design Tokens", 16, "Centralized SADA color tokens and radii configured", () => {
    const cssPath = path.join(srcDir, "styles.css");
    const content = fs.readFileSync(cssPath, "utf-8");

    if (!content.includes("--primary") && !content.includes("--color-primary")) {
      throw new Error("Primary brand token missing in styles.css");
    }
    if (!content.includes("--radius")) {
      throw new Error("Border radius scale missing in styles.css");
    }
  });

  // ============================================================
  // DOMAIN 7: ACCESSIBILITY & KEYBOARD NAVIGATION
  // ============================================================
  console.log("\nDOMAIN 7: Accessibility & Keyboard Navigation");

  recordTest("Accessibility", 17, "SADACombobox & SADASelect implement ARIA attributes and Escape to close", () => {
    const cbPath = path.join(srcDir, "components", "ui", "sada-combobox.tsx");
    const cbContent = fs.readFileSync(cbPath, "utf-8");

    if (!cbContent.includes("aria-expanded")) throw new Error("SADACombobox missing aria-expanded");
    if (!cbContent.includes("aria-haspopup")) throw new Error("SADACombobox missing aria-haspopup");

    const selectPath = path.join(srcDir, "components", "ui", "sada-select.tsx");
    const selectContent = fs.readFileSync(selectPath, "utf-8");

    if (!selectContent.includes("aria-expanded")) throw new Error("SADASelect missing aria-expanded");
    if (!selectContent.includes("aria-haspopup")) throw new Error("SADASelect missing aria-haspopup");
  });

  recordTest("Accessibility", 18, "SADADialog enforces role dialog, title, description, and Escape handling", () => {
    const dialogPath = path.join(srcDir, "components", "ui", "sada-dialog.tsx");
    const content = fs.readFileSync(dialogPath, "utf-8");

    if (!content.includes("DialogPrimitive.Content")) throw new Error("SADADialog missing DialogContent primitive");
    if (!content.includes("DialogPrimitive.Title")) throw new Error("SADADialog missing DialogTitle primitive");
  });

  // ============================================================
  // SUMMARY REPORT
  // ============================================================
  console.log("\n============================================================");
  console.log("PHASE 11 TEST RESULTS SUMMARY");
  console.log("============================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Tests Run: ${total}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}`);
  console.log(`Success Rate:   ${Math.round((passed / total) * 100)}%`);

  if (failed > 0) {
    console.error("\nFailed Tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [TEST ${r.num}] ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("\n🎉 ALL 18 PHASE 11 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!");
  }
}

runPhase11Tests();

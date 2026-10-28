/**
 * SADA OS Universal Design System & UX Consistency Test Suite
 * Validates:
 * 1. ZERO native <select> elements in JSX across entire src/
 * 2. ZERO native <input type="checkbox"> elements in JSX across entire src/
 * 3. ZERO native <input type="radio"> elements in JSX across entire src/
 * 4. ZERO raw unstyled <input type="number"> elements in JSX (all must use SADAInput or SADACounter)
 * 5. Complete canonical SADA component export contract (@/components/ui/sada-ui & @/components/sada-ui)
 * 6. Global CSS spinner eradication & RTL support in styles.css
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
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
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

console.log("\n==================================================");
console.log("   SADA OS GLOBAL UI SYSTEM VERIFICATION TEST");
console.log("==================================================\n");

// 1. Scan codebase for prohibited native form controls
console.log("Step 1: Codebase-wide Form Control Audit");

const allSourceFiles = walkDir(SRC_DIR);
console.log(`Auditing ${allSourceFiles.length} source files under src/...`);

const nativeSelectViolations: string[] = [];
const nativeCheckboxViolations: string[] = [];
const nativeRadioViolations: string[] = [];
const rawNumberInputViolations: string[] = [];

// Regex to catch native JSX elements (excluding comments and documentation strings)
const selectRegex = /<select\b[^>]*>/g;
const checkboxRegex = /<input[^>]*type=["']checkbox["'][^>]*>/g;
const radioRegex = /<input[^>]*type=["']radio["'][^>]*>/g;
const rawNumberRegex = /<input[^>]*type=["']number["'][^>]*>/g;

for (const file of allSourceFiles) {
  const content = fs.readFileSync(file, "utf8");
  const relPath = path.relative(process.cwd(), file).replace(/\\/g, "/");

  // Skip component definition files where the wrapper itself might use native controls under the hood
  const isSadaWrapper =
    relPath.includes("components/ui/sada-") ||
    relPath.includes("components/ui/input.tsx") ||
    relPath.includes("components/ui/textarea.tsx") ||
    relPath.includes("components/ui/select.tsx") ||
    relPath.includes("components/ui/checkbox.tsx") ||
    relPath.includes("components/ui/radio-group.tsx") ||
    relPath.includes("components/ui/switch.tsx");

  if (!isSadaWrapper) {
    // Strip multi-line comments and single line comments for accurate inspection
    const strippedContent = content
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*/g, "");

    if (selectRegex.test(strippedContent)) {
      nativeSelectViolations.push(relPath);
    }
    if (checkboxRegex.test(strippedContent)) {
      nativeCheckboxViolations.push(relPath);
    }
    if (radioRegex.test(strippedContent)) {
      nativeRadioViolations.push(relPath);
    }
    if (rawNumberRegex.test(strippedContent)) {
      rawNumberInputViolations.push(relPath);
    }
  }
}

assert(
  nativeSelectViolations.length === 0,
  `ZERO native <select> elements in application UI (found: ${nativeSelectViolations.length}${
    nativeSelectViolations.length > 0 ? " in " + nativeSelectViolations.join(", ") : ""
  })`
);

assert(
  nativeCheckboxViolations.length === 0,
  `ZERO native <input type="checkbox"> in application UI (found: ${nativeCheckboxViolations.length}${
    nativeCheckboxViolations.length > 0 ? " in " + nativeCheckboxViolations.join(", ") : ""
  })`
);

assert(
  nativeRadioViolations.length === 0,
  `ZERO native <input type="radio"> in application UI (found: ${nativeRadioViolations.length}${
    nativeRadioViolations.length > 0 ? " in " + nativeRadioViolations.join(", ") : ""
  })`
);

assert(
  rawNumberInputViolations.length === 0,
  `ZERO raw unstyled <input type="number"> in application UI (found: ${rawNumberInputViolations.length}${
    rawNumberInputViolations.length > 0 ? " in " + rawNumberInputViolations.join(", ") : ""
  })`
);

// 2. Component Export Verification
console.log("\nStep 2: Canonical SADA UI Component Library Exports");

const sadaUiPath = path.join(SRC_DIR, "components", "ui", "sada-ui.ts");
const sadaUiContent = fs.readFileSync(sadaUiPath, "utf8");

const requiredComponents = [
  "SadaButton",
  "SadaInput",
  "SadaTextarea",
  "SadaSelect",
  "SadaMultiSelect",
  "SadaCheckbox",
  "SadaRadio",
  "SadaRadioGroup",
  "SadaSwitch",
  "SadaCounter",
  "SadaNumberStepper",
  "SADANumberStepper",
  "SadaDatePicker",
  "SadaTimePicker",
  "SadaCombobox",
  "SadaSearch",
  "SadaTabs",
  "SadaBadge",
  "SadaModal",
  "SadaDrawer",
  "SadaTooltip",
  "SadaPopover",
  "SadaToast",
  "SadaProgress",
  "SadaEmptyState",
  "SadaConfirmDialog",
];

for (const comp of requiredComponents) {
  const isExported = sadaUiContent.includes(comp);
  assert(isExported, `SADA Design System exports '${comp}'`);
}

// 3. Path Alias Verification
console.log("\nStep 3: Component Re-export Architecture");

const sadaUiIndexPath = path.join(SRC_DIR, "components", "sada-ui", "index.ts");
const hasIndexAlias = fs.existsSync(sadaUiIndexPath);
assert(hasIndexAlias, "src/components/sada-ui/index.ts alias exists");
if (hasIndexAlias) {
  const indexContent = fs.readFileSync(sadaUiIndexPath, "utf8");
  assert(
    indexContent.includes('export * from "../ui/sada-ui"'),
    "src/components/sada-ui/index.ts re-exports canonical UI library"
  );
}

// 4. CSS Spinner Eradication & RTL Verification
console.log("\nStep 4: Global CSS & Spinner Eradication Verification");

const stylesCssPath = path.join(SRC_DIR, "styles.css");
const stylesCssContent = fs.readFileSync(stylesCssPath, "utf8");

assert(
  stylesCssContent.includes("::-webkit-inner-spin-button") &&
    stylesCssContent.includes("appearance: textfield"),
  "Global CSS removes webkit number spinners and sets appearance: textfield"
);

assert(
  stylesCssContent.includes('[dir="rtl"]') || stylesCssContent.includes("rtl:"),
  "Global CSS or tailwind RTL directions configured for bilingual Arabic/English"
);

console.log("\n==================================================");
console.log(`SCORECARD: ${passedChecks}/${totalChecks} CHECKS PASSED`);
console.log("==================================================\n");

if (passedChecks < totalChecks) {
  process.exit(1);
} else {
  console.log("ALL SADA UI SYSTEM CONSISTENCY CHECKS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

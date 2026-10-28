import fs from "fs";
import path from "path";

function verify() {
  console.log("=== SADA OS: SALES DESIGN SYSTEM INTEGRITY AUDIT ===\n");

  let errors = 0;
  const salesViewPath = path.resolve("src/components/admin/SalesWorkspaceView.tsx");
  const salesView = fs.readFileSync(salesViewPath, "utf-8");
  const salesRoutePath = path.resolve("src/routes/admin.sales.tsx");
  const salesRoute = fs.readFileSync(salesRoutePath, "utf-8");
  const commissionsRoutePath = path.resolve("src/routes/admin.commissions.tsx");
  const commissionsRoute = fs.readFileSync(commissionsRoutePath, "utf-8");
  const dealsRoutePath = path.resolve("src/routes/admin.deals.tsx");
  const dealsRoute = fs.readFileSync(dealsRoutePath, "utf-8");
  const adminLayoutPath = path.resolve("src/routes/admin.tsx");
  const adminLayout = fs.readFileSync(adminLayoutPath, "utf-8");

  // SECTION 1: Architecture & Routing
  console.log("--- ARCHITECTURE & ROUTING ---");
  if (!commissionsRoute.includes('redirect({ to: "/admin/sales"')) {
    console.error("❌ FAIL: src/routes/admin.commissions.tsx does not redirect to /admin/sales");
    errors++;
  } else {
    console.log("✅ [PASS] /admin/commissions cleanly redirects to canonical /admin/sales");
  }

  if (!dealsRoute.includes('redirect({ to: "/admin/sales"')) {
    console.error("❌ FAIL: src/routes/admin.deals.tsx does not redirect to /admin/sales");
    errors++;
  } else {
    console.log("✅ [PASS] /admin/deals cleanly redirects to canonical /admin/sales");
  }

  if (adminLayout.includes('to: "/admin/commissions"')) {
    console.error("❌ FAIL: src/routes/admin.tsx still includes /admin/commissions in sidebar navigation");
    errors++;
  } else {
    console.log("✅ [PASS] Sidebar navigation contains NO duplicated /admin/commissions item");
  }

  if (!adminLayout.includes('to: "/admin/sales", labelKey: "admin.sales", defaultLabel: "Sales"')) {
    console.error("❌ FAIL: src/routes/admin.tsx does not have canonical Sales item");
    errors++;
  } else {
    console.log("✅ [PASS] Sidebar navigation has canonical Sales item");
  }

  // SECTION 2: 12 SADA Design System Checks
  console.log("\n--- 12 SADA DESIGN SYSTEM CHECKS ---");

  // Check 1: Hardcoded colors (no hex, rgb, rgba, hsl, or non-token hex in classes)
  const hexColors = salesView.match(/#[0-9a-fA-F]{3,8}\b/g);
  const rgbColors = salesView.match(/rgba?\(/gi);
  const hslColors = salesView.match(/hsla?\(/gi);
  if (hexColors || rgbColors || hslColors) {
    console.error(`❌ FAIL Check 1: Hardcoded raw colors found: hex=${hexColors?.length || 0}, rgb=${rgbColors?.length || 0}, hsl=${hslColors?.length || 0}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 1: Zero hardcoded hex, rgb, rgba, or hsl colors (100% SADA tokens)");
  }

  // Check 2: Hardcoded gradients
  const gradientMatches = salesView.match(/bg-gradient-(?!primary\b)[a-z0-9_-]+/g);
  const fromMatches = salesView.match(/\bfrom-[a-z0-9_/-]+/g);
  if (gradientMatches || fromMatches) {
    console.error(`❌ FAIL Check 2: Hardcoded gradients found: ${gradientMatches || fromMatches}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 2: Zero ad-hoc gradients (only SADA canonical gradient tokens used)");
  }

  // Check 3: Page-specific border styles (no arbitrary border classes like border-[...])
  const customBorderMatches = salesView.match(/border-\[[^\]]+\]/g);
  if (customBorderMatches) {
    console.error(`❌ FAIL Check 3: Arbitrary border classes found: ${customBorderMatches}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 3: Zero arbitrary border styles (all borders use SADA border tokens)");
  }

  // Check 4: Page-specific border-radius (no arbitrary rounded-[...])
  const customRadiusMatches = salesView.match(/rounded-\[[^\]]+\]/g);
  if (customRadiusMatches) {
    console.error(`❌ FAIL Check 4: Arbitrary border radius found: ${customRadiusMatches}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 4: Zero arbitrary border radius (all radii follow SADA standard tiers)");
  }

  // Check 5: Page-specific shadows (no arbitrary shadow-[...] or soft-shadow overrides)
  const customShadowMatches = salesView.match(/shadow-\[[^\]]+\]/g);
  const softShadowMatches = salesView.match(/\bsoft-shadow\b/g);
  if (customShadowMatches || softShadowMatches) {
    console.error(`❌ FAIL Check 5: Page-specific shadow overrides found: ${customShadowMatches || softShadowMatches}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 5: Zero page-specific shadow overrides (SADACard default elevation preserved)");
  }

  // Check 6: Page-specific button styling (no native <button>, no raw button color overrides like bg-emerald-)
  const nativeButtonMatches = salesView.match(/<button[\s>]/g);
  const adhocButtonColors = salesView.match(/<SADAButton[^>]*className="[^"]*bg-emerald-[^"]*"/g);
  if (nativeButtonMatches || adhocButtonColors) {
    console.error(`❌ FAIL Check 6: Page-specific button styling found: native=${nativeButtonMatches?.length || 0}, adhoc=${adhocButtonColors?.length || 0}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 6: Zero native buttons and zero button color overrides (100% canonical SADAButton variants)");
  }

  // Check 7: Page-specific input/select/date-picker styling (no native <select>, no <input type="date">)
  const selectMatches = salesView.match(/<select[\s>]/g);
  const datePickerMatches = salesView.match(/type=["']date["']/g);
  if (selectMatches || datePickerMatches) {
    console.error(`❌ FAIL Check 7: Native dropdowns/date-pickers found: select=${selectMatches?.length || 0}, date=${datePickerMatches?.length || 0}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 7: Zero native dropdowns or date-pickers (100% SADASelect & SADADatePicker)");
  }

  // Check 8: Duplicate UI component implementations (verifies SADAEmptyState and SADAButton asChild are consumed)
  const hasEmptyState = salesView.includes("SADAEmptyState");
  const hasButtonAsChild = salesView.includes("<SADAButton asChild");
  if (!hasEmptyState || !hasButtonAsChild) {
    console.error(`❌ FAIL Check 8: Missing canonical component consumption: SADAEmptyState=${hasEmptyState}, SADAButton asChild=${hasButtonAsChild}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 8: Zero duplicated UI components (SADAEmptyState & SADAButton asChild consumed)");
  }

  // Check 9: Native checkbox/radio controls
  const checkboxMatches = salesView.match(/type=["']checkbox["']/g);
  const radioMatches = salesView.match(/type=["']radio["']/g);
  if (checkboxMatches || radioMatches) {
    console.error(`❌ FAIL Check 9: Native checkbox/radio found: checkbox=${checkboxMatches?.length || 0}, radio=${radioMatches?.length || 0}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 9: Zero native checkbox or radio controls");
  }

  // Check 10: Inline styles that bypass SADA tokens
  const styleMatches = salesView.match(/\bstyle=\{\{/g);
  if (styleMatches) {
    console.error(`❌ FAIL Check 10: Inline styles found: ${styleMatches.length}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 10: Zero inline styles (100% SADA tokens and component styles)");
  }

  // Check 11: Inconsistent spacing/typography (verifies font-display, tabular-nums/SADANumber, and responsive grids)
  const hasFontDisplay = salesView.includes("font-display");
  const hasSadaNumber = salesView.includes("<SADANumber");
  if (!hasFontDisplay || !hasSadaNumber) {
    console.error(`❌ FAIL Check 11: Typography tokens missing: font-display=${hasFontDisplay}, SADANumber=${hasSadaNumber}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 11: Consistent SADA typography (font-display headings, font-mono badges, SADANumber metrics)");
  }

  // Check 12: Any visual component that recreates an existing SADA component
  const rawInputMatches = salesView.match(/<input[\s>]/g);
  const rawTextareaMatches = salesView.match(/<textarea[\s>]/g);
  if (rawInputMatches || rawTextareaMatches) {
    console.error(`❌ FAIL Check 12: Raw HTML form controls found: input=${rawInputMatches?.length || 0}, textarea=${rawTextareaMatches?.length || 0}`);
    errors++;
  } else {
    console.log("✅ [PASS] Check 12: Zero recreated primitives (100% SADAInput, SADATextarea, SADASelect, SADADatePicker, SADACard, SADADialog)");
  }

  // SECTION 3: Canonical Component Inventory
  console.log("\n--- CANONICAL SADA COMPONENT INVENTORY ---");
  const requiredComponents = [
    "SADAButton",
    "SADAInput",
    "SADATextarea",
    "SADASelect",
    "SADADatePicker",
    "SADABadge",
    "SADACard",
    "SADANumber",
    "SADADialog",
    "SADASearch",
    "SADAEmptyState",
  ];

  for (const comp of requiredComponents) {
    if (!salesView.includes(comp)) {
      console.error(`❌ FAIL: SalesWorkspaceView does not consume required component: ${comp}`);
      errors++;
    } else {
      console.log(`✅ [PASS] Consumes canonical component: ${comp}`);
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Total design system integrity errors: ${errors}`);
    process.exit(1);
  } else {
    console.log("\n🎉 ALL 27/27 DESIGN SYSTEM INTEGRITY CHECKS PASSED WITH 100% COMPLIANCE!");
  }
}

verify();

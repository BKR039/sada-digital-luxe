import fs from "node:fs";
import path from "node:path";

console.log("==================================================");
console.log("VERIFYING SADA OS PREMIUM SKELETON LOADING SYSTEM");
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

// 1. Verify CSS rules in src/styles.css
const stylesPath = path.resolve("src/styles.css");
const stylesContent = fs.readFileSync(stylesPath, "utf-8");

assert(stylesContent.includes("@keyframes sada-shimmer"), "CSS contains @keyframes sada-shimmer");
assert(stylesContent.includes(".sada-skeleton-shimmer"), "CSS contains .sada-skeleton-shimmer");
assert(stylesContent.includes("--sada-skeleton-base"), "CSS contains --sada-skeleton-base CSS variable");
assert(stylesContent.includes("--sada-skeleton-shimmer-highlight"), "CSS contains --sada-skeleton-shimmer-highlight CSS variable");
assert(stylesContent.includes("prefers-reduced-motion: reduce"), "CSS contains prefers-reduced-motion: reduce accessibility query");

// 2. Verify primitives in src/components/ui/sada-skeleton.tsx
const skeletonPath = path.resolve("src/components/ui/sada-skeleton.tsx");
const skeletonContent = fs.readFileSync(skeletonPath, "utf-8");

const expectedPrimitives = [
  "Skeleton",
  "SkeletonText",
  "SkeletonTitle",
  "SkeletonAvatar",
  "SkeletonButton",
  "SkeletonCard",
  "SkeletonMetric",
  "SkeletonTable",
  "SkeletonRow",
  "SkeletonChart",
  "SkeletonList",
  "SkeletonPageHeader",
  "SADAContentTransition",
];

for (const prim of expectedPrimitives) {
  assert(
    skeletonContent.includes(`export const ${prim}`) || skeletonContent.includes(`export function ${prim}`),
    `Primitive '${prim}' is exported in sada-skeleton.tsx`
  );
}

// 3. Verify Accessibility in sada-skeleton.tsx
assert(skeletonContent.includes('role="status"'), "Base skeleton includes role='status'");
assert(skeletonContent.includes('aria-busy="true"'), "Base skeleton includes aria-busy='true'");
assert(skeletonContent.includes("sr-only"), "Base skeleton includes screen reader text");
assert(skeletonContent.includes('aria-hidden="true"'), "Decorative skeleton shapes include aria-hidden='true'");

// 4. Verify Page Skeletons in src/components/ui/sada-page-skeletons.tsx
const pageSkeletonsPath = path.resolve("src/components/ui/sada-page-skeletons.tsx");
const pageSkeletonsContent = fs.readFileSync(pageSkeletonsPath, "utf-8");

const expectedPageSkeletons = [
  "ExecutiveDashboardSkeleton",
  "FinanceDashboardSkeleton",
  "AnalyticsDashboardSkeleton",
  "SalesPipelineSkeleton",
  "TeamWorkloadSkeleton",
  "MySalarySkeleton",
  "MyWorkSkeleton",
  "ClientDirectorySkeleton",
  "ClientWorkspaceSkeleton",
  "WorkspaceListSkeleton",
  "WorkspaceDetailSkeleton",
  "AccountsDirectorySkeleton",
  "BusinessRulesSkeleton",
  "NotificationCenterSkeleton",
];

for (const ps of expectedPageSkeletons) {
  assert(
    pageSkeletonsContent.includes(`export function ${ps}`),
    `Page skeleton '${ps}' is exported in sada-page-skeletons.tsx`
  );
}

// 5. Verify NO fake data / fake KPI numbers exist in skeletons
// Checks that no hardcoded KPI values (e.g. "$12,450", "82%", "24 clients", "+12.4%") are rendered as text
const fakeDataRegex = />\s*(\$|TND|€|DT)\s*\d+|>\s*[-+]?\d+([.,]\d+)?\s*%|>\s*\d+\s*(clients|deals|projects|users)/i;
const hasFakeCurrencyOrPercentInPrimitives = fakeDataRegex.test(skeletonContent);
const hasFakeCurrencyOrPercentInPageSkeletons = fakeDataRegex.test(pageSkeletonsContent);

assert(!hasFakeCurrencyOrPercentInPrimitives, "Zero fake KPI/currency/percentage values in sada-skeleton.tsx");
assert(!hasFakeCurrencyOrPercentInPageSkeletons, "Zero fake KPI/currency/percentage values in sada-page-skeletons.tsx");

// 6. Verify sada-ui.ts barrel re-exports
const barrelPath = path.resolve("src/components/ui/sada-ui.ts");
const barrelContent = fs.readFileSync(barrelPath, "utf-8");

assert(barrelContent.includes('from "./sada-skeleton"'), "sada-ui.ts re-exports from ./sada-skeleton");
assert(barrelContent.includes('from "./sada-page-skeletons"'), "sada-ui.ts re-exports from ./sada-page-skeletons");

// 7. Verify Page Integrations
const integratedFiles = [
  "src/routes/admin.index.tsx",
  "src/routes/admin.finance.tsx",
  "src/routes/admin.analytics.tsx",
  "src/routes/admin.deals.tsx",
  "src/routes/admin.team-workload.tsx",
  "src/routes/admin.my-salary.tsx",
  "src/routes/admin.my-work.tsx",
  "src/routes/admin.clients.index.tsx",
  "src/routes/admin.clients.$id.tsx",
  "src/routes/admin.client-projects.index.tsx",
  "src/routes/admin.client-projects.$id.tsx",
  "src/routes/admin.accounts.tsx",
  "src/routes/admin.business-rules.tsx",
  "src/components/admin/NotificationCenter.tsx",
];

for (const file of integratedFiles) {
  const fileContent = fs.readFileSync(path.resolve(file), "utf-8");
  const hasSkeleton =
    fileContent.includes("Skeleton") ||
    fileContent.includes("ExecutiveDashboardSkeleton") ||
    fileContent.includes("FinanceDashboardSkeleton") ||
    fileContent.includes("AnalyticsDashboardSkeleton") ||
    fileContent.includes("SalesPipelineSkeleton");
  assert(hasSkeleton, `File '${file}' integrates skeleton loading`);
}

console.log("==================================================");
console.log(`TOTAL CHECKS: ${totalChecks} | PASSED: ${passedChecks} | FAILED: ${totalChecks - passedChecks}`);
console.log("==================================================");

if (passedChecks !== totalChecks) {
  process.exit(1);
} else {
  console.log("ALL SKELETON LOADING SYSTEM CRITERIA VERIFIED SUCCESSFULLY!");
}

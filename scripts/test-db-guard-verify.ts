import { evaluateDatabaseIsolation, CANONICAL_SHARED_PROJECT_REF, CANONICAL_SHARED_HOST } from "./test-db-guard";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} — ${detail || "Assertion failed"}`);
    failed++;
  }
}

console.log("=======================================================================");
console.log("SADA OS — TEST DATABASE ISOLATION GUARD VERIFICATION SUITE");
console.log("=======================================================================\n");

// Scenario 1: Shared DB URL with default env
const s1 = evaluateDatabaseIsolation("https://mtfkzabiscyleztypqks.supabase.co", {});
assert(s1.isBlocked === true, "1. Default shared DB URL is unconditionally blocked");
assert(s1.exitCode === 2, "1b. Exit code is 2 (distinguishing blocked from exit code 0 passed)");
assert(s1.targetRef === CANONICAL_SHARED_PROJECT_REF, "1c. Target project ref correctly identified");

// Scenario 2: Shared DB URL with ALLOW_MUTATION_TESTS=true
const s2 = evaluateDatabaseIsolation("https://mtfkzabiscyleztypqks.supabase.co", { ALLOW_MUTATION_TESTS: "true" } as any);
assert(s2.isBlocked === true, "2. Shared DB URL remains BLOCKED even if ALLOW_MUTATION_TESTS=true is set");
assert(s2.reason.includes("Mutating tests cannot run against the shared database"), "2b. Reason explains shared DB cannot be mutated");

// Scenario 3: Shared DB URL with TEST_DB_ISOLATED=true (spoofed isolation)
const s3 = evaluateDatabaseIsolation("https://mtfkzabiscyleztypqks.supabase.co", { TEST_DB_ISOLATED: "true" } as any);
assert(s3.isBlocked === true, "3. Shared DB URL remains BLOCKED even if TEST_DB_ISOLATED=true is falsely claimed");

// Scenario 4: Missing target URL
const s4 = evaluateDatabaseIsolation("", {});
assert(s4.isBlocked === true, "4. Missing URL fails closed");
assert(s4.exitCode === 2, "4b. Missing URL exits with non-zero code");

// Scenario 5: Invalid URL format
const s5 = evaluateDatabaseIsolation("not-a-valid-url", {});
assert(s5.isBlocked === true, "5. Invalid URL format fails closed");

// Scenario 6: Unknown remote URL without TEST_DB_ISOLATED=true
const s6 = evaluateDatabaseIsolation("https://random-tenant.supabase.co", {});
assert(s6.isBlocked === true, "6. Unknown remote URL without explicit TEST_DB_ISOLATED flag fails closed");

// Scenario 7: Genuinely isolated local Supabase URL
const s7 = evaluateDatabaseIsolation("http://127.0.0.1:54321", {});
assert(s7.isBlocked === false, "7. Local Supabase (127.0.0.1) is permitted as isolated");
assert(s7.exitCode === 0, "7b. Permitted run has exit code 0");

// Scenario 8: Genuinely isolated separate test project with TEST_DB_ISOLATED=true
const s8 = evaluateDatabaseIsolation("https://dedicated-qa-isolated-project.supabase.co", { TEST_DB_ISOLATED: "true" } as any);
assert(s8.isBlocked === false, "8. Dedicated non-shared test project with TEST_DB_ISOLATED=true is permitted");

// Scenario 9: Zero credentials logged in any evaluation
const allReasons = [s1.reason, s2.reason, s3.reason, s4.reason, s5.reason, s6.reason, s7.reason, s8.reason].join(" ");
assert(!allReasons.includes("eyJ") && !allReasons.includes("password"), "9. Zero secrets, tokens, or passwords present in reason strings");

console.log("\n=======================================================================");
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=======================================================================\n");

if (failed > 0) {
  process.exit(1);
}

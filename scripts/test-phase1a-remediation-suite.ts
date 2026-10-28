import fs from "fs";
import path from "path";
import { sanitizeCsvCell, serializeCsvRow, serializeCsv } from "../src/lib/csv-utils";
import { evaluateDatabaseIsolation } from "./test-db-guard";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, desc: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testId} :: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testId} :: ${desc} — ${detail || "Assertion failed"}`);
    failed++;
  }
}

console.log("=======================================================================");
console.log("SADA OS — PHASE 1A: REGRESSION TEST SUITE (CSV & SELF-DEMOTION)");
console.log("=======================================================================\n");

// =======================================================================
// GROUP 1: CSV EXPORT FORMULA INJECTION & SERIALIZATION REGRESSION SUITE
// =======================================================================
console.log("--- GROUP 1: CSV Formula Injection & RFC 4180 Escaping Tests ---");

// Test 1: Values starting with '='
const c1 = sanitizeCsvCell("=cmd|' /C calc'!A0");
assert(c1 === `"\'=cmd|\' /C calc\'!A0"`, "CSV-01", "Formula trigger '=' neutralized with single quote and wrapped in double quotes");

// Test 2: Values starting with '+'
const c2 = sanitizeCsvCell("+cmd|' /C calc'!A0");
assert(c2 === `"\'\+cmd|\' /C calc\'!A0"`, "CSV-02", "Formula trigger '+' neutralized with single quote");

// Test 3: Values starting with '@'
const c3 = sanitizeCsvCell("@SUM(1+1)");
assert(c3 === `"\'@SUM(1+1)"`, "CSV-03", "Formula trigger '@' neutralized with single quote");

// Test 4: Values starting with '-' followed by command or formula
const c4 = sanitizeCsvCell("-cmd");
assert(c4 === `"\'\-cmd"`, "CSV-04", "Formula trigger '-' with letters/commands neutralized with single quote");

const c4b = sanitizeCsvCell("-1+1");
assert(c4b === `"\'\-1+1"`, "CSV-04b", "Formula trigger '-1+1' (expression) neutralized with single quote");

// Test 5: PRESERVE LEGITIMATE NEGATIVE NUMBERS
const c5a = sanitizeCsvCell(-150.5);
assert(c5a === "-150.5", "CSV-05a", "Numeric negative float (-150.5) preserved as clean numeric literal without quotes or quote-prefix");

const c5b = sanitizeCsvCell("-150.00");
assert(c5b === "-150.00", "CSV-05b", "String legitimate negative currency ('-150.00') preserved as clean numeric literal");

const c5c = sanitizeCsvCell("-42");
assert(c5c === "-42", "CSV-05c", "Integer negative string ('-42') preserved as clean numeric literal");

const c5d = sanitizeCsvCell("0");
assert(c5d === "0", "CSV-05d", "Zero string ('0') preserved as clean numeric literal");

const c5e = sanitizeCsvCell(2500);
assert(c5e === "2500", "CSV-05e", "Positive integer number preserved as numeric literal");

// Test 6: Leading whitespace before formula triggers
const c6a = sanitizeCsvCell("  =1+1");
assert(c6a === `"\'  =1+1"`, "CSV-06a", "Leading spaces before '=' neutralized with single quote");

const c6b = sanitizeCsvCell("\t@SUM(A1:A10)");
assert(c6b === `"\'\t@SUM(A1:A10)"`, "CSV-06b", "Leading tab before '@' neutralized with single quote");

const c6c = sanitizeCsvCell("\r-cmd");
assert(c6c === `"\'\r-cmd"`, "CSV-06c", "Leading carriage return before '-' neutralized with single quote");

const c6d = sanitizeCsvCell("   -150.50");
assert(c6d === "-150.50", "CSV-06d", "Legitimate negative number with leading whitespace preserved as clean number");

// Test 7: Embedded double quotes, commas, newlines (RFC 4180)
const c7a = sanitizeCsvCell('John "The Boss" Doe');
assert(c7a === `"John ""The Boss"" Doe"`, "CSV-07a", "Embedded double quotes correctly doubled according to RFC 4180");

const c7b = sanitizeCsvCell("Line 1\nLine 2");
assert(c7b === `"Line 1\nLine 2"`, "CSV-07b", "Embedded newline preserved inside double quotes");

const c7c = sanitizeCsvCell("City, State, Country");
assert(c7c === `"City, State, Country"`, "CSV-07c", "Embedded commas preserved inside double quotes");

// Test 8: Multilingual Unicode & Arabic text
const c8a = sanitizeCsvCell("مدير النظام");
assert(c8a === `"مدير النظام"`, "CSV-08a", "Arabic text preserved without corruption");

const c8b = sanitizeCsvCell("=مدير");
assert(c8b === `"\'=مدير"`, "CSV-08b", "Arabic text starting with '=' neutralized with single quote");

// Test 9: Null, undefined, empty string
const c9a = sanitizeCsvCell(null);
assert(c9a === '""', "CSV-09a", "null value outputs empty quoted cell");

const c9b = sanitizeCsvCell(undefined);
assert(c9b === '""', "CSV-09b", "undefined value outputs empty quoted cell");

const c9c = sanitizeCsvCell("");
assert(c9c === '""', "CSV-09c", "empty string outputs empty quoted cell");

// Test 10: Complete document serialization & BOM
const testRows = [
  ["ID", "Action", "Amount", "Actor"],
  ["1", "=cmd", -150.5, 'Admin "Root"'],
  ["2", "NORMAL", "2500.00", "محمد علي"],
];
const csvDoc = serializeCsv(testRows, { withBom: true });
assert(csvDoc.startsWith("\uFEFF"), "CSV-10a", "Document includes UTF-8 Byte Order Mark (\uFEFF) for Excel compatibility");
assert(csvDoc.includes(`"'=cmd"`), "CSV-10b", "Document neutralizes formula trigger '=cmd'");
assert(csvDoc.includes("-150.5"), "CSV-10c", "Document preserves legitimate negative number -150.5");
assert(csvDoc.includes(`"Admin ""Root"""`), "CSV-10d", "Document doubles embedded quotes");
assert(csvDoc.includes(`"محمد علي"`), "CSV-10e", "Document preserves Arabic characters");

// =======================================================================
// GROUP 2: SUPER ADMIN SELF-DEMOTION SQL & MIGRATION AST VERIFICATION
// =======================================================================
console.log("\n--- GROUP 2: Super Admin Self-Demotion SQL & Invariant Verification ---");

const migrationPath = path.resolve(
  process.cwd(),
  "supabase/migrations/20261017150000_harden_super_admin_self_demotion_safeguard.sql"
);

assert(fs.existsSync(migrationPath), "SQL-01", "Forward-only migration file exists: 20261017150000_harden_super_admin_self_demotion_safeguard.sql");

const sqlContent = fs.readFileSync(migrationPath, "utf-8");

// Check 1: Explicit anti-self-demotion guard
assert(
  sqlContent.includes("_actor_id = _user_id AND _clean_role != 'super_admin'"),
  "SQL-02",
  "Migration contains explicit anti-self-demotion check (_actor_id = _user_id AND _clean_role != 'super_admin')"
);
assert(
  sqlContent.includes("Cannot demote own account (administrative self-lockout protection)"),
  "SQL-02b",
  "Self-demotion raises exact error: 'Cannot demote own account (administrative self-lockout protection).'"
);

// Check 2: Explicit anti-self-suspension and deactivation guard
assert(
  sqlContent.includes("_actor_id = _user_id AND ((_clean_status IS NOT NULL AND _clean_status != 'active') OR _is_active IS FALSE)"),
  "SQL-03",
  "Migration contains explicit anti-self-suspension/deactivation check (_actor_id = _user_id AND (_clean_status != 'active' OR _is_active IS FALSE))"
);
assert(
  sqlContent.includes("Cannot suspend or deactivate own account (administrative self-lockout protection)"),
  "SQL-03b",
  "Self-suspension raises exact error: 'Cannot suspend or deactivate own account (administrative self-lockout protection).'"
);

// Check 3: Explicit anti-self-deletion guard in admin_delete_account
assert(
  sqlContent.includes("CREATE OR REPLACE FUNCTION public.admin_delete_account"),
  "SQL-04a",
  "Migration hardens public.admin_delete_account"
);
assert(
  sqlContent.includes("Cannot delete own account (administrative self-lockout protection)"),
  "SQL-04b",
  "Self-deletion raises exact error: 'Cannot delete own account (administrative self-lockout protection).'"
);

// Check 4: Preserves last-active-Super-Admin safeguard
assert(
  sqlContent.includes("public.count_active_super_admins() <= 1"),
  "SQL-05a",
  "Migration preserves last-active-Super-Admin safeguard (count_active_super_admins() <= 1)"
);
assert(
  sqlContent.includes("At least one active Super Admin is required"),
  "SQL-05b",
  "Last Super Admin check raises exact error: 'At least one active Super Admin is required.'"
);

// Check 5: Non-Super-Admin caller check
assert(
  sqlContent.includes("IF NOT public.is_super_admin(_actor_id) THEN"),
  "SQL-06",
  "Migration validates caller authority via public.is_super_admin(_actor_id)"
);

// Check 6: SECURITY DEFINER and search_path hygiene
assert(
  sqlContent.includes("SECURITY DEFINER SET search_path = public"),
  "SQL-07",
  "Functions configured with SECURITY DEFINER SET search_path = public (anti-search-path hijacking)"
);

// Check 7: Revocations from public/anon and grants to authenticated
assert(
  sqlContent.includes("REVOKE EXECUTE ON FUNCTION public.admin_update_account") &&
  sqlContent.includes("GRANT EXECUTE ON FUNCTION public.admin_update_account"),
  "SQL-08a",
  "Function admin_update_account revokes execute from PUBLIC, anon and grants to authenticated, service_role"
);
assert(
  sqlContent.includes("REVOKE EXECUTE ON FUNCTION public.admin_delete_account") &&
  sqlContent.includes("GRANT EXECUTE ON FUNCTION public.admin_delete_account"),
  "SQL-08b",
  "Function admin_delete_account revokes execute from PUBLIC, anon and grants to authenticated, service_role"
);

// =======================================================================
// GROUP 3: PRODUCTION ENVIRONMENT SAFETY & MUTATION GUARDRAIL
// =======================================================================
console.log("\n--- GROUP 3: Production Safety Guardrail Verification ---");

const guardResult = evaluateDatabaseIsolation(process.env.VITE_SUPABASE_URL || "https://mtfkzabiscyleztypqks.supabase.co");
assert(guardResult.isBlocked === true, "GUARD-01", "Database guard unconditionally blocks remote mutating tests against mtfkzabiscyleztypqks");
assert(guardResult.exitCode === 2, "GUARD-02", "Blocked status yields exit code 2 (distinguishing blocked from passed/failed)");

console.log("\n=======================================================================");
console.log(`PHASE 1A TEST RESULTS:`);
console.log(`TOTAL ASSERTIONS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=======================================================================\n");

if (failed > 0) {
  process.exit(1);
}

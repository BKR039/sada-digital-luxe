import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || "").trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }
        process.env[match[1]] = value;
      }
    });
  }
} catch (e) {}

import { supabase } from "../src/integrations/supabase/client";
import {
  fetchBusinessRules,
  updateBusinessRule,
  resetBusinessRuleToDefault,
  fetchRuleVersions,
} from "../src/lib/business-rules-service";
import { fetchSystemAuditLogs } from "../src/lib/audit-service";

async function runComprehensiveTests() {
  console.log("==========================================================");
  console.log("   SADA OS — BUSINESS RULES COMPLETE VALIDATION SUITE     ");
  console.log("==========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean) {
    if (condition) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Authenticate as Super Admin
  console.log("[Phase 1] Authenticating Super Admin...");
  const { data: saAuth, error: saAuthErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert("Super Admin authenticated successfully", !saAuthErr && !!saAuth?.user);

  // 2. Fetch all canonical business rules
  console.log("\n[Phase 2] Fetching Canonical Rules...");
  const initialRules = await fetchBusinessRules(true);
  assert(`Fetched all ${initialRules.length} rules (expected 27)`, initialRules.length === 27);

  // Categories coverage check
  const categories = Array.from(new Set(initialRules.map((r) => r.category)));
  assert(`Found all 8 business categories: ${categories.length}`, categories.length === 8);

  // 3. Find benchmark USD Purchase Rate
  const usdRule = initialRules.find((r) => r.rule_key === "sponsoring_purchase_rate");
  assert("Found rule sponsoring_purchase_rate", !!usdRule);
  const baselineVersion = usdRule!.version;
  const baselineValue = Number(usdRule!.numeric_value);
  console.log(`  Current rule state: ${usdRule!.rule_name} = ${baselineValue} ${usdRule!.unit} (v${baselineVersion})`);

  // 4. Test Invalid Cases
  console.log("\n[Phase 3] Testing Invalid Inputs & Boundary Validations...");

  // Test 3.1: Empty change reason
  const resEmptyReason = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: 3.48,
    changeReason: "   ",
    actorId: saAuth.user.id,
  });
  assert("Rejects empty change reason", !resEmptyReason.success && resEmptyReason.error!.includes("change reason is required"));

  // Test 3.2: Value below minimum allowed
  const resBelowMin = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: 0.5, // min is 1
    changeReason: "Test below min",
    actorId: saAuth.user.id,
  });
  assert("Rejects numeric value below minimum (0.5 < 1)", !resBelowMin.success && resBelowMin.error!.includes("minimum allowed"));

  // Test 3.3: Value above maximum allowed
  const resAboveMax = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: 15.0, // max is 10
    changeReason: "Test above max",
    actorId: saAuth.user.id,
  });
  assert("Rejects numeric value above maximum (15 > 10)", !resAboveMax.success && resAboveMax.error!.includes("maximum allowed"));

  // Test 3.4: Invalid NaN value
  const resNaN = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: "invalid_not_a_number" as any,
    changeReason: "Test NaN",
    actorId: saAuth.user.id,
  });
  assert("Rejects NaN numeric value", !resNaN.success && resNaN.error!.includes("valid numeric value"));

  // 5. Test Valid Edit Mutation Flow
  console.log("\n[Phase 4] Testing Valid Edit Mutation & Version Increment...");
  const targetNewValue = baselineValue === 3.44 ? 3.48 : 3.44;
  const testReason = `Governance benchmark adjustment Q4 ${Date.now()}`;

  const editRes = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: targetNewValue,
    changeReason: testReason,
    actorId: saAuth.user.id,
    actorName: "QA Super Admin Lead",
  });

  assert("updateBusinessRule succeeded", editRes.success && !!editRes.data);
  assert(`Version incremented from v${baselineVersion} to v${baselineVersion + 1}`, editRes.data?.version === baselineVersion + 1);
  assert(`New numeric value is ${targetNewValue}`, Number(editRes.data?.numeric_value) === targetNewValue);

  // 6. Verify Persistence on Database Re-fetch
  console.log("\n[Phase 5] Verifying Persistence & Fresh Fetch...");
  const freshRules = await fetchBusinessRules(true);
  const refreshedUsdRule = freshRules.find((r) => r.rule_key === "sponsoring_purchase_rate");
  assert("Refetched rule reflects new value", Number(refreshedUsdRule?.numeric_value) === targetNewValue);
  assert("Refetched rule reflects new version", refreshedUsdRule?.version === baselineVersion + 1);

  // 7. Verify Version History & Immutability
  console.log("\n[Phase 6] Verifying Immutable Version History Archive...");
  const versions = await fetchRuleVersions(usdRule!.id);
  assert("Fetched version history list", versions.length > 0);
  const latestVersion = versions[0];
  assert(`Latest archived version is v${baselineVersion + 1}`, latestVersion.version === baselineVersion + 1);
  assert(`Archived value matches ${targetNewValue}`, Number(latestVersion.numeric_value) === targetNewValue);
  assert(`Archived change_reason recorded correctly`, latestVersion.change_reason === testReason);
  assert(`Archived changed_by matches actor`, latestVersion.changed_by === saAuth.user.id);

  // Check previous version immutability
  const prevVersion = versions.find((v) => v.version === baselineVersion);
  if (prevVersion) {
    assert(`Previous version v${baselineVersion} remains immutable with value ${baselineValue}`, Number(prevVersion.numeric_value) === baselineValue);
  }

  // 8. Verify System Audit Trail
  console.log("\n[Phase 7] Verifying System Audit Trail Logging...");
  const auditLogs = await fetchSystemAuditLogs({ entityType: "business_rule", limit: 5 });
  const matchingAudit = auditLogs.find((l) => l.entity_id === usdRule!.id && l.new_values?.version === baselineVersion + 1);
  assert("System audit log entry recorded", !!matchingAudit);
  assert("Audit log contains change_reason", matchingAudit?.new_values?.change_reason === testReason);

  // 9. Test Comma Normalization ("3,44" -> 3.44)
  console.log("\n[Phase 8] Testing International Comma Normalization (e.g. '3,44')...");
  const commaVal = "3,44";
  const commaRes = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: commaVal as any,
    changeReason: "Testing comma normalization input",
    actorId: saAuth.user.id,
  });
  assert("Normalized string with comma '3,44' into 3.44 successfully", commaRes.success && Number(commaRes.data?.numeric_value) === 3.44);

  // 10. Test Reset to Factory Default
  console.log("\n[Phase 9] Testing Reset to Factory Default Flow...");
  const resetRes = await resetBusinessRuleToDefault({
    ruleId: usdRule!.id,
    changeReason: "Resetting to factory default for verification test",
    actorId: saAuth.user.id,
    actorName: "QA Super Admin",
  });
  assert("Reset to factory default succeeded", resetRes.success);
  assert(`Reset restored value to default 3.37`, Number(resetRes.data?.numeric_value) === 3.37);

  // 11. Restore back to canonical benchmark 3.44
  console.log("\n[Phase 10] Restoring Benchmark Value to 3.44...");
  const restoreRes = await updateBusinessRule({
    ruleId: usdRule!.id,
    numericValue: 3.44,
    changeReason: "Setting benchmark USD purchase rate to canonical 3.44 TND/USD",
    actorId: saAuth.user.id,
    actorName: "QA Super Admin",
  });
  assert("Benchmark value restored to 3.44", restoreRes.success && Number(restoreRes.data?.numeric_value) === 3.44);

  // 12. Test Unauthorized Worker Rejection (RLS Gate)
  console.log("\n[Phase 11] Testing Security: Worker Access Blocked by RLS...");
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  const workerEditAttempt = await (supabase as any)
    .from("business_rules")
    .update({ numeric_value: 9.99, change_reason: "Malicious worker update" })
    .eq("id", usdRule!.id)
    .select();

  assert("Worker UPDATE blocked by RLS (0 rows updated or error)", workerEditAttempt.error !== null || !workerEditAttempt.data || workerEditAttempt.data.length === 0);

  // Re-verify that 3.44 was NOT modified by the worker
  const verifyAfterWorker = await (supabase as any)
    .from("business_rules")
    .select("numeric_value")
    .eq("id", usdRule!.id)
    .single();
  assert("Rule value remains 3.44 (Worker cannot tamper with rules)", Number(verifyAfterWorker.data?.numeric_value) === 3.44);

  console.log("\n==========================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveTests().catch(console.error);

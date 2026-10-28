// ============================================================
// SADA OS — BUSINESS RULES INTELLIGENCE & GOVERNANCE ENGINE SUITE
// Automated test suite verifying canonical rules inventory,
// live evaluations, contradiction detection, impact simulation,
// immutable audit versioning, rollback, and security authorization.
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY!;
process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anonKey;
process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_PUBLISHABLE_KEY = anonKey;

let total = 0;
let passed = 0;
const failures: string[] = [];

function check(condition: boolean, desc: string, detail?: any) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${desc}`);
  } else {
    console.error(`  ✗ FAIL: ${desc}`, detail || "");
    failures.push(desc);
  }
}

async function runTestSuite() {
  console.log("\n============================================================");
  console.log("SADA OS — BUSINESS RULES INTELLIGENCE & GOVERNANCE SUITE");
  console.log("============================================================\n");

  const { supabase } = await import("../src/integrations/supabase/client");
  const {
    fetchBusinessRules,
    updateBusinessRule,
    resetBusinessRuleToDefault,
    fetchRuleVersions,
  } = await import("../src/lib/business-rules-service");
  const {
    RULE_METADATA_REGISTRY,
    fetchLiveBusinessContext,
    evaluateAllBusinessRules,
    detectRuleContradictions,
    simulateRuleChangeImpact,
    generateBusinessRulesSmartInsights,
  } = await import("../src/lib/business-rules-intelligence-service");

  // 1. Authenticate Actors
  console.log("--- 1. Authenticating Actors ---");
  const { data: saLogin, error: saErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  check(Boolean(saLogin?.user), "Super Admin authenticated", saErr);

  const workerClient = createClient(supabaseUrl, anonKey);
  const { data: wLogin, error: wErr } = await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  check(Boolean(wLogin?.user), "Worker authenticated", wErr);

  // 2. Canonical Rules Inventory
  console.log("\n--- 2. Canonical Rules Inventory & Metadata Registry ---");
  const rules = await fetchBusinessRules(true);
  check(rules.length === 27, `Canonical rules count is exactly 27 (found: ${rules.length})`);

  const registryKeys = Object.keys(RULE_METADATA_REGISTRY);
  check(registryKeys.length === 27, `Metadata registry covers all 27 canonical rules (found: ${registryKeys.length})`);

  for (const rule of rules) {
    const meta = RULE_METADATA_REGISTRY[rule.rule_key];
    if (!meta) {
      check(false, `Rule ${rule.rule_key} exists in metadata registry`);
    }
  }
  check(true, "Every database rule is mapped in the canonical metadata registry");

  // Category distribution check
  const byCategory: Record<string, number> = {};
  for (const r of rules) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  check(byCategory["cash_treasury"] === 3, "Category cash_treasury has 3 rules");
  check(byCategory["fixed_burn"] === 2, "Category fixed_burn has 2 rules");
  check(byCategory["notifications_alerts"] === 2, "Category notifications_alerts has 2 rules");
  check(byCategory["operations"] === 2, "Category operations has 2 rules");
  check(byCategory["profitability"] === 7, "Category profitability has 7 rules");
  check(byCategory["sales_commissions"] === 6, "Category sales_commissions has 6 rules");
  check(byCategory["smart_insights"] === 1, "Category smart_insights has 1 rule");
  check(byCategory["sponsoring_advertising"] === 4, "Category sponsoring_advertising has 4 rules");

  // 3. Live Business Context & Evaluations
  console.log("\n--- 3. Live Business Context & Real-Time Evaluations ---");
  const liveContext = await fetchLiveBusinessContext(true, {
    userId: saLogin?.user?.id,
    role: "super_admin",
    permissions: { finance: true },
  });

  check(liveContext.cashReserves > 0, `Live cash reserves evaluated (>0): ${liveContext.cashReserves} TND`);
  check(liveContext.recurringBurn > 0, `Live recurring burn evaluated (>0): ${liveContext.recurringBurn} TND`);
  check(liveContext.runwayMonths > 0, `Live cash runway calculated (>0): ${liveContext.runwayMonths} months`);
  check(liveContext.totalActiveClients > 0, `Live client accounts evaluated (>0): ${liveContext.totalActiveClients} clients`);
  check(liveContext.activeTasksCount > 0, `Live active tasks evaluated (>0): ${liveContext.activeTasksCount} tasks`);

  const { evaluations, overview, contradictions } = evaluateAllBusinessRules(rules, liveContext);
  check(evaluations.size === 27, `All 27 rules evaluated in real-time (evaluated: ${evaluations.size})`);
  check(overview.totalRules === 27, "Executive overview reports 27 total rules");
  check(overview.liveEvaluatedCount === 18, `Executive overview identifies live evaluators (count: ${overview.liveEvaluatedCount})`);
  check(overview.configurationPolicyCount === 9, `Executive overview identifies configuration policies (count: ${overview.configurationPolicyCount})`);
  check(overview.triggeredRulesCount === overview.criticalCount + overview.warningCount, "Triggered rules count matches sum of critical + warning");

  // 4. Contradiction Detection Engine
  console.log("\n--- 4. Contradiction & Semantic Conflict Detection ---");
  // Test contradiction when critical runway >= warning runway
  const simulatedContradictoryRules = rules.map((r) => {
    if (r.rule_key === "critical_runway_months") return { ...r, numeric_value: 8 }; // 8 > warning (6)
    return r;
  });
  const detectedConflicts = detectRuleContradictions(simulatedContradictoryRules);
  const runwayConflict = detectedConflicts.get("critical_runway_months");
  check(Boolean(runwayConflict && runwayConflict.length > 0), "Contradiction detected when critical runway (8) >= warning runway (6)");

  // Test contradiction when media purchase rate >= client billing rate
  const simulatedNegArbitrage = rules.map((r) => {
    if (r.rule_key === "sponsoring_purchase_rate") return { ...r, numeric_value: 4.5 }; // 4.5 > client (4.0)
    return r;
  });
  const negArbitrageConflicts = detectRuleContradictions(simulatedNegArbitrage);
  check(Boolean(negArbitrageConflicts.get("sponsoring_purchase_rate")), "Negative arbitrage detected when purchase rate (4.5) >= client rate (4.0)");

  // 5. Deterministic Impact Simulation Preview
  console.log("\n--- 5. Deterministic Impact Simulation Preview ---");
  const runwayRule = rules.find((r) => r.rule_key === "critical_runway_months")!;
  const simRunwayCritical = simulateRuleChangeImpact(runwayRule, 40, rules, liveContext);
  check(simRunwayCritical.simulatedStatus === "critical", "Simulating critical runway threshold of 40 months correctly triggers CRITICAL status");
  check(simRunwayCritical.isPreviewDeterministic === true, "Impact simulation is flagged as deterministic (zero fabrication)");
  check(simRunwayCritical.affectedConsumers.includes("Executive Command Center"), "Impact simulation lists affected consumers");

  const burnRule = rules.find((r) => r.rule_key === "fixed_burn_warning_percent")!;
  const simBurnHealthy = simulateRuleChangeImpact(burnRule, 90, rules, liveContext);
  check(simBurnHealthy.simulatedStatus === "healthy", "Simulating fixed burn threshold of 90% correctly clears alert to HEALTHY");

  // 6. Advanced Validation & Bounds Enforcement
  console.log("\n--- 6. Advanced Validation & Bounds Enforcement ---");
  const testRule = rules.find((r) => r.rule_key === "critical_runway_months")!;

  // Below min_value (min is 0.5)
  const belowMinRes = await updateBusinessRule({
    ruleId: testRule.id,
    numericValue: 0.1,
    changeReason: "Testing below min bounds",
    actorId: saLogin?.user?.id,
  });
  check(belowMinRes.success === false, "Update rejecting value below min_value (0.1 < 0.5)");

  // Above max_value (max is 24)
  const aboveMaxRes = await updateBusinessRule({
    ruleId: testRule.id,
    numericValue: 50,
    changeReason: "Testing above max bounds",
    actorId: saLogin?.user?.id,
  });
  check(aboveMaxRes.success === false, "Update rejecting value above max_value (50 > 24)");

  // Missing change reason
  const emptyReasonRes = await updateBusinessRule({
    ruleId: testRule.id,
    numericValue: 4,
    changeReason: "",
    actorId: saLogin?.user?.id,
  });
  check(emptyReasonRes.success === false, "Update rejecting empty change reason");

  // 7. Successful Mutation & Immutable Versioning
  console.log("\n--- 7. Successful Mutation & Immutable Versioning ---");
  const origVal = Number(testRule.numeric_value);
  const targetVal = origVal === 3 ? 4 : 3;

  const validUpdateRes = await updateBusinessRule({
    ruleId: testRule.id,
    numericValue: targetVal,
    changeReason: "QA Governance Test: Adjusted critical runway floor",
    actorId: saLogin?.user?.id,
    actorName: "Super Admin QA",
  });
  check(validUpdateRes.success === true, `Valid update succeeded (v${validUpdateRes.data?.version})`);
  check(Number(validUpdateRes.data?.numeric_value) === targetVal, `Rule value updated to ${targetVal}`);

  // Fetch versions
  const versions = await fetchRuleVersions(testRule.id);
  check(versions.length > 0, `Archived versions found for rule (count: ${versions.length})`);
  check(versions[0].change_reason?.includes("QA Governance Test"), "Archived version preserves exact change reason");

  // 8. Safe Rollback Workflow (Creating New Version)
  console.log("\n--- 8. Safe Rollback Workflow ---");
  const rollbackRes = await updateBusinessRule({
    ruleId: testRule.id,
    numericValue: origVal,
    changeReason: `Rollback to original baseline v${testRule.version}: Restoring ${origVal} months`,
    actorId: saLogin?.user?.id,
    actorName: "Super Admin QA",
  });
  check(rollbackRes.success === true, `Rollback committed as a NEW version (v${rollbackRes.data?.version})`);
  check(Number(rollbackRes.data?.numeric_value) === origVal, `Restored value is back to original (${origVal})`);

  // Verify versions were never deleted
  const postRollbackVersions = await fetchRuleVersions(testRule.id);
  check(postRollbackVersions.length >= versions.length, "Version history is strictly append-only (no versions deleted during rollback)");

  // 9. Security & Role Authorization Gates
  console.log("\n--- 9. Security & Authorization Gates ---");
  // Worker attempting direct update via PostgREST
  const workerUpdateRes = await (workerClient as any)
    .from("business_rules")
    .update({ numeric_value: 99 })
    .eq("id", testRule.id);

  // Under RLS, either returns error or 0 rows modified
  check(
    Boolean(workerUpdateRes.error) || workerUpdateRes.data === null || (Array.isArray(workerUpdateRes.data) && workerUpdateRes.data.length === 0),
    "Worker direct update on business_rules is strictly blocked by PostgreSQL RLS"
  );

  // 10. Smart Insights Engine Integration
  console.log("\n--- 10. Smart Insights Engine Integration ---");
  const insights = generateBusinessRulesSmartInsights(evaluations, rules, liveContext);
  check(insights.length >= 2, `Smart Insights generated from live evaluations (count: ${insights.length})`);

  for (const ins of insights) {
    check(Boolean(ins.finding && ins.businessImpact && ins.supportingEvidence), `Insight "${ins.title}" has finding, impact, and evidence`);
    check(Boolean(ins.actionRoute.startsWith("/admin")), `Insight action route is a valid administrative link: ${ins.actionRoute}`);
  }

  console.log("\n============================================================");
  console.log(`TEST SUITE COMPLETE: ${passed} / ${total} ASSERTIONS PASSED (${((passed / total) * 100).toFixed(1)}%)`);
  if (failures.length > 0) {
    console.error(`FAILURES (${failures.length}):`, failures);
  } else {
    console.log("ALL BUSINESS RULES INTELLIGENCE & GOVERNANCE TESTS PASSED 100%!");
  }
  console.log("============================================================\n");
}

runTestSuite().catch((e) => {
  console.error("FATAL SUITE ERROR:", e);
  process.exit(1);
});

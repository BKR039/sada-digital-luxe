import fs from "fs";
import path from "path";

// Load .env into process.env
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
import { updateBusinessRule, fetchBusinessRules } from "../src/lib/business-rules-service";

async function testEditFlow() {
  console.log("=== TESTING BUSINESS RULE EDIT FLOW ===");

  // 1. Log in as Super Admin (qa.superadmin@sada.agency)
  console.log("\n[Step 1] Logging in as qa.superadmin@sada.agency...");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  if (authErr) {
    console.error("  ❌ Super Admin login failed:", authErr);
    return;
  }
  console.log("  ✅ Logged in successfully as:", auth.user.email, "(ID:", auth.user.id, ")");

  // 2. Fetch business rules
  console.log("\n[Step 2] Fetching business rules...");
  const rules = await fetchBusinessRules(true);
  console.log(`  ✅ Fetched ${rules.length} rules.`);

  // 3. Find benchmark USD rate rule (sponsoring_purchase_rate) or initial commission rate
  const targetRule = rules.find(r => r.rule_key === "sponsoring_purchase_rate") || rules[0];
  console.log(`\n[Step 3] Target rule for testing: "${targetRule.rule_name}" (${targetRule.rule_key})`);
  console.log(`  Current value: ${targetRule.numeric_value} (v${targetRule.version})`);

  // 4. Attempt to update business rule
  const newValue = Number(targetRule.numeric_value) === 3.44 ? 3.45 : 3.44;
  console.log(`\n[Step 4] Attempting to update rule to ${newValue}...`);

  const res = await updateBusinessRule({
    ruleId: targetRule.id,
    numericValue: newValue,
    changeReason: "Automated diagnosis test for SADA OS business rules edit flow",
    actorId: auth.user.id,
    actorName: "QA Super Admin",
  });

  console.log("  Result:", res);

  if (!res.success) {
    console.error("  ❌ updateBusinessRule FAILED:", res.error);
  } else {
    console.log("  ✅ updateBusinessRule SUCCEEDED! New version:", res.data?.version);
  }
}

testEditFlow().catch(console.error);

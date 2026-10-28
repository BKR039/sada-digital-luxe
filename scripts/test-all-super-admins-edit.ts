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
import { updateBusinessRule, fetchBusinessRules } from "../src/lib/business-rules-service";

async function testSuperAdminEdit() {
  console.log("=== CHECKING ALL SUPER ADMINS AND TESTING EDIT FLOW ===");

  // 1. Sign in as qa.superadmin first to get list of all super admin accounts
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });

  if (authErr) {
    console.error("qa.superadmin login failed:", authErr);
    return;
  }

  const { data: accounts } = await (supabase as any).rpc("admin_list_accounts");
  const superAdmins = (accounts || []).filter((a: any) => a.role === "super_admin" || a.is_super_admin);

  console.log(`Found ${superAdmins.length} super admin accounts:`);
  for (const sa of superAdmins) {
    console.log(`- ${sa.display_name} (${sa.email}) | id: ${sa.user_id} | status: ${sa.status}`);
  }

  // 2. Fetch current sponsoring_purchase_rate
  const rules = await fetchBusinessRules(true);
  const rule = rules.find(r => r.rule_key === "sponsoring_purchase_rate");
  console.log(`\nCurrent sponsoring_purchase_rate: ${rule?.numeric_value} (v${rule?.version})`);

  // 3. Test update using qa.superadmin
  console.log("\nTesting updateBusinessRule as qa.superadmin@sada.agency...");
  const updateRes1 = await updateBusinessRule({
    ruleId: rule!.id,
    numericValue: 3.44,
    changeReason: "Testing edit flow verification 3.44",
    actorId: auth.user.id,
    actorName: "QA Super Admin",
  });
  console.log("Result 1 (set to 3.44):", updateRes1.success ? `SUCCESS v${updateRes1.data?.version}` : `ERROR: ${updateRes1.error}`);

  // 4. Test updating with SAME value (3.44 -> 3.44)
  console.log("\nTesting updateBusinessRule with SAME VALUE (3.44 -> 3.44)...");
  const updateResSame = await updateBusinessRule({
    ruleId: rule!.id,
    numericValue: 3.44,
    changeReason: "Testing same value change reason update",
    actorId: auth.user.id,
    actorName: "QA Super Admin",
  });
  console.log("Result Same (3.44 -> 3.44):", updateResSame.success ? `SUCCESS v${updateResSame.data?.version}` : `ERROR: ${updateResSame.error}`);

  // 5. Test updating with floating point precision (3.441)
  console.log("\nTesting updateBusinessRule with 3.441...");
  const updateResPrec = await updateBusinessRule({
    ruleId: rule!.id,
    numericValue: 3.441,
    changeReason: "Testing precision 3.441",
    actorId: auth.user.id,
    actorName: "QA Super Admin",
  });
  console.log("Result Precision (3.441):", updateResPrec.success ? `SUCCESS v${updateResPrec.data?.version}` : `ERROR: ${updateResPrec.error}`);

  // Set back to 3.44
  await updateBusinessRule({
    ruleId: rule!.id,
    numericValue: 3.44,
    changeReason: "Setting back to benchmark 3.44",
    actorId: auth.user.id,
    actorName: "QA Super Admin",
  });
}

testSuperAdminEdit().catch(console.error);

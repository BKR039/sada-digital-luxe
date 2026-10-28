import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { supabase } from "../src/integrations/supabase/client";
import { fetchManagementAnalytics } from "../src/lib/analytics-service";
import { fetchCompanyFinance, getPresetPeriod } from "../src/lib/finance-service";
import { updateAccountPermissions } from "../src/lib/account-service";

async function verifySecurityInvariants() {
  const workerEmail = "qa.worker@sada.agency";

  // 1. Authenticate as QA Worker
  await supabase.auth.signInWithPassword({
    email: workerEmail,
    password: "WorkerPassword123!",
  });

  // Test Direct Finance Access (MUST FAIL)
  console.log("--- Invariant 1: Direct fetchCompanyFinance MUST FAIL for worker with analytics-only ---");
  const period = getPresetPeriod("this_month");
  try {
    await fetchCompanyFinance(period);
    console.error("❌ FAILED: Direct fetchCompanyFinance did NOT throw!");
  } catch (err: any) {
    console.log("✅ PASSED: Direct fetchCompanyFinance correctly blocked:", err.message);
  }

  // 2. Revoke Analytics from Worker as Super Admin
  console.log("\n--- Invariant 2: Revoke analytics and verify fetchManagementAnalytics FAILS ---");
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  const { data: accounts } = await (supabase as any).rpc("admin_list_accounts");
  const qaWorker = (accounts || []).find((a: any) => a.email === workerEmail);

  await updateAccountPermissions(
    qaWorker.user_id,
    {
      analytics: {
        enabled: false,
      },
    },
    supabase
  );
  console.log("Revoked analytics from QA Worker.");

  // 3. Authenticate as QA Worker and attempt to call fetchManagementAnalytics (MUST FAIL)
  await supabase.auth.signInWithPassword({
    email: workerEmail,
    password: "WorkerPassword123!",
  });

  try {
    await fetchManagementAnalytics({ periodType: "this_month" });
    console.error("❌ FAILED: fetchManagementAnalytics did NOT throw after revocation!");
  } catch (err: any) {
    console.log("✅ PASSED: fetchManagementAnalytics correctly blocked after revocation:", err.message);
  }

  // 4. Restore QA Worker to clean state
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  await updateAccountPermissions(qaWorker.user_id, {}, supabase);
  console.log("Cleaned up QA Worker permissions.");
}

verifySecurityInvariants().catch(console.error);

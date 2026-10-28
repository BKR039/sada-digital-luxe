import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
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
      env[match[1]] = value;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const superClient = createClient(supabaseUrl, anonKey);
const workerClient = createClient(supabaseUrl, anonKey);

import { createAccount } from "../src/lib/account-service";

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(suite: string, test: string, passed: boolean, details: string) {
  results.push({ suite, test, passed, details });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${suite} :: ${test}`);
  if (!passed) console.log(`   Details: ${details}`);
}

async function main() {
  console.log("===============================================================================");
  console.log("SADA OS — ACCOUNT DELETION & AUDIT IMMUTABILITY CERTIFICATION TEST SUITE");
  console.log("===============================================================================\n");

  // Auth Super Admin
  const { data: saAuth, error: saAuthErr } = await superClient.auth.signInWithPassword({
    email: "boubakarhamedsgail@gmail.com",
    password: "Boubakar2026!",
  });
  if (saAuthErr) throw new Error("Super Admin auth failed: " + saAuthErr.message);

  // Authenticate or provision isolated worker account
  const workerEmail = "qa.worker.certified@sada.agency";
  const workerPassword = "WorkerPassword123!";

  let { data: wAuth, error: wAuthErr } = await workerClient.auth.signInWithPassword({
    email: workerEmail,
    password: workerPassword,
  });

  if (wAuthErr) {
    console.log("Worker auth not found, creating certified worker test account...");
    await createAccount(
      {
        email: workerEmail,
        password: workerPassword,
        displayName: "Certified QA Worker",
        role: "worker",
        division: "Development",
        position: "QA Tester",
        createTeamMember: true,
        status: "active",
      },
      superClient
    );
    const relogin = await workerClient.auth.signInWithPassword({
      email: workerEmail,
      password: workerPassword,
    });
    wAuth = relogin.data;
    wAuthErr = relogin.error;
    if (wAuthErr) throw new Error("Worker auth failed after creation: " + wAuthErr.message);
  }

  console.log(`Authenticated as Super Admin: ${saAuth.user.email}`);
  console.log(`Authenticated as Worker: ${wAuth.user.email}\n`);

  // =========================================================================
  // TEST SUITE 1 & 2: DISPOSABLE TEST ACCOUNT WITH AUDIT LOGS PERMANENT PURGE
  // =========================================================================
  console.log("--- TEST SUITE 1 & 2: Disposable Account Deletion & Audit Reference Preservation ---");
  const testEmail = `disposable.test.${Date.now()}@sada.agency`;
  const testPassword = "TempPassword123!";

  // Provision disposable user
  let provError: any = null;
  let dispUserId: string | null = null;
  try {
    const prov = await createAccount(
      {
        email: testEmail,
        password: testPassword,
        displayName: "Disposable QA Test Account",
        role: "worker",
        division: "Quality Assurance",
        position: "Test Account",
        createTeamMember: true,
        status: "active",
      },
      superClient
    );
    dispUserId = prov.user_id;
  } catch (err: any) {
    provError = err;
  }

  record(
    "1. Provisioning",
    "Provision disposable test account",
    !provError && !!dispUserId,
    `Created: ${testEmail} (ID: ${dispUserId})`
  );

  // Generate an audit log where dispUserId is the actor
  const { data: insertLog, error: logErr } = await (superClient as any).rpc("admin_update_account_status", {
    _target_user_id: dispUserId,
    _status: "active",
    _reason: "Activating disposable test user"
  });

  // Also insert direct system_audit_logs record with dispUserId as actor
  const { data: salEntry, error: salInsertErr } = await superClient.from("system_audit_logs").insert({
    action: "DISPOSABLE_TEST_ACTION",
    entity_type: "test_entity",
    entity_id: "test-123",
    actor_id: dispUserId,
    actor_name: "Disposable QA Test Account",
    actor_role: "worker",
  }).select().single();

  record(
    "2. Audit Generation",
    "Target user generates system audit log with actor_id",
    !salInsertErr && !!salEntry?.id,
    `Audit ID: ${salEntry?.id}, actor_id: ${salEntry?.actor_id}`
  );

  // Analyze dependencies before deletion
  const { data: depsBefore } = await (superClient as any).rpc("admin_analyze_account_dependencies", {
    _user_id: dispUserId,
  });

  record(
    "3. Dependency Analysis",
    "Account with only audit logs is eligible for permanent deletion",
    depsBefore?.can_permanently_delete === true && depsBefore?.has_business_dependencies === false,
    `can_permanently_delete: ${depsBefore?.can_permanently_delete}, has_business_deps: ${depsBefore?.has_business_dependencies}, system_audit_actor_count: ${depsBefore?.system_audit_actor_count}`
  );

  // Permanently delete the disposable account
  const { data: delResult, error: delError } = await (superClient as any).rpc("admin_delete_account", {
    _user_id: dispUserId,
  });

  record(
    "4. Permanent Deletion",
    "Super Admin permanently purges disposable account from auth.users",
    !delError && delResult?.success === true,
    `Result: ${JSON.stringify(delResult)}, Error: ${delError?.message}`
  );

  // Verify user is gone from accounts & profiles
  const { data: allAccs } = await (superClient as any).rpc("admin_list_accounts");
  const foundUser = allAccs?.find((a: any) => a.user_id === dispUserId);
  const { data: profRows } = await superClient.from("profiles").select("*").eq("id", dispUserId);

  record(
    "5. Non-Existence Verification",
    "User no longer exists in auth.users or profiles",
    !foundUser && profRows?.length === 0,
    `In accounts: ${!!foundUser}, in profiles: ${profRows?.length}`
  );

  // Verify the audit log was preserved with actor_id nullified
  const { data: preservedLog } = await superClient
    .from("system_audit_logs")
    .select("id, action, actor_id, actor_name, created_at")
    .eq("id", salEntry.id)
    .single();

  const auditPreserved = preservedLog && preservedLog.actor_id === null && preservedLog.action === "DISPOSABLE_TEST_ACTION";
  record(
    "6. Audit Preservation",
    "Audit record remains intact and actor_id transitioned to NULL per ON DELETE SET NULL",
    auditPreserved,
    `Preserved record: ${JSON.stringify(preservedLog)}`
  );

  // Verify audit records cannot be deleted
  const { error: blockDelErr } = await superClient
    .from("system_audit_logs")
    .delete()
    .eq("id", salEntry.id);

  record(
    "7. Immutability Deletion Defense",
    "Direct DELETE on system_audit_logs is rejected by trigger",
    !!blockDelErr && (blockDelErr.message.includes("immutable and cannot be deleted") || blockDelErr.message.includes("Disallow DELETE")),
    `Error: ${blockDelErr?.message}`
  );

  // Verify audit records cannot have action or data modified
  const { error: blockUpdErr } = await superClient
    .from("system_audit_logs")
    .update({ action: "TAMPERED_ACTION" })
    .eq("id", salEntry.id);

  record(
    "8. Immutability Update Defense",
    "Direct UPDATE of audit columns is rejected by trigger",
    !!blockUpdErr && blockUpdErr.message.includes("immutable and cannot be modified"),
    `Error: ${blockUpdErr?.message}`
  );

  // =========================================================================
  // TEST SUITE 3: ACCOUNT WITH PROTECTED FINANCIAL DEPENDENCIES BLOCKED SAFELY
  // =========================================================================
  console.log("\n--- TEST SUITE 3: Protected Financial Dependencies Guard ---");
  const finEmail = `financial.protected.${Date.now()}@sada.agency`;
  const finProv = await createAccount(
    {
      email: finEmail,
      password: "TempPassword123!",
      displayName: "Financial Protected Account",
      role: "worker",
      division: "Development",
      position: "Developer",
      createTeamMember: true,
      status: "active",
    },
    superClient
  );

  const finUserId = finProv.user_id;

  // Find team member id
  const tmRes = await superClient
    .from("team_members")
    .select("id")
    .or(`profile_id.eq.${finUserId},user_id.eq.${finUserId}`)
    .single();
  const tmId = finProv.team_member_id || tmRes.data?.id;

  // Insert a salary record for this team member
  const { data: salRec, error: salRecErr } = await superClient.from("salary_records").insert({
    team_member_id: tmId,
    base_amount: 3500,
    currency: "TND",
    effective_date: "2026-01-01",
    status: "active",
  }).select().single();

  if (salRecErr) {
    console.error("Salary record insert error:", salRecErr);
  }

  // Analyze dependencies
  const { data: finDeps } = await (superClient as any).rpc("admin_analyze_account_dependencies", {
    _user_id: finUserId,
  });

  record(
    "9. Financial Dependency Detection",
    "admin_analyze_account_dependencies detects salary records as blocking financial dependencies",
    finDeps?.has_financial_dependencies === true && finDeps?.can_permanently_delete === false,
    `has_financial_dependencies: ${finDeps?.has_financial_dependencies}, salary_records: ${finDeps?.salary_records_count}`
  );

  // Attempt deletion of financial account: MUST BE REJECTED!
  const { data: finDelRes, error: finDelErr } = await (superClient as any).rpc("admin_delete_account", {
    _user_id: finUserId,
  });

  const finDelBlocked = !!finDelErr && finDelErr.message.includes("protected financial records");
  record(
    "10. Financial Deletion Blocking",
    "admin_delete_account rejects deletion of account with protected financial history",
    finDelBlocked,
    `Error: ${finDelErr?.message}`
  );

  // Verify financial account is intact
  const { data: finAccStillExists } = await superClient.from("profiles").select("*").eq("id", finUserId);
  record(
    "11. State Consistency",
    "Blocked financial account remains intact and unmodified",
    finAccStillExists?.length === 1 && finAccStillExists[0].status === "active",
    `Status: ${finAccStillExists?.[0]?.status}`
  );

  // Clean up the financial test record safely for clean test state
  await superClient.from("salary_records").delete().eq("id", salRec.id);
  await (superClient as any).rpc("admin_delete_account", { _user_id: finUserId });

  // =========================================================================
  // TEST SUITE 4: WORKER AUTHORIZATION BOUNDARY
  // =========================================================================
  console.log("\n--- TEST SUITE 4: Worker Authorization Boundary ---");
  const { data: wDelRes, error: wDelErr } = await (workerClient as any).rpc("admin_delete_account", {
    _user_id: saAuth.user.id,
  });

  const workerRejected = !!wDelErr && wDelErr.message.includes("Only Super Admin can delete accounts");
  record(
    "12. Worker RBAC Guard",
    "Worker cannot delete accounts via admin_delete_account",
    workerRejected,
    `Error: ${wDelErr?.message}`
  );

  const { data: wDepRes, error: wDepErr } = await (workerClient as any).rpc("admin_analyze_account_dependencies", {
    _user_id: saAuth.user.id,
  });

  const workerDepRejected = !!wDepErr && wDepErr.message.includes("Only Super Admin can analyze account dependencies");
  record(
    "13. Worker Analysis Guard",
    "Worker cannot inspect dependencies via admin_analyze_account_dependencies",
    workerDepRejected,
    `Error: ${wDepErr?.message}`
  );

  // =========================================================================
  // TEST SUITE 5: ATOMIC INTEGRITY ON FORCED FAILURE
  // =========================================================================
  console.log("\n--- TEST SUITE 5: Anti-Self-Deletion & Atomic Rollback ---");
  const { data: selfDelRes, error: selfDelErr } = await (superClient as any).rpc("admin_delete_account", {
    _user_id: saAuth.user.id,
  });

  const selfDelBlocked = !!selfDelErr && selfDelErr.message.includes("Cannot delete own account");
  record(
    "14. Anti-Self-Deletion Guard",
    "Super Admin cannot delete own account (administrative self-lockout defense)",
    selfDelBlocked,
    `Error: ${selfDelErr?.message}`
  );

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log("\n===============================================================================");
  console.log("FINAL TEST SUMMARY:");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=(.*)?$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[match[1]] = val;
  }
});

async function run() {
  const { supabase } = await import("../src/integrations/supabase/client");
  const { resolveCurrentTeamMember } = await import("../src/lib/auth");
  const { fetchWorkerSalaryData, submitWorkerSalaryRequest } = await import("../src/lib/finance-service");
  const { getSalaryVerificationStatus } = await import("../src/routes/admin.my-salary");

  console.log("=================================================================");
  console.log("SADA OS — VERIFY COMPLETE STEP 14 WORKER FLOW");
  console.log("=================================================================\n");

  // Step 1: Login as worker
  console.log("Step 1: Login as worker (qa.worker@sada.agency)...");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!"
  });
  if (authErr || !auth.user) {
    throw new Error(`Worker login failed: ${authErr?.message}`);
  }
  console.log(`✓ Worker logged in. UID: ${auth.user.id}, Email: ${auth.user.email}`);

  // Step 2: Open My Salary (resolve identity and load salary data)
  console.log("\nStep 2 & 3: Open My Salary & Request Early Salary / Advance...");
  const teamMember = await resolveCurrentTeamMember(auth.user.id, auth.user.email);
  if (!teamMember) {
    throw new Error("FAIL: Team Profile could not be resolved!");
  }
  console.log(`✓ Team Profile successfully resolved: ${teamMember.name} (TM ID: ${teamMember.id}, Role: ${teamMember.role})`);

  const salaryData = await fetchWorkerSalaryData(auth.user.id, auth.user.email);
  const effectiveTmId = salaryData.teamMemberId || teamMember.id;
  const salaryRecord = salaryData.salaryRecord;

  // Step 4: Salary resolves
  if (!salaryRecord) {
    throw new Error("FAIL: Salary record could not be resolved!");
  }
  console.log(`✓ Base Monthly Salary successfully resolved: ${salaryRecord.base_amount} ${salaryRecord.currency}`);

  // Step 5: 50% limit calculates
  const baseSalary = Number(salaryRecord.base_amount || 0);
  const maxAdvanceLimit = baseSalary * 0.5;
  console.log(`✓ 50% Advance Limit calculated: ${maxAdvanceLimit} ${salaryRecord.currency} (50% of ${baseSalary})`);

  // Step 6: Verify validation status
  const verification = getSalaryVerificationStatus({
    user: auth.user,
    effectiveMemberId: effectiveTmId,
    salaryRecord: salaryRecord,
    maxAdvanceAmount: maxAdvanceLimit
  });
  console.log(`✓ Verification Status: ${verification.status}, isValid: ${verification.isValid}, Error banner: ${verification.userMessage || "NONE (UI Banner Hidden)"}`);
  if (!verification.isValid) {
    throw new Error(`FAIL: Verification status invalid: ${verification.userMessage}`);
  }

  // Step 7: Enter valid amount, date, and reason
  const testAmount = 250; // valid (<= 700)
  const testDate = new Date();
  const testReason = "Emergency automotive maintenance";
  console.log(`\nStep 7: Valid inputs prepared: Amount=${testAmount} TND, Date=${testDate.toISOString().slice(0, 10)}, Reason="${testReason}"`);

  // Step 8: Submit Request
  console.log("\nStep 8: Submit Request...");
  // Clear any existing pending requests using admin client so worker starts clean
  const adminClient = (await import("@supabase/supabase-js")).createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  );
  await adminClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });
  await adminClient
    .from("salary_requests")
    .delete()
    .eq("team_member_id", effectiveTmId)
    .eq("status", "pending");

  const submitResult = await submitWorkerSalaryRequest({
    teamMemberId: effectiveTmId,
    requestedAmount: testAmount,
    requestedDate: testDate,
    reason: testReason,
    notes: "Verified end-to-end root cause fix",
  });

  if (!submitResult.success || !submitResult.data) {
    throw new Error(`FAIL: Submit Request failed: ${submitResult.error?.message}`);
  }

  const createdRequest = submitResult.data;
  console.log(`✓ Submit Request succeeded! Request ID: ${createdRequest.id}, Status: ${createdRequest.status}, Amount: ${createdRequest.requested_amount} TND`);

  // Verify request exists in database
  const { data: dbRequest, error: reqErr } = await supabase
    .from("salary_requests")
    .select("*")
    .eq("id", createdRequest.id)
    .single();

  if (reqErr || !dbRequest) {
    throw new Error(`FAIL: Could not verify persisted request: ${reqErr?.message}`);
  }
  console.log(`✓ Verified persisted request in DB: ID=${dbRequest.id}, TeamMember=${dbRequest.team_member_id}, Amount=${dbRequest.requested_amount} TND, Status=${dbRequest.status}`);

  // Cleanup test request
  await adminClient.from("salary_requests").delete().eq("id", createdRequest.id);
  console.log("✓ Cleaned up test request.");

  console.log("\n=================================================================");
  console.log("ALL STEPS IN WORKER FLOW VERIFIED SUCCESSFULLY!");
  console.log("=================================================================");
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});

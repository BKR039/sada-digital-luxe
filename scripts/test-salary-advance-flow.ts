import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Ensure process.env has Supabase variables before importing application modules
const envContent = fs.readFileSync(".env", "utf-8");
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

async function runSalaryAdvanceTestSuite() {
  const { supabase } = await import("../src/integrations/supabase/client");
  const { fetchWorkerSalaryData, submitWorkerSalaryRequest, upsertSalaryRecord } = await import("../src/lib/finance-service");
  const { resolveCurrentTeamMember } = await import("../src/lib/auth");
  const { getSalaryVerificationStatus } = await import("../src/routes/admin.my-salary");

  console.log("=================================================================");
  console.log("SADA OS — SALARY ADVANCE / EARLY SALARY REQUEST TEST SUITE");
  console.log("Verifying Complete Worker -> Team Profile -> Compensation Flow");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✓ [Test ${total}] ${testName}${detail ? ` (${detail})` : ""}`);
    } else {
      console.error(`✗ [Test ${total}] FAILED: ${testName}${detail ? ` (${detail})` : ""}`);
      process.exitCode = 1;
    }
  }

  // -----------------------------------------------------------------
  // PART 0: Unit Verification of Internal Error States & Mappings
  // -----------------------------------------------------------------
  console.log("--- PART 0: Internal Verification States & Mappings ---");
  const stateUnauth = getSalaryVerificationStatus({
    user: null,
    effectiveMemberId: null,
    salaryRecord: null,
    maxAdvanceAmount: 0,
  });
  assert(
    stateUnauth.status === "UNAUTHORIZED_PROFILE_ACCESS" && !stateUnauth.isValid,
    "Status UNAUTHORIZED_PROFILE_ACCESS returned when user is null",
    stateUnauth.userMessage || ""
  );

  const stateNoTm = getSalaryVerificationStatus({
    user: { id: "test-user-id" },
    effectiveMemberId: null,
    salaryRecord: null,
    maxAdvanceAmount: 0,
  });
  assert(
    stateNoTm.status === "PROFILE_NOT_FOUND" && !stateNoTm.isValid,
    "Status PROFILE_NOT_FOUND returned when team member is unlinked",
    stateNoTm.userMessage || ""
  );

  const stateNoSalary = getSalaryVerificationStatus({
    user: { id: "test-user-id" },
    effectiveMemberId: "test-tm-id",
    salaryRecord: null,
    maxAdvanceAmount: 0,
  });
  assert(
    stateNoSalary.status === "COMPENSATION_PROFILE_NOT_FOUND" && !stateNoSalary.isValid,
    "Status COMPENSATION_PROFILE_NOT_FOUND returned when salary record is missing",
    stateNoSalary.userMessage || ""
  );

  const stateInactiveSalary = getSalaryVerificationStatus({
    user: { id: "test-user-id" },
    effectiveMemberId: "test-tm-id",
    salaryRecord: { base_amount: 1000, status: "inactive" } as any,
    maxAdvanceAmount: 500,
  });
  assert(
    stateInactiveSalary.status === "INVALID_COMPENSATION_DATA" && !stateInactiveSalary.isValid,
    "Status INVALID_COMPENSATION_DATA returned when status is not active",
    stateInactiveSalary.userMessage || ""
  );

  const stateZeroBase = getSalaryVerificationStatus({
    user: { id: "test-user-id" },
    effectiveMemberId: "test-tm-id",
    salaryRecord: { base_amount: 0, status: "active" } as any,
    maxAdvanceAmount: 0,
  });
  assert(
    stateZeroBase.status === "BASE_SALARY_NOT_CONFIGURED" && !stateZeroBase.isValid,
    "Status BASE_SALARY_NOT_CONFIGURED returned when base salary is 0",
    stateZeroBase.userMessage || ""
  );

  const stateConfigured = getSalaryVerificationStatus({
    user: { id: "test-user-id" },
    effectiveMemberId: "test-tm-id",
    salaryRecord: { base_amount: 1000, status: "active" } as any,
    maxAdvanceAmount: 500,
  });
  assert(
    stateConfigured.status === "CONFIGURED" && stateConfigured.isValid && stateConfigured.userMessage === null,
    "Status CONFIGURED returns isValid: true and zero error message",
    "No banner displayed to worker"
  );

  // -----------------------------------------------------------------
  // CASE A: Worker has valid salary profile (qa.worker@sada.agency)
  // -----------------------------------------------------------------
  console.log("\n--- CASE A: Worker with Valid Compensation Profile ---");
  const { data: workerAuth, error: wErr } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  assert(!wErr && !!workerAuth.user, "Worker authentication succeeds", `UID: ${workerAuth?.user?.id}`);

  // 1. Resolve identity
  const currentTm = await resolveCurrentTeamMember(workerAuth.user.id, workerAuth.user.email);
  assert(
    !!currentTm && !!currentTm.id,
    "Worker team member identity resolved via resolveCurrentTeamMember",
    `TM ID: ${currentTm?.id}, Name: ${currentTm?.name}`
  );

  // 2. Fetch worker salary data
  const salaryData = await fetchWorkerSalaryData(workerAuth.user.id, workerAuth.user.email);
  assert(
    salaryData.teamMemberId === currentTm?.id,
    "fetchWorkerSalaryData resolves correct teamMemberId",
    `Resolved: ${salaryData.teamMemberId}`
  );

  assert(
    !!salaryData.salaryRecord && Number(salaryData.salaryRecord.base_amount) > 0,
    "Authoritative salary record loaded for worker",
    `Base amount: ${salaryData.salaryRecord?.base_amount} TND, Status: ${salaryData.salaryRecord?.status}`
  );

  // 3. Compute 50% max advance
  const baseSalary = Number(salaryData.salaryRecord!.base_amount);
  const maxAdvance = (baseSalary * 50) / 100;
  assert(
    maxAdvance === baseSalary * 0.5,
    "Maximum advance calculated as 50% of base salary",
    `50% of ${baseSalary} TND = ${maxAdvance} TND`
  );

  // Clean up any stale pending requests for this worker before test
  await supabase
    .from("salary_requests")
    .delete()
    .eq("team_member_id", salaryData.teamMemberId!)
    .eq("reason", "Advance for urgent family travel");

  // 4. Submit valid request (300 TND <= 700 TND)
  let createdRequestId: string | null = null;
  const submitRes = await submitWorkerSalaryRequest({
    teamMemberId: salaryData.teamMemberId!,
    requestedAmount: 300,
    reason: "Advance for urgent family travel",
    workerName: currentTm?.name,
  });

  assert(
    submitRes.success && !!submitRes.data?.id,
    "Worker submits valid advance request (300 TND <= 700 TND)",
    `Request ID: ${submitRes.data?.id}`
  );
  createdRequestId = submitRes.data?.id;

  // 5. Verify database persistence
  if (createdRequestId) {
    const { data: verifiedReq } = await supabase
      .from("salary_requests")
      .select("id, requested_amount, status")
      .eq("id", createdRequestId)
      .single();

    assert(
      verifiedReq?.status === "pending" && Number(verifiedReq?.requested_amount) === 300,
      "Salary advance request persisted in database with pending status",
      `ID: ${createdRequestId}, Amount: 300 TND`
    );
  }

  // 6. Duplicate pending request prevention
  const dupRes = await submitWorkerSalaryRequest({
    teamMemberId: salaryData.teamMemberId!,
    requestedAmount: 100,
    reason: "Second request attempt while first is pending",
    workerName: currentTm?.name,
  });
  assert(
    !dupRes.success && dupRes.errorCode === "PENDING_REQUEST_EXISTS",
    "Duplicate pending request correctly blocked while previous request is pending",
    `Error: "${dupRes.error?.message}"`
  );

  // -----------------------------------------------------------------
  // CASE B: Worker with Incomplete Compensation Profile
  // -----------------------------------------------------------------
  console.log("\n--- CASE B: Worker with Incomplete Compensation Profile ---");
  // Find a worker with active team profile but NO salary record
  const { data: noSalTms } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .not("id", "in", `(${salaryData.teamMemberId})`);

  let testUnconfiguredTmId: string | null = null;
  for (const t of noSalTms || []) {
    const { data: s } = await supabase.from("salary_records").select("id").eq("team_member_id", t.id).maybeSingle();
    if (!s) {
      testUnconfiguredTmId = t.id;
      break;
    }
  }

  assert(Boolean(testUnconfiguredTmId), "Target test worker has no salary record in database", `TM: ${testUnconfiguredTmId}`);

  let incompleteErrorMsg = "";
  let incompleteCode = "";
  if (testUnconfiguredTmId) {
    const res = await submitWorkerSalaryRequest({
      teamMemberId: testUnconfiguredTmId,
      requestedAmount: 200,
      reason: "Advance test on unconfigured worker",
    });
    incompleteErrorMsg = res.error?.message || "";
    incompleteCode = res.errorCode || "";
  }

  assert(
    incompleteCode === "COMPENSATION_PROFILE_NOT_FOUND" && incompleteErrorMsg.includes("salary profile has not been configured"),
    "Submission prevented with clear error when compensation profile is incomplete",
    `Error: "${incompleteErrorMsg}" (Code: ${incompleteCode})`
  );

  // -----------------------------------------------------------------
  // CASE C: RLS Security Isolation
  // -----------------------------------------------------------------
  console.log("\n--- CASE C: RLS Security Isolation ---");
  // As qa.worker, query all salary_records
  const { data: allWorkerRecords } = await supabase.from("salary_records").select("id, team_member_id, base_amount");
  assert(
    !!allWorkerRecords && allWorkerRecords.every((r) => r.team_member_id === currentTm?.id),
    "Worker SELECT on salary_records is strictly isolated to own record(s) under RLS",
    `Returned ${allWorkerRecords?.length} row(s), all matching own team_member_id`
  );

  // As qa.worker, attempt to insert salary request for another team member
  const { error: forgedInsertErr } = await supabase.from("salary_requests").insert({
    team_member_id: "1ca08e63-0b39-4247-bcc8-ce58f71178b2", // Sarah Chen's ID
    requested_amount: 100,
    reason: "Forged request attempt",
    status: "pending",
  });
  assert(
    !!forgedInsertErr,
    "RLS prevents worker from inserting salary request for another team member",
    `Blocked with: ${forgedInsertErr?.message}`
  );

  // -----------------------------------------------------------------
  // CASE D: Worker requests more than 50% limit or invalid inputs
  // -----------------------------------------------------------------
  console.log("\n--- CASE D: Exceeding 50% Limit & Input Validation ---");
  const exceedRes = await submitWorkerSalaryRequest({
    teamMemberId: salaryData.teamMemberId!,
    requestedAmount: 750, // > 700 TND (50% of 1400)
    reason: "Exceeding limit test",
  });

  assert(
    !exceedRes.success && exceedRes.errorCode === "EXCEEDS_MAX_ADVANCE",
    "Validation strictly prevents requesting more than 50% of base monthly salary",
    `Error: "${exceedRes.error?.message}"`
  );

  // Invalid amount (0)
  const zeroAmtRes = await submitWorkerSalaryRequest({
    teamMemberId: salaryData.teamMemberId!,
    requestedAmount: 0,
    reason: "Zero amount test",
  });
  assert(
    !zeroAmtRes.success && zeroAmtRes.errorCode === "INVALID_INPUT",
    "Validation rejects amount <= 0 TND",
    `Error: "${zeroAmtRes.error?.message}"`
  );

  // Missing reason
  const noReasonRes = await submitWorkerSalaryRequest({
    teamMemberId: salaryData.teamMemberId!,
    requestedAmount: 100,
    reason: "",
  });
  assert(
    !noReasonRes.success && noReasonRes.errorCode === "INVALID_INPUT",
    "Validation rejects empty reason",
    `Error: "${noReasonRes.error?.message}"`
  );

  // -----------------------------------------------------------------
  // CASE E: Admin views and manages worker compensation
  // -----------------------------------------------------------------
  console.log("\n--- CASE E: Admin Views and Configures Worker Compensation ---");
  await supabase.auth.signOut();

  const { data: adminAuth, error: aErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!aErr && !!adminAuth.user, "Super Admin authenticated successfully");

  // Admin views worker salary record
  const { data: adminViewRec } = await supabase
    .from("salary_records")
    .select("*, team_member:team_members(name)")
    .eq("team_member_id", currentTm?.id)
    .single();

  assert(
    !!adminViewRec && Number(adminViewRec.base_amount) === 1400,
    "Admin views identical authoritative base salary record",
    `Amount: ${adminViewRec?.base_amount} TND, Worker: ${adminViewRec?.team_member?.name}`
  );

  // Admin configures/updates compensation profile for unconfigured worker
  if (testUnconfiguredTmId) {
    const upsertRes = await upsertSalaryRecord({
      teamMemberId: testUnconfiguredTmId,
      baseAmount: 1250,
      salaryType: "monthly",
      paymentFrequency: "monthly",
      paymentMethod: "Bank Transfer",
      status: "active",
      actorId: adminAuth.user.id,
      actorName: "Super Admin",
    });
    assert(upsertRes.success, "Admin successfully configures compensation profile for worker", "1250 TND");

    // Verify the newly configured record is queryable
    const { data: newWorkerSalary } = await supabase
      .from("salary_records")
      .select("*")
      .eq("team_member_id", testUnconfiguredTmId)
      .single();

    assert(
      !!newWorkerSalary && Number(newWorkerSalary.base_amount) === 1250 && newWorkerSalary.status === "active",
      "Newly configured worker salary record is persisted authoritatively",
      `Base: ${newWorkerSalary?.base_amount} TND, Status: ${newWorkerSalary?.status}`
    );

    // Verify 50% max advance for the newly configured worker is 625 TND
    const newMaxAdvance = (Number(newWorkerSalary!.base_amount) * 50) / 100;
    assert(newMaxAdvance === 625, "Maximum advance for newly configured worker is 50% of 1250 = 625 TND");

    // Clean up temporary salary record
    await supabase.from("salary_records").delete().eq("team_member_id", testUnconfiguredTmId);
  }

  // -----------------------------------------------------------------
  // CLEANUP TEST ARTIFACTS
  // -----------------------------------------------------------------
  console.log("\n--- Cleaning up temporary test artifacts ---");
  if (createdRequestId) {
    await supabase.from("salary_requests").delete().eq("id", createdRequestId);
  }
  console.log("Cleanup finished.");

  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${total - passed}`);
  console.log("=================================================================");
}

runSalaryAdvanceTestSuite();

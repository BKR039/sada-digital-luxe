import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function run() {
  const { supabase } = await import("../src/integrations/supabase/client");
  const { clockIn, clockOut } = await import("../src/lib/team-cost-service");
  const { fetchWorkerSalaryData, submitWorkerSalaryRequest } = await import("../src/lib/finance-service");

  console.log("=== TESTING WORKER CLOCK-IN & SALARY REPAIR ===");
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!"
  });

  if (authError || !authData.user) {
    console.error("Worker login failed:", authError);
    process.exit(1);
  }

  console.log("Worker logged in:", authData.user.id);

  // 1. Test fetching worker salary data
  console.log("\n--- Testing fetchWorkerSalaryData ---");
  const salaryData = await fetchWorkerSalaryData(authData.user.id);
  console.log("Salary Data Loaded:", {
    teamMemberId: salaryData.teamMemberId,
    hasSalaryRecord: !!salaryData.salaryRecord,
    baseSalary: salaryData.salaryRecord?.base_salary,
    hourlyRate: salaryData.salaryRecord?.hourly_rate,
    paymentsCount: salaryData.payments.length,
    requestsCount: salaryData.requests.length,
    commissionsCount: salaryData.commissions.length,
    workSessionsCount: salaryData.workSessions.length
  });

  if (!salaryData.teamMemberId || !salaryData.salaryRecord) {
    console.error("FAIL: Missing team member or salary record!");
    process.exit(1);
  }

  // 2. Test Clock In & Clock Out
  console.log("\n--- Testing Clock In & Clock Out ---");
  const clockInResult = await clockIn({
    profileId: authData.user.id,
    teamMemberId: salaryData.teamMemberId,
    sessionType: "production",
    description: "Automated verification clock in"
  });

  console.log("Clock In Result:", {
    success: clockInResult.success,
    sessionId: clockInResult.session?.id,
    status: clockInResult.session?.status,
    hourlyCostRate: clockInResult.session?.hourly_cost_rate,
    error: clockInResult.error?.message
  });

  if (!clockInResult.success || !clockInResult.session) {
    console.error("FAIL: Clock in failed:", clockInResult.error);
    process.exit(1);
  }

  console.log("Waiting 1s before Clock Out...");
  await new Promise((res) => setTimeout(res, 1000));

  const clockOutResult = await clockOut({
    sessionId: clockInResult.session.id,
    description: "Session completed successfully"
  });
  console.log("Clock Out Result:", {
    success: clockOutResult.success,
    sessionId: clockOutResult.session?.id,
    status: clockOutResult.session?.status,
    durationMinutes: clockOutResult.session?.duration_minutes,
    laborCost: clockOutResult.session?.labor_cost,
    error: clockOutResult.error?.message
  });
  if (!clockOutResult.success) {
    console.error("FAIL: Clock out failed:", clockOutResult.error);
    process.exit(1);
  }

  // 3. Test submitting salary advance request
  console.log("\n--- Testing submitWorkerSalaryRequest ---");
  const requestResult = await submitWorkerSalaryRequest({
    teamMemberId: salaryData.teamMemberId,
    requestedAmount: 250,
    reason: "Automated test advance verification",
    notes: "Verified via script"
  });
  console.log("Submit Advance Result:", {
    success: requestResult.success,
    data: requestResult.data ? "Request recorded" : undefined,
    error: requestResult.error?.message
  });
  if (!requestResult.success) {
    console.error("FAIL: Salary request failed:", requestResult.error);
    process.exit(1);
  }

  // 4. Test RLS boundary: Worker cannot see other team members' salary records
  console.log("\n--- Testing RLS Isolation on Salary Records ---");
  const { data: allSalaries, error: salariesErr } = await supabase
    .from("salary_records")
    .select("*");
  
  console.log("Salary records visible to worker:", allSalaries?.length);
  const otherSalaries = (allSalaries || []).filter(
    (s: any) => s.team_member_id !== salaryData.teamMemberId
  );
  console.log("Other workers' salary records visible (must be 0):", otherSalaries.length);
  if (otherSalaries.length > 0) {
    console.error("SECURITY VIOLATION: Worker can see other members' salary records!");
    process.exit(1);
  }

  console.log("\n✅ ALL CLOCK-IN & SALARY REPAIRS VERIFIED SUCCESSFULLY!");
}

run().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

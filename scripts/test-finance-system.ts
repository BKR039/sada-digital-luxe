import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  canViewFinance,
  canManageFinance,
  canManageSalaries,
  canApproveSalaryRequest,
  canViewOwnCompensation,
  canRequestEarlyPayment,
  assertCanViewFinance,
  assertCanManageFinance,
  assertCanApproveSalaryRequest,
  type PermissionContext,
} from "../src/lib/permissions";
import {
  formatCurrency,
  type FinancialPeriod,
  type FinancialSummaryKPIs,
  type IncomeTransaction,
  type ExpenseTransaction,
} from "../src/types/finance";
import {
  generateDeterministicInsights,
  getPresetPeriod,
  getPreviousComparisonPeriod,
} from "../src/lib/finance-service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

// Load .env
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function runFinanceTestSuite() {
  console.log("=================================================================");
  console.log("SADA — FINANCIAL COMMAND CENTER & WORKER SALARY CENTER E2E TESTS");
  console.log("=================================================================\n");

  // -------------------------------------------------------------
  // PART 1: RBAC & PERMISSION ENGINE VALIDATION
  // -------------------------------------------------------------
  console.log("--- PART 1: Role Matrix & Financial Permissions ---");

  const superAdminCtx: PermissionContext = { role: "super_admin", userId: "super-admin-uuid" };
  const adminCtx: PermissionContext = { role: "admin", userId: "admin-uuid" };
  const workerCtx: PermissionContext = {
    role: "worker",
    userId: "worker-uuid",
    memberProfileId: "worker-profile-uuid",
    memberId: "worker-member-uuid",
  };

  // Company Finance access: Super Admin ONLY
  assert(canViewFinance(superAdminCtx) === true, "Super Admin CAN view Finance");
  assert(canViewFinance(adminCtx) === false, "Admin CANNOT view Finance (strictly isolated)");
  assert(canViewFinance(workerCtx) === false, "Worker CANNOT view Finance (strictly isolated)");

  assert(canManageFinance(superAdminCtx) === true, "Super Admin CAN manage Finance");
  assert(canManageFinance(adminCtx) === false, "Admin CANNOT manage Finance");
  assert(canManageFinance(workerCtx) === false, "Worker CANNOT manage Finance");

  assert(canManageSalaries(superAdminCtx) === true, "Super Admin CAN manage salaries");
  assert(canManageSalaries(adminCtx) === false, "Admin CANNOT manage salaries");
  assert(canManageSalaries(workerCtx) === false, "Worker CANNOT manage salaries");

  assert(canApproveSalaryRequest(superAdminCtx) === true, "Super Admin CAN approve salary requests");
  assert(canApproveSalaryRequest(adminCtx) === false, "Admin CANNOT approve salary requests");
  assert(canApproveSalaryRequest(workerCtx) === false, "Worker CANNOT approve salary requests");

  // Worker compensation access: Workers, Admins, Super Admins can all view their own
  assert(canViewOwnCompensation(superAdminCtx) === true, "Super Admin can view own compensation");
  assert(canViewOwnCompensation(adminCtx) === true, "Admin can view own compensation");
  assert(canViewOwnCompensation(workerCtx) === true, "Worker can view own compensation");

  assert(canRequestEarlyPayment(superAdminCtx) === true, "Super Admin can request early payment");
  assert(canRequestEarlyPayment(adminCtx) === true, "Admin can request early payment");
  assert(canRequestEarlyPayment(workerCtx) === true, "Worker can request early payment");

  // Assertion guards
  let threwForAdminFinance = false;
  try {
    assertCanViewFinance(adminCtx);
  } catch {
    threwForAdminFinance = true;
  }
  assert(threwForAdminFinance, "assertCanViewFinance correctly throws for Admin");

  let threwForWorkerApproval = false;
  try {
    assertCanApproveSalaryRequest(workerCtx);
  } catch {
    threwForWorkerApproval = true;
  }
  assert(threwForWorkerApproval, "assertCanApproveSalaryRequest correctly throws for Worker");

  // -------------------------------------------------------------
  // PART 2: CURRENCY & PERIOD CALCULATIONS
  // -------------------------------------------------------------
  console.log("\n--- PART 2: Canonical Currency & Period Presets ---");

  assert(formatCurrency(1200) === "1,200 TND", `formatCurrency(1200) = '1,200 TND'`);
  assert(formatCurrency(0) === "0 TND", `formatCurrency(0) = '0 TND'`);
  assert(formatCurrency(14500.5) === "14,500.500 TND", `formatCurrency(14500.5) = '14,500.500 TND'`);

  const monthPeriod = getPresetPeriod("this_month");
  assert(Boolean(monthPeriod.startDate && monthPeriod.endDate), "getPresetPeriod('this_month') generates valid boundaries");
  assert(monthPeriod.startDate <= monthPeriod.endDate, "Start date <= End date");

  const prevMonthPeriod = getPreviousComparisonPeriod(monthPeriod);
  assert(prevMonthPeriod.startDate < monthPeriod.startDate, "Previous period starts before current period");

  // -------------------------------------------------------------
  // PART 3: DETERMINISTIC SMART INSIGHTS ENGINE
  // -------------------------------------------------------------
  console.log("\n--- PART 3: Deterministic Financial Insights Engine ---");

  const mockPeriod: FinancialPeriod = {
    preset: "this_month",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    label: "September 2026",
  };

  const mockKPIs: FinancialSummaryKPIs = {
    totalIncome: 12400,
    totalExpenses: 8300,
    netCashFlow: 4100,
    totalSalaries: 4500,
    recurringBurn: 1200,
    pendingIncome: 2000,
    pendingExpenses: 500,
    pendingSalaryRequestsCount: 1,
    pendingSalaryRequestsTotal: 300,
    prevTotalIncome: 10000,
    prevTotalExpenses: 7000,
    prevNetCashFlow: 3000,
    incomeDeltaPercent: 24,
    expenseDeltaPercent: 18.57,
  };

  const mockExpenses: any[] = [
    { id: "e1", title: "Monthly Payroll", amount: 4500, status: "paid", category_name: "Salaries" },
    { id: "e2", title: "Adobe Cloud & Figma", amount: 1500, status: "paid", category_name: "Software & Subscriptions" },
    { id: "e3", title: "Camera Gear Lease", amount: 1300, status: "paid", category_name: "Production & Video" },
    { id: "e4", title: "Google Ads", amount: 1000, status: "paid", category_name: "Advertising & Marketing" },
  ];

  const mockIncomes: any[] = [
    { id: "i1", title: "Luxury Hotel Retainer", amount: 8000, status: "received", client_name: "Hôtel Les Dunes" },
    { id: "i2", title: "Brand Identity Project", amount: 4400, status: "received", client_name: "Maison Alyssa" },
  ];

  const insights = generateDeterministicInsights({
    period: mockPeriod,
    kpis: mockKPIs,
    incomes: mockIncomes,
    expenses: mockExpenses,
    subscriptions: [],
    salaryPayments: [],
    salaryRequests: [{ id: "r1", status: "pending", requested_amount: 300 } as any],
  });

  assert(insights.length > 0, `Generated ${insights.length} deterministic insights`);

  const topCategoryInsight = insights.find((i) => i.id === "top-expense-category");
  assert(Boolean(topCategoryInsight), "Generated top expense category insight");
  assert(
    topCategoryInsight!.title.includes("Salaries") && topCategoryInsight!.description.includes("54%"),
    `Top category insight text accurate: "${topCategoryInsight!.description}"`
  );

  const cashFlowInsight = insights.find((i) => i.id === "net-cash-positive");
  assert(Boolean(cashFlowInsight), "Generated positive cash flow insight");
  assert(
    cashFlowInsight!.description.includes("4,100 TND"),
    `Cash flow insight text accurate: "${cashFlowInsight!.description}"`
  );

  const pendingReqInsight = insights.find((i) => i.id === "pending-salary-requests");
  assert(Boolean(pendingReqInsight), "Generated pending salary requests action signal");

  // -------------------------------------------------------------
  // PART 4: SUPABASE RLS & LIVE DATABASE VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- PART 4: Remote Supabase RLS & Role Isolation ---");

  // Step 4.1: Authenticate Super Admin
  const superAdminEmail = "sec.admin@sada.agency";
  const superAdminPass = "AdminPassword123!";

  const { data: saLogin, error: saLoginErr } = await client.auth.signInWithPassword({
    email: superAdminEmail,
    password: superAdminPass,
  });

  if (saLoginErr || !saLogin.user) {
    console.error("Could not sign in as Super Admin:", saLoginErr?.message);
    process.exit(1);
  }
  const superAdminUser = saLogin.user;
  console.log(`Signed in as Super Admin (${superAdminEmail}), ID: ${superAdminUser.id}`);

  // Ensure user_roles has 'super_admin'
  await client.from("user_roles").upsert(
    { user_id: superAdminUser.id, role: "super_admin" as any },
    { onConflict: "user_id,role" }
  );

  // Verify Super Admin can query categories
  const { data: categories, error: catErr } = await client
    .from("expense_categories" as any)
    .select("*")
    .order("sort_order", { ascending: true });

  assert(!catErr, `Super Admin fetched expense_categories: ${catErr?.message || "OK"}`);
  assert((categories as any[])?.length >= 9, `Found ${(categories as any[])?.length} seeded categories (expected >= 9)`);
  console.log(`Expense categories verified: ${(categories as any[]).map((c) => c.name).join(", ")}`);

  const salariesCategory = (categories as any[]).find((c) => c.slug === "salaries") || (categories as any[])[0];

  // Step 4.2: Authenticate or create Worker User
  const workerEmail = "worker.test.finance@sada.agency";
  const workerPass = "WorkerTestPassword123!";

  let workerUser: any = null;
  const { data: workerSignIn, error: workerSignInErr } = await client.auth.signInWithPassword({
    email: workerEmail,
    password: workerPass,
  });

  if (workerSignIn?.user) {
    workerUser = workerSignIn.user;
  } else {
    // Sign up worker with autoconfirm trigger
    const { data: signUpRes, error: signUpErr } = await client.auth.signUp({
      email: workerEmail,
      password: workerPass,
      options: {
        data: { display_name: "Test Worker Finance" },
      },
    });

    if (signUpErr || !signUpRes.user) {
      console.error("Could not create test worker user:", signUpErr?.message);
      process.exit(1);
    }
    workerUser = signUpRes.user;

    // Sign in now that it's autoconfirmed
    const { data: wLogin } = await client.auth.signInWithPassword({
      email: workerEmail,
      password: workerPass,
    });
    if (wLogin?.user) workerUser = wLogin.user;
  }

  assert(Boolean(workerUser?.id), `Worker user ready. ID: ${workerUser?.id}`);

  // Re-sign in as Super Admin to set up worker role & team member
  await client.auth.signInWithPassword({ email: superAdminEmail, password: superAdminPass });

  await client.from("user_roles").upsert(
    { user_id: workerUser.id, role: "worker" as any },
    { onConflict: "user_id,role" }
  );

  // Link worker to a team_members entry
  const { data: existingTm } = await client
    .from("team_members")
    .select("id, name, profile_id")
    .eq("profile_id", workerUser.id)
    .maybeSingle();

  let workerMemberId: string;
  if (existingTm?.id) {
    workerMemberId = existingTm.id;
  } else {
    const { data: newTm, error: tmInsErr } = await client
      .from("team_members")
      .insert({
        name: "Test Worker Finance",
        role: "worker",
        position: "Senior Creative Editor",
        division: "Creative",
        profile_id: workerUser.id,
        is_active: true,
        sort_order: 99,
      } as any)
      .select("id")
      .single();

    if (tmInsErr) {
      console.error("Failed to insert team member for worker:", tmInsErr.message);
      process.exit(1);
    }
    workerMemberId = (newTm as any).id;
  }

  console.log(`Worker mapped to team_member ID: ${workerMemberId}`);

  // Set salary record for this worker
  const { error: salRecErr } = await client.from("salary_records" as any).upsert(
    {
      team_member_id: workerMemberId,
      base_amount: 1500,
      currency: "TND",
      salary_type: "monthly",
      payment_frequency: "monthly",
      payment_method: "Bank Transfer",
      status: "active",
      effective_date: "2026-09-01",
      next_payment_date: "2026-09-30",
    },
    { onConflict: "team_member_id" }
  );
  assert(!salRecErr, `Super Admin configured salary_records: ${salRecErr?.message || "OK"}`);

  // -------------------------------------------------------------
  // PART 5: WORKER ISOLATION & RLS NEGATIVE TESTS
  // -------------------------------------------------------------
  console.log("\n--- PART 5: Worker Isolation & Negative RLS Tests ---");

  // Sign in as Worker
  const { error: wSignErr } = await client.auth.signInWithPassword({
    email: workerEmail,
    password: workerPass,
  });
  assert(!wSignErr, `Worker authenticated for isolation testing: ${wSignErr?.message || "OK"}`);

  // Test 5.1: Worker cannot read income_transactions
  const { data: wIncomes, error: wIncErr } = await client.from("income_transactions" as any).select("*");
  assert(
    !wIncErr && (!wIncomes || wIncomes.length === 0),
    `RLS Isolation: Worker queried income_transactions and received 0 records (Blocked by RLS)`
  );

  // Test 5.2: Worker cannot read expense_transactions
  const { data: wExpenses, error: wExpErr } = await client.from("expense_transactions" as any).select("*");
  assert(
    !wExpErr && (!wExpenses || wExpenses.length === 0),
    `RLS Isolation: Worker queried expense_transactions and received 0 records (Blocked by RLS)`
  );

  // Test 5.3: Worker cannot read subscriptions
  const { data: wSubs, error: wSubErr } = await client.from("subscriptions" as any).select("*");
  assert(
    !wSubErr && (!wSubs || wSubs.length === 0),
    `RLS Isolation: Worker queried subscriptions and received 0 records (Blocked by RLS)`
  );

  // Test 5.4: Worker cannot read financial_audit_logs
  const { data: wAudit, error: wAuditErr } = await client.from("financial_audit_logs" as any).select("*");
  assert(
    !wAuditErr && (!wAudit || wAudit.length === 0),
    `RLS Isolation: Worker queried financial_audit_logs and received 0 records (Blocked by RLS)`
  );

  // Test 5.5: Worker CAN see their own salary record
  const { data: wOwnSalary, error: wOwnSalErr } = await client
    .from("salary_records" as any)
    .select("*")
    .eq("team_member_id", workerMemberId);

  assert(!wOwnSalErr, `Worker queried own salary: ${wOwnSalErr?.message || "OK"}`);
  assert((wOwnSalary as any[])?.length === 1, `Worker can view own salary record (1 found)`);
  assert(Number((wOwnSalary as any[])[0]?.base_amount) === 1500, `Worker sees own salary amount: 1500 TND`);

  // Test 5.6: Worker submits an early salary request
  const testAdvanceAmount = 350;
  const { data: reqInsert, error: reqInsertErr } = await client
    .from("salary_requests" as any)
    .insert({
      team_member_id: workerMemberId,
      requested_amount: testAdvanceAmount,
      reason: "Emergency laptop maintenance for client deliverables",
      status: "pending",
      requested_date: "2026-09-28",
    })
    .select("id, status, requested_amount")
    .single();

  assert(!reqInsertErr, `Worker submitted salary request: ${reqInsertErr?.message || "OK"}`);
  const createdRequestId = (reqInsert as any)?.id;
  assert((reqInsert as any)?.status === "pending", `Salary request status is 'pending'`);
  console.log(`Created pending salary request ID: ${createdRequestId}`);

  // Test 5.7: Worker CANNOT approve their own request
  const { error: hackApproveErr } = await client
    .from("salary_requests" as any)
    .update({ status: "approved" })
    .eq("id", createdRequestId);

  // In Postgres RLS, workers have no UPDATE policy on salary_requests, so update affects 0 rows or errors
  const { data: verifyPending } = await client
    .from("salary_requests" as any)
    .select("status")
    .eq("id", createdRequestId)
    .single();

  assert(
    (verifyPending as any)?.status === "pending",
    `Security Guard: Worker could NOT self-approve request (Status remained 'pending')`
  );

  // -------------------------------------------------------------
  // PART 6: SUPER ADMIN APPROVAL WORKFLOW & CANONICAL TRUTH
  // -------------------------------------------------------------
  console.log("\n--- PART 6: Super Admin Approval Workflow & Single Source of Truth ---");

  // Re-authenticate as Super Admin
  await client.auth.signInWithPassword({ email: superAdminEmail, password: superAdminPass });

  // Step 6.1: Super Admin approves the request
  const nowIso = new Date().toISOString();
  const { error: approveErr } = await client
    .from("salary_requests" as any)
    .update({
      status: "approved",
      reviewed_by: superAdminUser.id,
      reviewed_at: nowIso,
      review_notes: "Approved by Super Admin E2E test",
      approved_amount: testAdvanceAmount,
    })
    .eq("id", createdRequestId);

  assert(!approveErr, `Super Admin approved request: ${approveErr?.message || "OK"}`);

  // Step 6.2: Create canonical Salary Payment
  const { data: newPayment, error: payErr } = await client
    .from("salary_payments" as any)
    .insert({
      team_member_id: workerMemberId,
      amount: testAdvanceAmount,
      currency: "TND",
      payment_type: "advance",
      status: "paid",
      payment_date: nowIso.split("T")[0],
      period_start: "2026-09-01",
      period_end: "2026-09-30",
      salary_request_id: createdRequestId,
      notes: "Early advance approved by Super Admin",
    })
    .select("id, amount")
    .single();

  assert(!payErr, `Canonical salary_payments created: ${payErr?.message || "OK"}`);
  const paymentId = (newPayment as any)?.id;
  console.log(`Created canonical salary payment ID: ${paymentId}`);

  // Step 6.3: Canonical Outflow mirroring to expense_transactions
  const { data: newExpense, error: expErr } = await client
    .from("expense_transactions" as any)
    .insert({
      description: "Salary Advance — Test Worker",
      amount: testAdvanceAmount,
      currency: "TND",
      date: nowIso.split("T")[0],
      category_id: salariesCategory.id,
      category_name: salariesCategory.name,
      payment_method: "Bank Transfer",
      vendor: "Test Worker Finance",
      is_recurring: false,
      team_member_id: workerMemberId,
      salary_payment_id: paymentId,
      notes: "Mirrored from salary payment advance",
    })
    .select("id, amount, salary_payment_id")
    .single();

  assert(!expErr, `Mirrored expense_transactions created: ${expErr?.message || "OK"}`);
  const expenseId = (newExpense as any)?.id;
  assert(
    (newExpense as any)?.salary_payment_id === paymentId,
    `Single Source of Truth: Expense linked directly to salary_payment_id (${paymentId})`
  );
  assert(
    Number((newExpense as any)?.amount) === testAdvanceAmount,
    `Single Source of Truth: Expense amount exactly matches salary payment amount (${testAdvanceAmount} TND)`
  );

  // Step 6.4: Audit Log entry
  const { error: auditErr } = await client.from("financial_audit_logs" as any).insert({
    actor_id: superAdminUser.id,
    action: "approve_salary_request",
    entity_type: "salary_requests",
    entity_id: createdRequestId,
    details: {
      worker_id: workerMemberId,
      amount: testAdvanceAmount,
      payment_id: paymentId,
      expense_id: expenseId,
    },
  });
  assert(!auditErr, `Audit trail recorded: ${auditErr?.message || "OK"}`);

  // -------------------------------------------------------------
  // PART 7: CLEANUP OF SYNTHETIC TEST ARTIFACTS
  // -------------------------------------------------------------
  console.log("\n--- PART 7: Synthetic Data Cleanup ---");

  // Delete test expense
  if (expenseId) {
    await client.from("expense_transactions" as any).delete().eq("id", expenseId);
  }
  // Delete test payment
  if (paymentId) {
    await client.from("salary_payments" as any).delete().eq("id", paymentId);
  }
  // Delete test salary request
  if (createdRequestId) {
    await client.from("salary_requests" as any).delete().eq("id", createdRequestId);
  }
  // Delete test salary record
  await client.from("salary_records" as any).delete().eq("team_member_id", workerMemberId);

  console.log("✓ Synthetic financial records cleaned up successfully.");

  console.log("\n=================================================================");
  console.log("🎉 ALL FINANCIAL COMMAND CENTER TESTS PASSED (100% SUCCESS)");
  console.log("=================================================================");
}

runFinanceTestSuite().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});

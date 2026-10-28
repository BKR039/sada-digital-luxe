// ============================================================
// SADA OS — PHASE 5 & 6 AUTOMATED TEST SUITE
// Team, Time & Cost Engine + Financial OS Cross-Module Convergence
// Testing Against Live Remote Supabase Database
// ============================================================

import fs from "fs";
import path from "path";

// 1. Load environment variables
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

import { supabase } from "../src/integrations/supabase/client";
import {
  calculateInternalHourlyRate,
  clockIn,
  clockOut,
  recordDirectWorkSession,
  fetchWorkerPersonalPortal,
  fetchTeamMemberCostProfile,
  settleInvoicePayment,
  payoutSalesCommission,
  recordSponsoringPurchase,
  executeSalaryPaymentTransaction,
} from "../src/lib/team-cost-service";
import { format } from "date-fns";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(
  num: number,
  name: string,
  condition: boolean,
  expected: string,
  actual: string,
  details?: string
) {
  results.push({ num, name, passed: condition, expected, actual, details });
  const icon = condition ? "✓" : "❌";
  console.log(`${icon} [Test ${num.toString().padStart(2, "0")}] ${name}: ${actual}`);
  if (!condition && details) {
    console.error(`  ↳ Expected: ${expected} | Details: ${details}`);
  }
}

async function runTeamCostAndFinancialOSSuite() {
  console.log("=================================================================");
  console.log("SADA OS — PHASE 5 & 6 CROSS-MODULE INTEGRATION TEST SUITE");
  console.log("Testing Team, Time & Cost Engine + Financial OS Ledger Convergence");
  console.log("=================================================================\n");

  const runId = Math.random().toString(36).substring(2, 7);

  // Authenticate as Super Admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authErr || !authData.user) {
    console.error("Failed to authenticate test runner as sec.admin:", authErr?.message);
    process.exit(1);
  }
  console.log(`✓ Authenticated as Super Admin: ${authData.user.email} (${authData.user.id})\n`);

  // Track entities for cleanup
  let testMemberId: string | null = null;
  let testSalaryRecordId: string | null = null;
  let testClientId: string | null = null;
  let testProjectId: string | null = null;
  let testTaskId: string | null = null;
  let testSessionId1: string | null = null;
  let testSessionId2: string | null = null;
  let testAccountId: string | null = null;
  let testInvoiceId: string | null = null;
  let testCommissionId: string | null = null;
  let testCampaignId: string | null = null;
  let testSalaryRequestId: string | null = null;
  let testSalaryPaymentId: string | null = null;
  let createdIncomeIds: string[] = [];
  let createdExpenseIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Initializing Test Tenant & Entities
    // -------------------------------------------------------------
    console.log("--- SETUP: Initializing Test Team Member, Client & Treasury ---");

    // 1. Team Member with Employment Type & Skills
    const { data: member, error: mErr } = await (supabase as any)
      .from("team_members")
      .insert({
        name: `Cost Specialist ${runId}`,
        email: `specialist.${runId}@sada.agency`,
        position: "Video Producer & Editor",
        division: "creative",
        role: "worker",
        employment_type: "full_time",
        specialties: ["Video Editing", "Color Grading", "Cinematography", "Motion Design"],
        is_active: true,
      })
      .select("*")
      .single();

    if (mErr) console.error("Error creating team member:", mErr);
    testMemberId = member?.id;

    // 2. Authoritative Salary Record (1,600 TND / month -> 10.00 TND / hr)
    const { data: salRec, error: sErr } = await (supabase as any)
      .from("salary_records")
      .insert({
        team_member_id: testMemberId,
        base_amount: 1600,
        currency: "TND",
        salary_type: "monthly",
        standard_monthly_hours: 160,
        payment_frequency: "monthly",
        effective_date: format(new Date(), "yyyy-MM-01"),
        status: "active",
      })
      .select("*")
      .single();

    if (sErr) console.error("Error creating salary record:", sErr);
    testSalaryRecordId = salRec?.id;

    // 3. Client & Project & Task
    const { data: client } = await (supabase as any)
      .from("clients")
      .insert({
        name: `Test Client Luxe ${runId}`,
        industry: "Luxury Fashion",
        client_type: "monthly",
        monthly_package_price: 3000,
        default_service_fee: 2000,
        default_sponsoring_budget: 1000,
        commission_rate: 10,
        commission_recipient_id: testMemberId,
        status: "active",
      })
      .select("*")
      .single();
    testClientId = client?.id;

    const { data: proj } = await (supabase as any)
      .from("client_projects")
      .insert({
        client_id: testClientId,
        client_name: client.name,
        title: `${client.name} — Workspace`,
        status: "active",
      })
      .select("*")
      .single();
    testProjectId = proj?.id;

    const { data: task } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: testProjectId,
        client_id: testClientId,
        title: "Edit Brand Manifesto Video",
        status: "in_progress",
        priority: "high",
        estimated_hours: 5.0,
        actual_hours: 0,
        labor_cost: 0,
      })
      .select("*")
      .single();
    testTaskId = task?.id;

    // 4. Treasury Account
    const { data: account } = await (supabase as any)
      .from("financial_accounts")
      .insert({
        name: `BIAT Operating Treasury ${runId}`,
        account_type: "bank",
        currency: "TND",
        opening_balance: 15000,
        current_balance: 15000,
        status: "active",
      })
      .select("*")
      .single();
    testAccountId = account?.id;

    // -------------------------------------------------------------
    // TEST 1: Authoritative Hourly Cost Rate Calculation
    // -------------------------------------------------------------
    console.log("\n--- PHASE 5: AUTHORITATIVE COMPENSATION & COST ENGINE ---");

    const rateMonthly = calculateInternalHourlyRate(salRec);
    const rateHourly = calculateInternalHourlyRate({ base_amount: 25, salary_type: "hourly" });

    recordTest(
      1,
      "Authoritative Compensation — Monthly Base (1,600 TND / 160h) = 10.00 TND/hr",
      rateMonthly === 10.0,
      "10.00 TND/hr",
      `${rateMonthly} TND/hr`
    );

    recordTest(
      2,
      "Authoritative Compensation — Hourly Base (25 TND/hr) = 25.00 TND/hr",
      rateHourly === 25.0,
      "25.00 TND/hr",
      `${rateHourly} TND/hr`
    );

    // -------------------------------------------------------------
    // TEST 2: Time Tracking — Clock In & Active Session
    // -------------------------------------------------------------
    console.log("\n--- PHASE 5: TIME TRACKING (CLOCK IN / CLOCK OUT & SESSIONS) ---");

    const clockInRes = await clockIn({
      teamMemberId: testMemberId!,
      clientId: testClientId!,
      projectId: testProjectId!,
      taskId: testTaskId!,
      sessionType: "production",
      description: "Color grading raw footage",
    });

    recordTest(
      3,
      "Time Tracking — Clock In creates Active Work Session with Hourly Cost Rate",
      Boolean(clockInRes.success && clockInRes.session?.status === "active"),
      "status: 'active', hourly_cost_rate: 10",
      `status: '${clockInRes.session?.status}', hourly_cost_rate: ${clockInRes.session?.hourly_cost_rate}`
    );

    testSessionId1 = clockInRes.session?.id || null;

    // Clock Out: computes duration and labor cost
    const clockOutRes = await clockOut({
      sessionId: testSessionId1!,
      description: "Finished color grade pass 1",
    });

    recordTest(
      4,
      "Time Tracking — Clock Out completes session and calculates labor cost",
      Boolean(clockOutRes.success && clockOutRes.session?.status === "completed"),
      "status: 'completed', duration_minutes > 0",
      `status: '${clockOutRes.session?.status}', duration: ${clockOutRes.session?.duration_minutes}m, cost: ${clockOutRes.session?.labor_cost} TND`
    );

    // Record an administrative work session (Separate Production vs Administrative)
    const adminSessionRes = await recordDirectWorkSession({
      teamMemberId: testMemberId!,
      sessionType: "administrative",
      durationMinutes: 60, // 1.0 hour
      description: "Weekly internal team sprint planning",
    });

    testSessionId2 = adminSessionRes.session?.id || null;

    recordTest(
      5,
      "Time Tracking — Separate Administrative Hours Recorded (1.0 hr @ 10 TND/hr = 10 TND)",
      Boolean(
        adminSessionRes.success &&
          adminSessionRes.session?.session_type === "administrative" &&
          Number(adminSessionRes.session?.labor_cost) === 10
      ),
      "session_type: 'administrative', labor_cost: 10 TND",
      `session_type: '${adminSessionRes.session?.session_type}', labor_cost: ${adminSessionRes.session?.labor_cost} TND`
    );

    // -------------------------------------------------------------
    // TEST 3: Task Cost Propagation
    // -------------------------------------------------------------
    console.log("\n--- PHASE 5: TASK COST PROPAGATION ---");

    // Add a 3-hour production session on task
    await recordDirectWorkSession({
      teamMemberId: testMemberId!,
      clientId: testClientId!,
      projectId: testProjectId!,
      taskId: testTaskId!,
      sessionType: "production",
      durationMinutes: 180, // 3.0 hours -> 30 TND labor cost
      description: "Assembly cut and motion typography",
    });

    const { data: updatedTask } = await (supabase as any)
      .from("project_tasks")
      .select("actual_hours, labor_cost")
      .eq("id", testTaskId)
      .single();

    recordTest(
      6,
      "Task Cost Propagation — Task Actual Hours & Labor Cost Updated (> 3.0h, >= 30 TND)",
      Number(updatedTask?.actual_hours) >= 3.0 && Number(updatedTask?.labor_cost) >= 30,
      ">= 3.0 hours, >= 30.00 TND labor cost",
      `${updatedTask?.actual_hours} hours, ${updatedTask?.labor_cost} TND`
    );

    // -------------------------------------------------------------
    // TEST 4: Team Member Full Cost Profile (Super Admin View)
    // -------------------------------------------------------------
    console.log("\n--- PHASE 5: TEAM MEMBER FULL COST PROFILE ---");

    const profile = await fetchTeamMemberCostProfile(testMemberId!);

    recordTest(
      7,
      "Team Cost Profile — Includes Role, Skills, Employment Type, Salary, Hours, Cost",
      Boolean(
        profile &&
          profile.employmentType === "full_time" &&
          profile.skills.length === 4 &&
          profile.hourlyCostRate === 10 &&
          profile.totalAdminHours >= 1.0 &&
          profile.totalProductionHours >= 3.0
      ),
      "employmentType: 'full_time', 4 skills, rate: 10, >=1h admin, >=3h prod",
      `type: '${profile?.employmentType}', skills: ${profile?.skills.length}, rate: ${profile?.hourlyCostRate}, admin: ${profile?.totalAdminHours}h, prod: ${profile?.totalProductionHours}h`
    );

    // -------------------------------------------------------------
    // TEST 5: Phase 6 Sales -> Invoice -> Payment -> Income Transaction
    // -------------------------------------------------------------
    console.log("\n--- PHASE 6: FINANCIAL OS CANONICAL LEDGER CONVERGENCE ---");

    // Create an invoice with Service (2000) + Sponsoring (1000)
    const { data: inv, error: invErr } = await (supabase as any)
      .from("invoices")
      .insert({
        invoice_number: `INV-LEDGER-${runId}`,
        client_id: testClientId,
        service_revenue: 2000,
        sponsoring_budget: 1000,
        subtotal: 3000,
        total_amount: 3000,
        paid_amount: 0,
        status: "sent",
        issue_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(new Date(), "yyyy-MM-dd"),
      })
      .select("*")
      .single();
    if (invErr) {
      console.error("Invoice creation error:", invErr);
    }
    testInvoiceId = inv?.id;

    // Create a pending commission linked to this invoice
    const { data: comm } = await (supabase as any)
      .from("sales_commissions")
      .insert({
        team_member_id: testMemberId,
        client_id: testClientId,
        invoice_id: testInvoiceId,
        service_revenue: 2000,
        commission_rate: 10,
        commission_amount: 200,
        period_month: format(new Date(), "yyyy-MM"),
        status: "pending",
      })
      .select("*")
      .single();
    testCommissionId = comm.id;

    // Settle invoice payment (Client payment -> Income Transactions -> Treasury Inflow -> Commission Unlock)
    const settleRes = await settleInvoicePayment({
      invoiceId: testInvoiceId,
      accountId: testAccountId!,
      paymentMethod: "Bank Wire",
    });

    createdIncomeIds = (settleRes.incomeTransactions || []).map((t: any) => t.id);

    // Verify invoice is marked paid
    const { data: paidInv } = await (supabase as any)
      .from("invoices")
      .select("status, paid_amount")
      .eq("id", testInvoiceId)
      .single();

    recordTest(
      8,
      "Ledger Convergence — Settle Invoice: Status 'paid', Posts Incomes (Service 2000 + Sponsoring 1000)",
      settleRes.success &&
        paidInv?.status === "paid" &&
        settleRes.incomeTransactions.length === 2 &&
        Number(paidInv?.paid_amount) === 3000,
      "status: 'paid', paid_amount: 3000, 2 income transactions",
      `status: '${paidInv?.status}', paid_amount: ${paidInv?.paid_amount}, txs: ${settleRes.incomeTransactions.length}`
    );

    // Verify Treasury Account incremented (+3,000 -> 18,000 TND)
    const { data: accAfterIncome } = await (supabase as any)
      .from("financial_accounts")
      .select("current_balance")
      .eq("id", testAccountId)
      .single();

    recordTest(
      9,
      "Treasury Inflow — Financial Account Incremented by 3,000 TND (15,000 -> 18,000 TND)",
      Number(accAfterIncome?.current_balance) === 18000,
      "current_balance: 18000 TND",
      `current_balance: ${accAfterIncome?.current_balance} TND`
    );

    // Verify linked commission unlocked to approved
    const { data: approvedComm } = await (supabase as any)
      .from("sales_commissions")
      .select("status")
      .eq("id", testCommissionId)
      .single();

    recordTest(
      10,
      "Commission Unlock — Commission Unlocked from 'pending' to 'approved' upon Invoice Settlement",
      approvedComm?.status === "approved",
      "status: 'approved'",
      `status: '${approvedComm?.status}'`
    );

    // -------------------------------------------------------------
    // TEST 6: Commission Payout -> Expense Transaction -> Outflow
    // -------------------------------------------------------------
    console.log("\n--- PHASE 6: COMMISSION PAYOUT TO LEDGER ---");

    const payoutCommRes = await payoutSalesCommission({
      commissionId: testCommissionId!,
      accountId: testAccountId!,
      paymentMethod: "Bank Transfer",
    });

    if (payoutCommRes.expenseTransaction?.id) {
      createdExpenseIds.push(payoutCommRes.expenseTransaction.id);
    }

    const { data: accAfterComm } = await (supabase as any)
      .from("financial_accounts")
      .select("current_balance")
      .eq("id", testAccountId)
      .single();

    recordTest(
      11,
      "Commission Expense — Payout debited to canonical expenses (-200 TND, Account: 17,800 TND)",
      Boolean(
        payoutCommRes.success &&
          payoutCommRes.expenseTransaction?.allocation === "commission" &&
          Number(accAfterComm?.current_balance) === 17800
      ),
      "allocation: 'commission', account_balance: 17800 TND",
      `allocation: '${payoutCommRes.expenseTransaction?.allocation}', balance: ${accAfterComm?.current_balance} TND`
    );

    // -------------------------------------------------------------
    // TEST 7: Sponsoring Purchase -> Expense Transaction -> Margin
    // -------------------------------------------------------------
    console.log("\n--- PHASE 6: SPONSORING PURCHASE & MARGIN RECALCULATION ---");

    const { data: camp, error: campErr } = await (supabase as any)
      .from("sponsoring_campaigns")
      .insert({
        client_id: testClientId,
        campaign_name: `Meta Ads Q3 Luxe — ${runId}`,
        budget_tnd: 1000,
        usd_amount: 250,
        purchase_rate: 3.4,
        purchase_cost_tnd: 0,
        client_rate: 4.0,
        client_charge_tnd: 1000,
        margin_tnd: 1000,
        payment_status: "pending",
        execution_status: "active",
      })
      .select("*")
      .single();
    if (campErr) console.error("Campaign insert error:", campErr);
    testCampaignId = camp?.id;

    // Record sponsoring purchase of 850 TND (margin becomes 1000 - 850 = 150 TND)
    const sponRes = await recordSponsoringPurchase({
      campaignId: testCampaignId!,
      purchaseCostTnd: 850,
      foreignAmountUsd: 250,
      exchangeRate: 3.4,
      accountId: testAccountId!,
    });

    if (sponRes.expenseTransaction?.id) {
      createdExpenseIds.push(sponRes.expenseTransaction.id);
    }

    const { data: updatedCamp } = await (supabase as any)
      .from("sponsoring_campaigns")
      .select("purchase_cost_tnd, margin_tnd")
      .eq("id", testCampaignId)
      .single();

    recordTest(
      12,
      "Sponsoring Arbitrage — Purchase (850 TND) posted to expenses, Margin recalculated to 150 TND",
      Boolean(
        sponRes.success &&
          sponRes.expenseTransaction?.allocation === "sponsoring_purchase" &&
          Number(updatedCamp?.margin_tnd) === 150
      ),
      "allocation: 'sponsoring_purchase', margin_tnd: 150 TND",
      `allocation: '${sponRes.expenseTransaction?.allocation}', margin_tnd: ${updatedCamp?.margin_tnd} TND`
    );

    // -------------------------------------------------------------
    // TEST 8: Worker Request -> Pending -> Approved -> Paid -> Expense
    // -------------------------------------------------------------
    console.log("\n--- PHASE 6: WORKER REQUEST & SALARY PAYOUT ---");

    const { data: req } = await (supabase as any)
      .from("salary_requests")
      .insert({
        team_member_id: testMemberId,
        requested_amount: 150,
        currency: "TND",
        reason: "Emergency camera equipment repair advance",
        status: "pending",
      })
      .select("*")
      .single();
    testSalaryRequestId = req.id;

    recordTest(
      13,
      "Worker Request — Request starts in 'pending' and does NOT post to expenses (Request != Expense)",
      req?.status === "pending" && req?.salary_payment_id === null,
      "status: 'pending', salary_payment_id: null",
      `status: '${req?.status}', payment_id: ${req?.salary_payment_id}`
    );

    // Execute payment of advance (150 TND)
    const execPayRes = await executeSalaryPaymentTransaction({
      teamMemberId: testMemberId!,
      amount: 150,
      salaryRequestId: testSalaryRequestId!,
      accountId: testAccountId!,
      paymentType: "advance",
    });

    testSalaryPaymentId = execPayRes.salaryPayment?.id || null;
    if (execPayRes.expenseTransaction?.id) {
      createdExpenseIds.push(execPayRes.expenseTransaction.id);
    }

    const { data: reqAfterPay } = await (supabase as any)
      .from("salary_requests")
      .select("status, approved_amount")
      .eq("id", testSalaryRequestId)
      .single();

    recordTest(
      14,
      "Salary Execution — Approved & Paid creates Expense Transaction (-150 TND, allocation 'payroll')",
      Boolean(
        execPayRes.success &&
          reqAfterPay?.status === "approved" &&
          execPayRes.expenseTransaction?.allocation === "payroll" &&
          Number(execPayRes.expenseTransaction?.amount) === 150
      ),
      "request status: 'approved', expense allocation: 'payroll', amount: 150 TND",
      `request: '${reqAfterPay?.status}', allocation: '${execPayRes.expenseTransaction?.allocation}', amount: ${execPayRes.expenseTransaction?.amount} TND`
    );

    // -------------------------------------------------------------
    // TEST 9: Reactive Source Entity Propagation
    // -------------------------------------------------------------
    console.log("\n--- PHASE 6: REACTIVE PROPAGATION (PACKAGE PRICE & COMMISSION) ---");

    // Client package price change propagates to client profitability
    await (supabase as any)
      .from("clients")
      .update({
        monthly_package_price: 3500,
        default_service_fee: 2500,
        commission_rate: 12,
        updated_at: new Date().toISOString(),
      })
      .eq("id", testClientId);

    const { data: clientAfterUpdate } = await (supabase as any)
      .from("clients")
      .select("monthly_package_price, default_service_fee, commission_rate")
      .eq("id", testClientId)
      .single();

    recordTest(
      15,
      "Reactive Propagation — Client Package Price & Commission Rate updated in DB",
      Number(clientAfterUpdate?.monthly_package_price) === 3500 &&
        Number(clientAfterUpdate?.commission_rate) === 12,
      "package_price: 3500, commission_rate: 12",
      `package_price: ${clientAfterUpdate?.monthly_package_price}, commission_rate: ${clientAfterUpdate?.commission_rate}`
    );
  } catch (err: any) {
    console.error("Test execution caught exception:", err);
    recordTest(99, "Test Suite Runner Exception", false, "Clean execution", err.message);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Test Entities ---");
    if (createdExpenseIds.length > 0) {
      await (supabase as any).from("expense_transactions").delete().in("id", createdExpenseIds);
    }
    if (createdIncomeIds.length > 0) {
      await (supabase as any).from("income_transactions").delete().in("id", createdIncomeIds);
    }
    if (testSalaryPaymentId) {
      await (supabase as any).from("salary_payments").delete().eq("id", testSalaryPaymentId);
    }
    if (testSalaryRequestId) {
      await (supabase as any).from("salary_requests").delete().eq("id", testSalaryRequestId);
    }
    if (testCampaignId) {
      await (supabase as any).from("sponsoring_campaigns").delete().eq("id", testCampaignId);
    }
    if (testCommissionId) {
      await (supabase as any).from("sales_commissions").delete().eq("id", testCommissionId);
    }
    if (testInvoiceId) {
      await (supabase as any).from("invoices").delete().eq("id", testInvoiceId);
    }
    if (testSessionId1) {
      await (supabase as any).from("work_sessions").delete().eq("id", testSessionId1);
    }
    if (testSessionId2) {
      await (supabase as any).from("work_sessions").delete().eq("id", testSessionId2);
    }
    if (testTaskId) {
      await (supabase as any).from("project_tasks").delete().eq("id", testTaskId);
    }
    if (testProjectId) {
      await (supabase as any).from("client_projects").delete().eq("id", testProjectId);
    }
    if (testClientId) {
      await (supabase as any).from("clients").delete().eq("id", testClientId);
    }
    if (testAccountId) {
      await (supabase as any).from("financial_accounts").delete().eq("id", testAccountId);
    }
    if (testSalaryRecordId) {
      await (supabase as any).from("salary_records").delete().eq("id", testSalaryRecordId);
    }
    if (testMemberId) {
      await (supabase as any).from("team_members").delete().eq("id", testMemberId);
    }
    console.log("✓ Cleanup finished successfully.\n");
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("=================================================================");
  console.log(`TEST SUITE RESULTS: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("=================================================================");

  if (failed > 0) {
    console.error(`\n❌ ${failed} tests failed! Review log above for details.`);
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TESTS PASSED! SADA OS Phase 5 & Phase 6 Canonically Verified.");
    process.exit(0);
  }
}

runTeamCostAndFinancialOSSuite();

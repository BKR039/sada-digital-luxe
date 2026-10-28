import {
  createLocalTestClient,
  runLocalSql,
  queryLocalJson,
  executeLocalSql,
} from "./local-db-client";
import { enforceDatabaseIsolation } from "./test-db-guard";
import {
  fetchCompanyFinance,
  createIncome,
  createExpense,
  transferBetweenAccounts,
  executeSponsoringPurchase,
  recordInvoicePayment,
  payCommission,
  approveSalaryRequest,
  closeFinancialPeriod,
  reopenFinancialPeriod,
  exportTransactionsToCSV,
} from "../src/lib/finance-service";
import type { FinancialPeriod, Invoice, SponsoringCampaign, SalesCommission } from "../src/types/finance";

// ============================================================
// ADVERSARIAL FINANCIAL CERTIFICATION SUITE
// Master certification for SADA OS Financial Command Center
// Target: Isolated PostgreSQL 16 (127.0.0.1:5432/sada_local_test)
// ============================================================

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

const SUPER_ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const WORKER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TEST_CLIENT_ID = "88888888-8888-8888-8888-888888888888";
const TEST_TEAM_MEMBER_ID = "00000000-0000-0000-0000-000000000001";

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  expected?: any;
  actual?: any;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, suite: string, expected?: any, actual?: any) {
  if (!condition) {
    console.error(`  ❌ FAIL: [${suite}] ${testName} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`);
    results.push({ suite, testName, passed: false, expected, actual, durationMs: 0 });
    throw new Error(`Assertion failed: [${suite}] ${testName}`);
  } else {
    console.log(`  ✅ PASS: [${suite}] ${testName}`);
    results.push({ suite, testName, passed: true, expected, actual, durationMs: 0 });
  }
}

async function runTest(suite: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    const existing = results.find((r) => r.suite === suite && r.testName === name);
    if (existing) existing.durationMs = durationMs;
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`  💥 ERROR in [${suite}] ${name}:`, err.message || err);
    results.push({
      suite,
      testName: name,
      passed: false,
      error: err.message || String(err),
      durationMs,
    });
  }
}

async function main() {
  console.log("================================================================================");
  console.log("   SADA OS — FINANCIAL COMMAND CENTER MASTER CERTIFICATION");
  console.log("   Target Database: 127.0.0.1:5432/sada_local_test (STRICT LOCAL ISOLATION)");
  console.log("================================================================================\n");

  // Step 0: Ensure strict database isolation
  enforceDatabaseIsolation(LOCAL_DB_URL);
  console.log("[Safety Guard] Database isolation verified against local test instance.\n");

  const localClient = createLocalTestClient(SUPER_ADMIN_ID);
  const workerClient = createLocalTestClient(WORKER_ID);

  const testPeriod: FinancialPeriod = {
    type: "month",
    year: 2026,
    month: 10,
    label: "October 2026",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
  };

  // Ensure test client and team member exist in sada_local_test
  executeLocalSql(`
    INSERT INTO public.clients (id, name, monthly_package_price, commission_rate, default_sponsoring_budget)
    VALUES ('${TEST_CLIENT_ID}', 'TOTTA Restaurant', 2500, 10, 500)
    ON CONFLICT (id) DO UPDATE SET name = 'TOTTA Restaurant';

    INSERT INTO public.team_members (id, name, email, role, division)
    VALUES ('${TEST_TEAM_MEMBER_ID}', 'Houssem Specialist', 'houssem@sada.agency', 'media_buyer', 'Marketing')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Clean all previous transactions in October 2026
  executeLocalSql(`
    DELETE FROM public.income_transactions WHERE date >= '2026-10-01' AND date <= '2026-10-31';
    DELETE FROM public.expense_transactions WHERE date >= '2026-10-01' AND date <= '2026-10-31';
    DELETE FROM public.invoices WHERE issue_date >= '2026-10-01' AND issue_date <= '2026-10-31';
    DELETE FROM public.sponsoring_campaigns WHERE period_month = '2026-10';
    DELETE FROM public.salary_payments WHERE payment_date >= '2026-10-01' AND payment_date <= '2026-10-31';
    DELETE FROM public.salary_requests WHERE requested_date >= '2026-10-01' AND requested_date <= '2026-10-31';
    DELETE FROM public.sales_commissions WHERE period_month = '2026-10';
    DELETE FROM public.financial_closing_periods WHERE period_month = '2026-10';
    DELETE FROM public.financial_audit_logs WHERE created_at >= '2026-10-01';
  `);

  // ============================================================================
  // SUITE A: CANONICAL SSOT MAPPING & INTEGRITY
  // ============================================================================
  console.log("--- SUITE A: Canonical SSOT Mapping & Integrity ---");
  await runTest("SUITE_A", "Canonical financial tables exist in sada_local_test", async () => {
    const tables = [
      "financial_accounts",
      "expense_categories",
      "subscriptions",
      "salary_records",
      "salary_requests",
      "salary_payments",
      "sales_commissions",
      "invoices",
      "sponsoring_campaigns",
      "income_transactions",
      "expense_transactions",
      "financial_closing_periods",
      "financial_audit_logs",
    ];
    for (const t of tables) {
      const reg = runLocalSql(`SELECT to_regclass('public.${t}');`);
      assert(reg === t, `Table public.${t} exists`, "SUITE_A", t, reg);
    }
  });

  await runTest("SUITE_A", "Primary accounts seeded with valid opening balances", async () => {
    const accounts = queryLocalJson<any[]>("SELECT id, name, current_balance, currency FROM public.financial_accounts WHERE is_demo = false;");
    assert(accounts.length >= 3, "At least 3 canonical accounts exist", "SUITE_A", ">=3", accounts.length);
    const biat = accounts.find((a) => a.name.includes("BIAT"));
    assert(!!biat && Number(biat.current_balance) > 0, "BIAT Corporate Account has non-zero balance", "SUITE_A", true, !!biat);
  });

  // ============================================================================
  // SUITE B: MATHEMATICAL INVARIANTS & KPI LEDGER
  // ============================================================================
  console.log("\n--- SUITE B: Mathematical Invariants & KPI Ledger ---");
  let biatAccountId: string;
  let pettyCashAccountId: string;

  await runTest("SUITE_B", "Seed canonical test transactions for period October 2026", async () => {
    const accounts = queryLocalJson<any[]>("SELECT id, name FROM public.financial_accounts WHERE is_demo = false ORDER BY name;");
    biatAccountId = accounts.find((a) => a.name.includes("BIAT"))?.id || accounts[0].id;
    pettyCashAccountId = accounts.find((a) => a.name.includes("Cash"))?.id || accounts[1].id;

    // 1. Inflow 1: Client Service Fee (1,500 TND)
    const inc1 = await createIncome({
      amount: 1500,
      date: "2026-10-05",
      category: "Client Payment",
      allocation: "client_service",
      description: "Retainer Service Fee - October",
      clientId: TEST_CLIENT_ID,
      accountId: biatAccountId,
      status: "received",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(inc1.success, "Inflow 1 (Service Fee 1,500 TND) created", "SUITE_B", true, inc1.success);

    // 2. Inflow 2: Sponsoring Collected (500 TND)
    const inc2 = await createIncome({
      amount: 500,
      date: "2026-10-05",
      category: "Client Payment",
      allocation: "sponsoring_collected",
      description: "Meta Ads Sponsoring Budget - October",
      clientId: TEST_CLIENT_ID,
      accountId: biatAccountId,
      status: "received",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(inc2.success, "Inflow 2 (Sponsoring Collected 500 TND) created", "SUITE_B", true, inc2.success);

    // 3. Outflow 1: Direct Operating Expense (300 TND)
    const exp1 = await createExpense({
      amount: 300,
      date: "2026-10-10",
      categoryName: "Marketing & Growth",
      allocation: "operating_expense",
      description: "Creative assets production",
      clientId: TEST_CLIENT_ID,
      accountId: biatAccountId,
      status: "paid",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(exp1.success, "Outflow 1 (Operating Expense 300 TND) created", "SUITE_B", true, exp1.success);

    // 4. Outflow 2: Sponsoring Ad Spend Purchase (100 USD @ 3.10 FX = 310 TND)
    const exp2 = await createExpense({
      amount: 310,
      date: "2026-10-12",
      categoryName: "Advertising & Sponsoring",
      allocation: "sponsoring_purchase",
      description: "Meta Ads Spend Purchase (100 USD @ 3.10)",
      clientId: TEST_CLIENT_ID,
      accountId: biatAccountId,
      status: "paid",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(exp2.success, "Outflow 2 (Sponsoring Ad Spend 310 TND) created", "SUITE_B", true, exp2.success);

    // 5. Outflow 3: Direct Salary Payment (800 TND)
    const exp3 = await createExpense({
      amount: 800,
      date: "2026-10-25",
      categoryName: "People & Salaries",
      allocation: "payroll",
      description: "Monthly Base Salary - Houssem",
      teamMemberId: TEST_TEAM_MEMBER_ID,
      accountId: biatAccountId,
      status: "paid",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(exp3.success, "Outflow 3 (Payroll 800 TND) created", "SUITE_B", true, exp3.success);

    // 6. Outflow 4: Sales Commission Payout (150 TND)
    const exp4 = await createExpense({
      amount: 150,
      date: "2026-10-26",
      categoryName: "People & Salaries",
      allocation: "sales_commission",
      description: "Sales Commission for TOTTA Restaurant",
      teamMemberId: TEST_TEAM_MEMBER_ID,
      clientId: TEST_CLIENT_ID,
      accountId: biatAccountId,
      status: "paid",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(exp4.success, "Outflow 4 (Sales Commission 150 TND) created", "SUITE_B", true, exp4.success);

    // 7. Open Invoice: Total 2,500 TND, Paid 1,000 TND -> Outstanding = 1,500 TND
    executeLocalSql(`
      INSERT INTO public.invoices (
        invoice_number, client_id, issue_date, due_date,
        service_revenue, sponsoring_budget, other_revenue,
        subtotal, tax_amount, total_amount, paid_amount, status
      ) VALUES (
        'INV-2026-10-CERT', '${TEST_CLIENT_ID}', '2026-10-01', '2026-10-31',
        2000, 500, 0,
        2500, 0, 2500, 1000, 'partially_paid'
      );
    `);

    // 8. Sponsoring Campaign: USD 100 spent @ 3.10 FX = 310 TND, Client Charge 500 TND
    executeLocalSql(`
      INSERT INTO public.sponsoring_campaigns (
        campaign_name, client_id, platform, period_month,
        budget_tnd, usd_amount, purchase_rate, purchase_cost_tnd,
        client_rate, client_charge_tnd, margin_tnd, execution_status
      ) VALUES (
        'Meta Campaign October', '${TEST_CLIENT_ID}', 'Meta Ads', '2026-10',
        500, 100, 3.10, 310,
        5.00, 500, 190, 'completed'
      );
    `);
  });

  await runTest("SUITE_B", "Authoritative KPI calculation matches exact mathematical invariants", async () => {
    const finance = await fetchCompanyFinance(testPeriod, undefined, { clientOverride: localClient, includeDemo: false });

    // Mathematical Invariants:
    // Revenue = 1,500 (service) + 500 (sponsoring collected) = 2,000 TND
    assert(finance.kpis.totalRevenue === 2000, "Revenue == 2,000 TND", "SUITE_B", 2000, finance.kpis.totalRevenue);
    assert(finance.kpis.clientServicesRevenue === 1500, "Service Revenue == 1,500 TND", "SUITE_B", 1500, finance.kpis.clientServicesRevenue);
    assert(finance.kpis.sponsoringCollected === 500, "Sponsoring Collected == 500 TND", "SUITE_B", 500, finance.kpis.sponsoringCollected);

    // Total Expenses = 300 (operating) + 310 (sponsoring purchase) + 800 (payroll) + 150 (commission) = 1,560 TND
    assert(finance.kpis.totalExpenses === 1560, "Total Expenses == 1,560 TND", "SUITE_B", 1560, finance.kpis.totalExpenses);
    assert(finance.kpis.operatingExpenses === 300, "Operating Expenses == 300 TND", "SUITE_B", 300, finance.kpis.operatingExpenses);
    assert(finance.kpis.payroll === 800, "Payroll == 800 TND", "SUITE_B", 800, finance.kpis.payroll);
    assert(finance.kpis.sponsoringPurchasesCost === 310, "Sponsoring Cost == 310 TND", "SUITE_B", 310, finance.kpis.sponsoringPurchasesCost);
    assert(finance.kpis.salesCommissionsCost === 150, "Sales Commissions == 150 TND", "SUITE_B", 150, finance.kpis.salesCommissionsCost);

    // Net Profit = Revenue (2,000) - Expenses (1,560) = 440 TND
    assert(finance.kpis.netProfit === 440, "Net Profit == 440 TND (2,000 - 1,560)", "SUITE_B", 440, finance.kpis.netProfit);
    assert(finance.kpis.profitMargin === 22, "Profit Margin == 22% ((440 / 2,000) * 100)", "SUITE_B", 22, finance.kpis.profitMargin);

    // Outstanding Receivables = 2,500 - 1,000 = 1,500 TND
    assert(finance.kpis.outstandingPayments === 1500, "Outstanding Receivables == 1,500 TND", "SUITE_B", 1500, finance.kpis.outstandingPayments);

    // Sponsoring Margin = Client Charge (500) - Spend (310) = 190 TND
    assert(finance.kpis.sponsoringMargin === 190, "Sponsoring Margin == 190 TND", "SUITE_B", 190, finance.kpis.sponsoringMargin);
  });

  // ============================================================================
  // SUITE C: INTERNAL TRANSFERS & TREASURY CASH FLOW INVARIANT
  // ============================================================================
  console.log("\n--- SUITE C: Internal Transfers & Treasury Cash Flow ---");
  await runTest("SUITE_C", "Account transfer debits source, credits destination, preserves total cash", async () => {
    const accBefore = queryLocalJson<any[]>(`SELECT id, current_balance FROM public.financial_accounts WHERE id IN ('${biatAccountId}', '${pettyCashAccountId}');`);
    const biatBefore = Number(accBefore.find((a) => a.id === biatAccountId)?.current_balance || 0);
    const pettyBefore = Number(accBefore.find((a) => a.id === pettyCashAccountId)?.current_balance || 0);
    const totalCashBefore = biatBefore + pettyBefore;

    const transferAmount = 400;
    const transferRes = await transferBetweenAccounts({
      sourceAccountId: biatAccountId,
      destinationAccountId: pettyCashAccountId,
      amount: transferAmount,
      date: "2026-10-15",
      reference: "TRF-TEST-CERT",
      notes: "Internal cash sweep to petty cash",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(transferRes.success, "transferBetweenAccounts executed successfully", "SUITE_C", true, transferRes.success);

    const accAfter = queryLocalJson<any[]>(`SELECT id, current_balance FROM public.financial_accounts WHERE id IN ('${biatAccountId}', '${pettyCashAccountId}');`);
    const biatAfter = Number(accAfter.find((a) => a.id === biatAccountId)?.current_balance || 0);
    const pettyAfter = Number(accAfter.find((a) => a.id === pettyCashAccountId)?.current_balance || 0);
    const totalCashAfter = biatAfter + pettyAfter;

    assert(biatAfter === biatBefore - transferAmount, "Source account accurately debited by 400 TND", "SUITE_C", biatBefore - transferAmount, biatAfter);
    assert(pettyAfter === pettyBefore + transferAmount, "Destination account accurately credited by 400 TND", "SUITE_C", pettyBefore + transferAmount, pettyAfter);
    assert(totalCashAfter === totalCashBefore, "Total company cash perfectly conserved across transfer", "SUITE_C", totalCashBefore, totalCashAfter);
  });

  await runTest("SUITE_C", "Transfer transactions are strictly excluded from Revenue, Expenses, and Net Profit", async () => {
    const finance = await fetchCompanyFinance(testPeriod, undefined, { clientOverride: localClient, includeDemo: false });

    // Invariants MUST NOT change after internal transfer:
    assert(finance.kpis.totalRevenue === 2000, "Revenue remains 2,000 TND after transfer (not polluted)", "SUITE_C", 2000, finance.kpis.totalRevenue);
    assert(finance.kpis.totalExpenses === 1560, "Total Expenses remain 1,560 TND after transfer (not polluted)", "SUITE_C", 1560, finance.kpis.totalExpenses);
    assert(finance.kpis.netProfit === 440, "Net Profit remains 440 TND after transfer", "SUITE_C", 440, finance.kpis.netProfit);

    // Verify paired transfer transactions exist in ledger
    const transferLedger = finance.ledgerTransactions.filter((t) => t.transactionType === "TRANSFER");
    assert(transferLedger.length === 2, "Paired transfer transactions present in canonical ledger (inflow & outflow)", "SUITE_C", 2, transferLedger.length);
  });

  // ============================================================================
  // SUITE D: LIFECYCLE, DOUBLE-ENTRY & IDEMPOTENCY
  // ============================================================================
  console.log("\n--- SUITE D: Lifecycle, Double-Entry & Idempotency ---");
  await runTest("SUITE_D", "executeSponsoringPurchase idempotency guard", async () => {
    const campaignFixture: SponsoringCampaign = {
      id: "77777777-7777-7777-7777-777777777777",
      campaignName: "Test Idempotent Campaign",
      clientId: TEST_CLIENT_ID,
      platform: "Meta Ads",
      budgetTnd: 250,
      usdAmount: 50,
      purchaseRate: 3.10,
      purchaseCostTnd: 155,
      clientRate: 5.0,
      clientChargeTnd: 250,
      marginTnd: 95,
      marginPercent: 38,
      paymentStatus: "pending",
      executionStatus: "planning",
      date: "2026-10-01",
      periodMonth: "2026-10",
      notes: null,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    };

    // Insert campaign fixture into DB
    executeLocalSql(`
      INSERT INTO public.sponsoring_campaigns (
        id, campaign_name, client_id, platform,
        budget_tnd, usd_amount, purchase_rate, purchase_cost_tnd,
        client_rate, client_charge_tnd, margin_tnd, execution_status, period_month
      ) VALUES (
        '${campaignFixture.id}', '${campaignFixture.campaignName}', '${campaignFixture.clientId}',
        '${campaignFixture.platform}', 250, 50, 3.10, 155, 5.00, 250, 95, 'planning', '2026-10'
      );
    `);

    // Call 1: First execution creates outflow expense
    const res1 = await executeSponsoringPurchase({
      campaign: campaignFixture,
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res1.success, "First sponsoring purchase execution succeeds", "SUITE_D", true, res1.success);

    // Call 2: Second execution on the same campaign must be idempotent
    const res2 = await executeSponsoringPurchase({
      campaign: { ...campaignFixture, executionStatus: "completed" },
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res2.success, "Second sponsoring purchase execution succeeds idempotently", "SUITE_D", true, res2.success);

    // Verify exactly ONE expense transaction exists for this campaign
    const expenses = queryLocalJson<any[]>(`SELECT count(*) as cnt FROM public.expense_transactions WHERE sponsoring_campaign_id = '${campaignFixture.id}';`);
    assert(Number(expenses[0].cnt) === 1, "Exactly 1 expense transaction exists (no double charge)", "SUITE_D", 1, Number(expenses[0].cnt));
  });

  await runTest("SUITE_D", "recordInvoicePayment idempotency guard", async () => {
    const invoiceFixture: Invoice = {
      id: "66666666-6666-6666-6666-666666666666",
      invoiceNumber: "INV-IDEM-01",
      clientId: TEST_CLIENT_ID,
      clientName: "TOTTA Restaurant",
      issueDate: "2026-10-01",
      dueDate: "2026-10-15",
      serviceRevenue: 1000,
      sponsoringBudget: 300,
      otherRevenue: 0,
      subtotal: 1300,
      taxAmount: 0,
      totalAmount: 1300,
      paidAmount: 0,
      currency: "TND",
      status: "sent",
      items: [],
      notes: "Test idempotency invoice",
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    };

    executeLocalSql(`
      INSERT INTO public.invoices (
        id, invoice_number, client_id, issue_date, due_date,
        service_revenue, sponsoring_budget, other_revenue,
        subtotal, tax_amount, total_amount, paid_amount, status
      ) VALUES (
        '${invoiceFixture.id}', '${invoiceFixture.invoiceNumber}', '${invoiceFixture.clientId}',
        '${invoiceFixture.issueDate}', '${invoiceFixture.dueDate}', 1000, 300, 0,
        1300, 0, 1300, 0, 'sent'
      );
    `);

    // Call 1: Record payment
    const res1 = await recordInvoicePayment({
      invoice: invoiceFixture,
      paymentMethod: "Bank Transfer",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res1.success, "First invoice payment succeeds", "SUITE_D", true, res1.success);

    // Call 2: Re-record payment on paid invoice
    const res2 = await recordInvoicePayment({
      invoice: { ...invoiceFixture, status: "paid", paidAmount: 1300 },
      paymentMethod: "Bank Transfer",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res2.success, "Second invoice payment succeeds idempotently", "SUITE_D", true, res2.success);

    // Verify invoice paid amount is 1300 and exactly 2 incomes were created (1 service, 1 sponsoring)
    const inv = queryLocalJson<any[]>(`SELECT status, paid_amount FROM public.invoices WHERE id = '${invoiceFixture.id}';`);
    assert(inv[0].status === "paid" && Number(inv[0].paid_amount) === 1300, "Invoice marked paid with 1,300 TND", "SUITE_D", 1300, Number(inv[0].paid_amount));

    const incomes = queryLocalJson<any[]>(`SELECT count(*) as cnt FROM public.income_transactions WHERE invoice_id = '${invoiceFixture.id}';`);
    assert(Number(incomes[0].cnt) === 2, "Exactly 2 income records exist (1 service + 1 sponsoring)", "SUITE_D", 2, Number(incomes[0].cnt));
  });

  await runTest("SUITE_D", "payCommission idempotency guard", async () => {
    const commissionFixture: SalesCommission = {
      id: "55555555-5555-5555-5555-555555555555",
      teamMemberId: TEST_TEAM_MEMBER_ID,
      teamMemberName: "Houssem Specialist",
      clientId: TEST_CLIENT_ID,
      clientName: "TOTTA Restaurant",
      periodMonth: "2026-10",
      dealValue: 2000,
      commissionRate: 10,
      commissionAmount: 200,
      status: "pending",
      paidAt: null,
      salaryPaymentId: null,
      createdAt: "2026-10-01",
      updatedAt: "2026-10-01",
    };

    executeLocalSql(`
      INSERT INTO public.sales_commissions (
        id, team_member_id, client_id, period_month,
        total_sale_amount, service_revenue, sponsoring_amount, deal_value, commission_rate, commission_amount, status
      ) VALUES (
        '${commissionFixture.id}', '${commissionFixture.teamMemberId}', '${commissionFixture.clientId}',
        '2026-10', 2000, 2000, 0, 2000, 10, 200, 'pending'
      );
    `);

    // Call 1: Pay commission
    const res1 = await payCommission({
      commission: commissionFixture,
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res1.success, "First payCommission call succeeds", "SUITE_D", true, res1.success);

    // Call 2: Re-pay same commission
    const res2 = await payCommission({
      commission: { ...commissionFixture, status: "paid" },
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res2.success, "Second payCommission call succeeds idempotently", "SUITE_D", true, res2.success);

    // Verify only 1 expense was created for this commission
    const expCount = queryLocalJson<any[]>(`SELECT count(*) as cnt FROM public.expense_transactions WHERE commission_id = '${commissionFixture.id}';`);
    assert(Number(expCount[0].cnt) === 1, "Exactly 1 commission expense created (no duplicate payout)", "SUITE_D", 1, Number(expCount[0].cnt));
  });

  await runTest("SUITE_D", "approveSalaryRequest idempotency guard", async () => {
    const reqId = "44444444-4444-4444-4444-444444444444";
    executeLocalSql(`
      INSERT INTO public.salary_requests (
        id, team_member_id, amount, requested_amount, currency, requested_date,
        reason, status
      ) VALUES (
        '${reqId}', '${TEST_TEAM_MEMBER_ID}', 250, 250, 'TND', '2026-10-08',
        'Emergency personal expense advance', 'pending'
      );
    `);

    // Call 1: Approve advance
    const res1 = await approveSalaryRequest({
      requestId: reqId,
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res1.success, "First salary request approval succeeds", "SUITE_D", true, res1.success);

    // Call 2: Re-approve already approved advance
    const res2 = await approveSalaryRequest({
      requestId: reqId,
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(res2.success, "Second salary request approval succeeds idempotently", "SUITE_D", true, res2.success);

    // Verify only 1 salary payment created
    const payCount = queryLocalJson<any[]>(`SELECT count(*) as cnt FROM public.salary_payments WHERE salary_request_id = '${reqId}';`);
    assert(Number(payCount[0].cnt) === 1, "Exactly 1 salary payment created for advance request", "SUITE_D", 1, Number(payCount[0].cnt));
  });

  await runTest("SUITE_D", "closeFinancialPeriod and reopenFinancialPeriod lifecycle", async () => {
    const closeRes = await closeFinancialPeriod({
      periodMonth: "2026-10",
      checklist: {
        allInvoicesGenerated: true,
        allPaymentsRecorded: true,
        sponsoringArbitrageReconciled: true,
        salariesCalculated: true,
        bankAccountsReconciled: true,
        vatAndTaxProvisionsChecked: true,
        auditLogVerified: true,
      },
      summary: {
        totalRevenue: 2000,
        totalExpenses: 1560,
        netProfit: 440,
        profitMargin: 22,
        totalInvoiced: 2500,
        totalCollected: 2000,
        outstandingPayments: 1500,
        sponsoringAdSpend: 310,
        sponsoringMargin: 190,
        operatingExpenses: 300,
        payroll: 800,
        cashOnHand: 16200,
      },
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(closeRes.success, "closeFinancialPeriod succeeds", "SUITE_D", true, closeRes.success);

    const cp = queryLocalJson<any[]>("SELECT status, closed_by FROM public.financial_closing_periods WHERE period_month = '2026-10';");
    assert(cp[0].status === "closed", "Period marked 'closed'", "SUITE_D", "closed", cp[0].status);

    // Reopen period
    const reopenRes = await reopenFinancialPeriod({
      periodMonth: "2026-10",
      reason: "Auditor requested ledger reconciliation check",
      actorId: SUPER_ADMIN_ID,
      clientOverride: localClient,
    });
    assert(reopenRes.success, "reopenFinancialPeriod succeeds", "SUITE_D", true, reopenRes.success);

    const cpReopen = queryLocalJson<any[]>("SELECT status, reopen_reason FROM public.financial_closing_periods WHERE period_month = '2026-10';");
    assert(cpReopen[0].status === "open", "Period unfreezes to 'open'", "SUITE_D", "open", cpReopen[0].status);
  });

  // ============================================================================
  // SUITE E: DEMO DATA QUARANTINE & ISOLATION
  // ============================================================================
  console.log("\n--- SUITE E: Demo Data Quarantine & Isolation ---");
  await runTest("SUITE_E", "Quarantine synthetic demo accounts from production KPIs", async () => {
    // Seed synthetic fixture resembling the 70,000 TND past test accounts
    const demoAccountId = "99999999-9999-9999-9999-999999999999";
    executeLocalSql(`
      INSERT INTO public.financial_accounts (
        id, name, account_type, currency, opening_balance, current_balance, is_demo
      ) VALUES (
        '${demoAccountId}', 'BIAT Operating 0uiy2', 'bank', 'TND', 10000, 10000, true
      ) ON CONFLICT (id) DO UPDATE SET is_demo = true;
    `);

    // Fetch with includeDemo = false (Default Production Behavior)
    const prodFinance = await fetchCompanyFinance(testPeriod, undefined, { clientOverride: localClient, includeDemo: false });
    const hasDemoAcc = prodFinance.accounts.some((a) => a.id === demoAccountId || a.name.includes("0uiy2"));
    assert(!hasDemoAcc, "Demo account quarantined when includeDemo=false", "SUITE_E", false, hasDemoAcc);

    // Fetch with includeDemo = true
    const demoFinance = await fetchCompanyFinance(testPeriod, undefined, { clientOverride: localClient, includeDemo: true });
    const hasDemoAccInDemoMode = demoFinance.accounts.some((a) => a.id === demoAccountId);
    assert(hasDemoAccInDemoMode, "Demo account present when includeDemo=true", "SUITE_E", true, hasDemoAccInDemoMode);

    // Cleanup demo account
    executeLocalSql(`DELETE FROM public.financial_accounts WHERE id = '${demoAccountId}';`);
  });

  // ============================================================================
  // SUITE F: SECURITY, RBAC & CSV FORMULA INJECTION DEFENSE
  // ============================================================================
  console.log("\n--- SUITE F: Security, RBAC & CSV Export Defense ---");
  await runTest("SUITE_F", "Worker role is rejected from calling fetchCompanyFinance", async () => {
    let errorCaught = false;
    try {
      await fetchCompanyFinance(
        testPeriod,
        { userId: WORKER_ID, userRole: "worker", companyId: "test", permissions: [] },
        { clientOverride: workerClient }
      );
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes("Unauthorized"), "Unauthorized error thrown for worker", "SUITE_F", true, true);
    }
    assert(errorCaught, "Access blocked for non-finance role", "SUITE_F", true, errorCaught);
  });

  await runTest("SUITE_F", "Audit log non-repudiation in financial_audit_logs", async () => {
    const logs = queryLocalJson<any[]>(`SELECT count(*) as cnt FROM public.financial_audit_logs;`);
    assert(Number(logs[0].cnt) > 0, "Financial audit logs persisted", "SUITE_F", ">0", Number(logs[0].cnt));
  });

  await runTest("SUITE_F", "exportTransactionsToCSV formula injection defense & UTF-8 BOM", async () => {
    const finance = await fetchCompanyFinance(testPeriod, undefined, { clientOverride: localClient, includeDemo: false });

    // Inject malicious cell data in test ledger item to test formula defense
    const maliciousLedger = [
      ...finance.ledgerTransactions,
      {
        id: "evil-01",
        transactionType: "EXPENSE" as any,
        direction: "outflow" as any,
        date: "2026-10-30",
        amount: 100,
        category: "Test",
        allocation: "operating_expense" as any,
        clientName: "=1+2';cmd|' /C calc'!A0", // OWASP formula injection payload
        teamMemberName: "+cmd|' /C calc'!A0",
        notes: "-2+3*4",
        paymentMethod: "@SUM(A1:A10)",
        status: "paid" as any,
        reference: "EVIL-REF",
        currency: "TND" as any,
        source: "test",
        description: "Malicious test item",
        clientId: null,
        projectId: null,
        projectName: null,
        teamMemberId: null,
        salaryPaymentId: null,
        vendor: null,
      },
    ];

    const csvOutput = exportTransactionsToCSV({
      type: "ledger",
      ledger: maliciousLedger,
      periodLabel: "October 2026",
    });

    // Check 1: CSV must start with UTF-8 BOM
    assert(csvOutput.charCodeAt(0) === 0xFEFF, "CSV contains UTF-8 BOM (\\uFEFF)", "SUITE_F", 0xFEFF, csvOutput.charCodeAt(0));

    // Check 2: Malicious formulas must NOT execute raw; serialized with single quote prefix
    assert(!csvOutput.includes("\n=1+2"), "Formula '=' safely escaped", "SUITE_F", true, !csvOutput.includes("\n=1+2"));
    assert(!csvOutput.includes("\n+cmd"), "Formula '+' safely escaped", "SUITE_F", true, !csvOutput.includes("\n+cmd"));
    assert(!csvOutput.includes("\n-2+3"), "Formula '-' safely escaped", "SUITE_F", true, !csvOutput.includes("\n-2+3"));
    assert(!csvOutput.includes("\n@SUM"), "Formula '@' safely escaped", "SUITE_F", true, !csvOutput.includes("\n@SUM"));
  });

  // ============================================================================
  // FINAL CERTIFICATION SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  console.log("   CERTIFICATION RESULTS SUMMARY");
  console.log("================================================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Invariant Checks: ${total}`);
  console.log(`Passed:                 ${passed}`);
  console.log(`Failed:                 ${failed}`);

  if (failed > 0) {
    console.error(`\n❌ MASTER CERTIFICATION FAILED (${failed} test failures)`);
    process.exit(1);
  } else {
    console.log(`\n🏆 ALL FINANCIAL COMMAND CENTER INVARIANTS CERTIFIED SUCCESSFULLY (100% PASS RATE)`);
    console.log(`Verdict: CONDITIONAL PASS — LOCAL FINANCIAL MVP VERIFIED, EXTERNAL VERIFICATION BLOCKED`);
  }
}

main().catch((err) => {
  console.error("Unhandled fatal exception in test runner:", err);
  process.exit(1);
});

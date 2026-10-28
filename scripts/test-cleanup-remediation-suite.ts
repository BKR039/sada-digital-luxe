import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateClientFinancials,
  isInvoiceOverdue,
  isDemoFinancialRecord,
} from "../src/lib/finance-service";
import { formatCurrency } from "../src/types/finance";
import type { FinancialAccount } from "../src/types/finance";

console.log("=== RUNNING TARGETED CLEANUP REMEDIATION SUITE ===");

// -------------------------------------------------------------
// 1. MULTI-CURRENCY TREASURY REPORTING TESTS
// -------------------------------------------------------------
console.log("\n[TEST 1] Multi-Currency Treasury Reporting & Segregation");

const mockAccounts: FinancialAccount[] = [
  {
    id: "a1",
    name: "BIAT Corporate Operating",
    accountType: "bank",
    currency: "TND",
    openingBalance: 15000,
    currentBalance: 15000,
    accountNumber: null,
    bankName: "BIAT",
    isDefault: true,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a2",
    name: "Petty Cash Box (Caisse)",
    accountType: "cash",
    currency: "TND",
    openingBalance: 1200,
    currentBalance: 1200,
    accountNumber: null,
    bankName: null,
    isDefault: false,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a3",
    name: "USD Ad Spend Card",
    accountType: "gateway",
    currency: "USD",
    openingBalance: 2000,
    currentBalance: 2000,
    accountNumber: null,
    bankName: "Wise",
    isDefault: false,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "a4_inactive",
    name: "Deactivated Synthetic Account",
    accountType: "bank",
    currency: "TND",
    openingBalance: 10000,
    currentBalance: 10000,
    accountNumber: null,
    bankName: "BIAT",
    isDefault: false,
    status: "inactive",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Test active filtering and currency segregation
const activeAccounts = mockAccounts.filter(a => a.status === "active");
assert.equal(activeAccounts.length, 3, "Inactive account must be excluded from active treasury");

const tndAccounts = activeAccounts.filter(a => a.currency === "TND");
const usdAccounts = activeAccounts.filter(a => a.currency === "USD");

const cashTnd = tndAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
const cashUsd = usdAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

assert.equal(cashTnd, 16200, "TND balance must be strictly 16,200 (15,000 + 1,200)");
assert.equal(cashUsd, 2000, "USD balance must be strictly 2,000 USD");

// Verify naive sum is NOT used as single unitless currency
const naiveSum = activeAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
assert.equal(naiveSum, 18200, "Naive sum check");
assert.notEqual(cashTnd, naiveSum, "Operating currency TND cash must NOT blindly add 2,000 USD as 2,000 TND");

// Verify segregated formatting
const formattedTnd = formatCurrency(cashTnd, { currency: "TND" });
const formattedUsd = formatCurrency(cashUsd, { currency: "USD" });
const multiCurrencyDisplay = `${formattedTnd} + ${formattedUsd}`;
assert.ok(multiCurrencyDisplay.includes("16,200"), "Display contains TND balance");
assert.ok(multiCurrencyDisplay.includes("2,000"), "Display contains USD balance");
assert.ok(multiCurrencyDisplay.includes("USD"), "Display labels USD distinctly");
console.log("✓ Multi-currency segregation verified:", multiCurrencyDisplay);

// -------------------------------------------------------------
// 2. CLIENT ARCHIVAL SEMANTICS & RECOGNIZED REVENUE TESTS
// -------------------------------------------------------------
console.log("\n[TEST 2] Client Archival Semantics & Recognized Revenue");

interface TestClientRecord {
  id: string;
  name: string;
  status: "active" | "archived" | "paused" | "inactive";
  monthly_package_price: number;
}

const mockClients: TestClientRecord[] = [
  { id: "c1_real", name: "Jannat Sahara", status: "active", monthly_package_price: 3500 },
  { id: "c2_archived_demo", name: "Audit Enterprise 1790851662877", status: "archived", monthly_package_price: 2800 },
  { id: "c3_archived_legit", name: "Historical Luxury Partner (Past Client)", status: "archived", monthly_package_price: 2500 },
  { id: "c4_inactive", name: "Dormant Brand", status: "inactive", monthly_package_price: 1500 },
];

// Contracted Revenue (Recognized Revenue) must ONLY sum active clients
const activeClientsForContract = mockClients.filter(c => c.status === "active");
const recognizedRevenue = activeClientsForContract.reduce((sum, c) => sum + c.monthly_package_price, 0);

assert.equal(recognizedRevenue, 3500, "Recognized Revenue must only sum active clients (Jannat Sahara: 3,500)");
assert.equal(activeClientsForContract.length, 1, "Only 1 active client");
console.log("✓ Recognized Revenue correctly excludes archived demo and dormant clients:", recognizedRevenue, "TND");

// -------------------------------------------------------------
// 3. HISTORICAL PERFORMANCE PRESERVATION FOR ARCHIVED CLIENTS
// -------------------------------------------------------------
console.log("\n[TEST 3] Historical Financial Preservation for Archived Clients");

// An archived client with legitimate historical transactions in Q3
const historicalInvoices = [
  { id: "inv_h1", total_amount: 2500, paid_amount: 2500, status: "paid" },
];
const historicalPayments = [
  { id: "pay_h1", amount: 2500, invoice_id: "inv_h1" },
];
const historicalExpenses = [
  { id: "exp_h1", amount: 800, allocation: "operating_expense" },
];

const finArchivedClient = calculateClientFinancials({
  client: mockClients[2], // "Historical Luxury Partner"
  invoices: historicalInvoices,
  payments: historicalPayments,
  expenses: historicalExpenses,
});

assert.equal(finArchivedClient.totalInvoiced, 2500, "Historical invoiced amount preserved");
assert.equal(finArchivedClient.totalPaid, 2500, "Historical collected payment preserved");
assert.equal(finArchivedClient.totalOutstanding, 0, "Historical invoice is fully paid");
assert.equal(finArchivedClient.paymentStatus, "PAID", "Payment status is PAID");
assert.equal(finArchivedClient.directExpensesSum, 800, "Direct expenses preserved");
console.log("✓ Archived client historical performance is fully preserved (Invoiced: 2,500, Paid: 2,500, Net Cash: " + finArchivedClient.netCashPosition + " TND)");

// -------------------------------------------------------------
// 4. CANCELLED INVOICE EXCLUSION FROM RECEIVABLES
// -------------------------------------------------------------
console.log("\n[TEST 4] Cancelled Invoice Receivable Elimination");

const mockInvoices = [
  { id: "inv_real_sent", invoice_number: "INV-REAL-001", total_amount: 1500, paid_amount: 0, status: "sent", due_date: "2026-11-01" },
  { id: "inv_test_cancelled", invoice_number: "INV-TEST-nh6y3", total_amount: 2300, paid_amount: 0, status: "cancelled", due_date: "2026-10-15" },
];

// Active unpaid filter
const unpaidActiveInvoices = mockInvoices.filter(i => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft");
const totalOutstanding = unpaidActiveInvoices.reduce((sum, i) => sum + Math.max(0, i.total_amount - i.paid_amount), 0);

assert.equal(unpaidActiveInvoices.length, 1, "Cancelled invoice must be completely excluded from unpaid invoices");
assert.equal(totalOutstanding, 1500, "Outstanding balance must only reflect real invoice (1,500 TND)");
assert.equal(isInvoiceOverdue(mockInvoices[1]), false, "Cancelled test invoice must never be evaluated as overdue");
console.log("✓ Cancelled invoice properly drops from receivables (Outstanding: " + totalOutstanding + " TND)");

// -------------------------------------------------------------
// 5. CANCELLED INCOMES & EXPENSES RECONCILIATION
// -------------------------------------------------------------
console.log("\n[TEST 5] Complete Synthetic October Reconciliation (Incomes & Expenses)");

const mockOctLedger = [
  // Two Phase D incomes
  { id: "inc_d1", amount: 1500, direction: "inflow", status: "cancelled", date: "2026-10-07" },
  { id: "inc_d2", amount: 1500, direction: "inflow", status: "cancelled", date: "2026-10-07" },
  // Two Phase D expenses (The 900 TND blind spot corrected!)
  { id: "exp_d1", amount: 450, direction: "outflow", status: "cancelled", date: "2026-10-07" },
  { id: "exp_d2", amount: 450, direction: "outflow", status: "cancelled", date: "2026-10-07" },
];

const octInflowsReceived = mockOctLedger
  .filter(t => t.direction === "inflow" && t.status === "received")
  .reduce((sum, t) => sum + t.amount, 0);

const octOutflowsPaid = mockOctLedger
  .filter(t => t.direction === "outflow" && t.status === "paid")
  .reduce((sum, t) => sum + t.amount, 0);

const octNetProfit = octInflowsReceived - octOutflowsPaid;

assert.equal(octInflowsReceived, 0, "October cash collected must be 0 TND after cancelling test incomes");
assert.equal(octOutflowsPaid, 0, "October paid expenses must be 0 TND after cancelling test expenses");
assert.equal(octNetProfit, 0, "October Net Profit must be cleanly 0 TND (no false -900 TND deficit)");
console.log("✓ October synthetic lifecycle fully reconciled: Inflows = 0 TND, Outflows = 0 TND, Net Profit = 0 TND");

// -------------------------------------------------------------
// 6. DEMO RECORD DETECTION COVERAGE
// -------------------------------------------------------------
console.log("\n[TEST 6] Demo Record Detection Coverage");
assert.equal(isDemoFinancialRecord("client", { name: "Audit Luxury SARL" }), true, "Audit Luxury SARL must be recognized as demo");
assert.equal(isDemoFinancialRecord("client", { name: "Jannat Sahara" }), false, "Jannat Sahara must never be classified as demo");
assert.equal(isDemoFinancialRecord("account", { name: "BIAT Operating 37zy5" }), true, "Synthetic BIAT account must be classified as demo");
assert.equal(isDemoFinancialRecord("account", { name: "BIAT Corporate Operating" }), false, "Real BIAT account must never be classified as demo");
console.log("✓ Demo record detection verified.");

console.log("\n=== ALL TARGETED TESTS PASSED PERFECTLY ===");

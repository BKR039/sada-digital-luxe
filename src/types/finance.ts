// ============================================================
// SADA OS — FINANCIAL OPERATING SYSTEM TYPE SYSTEM & CONSTANTS
// Canonical types, models, formatters, and categories
// ============================================================

export type FinancialCurrency = "TND" | "USD" | "EUR";

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  name: string;
  vendor: string | null;
  category_id: string | null;
  category_name: string;
  amount: number;
  currency: FinancialCurrency;
  billing_cycle: "monthly" | "quarterly" | "yearly";
  billing_day: number;
  next_billing_date: string | null;
  payment_method: string | null;
  status: "active" | "paused" | "cancelled";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type SalaryType = "monthly" | "hourly" | "fixed_contract" | "per_project";
export type PaymentFrequency = "monthly" | "bi_weekly" | "weekly" | "on_delivery";

export interface SalaryRecord {
  id: string;
  team_member_id: string;
  base_amount: number;
  standard_monthly_hours?: number | null;
  hourly_rate?: number | null;
  currency: FinancialCurrency;
  salary_type: SalaryType;
  payment_frequency: PaymentFrequency;
  effective_date: string;
  next_payment_date: string | null;
  payment_method: string;
  bank_details: string | null;
  status: "active" | "paused" | "terminated";
  notes: string | null;
  created_at: string;
  updated_at: string;
  team_member?: {
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    role: string;
    division: string;
    photo_url: string | null;
  };
}

export type SalaryPaymentType = "regular" | "advance" | "bonus" | "adjustment";
export type SalaryPaymentStatus = "paid" | "pending" | "cancelled";

export interface SalaryPayment {
  id: string;
  team_member_id: string;
  salary_record_id: string | null;
  salary_request_id: string | null;
  amount: number;
  currency: FinancialCurrency;
  payment_date: string;
  period_start: string | null;
  period_end: string | null;
  payment_type: SalaryPaymentType;
  payment_method: string;
  reference: string | null;
  status: SalaryPaymentStatus;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  team_member?: {
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    division: string;
    photo_url: string | null;
  };
}

export type SalaryRequestStatus = "pending" | "approved" | "rejected";

export interface SalaryRequest {
  id: string;
  team_member_id: string;
  requested_amount: number;
  currency: FinancialCurrency;
  requested_date: string;
  reason: string;
  notes: string | null;
  status: SalaryRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_amount: number | null;
  salary_payment_id: string | null;
  created_at: string;
  updated_at: string;
  team_member?: {
    id: string;
    name: string;
    email: string | null;
    position: string | null;
    role: string;
    division: string;
    photo_url: string | null;
  };
}

export type ExpenseStatus = "paid" | "pending" | "cancelled";

export interface ExpenseTransaction {
  id: string;
  amount: number;
  currency: FinancialCurrency;
  date: string;
  category_id: string | null;
  category_name: string;
  subcategory: string | null;
  vendor: string | null;
  description: string;
  payment_method: string;
  status: ExpenseStatus;
  is_recurring: boolean;
  subscription_id: string | null;
  salary_payment_id: string | null;
  team_member_id: string | null;
  client_id: string | null;
  project_id: string | null;
  reference: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  allocation?: string | null;
  sponsoring_campaign_id?: string | null;
  commission_id?: string | null;
  account_id?: string | null;
  transaction_type?: string | null;
  period_month?: string | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; title: string; client_name: string } | null;
  team_member?: { id: string; name: string } | null;
}

export type IncomeCategory =
  | "Client Payment"
  | "Project Payment"
  | "Retainer"
  | "Product Revenue"
  | "Other";

export type IncomeStatus = "received" | "pending" | "cancelled";

export interface IncomeTransaction {
  id: string;
  amount: number;
  currency: FinancialCurrency;
  date: string;
  category: IncomeCategory;
  client_id: string | null;
  project_id: string | null;
  description: string;
  payment_method: string;
  status: IncomeStatus;
  reference: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  allocation?: string | null;
  invoice_id?: string | null;
  account_id?: string | null;
  transaction_type?: string | null;
  period_month?: string | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; title: string; client_name: string } | null;
}

export interface FinancialAuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

// ============================================================
// CANONICAL FINANCIAL OPERATING SYSTEM MODELS
// ============================================================

export type TransactionType =
  | "CLIENT_PAYMENT"
  | "SPONSORING_PURCHASE"
  | "SPONSORING_PAYMENT"
  | "EXPENSE"
  | "SALARY"
  | "COMMISSION"
  | "REFUND"
  | "OTHER_INCOME"
  | "WITHDRAWAL"
  | "TRANSFER";

export type TransactionDirection = "inflow" | "outflow";

export type FinancialAllocation =
  | "client_service"
  | "sponsoring_collected"
  | "sponsoring_purchase"
  | "payroll"
  | "sales_commission"
  | "operating_expense"
  | "equipment"
  | "software"
  | "tax_fees"
  | "other_revenue"
  | "transfer"
  | "other";

export type FinancialTransactionStatus = "received" | "paid" | "pending" | "cancelled";

export interface CanonicalFinancialTransaction {
  id: string;
  transactionType: TransactionType;
  direction: TransactionDirection;
  amount: number;
  currency: FinancialCurrency;
  date: string;
  category: string;
  categoryName?: string;
  description: string;
  allocation: FinancialAllocation;
  source: string;
  status: FinancialTransactionStatus;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
  vendor?: string | null;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  teamMemberId: string | null;
  teamMemberName: string | null;
  salaryPaymentId: string | null;
  subscriptionId: string | null;
  sponsoringCampaignId: string | null;
  commissionId: string | null;
  invoiceId: string | null;
  accountId: string | null;
  accountName: string | null;
  receiptUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// 2. Sponsoring Engine
export type SponsoringPlatform =
  | "Meta Ads"
  | "Google Ads"
  | "TikTok Ads"
  | "LinkedIn Ads"
  | "Snapchat Ads"
  | "Other";

export interface SponsoringCampaign {
  id: string;
  clientId: string;
  clientName?: string;
  projectId: string | null;
  projectName?: string;
  invoiceId: string | null;
  campaignName: string;
  platform: SponsoringPlatform;
  budgetTnd: number;
  usdAmount: number;
  purchaseRate: number;
  purchaseCostTnd: number;
  clientRate: number;
  clientChargeTnd: number;
  marginTnd: number;
  marginPercent: number;
  paymentStatus: "pending" | "paid" | "partially_paid" | "cancelled";
  executionStatus: "planning" | "active" | "completed" | "paused";
  expenseTransactionId?: string | null;
  date: string;
  periodMonth: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// 3. Invoices
export type InvoiceStatus = "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: string;
  description: string;
  type: "service" | "sponsoring" | "product" | "other";
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName?: string;
  projectId: string | null;
  projectName?: string;
  issueDate: string;
  dueDate: string;
  serviceRevenue: number;
  serviceFee?: number;
  sponsoringBudget: number;
  otherRevenue: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  currency: FinancialCurrency;
  status: InvoiceStatus;
  items: InvoiceItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// 4. Sales Commissions
export type CommissionStatus = "pending" | "approved" | "paid" | "cancelled";

export interface SalesCommission {
  id: string;
  teamMemberId: string;
  teamMemberName?: string;
  clientId: string;
  clientName?: string;
  invoiceId: string | null;
  serviceRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  periodMonth: string;
  status: CommissionStatus;
  salaryPaymentId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// 5. Financial Accounts (Treasury)
export interface FinancialAccount {
  id: string;
  name: string;
  accountName?: string;
  accountType: "bank" | "cash" | "gateway" | "other";
  currency: FinancialCurrency;
  openingBalance: number;
  currentBalance: number;
  accountNumber: string | null;
  bankName: string | null;
  isDefault: boolean;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

// 6. Monthly Closing Period
export interface ClosingChecklist {
  client_payments_reconciled?: boolean;
  invoices_reconciled?: boolean;
  sponsoring_reconciled?: boolean;
  commissions_calculated?: boolean;
  payroll_processed?: boolean;
  expenses_reviewed?: boolean;
  requests_reviewed?: boolean;
  outstanding_checked?: boolean;
  clientPaymentsRecorded?: boolean;
  invoicesReconciled?: boolean;
  sponsoringRecorded?: boolean;
  commissionsCalculated?: boolean;
  payrollProcessed?: boolean;
  expensesReviewed?: boolean;
  requestsReviewed?: boolean;
  outstandingPaymentsChecked?: boolean;
  profitCalculated?: boolean;
}

export interface ClosingSummary {
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
  cashBalance?: number;
  closedTransactionsCount?: number;
  revenue?: number;
  expenses?: number;
  cash?: number;
  outstandingPayments?: number;
}

export type AuditLogEntry = FinancialAuditLog;

export function formatAllocationLabel(allocation?: string | null): string {
  if (!allocation) return "Operating Expense";
  switch (allocation) {
    case "client_services":
    case "client_service":
      return "Client Services";
    case "sponsoring_collected":
      return "Sponsoring Collected";
    case "sponsoring_purchase":
      return "Sponsoring Ad Spend";
    case "payroll":
      return "Payroll & Compensation";
    case "sales_commission":
      return "Sales Commission";
    case "operating_expense":
      return "Operating Expense";
    case "other_income":
      return "Other Inflow";
    default:
      return allocation.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }
}

export interface FinancialClosingPeriod {
  id: string;
  periodMonth: string;
  status: "open" | "closed";
  checklist: ClosingChecklist;
  closingSummary: ClosingSummary | null;
  closedAt: string | null;
  closedBy: string | null;
  reopenedAt: string | null;
  reopenedBy: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// 7. Client Profitability Record
export type ClientProfitabilityHealth = "HIGH PROFIT" | "MEDIUM" | "LOW PROFIT" | "NO DATA";

export interface ClientProfitabilityRecord {
  clientId: string;
  clientName: string;
  status?: "active" | "inactive" | "archived" | "paused" | "prospect" | string;
  industry: string | null;
  clientType: "monthly" | "one_off";
  monthlyPackage: number;
  serviceRevenue: number;
  sponsoringBudget: number;
  totalRevenue: number;
  directCost: number;
  sponsoringCost: number;
  sponsoringMargin: number;
  commission: number;
  contributionProfit: number;
  marginPercent: number;
  health: ClientProfitabilityHealth;
  paymentStatus: "PAID" | "PENDING" | "OVERDUE";
  paid: number;
  due: number;
}

// 8. Cash Flow Statement
export interface CashFlowStatement {
  openingCash: number;
  clientPayments: number;
  otherIncome: number;
  totalInflows: number;
  sponsoringPurchases: number;
  payroll: number;
  commissions: number;
  operatingExpenses: number;
  withdrawals: number;
  totalOutflows: number;
  closingCash: number;
  accounts: FinancialAccount[];
}

// 9. Period Presets & KPIs
export type PeriodType = "this_month" | "last_month" | "last_30_days" | "this_quarter" | "this_year" | "custom";

export interface FinancialPeriod {
  type: PeriodType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  label: string;
}

export interface FinancialSummaryKPIs {
  // Primary Command Center KPIs (All Drill-Down Capable)
  revenue: number;
  totalRevenue?: number;
  expenses: number;
  netProfit: number;
  profitMargin?: number;
  cash: number;
  cashTnd?: number;
  cashUsd?: number;
  cashByCurrency?: Record<string, number>;
  outstandingPayments: number;
  sponsoringMargin: number;
  payroll: number;
  operatingExpenses: number;

  // Breakdown sub-metrics
  clientServicesRevenue: number;
  sponsoringCollected: number;
  otherRevenue: number;
  sponsoringPurchasesCost: number;
  salesCommissionsCost: number;

  // Operational pipeline
  pendingIncome: number;
  pendingExpenses: number;
  pendingSalaryRequestsCount: number;
  pendingSalaryRequestsTotal: number;

  // Comparison vs previous period
  prevRevenue: number;
  prevExpenses: number;
  prevNetProfit: number;
  revenueDeltaPercent: number | null;
  expenseDeltaPercent: number | null;
  profitDeltaPercent: number | null;

  // Backward compatibility with previous KPI props
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  totalSalaries: number;
  recurringBurn: number;
  prevTotalIncome: number;
  prevTotalExpenses: number;
  prevNetCashFlow: number;
  incomeDeltaPercent: number | null;
}

// 10. Drill Down
export type DrillDownCategory =
  | "revenue"
  | "expenses"
  | "net_profit"
  | "cash"
  | "outstanding"
  | "sponsoring_margin"
  | "payroll"
  | "operating_expenses";

export interface DrillDownBreakdownItem {
  label: string;
  amount: number;
  operator: "+" | "-" | "=";
  highlight?: boolean;
}

export interface DrillDownState {
  category: DrillDownCategory;
  title: string;
  totalAmount: number;
  periodLabel: string;
  formulaBreakdown?: DrillDownBreakdownItem[];
  transactions: CanonicalFinancialTransaction[];
}

export interface SmartInsight {
  id: string;
  type: "info" | "warning" | "positive" | "negative";
  category: "cash_flow" | "expenses" | "income" | "salaries" | "subscriptions" | "sponsoring" | "clients";
  title: string;
  description: string;
  metric?: string;
  badge?: string;
}

// ============================================================
// CENTRALIZED FINANCIAL CURRENCY FORMATTER
// SADA Canonical Display: "1,200 TND" or "1,200.500 TND"
// ============================================================

function getIsArabicActive(): boolean {
  if (typeof document !== "undefined") {
    const docLang = document.documentElement.lang;
    if (docLang === "ar") return true;
  }
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("sada-lang");
      if (saved === "ar") return true;
    } catch {}
  }
  return false;
}

export function formatCurrency(
  amount: number | string | null | undefined,
  options?: {
    currency?: FinancialCurrency | string;
    showSign?: boolean;
    alwaysShowMillimes?: boolean;
    lang?: "en" | "ar";
  }
): string {
  const isArabic = options?.lang ? options.lang === "ar" : getIsArabicActive();
  const rawCurr = options?.currency || "TND";
  const curr = isArabic && rawCurr === "TND" ? "د.ت" : rawCurr;

  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return isArabic ? `0 ${curr}` : `0 ${curr}`;
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const absNum = Math.abs(num);

  const hasFractions = absNum % 1 !== 0;
  const decimals = options?.alwaysShowMillimes || (rawCurr === "TND" && hasFractions) ? 3 : hasFractions ? 2 : 0;

  const formattedNum = absNum.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sign = num < 0 ? "-" : options?.showSign && num > 0 ? "+" : "";

  if (isArabic) {
    return `\u200E${sign}${formattedNum}\u200E ${curr}`;
  }

  return `${sign}${formattedNum} ${curr}`;
}

export function formatAmountNumber(val: number): string {
  return val.toLocaleString("en-US", {
    minimumFractionDigits: val % 1 === 0 ? 0 : 3,
    maximumFractionDigits: 3,
  });
}

// Canonical Options
export const PAYMENT_METHOD_OPTIONS = [
  { value: "Bank Transfer", label: "Bank Transfer (Virement)" },
  { value: "Cheque", label: "Cheque" },
  { value: "Cash", label: "Cash (Espèces)" },
  { value: "Credit Card", label: "Credit Card (Carte Bancaire)" },
  { value: "Online / Stripe", label: "Online / Gateway" },
  { value: "Other", label: "Other" },
];

export const INCOME_CATEGORY_OPTIONS = [
  { value: "Client Payment", label: "Client Payment" },
  { value: "Project Payment", label: "Project Payment" },
  { value: "Retainer", label: "Monthly Retainer" },
  { value: "Product Revenue", label: "Digital Product Revenue" },
  { value: "Other", label: "Other Inflow" },
];

export const SALARY_TYPE_OPTIONS = [
  { value: "monthly", label: "Fixed Monthly Salary" },
  { value: "hourly", label: "Hourly Rate" },
  { value: "fixed_contract", label: "Fixed Contract Fee" },
  { value: "per_project", label: "Per-Project Payout" },
];

export const PAYMENT_FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "bi_weekly", label: "Bi-Weekly (Every 2 Weeks)" },
  { value: "weekly", label: "Weekly" },
  { value: "on_delivery", label: "On Deliverable Completion" },
];

export const SUBSCRIPTION_CYCLE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly (Every 3 Months)" },
  { value: "yearly", label: "Yearly (Annual)" },
];

export const SPONSORING_PLATFORMS: SponsoringPlatform[] = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "LinkedIn Ads",
  "Snapchat Ads",
  "Other",
];

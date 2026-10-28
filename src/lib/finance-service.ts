// ============================================================
// SADA OS — FINANCIAL DATA SERVICE & CANONICAL ENGINE
// Source of truth queries, deterministic insights, audit logging,
// central financial ledger, sponsoring, invoices, commissions,
// cash flow, monthly closing, and drill-down engine.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  FinancialPeriod,
  PeriodType,
  FinancialSummaryKPIs,
  SmartInsight,
  ExpenseTransaction,
  IncomeTransaction,
  SalaryRecord,
  SalaryPayment,
  SalaryRequest,
  Subscription,
  ExpenseCategory,
  FinancialAuditLog,
  CanonicalFinancialTransaction,
  SponsoringCampaign,
  SponsoringPlatform,
  Invoice,
  SalesCommission,
  FinancialAccount,
  FinancialClosingPeriod,
  ClosingChecklist,
  ClosingSummary,
  ClientProfitabilityRecord,
  ClientProfitabilityHealth,
  CashFlowStatement,
  DrillDownState,
  DrillDownCategory,
  DrillDownBreakdownItem,
  FinancialAllocation,
  TransactionType,
} from "@/types/finance";
import { formatCurrency } from "@/types/finance";
import { serializeCsv } from "@/lib/csv-utils";
import { emitNotification } from "@/lib/notification-service";
import { logSystemAudit } from "@/lib/audit-service";
import { getBusinessRuleNumber, getBusinessRuleText } from "@/lib/business-rules-service";
import { resolveAuthoritativeSecurityContext, assertAuthorizedMutation } from "@/lib/security-isolation-service";
import {
  assertActorCanAccessModule,
  assertCanDelete,
  canAccessModule,
  normalizeRole,
  type PermissionContext,
} from "@/lib/permissions";

/**
 * Authoritatively resolves the finance caller context.
 * Never trusts client-supplied actorRole or actorId.
 */
async function resolveFinanceCallerContext(
  explicitCtx?: PermissionContext,
  actorRole?: string,
  actorId?: string,
  options?: { allowAnalyticsRead?: boolean; clientOverride?: any }
): Promise<{ userId: string; role: string; hasFinanceAccess: boolean; isSuperAdmin: boolean }> {
  try {
    const activeClient = options?.clientOverride || supabase;
    try {
      const authCtx = await assertAuthorizedMutation(activeClient, "finance", "finance.view", {
        ctx: explicitCtx,
        actorRole,
        actorId,
      });
      return {
        userId: authCtx.userId,
        role: authCtx.role,
        hasFinanceAccess: Boolean(authCtx.effectivePermissions.finance),
        isSuperAdmin: authCtx.role === "super_admin",
      };
    } catch (finErr) {
      if (options?.allowAnalyticsRead) {
        const analyticsCtx = await assertAuthorizedMutation(activeClient, "analytics", "analytics.view", {
          ctx: explicitCtx,
          actorRole,
          actorId,
        });
        return {
          userId: analyticsCtx.userId,
          role: analyticsCtx.role,
          hasFinanceAccess: Boolean(analyticsCtx.effectivePermissions.analytics),
          isSuperAdmin: analyticsCtx.role === "super_admin",
        };
      }
      throw finErr;
    }
  } catch {
    return {
      userId: "",
      role: "worker",
      hasFinanceAccess: false,
      isSuperAdmin: false,
    };
  }
}
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  format,
  subDays,
  differenceInDays,
  parseISO,
  isValid,
  endOfDay,
} from "date-fns";

// ============================================================
// PERIOD HELPERS
// ============================================================

export function getPresetPeriod(type: PeriodType, customStart?: string, customEnd?: string): FinancialPeriod {
  const now = new Date();

  switch (type) {
    case "this_month":
      return {
        type: "this_month",
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(endOfMonth(now), "yyyy-MM-dd"),
        label: format(now, "MMMM yyyy"),
      };
    case "last_month": {
      const prev = subMonths(now, 1);
      return {
        type: "last_month",
        startDate: format(startOfMonth(prev), "yyyy-MM-dd"),
        endDate: format(endOfMonth(prev), "yyyy-MM-dd"),
        label: format(prev, "MMMM yyyy"),
      };
    }
    case "last_30_days": {
      const start30 = subDays(now, 30);
      return {
        type: "last_30_days",
        startDate: format(start30, "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
        label: "Last 30 Days",
      };
    }
    case "this_quarter":
      return {
        type: "this_quarter",
        startDate: format(startOfQuarter(now), "yyyy-MM-dd"),
        endDate: format(endOfQuarter(now), "yyyy-MM-dd"),
        label: `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`,
      };
    case "this_year":
      return {
        type: "this_year",
        startDate: format(startOfYear(now), "yyyy-MM-dd"),
        endDate: format(endOfYear(now), "yyyy-MM-dd"),
        label: `Year ${now.getFullYear()}`,
      };
    case "custom": {
      const s = customStart || format(startOfMonth(now), "yyyy-MM-dd");
      const e = customEnd || format(endOfMonth(now), "yyyy-MM-dd");
      return {
        type: "custom",
        startDate: s,
        endDate: e,
        label: `${s} to ${e}`,
      };
    }
  }
}

export function getPreviousComparisonPeriod(period: FinancialPeriod): { startDate: string; endDate: string } {
  const start = parseISO(period.startDate);
  const end = parseISO(period.endDate);
  const daysDiff = Math.max(1, differenceInDays(end, start) + 1);

  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, daysDiff - 1);

  return {
    startDate: format(prevStart, "yyyy-MM-dd"),
    endDate: format(prevEnd, "yyyy-MM-dd"),
  };
}

// ============================================================
// AUDIT LOGGING HELPER
// ============================================================

export async function logFinancialAction(params: {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  details?: Record<string, any>;
  clientOverride?: any;
}): Promise<void> {
  try {
    const activeClient = params.clientOverride || supabase;
    await (activeClient as any).from("financial_audit_logs").insert({
      actor_id: params.actorId || null,
      actor_name: params.actorName || "System / Admin",
      actor_role: params.actorRole || "super_admin",
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || {},
    });
  } catch (err) {
    console.error("[logFinancialAction] Failed to write audit log:", err);
  }
}

/**
 * Authoritative check for identifying synthetic / test / demo financial data.
 * Adheres strictly to the principle of never classifying real business records
 * with incomplete profiles as demo.
 */
export function isDemoFinancialRecord(
  entityType: "account" | "client" | "invoice" | "sponsoring" | "income" | "expense",
  record: any
): boolean {
  if (!record) return false;
  // 1. Explicit boolean flag on record
  if (record.is_demo === true || record.isDemo === true) return true;

  // 2. Exact test fixture patterns from previous automated integration tests
  if (entityType === "account") {
    const name = String(record.name || record.accountName || "");
    if (/^BIAT Operating [a-z0-9]{5}$/i.test(name)) return true;
    if (name.includes("(Demo)") || name.includes("[TEST]")) return true;
  }

  if (entityType === "client") {
    const name = String(record.name || "");
    if (/\(OASYA Model\)$/i.test(name) && name.startsWith("Test Client ")) return true;
    if (/^Test Luxe Brand [a-z0-9]{5}$/i.test(name)) return true;
    if (/^Audit Enterprise \d{10,}$/i.test(name)) return true;
    if (/^Phase 10 Test Client/i.test(name)) return true;
    if (/^Phase D Client \d{10,}$/i.test(name)) return true;
    if (name.startsWith("[ARCHIVED QA]")) return true;
    if (name === "Audit Luxury SARL") return true;
  }

  if (entityType === "invoice") {
    const num = String(record.invoice_number || record.invoiceNumber || "");
    if (/^INV-TEST-[a-z0-9]{5}$/i.test(num)) return true;
  }

  if (entityType === "sponsoring") {
    const name = String(record.campaign_name || record.campaignName || "");
    if (/^Meta Ads Q3 - [a-z0-9]{5}$/i.test(name)) return true;
  }

  return false;
}

/**
 * Canonical check for whether an invoice is an active, actionable overdue receivable.
 * Rules:
 * - Cancelled and draft invoices are strictly excluded.
 * - Settled invoices (remaining balance <= 0) are NEVER overdue, regardless of raw database status.
 * - Explicit 'overdue' status triggers overdue only if unpaid balance remains.
 * - Invoices past due date (evaluated at end of due date) with unpaid balance trigger overdue.
 */
export function isInvoiceOverdue(
  inv: {
    status?: string | null;
    due_date?: string | null;
    dueDate?: string | null;
    total_amount?: number | string | null;
    totalAmount?: number | string | null;
    paid_amount?: number | string | null;
    paidAmount?: number | string | null;
  },
  refDate: Date = new Date()
): boolean {
  if (!inv) return false;
  const status = (inv.status || "").toLowerCase();
  if (status === "cancelled" || status === "draft") return false;

  const total = Number(inv.total_amount ?? inv.totalAmount) || 0;
  const paid = Number(inv.paid_amount ?? inv.paidAmount) || 0;
  const remaining = Math.max(0, total - paid);
  if (remaining <= 0.001) return false;

  if (status === "overdue") return true;

  const rawDue = inv.due_date ?? inv.dueDate;
  if (!rawDue) return false;

  try {
    const rawDueStr = String(rawDue).trim();
    if (!rawDueStr) return false;
    let dueDate: Date;
    if (rawDueStr.includes("T")) {
      dueDate = parseISO(rawDueStr);
    } else {
      dueDate = endOfDay(parseISO(rawDueStr));
    }
    if (!isValid(dueDate) || isNaN(dueDate.getTime())) {
      const fallback = new Date(rawDueStr);
      if (!isValid(fallback) || isNaN(fallback.getTime())) return false;
      dueDate = rawDueStr.includes("T") ? fallback : endOfDay(fallback);
    }
    return refDate.getTime() > dueDate.getTime();
  } catch {
    return false;
  }
}

export interface ClientFinancialsInput {
  client: {
    id: string;
    name?: string;
    client_type?: string | null;
    monthly_package_price?: number | string | null;
    default_service_fee?: number | string | null;
    default_sponsoring_budget?: number | string | null;
    commission_rate?: number | string | null;
  };
  invoices?: any[];
  payments?: any[];
  expenses?: any[];
  sponsoring?: any[];
  commissions?: any[];
  refDate?: Date;
}

export interface CalculatedClientFinancials {
  monthlyRevenue: number;
  sponsoringBudget: number;
  totalInvoiced: number;
  totalPaid: number;
  totalCollected: number; // semantic alias for totalPaid
  totalOutstanding: number;
  outstandingReceivables: number; // semantic alias for totalOutstanding
  paymentStatus: "PAID" | "PENDING" | "OVERDUE";
  hasOverdue: boolean;
  sponsoringAdSpend: number;
  sponsoringClientCharge: number;
  sponsoringMargin: number;
  directExpensesSum: number;
  clientExpenses: number;
  directCost: number;
  estimatedDirectCost: number; // backward-compatibility alias
  commissionRate: number;
  commissionAmount: number;
  commissionExpense: number; // semantic alias for commissionAmount
  estimatedCommission: number; // backward-compatibility alias
  netProfit: number;
  totalTopline: number;
  marginPercent: number;
  clientHealth: ClientProfitabilityHealth;
  netCashPosition: number;
}

/**
 * Authoritative Canonical Engine for Client Financial Calculations.
 * Shared across Client 360, Client Directory, and Financial OS.
 * Resolves DEFECT-FIN-01 (sponsoring & commission double-deduction),
 * DEFECT-FIN-02 (invoice eligibility / draft & cancelled exclusion),
 * DEFECT-FIN-03 (indeterminate profitability on zero revenue), and
 * DEFECT-FIN-04 (overdue invoice balance verification).
 */
export function calculateClientFinancials(input: ClientFinancialsInput): CalculatedClientFinancials {
  const {
    client,
    invoices = [],
    payments = [],
    expenses = [],
    sponsoring = [],
    commissions = [],
    refDate = new Date(),
  } = input;

  // 1. Invoice Eligibility & Receivables (DEFECT-FIN-02)
  // Strictly filter out cancelled and draft invoices from active financial claims
  const activeInvoices = invoices.filter((inv) => {
    const st = (inv.status || "").toLowerCase();
    return st !== "cancelled" && st !== "draft";
  });

  const totalInvoiced = activeInvoices.reduce(
    (sum, inv) => sum + (Number(inv.total_amount ?? inv.totalAmount) || 0),
    0
  );
  const invoicePaidTotal = activeInvoices.reduce(
    (sum, inv) => sum + (Number(inv.paid_amount ?? inv.paidAmount) || 0),
    0
  );
  const totalOutstanding = Math.max(0, totalInvoiced - invoicePaidTotal);

  // 2. Collections & Double-Counting Guard
  // Direct unlinked receipts + active invoice settlements
  const unlinkedIncomeTotal = payments
    .filter((p) => !(p.invoice_id ?? p.invoiceId))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalCollected = invoicePaidTotal + unlinkedIncomeTotal;
  const totalPaid = totalCollected;

  // 3. Overdue & Payment Status (DEFECT-FIN-04)
  const hasOverdue = activeInvoices.some((inv) => isInvoiceOverdue(inv, refDate));
  const paymentStatus: "PAID" | "PENDING" | "OVERDUE" = hasOverdue
    ? "OVERDUE"
    : (activeInvoices.length > 0 && totalOutstanding <= 0.001) || (activeInvoices.length === 0 && totalPaid > 0)
    ? "PAID"
    : "PENDING";

  // 4. Contract Revenue & Sponsoring Media Budget
  const monthlyRevenue =
    Number(client.monthly_package_price || client.default_service_fee || 0) ||
    activeInvoices.reduce((sum, inv) => sum + (Number(inv.service_revenue ?? inv.serviceRevenue) || 0), 0) ||
    0;

  const sponsoringBudget =
    Number(client.default_sponsoring_budget || 0) ||
    sponsoring.reduce((sum, sc) => sum + (Number(sc.budget_tnd ?? sc.budgetTnd) || 0), 0) ||
    0;

  const sponsoringAdSpend = sponsoring.reduce(
    (sum, sc) =>
      sum +
      (Number(
        sc.purchase_cost_tnd ??
          sc.purchaseCostTnd ??
          (sc as any).actual_spend_tnd ??
          (sc as any).actualSpendTnd
      ) || 0),
    0
  );
  const sponsoringClientCharge = sponsoring.reduce(
    (sum, sc) => sum + (Number(sc.client_charge_tnd ?? sc.clientChargeTnd ?? sc.budget_tnd ?? sc.budgetTnd) || 0),
    0
  );
  let sponsoringMargin = sponsoring.length > 0
    ? sponsoring.reduce((sum, sc) => sum + (Number(sc.margin_tnd ?? sc.marginTnd) || 0), 0)
    : 0;
  if (sponsoringMargin === 0 && (sponsoringClientCharge > 0 || sponsoringAdSpend > 0)) {
    sponsoringMargin = sponsoringClientCharge - sponsoringAdSpend;
  }

  // 5. Direct Cost & Commission Deductions (DEFECT-FIN-01)
  // Strictly exclude sponsoring_purchase and commission allocations to avoid double-deduction
  const directExpenses = expenses.filter((e) => {
    const alloc = (e.allocation || (e as any).allocation_type || "").toLowerCase();
    return alloc !== "sponsoring_purchase" && alloc !== "commission" && alloc !== "sales_commission";
  });
  const directExpensesSum = directExpenses.reduce(
    (sum, exp) => sum + (Number(exp.amount ?? (exp as any).amount_tnd ?? (exp as any).amountTnd) || 0),
    0
  );

  const commissionExpenses = expenses.filter((e) => {
    const alloc = (e.allocation || (e as any).allocation_type || "").toLowerCase();
    return alloc === "commission" || alloc === "sales_commission";
  });
  const commissionExpensesSum = commissionExpenses.reduce(
    (sum, exp) => sum + (Number(exp.amount ?? (exp as any).amount_tnd ?? (exp as any).amountTnd) || 0),
    0
  );
  const recordedCommission = commissions.length > 0
    ? commissions.reduce((sum, cm) => sum + (Number(cm.commissionAmount ?? cm.commission_amount) || 0), 0)
    : commissionExpensesSum;

  const defaultCommission = getBusinessRuleNumber("initial_commission_rate", 15);
  const commissionRate = Number(client.commission_rate || defaultCommission);
  const commissionAmount = recordedCommission > 0
    ? recordedCommission
    : monthlyRevenue * (commissionRate / 100);

  const directCost = directExpensesSum > 0 ? directExpensesSum : monthlyRevenue * 0.35;
  const estimatedDirectCost = directCost;
  const estimatedCommission = commissionAmount;

  // Total Client Outflows: Direct operating expenses + sponsoring ad spend + commissions
  const clientExpenses = directExpensesSum + sponsoringAdSpend + (recordedCommission > 0 ? recordedCommission : 0);

  // Net Cash Position: collected cash - all cash disbursed for client (deducts ad spend and commissions ONCE)
  const netCashPosition = totalCollected - directExpensesSum - sponsoringAdSpend - (recordedCommission > 0 ? recordedCommission : 0);

  // Net Profit (Contribution Profit) = Service Revenue + Sponsoring Margin - Commission - Direct Costs
  const netProfit = monthlyRevenue + sponsoringMargin - directCost - commissionAmount;
  const totalTopline = monthlyRevenue + sponsoringClientCharge;
  const marginPercent = totalTopline > 0 ? (netProfit / totalTopline) * 100 : 0;

  // 6. Indeterminate Profitability & Health (DEFECT-FIN-03)
  const highMarginThreshold = getBusinessRuleNumber("client_high_profit_margin_percent", 50);
  const medMarginThreshold = getBusinessRuleNumber("client_medium_profit_margin_percent", 25);
  const highProfitAmount = getBusinessRuleNumber("client_high_profit_amount_tnd", 1000);

  let clientHealth: ClientProfitabilityHealth = "MEDIUM";
  if (totalTopline <= 0) {
    // If revenue is 0 but costs were incurred, it is a genuine financial loss
    if (netProfit < -0.001) {
      clientHealth = "LOW PROFIT";
    } else {
      // 0 revenue and 0 profit/loss: indeterminate / no data
      clientHealth = "NO DATA";
    }
  } else if (marginPercent >= highMarginThreshold) {
    clientHealth = "HIGH PROFIT";
  } else if (marginPercent >= medMarginThreshold) {
    clientHealth = "MEDIUM";
  } else {
    clientHealth = "LOW PROFIT";
  }

  return {
    monthlyRevenue,
    sponsoringBudget,
    totalInvoiced,
    totalPaid,
    totalCollected: totalPaid,
    totalOutstanding,
    outstandingReceivables: totalOutstanding,
    paymentStatus,
    hasOverdue,
    sponsoringAdSpend,
    sponsoringClientCharge,
    sponsoringMargin,
    directExpensesSum,
    clientExpenses,
    directCost,
    estimatedDirectCost,
    commissionRate,
    commissionAmount,
    commissionExpense: commissionAmount,
    estimatedCommission,
    netProfit,
    totalTopline,
    marginPercent,
    clientHealth,
    netCashPosition,
  };
}

// ============================================================
// SUPER ADMIN DATA FETCHING & AGGREGATION
// ============================================================

export interface SuperAdminFinanceState {
  period: FinancialPeriod;
  kpis: FinancialSummaryKPIs;
  ledgerTransactions: CanonicalFinancialTransaction[];
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  categories: ExpenseCategory[];
  subscriptions: Subscription[];
  salaryRecords: SalaryRecord[];
  salaryPayments: SalaryPayment[];
  salaryRequests: SalaryRequest[];
  invoices: Invoice[];
  sponsoringCampaigns: SponsoringCampaign[];
  commissions: SalesCommission[];
  accounts: FinancialAccount[];
  closingPeriods: FinancialClosingPeriod[];
  clientProfitability: ClientProfitabilityRecord[];
  cashFlow: CashFlowStatement;
  auditLogs: FinancialAuditLog[];
  insights: SmartInsight[];
  loading: boolean;
  error: string | null;
}

export async function fetchCompanyFinance(
  period: FinancialPeriod,
  ctx?: PermissionContext,
  options?: { allowAnalyticsRead?: boolean; clientOverride?: any; includeDemo?: boolean }
): Promise<Omit<SuperAdminFinanceState, "loading" | "error">> {
  const caller = await resolveFinanceCallerContext(ctx, undefined, undefined, options);
  if (!caller.hasFinanceAccess) {
    throw new Error("Unauthorized: Access to module 'finance' is disabled for this account.");
  }
  const prevPeriod = getPreviousComparisonPeriod(period);
  const db = options?.clientOverride || supabase;

  // Parallel fetch of all canonical tables
  const [
    incomesRes,
    expensesRes,
    prevIncomesRes,
    prevExpensesRes,
    categoriesRes,
    subscriptionsRes,
    salaryRecordsRes,
    salaryPaymentsRes,
    salaryRequestsRes,
    invoicesRes,
    sponsoringRes,
    commissionsRes,
    accountsRes,
    closingPeriodsRes,
    clientsRes,
    auditLogsRes,
  ] = await Promise.all([
    // Current period incomes
    (db as any)
      .from("income_transactions")
      .select("*, client:clients(id, name), project:client_projects(id, title, client_name)")
      .gte("date", period.startDate)
      .lte("date", period.endDate)
      .order("date", { ascending: false }),

    // Current period expenses
    (db as any)
      .from("expense_transactions")
      .select("*, client:clients(id, name), project:client_projects(id, title, client_name), team_member:team_members(id, name)")
      .gte("date", period.startDate)
      .lte("date", period.endDate)
      .order("date", { ascending: false }),

    // Previous period incomes (for delta comparison)
    (db as any)
      .from("income_transactions")
      .select("amount, status, allocation, transaction_type")
      .gte("date", prevPeriod.startDate)
      .lte("date", prevPeriod.endDate)
      .neq("status", "cancelled"),

    // Previous period expenses (for delta comparison)
    (db as any)
      .from("expense_transactions")
      .select("amount, status, allocation, transaction_type")
      .gte("date", prevPeriod.startDate)
      .lte("date", prevPeriod.endDate)
      .neq("status", "cancelled"),

    // Categories
    (db as any).from("expense_categories").select("*").order("sort_order", { ascending: true }),

    // Subscriptions
    (db as any).from("subscriptions").select("*").order("name", { ascending: true }),

    // Salary records with team members
    (db as any)
      .from("salary_records")
      .select("*, team_member:team_members(id, name, email, position, role, division, photo_url)")
      .order("created_at", { ascending: false }),

    // Salary payments in period
    (db as any)
      .from("salary_payments")
      .select("*, team_member:team_members(id, name, email, position, division, photo_url)")
      .gte("payment_date", period.startDate)
      .lte("payment_date", period.endDate)
      .order("payment_date", { ascending: false }),

    // Salary requests (all pending + recent)
    (db as any)
      .from("salary_requests")
      .select("*, team_member:team_members(id, name, email, position, role, division, photo_url)")
      .order("created_at", { ascending: false }),

    // Invoices
    (db as any)
      .from("invoices")
      .select("*, client:clients(id, name), project:client_projects(id, title, client_name)")
      .order("issue_date", { ascending: false }),

    // Sponsoring Campaigns
    (db as any)
      .from("sponsoring_campaigns")
      .select("*, client:clients(id, name), project:client_projects(id, title, client_name)")
      .order("date", { ascending: false }),

    // Sales Commissions
    (db as any)
      .from("sales_commissions")
      .select("*, team_member:team_members(id, name), client:clients(id, name)")
      .order("created_at", { ascending: false }),

    // Financial Accounts (Treasury)
    (db as any).from("financial_accounts").select("*").order("name", { ascending: true }),

    // Closing Periods
    (db as any).from("financial_closing_periods").select("*").order("period_month", { ascending: false }),

    // Clients
    (db as any).from("clients").select("*").order("name", { ascending: true }),

    // Recent audit logs
    (db as any).from("financial_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  const includeDemo = options?.includeDemo === true;
  const rawClientsAll: any[] = clientsRes.data || [];
  const demoClientIds = new Set(
    rawClientsAll.filter((c: any) => isDemoFinancialRecord("client", c)).map((c: any) => c.id)
  );

  const rawIncomes: any[] = includeDemo
    ? (incomesRes.data || [])
    : (incomesRes.data || []).filter(
        (inc: any) => !isDemoFinancialRecord("income", inc) && !demoClientIds.has(inc.client_id)
      );

  const rawExpenses: any[] = includeDemo
    ? (expensesRes.data || [])
    : (expensesRes.data || []).filter(
        (exp: any) => !isDemoFinancialRecord("expense", exp) && !demoClientIds.has(exp.client_id)
      );

  const prevIncomes: any[] = includeDemo
    ? (prevIncomesRes.data || [])
    : (prevIncomesRes.data || []).filter(
        (inc: any) => !isDemoFinancialRecord("income", inc) && !demoClientIds.has(inc.client_id)
      );

  const prevExpenses: any[] = includeDemo
    ? (prevExpensesRes.data || [])
    : (prevExpensesRes.data || []).filter(
        (exp: any) => !isDemoFinancialRecord("expense", exp) && !demoClientIds.has(exp.client_id)
      );

  const categories: ExpenseCategory[] = categoriesRes.data || [];
  const subscriptions: Subscription[] = subscriptionsRes.data || [];
  const salaryRecords: SalaryRecord[] = salaryRecordsRes.data || [];
  const salaryPayments: SalaryPayment[] = salaryPaymentsRes.data || [];
  const salaryRequests: SalaryRequest[] = salaryRequestsRes.data || [];

  const rawInvoices: any[] = includeDemo
    ? (invoicesRes.data || [])
    : (invoicesRes.data || []).filter(
        (inv: any) => !isDemoFinancialRecord("invoice", inv) && !demoClientIds.has(inv.client_id)
      );

  const rawSponsoring: any[] = includeDemo
    ? (sponsoringRes.data || [])
    : (sponsoringRes.data || []).filter(
        (sc: any) => !isDemoFinancialRecord("sponsoring", sc) && !demoClientIds.has(sc.client_id)
      );

  const rawCommissions: any[] = includeDemo
    ? (commissionsRes.data || [])
    : (commissionsRes.data || []).filter((c: any) => !demoClientIds.has(c.client_id));

  const accounts: FinancialAccount[] = (accountsRes.data || [])
    .filter((a: any) => includeDemo || !isDemoFinancialRecord("account", a))
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      accountType: a.account_type,
      currency: a.currency,
      openingBalance: Number(a.opening_balance || 0),
      currentBalance: Number(a.current_balance || 0),
      accountNumber: a.account_number,
      bankName: a.bank_name,
      isDefault: Boolean(a.is_default),
      status: a.status,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));

  const closingPeriods: FinancialClosingPeriod[] = (closingPeriodsRes.data || []).map((cp: any) => ({
    id: cp.id,
    periodMonth: cp.period_month,
    status: cp.status,
    checklist: cp.checklist || {},
    closingSummary: cp.closing_summary || null,
    closedAt: cp.closed_at,
    closedBy: cp.closed_by,
    reopenedAt: cp.reopened_at,
    reopenedBy: cp.reopened_by,
    reopenReason: cp.reopen_reason,
    createdAt: cp.created_at,
    updatedAt: cp.updated_at,
  }));

  const clients: any[] = includeDemo
    ? rawClientsAll
    : rawClientsAll.filter((c: any) => !demoClientIds.has(c.id));
  const auditLogs: FinancialAuditLog[] = auditLogsRes.data || [];

  // Transform Invoices
  const invoices: Invoice[] = rawInvoices.map((inv: any) => ({
    id: inv.id,
    invoiceNumber: inv.invoice_number,
    clientId: inv.client_id,
    clientName: inv.client?.name || "Client",
    projectId: inv.project_id,
    projectName: inv.project?.title,
    issueDate: inv.issue_date,
    dueDate: inv.due_date,
    serviceRevenue: Number(inv.service_revenue || 0),
    sponsoringBudget: Number(inv.sponsoring_budget || 0),
    otherRevenue: Number(inv.other_revenue || 0),
    subtotal: Number(inv.subtotal || 0),
    taxAmount: Number(inv.tax_amount || 0),
    totalAmount: Number(inv.total_amount || 0),
    paidAmount: Number(inv.paid_amount || 0),
    currency: inv.currency || "TND",
    status: inv.status,
    items: inv.items || [],
    notes: inv.notes,
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  }));

  // Transform Sponsoring Campaigns
  const sponsoringCampaigns: SponsoringCampaign[] = rawSponsoring.map((sc: any) => {
    const budgetTnd = Number(sc.budget_tnd || 0);
    const usdAmount = Number(sc.usd_amount || 0);
    const purchaseRate = Number(sc.purchase_rate || getBusinessRuleNumber("sponsoring_purchase_rate", 3.37));
    const purchaseCostTnd = Number(sc.purchase_cost_tnd || (usdAmount * purchaseRate));
    const clientRate = Number(sc.client_rate || getBusinessRuleNumber("sponsoring_client_rate", 4.00));
    const clientChargeTnd = Number(sc.client_charge_tnd || budgetTnd);
    const marginTnd = Number(sc.margin_tnd !== undefined ? sc.margin_tnd : (clientChargeTnd - purchaseCostTnd));
    const marginPercent = clientChargeTnd > 0 ? (marginTnd / clientChargeTnd) * 100 : 0;

    return {
      id: sc.id,
      clientId: sc.client_id,
      clientName: sc.client?.name || "Client",
      projectId: sc.project_id,
      projectName: sc.project?.title,
      invoiceId: sc.invoice_id,
      campaignName: sc.campaign_name,
      platform: sc.platform || "Meta Ads",
      budgetTnd,
      usdAmount,
      purchaseRate,
      purchaseCostTnd,
      clientRate,
      clientChargeTnd,
      marginTnd,
      marginPercent,
      paymentStatus: sc.payment_status || "pending",
      executionStatus: sc.execution_status || "active",
      date: sc.date,
      periodMonth: sc.period_month || format(parseISO(sc.date), "yyyy-MM"),
      notes: sc.notes,
      createdAt: sc.created_at,
      updatedAt: sc.updated_at,
    };
  });

  // Transform Commissions
  const commissions: SalesCommission[] = rawCommissions.map((c: any) => ({
    id: c.id,
    teamMemberId: c.team_member_id,
    teamMemberName: c.team_member?.name || "Team Member",
    clientId: c.client_id,
    clientName: c.client?.name || "Client",
    invoiceId: c.invoice_id,
    serviceRevenue: Number(c.service_revenue || 0),
    commissionRate: Number(c.commission_rate || 10),
    commissionAmount: Number(c.commission_amount || 0),
    periodMonth: c.period_month,
    status: c.status || "pending",
    salaryPaymentId: c.salary_payment_id,
    approvedBy: c.approved_by,
    approvedAt: c.approved_at,
    notes: c.notes,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  // ============================================================
  // UNIFIED CANONICAL FINANCIAL LEDGER
  // Merging Inflow & Outflow Transactions with complete attribution
  // ============================================================

  const ledgerTransactions: CanonicalFinancialTransaction[] = [];

  // Inflows
  for (const inc of rawIncomes) {
    const isTransfer = inc.transaction_type === "TRANSFER" || inc.allocation === "transfer";
    const alloc: FinancialAllocation = isTransfer
      ? "transfer"
      : (inc.allocation as FinancialAllocation) || (
          inc.category === "Retainer" || inc.category === "Client Payment" ? "client_service" : "other"
        );

    ledgerTransactions.push({
      id: inc.id,
      transactionType: isTransfer ? "TRANSFER" : ((inc.transaction_type as TransactionType) || "CLIENT_PAYMENT"),
      direction: "inflow",
      amount: Number(inc.amount || 0),
      currency: inc.currency || "TND",
      date: inc.date,
      category: inc.category,
      categoryName: inc.category,
      description: inc.description || `${inc.category}${inc.client?.name ? ` (${inc.client.name})` : ""}`,
      allocation: alloc,
      source: inc.invoice_id ? "client_invoice" : "client_payment",
      status: inc.status === "received" ? "received" : inc.status === "pending" ? "pending" : "cancelled",
      paymentMethod: inc.payment_method || "Bank Transfer",
      reference: inc.reference,
      notes: inc.notes,
      vendor: null,
      clientId: inc.client_id,
      clientName: inc.client?.name || null,
      projectId: inc.project_id,
      projectName: inc.project?.title || null,
      teamMemberId: null,
      teamMemberName: null,
      salaryPaymentId: null,
      subscriptionId: null,
      sponsoringCampaignId: null,
      commissionId: null,
      invoiceId: inc.invoice_id || null,
      accountId: inc.account_id || null,
      accountName: accounts.find(a => a.id === inc.account_id)?.name || null,
      receiptUrl: inc.receipt_url,
      createdBy: inc.created_by,
      createdAt: inc.created_at,
      updatedAt: inc.updated_at,
    });
  }

  // Outflows
  for (const exp of rawExpenses) {
    const isTransfer = exp.transaction_type === "TRANSFER" || exp.allocation === "transfer";
    let alloc: FinancialAllocation = isTransfer ? "transfer" : (exp.allocation as FinancialAllocation) || "operating_expense";
    if (!isTransfer) {
      if (exp.sponsoring_campaign_id) alloc = "sponsoring_purchase";
      else if (exp.salary_payment_id) alloc = "payroll";
      else if (exp.commission_id) alloc = "sales_commission";
      else if (exp.category_name?.toLowerCase().includes("software")) alloc = "software";
      else if (exp.category_name?.toLowerCase().includes("equipment")) alloc = "equipment";
    }

    let tType: TransactionType = isTransfer ? "TRANSFER" : "EXPENSE";
    if (alloc === "sponsoring_purchase") tType = "SPONSORING_PURCHASE";
    else if (alloc === "payroll") tType = "SALARY";
    else if (alloc === "sales_commission") tType = "COMMISSION";

    ledgerTransactions.push({
      id: exp.id,
      transactionType: tType,
      direction: "outflow",
      amount: Number(exp.amount || 0),
      currency: exp.currency || "TND",
      date: exp.date,
      category: exp.category_name,
      categoryName: exp.category_name,
      description: exp.description || `${exp.category_name}${exp.vendor ? ` (${exp.vendor})` : ""}`,
      allocation: alloc,
      source: exp.salary_payment_id ? "payroll_record" : exp.subscription_id ? "subscription" : exp.sponsoring_campaign_id ? "sponsoring_engine" : "direct_expense",
      status: exp.status === "paid" ? "paid" : exp.status === "pending" ? "pending" : "cancelled",
      paymentMethod: exp.payment_method || "Bank Transfer",
      reference: exp.reference,
      notes: exp.notes,
      vendor: exp.vendor || null,
      clientId: exp.client_id,
      clientName: exp.client?.name || null,
      projectId: exp.project_id,
      projectName: exp.project?.title || null,
      teamMemberId: exp.team_member_id,
      teamMemberName: exp.team_member?.name || null,
      salaryPaymentId: exp.salary_payment_id || null,
      subscriptionId: exp.subscription_id || null,
      sponsoringCampaignId: exp.sponsoring_campaign_id || null,
      commissionId: exp.commission_id || null,
      invoiceId: null,
      accountId: exp.account_id || null,
      accountName: accounts.find(a => a.id === exp.account_id)?.name || null,
      receiptUrl: exp.receipt_url,
      createdBy: exp.created_by,
      createdAt: exp.created_at,
      updatedAt: exp.updated_at,
    });
  }

  // Sort canonical ledger by date descending
  ledgerTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ============================================================
  // DERIVE CANONICAL FINANCIAL KPIS
  // Strict formula calculation — NO hardcoding, NO manually entered profit
  // ============================================================

  // Revenue Breakdown (Transfers strictly excluded)
  const receivedInflows = ledgerTransactions.filter(t => t.direction === "inflow" && t.status === "received");
  const clientServicesRevenue = receivedInflows
    .filter(t => t.allocation === "client_service" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const sponsoringCollected = receivedInflows
    .filter(t => t.allocation === "sponsoring_collected" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const otherRevenue = receivedInflows
    .filter(t => t.allocation !== "client_service" && t.allocation !== "sponsoring_collected" && t.allocation !== "transfer" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRevenue = clientServicesRevenue + sponsoringCollected + otherRevenue;

  // Expense Outflow Breakdown (Transfers strictly excluded)
  const paidOutflows = ledgerTransactions.filter(t => t.direction === "outflow" && t.status === "paid");
  const sponsoringPurchasesCost = paidOutflows
    .filter(t => t.allocation === "sponsoring_purchase" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const salesCommissionsCost = paidOutflows
    .filter(t => t.allocation === "sales_commission" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const payroll = paidOutflows
    .filter(t => t.allocation === "payroll" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const operatingExpenses = paidOutflows
    .filter(t => t.allocation !== "sponsoring_purchase" && t.allocation !== "sales_commission" && t.allocation !== "payroll" && t.allocation !== "transfer" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = sponsoringPurchasesCost + salesCommissionsCost + payroll + operatingExpenses;

  // CALCULATED NET PROFIT:
  // Revenue - Sponsoring Costs - Sales Commissions - Payroll - Operating Expenses
  const netProfit = totalRevenue - sponsoringPurchasesCost - salesCommissionsCost - payroll - operatingExpenses;

  // Sponsoring Margin:
  // Sponsoring Collected - Sponsoring Purchases Cost
  const sponsoringMargin = sponsoringCollected - sponsoringPurchasesCost;

  // Cash: Total across active financial accounts segregated by currency
  const activeAccounts = accounts.filter(a => a.status === "active");
  const cashByCurrency: Record<string, number> = {};
  for (const a of activeAccounts) {
    const curr = a.currency || "TND";
    cashByCurrency[curr] = (cashByCurrency[curr] || 0) + a.currentBalance;
  }
  const cashTnd = cashByCurrency["TND"] || 0;
  const cashUsd = cashByCurrency["USD"] || 0;
  // Primary operating currency (TND) liquid balance
  const totalCashBalance = cashTnd;

  // Outstanding Receivables: Authoritative sum of unpaid invoice balances
  const unpaidInvoices = invoices.filter(inv => inv.status === "sent" || inv.status === "partially_paid" || inv.status === "overdue");
  const outstandingFromInvoices = unpaidInvoices.reduce((sum, inv) => sum + Math.max(0, inv.totalAmount - (inv.paidAmount || 0)), 0);
  const pendingInflows = ledgerTransactions
    .filter(t => t.direction === "inflow" && t.status === "pending" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);
  const outstandingPayments = outstandingFromInvoices > 0 ? outstandingFromInvoices : pendingInflows;

  // Pipeline metrics
  const pendingIncome = pendingInflows;
  const pendingExpenses = ledgerTransactions
    .filter(t => t.direction === "outflow" && t.status === "pending" && t.transactionType !== "TRANSFER")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingSalaryRequests = salaryRequests.filter(r => r.status === "pending");
  const pendingSalaryRequestsCount = pendingSalaryRequests.length;
  const pendingSalaryRequestsTotal = pendingSalaryRequests.reduce((sum, r) => sum + Number(r.requested_amount || 0), 0);

  // Recurring Monthly Burn
  const recurringBurn = subscriptions
    .filter(s => s.status === "active")
    .reduce((sum, s) => {
      const amt = Number(s.amount || 0);
      if (s.billing_cycle === "quarterly") return sum + amt / 3;
      if (s.billing_cycle === "yearly") return sum + amt / 12;
      return sum + amt;
    }, 0);

  // Previous Period Comparison
  const prevReceivedInflows = prevIncomes.filter((i: any) => i.status === "received");
  const prevRevenue = prevReceivedInflows.reduce((sum: number, i: any) => sum + Number(i.amount || 0), 0);

  const prevPaidOutflows = prevExpenses.filter((e: any) => e.status === "paid");
  const prevExpensesTotal = prevPaidOutflows.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
  const prevNetProfit = prevRevenue - prevExpensesTotal;

  const zeroBehavior = getBusinessRuleText("historical_profit_zero_behavior", "null");
  const revenueDeltaPercent = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;
  const expenseDeltaPercent = prevExpensesTotal > 0 ? ((totalExpenses - prevExpensesTotal) / prevExpensesTotal) * 100 : null;
  let profitDeltaPercent: number | null = null;
  if (prevNetProfit !== 0) {
    profitDeltaPercent = ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100;
  } else if (zeroBehavior === "zero") {
    profitDeltaPercent = 0;
  } else if (zeroBehavior === "hundred" && netProfit > 0) {
    profitDeltaPercent = 100;
  } else {
    profitDeltaPercent = null;
  }

  const kpis: FinancialSummaryKPIs = {
    revenue: totalRevenue,
    totalRevenue,
    expenses: totalExpenses,
    netProfit,
    profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    cash: totalCashBalance,
    cashTnd,
    cashUsd,
    cashByCurrency,
    outstandingPayments,
    sponsoringMargin,
    payroll,
    operatingExpenses,
    clientServicesRevenue,
    sponsoringCollected,
    otherRevenue,
    sponsoringPurchasesCost,
    salesCommissionsCost,
    pendingIncome,
    pendingExpenses,
    pendingSalaryRequestsCount,
    pendingSalaryRequestsTotal,
    prevRevenue,
    prevExpenses: prevExpensesTotal,
    prevNetProfit,
    revenueDeltaPercent,
    expenseDeltaPercent,
    profitDeltaPercent,
    totalIncome: totalRevenue,
    totalExpenses,
    netCashFlow: netProfit,
    totalSalaries: payroll,
    recurringBurn,
    prevTotalIncome: prevRevenue,
    prevTotalExpenses: prevExpensesTotal,
    prevNetCashFlow: prevNetProfit,
    incomeDeltaPercent: revenueDeltaPercent,
  };

  // ============================================================
  // CLIENT PROFITABILITY MATRIX
  // Calculated per client strictly from authoritative ledger facts
  // ============================================================

  const clientProfitability: ClientProfitabilityRecord[] = clients.map((c: any) => {
    const clientInflows = receivedInflows.filter(t => t.clientId === c.id);
    const clientOutflows = paidOutflows.filter(t => t.clientId === c.id);
    const clientCampaigns = sponsoringCampaigns.filter(sc => sc.clientId === c.id);
    const clientInvoices = invoices.filter(inv => inv.clientId === c.id);
    const clientComms = commissions.filter(cm => cm.clientId === c.id);

    const fin = calculateClientFinancials({
      client: c,
      invoices: clientInvoices,
      payments: clientInflows,
      expenses: clientOutflows,
      sponsoring: clientCampaigns,
      commissions: clientComms,
    });

    return {
      clientId: c.id,
      clientName: c.name,
      status: c.status || "active",
      industry: c.industry || "General Agency",
      clientType: c.client_type || "monthly",
      monthlyPackage: Number(c.monthly_package_price || 0),
      serviceRevenue: fin.monthlyRevenue,
      sponsoringBudget: fin.sponsoringClientCharge,
      totalRevenue: fin.totalTopline,
      directCost: fin.directCost,
      sponsoringCost: fin.sponsoringAdSpend,
      sponsoringMargin: fin.sponsoringMargin,
      commission: fin.commissionAmount,
      contributionProfit: fin.netProfit,
      marginPercent: fin.marginPercent,
      health: fin.clientHealth,
      paymentStatus: fin.paymentStatus,
      paid: fin.totalPaid,
      due: fin.totalOutstanding,
    };
  });

  // Sort client profitability by contribution profit descending
  clientProfitability.sort((a, b) => b.contributionProfit - a.contributionProfit);

  // ============================================================
  // CASH FLOW STATEMENT
  // ============================================================

  const openingCash = accounts.filter((a) => a.status === "active").reduce((sum, a) => sum + a.openingBalance, 0);
  const cashFlow: CashFlowStatement = {
    openingCash,
    clientPayments: clientServicesRevenue + sponsoringCollected,
    otherIncome: otherRevenue,
    totalInflows: totalRevenue,
    sponsoringPurchases: sponsoringPurchasesCost,
    payroll,
    commissions: salesCommissionsCost,
    operatingExpenses,
    withdrawals: 0,
    totalOutflows: totalExpenses,
    closingCash: openingCash + totalRevenue - totalExpenses,
    accounts,
  };

  // ============================================================
  // DETERMINISTIC INSIGHTS ENGINE
  // ============================================================

  const insights = generateDeterministicInsights({
    kpis,
    period,
    incomes: rawIncomes,
    expenses: rawExpenses,
    sponsoringCampaigns,
    clientProfitability,
    closingPeriods,
  });

  return {
    period,
    kpis,
    ledgerTransactions,
    incomes: rawIncomes,
    expenses: rawExpenses,
    categories,
    subscriptions,
    salaryRecords,
    salaryPayments,
    salaryRequests,
    invoices,
    sponsoringCampaigns,
    commissions,
    accounts,
    closingPeriods,
    clientProfitability,
    cashFlow,
    auditLogs,
    insights,
  };
}

// ============================================================
// DRILL-DOWN ENGINE (Section 22)
// Dashboard KPI -> click -> drill down -> underlying transactions -> source records
// ============================================================

export function buildDrillDownData(
  category: DrillDownCategory,
  state: Omit<SuperAdminFinanceState, "loading" | "error">
): DrillDownState {
  const { kpis, ledgerTransactions, period } = state;

  switch (category) {
    case "net_profit": {
      const formulaBreakdown: DrillDownBreakdownItem[] = [
        { label: "Total Revenue Collected", amount: kpis.revenue, operator: "+" },
        { label: "Sponsoring USD Ad Purchases", amount: kpis.sponsoringPurchasesCost, operator: "-" },
        { label: "Sales & Account Commissions", amount: kpis.salesCommissionsCost, operator: "-" },
        { label: "Team Payroll & Payouts", amount: kpis.payroll, operator: "-" },
        { label: "Operating & SaaS Expenses", amount: kpis.operatingExpenses, operator: "-" },
        { label: "CALCULATED NET PROFIT", amount: kpis.netProfit, operator: "=", highlight: true },
      ];

      return {
        category,
        title: "Net Profit Drill-Down",
        totalAmount: kpis.netProfit,
        periodLabel: period.label,
        formulaBreakdown,
        transactions: ledgerTransactions.filter(t => t.status === "received" || t.status === "paid"),
      };
    }

    case "revenue": {
      const formulaBreakdown: DrillDownBreakdownItem[] = [
        { label: "Client Retainers & Services", amount: kpis.clientServicesRevenue, operator: "+" },
        { label: "Sponsoring Budget Collected", amount: kpis.sponsoringCollected, operator: "+" },
        { label: "Other Operating Inflows", amount: kpis.otherRevenue, operator: "+" },
        { label: "TOTAL REVENUE", amount: kpis.revenue, operator: "=", highlight: true },
      ];

      return {
        category,
        title: "Revenue Drill-Down",
        totalAmount: kpis.revenue,
        periodLabel: period.label,
        formulaBreakdown,
        transactions: ledgerTransactions.filter(t => t.direction === "inflow"),
      };
    }

    case "expenses": {
      const formulaBreakdown: DrillDownBreakdownItem[] = [
        { label: "Sponsoring Purchases (Ad Spend)", amount: kpis.sponsoringPurchasesCost, operator: "+" },
        { label: "Team Payroll & Advances", amount: kpis.payroll, operator: "+" },
        { label: "Sales Commissions", amount: kpis.salesCommissionsCost, operator: "+" },
        { label: "Operational & Software Expenses", amount: kpis.operatingExpenses, operator: "+" },
        { label: "TOTAL OUTFLOWS", amount: kpis.expenses, operator: "=", highlight: true },
      ];

      return {
        category,
        title: "Expenses & Outflows Drill-Down",
        totalAmount: kpis.expenses,
        periodLabel: period.label,
        formulaBreakdown,
        transactions: ledgerTransactions.filter(t => t.direction === "outflow"),
      };
    }

    case "sponsoring_margin": {
      const formulaBreakdown: DrillDownBreakdownItem[] = [
        { label: "Client Sponsoring Budget Collected", amount: kpis.sponsoringCollected, operator: "+" },
        { label: "USD Campaign Purchases Cost", amount: kpis.sponsoringPurchasesCost, operator: "-" },
        { label: "NET SPONSORING MARGIN", amount: kpis.sponsoringMargin, operator: "=", highlight: true },
      ];

      return {
        category,
        title: "Sponsoring Margin & Arbitrage Drill-Down",
        totalAmount: kpis.sponsoringMargin,
        periodLabel: period.label,
        formulaBreakdown,
        transactions: ledgerTransactions.filter(t => t.allocation === "sponsoring_collected" || t.allocation === "sponsoring_purchase"),
      };
    }

    case "cash": {
      const formulaBreakdown: DrillDownBreakdownItem[] = [
        { label: "Opening Cash Balances", amount: state.cashFlow.openingCash, operator: "+" },
        { label: "Total Period Inflows", amount: state.cashFlow.totalInflows, operator: "+" },
        { label: "Total Period Outflows", amount: state.cashFlow.totalOutflows, operator: "-" },
        { label: "CURRENT CASH ON HAND", amount: kpis.cash, operator: "=", highlight: true },
      ];

      return {
        category,
        title: "Cash Flow & Treasury Drill-Down",
        totalAmount: kpis.cash,
        periodLabel: period.label,
        formulaBreakdown,
        transactions: ledgerTransactions.filter(t => t.status === "received" || t.status === "paid"),
      };
    }

    case "payroll": {
      const formulaBreakdown: DrillDownBreakdownItem[] = [
        { label: "Base Monthly Salaries Paid", amount: kpis.payroll, operator: "+" },
        { label: "TOTAL PAYROLL OUTLAYS", amount: kpis.payroll, operator: "=", highlight: true },
      ];

      return {
        category,
        title: "Payroll & Compensation Drill-Down",
        totalAmount: kpis.payroll,
        periodLabel: period.label,
        formulaBreakdown,
        transactions: ledgerTransactions.filter(t => t.allocation === "payroll"),
      };
    }

    case "operating_expenses": {
      return {
        category,
        title: "Operating Expenses Drill-Down",
        totalAmount: kpis.operatingExpenses,
        periodLabel: period.label,
        transactions: ledgerTransactions.filter(t => t.direction === "outflow" && t.allocation !== "sponsoring_purchase" && t.allocation !== "payroll" && t.allocation !== "sales_commission"),
      };
    }

    case "outstanding": {
      return {
        category,
        title: "Outstanding Payments Drill-Down",
        totalAmount: kpis.outstandingPayments,
        periodLabel: period.label,
        transactions: ledgerTransactions.filter(t => t.direction === "inflow" && t.status === "pending"),
      };
    }
  }
}

// ============================================================
// DETERMINISTIC INSIGHTS ENGINE (Section 15)
// Smart insights strictly generated from actual database records
// ============================================================

export function generateDeterministicInsights(params: {
  kpis: FinancialSummaryKPIs;
  period: FinancialPeriod;
  incomes: any[];
  expenses: any[];
  sponsoringCampaigns?: SponsoringCampaign[];
  clientProfitability?: ClientProfitabilityRecord[];
  closingPeriods?: FinancialClosingPeriod[];
}): SmartInsight[] {
  const { kpis, period, clientProfitability, sponsoringCampaigns, closingPeriods } = params;
  const insights: SmartInsight[] = [];

  // 1. Sponsoring Revenue Share & Margin
  const minSponsoringMargin = getBusinessRuleNumber("minimum_net_margin_for_sponsoring_efficiency", 15);
  if (kpis.revenue > 0 && kpis.sponsoringCollected > 0) {
    const sponsoringShare = Math.round((kpis.sponsoringCollected / kpis.revenue) * 100);
    const sponsoringMarginRate = kpis.sponsoringCollected > 0
      ? Math.round((kpis.sponsoringMargin / kpis.sponsoringCollected) * 100)
      : 0;

    insights.push({
      id: "sponsoring_performance",
      type: sponsoringMarginRate >= minSponsoringMargin ? "positive" : "warning",
      category: "sponsoring",
      title: "Sponsoring Arbitrage Efficiency",
      description: sponsoringMarginRate >= minSponsoringMargin
        ? `Sponsoring represents ${sponsoringShare}% of collected revenue this period (${formatCurrency(kpis.sponsoringCollected)}), delivering a healthy ${sponsoringMarginRate}% margin (${formatCurrency(kpis.sponsoringMargin)} net profit) meeting your configured ${minSponsoringMargin}% target.`
        : `Sponsoring represents ${sponsoringShare}% of revenue (${formatCurrency(kpis.sponsoringCollected)}) but delivers a ${sponsoringMarginRate}% net margin, falling below your configured ${minSponsoringMargin}% target efficiency.`,
      metric: `${sponsoringMarginRate}% Net Margin`,
      badge: sponsoringMarginRate >= minSponsoringMargin ? "Healthy Arbitrage" : "Low Margin",
    });
  }

  // 2. Client Profitability / Concentration Insight
  if (clientProfitability && clientProfitability.length > 0) {
    const topClient = clientProfitability[0];
    if (topClient.totalRevenue > 0) {
      insights.push({
        id: "top_client_contribution",
        type: "positive",
        category: "clients",
        title: `Flagship Client: ${topClient.clientName}`,
        description: `${topClient.clientName} generates the highest revenue (${formatCurrency(topClient.totalRevenue)}), with a contribution profit of ${formatCurrency(topClient.contributionProfit)} after commissions and sponsoring costs.`,
        metric: `${Math.round(topClient.marginPercent)}% Margin`,
        badge: topClient.health,
      });
    }

    // Dynamic Low-Margin Client Warning
    const lowMarginThreshold = getBusinessRuleNumber("low_profit_client_margin_percent", 20);
    const lowMarginClient = clientProfitability.find(c => c.health === "LOW PROFIT" || c.marginPercent < lowMarginThreshold);
    if (lowMarginClient) {
      insights.push({
        id: "low_margin_client_warning",
        type: "warning",
        category: "clients",
        title: `Low-Margin Client: ${lowMarginClient.clientName}`,
        description: `Client margin (${Math.round(lowMarginClient.marginPercent)}%) is below your configured ${lowMarginThreshold}% profitability target.`,
        metric: `${Math.round(lowMarginClient.marginPercent)}% Margin`,
        badge: "Low Margin",
      });
    }

    const highCommissionThreshold = getBusinessRuleNumber("high_commission_amount", 200);
    const highCommissionClient = clientProfitability.find(c => c.commission > highCommissionThreshold);
    if (highCommissionClient) {
      insights.push({
        id: "commission_impact",
        type: "info",
        category: "salaries",
        title: `Commission Impact: ${highCommissionClient.clientName}`,
        description: `${highCommissionClient.clientName} generates strong revenue, but sales commissions (${formatCurrency(highCommissionClient.commission)}) exceed your configured ${formatCurrency(highCommissionThreshold)} impact threshold.`,
        metric: formatCurrency(highCommissionClient.commission),
        badge: "Sales Payout",
      });
    }
  }

  // 3. Top Expense Category
  if (params.expenses && params.expenses.length > 0) {
    const catMap = new Map<string, number>();
    for (const exp of params.expenses) {
      const cat = exp.category_name || exp.category || "General";
      const amt = Number(exp.amount || 0);
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
    }
    let topCat = "";
    let topAmt = 0;
    for (const [cat, amt] of catMap.entries()) {
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    }
    const totExp = kpis.totalExpenses || kpis.expenses || topAmt;
    if (topCat && totExp > 0) {
      const pct = Math.round((topAmt / totExp) * 100);
      insights.push({
        id: "top-expense-category",
        type: "info",
        category: "expenses",
        title: `Top Expense Category: ${topCat}`,
        description: `${topCat} represents ${pct}% of total outlays (${formatCurrency(topAmt)}).`,
        metric: `${pct}% of Outlays`,
        badge: "Largest Outlay",
      });
    }
  }

  // 4. Cash Flow & Net Profit Surplus / Deficit
  const netPositiveVal = kpis.netCashFlow > 0 ? kpis.netCashFlow : kpis.netProfit;
  if (netPositiveVal > 0) {
    insights.push({
      id: "net-cash-positive",
      type: "positive",
      category: "cash_flow",
      title: "Net Cash Flow Surplus",
      description: `Operating cash flow is net positive by ${formatCurrency(netPositiveVal)} for this period.`,
      metric: formatCurrency(netPositiveVal, { showSign: true }),
      badge: "Operating Surplus",
    });
  } else if (kpis.revenue > 0 || kpis.expenses > 0) {
    insights.push({
      id: "net_profit_summary",
      type: "negative",
      category: "cash_flow",
      title: "Operating Deficit Alert",
      description: `Outflows exceed inflows by ${formatCurrency(Math.abs(kpis.netProfit))} for ${period.label}. Review operational burn rate.`,
      metric: formatCurrency(kpis.netProfit, { showSign: true }),
      badge: "Deficit",
    });
  }

  // 5. Fixed Monthly Burn & Recurring Expenses
  const fixedBurnWarningRatio = getBusinessRuleNumber("high_fixed_burn_revenue_percent", 40);
  if (kpis.recurringBurn > 0) {
    const burnRatio = kpis.revenue > 0 ? Math.round((kpis.recurringBurn / kpis.revenue) * 100) : 0;
    insights.push({
      id: "fixed_burn_insight",
      type: burnRatio > fixedBurnWarningRatio ? "warning" : "info",
      category: "subscriptions",
      title: "Fixed Monthly Subscriptions & SaaS",
      description: burnRatio > fixedBurnWarningRatio
        ? `Fixed monthly recurring expenses stand at ${formatCurrency(kpis.recurringBurn)} (${burnRatio}% of monthly revenue), exceeding your configured ${fixedBurnWarningRatio}% burn ceiling.`
        : `Fixed monthly recurring expenses stand at ${formatCurrency(kpis.recurringBurn)} (${burnRatio}% of monthly revenue), safely within your configured ${fixedBurnWarningRatio}% burn ceiling.`,
      metric: formatCurrency(kpis.recurringBurn),
      badge: burnRatio > fixedBurnWarningRatio ? "High Fixed Cost" : "Controlled Burn",
    });
  }

  // 6. Outstanding Client Invoices
  if (kpis.outstandingPayments > 0) {
    insights.push({
      id: "outstanding_receivables",
      type: "warning",
      category: "income",
      title: "Outstanding Client Receivables",
      description: `Outstanding client payments represent ${formatCurrency(kpis.outstandingPayments)} awaiting settlement.`,
      metric: formatCurrency(kpis.outstandingPayments),
      badge: "Action Required",
    });
  }

  // 7. Pending Worker Salary Requests
  if (kpis.pendingSalaryRequestsCount > 0) {
    insights.push({
      id: "pending-salary-requests",
      type: "info",
      category: "salaries",
      title: "Pending Salary Requests",
      description: `${kpis.pendingSalaryRequestsCount} salary advance requests totaling ${formatCurrency(kpis.pendingSalaryRequestsTotal)} awaiting executive review.`,
      metric: `${kpis.pendingSalaryRequestsCount} Pending`,
      badge: "Action Required",
    });
  }

  // 7. Monthly Closing Status
  if (closingPeriods && closingPeriods.length > 0) {
    const currentClosing = closingPeriods[0];
    if (currentClosing.status === "closed") {
      insights.push({
        id: "period_closed_insight",
        type: "positive",
        category: "cash_flow",
        title: `Period ${currentClosing.periodMonth} Officially Closed`,
        description: `This financial period has been reconciled and officially closed. Historical records are protected from unauthorized mutations.`,
        badge: "Closed Period",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "insufficient_data",
      type: "info",
      category: "cash_flow",
      title: "Data Baseline Initialization",
      description: "Not enough data to generate this insight. Record transactions to unlock AI-driven financial insights.",
    });
  }

  return insights;
}

export const generateSmartInsights = generateDeterministicInsights;

// ============================================================
// CANONICAL TRANSACTION CREATION & MANAGEMENT
// ============================================================

export function isValidFinancialAmount(val: any, allowZero = false): boolean {
  if (val === null || val === undefined || val === "" || typeof val === "boolean") return false;
  const num = Number(val);
  if (Number.isNaN(num) || !Number.isFinite(num)) return false;
  return allowZero ? num >= 0 : num > 0;
}

export async function createIncome(params: {
  amount: number;
  date: string;
  category: string;
  allocation?: FinancialAllocation;
  description: string;
  paymentMethod?: string;
  clientId?: string | null;
  projectId?: string | null;
  invoiceId?: string | null;
  accountId?: string | null;
  status?: "received" | "pending" | "cancelled";
  reference?: string;
  receiptUrl?: string | null;
  notes?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
  client?: any;
}): Promise<{ success: boolean; data?: any; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "finance", "finance.create_income", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "finance_transaction",
      resourceAction: "write",
    });

    if (!isValidFinancialAmount(params.amount, false)) {
      return { success: false, error: new Error("Income amount must be greater than 0.") };
    }

    const authoritativeUserId = authCtx.userId || null;

    const payload = {
      amount: params.amount,
      currency: "TND",
      date: params.date,
      category: params.category,
      allocation: params.allocation || "client_service",
      description: params.description.trim(),
      payment_method: params.paymentMethod || "Bank Transfer",
      client_id: params.clientId || null,
      project_id: params.projectId || null,
      invoice_id: params.invoiceId || null,
      account_id: params.accountId || null,
      status: params.status || "received",
      reference: params.reference?.trim() || null,
      receipt_url: params.receiptUrl || null,
      notes: params.notes?.trim() || null,
      created_by: authoritativeUserId,
    };

    const { data, error } = await (activeClient as any)
      .from("income_transactions")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // If linked to an account and received, update account current_balance
    if (params.accountId && params.status === "received") {
      const { data: acc } = await (activeClient as any)
        .from("financial_accounts")
        .select("current_balance")
        .eq("id", params.accountId)
        .single();

      if (acc) {
        await (activeClient as any)
          .from("financial_accounts")
          .update({
            current_balance: Number(acc.current_balance || 0) + Number(params.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.accountId);
      }
    }

    await logFinancialAction({
      action: "create_income",
      entityType: "income_transactions",
      entityId: data.id,
      actorId: authoritativeUserId || undefined,
      actorName: params.actorName,
      details: { amount: params.amount, category: params.category, allocation: params.allocation },
      clientOverride: activeClient,
    });

    return { success: true, data, error: null };
  } catch (err: any) {
    console.error("[createIncome] Error:", err);
    return { success: false, error: err };
  }
}

export async function createExpense(params: {
  amount: number;
  date: string;
  categoryName: string;
  categoryId?: string | null;
  allocation?: FinancialAllocation;
  subcategory?: string;
  vendor?: string;
  description: string;
  paymentMethod?: string;
  status?: "paid" | "pending" | "cancelled";
  isRecurring?: boolean;
  subscriptionId?: string | null;
  salaryPaymentId?: string | null;
  teamMemberId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  sponsoringCampaignId?: string | null;
  commissionId?: string | null;
  accountId?: string | null;
  reference?: string;
  receiptUrl?: string | null;
  notes?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
  client?: any;
}): Promise<{ success: boolean; data?: any; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "finance", "finance.create_expense", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "finance_transaction",
      resourceAction: "write",
    });

    if (!isValidFinancialAmount(params.amount, false)) {
      return { success: false, error: new Error("Expense amount must be greater than 0.") };
    }

    const authoritativeUserId = authCtx.userId || null;

    const payload = {
      amount: params.amount,
      currency: "TND",
      date: params.date,
      category_id: params.categoryId || null,
      category_name: params.categoryName,
      allocation: params.allocation || "operating_expense",
      subcategory: params.subcategory?.trim() || null,
      vendor: params.vendor?.trim() || null,
      description: params.description.trim(),
      payment_method: params.paymentMethod || "Bank Transfer",
      status: params.status || "paid",
      is_recurring: Boolean(params.isRecurring),
      subscription_id: params.subscriptionId || null,
      salary_payment_id: params.salaryPaymentId || null,
      team_member_id: params.teamMemberId || null,
      client_id: params.clientId || null,
      project_id: params.projectId || null,
      sponsoring_campaign_id: params.sponsoringCampaignId || null,
      commission_id: params.commissionId || null,
      account_id: params.accountId || null,
      reference: params.reference?.trim() || null,
      receipt_url: params.receiptUrl || null,
      notes: params.notes?.trim() || null,
      created_by: authoritativeUserId,
    };

    const { data, error } = await (activeClient as any)
      .from("expense_transactions")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // If linked to an account and paid, deduct from account current_balance
    if (params.accountId && params.status === "paid") {
      const { data: acc } = await (activeClient as any)
        .from("financial_accounts")
        .select("current_balance")
        .eq("id", params.accountId)
        .single();

      if (acc) {
        await (activeClient as any)
          .from("financial_accounts")
          .update({
            current_balance: Number(acc.current_balance || 0) - Number(params.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("id", params.accountId);
      }
    }

    await logFinancialAction({
      action: "create_expense",
      entityType: "expense_transactions",
      entityId: data.id,
      actorId: authoritativeUserId || undefined,
      actorName: params.actorName,
      details: { amount: params.amount, category: params.categoryName, allocation: params.allocation },
      clientOverride: activeClient,
    });

    return { success: true, data, error: null };
  } catch (err: any) {
    console.error("[createExpense] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Authoritative Treasury Account Transfer Engine.
 * Requirements:
 * - Debits source account and credits destination account.
 * - Preserves total company cash balance exactly: (-amount + amount = 0).
 * - Creates paired canonical ledger records with transaction_type='TRANSFER' and allocation='transfer'.
 * - Strictly excluded from revenue, expenses, and net profit.
 * - Enforces positive amount, distinct accounts, active accounts, and sufficient liquidity.
 * - Logs non-repudiation audit trails.
 */
export async function transferBetweenAccounts(params: {
  sourceAccountId: string;
  destinationAccountId: string;
  amount: number;
  date?: string;
  reference?: string;
  notes?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
}): Promise<{ success: boolean; data?: { sourceTxId: string; destTxId: string }; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "finance", "finance.account_transfer", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "finance_account",
      resourceAction: "write",
    });

    if (params.sourceAccountId === params.destinationAccountId) {
      return { success: false, error: new Error("Source and destination accounts must be distinct.") };
    }

    if (!isValidFinancialAmount(params.amount, false)) {
      return { success: false, error: new Error("Transfer amount must be greater than 0.") };
    }

    const { data: accounts, error: accErr } = await (activeClient as any)
      .from("financial_accounts")
      .select("*")
      .in("id", [params.sourceAccountId, params.destinationAccountId]);

    if (accErr || !accounts || accounts.length < 2) {
      return { success: false, error: new Error("One or both financial accounts could not be found.") };
    }

    const sourceAcc = accounts.find((a: any) => a.id === params.sourceAccountId);
    const destAcc = accounts.find((a: any) => a.id === params.destinationAccountId);

    if (!sourceAcc || !destAcc) {
      return { success: false, error: new Error("Source or destination account invalid.") };
    }

    if (sourceAcc.status !== "active" || destAcc.status !== "active") {
      return { success: false, error: new Error("Both accounts must be active to perform a transfer.") };
    }

    const sourceBal = Number(sourceAcc.current_balance || 0);
    if (sourceBal < params.amount) {
      return {
        success: false,
        error: new Error(
          `Insufficient funds in account '${sourceAcc.name}'. Current balance: ${sourceBal} ${sourceAcc.currency}, requested: ${params.amount}`
        ),
      };
    }

    const transferDate = params.date || format(new Date(), "yyyy-MM-dd");
    const authoritativeUserId = authCtx.userId || params.actorId || null;

    // 1. Debit source account
    const newSourceBal = sourceBal - Number(params.amount);
    const { error: debitErr } = await (activeClient as any)
      .from("financial_accounts")
      .update({
        current_balance: newSourceBal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceAcc.id);

    if (debitErr) throw debitErr;

    // 2. Credit destination account
    const destBal = Number(destAcc.current_balance || 0);
    const newDestBal = destBal + Number(params.amount);
    const { error: creditErr } = await (activeClient as any)
      .from("financial_accounts")
      .update({
        current_balance: newDestBal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", destAcc.id);

    if (creditErr) throw creditErr;

    // 3. Create mirror outflow in expense_transactions with transaction_type='TRANSFER' and allocation='transfer'
    const { data: expTx, error: expErr } = await (activeClient as any)
      .from("expense_transactions")
      .insert({
        amount: params.amount,
        currency: sourceAcc.currency || "TND",
        date: transferDate,
        category_name: "Treasury Transfer",
        allocation: "transfer",
        transaction_type: "TRANSFER",
        account_id: sourceAcc.id,
        description: `Transfer to ${destAcc.name}${params.notes ? ` - ${params.notes}` : ""}`,
        payment_method: "Bank Transfer",
        status: "paid",
        reference: params.reference || null,
        created_by: authoritativeUserId,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    // 4. Create mirror inflow in income_transactions with transaction_type='TRANSFER' and allocation='transfer'
    const { data: incTx, error: incErr } = await (activeClient as any)
      .from("income_transactions")
      .insert({
        amount: params.amount,
        currency: destAcc.currency || "TND",
        date: transferDate,
        category: "Other",
        allocation: "transfer",
        transaction_type: "TRANSFER",
        account_id: destAcc.id,
        description: `Transfer from ${sourceAcc.name}${params.notes ? ` - ${params.notes}` : ""}`,
        payment_method: "Bank Transfer",
        status: "received",
        reference: params.reference || null,
        created_by: authoritativeUserId,
      })
      .select()
      .single();

    if (incErr) throw incErr;

    // 5. Audit Logging
    await logFinancialAction({
      action: "transfer_between_accounts",
      entityType: "financial_accounts",
      entityId: sourceAcc.id,
      actorId: authoritativeUserId || undefined,
      actorName: params.actorName,
      details: {
        sourceAccountId: sourceAcc.id,
        sourceAccountName: sourceAcc.name,
        destinationAccountId: destAcc.id,
        destinationAccountName: destAcc.name,
        amount: params.amount,
        sourceTxId: expTx.id,
        destTxId: incTx.id,
      },
      clientOverride: activeClient,
    });

    await logSystemAudit({
      action: "ACCOUNT_TRANSFER",
      entityType: "financial_account",
      entityId: sourceAcc.id,
      actorId: authoritativeUserId || undefined,
      actorName: params.actorName,
      newValues: {
        sourceAccountId: sourceAcc.id,
        destinationAccountId: destAcc.id,
        amount: params.amount,
        newSourceBalance: newSourceBal,
        newDestinationBalance: newDestBal,
      },
    });

    return {
      success: true,
      data: { sourceTxId: expTx.id, destTxId: incTx.id },
      error: null,
    };
  } catch (err: any) {
    console.error("[transferBetweenAccounts] Error:", err);
    return { success: false, error: err };
  }
}

export async function deleteTransaction(params: {
  id: string;
  type: "income" | "expense";
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ctx?: PermissionContext;
  clientOverride?: any;
  client?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || params.client || supabase;
    const authCtx = await assertAuthorizedMutation(activeClient, "finance", "finance.delete_transaction", {
      ctx: params.ctx,
      actorRole: params.actorRole,
      actorId: params.actorId,
      resourceType: "finance_transaction",
      resource: { id: params.id },
      resourceAction: "delete",
    });

    const table = params.type === "income" ? "income_transactions" : "expense_transactions";
    const { error } = await (activeClient as any).from(table).delete().eq("id", params.id);
    if (error) throw error;

    await logFinancialAction({
      action: `delete_${params.type}`,
      entityType: table,
      entityId: params.id,
      actorId: authCtx.userId || params.actorId,
      actorName: params.actorName,
      clientOverride: activeClient,
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

// Backward compatibility alias for tests
export const deleteIncome = (id: string, actor?: any, ctx?: PermissionContext) =>
  deleteTransaction({ id, type: "income", actorId: actor?.id, actorName: actor?.name, actorRole: actor?.role, ctx });
export const deleteExpense = (id: string, actor?: any, ctx?: PermissionContext) =>
  deleteTransaction({ id, type: "expense", actorId: actor?.id, actorName: actor?.name, actorRole: actor?.role, ctx });

export async function updateIncome(
  id: string,
  params: Partial<IncomeTransaction>,
  actor?: { id?: string; name?: string; role?: string; ctx?: PermissionContext }
): Promise<{ success: boolean; error: Error | null }> {
  try {
    await assertAuthorizedMutation(supabase, "finance", "finance.edit_transaction", {
      actorId: actor?.id,
      actorRole: actor?.role,
      ctx: actor?.ctx,
      resourceType: "finance_transaction",
      resource: { id },
      resourceAction: "write",
    });

    const { error } = await (supabase as any)
      .from("income_transactions")
      .update({
        ...params,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    await logFinancialAction({
      action: "update_income",
      entityType: "income_transactions",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      details: params,
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function updateExpense(
  id: string,
  params: Partial<ExpenseTransaction>,
  actor?: { id?: string; name?: string; role?: string; ctx?: PermissionContext }
): Promise<{ success: boolean; error: Error | null }> {
  try {
    await assertAuthorizedMutation(supabase, "finance", "finance.edit_transaction", {
      actorId: actor?.id,
      actorRole: actor?.role,
      ctx: actor?.ctx,
      resourceType: "finance_transaction",
      resource: { id },
      resourceAction: "write",
    });

    const { error } = await (supabase as any)
      .from("expense_transactions")
      .update({
        ...params,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw error;

    await logFinancialAction({
      action: "update_expense",
      entityType: "expense_transactions",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
      details: params,
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function upsertSalaryRecord(params: {
  id?: string;
  teamMemberId: string;
  baseAmount: number;
  salaryType?: string;
  paymentFrequency?: string;
  paymentMethod?: string;
  bankDetails?: string;
  standardMonthlyHours?: number;
  effectiveDate?: string;
  nextPaymentDate?: string | null;
  status?: string;
  notes?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ctx?: PermissionContext;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    await assertAuthorizedMutation(supabase, "compensation", "compensation.manage_salaries", {
      actorId: params.actorId,
      actorRole: params.actorRole,
      ctx: params.ctx,
      resourceType: "salary_record",
      resource: { team_member_id: params.teamMemberId },
      resourceAction: "write",
    });

    if (!isValidFinancialAmount(params.baseAmount, true)) {
      return { success: false, error: new Error("Base salary amount cannot be negative.") };
    }

    const payload: Record<string, any> = {
      team_member_id: params.teamMemberId,
      base_amount: params.baseAmount,
      currency: "TND",
      salary_type: params.salaryType || "monthly",
      payment_frequency: params.paymentFrequency || "monthly",
      payment_method: params.paymentMethod || "Bank Transfer",
      bank_details: params.bankDetails?.trim() || null,
      effective_date: params.effectiveDate || format(new Date(), "yyyy-MM-dd"),
      next_payment_date: params.nextPaymentDate || null,
      status: params.status || "active",
      notes: params.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (params.standardMonthlyHours != null && params.standardMonthlyHours > 0) {
      payload.standard_monthly_hours = params.standardMonthlyHours;
    }
    if (params.id) {
      payload.id = params.id;
    }

    const { error } = await (supabase as any)
      .from("salary_records")
      .upsert(payload, { onConflict: "team_member_id" });

    if (error) throw error;

    await logFinancialAction({
      action: "upsert_salary_record",
      entityType: "salary_records",
      actorId: params.actorId,
      actorName: params.actorName,
      details: { teamMemberId: params.teamMemberId, baseAmount: params.baseAmount },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function createDirectSalaryPayment(params: {
  teamMemberId: string;
  salaryRecordId?: string;
  amount: number;
  paymentDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  paymentType?: string;
  paymentMethod?: string;
  reference?: string;
  receiptUrl?: string | null;
  notes?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ctx?: PermissionContext;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    await assertAuthorizedMutation(supabase, "compensation", "compensation.manage_salaries", {
      actorId: params.actorId,
      actorRole: params.actorRole,
      ctx: params.ctx,
      resourceType: "salary_payment",
      resource: { team_member_id: params.teamMemberId },
      resourceAction: "write",
    });

    const { data: payment, error: payErr } = await (supabase as any)
      .from("salary_payments")
      .insert({
        team_member_id: params.teamMemberId,
        salary_record_id: params.salaryRecordId || null,
        amount: params.amount,
        currency: "TND",
        payment_date: params.paymentDate,
        period_start: params.periodStart || null,
        period_end: params.periodEnd || null,
        payment_type: params.paymentType || "regular",
        payment_method: params.paymentMethod || "Bank Transfer",
        reference: params.reference?.trim() || null,
        receipt_url: params.receiptUrl?.trim() || null,
        status: "paid",
        notes: params.notes?.trim() || null,
        created_by: params.actorId || null,
      })
      .select()
      .single();

    if (payErr) throw payErr;

    // Mirror into expense_transactions
    await createExpense({
      amount: params.amount,
      date: params.paymentDate,
      categoryName: "People & Salaries",
      allocation: "payroll",
      subcategory: "Direct Salary Payment",
      description: `Salary Payment (${params.paymentType || "regular"})`,
      paymentMethod: params.paymentMethod || "Bank Transfer",
      status: "paid",
      teamMemberId: params.teamMemberId,
      salaryPaymentId: payment.id,
      notes: params.notes,
      actorId: params.actorId,
      actorName: params.actorName,
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function fetchWorkerSalaryData(
  userId: string,
  userEmail?: string | null,
  ctx?: PermissionContext
): Promise<{
  teamMemberId: string | null;
  salaryRecord: SalaryRecord | null;
  payments: SalaryPayment[];
  requests: SalaryRequest[];
  commissions: any[];
  workSessions: any[];
  totalProductionMinutes: number;
  totalAdminMinutes: number;
}> {
  await assertAuthorizedMutation(supabase, "compensation", "compensation.view", {
    ctx,
    actorId: ctx?.userId || userId,
    resourceType: "salary_record",
    resource: { user_id: userId, profile_id: userId },
    resourceAction: "read",
  });
  // 0. Canonical Security Definer RPC: resolves and synchronizes user_id and profile_id
  let member: any = null;
  const { data: rpcRows, error: rpcErr } = await (supabase as any).rpc(
    "resolve_and_link_current_team_member",
    {
      _user_id: userId,
      _email: userEmail ? userEmail.trim() : null,
    }
  );
  if (!rpcErr && rpcRows && rpcRows.length > 0) {
    member = rpcRows[0];
  }

  // 1. Fallback: resolve member id canonically by profile_id or user_id
  if (!member?.id) {
    const { data: directMember } = await (supabase as any)
      .from("team_members")
      .select("id, profile_id, user_id, email")
      .or(`profile_id.eq.${userId},user_id.eq.${userId}`)
      .eq("is_active", true)
      .maybeSingle();
    if (directMember?.id) member = directMember;
  }

  // 2. Self-healing fallback: match by email if user_id was not yet set on team_members
  if (!member?.id && userEmail) {
    const { data: memberByEmail } = await (supabase as any)
      .from("team_members")
      .select("id, profile_id, user_id, email")
      .ilike("email", userEmail.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (memberByEmail?.id) {
      member = memberByEmail;
    }
  }

  // 3. Security Definer RPC fallback
  if (!member?.id) {
    const { data: rpcTmId } = await (supabase as any).rpc("get_team_member_id", {
      _user_id: userId,
    });
    if (rpcTmId) {
      const { data: memberByRpc } = await (supabase as any)
        .from("team_members")
        .select("id, profile_id, user_id, email")
        .eq("id", rpcTmId)
        .maybeSingle();
      if (memberByRpc?.id) {
        member = memberByRpc;
      }
    }
  }

  if (!member?.id) {
    return {
      teamMemberId: null,
      salaryRecord: null,
      payments: [],
      requests: [],
      commissions: [],
      workSessions: [],
      totalProductionMinutes: 0,
      totalAdminMinutes: 0,
    };
  }

  const [recRes, payRes, reqRes, commRes, sessRes] = await Promise.all([
    (supabase as any)
      .from("salary_records")
      .select("*, team_member:team_members(id, name, email, position, role, division, photo_url)")
      .eq("team_member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (supabase as any)
      .from("salary_payments")
      .select("*, team_member:team_members(id, name, email, position, division, photo_url)")
      .eq("team_member_id", member.id)
      .order("payment_date", { ascending: false }),
    (supabase as any)
      .from("salary_requests")
      .select("*, team_member:team_members(id, name, email, position, role, division, photo_url)")
      .eq("team_member_id", member.id)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("sales_commissions")
      .select("*, client:clients(id, name)")
      .eq("team_member_id", member.id)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("work_sessions")
      .select("*, client:clients(id, name), task:project_tasks(id, title)")
      .eq("team_member_id", member.id)
      .order("started_at", { ascending: false }),
  ]);

  let resolvedSalaryRecord = recRes.data || null;
  if (!resolvedSalaryRecord) {
    const { data: directRec } = await (supabase as any)
      .from("salary_records")
      .select("*")
      .eq("team_member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (directRec) {
      resolvedSalaryRecord = directRec;
    }
  }

  const workSessions = sessRes.data || [];
  const totalProductionMinutes = workSessions
    .filter((s: any) => s.session_type === "production")
    .reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0), 0);

  const totalAdminMinutes = workSessions
    .filter((s: any) => s.session_type === "administrative")
    .reduce((sum: number, s: any) => sum + Number(s.duration_minutes || 0), 0);

  return {
    teamMemberId: member.id,
    salaryRecord: resolvedSalaryRecord,
    payments: payRes.data || [],
    requests: reqRes.data || [],
    commissions: commRes.data || [],
    workSessions,
    totalProductionMinutes,
    totalAdminMinutes,
  };
}

export interface SubmitSalaryRequestResult {
  success: boolean;
  data?: any;
  error: Error | null;
  errorCode?:
    | "PROFILE_NOT_FOUND"
    | "COMPENSATION_PROFILE_NOT_FOUND"
    | "BASE_SALARY_NOT_CONFIGURED"
    | "UNAUTHORIZED_PROFILE_ACCESS"
    | "INVALID_COMPENSATION_DATA"
    | "ADVANCE_LIMIT_CALCULATION_FAILED"
    | "EXCEEDS_MAX_ADVANCE"
    | "PENDING_REQUEST_EXISTS"
    | "INVALID_INPUT";
}

export async function submitWorkerSalaryRequest(params: {
  teamMemberId: string;
  requestedAmount: number;
  reason: string;
  notes?: string;
  requestedDate?: string;
  workerName?: string;
}): Promise<SubmitSalaryRequestResult> {
  try {
    if (!params.teamMemberId) {
      const err = new Error("Your account is not correctly linked to a team profile. Please contact an administrator.");
      (err as any).code = "PROFILE_NOT_FOUND";
      throw err;
    }

    if (isNaN(params.requestedAmount) || params.requestedAmount <= 0) {
      const err = new Error("Please enter a valid requested amount greater than 0 TND.");
      (err as any).code = "INVALID_INPUT";
      throw err;
    }

    if (!params.reason?.trim()) {
      const err = new Error("Please provide a reason for the early payment request.");
      (err as any).code = "INVALID_INPUT";
      throw err;
    }

    const maxAdvancePercent = getBusinessRuleNumber("max_salary_advance_percent", 50);

    // 1. Verify worker exists and is active
    const { data: memberRec } = await (supabase as any)
      .from("team_members")
      .select("id, is_active")
      .eq("id", params.teamMemberId)
      .maybeSingle();

    if (!memberRec || !memberRec.is_active) {
      const err = new Error("Your team member profile is not currently active. Please contact an administrator.");
      (err as any).code = "UNAUTHORIZED_PROFILE_ACCESS";
      throw err;
    }

    // 2. Fetch team member's active monthly base salary
    const { data: salaryRec } = await (supabase as any)
      .from("salary_records")
      .select("base_amount, status")
      .eq("team_member_id", params.teamMemberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!salaryRec) {
      const err = new Error("Your salary profile has not been configured yet. Please contact an administrator.");
      (err as any).code = "COMPENSATION_PROFILE_NOT_FOUND";
      throw err;
    }

    if (salaryRec.status !== "active") {
      const err = new Error("Your compensation profile is not active. Please contact an administrator.");
      (err as any).code = "INVALID_COMPENSATION_DATA";
      throw err;
    }

    const baseSalary = Number(salaryRec.base_amount || 0);
    if (baseSalary <= 0) {
      const err = new Error("Your base monthly salary is not configured yet. Please contact an administrator.");
      (err as any).code = "BASE_SALARY_NOT_CONFIGURED";
      throw err;
    }

    const allowedAdvance = (baseSalary * maxAdvancePercent) / 100;
    if (allowedAdvance <= 0) {
      const err = new Error("Unable to calculate your eligible advance limit. Please contact an administrator.");
      (err as any).code = "ADVANCE_LIMIT_CALCULATION_FAILED";
      throw err;
    }

    if (params.requestedAmount > allowedAdvance) {
      const err = new Error(
        `Requested advance (${params.requestedAmount} TND) exceeds the maximum allowed limit of ${maxAdvancePercent}% of base monthly salary (${allowedAdvance} TND).`
      );
      (err as any).code = "EXCEEDS_MAX_ADVANCE";
      throw err;
    }

    // 3. Prevent duplicate active pending requests
    const { data: existingPending } = await (supabase as any)
      .from("salary_requests")
      .select("id, requested_amount, created_at")
      .eq("team_member_id", params.teamMemberId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      const err = new Error(
        `You already have an active pending advance request of ${existingPending.requested_amount} TND. Please wait for management review before submitting another request.`
      );
      (err as any).code = "PENDING_REQUEST_EXISTS";
      throw err;
    }

    const payload = {
      team_member_id: params.teamMemberId,
      requested_amount: params.requestedAmount,
      currency: "TND",
      requested_date: params.requestedDate || format(new Date(), "yyyy-MM-dd"),
      reason: params.reason.trim(),
      notes: params.notes?.trim() || null,
      status: "pending",
    };

    const { data, error } = await (supabase as any)
      .from("salary_requests")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await emitNotification({
      eventType: "SALARY_REQUEST_PENDING",
      title: `Salary Advance Request: ${params.requestedAmount} TND`,
      message: `${params.workerName || "Team Member"} requested an advance of ${params.requestedAmount} TND. Reason: ${params.reason}`,
      category: "finance",
      roleTarget: "super_admin",
      linkUrl: `/admin/finance`,
      entityType: "salary_request",
      entityId: data.id,
    });

    await logSystemAudit({
      action: "SALARY_CHANGE",
      entityType: "salary_request",
      entityId: data.id,
      newValues: { requested_amount: params.requestedAmount, reason: params.reason },
    });

    return { success: true, data, error: null };
  } catch (err: any) {
    return { success: false, data: null, error: err, errorCode: err.code || undefined };
  }
}

// ============================================================
// SPONSORING ENGINE OPERATIONS (Section 8)
// ============================================================

export async function createSponsoringCampaign(params: {
  clientId: string;
  projectId?: string | null;
  invoiceId?: string | null;
  campaignName: string;
  platform?: SponsoringPlatform;
  budgetTnd: number;
  usdAmount: number;
  purchaseRate: number;
  clientRate?: number;
  paymentStatus?: "pending" | "paid" | "partially_paid";
  date?: string;
  notes?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; data?: any; error: Error | null }> {
  try {
    if (!isValidFinancialAmount(params.budgetTnd, false) || !isValidFinancialAmount(params.usdAmount, false)) {
      return { success: false, error: new Error("Sponsoring budget and USD amount must be greater than 0.") };
    }

    const purchaseRate = params.purchaseRate || getBusinessRuleNumber("sponsoring_purchase_rate", 3.37);
    const purchaseCostTnd = Number((params.usdAmount * purchaseRate).toFixed(3));
    const clientRate = params.clientRate || getBusinessRuleNumber("sponsoring_client_rate", 4.00);
    const clientChargeTnd = params.budgetTnd;
    const marginTnd = Number((clientChargeTnd - purchaseCostTnd).toFixed(3));
    const campaignDate = params.date || format(new Date(), "yyyy-MM-dd");

    const payload = {
      client_id: params.clientId,
      project_id: params.projectId || null,
      invoice_id: params.invoiceId || null,
      campaign_name: params.campaignName.trim(),
      platform: params.platform || "Meta Ads",
      budget_tnd: params.budgetTnd,
      usd_amount: params.usdAmount,
      purchase_rate: purchaseRate,
      purchase_cost_tnd: purchaseCostTnd,
      client_rate: clientRate,
      client_charge_tnd: clientChargeTnd,
      margin_tnd: marginTnd,
      payment_status: params.paymentStatus || "pending",
      execution_status: "active",
      date: campaignDate,
      period_month: format(parseISO(campaignDate), "yyyy-MM"),
      notes: params.notes?.trim() || null,
      created_by: params.actorId || null,
    };

    const { data, error } = await (supabase as any)
      .from("sponsoring_campaigns")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await logFinancialAction({
      action: "create_sponsoring_campaign",
      entityType: "sponsoring_campaigns",
      entityId: data.id,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { campaign: params.campaignName, budget: params.budgetTnd, margin: marginTnd },
    });

    return { success: true, data, error: null };
  } catch (err: any) {
    console.error("[createSponsoringCampaign] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Execute USD ad purchase for campaign: creates authoritative expense_transactions record
 */
export async function executeSponsoringPurchase(params: {
  campaign: SponsoringCampaign;
  paymentMethod?: string;
  accountId?: string | null;
  actorId?: string;
  actorName?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;

    // Idempotency check 1: Campaign already completed
    if (params.campaign.executionStatus === "completed") {
      return { success: true, error: null };
    }

    // Idempotency check 2: Outflow expense already exists for this campaign
    const { data: existingExp } = await (activeClient as any)
      .from("expense_transactions")
      .select("id")
      .eq("sponsoring_campaign_id", params.campaign.id)
      .limit(1);

    if (existingExp && existingExp.length > 0) {
      await (activeClient as any)
        .from("sponsoring_campaigns")
        .update({
          execution_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.campaign.id);
      return { success: true, error: null };
    }

    const res = await createExpense({
      amount: params.campaign.purchaseCostTnd,
      date: format(new Date(), "yyyy-MM-dd"),
      categoryName: "Marketing & Advertising",
      allocation: "sponsoring_purchase",
      subcategory: `Ad Spend (${params.campaign.platform})`,
      vendor: `${params.campaign.platform} Ad Billing`,
      description: `Sponsoring Purchase: ${params.campaign.campaignName} ($${params.campaign.usdAmount} @ ${params.campaign.purchaseRate})`,
      paymentMethod: params.paymentMethod || "Credit Card",
      status: "paid",
      clientId: params.campaign.clientId,
      projectId: params.campaign.projectId,
      sponsoringCampaignId: params.campaign.id,
      accountId: params.accountId,
      notes: `Executed USD purchase of $${params.campaign.usdAmount} for client ${params.campaign.clientName}`,
      actorId: params.actorId,
      actorName: params.actorName,
      clientOverride: activeClient,
    });

    if (!res.success) throw res.error;

    await (activeClient as any)
      .from("sponsoring_campaigns")
      .update({
        execution_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.campaign.id);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

// ============================================================
// INVOICES & PAYMENTS OPERATIONS (Section 6)
// ============================================================

export async function createInvoice(params: {
  invoiceNumber?: string;
  clientId: string;
  projectId?: string | null;
  issueDate?: string;
  dueDate?: string;
  serviceRevenue?: number;
  serviceFee?: number;
  sponsoringBudget?: number;
  otherRevenue?: number;
  taxAmount?: number;
  currency?: "TND" | "USD" | "EUR";
  items?: any[];
  notes?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; data?: any; error: Error | null }> {
  try {
    if (!params.clientId) {
      return { success: false, error: new Error("Client is required to generate an invoice.") };
    }

    const invNum =
      params.invoiceNumber?.trim() ||
      `INV-${format(new Date(), "yyyyMMdd")}-${Math.floor(1000 + Math.random() * 9000)}`;
    const serviceRev = Number(params.serviceRevenue ?? params.serviceFee ?? 0);
    const sponsoringBud = Number(params.sponsoringBudget || 0);
    const otherRev = Number(params.otherRevenue || 0);
    const subtotal = serviceRev + sponsoringBud + otherRev;
    const tax = Number(params.taxAmount || 0);
    const total = subtotal + tax;

    if (!isValidFinancialAmount(total, false) || !isValidFinancialAmount(subtotal, true)) {
      return { success: false, error: new Error("Invoice total must be greater than 0 and subtotal must be non-negative.") };
    }

    const payload = {
      invoice_number: invNum,
      client_id: params.clientId,
      project_id: params.projectId || null,
      issue_date: params.issueDate || format(new Date(), "yyyy-MM-dd"),
      due_date: params.dueDate || format(new Date(), "yyyy-MM-dd"),
      service_revenue: serviceRev,
      sponsoring_budget: sponsoringBud,
      other_revenue: otherRev,
      subtotal,
      tax_amount: tax,
      total_amount: total,
      currency: params.currency || "TND",
      status: "sent",
      paid_amount: 0,
      items: params.items || [],
      notes: params.notes?.trim() || null,
      created_by: params.actorId || null,
    };

    const { data, error } = await (supabase as any)
      .from("invoices")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await logFinancialAction({
      action: "create_invoice",
      entityType: "invoices",
      entityId: data.id,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { invoiceNumber: params.invoiceNumber, totalAmount: total },
    });

    return { success: true, data, error: null };
  } catch (err: any) {
    console.error("[createInvoice] Error:", err);
    return { success: false, error: err };
  }
}

/**
 * Record payment for invoice: sets invoice paid and creates authoritative income transactions
 */
export async function recordInvoicePayment(params: {
  invoice: Invoice;
  paymentMethod?: string;
  accountId?: string | null;
  paymentDate?: string;
  actorId?: string;
  actorName?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const payDate = params.paymentDate || format(new Date(), "yyyy-MM-dd");

    // Idempotency check: If invoice is already paid and has 0 remaining balance
    if (params.invoice.status === "paid" && (params.invoice.totalAmount - (params.invoice.paidAmount || 0)) <= 0.001) {
      return { success: true, error: null };
    }

    const serviceRev = Number(params.invoice.serviceRevenue || 0);
    const sponsoringBud = Number(params.invoice.sponsoringBudget || 0);
    const otherRev = Number(params.invoice.otherRevenue || 0);
    const totalAmt = Number(params.invoice.totalAmount || 0);

    // 1. If invoice has service revenue, create income transaction
    if (serviceRev > 0) {
      const incRes = await createIncome({
        amount: serviceRev,
        date: payDate,
        category: "Client Payment",
        allocation: "client_service",
        description: `Service Revenue: Invoice ${params.invoice.invoiceNumber} (${params.invoice.clientName})`,
        paymentMethod: params.paymentMethod,
        clientId: params.invoice.clientId,
        projectId: params.invoice.projectId,
        invoiceId: params.invoice.id,
        accountId: params.accountId,
        status: "received",
        actorId: params.actorId,
        actorName: params.actorName,
        clientOverride: activeClient,
      });
      if (!incRes.success) throw incRes.error;
    }

    // 2. If invoice has sponsoring budget, create sponsoring income transaction
    if (sponsoringBud > 0) {
      const incRes = await createIncome({
        amount: sponsoringBud,
        date: payDate,
        category: "Client Payment",
        allocation: "sponsoring_collected",
        description: `Sponsoring Budget: Invoice ${params.invoice.invoiceNumber} (${params.invoice.clientName})`,
        paymentMethod: params.paymentMethod,
        clientId: params.invoice.clientId,
        projectId: params.invoice.projectId,
        invoiceId: params.invoice.id,
        accountId: params.accountId,
        status: "received",
        actorId: params.actorId,
        actorName: params.actorName,
        clientOverride: activeClient,
      });
      if (!incRes.success) throw incRes.error;
    }

    // 3. If there is a residual amount (other revenue, tax, or difference), record it
    const residual = Math.max(0, totalAmt - serviceRev - sponsoringBud);
    if (residual > 0.001) {
      const incRes = await createIncome({
        amount: residual,
        date: payDate,
        category: "Client Payment",
        allocation: otherRev > 0 ? "other_revenue" : "other",
        description: `Other / Tax Settlement: Invoice ${params.invoice.invoiceNumber} (${params.invoice.clientName})`,
        paymentMethod: params.paymentMethod,
        clientId: params.invoice.clientId,
        projectId: params.invoice.projectId,
        invoiceId: params.invoice.id,
        accountId: params.accountId,
        status: "received",
        actorId: params.actorId,
        actorName: params.actorName,
        clientOverride: activeClient,
      });
      if (!incRes.success) throw incRes.error;
    }

    // 4. Mark invoice as paid
    const { error: invErr } = await (activeClient as any)
      .from("invoices")
      .update({
        status: "paid",
        paid_amount: totalAmt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.invoice.id);

    if (invErr) throw invErr;

    // 5. If a sales commission is linked to this invoice and is pending, approve it (invoice is now settled)
    await (activeClient as any)
      .from("sales_commissions")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("invoice_id", params.invoice.id)
      .eq("status", "pending");

    await logFinancialAction({
      action: "pay_invoice",
      entityType: "invoices",
      entityId: params.invoice.id,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { invoiceNumber: params.invoice.invoiceNumber, amount: totalAmt },
      clientOverride: activeClient,
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[recordInvoicePayment] Error:", err);
    return { success: false, error: err };
  }
}

// ============================================================
// COMMISSIONS ENGINE OPERATIONS (Section 11)
// ============================================================

export async function createSalesCommission(params: {
  teamMemberId: string;
  clientId: string;
  invoiceId?: string | null;
  serviceRevenue: number;
  commissionRate: number;
  periodMonth?: string;
  notes?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; data?: any; error: Error | null }> {
  try {
    if (!isValidFinancialAmount(params.commissionRate, true) || Number(params.commissionRate) > 100) {
      return { success: false, error: new Error("Commission rate must be between 0% and 100%.") };
    }
    if (!isValidFinancialAmount(params.serviceRevenue, true)) {
      return { success: false, error: new Error("Service revenue cannot be negative.") };
    }

    const rate = Number(params.commissionRate ?? 15);
    const rev = Number(params.serviceRevenue ?? 0);

    // Duplicate commission prevention
    if (params.invoiceId) {
      const { data: existing } = await (supabase as any)
        .from("sales_commissions")
        .select("id")
        .eq("invoice_id", params.invoiceId)
        .eq("team_member_id", params.teamMemberId)
        .neq("status", "cancelled")
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: new Error("A commission record already exists for this invoice and salesperson."),
        };
      }
    }

    const amount = Number(((rev * rate) / 100).toFixed(3));
    const periodMonth = params.periodMonth || format(new Date(), "yyyy-MM");

    const payload = {
      team_member_id: params.teamMemberId,
      client_id: params.clientId,
      invoice_id: params.invoiceId || null,
      service_revenue: rev,
      commission_rate: rate,
      commission_amount: amount,
      period_month: periodMonth,
      status: "pending",
      notes: params.notes?.trim() || null,
    };

    const { data, error } = await (supabase as any)
      .from("sales_commissions")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await logFinancialAction({
      action: "create_commission",
      entityType: "sales_commissions",
      entityId: data.id,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { amount, rate, periodMonth },
    });

    return { success: true, data, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function payCommission(params: {
  commission: SalesCommission;
  actorId?: string;
  actorName?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;

    // 0. Idempotency Guard: Check if commission is already marked as paid
    if (params.commission.status === "paid") {
      return { success: true, error: null };
    }

    const { data: existingComm } = await (activeClient as any)
      .from("sales_commissions")
      .select("id, status, salary_payment_id")
      .eq("id", params.commission.id)
      .maybeSingle();

    if (existingComm && existingComm.status === "paid") {
      return { success: true, error: null };
    }

    // Check if an expense transaction already exists for this commission
    const { data: existingExp } = await (activeClient as any)
      .from("expense_transactions")
      .select("id, salary_payment_id")
      .eq("commission_id", params.commission.id)
      .maybeSingle();

    if (existingExp) {
      await (activeClient as any)
        .from("sales_commissions")
        .update({
          status: "paid",
          salary_payment_id: existingExp.salary_payment_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.commission.id);
      return { success: true, error: null };
    }

    // 1. Create canonical salary payment record
    const { data: salPay, error: salErr } = await (activeClient as any)
      .from("salary_payments")
      .insert({
        team_member_id: params.commission.teamMemberId,
        amount: params.commission.commissionAmount,
        currency: "TND",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_type: "bonus",
        payment_method: "Bank Transfer",
        status: "paid",
        notes: `Sales commission for client ${params.commission.clientName} (${params.commission.periodMonth})`,
        created_by: params.actorId || null,
      })
      .select()
      .single();

    if (salErr) throw salErr;

    // 2. Create authoritative expense transaction
    const expRes = await createExpense({
      amount: params.commission.commissionAmount,
      date: format(new Date(), "yyyy-MM-dd"),
      categoryName: "People & Salaries",
      allocation: "sales_commission",
      subcategory: "Sales Commission",
      description: `Commission Payout: ${params.commission.teamMemberName} (${params.commission.clientName})`,
      paymentMethod: "Bank Transfer",
      status: "paid",
      teamMemberId: params.commission.teamMemberId,
      clientId: params.commission.clientId,
      commissionId: params.commission.id,
      salaryPaymentId: salPay.id,
      actorId: params.actorId,
      actorName: params.actorName,
      clientOverride: activeClient,
    });

    if (!expRes.success) throw expRes.error;

    // 3. Mark commission as paid
    await (activeClient as any)
      .from("sales_commissions")
      .update({
        status: "paid",
        salary_payment_id: salPay.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.commission.id);

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

// ============================================================
// MONTHLY CLOSING WORKFLOW (Section 16)
// OPEN -> CLOSED, historical record protection
// ============================================================

export async function closeFinancialPeriod(params: {
  periodMonth: string;
  checklist: ClosingChecklist;
  summary: ClosingSummary;
  actorId?: string;
  actorName?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const payload = {
      period_month: params.periodMonth,
      status: "closed",
      checklist: params.checklist,
      closing_summary: params.summary,
      closed_at: new Date().toISOString(),
      closed_by: params.actorId || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (activeClient as any)
      .from("financial_closing_periods")
      .upsert(payload, { onConflict: "period_month" });

    if (error) throw error;

    await logFinancialAction({
      action: "close_financial_period",
      entityType: "financial_closing_periods",
      actorId: params.actorId,
      actorName: params.actorName,
      details: { periodMonth: params.periodMonth, summary: params.summary },
      clientOverride: activeClient,
    });

    await logSystemAudit({
      action: "FINANCIAL_CLOSING",
      entityType: "financial_closing_period",
      entityId: params.periodMonth,
      actorId: params.actorId,
      actorName: params.actorName,
      newValues: { periodMonth: params.periodMonth, status: "closed" },
    });

    await emitNotification({
      eventType: "MONTH_END_CLOSING",
      title: `Financial Period ${params.periodMonth} Closed`,
      message: `Accounting period ${params.periodMonth} successfully reconciled and closed.`,
      category: "finance",
      roleTarget: "super_admin",
      linkUrl: `/admin/finance`,
      entityType: "financial_closing_period",
      entityId: params.periodMonth,
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[closeFinancialPeriod] Error:", err);
    return { success: false, error: err };
  }
}

export async function reopenFinancialPeriod(params: {
  periodMonth: string;
  reason: string;
  actorId?: string;
  actorName?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;
    const payload = {
      status: "open",
      reopened_at: new Date().toISOString(),
      reopened_by: params.actorId || null,
      reopen_reason: params.reason.trim(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await (activeClient as any)
      .from("financial_closing_periods")
      .update(payload)
      .eq("period_month", params.periodMonth);

    if (error) throw error;

    await logFinancialAction({
      action: "reopen_financial_period",
      entityType: "financial_closing_periods",
      actorId: params.actorId,
      actorName: params.actorName,
      clientOverride: activeClient,
      details: { periodMonth: params.periodMonth, reason: params.reason },
    });

    await logSystemAudit({
      action: "FINANCIAL_REOPENING",
      entityType: "financial_closing_period",
      entityId: params.periodMonth,
      actorId: params.actorId,
      actorName: params.actorName,
      newValues: { periodMonth: params.periodMonth, reason: params.reason, status: "open" },
    });

    await emitNotification({
      eventType: "MONTH_END_CLOSING",
      title: `Financial Period ${params.periodMonth} Reopened`,
      message: `Period ${params.periodMonth} has been reopened. Reason: ${params.reason}`,
      category: "finance",
      roleTarget: "super_admin",
      priority: "high",
      linkUrl: `/admin/finance`,
      entityType: "financial_closing_period",
      entityId: params.periodMonth,
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

// ============================================================
// WORKER SALARY REQUEST APPROVAL WORKFLOW (Section 12)
// PENDING -> REVIEW -> APPROVED -> PAID (Request != Expense)
// ============================================================

export async function approveSalaryRequest(params: {
  requestId: string;
  teamMemberId?: string;
  approvedAmount?: number;
  reviewNotes?: string;
  paymentDate?: string;
  paymentMethod?: string;
  actorId?: string;
  actorName?: string;
  clientOverride?: any;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const activeClient = params.clientOverride || supabase;

    const { data: req, error: reqFetchErr } = await (activeClient as any)
      .from("salary_requests")
      .select("*, team_member:team_members(id, name, email)")
      .eq("id", params.requestId)
      .single();

    if (reqFetchErr || !req) throw reqFetchErr || new Error("Salary request not found");

    // Idempotency Guard: prevent double payout
    if (req.status === "approved" || req.status === "paid") {
      return { success: true, error: null };
    }
    if (req.status !== "pending") {
      throw new Error(`Cannot approve salary request with status '${req.status}'`);
    }

    // Check if salary payment already exists for this request
    const { data: existingPay } = await (activeClient as any)
      .from("salary_payments")
      .select("id")
      .eq("salary_request_id", req.id)
      .maybeSingle();

    if (existingPay) {
      await (activeClient as any)
        .from("salary_requests")
        .update({
          status: "approved",
          salary_payment_id: existingPay.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      return { success: true, error: null };
    }

    const payoutAmount = params.approvedAmount !== undefined ? params.approvedAmount : req.requested_amount;
    const targetMemberId = params.teamMemberId || req.team_member_id;
    const payDate = params.paymentDate || format(new Date(), "yyyy-MM-dd");
    const payMethod = params.paymentMethod || "Bank Transfer";

    // 1. Create canonical salary payment
    const { data: payment, error: payErr } = await (activeClient as any)
      .from("salary_payments")
      .insert({
        team_member_id: targetMemberId,
        salary_request_id: req.id,
        amount: payoutAmount,
        currency: req.currency || "TND",
        payment_date: payDate,
        payment_type: "advance",
        payment_method: payMethod,
        status: "paid",
        notes: `Approved advance: ${req.reason}`,
        created_by: params.actorId || null,
      })
      .select()
      .single();

    if (payErr) throw payErr;

    // 2. Only upon payment: mirror into authoritative expense_transactions record
    const expRes = await createExpense({
      amount: payoutAmount,
      date: format(new Date(), "yyyy-MM-dd"),
      categoryName: "People & Salaries",
      allocation: "payroll",
      subcategory: "Early Salary Advance",
      description: `Early Advance: ${req.team_member?.name || "Specialist"} (${req.reason})`,
      paymentMethod: payMethod,
      status: "paid",
      teamMemberId: req.team_member_id,
      salaryPaymentId: payment.id,
      notes: `Disbursed for approved advance request: ${req.reason}`,
      actorId: params.actorId,
      actorName: params.actorName,
      clientOverride: activeClient,
    });

    if (!expRes.success) throw expRes.error;

    // 3. Mark request as approved
    const { error: updErr } = await (activeClient as any)
      .from("salary_requests")
      .update({
        status: "approved",
        approved_amount: payoutAmount,
        reviewed_by: params.actorId || null,
        reviewed_at: new Date().toISOString(),
        review_notes: params.reviewNotes || null,
        salary_payment_id: payment.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.id);

    if (updErr) throw updErr;

    await logFinancialAction({
      action: "approve_salary_request",
      entityType: "salary_requests",
      entityId: req.id,
      clientOverride: activeClient,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { payoutAmount, memberName: req.team_member?.name },
    });

    await logSystemAudit({
      action: "SALARY_CHANGE",
      entityType: "salary_request",
      entityId: req.id,
      actorId: params.actorId,
      actorName: params.actorName,
      newValues: { payoutAmount, status: "approved", payment_id: payment.id },
    });

    await emitNotification({
      eventType: "SALARY_PAID",
      title: "Salary Advance Approved & Paid",
      message: `Your advance request of ${payoutAmount} TND has been approved and disbursed.`,
      category: "finance",
      roleTarget: "worker",
      linkUrl: `/admin/my-salary`,
      entityType: "salary_request",
      entityId: req.id,
    });

    return { success: true, error: null };
  } catch (err: any) {
    console.error("[approveSalaryRequest] Error:", err);
    return { success: false, error: err };
  }
}

export async function rejectSalaryRequest(params: {
  requestId: string;
  reviewNotes: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await (supabase as any)
      .from("salary_requests")
      .update({
        status: "rejected",
        reviewed_by: params.actorId || null,
        reviewed_at: new Date().toISOString(),
        review_notes: params.reviewNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.requestId);

    if (error) throw error;

    await logFinancialAction({
      action: "reject_salary_request",
      entityType: "salary_requests",
      entityId: params.requestId,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { notes: params.reviewNotes },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

// ============================================================
// SUBSCRIPTIONS & RECURRING EXPENSES
// ============================================================

export async function upsertSubscription(params: {
  id?: string;
  name: string;
  vendor?: string;
  categoryId?: string | null;
  categoryName: string;
  amount: number;
  billingCycle: "monthly" | "quarterly" | "yearly";
  billingDay?: number;
  nextBillingDate?: string | null;
  paymentMethod?: string;
  status?: "active" | "paused" | "cancelled";
  notes?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const payload = {
      name: params.name.trim(),
      vendor: params.vendor?.trim() || null,
      category_id: params.categoryId || null,
      category_name: params.categoryName,
      amount: params.amount,
      currency: "TND",
      billing_cycle: params.billingCycle,
      billing_day: params.billingDay || 1,
      next_billing_date: params.nextBillingDate || null,
      payment_method: params.paymentMethod || "Credit Card",
      status: params.status || "active",
      notes: params.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let res;
    if (params.id) {
      res = await (supabase as any).from("subscriptions").update(payload).eq("id", params.id);
    } else {
      res = await (supabase as any).from("subscriptions").insert(payload);
    }

    if (res.error) throw res.error;

    await logFinancialAction({
      action: params.id ? "update_subscription" : "create_subscription",
      entityType: "subscriptions",
      entityId: params.id || null,
      actorId: params.actorId,
      actorName: params.actorName,
      details: { name: params.name, amount: params.amount, cycle: params.billingCycle },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function deleteSubscription(
  id: string,
  actor?: { id?: string; name?: string }
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await (supabase as any).from("subscriptions").delete().eq("id", id);
    if (error) throw error;

    await logFinancialAction({
      action: "delete_subscription",
      entityType: "subscriptions",
      entityId: id,
      actorId: actor?.id,
      actorName: actor?.name,
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

export async function recordSubscriptionPayment(params: {
  subscription: Subscription;
  paymentDate?: string;
  actorId?: string;
  actorName?: string;
}): Promise<{ success: boolean; error: Error | null }> {
  const pDate = params.paymentDate || format(new Date(), "yyyy-MM-dd");
  return createExpense({
    amount: params.subscription.amount,
    date: pDate,
    categoryName: params.subscription.category_name,
    categoryId: params.subscription.category_id,
    allocation: "software",
    subcategory: "Recurring Subscription",
    vendor: params.subscription.vendor || params.subscription.name,
    description: `Subscription: ${params.subscription.name}`,
    paymentMethod: params.subscription.payment_method || "Credit Card",
    status: "paid",
    isRecurring: true,
    subscriptionId: params.subscription.id,
    notes: `Recurring billing charge for ${params.subscription.billing_cycle} cycle`,
    actorId: params.actorId,
    actorName: params.actorName,
  });
}

// ============================================================
// EXPORT ENGINE: CSV GENERATION
// ============================================================

export function exportTransactionsToCSV(params: {
  type: "incomes" | "expenses" | "all" | "ledger";
  incomes?: IncomeTransaction[];
  expenses?: ExpenseTransaction[];
  ledger?: CanonicalFinancialTransaction[];
  periodLabel: string;
}): string {
  const headers = [
    "ID",
    "Type",
    "Direction",
    "Date",
    "Amount (TND)",
    "Category",
    "Allocation",
    "Client",
    "Team Member",
    "Description",
    "Payment Method",
    "Status",
    "Reference",
    "Notes",
  ];

  const rows: (string | number)[][] = [headers];

  if (params.ledger && params.ledger.length > 0) {
    let items = params.ledger;
    if (params.type === "incomes") {
      items = items.filter((t) => t.direction === "inflow");
    } else if (params.type === "expenses") {
      items = items.filter((t) => t.direction === "outflow");
    }
    for (const t of items) {
      rows.push([
        t.id,
        t.transactionType,
        t.direction.toUpperCase(),
        t.date,
        t.amount,
        t.category,
        t.allocation,
        t.clientName || "",
        t.teamMemberName || "",
        t.notes || t.reference || t.category,
        t.paymentMethod,
        t.status.toUpperCase(),
        t.reference || "",
        t.notes || "",
      ]);
    }
  } else {
    // Fallback if ledger was not passed
    if (params.type !== "expenses" && params.incomes) {
      for (const inc of params.incomes) {
        rows.push([
          inc.id,
          inc.transaction_type || "INCOME",
          "INFLOW",
          inc.date,
          inc.amount,
          inc.category,
          inc.allocation || "client_service",
          inc.client?.name || "",
          "",
          inc.description || inc.notes || "",
          inc.payment_method,
          inc.status.toUpperCase(),
          inc.reference || "",
          inc.notes || "",
        ]);
      }
    }
    if (params.type !== "incomes" && params.expenses) {
      for (const exp of params.expenses) {
        rows.push([
          exp.id,
          exp.transaction_type || "EXPENSE",
          "OUTFLOW",
          exp.date,
          exp.amount,
          exp.category_name,
          exp.allocation || "operating_expense",
          exp.client?.name || "",
          exp.team_member?.name || "",
          exp.description || exp.notes || "",
          exp.payment_method,
          exp.status.toUpperCase(),
          exp.reference || "",
          exp.notes || "",
        ]);
      }
    }
  }

  const csvContent = serializeCsv(rows, { withBom: true, preserveNumeric: true });

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SADA_Financial_Ledger_${params.periodLabel.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return csvContent;
}

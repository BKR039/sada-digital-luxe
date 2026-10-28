// ============================================================
// SADA OS — BUSINESS RULES INTELLIGENCE & GOVERNANCE ENGINE
// Canonical Metadata Registry, Live Evaluation Engine,
// Contradiction Detection, Deterministic Impact Simulation,
// and Evidence-Based Smart Insights for Management.
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import type {
  BusinessRule,
  BusinessRuleCategory,
  BusinessRuleKey,
  BusinessRuleSmartInsight,
  ContradictionWarning,
  ExecutiveRulesOverview,
  ImpactSimulationResult,
  LiveBusinessContext,
  RuleEvaluationResult,
  RuleEvaluationStatus,
  RuleMetadataDefinition,
} from "@/types/business-rules";
import { fetchCompanyFinance, getPresetPeriod } from "./finance-service";
import { fetchBusinessRules, getBusinessRuleNumber } from "./business-rules-service";
import { formatCurrency } from "@/types/finance";

// ============================================================
// 1. CANONICAL RULE METADATA REGISTRY (All 27 Canonical Rules)
// ============================================================

export const RULE_METADATA_REGISTRY: Record<string, RuleMetadataDefinition> = {
  // --- CASH & TREASURY ---
  critical_runway_months: {
    ruleKey: "critical_runway_months",
    category: "cash_treasury",
    name: "Critical Runway Month Floor",
    description: "Emergency cash safety floor. When total liquid reserves cover less than this period of recurring overhead, the executive risk alert triggers.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "months",
    operator: "<",
    severity: "critical",
    appliesTo: "treasury",
    consumers: ["Executive Command Center", "Financial OS", "Treasury Alerts"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Treasury & Cash Flow",
    observedDataSource: "cash_reserves / recurring_burn",
    minValue: 0.5,
    maxValue: 24,
  },
  warning_runway_months: {
    ruleKey: "warning_runway_months",
    category: "cash_treasury",
    name: "Cautionary Runway Horizon",
    description: "Early warning horizon. Alert triggers when cash reserves drop below this number of operational burn months, prompting cash collection acceleration.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "months",
    operator: "<",
    severity: "warning",
    appliesTo: "treasury",
    consumers: ["Executive Command Center", "Financial OS"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Treasury & Cash Flow",
    observedDataSource: "cash_reserves / recurring_burn",
    minValue: 1,
    maxValue: 36,
  },
  runway_default_months: {
    ruleKey: "runway_default_months",
    category: "cash_treasury",
    name: "Fallback Runway Baseline",
    description: "Deterministic runway figure displayed when monthly recurring overhead is zero or completely uncosted.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "months",
    operator: "==",
    severity: "info",
    appliesTo: "treasury",
    consumers: ["Executive Command Center", "Runway Math Fallback"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Cash Reserves",
    observedDataSource: "configuration_constant",
    minValue: 1,
    maxValue: 60,
  },

  // --- FIXED BURN ---
  fixed_burn_warning_percent: {
    ruleKey: "fixed_burn_warning_percent",
    category: "fixed_burn",
    name: "Fixed Overhead Revenue Ceiling",
    description: "Maximum allowable ratio of recurring fixed expenses (SaaS, office, base overhead) relative to monthly collected revenue.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: ">",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Financial OS Subscriptions", "Executive Intelligence", "Monthly Closing"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Subscriptions & Fixed Burn",
    observedDataSource: "recurring_subscriptions / monthly_revenue",
    minValue: 5,
    maxValue: 100,
  },
  high_fixed_burn_revenue_percent: {
    ruleKey: "high_fixed_burn_revenue_percent",
    category: "fixed_burn",
    name: "Critical Overhead Burden Benchmark",
    description: "Severe burn ceiling indicating dangerous operational overhead burden if fixed subscriptions consume this percentage of revenue.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: ">",
    severity: "warning",
    appliesTo: "treasury",
    consumers: ["Financial OS Subscriptions", "Treasury Alerts"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Fixed Subscriptions",
    observedDataSource: "recurring_subscriptions / monthly_revenue",
    minValue: 10,
    maxValue: 100,
  },

  // --- NOTIFICATIONS & ALERTS ---
  notification_deduplication_hours: {
    ruleKey: "notification_deduplication_hours",
    category: "notifications_alerts",
    name: "Alert Deduplication Horizon",
    description: "Sliding suppression window. Identical system alerts and deadline warnings are suppressed within this period to prevent notification fatigue.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "hours",
    operator: "<=",
    severity: "info",
    appliesTo: "notifications",
    consumers: ["Notification Center", "Automated Background Scanners"],
    actionRoute: "/admin",
    actionLabel: "Inspect Notification Center",
    observedDataSource: "notification_suppression_engine",
    minValue: 1,
    maxValue: 168,
  },
  task_due_soon_days: {
    ruleKey: "task_due_soon_days",
    category: "notifications_alerts",
    name: "Task Deadline Proximity Horizon",
    description: "Lead time before task due date when proactive deadline alerts are dispatched to assigned specialists and project leads.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "days",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Notification Center", "Production Calendar", "My Work Queue"],
    actionRoute: "/admin/my-work",
    actionLabel: "Inspect Tasks Due Soon",
    observedDataSource: "open_tasks_due_within_horizon",
    minValue: 1,
    maxValue: 14,
  },

  // --- OPERATIONS & PAYROLL ---
  standard_monthly_working_hours: {
    ruleKey: "standard_monthly_working_hours",
    category: "operations",
    name: "Standard Monthly Labor Hours",
    description: "Canonical standard monthly hours used to compute team members' authoritative hourly rates (Base Monthly Salary / Hours).",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "hours",
    operator: "==",
    severity: "info",
    appliesTo: "operations",
    consumers: ["Team Cost Engine", "Hourly Rate Calculator", "Task Labor Costing"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Team Compensation",
    observedDataSource: "team_hourly_rate_calculation",
    minValue: 40,
    maxValue: 300,
  },
  max_salary_advance_percent: {
    ruleKey: "max_salary_advance_percent",
    category: "operations",
    name: "Max Salary Advance Cap",
    description: "Hard cap limiting the percentage of monthly base salary that a worker may request as an early salary advance.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Worker Salary Advance Modal", "Finance Approvals Desk"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Advance Requests",
    observedDataSource: "salary_requests_max_ratio",
    minValue: 10,
    maxValue: 100,
  },

  // --- PROFITABILITY & MARGIN ---
  low_profit_client_margin_percent: {
    ruleKey: "low_profit_client_margin_percent",
    category: "profitability",
    name: "Low Client Margin Warning Threshold",
    description: "Net contribution margin below which an active client account is flagged as 'LOW PROFIT' requiring price renegotiation or labor reduction.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: "<",
    severity: "warning",
    appliesTo: "clients",
    consumers: ["Client Profitability Matrix", "Executive Command Center", "Smart Insights"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect Low-Margin Clients",
    observedDataSource: "client_contribution_margins",
    minValue: 0,
    maxValue: 100,
  },
  low_margin_client_threshold_percent: {
    ruleKey: "low_margin_client_threshold_percent",
    category: "profitability",
    name: "Client Account Health Low Floor",
    description: "Threshold baseline for marking account health as low profit across client portfolio overview decks.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Client Health Scoring", "Portfolio Health Badges"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect Client Portfolio",
    observedDataSource: "client_contribution_margins",
    minValue: 0,
    maxValue: 100,
  },
  client_medium_profit_margin_percent: {
    ruleKey: "client_medium_profit_margin_percent",
    category: "profitability",
    name: "Moderate Client Margin Floor",
    description: "Minimum margin required for a client account to achieve 'MODERATE' profitability health rating.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Client Profitability Matrix", "Client Workspaces"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect Moderate Accounts",
    observedDataSource: "client_contribution_margins",
    minValue: 0,
    maxValue: 100,
  },
  client_high_profit_margin_percent: {
    ruleKey: "client_high_profit_margin_percent",
    category: "profitability",
    name: "Flagship High Margin Benchmark",
    description: "Target contribution margin for a client account to be classified as 'FLAGSHIP / HIGH PROFIT'.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Client Profitability Matrix", "Executive Flagship Highlights"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect Flagship Clients",
    observedDataSource: "client_contribution_margins",
    minValue: 0,
    maxValue: 100,
  },
  client_medium_profit_amount_tnd: {
    ruleKey: "client_medium_profit_amount_tnd",
    category: "profitability",
    name: "Moderate Profit Contribution (TND)",
    description: "Monetary contribution profit floor (in TND) required to rate client health as moderate.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "TND",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Client Health Scoring", "Contribution Profit Ledgers"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect Account Profitability",
    observedDataSource: "client_contribution_profit_amounts",
    minValue: 0,
    maxValue: 100000,
  },
  client_high_profit_amount_tnd: {
    ruleKey: "client_high_profit_amount_tnd",
    category: "profitability",
    name: "Flagship Profit Contribution (TND)",
    description: "Monetary contribution profit target (in TND) characterizing flagship, high-value client accounts.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "TND",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Executive Highlights", "Client Profitability"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect High-Contribution Clients",
    observedDataSource: "client_contribution_profit_amounts",
    minValue: 0,
    maxValue: 100000,
  },
  historical_profit_zero_behavior: {
    ruleKey: "historical_profit_zero_behavior",
    category: "profitability",
    name: "Zero Expense Profit Margin Behavior",
    description: "Defines output when client has revenue but zero recorded expenses ('null' avoids misleading false 100% margin).",
    evaluationType: "configuration_policy",
    dataType: "text",
    unit: "behavior",
    operator: "==",
    severity: "info",
    appliesTo: "kpi",
    consumers: ["Client Profitability Formula", "Financial OS Reconciliation"],
    actionRoute: "/admin/clients",
    actionLabel: "Inspect Profit Calculations",
    observedDataSource: "formula_behavior_mode",
    minValue: null,
    maxValue: null,
  },

  // --- SALES & COMMISSIONS ---
  initial_commission_rate: {
    ruleKey: "initial_commission_rate",
    category: "sales_commissions",
    name: "Initial Deal Commission Rate",
    description: "Standard percentage of monthly client retainer fee paid as commission to the closing sales representative on new contracts.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Deal Conversion RPC", "Sales Pipeline", "Sales Commissions Payouts"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Sales Workspace",
    observedDataSource: "sales_commission_policy",
    minValue: 0,
    maxValue: 100,
  },
  initial_commission_duration_months: {
    ruleKey: "initial_commission_duration_months",
    category: "sales_commissions",
    name: "Initial Commission Duration",
    description: "Number of consecutive months that the closing sales rep receives initial commission payouts on newly acquired retainers.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "months",
    operator: "==",
    severity: "info",
    appliesTo: "sales",
    consumers: ["Sales Commission Schedule", "Recurring Payout Engine"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Sales Workspace",
    observedDataSource: "commission_schedule_duration",
    minValue: 1,
    maxValue: 36,
  },
  renewal_commission_rate: {
    ruleKey: "renewal_commission_rate",
    category: "sales_commissions",
    name: "Contract Renewal Commission Rate",
    description: "Incentive percentage paid on client retainer renewals after the initial agreement period concludes.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Renewal Commission Calculations", "Sales Pipeline"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Renewal Commissions",
    observedDataSource: "sales_commission_policy",
    minValue: 0,
    maxValue: 100,
  },
  renewal_commission_duration_months: {
    ruleKey: "renewal_commission_duration_months",
    category: "sales_commissions",
    name: "Renewal Commission Duration",
    description: "Number of months that renewal commissions continue on retained accounts.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "months",
    operator: "<=",
    severity: "info",
    appliesTo: "system",
    consumers: ["Sales Commission Schedule"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Sales Commissions",
    observedDataSource: "commission_schedule_duration",
    minValue: 1,
    maxValue: 60,
  },
  upsell_commission_rate: {
    ruleKey: "upsell_commission_rate",
    category: "sales_commissions",
    name: "Upsell / Add-On Commission Rate",
    description: "Commission rate applied when an existing client upgrades package tier or purchases recurring add-on deliverables.",
    evaluationType: "configuration_policy",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "info",
    appliesTo: "system",
    consumers: ["Sales Commission Payout Engine"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Sales Pipeline",
    observedDataSource: "sales_commission_policy",
    minValue: 0,
    maxValue: 100,
  },
  high_commission_amount: {
    ruleKey: "high_commission_amount",
    category: "sales_commissions",
    name: "High Commission Alert Threshold",
    description: "Single-client monthly commission payout amount exceeding which an executive intelligence finding is surfaced.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "TND",
    operator: ">",
    severity: "info",
    appliesTo: "smart_insights",
    consumers: ["Smart Insights", "Sales Commission Audit"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Commission Payouts",
    observedDataSource: "client_commissions_payout_records",
    minValue: 0,
    maxValue: 10000,
  },

  // --- SMART INSIGHTS ---
  high_commission_insight_threshold_tnd: {
    ruleKey: "high_commission_insight_threshold_tnd",
    category: "smart_insights",
    name: "Commission Impact Insight Trigger",
    description: "Threshold (in TND) for generating executive briefing cards analyzing sales commission concentration on client margins.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "TND",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Executive Command Center", "Smart Insights Engine"],
    actionRoute: "/admin/sales",
    actionLabel: "Inspect Commission Impact",
    observedDataSource: "client_commissions_payout_records",
    minValue: 0,
    maxValue: 10000,
  },

  // --- SPONSORING & MEDIA ---
  sponsoring_purchase_rate: {
    ruleKey: "sponsoring_purchase_rate",
    category: "sponsoring_advertising",
    name: "Media Cost Exchange Rate (USD/TND)",
    description: "Benchmark purchase cost rate in TND per 1 USD paid to advertising platforms (Meta, TikTok, Google Ads).",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "TND/USD",
    operator: "==",
    severity: "info",
    appliesTo: "sponsoring",
    consumers: ["Sponsoring Engine", "Campaign Arbitrage Calculator", "Financial OS"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Sponsoring Engine",
    observedDataSource: "active_fx_purchase_rate",
    minValue: 1,
    maxValue: 10,
  },
  sponsoring_client_rate: {
    ruleKey: "sponsoring_client_rate",
    category: "sponsoring_advertising",
    name: "Client Invoicing Exchange Rate (USD/TND)",
    description: "Rate at which advertising platform spend is billed to clients in TND, creating positive FX arbitrage margin.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "TND/USD",
    operator: "==",
    severity: "info",
    appliesTo: "sponsoring",
    consumers: ["Sponsoring Engine", "Invoice Billing", "Financial OS"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Sponsoring Invoicing",
    observedDataSource: "active_fx_client_rate",
    minValue: 1,
    maxValue: 10,
  },
  sponsoring_min_margin_percent: {
    ruleKey: "sponsoring_min_margin_percent",
    category: "sponsoring_advertising",
    name: "Minimum Sponsoring Arbitrage Margin",
    description: "Target minimum gross margin percentage on paid media management. Alert triggers if FX spread falls below this threshold.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: "<=",
    severity: "warning",
    appliesTo: "system",
    consumers: ["Sponsoring Engine", "Smart Insights"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Sponsoring Arbitrage",
    observedDataSource: "fx_spread_margin_percent",
    minValue: 0,
    maxValue: 100,
  },
  minimum_net_margin_for_sponsoring_efficiency: {
    ruleKey: "minimum_net_margin_for_sponsoring_efficiency",
    category: "sponsoring_advertising",
    name: "Sponsoring Efficiency Target",
    description: "Efficiency benchmark evaluated by Smart Insights to classify sponsoring revenue as 'Healthy Arbitrage' vs 'Low Margin'.",
    evaluationType: "live_evaluator",
    dataType: "numeric",
    unit: "%",
    operator: ">",
    severity: "warning",
    appliesTo: "smart_insights",
    consumers: ["Smart Insights", "Executive Command Center"],
    actionRoute: "/admin/finance",
    actionLabel: "Inspect Sponsoring Efficiency",
    observedDataSource: "fx_spread_margin_percent",
    minValue: 0,
    maxValue: 100,
  },
};

// ============================================================
// 2. LIVE BUSINESS CONTEXT LOADER (Parallel & Efficient)
// ============================================================

let cachedLiveContext: LiveBusinessContext | null = null;
let lastContextFetchTime = 0;
const CONTEXT_TTL_MS = 60 * 1000; // 60s cache

export async function fetchLiveBusinessContext(
  forceRefresh = false,
  userAuthCtx?: any
): Promise<LiveBusinessContext> {
  const now = Date.now();
  if (!forceRefresh && cachedLiveContext && now - lastContextFetchTime < CONTEXT_TTL_MS) {
    return cachedLiveContext;
  }

  const period = getPresetPeriod("this_month");

  try {
    const [rulesList, financeData, tasksRes, versionsRes, salaryRequestsRes, dealsRes] = await Promise.all([
      fetchBusinessRules(forceRefresh).catch(() => []),
      fetchCompanyFinance(period, userAuthCtx).catch(() => null),
      (supabase as any)
        .from("project_tasks")
        .select("id, title, status, due_date")
        .neq("status", "done"),
      (supabase as any)
        .from("business_rule_versions")
        .select("id, rule_key, version, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      (supabase as any)
        .from("salary_requests")
        .select("id, requested_amount, status")
        .eq("status", "pending"),
      (supabase as any)
        .from("deals")
        .select("id, value, stage, commission_rate")
        .limit(100),
    ]);

    // Financial KPIs from authoritative Financial OS
    const kpis = financeData?.kpis;
    const cashReserves = Number(kpis?.cash || 0);
    const recurringBurn = Number(kpis?.recurringBurn || 0);
    const monthlyRevenue = Number(kpis?.revenue || 0);
    const monthlyExpenses = Number(kpis?.expenses || 0);

    const runwayMonths = recurringBurn > 0 ? Number((cashReserves / recurringBurn).toFixed(2)) : 12;
    const fixedBurnRatio = monthlyRevenue > 0
      ? Number(((recurringBurn / monthlyRevenue) * 100).toFixed(1))
      : (recurringBurn > 0 ? 100 : 0);

    // Sponsoring FX Spread (Dynamically queried from active canonical rules)
    const purchaseRate = getBusinessRuleNumber("sponsoring_purchase_rate", 3.37);
    const clientRate = getBusinessRuleNumber("sponsoring_client_rate", 4.00);
    const sponsoringSpreadMarginPercent = clientRate > 0
      ? Number((((clientRate - purchaseRate) / clientRate) * 100).toFixed(1))
      : 0;

    // Invoices & Receivables
    const invoices = financeData?.invoices || [];
    const unpaidInvoices = invoices.filter((i: any) => i.status !== "paid");
    const totalOutstandingReceivables = unpaidInvoices.reduce(
      (sum: number, i: any) => sum + Number(i.totalAmount || i.total_amount || i.amount || 0),
      0
    );

    const nowDate = new Date();
    const criticalReceivablesThresholdDays = 60;
    const overdueInvoicesPastCriticalDays = unpaidInvoices.filter((i: any) => {
      const due = new Date(i.dueDate || i.due_date || i.date);
      if (isNaN(due.getTime())) return false;
      const diff = Math.floor((nowDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= criticalReceivablesThresholdDays;
    }).length;

    // Client Profitability & Threshold Evaluation
    const lowMarginThreshold = getBusinessRuleNumber("low_profit_client_margin_percent", 20);
    const medMarginThreshold = getBusinessRuleNumber("client_medium_profit_margin_percent", 25);
    const highMarginThreshold = getBusinessRuleNumber("client_high_profit_margin_percent", 50);
    const highProfitAmountThreshold = getBusinessRuleNumber("client_high_profit_amount_tnd", 1000);
    const medProfitAmountThreshold = getBusinessRuleNumber("client_medium_profit_amount_tnd", 400);

    const clientProfitability = financeData?.clientProfitability || [];
    const totalActiveClients = clientProfitability.length;
    const lowMarginClientsCount = clientProfitability.filter((c: any) => c.marginPercent < lowMarginThreshold).length;
    const medProfitClientsCount = clientProfitability.filter((c: any) => c.marginPercent >= medMarginThreshold && c.marginPercent < highMarginThreshold).length;
    const highProfitClientsCount = clientProfitability.filter((c: any) => c.marginPercent >= highMarginThreshold).length;
    const highProfitAmountClientsCount = clientProfitability.filter((c: any) => Number(c.netProfit || c.contributionProfit || 0) >= highProfitAmountThreshold).length;
    const medProfitAmountClientsCount = clientProfitability.filter((c: any) => {
      const profit = Number(c.netProfit || c.contributionProfit || 0);
      return profit >= medProfitAmountThreshold && profit < highProfitAmountThreshold;
    }).length;

    // Commissions Distribution
    const commissionsList = financeData?.commissions || [];
    const maxCommissionAmountTnd = commissionsList.reduce(
      (max: number, c: any) => Math.max(max, Number(c.commissionAmount || 0)),
      0
    );

    // Tasks Due Soon (lead time <= configured threshold days)
    const taskDueLeadDays = getBusinessRuleNumber("task_due_soon_days", 2);
    const openTasks = tasksRes?.data || [];
    const activeTasksCount = openTasks.length;
    const horizonMs = taskDueLeadDays * 24 * 60 * 60 * 1000;
    const tasksDueSoonCount = openTasks.filter((t: any) => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      if (isNaN(dueDate.getTime())) return false;
      const diff = dueDate.getTime() - nowDate.getTime();
      return diff >= 0 && diff <= horizonMs;
    }).length;

    // Salary Requests
    const pendingSalaryRequests = salaryRequestsRes?.data || [];
    const pendingSalaryRequestsCount = pendingSalaryRequests.length;
    let maxSalaryAdvanceRequestedPercent = 0;
    if (pendingSalaryRequestsCount > 0) {
      const maxReq = pendingSalaryRequests.reduce((max: number, r: any) => Math.max(max, Number(r.requested_amount || 0)), 0);
      // Canonical standard monthly salary is 1,400 TND in SADA OS
      maxSalaryAdvanceRequestedPercent = maxReq > 0 ? Number(((maxReq / 1400) * 100).toFixed(1)) : 0;
    }

    // Versions in last 30 days
    const thirtyDaysAgo = new Date(nowDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const versions = versionsRes?.data || [];
    const recentVersionsCount30d = versions.filter((v: any) => v.created_at >= thirtyDaysAgo).length;
    const lastUpdatedVersionTimestamp = versions[0]?.created_at;

    cachedLiveContext = {
      cashReserves,
      recurringBurn,
      runwayMonths,
      monthlyRevenue,
      monthlyExpenses,
      fixedBurnRatio,
      sponsoringSpreadMarginPercent,
      sponsoringPurchaseRate: purchaseRate,
      sponsoringClientRate: clientRate,
      unpaidInvoicesCount: unpaidInvoices.length,
      totalOutstandingReceivables,
      overdueInvoicesPastCriticalDays,
      criticalReceivablesThresholdDays,
      lowMarginClientsCount,
      medProfitClientsCount,
      highProfitClientsCount,
      highProfitAmountClientsCount,
      medProfitAmountClientsCount,
      maxCommissionAmountTnd,
      totalActiveClients,
      activeTasksCount,
      tasksDueSoonCount,
      taskDueLeadDays,
      pendingSalaryRequestsCount,
      maxSalaryAdvanceRequestedPercent,
      recentVersionsCount30d,
      lastUpdatedVersionTimestamp,
      isLiveDataAvailable: financeData !== null,
      fetchedAt: new Date().toISOString(),
    };

    lastContextFetchTime = now;
    return cachedLiveContext;
  } catch (err) {
    console.warn("[fetchLiveBusinessContext] Error loading live business context:", err);
    return {
      cashReserves: 0,
      recurringBurn: 0,
      runwayMonths: 0,
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      fixedBurnRatio: 0,
      sponsoringSpreadMarginPercent: 0,
      sponsoringPurchaseRate: 0,
      sponsoringClientRate: 0,
      unpaidInvoicesCount: 0,
      totalOutstandingReceivables: 0,
      overdueInvoicesPastCriticalDays: 0,
      criticalReceivablesThresholdDays: 60,
      lowMarginClientsCount: 0,
      medProfitClientsCount: 0,
      highProfitClientsCount: 0,
      highProfitAmountClientsCount: 0,
      medProfitAmountClientsCount: 0,
      maxCommissionAmountTnd: 0,
      totalActiveClients: 0,
      activeTasksCount: 0,
      tasksDueSoonCount: 0,
      taskDueLeadDays: 2,
      pendingSalaryRequestsCount: 0,
      maxSalaryAdvanceRequestedPercent: 0,
      recentVersionsCount30d: 0,
      isLiveDataAvailable: false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

// ============================================================
// 3. CONTRADICTION & SEMANTIC INCONSISTENCY DETECTION
// ============================================================

export function detectRuleContradictions(rules: BusinessRule[]): Map<string, ContradictionWarning[]> {
  const warnings = new Map<string, ContradictionWarning[]>();

  const getNum = (key: string): number | null => {
    const r = rules.find((rule) => rule.rule_key === key);
    return r && r.numeric_value !== null && r.numeric_value !== undefined
      ? Number(r.numeric_value)
      : null;
  };

  const addWarning = (key: string, warning: ContradictionWarning) => {
    const existing = warnings.get(key) || [];
    existing.push(warning);
    warnings.set(key, existing);
  };

  // 1. Critical Runway vs Warning Runway
  const critRunway = getNum("critical_runway_months");
  const warnRunway = getNum("warning_runway_months");
  if (critRunway !== null && warnRunway !== null && critRunway >= warnRunway) {
    const msg = `Critical runway floor (${critRunway} mo) is >= cautionary warning runway (${warnRunway} mo). Warning runway must be strictly greater than critical runway.`;
    addWarning("critical_runway_months", {
      ruleKey: "critical_runway_months",
      severity: "error",
      message: msg,
      relatedRuleKey: "warning_runway_months",
    });
    addWarning("warning_runway_months", {
      ruleKey: "warning_runway_months",
      severity: "error",
      message: msg,
      relatedRuleKey: "critical_runway_months",
    });
  }

  // 2. Sponsoring Purchase Rate vs Client Rate
  const purchaseRate = getNum("sponsoring_purchase_rate");
  const clientRate = getNum("sponsoring_client_rate");
  if (purchaseRate !== null && clientRate !== null && purchaseRate >= clientRate) {
    const msg = `Media purchase rate (${purchaseRate} TND/USD) is >= client invoicing rate (${clientRate} TND/USD). This produces negative or zero arbitrage margin on media ad spend.`;
    addWarning("sponsoring_purchase_rate", {
      ruleKey: "sponsoring_purchase_rate",
      severity: "error",
      message: msg,
      relatedRuleKey: "sponsoring_client_rate",
    });
    addWarning("sponsoring_client_rate", {
      ruleKey: "sponsoring_client_rate",
      severity: "error",
      message: msg,
      relatedRuleKey: "sponsoring_purchase_rate",
    });
  }

  // 3. Client Margin Hierarchy
  const lowMargin = getNum("low_profit_client_margin_percent");
  const medMargin = getNum("client_medium_profit_margin_percent");
  const highMargin = getNum("client_high_profit_margin_percent");

  if (lowMargin !== null && medMargin !== null && lowMargin > medMargin) {
    const msg = `Low profit margin threshold (${lowMargin}%) exceeds moderate margin floor (${medMargin}%).`;
    addWarning("low_profit_client_margin_percent", {
      ruleKey: "low_profit_client_margin_percent",
      severity: "error",
      message: msg,
      relatedRuleKey: "client_medium_profit_margin_percent",
    });
  }
  if (medMargin !== null && highMargin !== null && medMargin >= highMargin) {
    const msg = `Moderate profit margin floor (${medMargin}%) is >= flagship high profit margin (${highMargin}%).`;
    addWarning("client_medium_profit_margin_percent", {
      ruleKey: "client_medium_profit_margin_percent",
      severity: "error",
      message: msg,
      relatedRuleKey: "client_high_profit_margin_percent",
    });
  }

  // 4. Sales Commission Rates Hierarchy
  const initComm = getNum("initial_commission_rate");
  const renewComm = getNum("renewal_commission_rate");
  if (initComm !== null && renewComm !== null && renewComm > initComm) {
    const msg = `Renewal commission rate (${renewComm}%) exceeds initial acquisition commission (${initComm}%). Renewal incentives should not exceed initial deal incentives.`;
    addWarning("renewal_commission_rate", {
      ruleKey: "renewal_commission_rate",
      severity: "warning",
      message: msg,
      relatedRuleKey: "initial_commission_rate",
    });
  }

  return warnings;
}

// ============================================================
// 4. SINGLE RULE EVALUATION ENGINE (Evidence-Based & Documented)
// ============================================================

export function evaluateSingleRule(
  rule: BusinessRule,
  context: LiveBusinessContext,
  contradictionsMap?: Map<string, ContradictionWarning[]>
): RuleEvaluationResult {
  const meta = RULE_METADATA_REGISTRY[rule.rule_key] || {
    ruleKey: rule.rule_key,
    category: rule.category,
    name: rule.rule_name,
    description: rule.description,
    evaluationType: "configuration_policy",
    dataType: rule.value_type,
    unit: rule.unit || "",
    operator: rule.operator || "==",
    severity: rule.severity || "info",
    appliesTo: rule.applies_to || "system",
    consumers: [],
    actionRoute: "/admin/business-rules",
    actionLabel: "Inspect Rule",
    observedDataSource: "configuration_table",
    minValue: rule.min_value,
    maxValue: rule.max_value,
  };

  const contradictions = contradictionsMap?.get(rule.rule_key) || [];
  const hasContradiction = contradictions.length > 0;
  const contradictionDetails = hasContradiction ? contradictions.map((c) => c.message).join(" ") : undefined;

  const nowIso = new Date().toISOString();
  const configuredThresholdDisplay = `${rule.numeric_value ?? rule.text_value ?? "—"} ${rule.unit || ""}`.trim();

  // If this rule is a configuration policy without a live observed variable:
  if (meta.evaluationType === "configuration_policy") {
    return {
      ruleKey: rule.rule_key,
      status: hasContradiction ? "warning" : "config_only",
      conditionMet: false,
      observedValue: null,
      observedDisplay: "Policy Baseline",
      configuredThresholdDisplay,
      finding: `Configured structural governance policy: ${rule.rule_name} is set to ${configuredThresholdDisplay}.`,
      businessImpact: `Authoritatively consumed by: ${meta.consumers.join(", ") || "SADA OS core modules"}.`,
      recommendedAction: hasContradiction
        ? "Review conflicting parameters to align governance hierarchy."
        : "Operational baseline is active and governing future calculations.",
      actionRoute: meta.actionRoute,
      actionLabel: meta.actionLabel,
      consumers: meta.consumers,
      evaluatedAt: nowIso,
      isContradictory: hasContradiction,
      contradictionDetails,
    };
  }

  // Check for missing / uninitialized live telemetry on live evaluators
  if (context.isLiveDataAvailable === false) {
    return {
      ruleKey: rule.rule_key,
      status: "insufficient_data",
      conditionMet: false,
      observedValue: null,
      observedDisplay: "No Live Telemetry",
      configuredThresholdDisplay,
      finding: `Authoritative live telemetry is temporarily unavailable or uninitialized for ${rule.rule_name}.`,
      businessImpact: `Evaluation deferred pending financial and operational synchronization.`,
      recommendedAction: "Verify database connectivity and refresh telemetry context.",
      actionRoute: meta.actionRoute,
      actionLabel: meta.actionLabel,
      consumers: meta.consumers,
      evaluatedAt: nowIso,
      isContradictory: hasContradiction,
      contradictionDetails,
    };
  }

  // --- LIVE EVALUATORS ---
  const numThreshold = Number(rule.numeric_value ?? 0);

  switch (rule.rule_key) {
    case "critical_runway_months": {
      const isCritical = context.runwayMonths < numThreshold;
      return {
        ruleKey: rule.rule_key,
        status: isCritical ? "critical" : "healthy",
        conditionMet: isCritical,
        observedValue: context.runwayMonths,
        observedDisplay: `${context.runwayMonths} mo`,
        configuredThresholdDisplay,
        finding: isCritical
          ? `Cash runway is critically low at ${context.runwayMonths} months, falling below the mandatory ${numThreshold} months safety floor.`
          : `Liquid cash reserves (${formatCurrency(context.cashReserves)}) cover ${context.runwayMonths} months of recurring burn, well above the ${numThreshold} months critical floor.`,
        businessImpact: isCritical
          ? `High insolvency risk. Immediate treasury capital preservation and invoice collection required.`
          : `Treasury liquidity is healthy and complies with SADA OS financial governance.`,
        recommendedAction: isCritical ? "Accelerate invoice collection and pause discretionary expenses." : "Maintain current treasury reserve policy.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "warning_runway_months": {
      const isWarning = context.runwayMonths < numThreshold;
      return {
        ruleKey: rule.rule_key,
        status: isWarning ? "warning" : "healthy",
        conditionMet: isWarning,
        observedValue: context.runwayMonths,
        observedDisplay: `${context.runwayMonths} mo`,
        configuredThresholdDisplay,
        finding: isWarning
          ? `Cash runway (${context.runwayMonths} mo) is below the cautionary warning threshold (${numThreshold} mo).`
          : `Cash runway (${context.runwayMonths} mo) comfortably exceeds the ${numThreshold} months warning threshold.`,
        businessImpact: isWarning
          ? `Reduced financial resilience if incoming client retainers face delays.`
          : `Operating runway provides adequate buffer for planned growth.`,
        recommendedAction: isWarning ? "Review upcoming 60-day billing forecasts." : "No immediate action required.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "fixed_burn_warning_percent":
    case "high_fixed_burn_revenue_percent": {
      const isOverBurden = context.fixedBurnRatio > numThreshold;
      return {
        ruleKey: rule.rule_key,
        status: isOverBurden ? "warning" : "healthy",
        conditionMet: isOverBurden,
        observedValue: context.fixedBurnRatio,
        observedDisplay: `${context.fixedBurnRatio}%`,
        configuredThresholdDisplay,
        finding: isOverBurden
          ? `Fixed recurring subscriptions represent ${context.fixedBurnRatio}% of collected monthly revenue (${formatCurrency(context.recurringBurn)} / ${formatCurrency(context.monthlyRevenue)}), exceeding the ${numThreshold}% warning threshold.`
          : `Fixed recurring burn (${context.fixedBurnRatio}%) is safely contained below the ${numThreshold}% ceiling.`,
        businessImpact: isOverBurden
          ? `High overhead ratio reduces gross margins and operating cash flexibility.`
          : `Overhead efficiency meets operational benchmarks.`,
        recommendedAction: isOverBurden ? "Audit inactive SaaS licenses and consolidate recurring subscriptions." : "Continue monitoring subscription growth.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: isOverBurden ? 1 : 0,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "sponsoring_purchase_rate": {
      return {
        ruleKey: rule.rule_key,
        status: "healthy",
        conditionMet: false,
        observedValue: context.sponsoringPurchaseRate,
        observedDisplay: `${context.sponsoringPurchaseRate} TND/USD`,
        configuredThresholdDisplay,
        finding: `Authoritative media purchase cost rate is ${context.sponsoringPurchaseRate} TND/USD. Configured rule baseline is ${configuredThresholdDisplay}.`,
        businessImpact: `Governs procurement costing of digital media ad spend across ad platforms.`,
        recommendedAction: "Maintain currency tracking against commercial bank rates.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "sponsoring_client_rate": {
      return {
        ruleKey: rule.rule_key,
        status: "healthy",
        conditionMet: false,
        observedValue: context.sponsoringClientRate,
        observedDisplay: `${context.sponsoringClientRate} TND/USD`,
        configuredThresholdDisplay,
        finding: `Authoritative client ad billing rate is ${context.sponsoringClientRate} TND/USD, generating FX spread against ${context.sponsoringPurchaseRate} purchase rate.`,
        businessImpact: `Directly drives sponsoring gross margin and client campaign invoicing.`,
        recommendedAction: "Ensure client retainer agreements reflect current billing exchange rate.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "sponsoring_min_margin_percent":
    case "minimum_net_margin_for_sponsoring_efficiency": {
      const marginThreshold = numThreshold > 0 ? numThreshold : 15;
      const observedMargin = context.sponsoringSpreadMarginPercent;
      const isMarginTight = observedMargin < marginThreshold;
      return {
        ruleKey: rule.rule_key,
        status: isMarginTight ? "warning" : "healthy",
        conditionMet: isMarginTight,
        observedValue: observedMargin,
        observedDisplay: `${observedMargin}% spread`,
        configuredThresholdDisplay,
        finding: isMarginTight
          ? `Current FX spread delivers a ${observedMargin}% gross margin (${context.sponsoringClientRate} vs ${context.sponsoringPurchaseRate} TND/USD), falling below the ${marginThreshold}% efficiency target.`
          : `FX spread yields a healthy ${observedMargin}% margin (${context.sponsoringClientRate} client rate vs ${context.sponsoringPurchaseRate} purchase rate), meeting or exceeding the ${marginThreshold}% target.`,
        businessImpact: isMarginTight
          ? `Diminished arbitrage margin on paid media ad spend reduces agency profit contribution.`
          : `Sponsoring operations deliver positive net arbitrage.`,
        recommendedAction: isMarginTight ? "Adjust client billing rate or negotiate lower FX purchase rate." : "Maintain current FX rate structure.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "low_profit_client_margin_percent":
    case "low_margin_client_threshold_percent": {
      const lowCount = context.lowMarginClientsCount;
      const isCritical = lowCount > 0;
      return {
        ruleKey: rule.rule_key,
        status: isCritical ? "warning" : "healthy",
        conditionMet: isCritical,
        observedValue: lowCount,
        observedDisplay: `${lowCount} clients`,
        configuredThresholdDisplay,
        finding: isCritical
          ? `${lowCount} client accounts generate net contribution margin below your configured ${numThreshold}% floor.`
          : `All ${context.totalActiveClients} client accounts deliver healthy contribution margins exceeding ${numThreshold}%.`,
        businessImpact: isCritical
          ? `Underperforming accounts dilute overall agency profitability and consume specialist hours without adequate margin.`
          : `Client portfolio maintains strong contribution margins.`,
        recommendedAction: isCritical ? "Review pricing or adjust deliverable hours on affected accounts." : "Continue standard account delivery.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: lowCount,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "client_medium_profit_margin_percent": {
      const medCount = context.medProfitClientsCount ?? 0;
      return {
        ruleKey: rule.rule_key,
        status: "healthy",
        conditionMet: false,
        observedValue: medCount,
        observedDisplay: `${medCount} accounts`,
        configuredThresholdDisplay,
        finding: `${medCount} client account(s) operate within the moderate profit band (>= ${numThreshold}% margin).`,
        businessImpact: `Moderate margin clients provide stable recurring cash flow but have potential for margin expansion.`,
        recommendedAction: "Optimize delivery workflows to advance moderate accounts toward flagship tier.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: medCount,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "client_high_profit_margin_percent": {
      const highCount = context.highProfitClientsCount;
      return {
        ruleKey: rule.rule_key,
        status: highCount > 0 ? "healthy" : "warning",
        conditionMet: highCount > 0,
        observedValue: highCount,
        observedDisplay: `${highCount} flagship`,
        configuredThresholdDisplay,
        finding: highCount > 0
          ? `${highCount} flagship client accounts achieve the target ${numThreshold}% high-profit benchmark.`
          : `Zero client accounts currently achieve the ${numThreshold}% flagship profit margin benchmark.`,
        businessImpact: highCount > 0
          ? `Flagship accounts drive core agency cash flow.`
          : `Portfolio lacks high-margin champion accounts.`,
        recommendedAction: highCount > 0 ? "Protect service commitments for flagship clients." : "Upsell recurring retainers to higher margin tiers.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: highCount,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "client_medium_profit_amount_tnd": {
      const medAmtCount = context.medProfitAmountClientsCount ?? 0;
      return {
        ruleKey: rule.rule_key,
        status: "healthy",
        conditionMet: false,
        observedValue: medAmtCount,
        observedDisplay: `${medAmtCount} accounts`,
        configuredThresholdDisplay,
        finding: `${medAmtCount} client account(s) contribute moderate net profit (>= ${formatCurrency(numThreshold)}).`,
        businessImpact: `Monetary contribution health indicates account viability above base operational servicing costs.`,
        recommendedAction: "Maintain account health monitoring.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: medAmtCount,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "client_high_profit_amount_tnd": {
      const highAmtCount = context.highProfitAmountClientsCount ?? 0;
      return {
        ruleKey: rule.rule_key,
        status: highAmtCount > 0 ? "healthy" : "warning",
        conditionMet: highAmtCount > 0,
        observedValue: highAmtCount,
        observedDisplay: `${highAmtCount} flagship`,
        configuredThresholdDisplay,
        finding: highAmtCount > 0
          ? `${highAmtCount} flagship client account(s) generate high net contribution profit exceeding ${formatCurrency(numThreshold)}.`
          : `Zero client accounts currently generate >= ${formatCurrency(numThreshold)} net contribution profit.`,
        businessImpact: highAmtCount > 0
          ? `High-value clients subsidize infrastructure and expansion.`
          : `No individual accounts currently exceed the flagship monetary contribution threshold.`,
        recommendedAction: highAmtCount > 0 ? "Provide executive relationship oversight." : "Review pricing for high-deliverable accounts.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: highAmtCount,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "high_commission_amount": {
      const maxComm = context.maxCommissionAmountTnd ?? 0;
      const isHighComm = maxComm > numThreshold;
      return {
        ruleKey: rule.rule_key,
        status: isHighComm ? "warning" : "healthy",
        conditionMet: isHighComm,
        observedValue: maxComm,
        observedDisplay: formatCurrency(maxComm),
        configuredThresholdDisplay,
        finding: isHighComm
          ? `Highest single client monthly commission (${formatCurrency(maxComm)}) exceeds the ${formatCurrency(numThreshold)} alert threshold.`
          : `Peak single client monthly commission (${formatCurrency(maxComm)}) remains within the ${formatCurrency(numThreshold)} threshold.`,
        businessImpact: isHighComm
          ? `High commission concentration may compress agency net retainer margins if deal terms are aggressive.`
          : `Commission structures remain aligned with target gross margins.`,
        recommendedAction: isHighComm ? "Audit commission calculation for highest-earning sales contracts." : "Standard commission processing.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "high_commission_insight_threshold_tnd": {
      const maxComm = context.maxCommissionAmountTnd ?? 0;
      const isInsightTriggered = maxComm >= numThreshold;
      return {
        ruleKey: rule.rule_key,
        status: isInsightTriggered ? "warning" : "healthy",
        conditionMet: isInsightTriggered,
        observedValue: maxComm,
        observedDisplay: formatCurrency(maxComm),
        configuredThresholdDisplay,
        finding: isInsightTriggered
          ? `Commission impact insight triggered: maximum single commission payout is ${formatCurrency(maxComm)} (>= ${formatCurrency(numThreshold)}).`
          : `Single commission payouts remain below the ${formatCurrency(numThreshold)} insight generation threshold.`,
        businessImpact: `Directs management attention to high-value commission payouts.`,
        recommendedAction: isInsightTriggered ? "Inspect commission schedules on newly closed client accounts." : "No immediate action required.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "task_due_soon_days": {
      const count = context.tasksDueSoonCount;
      const hasUpcoming = count > 0;
      return {
        ruleKey: rule.rule_key,
        status: hasUpcoming ? "warning" : "healthy",
        conditionMet: hasUpcoming,
        observedValue: count,
        observedDisplay: `${count} tasks`,
        configuredThresholdDisplay,
        finding: hasUpcoming
          ? `${count} active tasks are due within the ${numThreshold}-day proximity horizon.`
          : `Zero active tasks are due within the next ${numThreshold} days across the production calendar.`,
        businessImpact: hasUpcoming ? "Production attention required to avoid SLA breaches." : "Workflows are on schedule.",
        recommendedAction: hasUpcoming ? "Inspect due tasks and verify specialist deliverable uploads." : "Normal calendar cadence.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: count,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    case "max_salary_advance_percent": {
      const reqCount = context.pendingSalaryRequestsCount;
      return {
        ruleKey: rule.rule_key,
        status: "healthy",
        conditionMet: false,
        observedValue: context.maxSalaryAdvanceRequestedPercent,
        observedDisplay: `${reqCount} pending req`,
        configuredThresholdDisplay,
        finding: `Salary advance cap (${numThreshold}%) is actively enforced. ${reqCount} advance request(s) currently pending review.`,
        businessImpact: `Protects agency operating payroll liquidity and caps advance exposure per employee.`,
        recommendedAction: "Review pending employee salary advances in Finance.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        affectedEntityCount: reqCount,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }

    default: {
      return {
        ruleKey: rule.rule_key,
        status: hasContradiction ? "warning" : "healthy",
        conditionMet: false,
        observedValue: rule.numeric_value,
        observedDisplay: configuredThresholdDisplay,
        configuredThresholdDisplay,
        finding: `Rule configured at ${configuredThresholdDisplay}. Operating within normal parameters.`,
        businessImpact: `Active in governance engine.`,
        recommendedAction: "No action required.",
        actionRoute: meta.actionRoute,
        actionLabel: meta.actionLabel,
        consumers: meta.consumers,
        evaluatedAt: nowIso,
        isContradictory: hasContradiction,
        contradictionDetails,
      };
    }
  }
}

// ============================================================
// 5. EVALUATE ALL RULES & BUILD EXECUTIVE OVERVIEW
// ============================================================

export function evaluateAllBusinessRules(
  rules: BusinessRule[],
  context: LiveBusinessContext
): {
  evaluations: Map<string, RuleEvaluationResult>;
  overview: ExecutiveRulesOverview;
  contradictions: Map<string, ContradictionWarning[]>;
} {
  const contradictions = detectRuleContradictions(rules);
  const evaluations = new Map<string, RuleEvaluationResult>();

  let liveEvaluatedCount = 0;
  let configurationPolicyCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let healthyCount = 0;
  let insufficientDataCount = 0;
  let rulesRequiringReviewCount = 0;

  const categoryRiskDistribution: Record<
    BusinessRuleCategory,
    { total: number; critical: number; warning: number; healthy: number; policies: number }
  > = {
    sales_commissions: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    sponsoring_advertising: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    profitability: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    cash_treasury: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    fixed_burn: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    smart_insights: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    notifications_alerts: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
    operations: { total: 0, critical: 0, warning: 0, healthy: 0, policies: 0 },
  };

  for (const rule of rules) {
    const res = evaluateSingleRule(rule, context, contradictions);
    evaluations.set(rule.rule_key, res);

    const cat = rule.category;
    if (categoryRiskDistribution[cat]) {
      categoryRiskDistribution[cat].total++;
    }

    // Check if customized from default
    const hasNumericDef = rule.default_numeric_value !== null && rule.default_numeric_value !== undefined;
    const isCustomized = hasNumericDef && Number(rule.numeric_value) !== Number(rule.default_numeric_value);

    if (res.status === "critical") {
      criticalCount++;
      rulesRequiringReviewCount++;
      if (categoryRiskDistribution[cat]) categoryRiskDistribution[cat].critical++;
    } else if (res.status === "warning") {
      warningCount++;
      rulesRequiringReviewCount++;
      if (categoryRiskDistribution[cat]) categoryRiskDistribution[cat].warning++;
    } else if (res.status === "healthy") {
      healthyCount++;
      if (categoryRiskDistribution[cat]) categoryRiskDistribution[cat].healthy++;
    } else if (res.status === "config_only") {
      configurationPolicyCount++;
      if (categoryRiskDistribution[cat]) categoryRiskDistribution[cat].policies++;
    } else {
      insufficientDataCount++;
    }

    if (RULE_METADATA_REGISTRY[rule.rule_key]?.evaluationType === "live_evaluator") {
      liveEvaluatedCount++;
    }

    if (isCustomized || res.isContradictory) {
      rulesRequiringReviewCount++;
    }
  }

  const triggeredRulesCount = criticalCount + warningCount;

  const overview: ExecutiveRulesOverview = {
    totalRules: rules.length,
    liveEvaluatedCount,
    configurationPolicyCount,
    triggeredRulesCount,
    criticalCount,
    warningCount,
    healthyCount,
    insufficientDataCount,
    rulesRequiringReviewCount,
    recentChangesCount: context.recentVersionsCount30d,
    categoryRiskDistribution,
    lastEvaluatedAt: new Date().toISOString(),
  };

  return { evaluations, overview, contradictions };
}

// ============================================================
// 6. DETERMINISTIC IMPACT SIMULATION ENGINE (Preview Simulator)
// ============================================================

export function simulateRuleChangeImpact(
  rule: BusinessRule,
  proposedValue: number | string,
  rules: BusinessRule[],
  context: LiveBusinessContext
): ImpactSimulationResult {
  const currentVal = rule.value_type === "numeric" ? Number(rule.numeric_value) : String(rule.text_value || "");
  const proposedNum = Number(proposedValue);
  const isNumeric = rule.value_type === "numeric";
  const delta = isNumeric && !isNaN(proposedNum) ? Number((proposedNum - Number(currentVal)).toFixed(2)) : null;

  const meta = RULE_METADATA_REGISTRY[rule.rule_key] || {
    ruleKey: rule.rule_key,
    category: rule.category,
    name: rule.rule_name,
    description: rule.description,
    evaluationType: "configuration_policy",
    dataType: rule.value_type,
    unit: rule.unit || "",
    operator: "==",
    severity: "info",
    appliesTo: "system",
    consumers: [],
    actionRoute: "/admin/business-rules",
    actionLabel: "Inspect",
    observedDataSource: "config",
    minValue: null,
    maxValue: null,
  };

  // Evaluate current
  const currentEvaluation = evaluateSingleRule(rule, context);

  // Construct hypothetical rule set with proposed value
  const simulatedRules = rules.map((r) => {
    if (r.id === rule.id || r.rule_key === rule.rule_key) {
      return {
        ...r,
        numeric_value: isNumeric ? proposedNum : r.numeric_value,
        text_value: !isNumeric ? String(proposedValue) : r.text_value,
      };
    }
    return r;
  });

  const simulatedContradictions = detectRuleContradictions(simulatedRules);
  const simulatedRule = simulatedRules.find((r) => r.rule_key === rule.rule_key) || rule;
  const simulatedEvaluation = evaluateSingleRule(simulatedRule, context, simulatedContradictions);

  const contradictionWarnings = (simulatedContradictions.get(rule.rule_key) || []).map((c) => c.message);

  let finding = "";
  let simulatedImpact = "";

  if (meta.evaluationType === "configuration_policy") {
    finding = `Proposing updating ${rule.rule_name} from ${currentVal} to ${proposedValue} ${rule.unit || ""}.`;
    simulatedImpact = `Future calculations in [${meta.consumers.join(", ")}] will immediately adopt this new baseline. Historical completed transactions and closed invoices remain unaffected.`;
  } else {
    finding = `Under proposed threshold (${proposedValue} ${rule.unit || ""}), evaluation changes from ${currentEvaluation.status.toUpperCase()} to ${simulatedEvaluation.status.toUpperCase()}.`;
    if (simulatedEvaluation.status === "healthy" && currentEvaluation.status !== "healthy") {
      simulatedImpact = `Positive Impact: Proposed adjustment clears active alert condition against current business observations (${simulatedEvaluation.observedDisplay}).`;
    } else if (simulatedEvaluation.status === "critical" && currentEvaluation.status !== "critical") {
      simulatedImpact = `Advisory Risk: Proposed adjustment immediately triggers a CRITICAL alert against current business observations (${simulatedEvaluation.observedDisplay}).`;
    } else {
      simulatedImpact = `Deterministic Preview: Status remains ${simulatedEvaluation.status.toUpperCase()}. Observed value is ${simulatedEvaluation.observedDisplay}.`;
    }
  }

  return {
    currentValue: currentVal,
    proposedValue,
    delta,
    unit: rule.unit || "",
    currentStatus: currentEvaluation.status,
    simulatedStatus: simulatedEvaluation.status,
    finding,
    simulatedImpact,
    affectedConsumers: meta.consumers,
    contradictionWarnings,
    isPreviewDeterministic: true,
  };
}

// ============================================================
// 7. EVIDENCE-BASED SMART INSIGHTS ENGINE
// ============================================================

export function generateBusinessRulesSmartInsights(
  evaluations: Map<string, RuleEvaluationResult>,
  rules: BusinessRule[],
  context: LiveBusinessContext
): BusinessRuleSmartInsight[] {
  const insights: BusinessRuleSmartInsight[] = [];

  // Safeguard against missing / incomplete telemetry
  if (context.isLiveDataAvailable === false) {
    return [
      {
        id: "insight-data-synchronization",
        ruleKey: "critical_runway_months",
        category: "cash_treasury",
        type: "info",
        title: "Telemetry Synchronization Pending",
        finding: "Authoritative financial and operations telemetry is currently uninitialized or unavailable.",
        businessImpact: "Executive insights are suspended to prevent decisions based on stale or incomplete data.",
        supportingEvidence: "Zero authoritative records returned from financial accounts or transaction ledgers.",
        observationPeriod: "Current Session",
        confidence: "high",
        recommendedAction: "Verify database connectivity and refresh financial ledger cache.",
        actionRoute: "/admin/finance",
        actionLabel: "Verify Financial Data",
      },
    ];
  }

  // Insight 1: Cash Runway Evaluation
  const runwayEval = evaluations.get("critical_runway_months");
  if (runwayEval) {
    if (runwayEval.status === "critical") {
      insights.push({
        id: "insight-runway-critical",
        ruleKey: "critical_runway_months",
        category: "cash_treasury",
        type: "critical",
        title: "Critical Cash Runway Alert",
        finding: `Operating reserves cover only ${context.runwayMonths} months at current burn rate of ${formatCurrency(context.recurringBurn)}/mo, falling below the ${runwayEval.configuredThresholdDisplay} mandatory floor.`,
        businessImpact: "Risk of insolvency within 90 days if receivables collection slows.",
        supportingEvidence: `Current cash: ${formatCurrency(context.cashReserves)} | Monthly burn: ${formatCurrency(context.recurringBurn)}.`,
        observationPeriod: "Current Month (October 2026)",
        confidence: "high",
        recommendedAction: "Accelerate high-priority invoice collection and limit discretionary spending.",
        actionRoute: "/admin/finance",
        actionLabel: "Inspect Cash Runway",
      });
    } else {
      insights.push({
        id: "insight-runway-healthy",
        ruleKey: "critical_runway_months",
        category: "cash_treasury",
        type: "positive",
        title: "Robust Treasury Reserve Runway",
        finding: `Liquid reserves (${formatCurrency(context.cashReserves)}) provide ${context.runwayMonths} months of operational runway, comfortably exceeding the configured ${runwayEval.configuredThresholdDisplay} floor.`,
        businessImpact: "Provides strong financial stability to support selective capital investments.",
        supportingEvidence: `Cash: ${formatCurrency(context.cashReserves)} | Overhead burn: ${formatCurrency(context.recurringBurn)}/mo.`,
        observationPeriod: "Current Month (October 2026)",
        confidence: "high",
        recommendedAction: "Maintain cash preservation protocols while evaluating growth investments.",
        actionRoute: "/admin/finance",
        actionLabel: "View Treasury State",
      });
    }
  }

  // Insight 2: Fixed Overhead Burden
  const burnEval = evaluations.get("fixed_burn_warning_percent");
  if (burnEval && burnEval.status === "warning") {
    insights.push({
      id: "insight-fixed-burn",
      ruleKey: "fixed_burn_warning_percent",
      category: "fixed_burn",
      type: "warning",
      title: "Elevated Fixed Overhead Ratio",
      finding: `Recurring subscriptions represent ${context.fixedBurnRatio}% of collected revenue (${formatCurrency(context.recurringBurn)} of ${formatCurrency(context.monthlyRevenue)}), exceeding the ${burnEval.configuredThresholdDisplay} limit.`,
      businessImpact: "Compresses net operating margins and reduces liquidity flexibility during seasonal dips.",
      supportingEvidence: `16 active recurring subscriptions amounting to ${formatCurrency(context.recurringBurn)}/mo.`,
      observationPeriod: "Current Month (October 2026)",
      confidence: "high",
      recommendedAction: "Audit recurring SaaS licenses and cancel unused seats.",
      actionRoute: "/admin/finance",
      actionLabel: "Audit Subscriptions",
    });
  }

  // Insight 3: Sponsoring Arbitrage Efficiency
  const sponsoringEval = evaluations.get("minimum_net_margin_for_sponsoring_efficiency");
  if (sponsoringEval && sponsoringEval.status === "warning") {
    insights.push({
      id: "insight-sponsoring-margin",
      ruleKey: "minimum_net_margin_for_sponsoring_efficiency",
      category: "sponsoring_advertising",
      type: "warning",
      title: "Sponsoring Arbitrage Below Target",
      finding: `FX billing spread delivers a ${context.sponsoringSpreadMarginPercent}% net margin (${context.sponsoringClientRate} vs ${context.sponsoringPurchaseRate} TND/USD), trailing the configured ${sponsoringEval.configuredThresholdDisplay} target.`,
      businessImpact: "Paid advertising management yields lower contribution profit than targeted.",
      supportingEvidence: `Client Rate: ${context.sponsoringClientRate} TND | Purchase Rate: ${context.sponsoringPurchaseRate} TND.`,
      observationPeriod: "Active Campaign Rates",
      confidence: "high",
      recommendedAction: "Review client invoicing rate or re-evaluate supplier purchase exchange rate.",
      actionRoute: "/admin/finance",
      actionLabel: "Inspect Sponsoring Engine",
    });
  }

  // Insight 4: Client Portfolio Low Margin Concentration
  const clientEval = evaluations.get("low_profit_client_margin_percent");
  if (clientEval && clientEval.affectedEntityCount && clientEval.affectedEntityCount > 0) {
    insights.push({
      id: "insight-low-margin-clients",
      ruleKey: "low_profit_client_margin_percent",
      category: "profitability",
      type: "warning",
      title: "Client Margin Concentration Attention",
      finding: `${clientEval.affectedEntityCount} active accounts currently yield net contribution margins under ${clientEval.configuredThresholdDisplay}.`,
      businessImpact: "Sub-optimal pricing models erode cumulative agency gross profitability.",
      supportingEvidence: `${clientEval.affectedEntityCount} of ${context.totalActiveClients} accounts evaluated with low margin status.`,
      observationPeriod: "Cumulative Account History",
      confidence: "high",
      recommendedAction: "Inspect client deliverable hours and propose retainer tier adjustments.",
      actionRoute: "/admin/clients",
      actionLabel: "Inspect Client Accounts",
    });
  }

  return insights;
}

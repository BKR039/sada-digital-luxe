// ============================================================
// SADA OS — CENTRALIZED BUSINESS RULES & CONFIGURATION TYPES
// Type definitions for business rules, versioning, categories,
// units, operators, severities, and typed getter interfaces.
// ============================================================

export type BusinessRuleCategory =
  | "sales_commissions"
  | "sponsoring_advertising"
  | "profitability"
  | "cash_treasury"
  | "fixed_burn"
  | "smart_insights"
  | "notifications_alerts"
  | "operations";

export type BusinessRuleValueType = "numeric" | "boolean" | "text" | "json";

export type BusinessRuleOperator = "<" | "<=" | ">" | ">=" | "==" | "!=";
export type BusinessRuleSeverity = "info" | "warning" | "critical";
export type BusinessRuleAppliesTo =
  | "system"
  | "kpi"
  | "alerts"
  | "smart_insights"
  | "notifications"
  | "treasury"
  | "clients"
  | "sales"
  | "operations";

export type BusinessRuleKey =
  // Sales & Commissions
  | "initial_commission_rate"
  | "initial_sales_commission_rate"
  | "initial_commission_duration_months"
  | "renewal_commission_rate"
  | "renewal_sales_commission_rate"
  | "renewal_commission_duration_months"
  | "upsell_commission_rate"
  | "upsell_sales_commission_rate"
  | "high_commission_amount"
  // Sponsoring & Advertising
  | "sponsoring_purchase_rate"
  | "sponsoring_client_rate"
  | "sponsoring_min_margin_percent"
  | "minimum_net_margin_for_sponsoring_efficiency"
  // Profitability
  | "client_high_profit_margin_percent"
  | "high_profit_margin_percent"
  | "client_high_profit_amount_tnd"
  | "high_profit_contribution_tnd"
  | "client_medium_profit_margin_percent"
  | "client_medium_profit_amount_tnd"
  | "low_profit_client_margin_percent"
  | "low_margin_client_threshold_percent"
  | "historical_profit_zero_behavior"
  // Cash & Treasury
  | "critical_runway_months"
  | "warning_runway_months"
  | "runway_default_months"
  // Fixed Burn
  | "fixed_burn_warning_percent"
  | "high_fixed_burn_revenue_percent"
  // Smart Insights
  | "high_commission_insight_threshold_tnd"
  | "receivables_critical_days"
  // Notifications & Alerts
  | "notification_deduplication_hours"
  | "task_due_soon_days"
  | "task_due_soon_lead_days"
  // Operations
  | "standard_monthly_working_hours"
  | "max_salary_advance_percent";

export interface BusinessRule {
  id: string;
  rule_key: BusinessRuleKey | string;
  rule_name: string;
  description: string;
  category: BusinessRuleCategory;
  value_type: BusinessRuleValueType;
  numeric_value: number | null;
  boolean_value: boolean | null;
  text_value: string | null;
  json_value: any | null;
  default_numeric_value?: number | null;
  default_boolean_value?: boolean | null;
  default_text_value?: string | null;
  default_json_value?: any | null;
  unit: string | null;
  operator?: BusinessRuleOperator | string | null;
  severity?: BusinessRuleSeverity | null;
  applies_to?: BusinessRuleAppliesTo | string | null;
  metadata?: Record<string, any> | null;
  min_value: number | null;
  max_value: number | null;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
  version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessRuleVersion {
  id: string;
  rule_id: string;
  rule_key: string;
  version: number;
  numeric_value: number | null;
  boolean_value: boolean | null;
  text_value: string | null;
  json_value: any | null;
  operator?: string | null;
  severity?: string | null;
  applies_to?: string | null;
  metadata?: Record<string, any> | null;
  effective_from: string;
  effective_until: string | null;
  change_reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface UpdateBusinessRuleParams {
  ruleId: string;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  textValue?: string | null;
  jsonValue?: any | null;
  changeReason: string;
  actorId?: string;
  actorName?: string;
}

export interface ResetBusinessRuleParams {
  ruleId: string;
  changeReason?: string;
  actorId?: string;
  actorName?: string;
}

export interface SADABusinessRulesMap {
  initial_commission_rate: number;
  initial_sales_commission_rate: number;
  initial_commission_duration_months: number;
  renewal_commission_rate: number;
  renewal_sales_commission_rate: number;
  renewal_commission_duration_months: number;
  upsell_commission_rate: number;
  upsell_sales_commission_rate: number;
  high_commission_amount: number;
  sponsoring_purchase_rate: number;
  sponsoring_client_rate: number;
  sponsoring_min_margin_percent: number;
  minimum_net_margin_for_sponsoring_efficiency: number;
  client_high_profit_margin_percent: number;
  high_profit_margin_percent: number;
  client_high_profit_amount_tnd: number;
  high_profit_contribution_tnd: number;
  client_medium_profit_margin_percent: number;
  client_medium_profit_amount_tnd: number;
  low_profit_client_margin_percent: number;
  low_margin_client_threshold_percent: number;
  historical_profit_zero_behavior: string;
  critical_runway_months: number;
  warning_runway_months: number;
  runway_default_months: number;
  fixed_burn_warning_percent: number;
  high_fixed_burn_revenue_percent: number;
  high_commission_insight_threshold_tnd: number;
  receivables_critical_days: number;
  notification_deduplication_hours: number;
  task_due_soon_days: number;
  task_due_soon_lead_days: number;
  standard_monthly_working_hours: number;
  max_salary_advance_percent: number;
}

// ============================================================
// INTELLIGENT GOVERNANCE & EVALUATION ENGINE TYPES
// ============================================================

export type RuleEvaluationStatus =
  | "healthy"
  | "warning"
  | "critical"
  | "config_only"
  | "insufficient_data";

export interface RuleEvaluationResult {
  ruleKey: string;
  status: RuleEvaluationStatus;
  conditionMet: boolean;
  observedValue: number | string | null;
  observedDisplay: string;
  configuredThresholdDisplay: string;
  finding: string;
  businessImpact: string;
  recommendedAction: string;
  actionRoute: string;
  actionLabel: string;
  consumers: string[];
  affectedEntityCount?: number;
  evaluatedAt: string;
  isContradictory?: boolean;
  contradictionDetails?: string;
}

export interface RuleMetadataDefinition {
  ruleKey: BusinessRuleKey | string;
  category: BusinessRuleCategory;
  name: string;
  description: string;
  evaluationType: "live_evaluator" | "configuration_policy";
  dataType: BusinessRuleValueType;
  unit: string;
  operator: BusinessRuleOperator;
  severity: BusinessRuleSeverity;
  appliesTo: BusinessRuleAppliesTo | string;
  consumers: string[];
  actionRoute: string;
  actionLabel: string;
  observedDataSource: string;
  minValue: number | null;
  maxValue: number | null;
}

export interface LiveBusinessContext {
  cashReserves: number;
  recurringBurn: number;
  runwayMonths: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  fixedBurnRatio: number;
  sponsoringSpreadMarginPercent: number;
  sponsoringPurchaseRate: number;
  sponsoringClientRate: number;
  unpaidInvoicesCount: number;
  totalOutstandingReceivables: number;
  overdueInvoicesPastCriticalDays: number;
  criticalReceivablesThresholdDays: number;
  lowMarginClientsCount: number;
  medProfitClientsCount?: number;
  highProfitClientsCount: number;
  highProfitAmountClientsCount?: number;
  medProfitAmountClientsCount?: number;
  maxCommissionAmountTnd?: number;
  totalActiveClients: number;
  activeTasksCount: number;
  tasksDueSoonCount: number;
  taskDueLeadDays: number;
  pendingSalaryRequestsCount: number;
  maxSalaryAdvanceRequestedPercent: number;
  recentVersionsCount30d: number;
  lastUpdatedVersionTimestamp?: string;
  isLiveDataAvailable?: boolean;
  fetchedAt: string;
}

export interface ContradictionWarning {
  ruleKey: string;
  severity: "warning" | "error";
  message: string;
  relatedRuleKey: string;
}

export interface ImpactSimulationResult {
  currentValue: number | string;
  proposedValue: number | string;
  delta: number | null;
  unit: string;
  currentStatus: RuleEvaluationStatus;
  simulatedStatus: RuleEvaluationStatus;
  finding: string;
  simulatedImpact: string;
  affectedConsumers: string[];
  affectedEntityCount?: {
    current: number;
    simulated: number;
    entityName: string;
  };
  contradictionWarnings: string[];
  isPreviewDeterministic: boolean;
}

export interface ExecutiveRulesOverview {
  totalRules: number;
  liveEvaluatedCount: number;
  configurationPolicyCount: number;
  triggeredRulesCount: number;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  insufficientDataCount: number;
  rulesRequiringReviewCount: number;
  recentChangesCount: number;
  categoryRiskDistribution: Record<
    BusinessRuleCategory,
    { total: number; critical: number; warning: number; healthy: number; policies: number }
  >;
  lastEvaluatedAt: string;
}

export interface BusinessRuleSmartInsight {
  id: string;
  ruleKey: string;
  category: BusinessRuleCategory;
  type: "critical" | "warning" | "positive" | "info";
  title: string;
  finding: string;
  businessImpact: string;
  supportingEvidence: string;
  observationPeriod: string;
  confidence: "high" | "medium" | "low";
  recommendedAction: string;
  actionRoute: string;
  actionLabel: string;
}
